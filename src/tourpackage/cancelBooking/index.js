const TourPackageBooking = require('../../models/TourPackageBooking');
const { cancelBookingSchema } = require('../../validators/tourPackageValidators');
const validate = require('../../middleware/validate');
const MockPaymentGateway = require('../../utils/mockPaymentGateway');
const { fetchPackageDetails, updatePackageBookingCount, syncBookingWithGuide } = require('../../utils/bookingSync');
const logger = require('../../utils/logger');

const validateCancel = validate(cancelBookingSchema);

const handler = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, requestRefund = true } = req.body;
    const userId = req.user?.id;

    logger.info(`Cancellation request for booking ${id} by user ${userId}`);

    // Step 1: Find booking
    const booking = await TourPackageBooking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Step 2: Verify booking status
    if (booking.status === 'cancelled') {
      return res.status(400).json({ 
        success: false, 
        message: 'Booking is already cancelled' 
      });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot cancel a completed booking' 
      });
    }

    // Step 3: Verify user is authorized (booking owner or admin)
    const isOwner = booking.userId.toString() === userId;
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'Sysadmin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'You are not authorized to cancel this booking' 
      });
    }

    // Step 4: Fetch package details to check cancellation policy
    let packageDetails;
    try {
      packageDetails = await fetchPackageDetails(booking.packageId);
    } catch (error) {
      logger.error('Failed to fetch package details for cancellation:', error);
      // Allow cancellation even if package fetch fails (package might be deleted)
      packageDetails = { policies: { freeCancellation: false } };
    }

    // Step 5: Check if cancellation is allowed
    const cancellationPolicy = packageDetails.policies || {};
    const cancellationCheck = booking.canBeCancelled(cancellationPolicy);

    if (!cancellationCheck.allowed) {
      return res.status(400).json({
        success: false,
        message: cancellationCheck.reason,
        policy: {
          freeCancellation: cancellationPolicy.freeCancellation || false,
          window: cancellationPolicy.freeCancellationWindow,
          daysUntilStart: cancellationCheck.daysUntilStart,
          requiredDays: cancellationCheck.requiredDays,
        },
      });
    }

    // Step 6: Calculate refund
    const refundAmount = requestRefund ? booking.calculateRefund(cancellationPolicy) : 0;
    let refundResult = null;

    // Step 7: Process refund if eligible
    if (refundAmount > 0 && booking.payment.transactionId) {
      try {
        refundResult = await MockPaymentGateway.processRefund({
          transactionId: booking.payment.transactionId,
          amount: refundAmount,
          currency: booking.currency,
          reason: reason || 'Customer cancellation',
        });

        logger.info(`Refund processed: ${refundResult.refundId}, amount: ${refundAmount}`);
      } catch (error) {
        logger.error('Refund processing failed:', error);
        // Continue with cancellation even if refund fails
        // Admin can process refund manually
      }
    }

    // Step 8: Update booking
    const updated = await TourPackageBooking.findByIdAndUpdate(
      id,
      {
        status: 'cancelled',
        'cancellation.cancelledAt': new Date(),
        'cancellation.cancelledBy': userId,
        'cancellation.reason': reason,
        'cancellation.refundEligible': refundAmount > 0,
        'cancellation.refundAmount': refundAmount,
        'payment.status': refundResult?.success ? 'refunded' : booking.payment.status,
        'payment.refundedAt': refundResult?.refundedAt,
        'payment.refundAmount': refundAmount,
        updatedBy: userId,
      },
      { new: true }
    );

    logger.info(`Booking ${id} cancelled successfully`);

    // Step 9: Update package booking count (async, don't wait)
    updatePackageBookingCount(booking.packageId, -1)
      .catch(err => logger.error('Failed to update booking count:', err));

    // Step 10: Sync with guide service (async, don't wait)
    syncBookingWithGuide(updated, 'cancel')
      .catch(err => logger.error('Failed to sync booking cancellation:', err));

    return res.json({ 
      success: true, 
      data: updated,
      refund: refundResult ? {
        refundId: refundResult.refundId,
        amount: refundAmount,
        status: refundResult.status,
        message: refundResult.message,
      } : null,
    });
  } catch (err) {
    logger.error('Cancel booking error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to cancel booking',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

module.exports = [validateCancel, handler];
