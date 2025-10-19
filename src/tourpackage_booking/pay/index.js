const express = require('express');
const TourPackageBooking = require('../../models/TourPackageBooking');
const { createPaymentIntent, capturePayment } = require('../../services/mockPaymentGateway');
const { incrementTourPackageBookingCount, incrementGuideBookingCount } = require('../../services/guideServiceClient');

const router = express.Router();

// POST /tourpackage_booking/pay/:id
// In mock flow: create and capture payment, check guide availability, set booking to confirmed
router.post('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const booking = await TourPackageBooking.findById(id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    if (booking.status !== 'approved' && booking.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Booking must be pending or approved to pay' });
    }

    // CRITICAL: Check guide availability before processing payment
    // A guide is unavailable if another traveller has a confirmed booking on the same tour date
    if (booking.guideId) {
      const conflictingBooking = await TourPackageBooking.findOne({
        guideId: booking.guideId,
        status: 'confirmed',
        _id: { $ne: booking._id }, // Exclude current booking
        $or: [
          // Check if the date ranges overlap
          {
            startDate: { $lte: booking.endDate },
            endDate: { $gte: booking.startDate }
          }
        ]
      });

      if (conflictingBooking) {
        // Guide is unavailable - set status back to pending and notify traveller
        booking.status = 'pending';
        await booking.save();
        
        return res.status(409).json({ 
          success: false, 
          error: 'Guide is not available on the selected dates',
          message: 'The tour guide already has a confirmed booking during your selected dates. Please choose another available date.',
          conflictingDates: {
            start: conflictingBooking.startDate,
            end: conflictingBooking.endDate
          }
        });
      }
    }

    const amount = booking.pricing?.totalAmount || 0;
    const currency = booking.pricing?.currency || 'USD';

    const intent = await createPaymentIntent({
      amount,
      currency,
      metadata: { bookingId: String(booking._id), type: 'tourpackage' },
    });

    const capture = await capturePayment(intent.id);
    const paymentStatus = capture.status === 'captured' ? 'captured' : 'failed';
    const bookingStatus = paymentStatus === 'captured' ? 'confirmed' : booking.status;

    booking.status = bookingStatus;
    booking.payment = {
      provider: 'mockpay',
      intentId: intent.id,
      status: paymentStatus,
      currency,
      amount,
      method: booking.payment?.method || 'mock',
      metadata: intent.metadata,
    };
    await booking.save();

    // When payment is confirmed, update both package and guide metrics and block guide availability
    if (bookingStatus === 'confirmed') {
      try {
        // Increment tour package booking count
        await incrementTourPackageBookingCount(booking.tourPackageId, 1);
        
        // Increment guide's total bookings metric and block the date range
        if (booking.guideId) {
          await incrementGuideBookingCount(booking.guideId, 1);
          // Block the guide's availability for the booked date range (inclusive)
          const { blockGuideAvailability } = require('../../services/guideServiceClient');
          await blockGuideAvailability(
            booking.guideId,
            booking.startDate,
            booking.endDate
          );
        }
      } catch (e) {
        // non-blocking - log but don't fail the booking
        console.error('Failed to update metrics:', e.message);
      }
    }

    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
