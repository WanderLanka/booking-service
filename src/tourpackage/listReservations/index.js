const TourPackageReservation = require('../../models/TourPackageReservation');

module.exports = async (req, res) => {
  try {
    const { packageId, userId, status } = req.query;
    const filter = {};
    if (packageId) filter.packageId = packageId;
    if (userId) filter.userId = userId;
    if (status) filter.status = status;

    const reservations = await TourPackageReservation.find(filter).sort({ createdAt: -1 });
    return res.json({ success: true, data: reservations });
  } catch (err) {
    console.error('List reservations error:', err);
    return res.status(500).json({ success: false, message: 'Failed to list reservations' });
  }
};
