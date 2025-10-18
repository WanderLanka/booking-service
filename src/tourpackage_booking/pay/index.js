const express = require('express');
const TourPackageBooking = require('../../models/TourPackageBooking');
const { createPaymentIntent, capturePayment } = require('../../services/mockPaymentGateway');
const { incrementTourPackageBookingCount } = require('../../services/guideServiceClient');

const router = express.Router();

// POST /tourpackage_booking/pay/:id
// In mock flow: create and capture payment, set booking to confirmed
router.post('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const booking = await TourPackageBooking.findById(id);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    if (booking.status !== 'approved' && booking.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Booking must be pending or approved to pay' });
    }

    const amount = booking.pricing?.totalAmount || 0;
    const currency = booking.pricing?.currency || 'USD';

    const intent = await createPaymentIntent({
      amount,
      currency,
      metadata: { bookingId: String(booking._id), type: 'tourpackage' },
    });

    const capture = await capturePayment(intent.id);
    const paymentStatus = capture.status === 'captured' ? 'captured' : 'failed';
    const bookingStatus = paymentStatus === 'captured' ? 'confirmed' : booking.status;

    booking.status = bookingStatus;
    booking.payment = {
      provider: 'mockpay',
      intentId: intent.id,
      status: paymentStatus,
      currency,
      amount,
      method: booking.payment?.method || 'mock',
      metadata: intent.metadata,
    };
    await booking.save();

    if (bookingStatus === 'confirmed') {
      try {
        await incrementTourPackageBookingCount(booking.tourPackageId, 1);
      } catch (e) {
        // non-blocking
      }
    }

    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
