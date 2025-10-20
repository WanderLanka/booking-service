const cron = require('node-cron');
const dayjs = require('dayjs');
const Booking = require('../models/Booking');
const AdapterRegistry = require('../adapters');

function isSameDay(d1, d2) {
  return dayjs(d1).format('YYYY-MM-DD') === dayjs(d2).format('YYYY-MM-DD');
}

function startDailyJobs() {
  // Run at 01:10 every day
  cron.schedule('10 1 * * *', async () => {
    try {
      const today = new Date();
      // Handle accommodation endings
      const accBookings = await Booking.find({ serviceType: 'accommodation', status: 'confirmed' });
      const accAdapter = AdapterRegistry.getAccommodationAdapter();
      for (const b of accBookings) {
        const out = b.bookingDetails?.checkOutDate;
        if (!out) continue;
        if (isSameDay(out, today)) {
          // Mark ended
          b.status = 'ended';
          await b.save();
          // Restore availability back on checkout day (previous behavior)
          const breakdown = b.bookingDetails?.roomBreakdown || [];
          if (Array.isArray(breakdown) && breakdown.length) {
            const adjustments = breakdown
              .filter(x => x && x.roomType && x.quantity)
              .map(x => ({ type: x.roomType, quantity: x.quantity }));
            if (adjustments.length) {
              await accAdapter.adjustAvailability(b.serviceId, adjustments, 'increase');
            }
          }
        }
      }

      // Handle transportation endings: startDate + days
      const trBookings = await Booking.find({ serviceType: 'transportation', status: 'confirmed' });
      const trAdapter = AdapterRegistry.getTransportationAdapter();
      for (const b of trBookings) {
        const start = b.bookingDetails?.startDate;
        const days = b.bookingDetails?.days || 1;
        if (!start || !days) continue;
        const end = new Date(start);
        end.setDate(end.getDate() + days);
        if (isSameDay(end, today)) {
          b.status = 'ended';
          await b.save();
          try { await trAdapter.setAvailability(b.serviceId, 'available'); } catch {}
        }
      }
    } catch (err) {
      // Log error; avoid throwing to keep scheduler alive
      // eslint-disable-next-line no-console
      console.error('Daily booking status job failed:', err.message);
    }
  });
}

module.exports = { startDailyJobs };


