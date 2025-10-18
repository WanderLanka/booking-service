const express = require('express');
const mongoose = require('mongoose');
const TourPackageBooking = require('../../models/TourPackageBooking');
const { incrementTourPackageBookingCount, incrementGuideBookingCount } = require('../../services/guideServiceClient');

const router = express.Router();

// POST /tourpackage_booking/cancel/:id
router.post('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid booking id' });
    }
    const doc = await TourPackageBooking.findById(id);
    if (!doc) return res.status(404).json({ success: false, error: 'Booking not found' });
    if (doc.status === 'cancelled') {
      return res.json({ success: true, data: doc });
    }

    // CANCELLATION POLICY CHECK (only for confirmed bookings)
    if (doc.status === 'confirmed') {
      const cancellationPolicy = doc.cancellationPolicy || {};
      
      // Check if free cancellation is allowed
      if (!cancellationPolicy.freeCancellation) {
        return res.status(403).json({
          success: false,
          error: 'Cancellation not allowed',
          message: 'This booking does not allow free cancellation after confirmation.'
        });
      }

      // Check cancellation window
      const now = new Date();
      const startDate = new Date(doc.startDate);
      const daysUntilStart = Math.ceil((startDate - now) / (1000 * 60 * 60 * 24));
      
      let requiredDays = 0;
      switch (cancellationPolicy.freeCancellationWindow) {
        case '1_day_before':
          requiredDays = 1;
          break;
        case '7_days_before':
          requiredDays = 7;
          break;
        case '14_days_before':
          requiredDays = 14;
          break;
        case 'anytime':
          requiredDays = 0;
          break;
        default:
          requiredDays = 0;
      }

      if (daysUntilStart < requiredDays) {
        return res.status(403).json({
          success: false,
          error: 'Cancellation window expired',
          message: `Free cancellation requires at least ${requiredDays} days before the start date. You have ${daysUntilStart} days remaining.`,
          cancellationPolicy: {
            freeCancellation: cancellationPolicy.freeCancellation,
            freeCancellationWindow: cancellationPolicy.freeCancellationWindow,
            daysUntilStart,
            requiredDays
          }
        });
      }
    }

    const wasConfirmed = doc.status === 'confirmed';
    doc.status = 'cancelled';
    if (doc.payment) {
      doc.payment.status = 'cancelled';
    }
    await doc.save();

    // If previously confirmed, decrement both package and guide booking counts
    if (wasConfirmed) {
      try {
        await incrementTourPackageBookingCount(doc.tourPackageId, -1);
        
        // Also decrement guide's total bookings
        if (doc.guideId) {
          await incrementGuideBookingCount(doc.guideId, -1);
        }
      } catch (e) {
        // non-blocking - log but don't fail the cancellation
        console.error('Failed to update metrics on cancellation:', e.message);
      }
    }
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
