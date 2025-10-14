const TourGuideReservation = require('../../models/TourGuideReservation');

module.exports = async (req, res) => {
  try {
    const { guideId, userId, status } = req.query;
    const filter = {};
    if (guideId) filter.guideId = guideId;
    if (userId) filter.userId = userId;
    if (status) filter.status = status;

    const reservations = await TourGuideReservation.find(filter).sort({ createdAt: -1 });
    return res.json({ success: true, data: reservations });
  } catch (err) {
    console.error('List reservations error:', err);
    return res.status(500).json({ success: false, message: 'Failed to list reservations' });
  }
};
