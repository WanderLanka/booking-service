const express = require('express');
const TourPackageBooking = require('../../models/TourPackageBooking');
const { updateGuideResponseTime } = require('../../services/guideServiceClient');

const router = express.Router();

/**
 * POST /tourpackage_booking/decline/:id
 * Allows guide to decline a pending booking request
 */
router.post('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body; // Optional decline reason
    
    const booking = await TourPackageBooking.findById(id);
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        error: 'Booking not found' 
      });
    }

    // Only pending bookings can be declined
    if (booking.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        error: 'Only pending bookings can be declined' 
      });
    }

    booking.status = 'declined';
    
    // Optionally store the decline reason in notes
    if (reason) {
      booking.notes = booking.notes 
        ? `${booking.notes}\n[DECLINED]: ${reason}` 
        : `[DECLINED]: ${reason}`;
    }
    
    await booking.save();

    // Update response time metric for decline as well
    try {
      const now = Date.now();
      const created = new Date(booking.createdAt).getTime();
      const responseTimeMs = Math.max(0, now - created);
      if (booking.guideId) {
        updateGuideResponseTime(booking.guideId, responseTimeMs).catch(() => {});
      }
    } catch {}

    res.json({ 
      success: true, 
      data: booking,
      message: 'Booking declined successfully'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
