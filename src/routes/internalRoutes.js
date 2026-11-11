const express = require('express');
const mongoose = require('mongoose');
const Booking = require('../models/TourPackageBooking');
const { requireInternal } = require('../../security');
const router = express.Router();
router.use(requireInternal);
router.get('/guide-bookings', async (req, res, next) => {
  try {
    const { guideId, startDate, endDate } = req.query;
    const start = new Date(startDate), end = new Date(endDate);
    if (!mongoose.isValidObjectId(guideId) || !Number.isFinite(+start) || !Number.isFinite(+end) || start > end) {
      return res.status(400).json({ success: false, error: 'Valid guide and date range required' });
    }
    const bookings = await Booking.find({ guideId, status: { $in: ['approved', 'confirmed'] }, startDate: { $lte: end }, endDate: { $gte: start } }).select('startDate endDate status').lean();
    return res.json({ success: true, data: bookings });
  } catch (error) { return next(error); }
});
module.exports = router;
