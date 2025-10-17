const express = require('express');
const mongoose = require('mongoose');
const TourPackageBooking = require('../../models/TourPackageBooking');

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

    doc.status = 'cancelled';
    if (doc.payment) {
      doc.payment.status = 'cancelled';
    }
    await doc.save();
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
