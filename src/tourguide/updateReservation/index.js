const TourGuideReservation = require('../../models/TourGuideReservation');
const { updateReservationSchema } = require('../../validators/tourGuideValidators');
const validate = require('../../middleware/validate');

const validateUpdate = validate(updateReservationSchema);

const handler = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Prevent overlapping when dates are changed
    if (updates.startDate || updates.endDate) {
      const reservation = await TourGuideReservation.findById(id);
      if (!reservation) {
        return res.status(404).json({ success: false, message: 'Reservation not found' });
      }
      const startDate = updates.startDate || reservation.startDate;
      const endDate = updates.endDate || reservation.endDate;

      const overlapping = await TourGuideReservation.findOne({
        _id: { $ne: id },
        guideId: reservation.guideId,
        status: { $in: ['pending', 'confirmed'] },
        $or: [
          { startDate: { $lt: new Date(endDate) }, endDate: { $gt: new Date(startDate) } },
        ],
      });
      if (overlapping) {
        return res.status(409).json({ success: false, message: 'Guide is not available for the selected dates' });
      }
    }

    const updated = await TourGuideReservation.findByIdAndUpdate(
      id,
      { ...updates, updatedBy: req.user?.id },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Reservation not found' });
    }

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Update reservation error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update reservation' });
  }
};

module.exports = [validateUpdate, handler];
