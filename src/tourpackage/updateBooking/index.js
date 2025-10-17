const TourPackageBooking = require('../../models/TourPackageBooking');
const { updateBookingSchema } = require('../../validators/tourPackageValidators');
const validate = require('../../middleware/validate');

const validateUpdate = validate(updateBookingSchema);

const handler = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Prevent overlapping when dates are changed
    if (updates.startDate || updates.endDate) {
      const booking = await TourPackageBooking.findById(id);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }
      const startDate = updates.startDate || booking.startDate;
      const endDate = updates.endDate || booking.endDate;

      const overlapping = await TourPackageBooking.findOne({
        _id: { $ne: id },
        packageId: booking.packageId,
        status: { $in: ['pending', 'confirmed'] },
        $or: [
          { startDate: { $lt: new Date(endDate) }, endDate: { $gt: new Date(startDate) } },
        ],
      });
      if (overlapping) {
        return res.status(409).json({ success: false, message: 'Package is not available for the selected dates' });
      }
    }

    const updated = await TourPackageBooking.findByIdAndUpdate(
      id,
      { ...updates, updatedBy: req.user?.id },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Update booking error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update booking' });
  }
};

module.exports = [validateUpdate, handler];
