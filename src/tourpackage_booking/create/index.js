const express = require('express');
const mongoose = require('mongoose');
const TourPackageBooking = require('../../models/TourPackageBooking');
const { createBookingSchema } = require('../../validators/tourPackageBookingValidators');
const { createPaymentIntent, capturePayment } = require('../../services/mockPaymentGateway');
const { incrementTourPackageBookingCount } = require('../../services/guideServiceClient');

const router = express.Router();

// POST /tourpackage_booking/create
router.post('/', async (req, res, next) => {
  try {
    const { value, error } = createBookingSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ success: false, error: error.details.map((d) => d.message).join(', ') });
    }

    const {
      userId,
      tourPackageId,
      packageTitle,
      packageSlug,
      guideId,
      startDate,
      endDate,
      peopleCount,
      pricing,
      notes,
      paymentMethod,
    } = value;

    // Create booking without transactions (works on standalone MongoDB)
    let bookingDoc = await TourPackageBooking.create({
      userId,
      tourPackageId,
      packageTitle,
      packageSlug,
      guideId,
      startDate,
      endDate,
      peopleCount,
      pricing,
      status: 'pending',
      payment: {
        provider: 'mockpay',
        status: 'pending',
        currency: pricing.currency,
        amount: pricing.totalAmount,
        method: paymentMethod === 'card' ? 'card' : 'mock',
      },
      notes,
    });

    // Create mock payment intent and capture immediately (for sandbox flow)
    const intent = await createPaymentIntent({
      amount: pricing.totalAmount,
      currency: pricing.currency,
      metadata: { bookingId: String(bookingDoc._id), type: 'tourpackage' },
    });

    const capture = await capturePayment(intent.id);

    const paymentStatus = capture.status === 'captured' ? 'captured' : 'failed';
    const bookingStatus = paymentStatus === 'captured' ? 'confirmed' : 'pending';

    await TourPackageBooking.findByIdAndUpdate(
      bookingDoc._id,
      {
        $set: {
          status: bookingStatus,
          payment: {
            provider: 'mockpay',
            intentId: intent.id,
            status: paymentStatus,
            currency: pricing.currency,
            amount: pricing.totalAmount,
            method: paymentMethod === 'card' ? 'card' : 'mock',
            metadata: intent.metadata,
          },
        },
      },
      { new: true }
    );

    // If confirmed, notify guide-service to increment booking count
    if (bookingStatus === 'confirmed') {
      try {
        await incrementTourPackageBookingCount(tourPackageId, 1);
      } catch (e) {
        // Non-blocking: log and continue
      }
    }

    const refreshed = await TourPackageBooking.findById(bookingDoc._id).lean();

    res.status(201).json({ success: true, data: refreshed });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
