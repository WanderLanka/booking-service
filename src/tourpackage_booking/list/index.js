const express = require('express');
const TourPackageBooking = require('../../models/TourPackageBooking');

const router = express.Router();

// GET /tourpackage_booking/list
// Optional filters: userId, tourPackageId, status
router.get('/', async (req, res, next) => {
  try {
    const { userId, tourPackageId, status } = req.query;
    const filter = {};
    if (userId) filter.userId = userId;
    if (tourPackageId) filter.tourPackageId = tourPackageId;
    if (status) filter.status = status;
    const items = await TourPackageBooking.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
