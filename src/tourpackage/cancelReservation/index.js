const TourPackageReservation = require('../../models/TourPackageReservation');

module.exports = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await TourPackageReservation.findByIdAndUpdate(
      id,
      { status: 'cancelled', updatedBy: req.user?.id },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Reservation not found' });
    }
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Cancel reservation error:', err);
    return res.status(500).json({ success: false, message: 'Failed to cancel reservation' });
  }
};
