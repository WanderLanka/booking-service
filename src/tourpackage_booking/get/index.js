const express = require('express');
const mongoose = require('mongoose');
const TourPackageBooking = require('../../models/TourPackageBooking');

const router = express.Router();

// GET /tourpackage_booking/get/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid booking id' });
    }
    const doc = await TourPackageBooking.findById(id).lean();
    if (!doc) return res.status(404).json({ success: false, error: 'Booking not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
