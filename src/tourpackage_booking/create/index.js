const express = require('express');
const mongoose = require('mongoose');
const TourPackageBooking = require('../../models/TourPackageBooking');
const { createBookingSchema } = require('../../validators/tourPackageBookingValidators');
// Payment will be initiated after approval; no auto-capture here
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

    // Respond with pending booking (approval and payment later)
    const refreshed = await TourPackageBooking.findById(bookingDoc._id).lean();
    res.status(201).json({ success: true, data: refreshed });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
