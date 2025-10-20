const express = require('express');
const dayjs = require('dayjs');
const Booking = require('../models/Booking');
const adapters = require('../adapters');

const router = express.Router();

// GET dynamic availability for an accommodation by date range
// GET /availability/accommodation/:id?checkInDate=YYYY-MM-DD&checkOutDate=YYYY-MM-DD
router.get('/accommodation/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { checkInDate, checkOutDate } = req.query;
    if (!checkInDate || !checkOutDate) {
      return res.status(400).json({ success: false, message: 'checkInDate and checkOutDate are required' });
    }
    const start = dayjs(checkInDate).toDate();
    const end = dayjs(checkOutDate).toDate();
    if (!(start instanceof Date) || !(end instanceof Date) || isNaN(start) || isNaN(end) || end <= start) {
      return res.status(400).json({ success: false, message: 'Invalid date range' });
    }

    // Fetch accommodation to get total rooms by room type
    const accommodation = await adapters.getAccommodationAdapter().fetchAccommodationPublic(id);
    const roomTypes = Array.isArray(accommodation?.roomTypes) ? accommodation.roomTypes : [];
    const totalByType = new Map(roomTypes.map(rt => [rt.type, Number(rt.totalRooms) || 0]));

    // Aggregate bookings that overlap the requested range
    const pipeline = [
      {
        $match: {
          serviceType: 'accommodation',
          serviceId: id,
          status: { $in: ['confirmed'] },
          'bookingDetails.checkInDate': { $lt: end },
          'bookingDetails.checkOutDate': { $gt: start }
        }
      },
      { $unwind: '$bookingDetails.roomBreakdown' },
      {
        $group: {
          _id: '$bookingDetails.roomBreakdown.roomType',
          totalBooked: { $sum: { $ifNull: ['$bookingDetails.roomBreakdown.quantity', 0] } }
        }
      }
    ];

    const booked = await Booking.aggregate(pipeline);
    const bookedByType = new Map(booked.map(b => [b._id, b.totalBooked]));

    const availability = roomTypes.map(rt => {
      const total = Number(rt.totalRooms) || 0;
      const used = Number(bookedByType.get(rt.type) || 0);
      const available = Math.max(0, total - used);
      return { type: rt.type, totalRooms: total, availableRooms: available, pricePerNight: rt.pricePerNight };
    });

    return res.json({ success: true, data: { accommodationId: id, checkInDate, checkOutDate, availability } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Availability error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to compute availability' });
  }
});

module.exports = router;


