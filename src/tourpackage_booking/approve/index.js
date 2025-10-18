const express = require('express');
const TourPackageBooking = require('../../models/TourPackageBooking');

const router = express.Router();

// POST /tourpackage_booking/approve/:id
router.post('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const booking = await TourPackageBooking.findById(id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    if (booking.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Only pending bookings can be approved' });
    }

    booking.status = 'approved';
    await booking.save();

    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
