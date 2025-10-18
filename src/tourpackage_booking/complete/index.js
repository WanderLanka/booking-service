const express = require('express');
const TourPackageBooking = require('../../models/TourPackageBooking');

const router = express.Router();

/**
 * POST /tourpackage_booking/complete/:id
 * Marks a confirmed booking as completed after the tour ends
 */
router.post('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const booking = await TourPackageBooking.findById(id);
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        error: 'Booking not found' 
      });
    }

    // Only confirmed bookings can be marked as completed
    if (booking.status !== 'confirmed') {
      return res.status(400).json({ 
        success: false, 
        error: 'Only confirmed bookings can be marked as completed' 
      });
    }

    // Optionally check if end date has passed
    const now = new Date();
    if (booking.endDate && new Date(booking.endDate) > now) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot complete booking before end date' 
      });
    }

    booking.status = 'completed';
    await booking.save();

    res.json({ 
      success: true, 
      data: booking,
      message: 'Booking marked as completed successfully'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
