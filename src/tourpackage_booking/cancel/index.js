const express = require('express');
const mongoose = require('mongoose');
const TourPackageBooking = require('../../models/TourPackageBooking');
const { incrementTourPackageBookingCount } = require('../../services/guideServiceClient');

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

    const wasConfirmed = doc.status === 'confirmed';
    doc.status = 'cancelled';
    if (doc.payment) {
      doc.payment.status = 'cancelled';
    }
    await doc.save();

    // If previously confirmed, decrement booking count on guide-service (non-blocking)
    if (wasConfirmed) {
      try {
        await incrementTourPackageBookingCount(doc.tourPackageId, -1);
      } catch (e) {
        // ignore
      }
    }
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
