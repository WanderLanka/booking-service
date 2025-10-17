const TourPackageBooking = require('../../models/TourPackageBooking');

module.exports = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await TourPackageBooking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    return res.json({ success: true, data: booking });
  } catch (err) {
    console.error('Get booking error:', err);
    return res.status(500).json({ success: false, message: 'Failed to get booking' });
  }
};
