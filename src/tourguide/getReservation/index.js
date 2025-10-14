const TourGuideReservation = require('../../models/TourGuideReservation');

module.exports = async (req, res) => {
  try {
    const { id } = req.params;
    const reservation = await TourGuideReservation.findById(id);
    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Reservation not found' });
    }
    return res.json({ success: true, data: reservation });
  } catch (err) {
    console.error('Get reservation error:', err);
    return res.status(500).json({ success: false, message: 'Failed to get reservation' });
  }
};
