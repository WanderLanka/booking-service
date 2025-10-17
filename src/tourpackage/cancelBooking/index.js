const TourPackageBooking = require('../../models/TourPackageBooking');

module.exports = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await TourPackageBooking.findByIdAndUpdate(
      id,
      { status: 'cancelled', updatedBy: req.user?.id },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Cancel booking error:', err);
    return res.status(500).json({ success: false, message: 'Failed to cancel booking' });
  }
};
