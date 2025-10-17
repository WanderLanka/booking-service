const TourPackageBooking = require('../../models/TourPackageBooking');
const { createBookingSchema } = require('../../validators/tourPackageValidators');
const validate = require('../../middleware/validate');
const { calculateTourPackagePrice } = require('../../utils/pricing');
const MockPaymentGateway = require('../../utils/mockPaymentGateway');
const { 
  fetchPackageDetails, 
  checkGuideAvailability,
  updatePackageBookingCount,
  syncBookingWithGuide 
} = require('../../utils/bookingSync');
const logger = require('../../utils/logger');

// Express-style middleware chain: validate -> handler
const validateCreate = validate(createBookingSchema);

const handler = async (req, res) => {
  try {
    const { 
      userId, 
      username,
      packageId, 
      startDate, 
      endDate, 
      numberOfTravelers = 1,
      notes,
      specialRequests,
      contactPhone,
      contactEmail,
      paymentMethod = 'mock'
    } = req.body;

    logger.info(`Creating booking for user ${userId}, package ${packageId}`);

    // Step 1: Fetch package details from guide-service
    let packageDetails;
    try {
      packageDetails = await fetchPackageDetails(packageId);
    } catch (error) {
      logger.error('Failed to fetch package details:', error);
      return res.status(404).json({ 
        success: false, 
        message: 'Tour package not found or service unavailable' 
      });
    }

    // Step 2: Validate package is active
    if (!packageDetails.isActive) {
      return res.status(400).json({ 
        success: false, 
        message: 'This tour package is not currently available for booking' 
      });
    }

    // Step 3: Validate max group size
    if (packageDetails.maxGroupSize && numberOfTravelers > packageDetails.maxGroupSize) {
      return res.status(400).json({ 
        success: false, 
        message: `Maximum group size is ${packageDetails.maxGroupSize} travelers` 
      });
    }

    // Step 4: Check guide availability
    const availability = await checkGuideAvailability(
      packageDetails.guideId,
      startDate,
      endDate
    );

    if (!availability.available) {
      return res.status(409).json({ 
        success: false, 
        message: 'Guide is not available for the selected dates',
        conflict: availability.conflict
      });
    }

    // Step 5: Calculate pricing
    const baseDailyRate = packageDetails.pricing?.amount || 100;
    const { days, total: baseTotal } = calculateTourPackagePrice({ 
      startDate, 
      endDate, 
      baseDailyRate 
    });

    // Apply per-person pricing if configured
    const isPerPerson = packageDetails.pricing?.perPerson || false;
    const totalPrice = isPerPerson ? baseTotal * numberOfTravelers : baseTotal;
    const currency = packageDetails.pricing?.currency || 'USD';

    logger.info(`Calculated price: ${totalPrice} ${currency} for ${days} days, ${numberOfTravelers} travelers`);

    // Step 6: Process payment through mock gateway
    const paymentResult = await MockPaymentGateway.processPayment({
      amount: totalPrice,
      currency,
      userId,
      bookingId: null, // Will update after booking creation
      method: paymentMethod,
      customerInfo: {
        username,
        email: contactEmail,
        phone: contactPhone,
      },
    });

    logger.info(`Payment processing result: ${paymentResult.status}`);

    // Step 7: Determine booking status based on payment
    let bookingStatus = 'pending';
    if (paymentResult.success && paymentResult.status === 'completed') {
      bookingStatus = 'confirmed';
    } else if (!paymentResult.success) {
      return res.status(402).json({
        success: false,
        message: paymentResult.message || 'Payment failed',
        error: paymentResult.error,
        paymentDetails: {
          status: paymentResult.status,
          errorCode: paymentResult.errorCode,
        },
      });
    }

    // Step 8: Create booking
    const booking = await TourPackageBooking.create({
      userId,
      username,
      packageId,
      packageSlug: packageDetails.slug,
      packageTitle: packageDetails.title,
      guideId: packageDetails.guideId,
      guideUsername: packageDetails.guideUsername || 'guide',
      startDate,
      endDate,
      numberOfTravelers,
      basePrice: baseTotal,
      totalPrice,
      currency,
      payment: {
        method: paymentMethod,
        status: paymentResult.status,
        transactionId: paymentResult.transactionId,
        paidAt: paymentResult.paidAt,
      },
      status: bookingStatus,
      notes,
      specialRequests,
      contactPhone,
      contactEmail,
      createdBy: req.user?.id || userId,
      updatedBy: req.user?.id || userId,
    });

    logger.info(`Booking created: ${booking._id}`);

    // Step 9: Update package booking count (async, don't wait)
    updatePackageBookingCount(packageId, 1)
      .catch(err => logger.error('Failed to update booking count:', err));

    // Step 10: Sync with guide service (async, don't wait)
    syncBookingWithGuide(booking, 'create')
      .catch(err => logger.error('Failed to sync booking with guide:', err));

    return res.status(201).json({ 
      success: true, 
      data: booking,
      payment: {
        status: paymentResult.status,
        transactionId: paymentResult.transactionId,
        message: paymentResult.message,
      },
    });
  } catch (err) {
    logger.error('Create tour package booking error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to create booking',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

module.exports = [validateCreate, handler];
