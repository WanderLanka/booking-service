const express = require('express');
const TourPackageBooking = require('../../models/TourPackageBooking');
const { updateGuideResponseTime } = require('../../services/guideServiceClient');

const router = express.Router();

/**
 * Approve a tour package booking
 * Before approving, checks if the guide already has an approved/confirmed booking on the same dates
 * POST /tourpackage_booking/approve/:id
 */
router.post('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Find the booking to approve
    const booking = await TourPackageBooking.findById(id);
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        error: 'Booking not found' 
      });
    }

    // Only pending bookings can be approved
    if (booking.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        error: 'Only pending bookings can be approved',
        currentStatus: booking.status
      });
    }

    // Check if guide has availability on the requested dates
    // Query for any approved or confirmed bookings by the same guide with overlapping dates
    const conflictingBooking = await TourPackageBooking.findOne({
      _id: { $ne: booking._id }, // Exclude current booking
      guideId: booking.guideId,
      status: { $in: ['approved', 'confirmed'] },
      // Date overlap check: existing booking overlaps if:
      // - existing.startDate <= new.endDate AND existing.endDate >= new.startDate
      $or: [
        {
          startDate: { $lte: booking.endDate },
          endDate: { $gte: booking.startDate }
        }
      ]
    });

    if (conflictingBooking) {
      return res.status(409).json({
        success: false,
        error: 'Guide is not available on the selected dates',
        message: 'You already have an approved or confirmed booking that overlaps with this date range',
        conflict: {
          bookingId: conflictingBooking._id,
          packageTitle: conflictingBooking.packageTitle,
          startDate: conflictingBooking.startDate,
          endDate: conflictingBooking.endDate,
          status: conflictingBooking.status
        }
      });
    }

    // Use atomic update with optimistic locking to prevent race conditions
    // Only update if status is still 'pending' (prevents double-approval)
    const updatedBooking = await TourPackageBooking.findOneAndUpdate(
      { 
        _id: booking._id, 
        status: 'pending' // Ensure status hasn't changed since we checked
      },
      { 
        $set: { status: 'approved' }
      },
      { 
        new: true, // Return updated document
        runValidators: true 
      }
    );

    // If no document was updated, it means status changed between our check and update
    if (!updatedBooking) {
      return res.status(400).json({
        success: false,
        error: 'Booking status has changed. Please refresh and try again.'
      });
    }

    // Fire-and-forget metric update: approximate response time from request to approval
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
      data: updatedBooking,
      message: 'Booking approved successfully. Client can now proceed with payment.'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
