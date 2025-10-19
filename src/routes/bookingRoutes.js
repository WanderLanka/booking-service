const express = require('express');
const { body, validationResult } = require('express-validator');
const BookingService = require('../services/BookingService');
const logger = require('../utils/logger');

const router = express.Router();

// Validation middleware for booking requests
const validateBookingRequest = [
  body('serviceType').isIn(['accommodation', 'transportation', 'guide']).withMessage('Invalid service type'),
  body('serviceId').notEmpty().withMessage('Service ID is required'),
  body('serviceName').notEmpty().withMessage('Service name is required'),
  body('totalAmount').isNumeric().withMessage('Total amount must be a number'),
  body('bookingDetails').isObject().withMessage('Booking details must be an object'),
  body('paymentDetails').isObject().withMessage('Payment details must be an object'),
  body('contactInfo').isObject().withMessage('Contact info must be an object'),
  
  // Validate contact info
  body('contactInfo.email').isEmail().withMessage('Valid email is required'),
  body('contactInfo.phone').notEmpty().withMessage('Phone number is required'),
  
  // Validate payment details
  body('paymentDetails.cardNumber').notEmpty().withMessage('Card number is required'),
  body('paymentDetails.expiryDate').notEmpty().withMessage('Expiry date is required'),
  body('paymentDetails.cvv').notEmpty().withMessage('CVV is required'),
  body('paymentDetails.cardholderName').notEmpty().withMessage('Cardholder name is required'),
  
  // Service-specific validations
  body('bookingDetails.currency').optional().isIn(['LKR', 'USD', 'EUR']).withMessage('Invalid currency'),
  
  // Accommodation specific validations
  body('bookingDetails.checkInDate').if(body('serviceType').equals('accommodation')).notEmpty().withMessage('Check-in date is required for accommodation'),
  body('bookingDetails.checkOutDate').if(body('serviceType').equals('accommodation')).notEmpty().withMessage('Check-out date is required for accommodation'),
  body('bookingDetails.rooms').if(body('serviceType').equals('accommodation')).isInt({min: 1}).withMessage('At least one room is required for accommodation'),
  body('bookingDetails.adults').if(body('serviceType').equals('accommodation')).isInt({min: 1}).withMessage('At least one adult is required for accommodation'),
  body('bookingDetails.children').if(body('serviceType').equals('accommodation')).optional().isInt({min: 0}).withMessage('Children count must be non-negative'),
  
  // Transportation specific validations
  body('bookingDetails.startDate').if(body('serviceType').equals('transportation')).notEmpty().withMessage('Start date is required for transportation'),
  body('bookingDetails.pickupLocation').if(body('serviceType').equals('transportation')).notEmpty().withMessage('Pickup location is required for transportation'),
  body('bookingDetails.dropoffLocation').if(body('serviceType').equals('transportation')).notEmpty().withMessage('Dropoff location is required for transportation'),
  body('bookingDetails.passengers').if(body('serviceType').equals('transportation')).isInt({min: 1}).withMessage('At least one passenger is required for transportation'),
  body('bookingDetails.days').if(body('serviceType').equals('transportation')).optional().isInt({min: 1}).withMessage('Days must be at least 1'),
  
  // Guide specific validations
  body('bookingDetails.tourDate').if(body('serviceType').equals('guide')).notEmpty().withMessage('Tour date is required for guide booking'),
  body('bookingDetails.duration').if(body('serviceType').equals('guide')).isInt({min: 1}).withMessage('Duration is required for guide booking'),
  body('bookingDetails.groupSize').if(body('serviceType').equals('guide')).isInt({min: 1}).withMessage('Group size is required for guide booking'),
  body('bookingDetails.specialRequests').if(body('serviceType').equals('guide')).optional().isString().withMessage('Special requests must be a string'),
];

// POST /addBooking - Create new booking (alternative endpoint)
router.post('/addBooking', validateBookingRequest, async (req, res) => {
  console.log('🎯 POST /addBooking endpoint reached in booking service');
  console.log('Request details:', {
    method: req.method,
    url: req.url,
    user: req.user ? req.user.userId : 'No user attached',
    body: {
      serviceType: req.body.serviceType,
      serviceId: req.body.serviceId,
      serviceName: req.body.serviceName
    }
  });
  
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    logger.info('📝 Creating new booking', { 
      serviceType: req.body.serviceType, 
      serviceId: req.body.serviceId,
      userId: req.user?.id 
    });

    // Create booking using BookingService
    const result = await BookingService.createBooking({
      ...req.body,
      userId: req.user.id
    });

    logger.info('✅ Booking created successfully', { 
      bookingId: result.bookingId,
      confirmationNumber: result.confirmationNumber 
    });

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: result
    });

  } catch (error) {
    logger.error('❌ Booking creation failed:', error);
    
    if (error.message.includes('not available') || error.message.includes('availability')) {
      return res.status(409).json({
        success: false,
        message: 'Service is not available for the requested dates',
        error: error.message
      });
    }
    
    if (error.message.includes('payment') || error.message.includes('Payment')) {
      return res.status(402).json({
        success: false,
        message: 'Payment processing failed',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /api/bookings - Create new booking (original endpoint)
router.post('/', validateBookingRequest, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Extract user information from authenticated request
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    logger.info(`Processing booking request for user ${userId}`, {
      serviceType: req.body.serviceType,
      serviceId: req.body.serviceId,
      totalAmount: req.body.totalAmount
    });

    // Create booking through BookingService (orchestrator)
    const bookingResult = await BookingService.createBooking({
      ...req.body,
      userId
    });

    if (bookingResult.success) {
      logger.info(`Booking created successfully`, {
        bookingId: bookingResult.data.bookingId,
        userId,
        serviceType: req.body.serviceType
      });

      res.status(201).json(bookingResult);
    } else {
      logger.error(`Booking creation failed`, {
        userId,
        serviceType: req.body.serviceType,
        error: bookingResult.message
      });

      res.status(400).json(bookingResult);
    }

  } catch (error) {
    logger.error('Booking creation error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error during booking creation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// GET /api/bookings/:bookingId - Get booking details
router.get('/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const booking = await BookingService.getBookingById(bookingId, userId);

    if (booking.success) {
      res.json(booking);
    } else {
      res.status(404).json(booking);
    }

  } catch (error) {
    logger.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// GET /api/bookings - Get user's bookings
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { status, serviceType, page = 1, limit = 10 } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const bookings = await BookingService.getUserBookings(userId, {
      status,
      serviceType,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json(bookings);

  } catch (error) {
    logger.error('Get user bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// PUT /api/bookings/:bookingId/cancel - Cancel booking
router.put('/:bookingId/cancel', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user?.id || req.user?.userId;
    const { reason } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const result = await BookingService.cancelBooking(bookingId, userId, reason);

    if (result.success) {
      logger.info(`Booking cancelled`, { bookingId, userId, reason });
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    logger.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

module.exports = router;