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

    // STEP 1: Check guide availability on the selected start date
    if (guideId) {
      const conflictingBooking = await TourPackageBooking.findOne({
        guideId: guideId,
        status: 'confirmed',
        $or: [
          {
            startDate: { $lte: new Date(endDate) },
            endDate: { $gte: new Date(startDate) }
          }
        ]
      });

      if (conflictingBooking) {
        return res.status(409).json({
          success: false,
          error: 'Guide is not available on the selected dates',
          message: 'The tour guide already has a confirmed booking during your selected dates. Please choose another available date.',
          conflictingDates: {
            start: conflictingBooking.startDate,
            end: conflictingBooking.endDate
          }
        });
      }
    }

    // STEP 2: Validate pricing calculation
    // Pricing validation should have been done on frontend, but double-check here
    // The frontend should send the correct totalAmount based on priceType
    // unitAmount is the base price, totalAmount = unitAmount * peopleCount (if perPerson)
    const expectedTotal = pricing.perPerson 
      ? pricing.unitAmount * peopleCount 
      : pricing.unitAmount;
    
    if (Math.abs(pricing.totalAmount - expectedTotal) > 0.01) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pricing calculation',
        message: `Expected total amount ${expectedTotal}, but received ${pricing.totalAmount}`
      });
    }

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
      // Store cancellation policy from package (if provided)
      cancellationPolicy: value.cancellationPolicy || {},
    });

    // Respond with pending booking (approval and payment later)
    const refreshed = await TourPackageBooking.findById(bookingDoc._id).lean();
    res.status(201).json({ success: true, data: refreshed });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
