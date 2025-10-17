const TourPackageBooking = require('../../models/TourPackageBooking');
const { updateBookingSchema } = require('../../validators/tourPackageValidators');
const validate = require('../../middleware/validate');
const { checkGuideAvailability, syncBookingWithGuide } = require('../../utils/bookingSync');
const { calculateTourPackagePrice } = require('../../utils/pricing');
const logger = require('../../utils/logger');

const validateUpdate = validate(updateBookingSchema);

const handler = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user?.id;

    logger.info(`Update request for booking ${id} by user ${userId}`);

    // Step 1: Find existing booking
    const booking = await TourPackageBooking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Step 2: Verify booking can be updated
    if (booking.status === 'cancelled') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot update a cancelled booking' 
      });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot update a completed booking' 
      });
    }

    // Step 3: Verify user is authorized
    const isOwner = booking.userId.toString() === userId;
    const isGuide = booking.guideId.toString() === userId;
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'Sysadmin';
    
    if (!isOwner && !isGuide && !isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'You are not authorized to update this booking' 
      });
    }

    // Step 4: If dates are changing, check guide availability
    if (updates.startDate || updates.endDate) {
      const newStartDate = updates.startDate || booking.startDate;
      const newEndDate = updates.endDate || booking.endDate;

      // Validate end date is after start date
      if (new Date(newEndDate) <= new Date(newStartDate)) {
        return res.status(400).json({ 
          success: false, 
          message: 'End date must be after start date' 
        });
      }

      // Check guide availability
      const availability = await checkGuideAvailability(
        booking.guideId,
        newStartDate,
        newEndDate,
        id // Exclude current booking from check
      );

      if (!availability.available) {
        return res.status(409).json({ 
          success: false, 
          message: 'Guide is not available for the updated dates',
          conflict: availability.conflict
        });
      }

      // Recalculate pricing if dates changed
      const { total: newBasePrice } = calculateTourPackagePrice({
        startDate: newStartDate,
        endDate: newEndDate,
        baseDailyRate: booking.basePrice / booking.durationDays,
      });

      const newTotalPrice = booking.numberOfTravelers 
        ? newBasePrice * booking.numberOfTravelers 
        : newBasePrice;

      updates.basePrice = newBasePrice;
      updates.totalPrice = newTotalPrice;

      logger.info(`Recalculated price for updated dates: ${newTotalPrice}`);
    }

    // Step 5: If number of travelers changed, recalculate price
    if (updates.numberOfTravelers && updates.numberOfTravelers !== booking.numberOfTravelers) {
      const basePrice = updates.basePrice || booking.basePrice;
      updates.totalPrice = basePrice * updates.numberOfTravelers;
      
      logger.info(`Recalculated price for ${updates.numberOfTravelers} travelers: ${updates.totalPrice}`);
    }

    // Step 6: Only guides and admins can update status
    if (updates.status && !isGuide && !isAdmin) {
      delete updates.status;
      logger.warn(`User ${userId} attempted to update status without permission`);
    }

    // Step 7: Update booking
    updates.updatedBy = userId;
    
    const updated = await TourPackageBooking.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    logger.info(`Booking ${id} updated successfully`);

    // Step 8: Sync with guide service (async, don't wait)
    syncBookingWithGuide(updated, 'update')
      .catch(err => logger.error('Failed to sync booking update:', err));

    return res.json({ 
      success: true, 
      data: updated,
      message: 'Booking updated successfully',
    });
  } catch (err) {
    logger.error('Update booking error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to update booking',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

module.exports = [validateUpdate, handler];
