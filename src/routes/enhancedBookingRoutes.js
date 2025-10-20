const express = require('express');
const { body, validationResult } = require('express-validator');
const EnhancedBookingService = require('../services/EnhancedBookingService');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');
const Booking = require('../models/Booking');

const router = express.Router();
const enhancedBookingService = new EnhancedBookingService();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Validation middleware for enhanced booking requests
const validateEnhancedBookingRequest = [
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
  
  // Accommodation specific validations
  body('bookingDetails.checkInDate').if(body('serviceType').equals('accommodation')).notEmpty().withMessage('Check-in date is required for accommodation'),
  body('bookingDetails.checkOutDate').if(body('serviceType').equals('accommodation')).notEmpty().withMessage('Check-out date is required for accommodation'),
  body('bookingDetails.rooms').if(body('serviceType').equals('accommodation')).isInt({min: 1}).withMessage('At least one room is required for accommodation'),
  body('bookingDetails.adults').if(body('serviceType').equals('accommodation')).isInt({min: 1}).withMessage('At least one adult is required for accommodation'),
];

/**
 * POST /s/enhanced - Create complete booking with reservation and payment
 * This endpoint handles the full booking flow (forwarded from API Gateway):
 * API Gateway: /api/bookings/enhanced -> strips /api/booking -> forwards /s/enhanced
 * 1. Creates pending booking
 * 2. Checks availability and creates temporary reservation
 * 3. Processes payment
 * 4. Confirms reservation
 * 5. Finalizes booking
 */
router.post('/enhanced', async (req, res, next) => {
  console.log('🎯 POST /enhanced endpoint reached - Enhanced booking flow');
  console.log('Enhanced booking request details:', {
    method: req.method,
    url: req.url,
    user: req.user ? req.user.userId : 'No user attached',
    bodyKeys: Object.keys(req.body || {})
  });

  try {
    // Transform simplified accommodation payload (from AccommodationDetails.jsx) to enhanced shape
    if (!req.body.serviceType && req.body.accommodationId && req.body.checkInDate && req.body.checkOutDate) {
      const { accommodationId, checkInDate, checkOutDate, selectedRooms = [], guestDetails = {} } = req.body;
      const nights = Math.max(1, Math.ceil((new Date(checkOutDate) - new Date(checkInDate)) / (1000*60*60*24)));
      const roomsCount = selectedRooms.reduce((t, r) => t + (parseInt(r.quantity) || 0), 0);
      const subtotal = selectedRooms.reduce((t, r) => t + (Number(r.pricePerNight) * (parseInt(r.quantity)||0) * nights), 0);
      const serviceFee = 25;
      const totalAmount = subtotal + serviceFee;

      req.body = {
        serviceType: 'accommodation',
        serviceId: accommodationId,
        serviceName: 'Accommodation',
        totalAmount,
        bookingDetails: {
          currency: 'LKR',
          checkInDate,
          checkOutDate,
          rooms: roomsCount,
          adults: Math.max(1, roomsCount * 2),
          children: 0,
          nights,
          roomBreakdown: selectedRooms
        },
        // Minimal payment details (not used when payment is skipped)
        paymentDetails: {
          cardNumber: '4111111111111111',
          expiryDate: '12/30',
          cvv: '123',
          cardholderName: `${guestDetails.firstName || 'Guest'} ${guestDetails.lastName || ''}`.trim()
        },
        contactInfo: {
          email: guestDetails.email || 'guest@example.com',
          phone: guestDetails.phone || 'N/A',
          emergencyContact: '',
          firstName: guestDetails.firstName || 'Guest',
          lastName: guestDetails.lastName || ''
        }
      };
      console.log('🔄 Transformed simplified payload to enhanced shape');
    }

    // Now run validation on the (possibly transformed) body
    await Promise.all(validateEnhancedBookingRequest.map(v => v.run(req)));
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Enhanced booking validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    logger.info('📝 Creating enhanced booking', {
      serviceType: req.body.serviceType,
      serviceId: req.body.serviceId,
      userId: req.user?.userId,
      totalAmount: req.body.totalAmount
    });

    // Add user ID to booking data
    const bookingData = {
      ...req.body,
      userId: req.user?.userId
    };

    // Debug logging
    console.log('🔍 Enhanced booking request data:', {
      hasUserId: !!bookingData.userId,
      userId: bookingData.userId,
      serviceType: bookingData.serviceType,
      userFromAuth: req.user
    });

    // Process complete booking
    const result = await enhancedBookingService.createCompleteBooking(bookingData);

    logger.info('✅ Enhanced booking created successfully', {
      bookingId: result.data.bookingId,
      confirmationNumber: result.data.confirmationNumber
    });

    res.status(201).json(result);

  } catch (error) {
    console.error('❌ Enhanced booking creation failed:', {
      message: error.message,
      stack: error.stack,
      userId: req.user?.userId,
      serviceType: req.body?.serviceType
    });
    
    logger.error('❌ Enhanced booking creation failed:', error);

    // Handle specific error types
    if (error.message.includes('not available')) {
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

    if (error.message.includes('service is currently unavailable')) {
      return res.status(503).json({
        success: false,
        message: 'One or more required services are currently unavailable',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create enhanced booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/bookings/enhanced/:bookingId - Get enhanced booking details
 */
router.get('/enhanced/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    logger.info('📋 Getting enhanced booking details', { bookingId });

    const result = await enhancedBookingService.getBookingDetails(bookingId);

    res.json(result);

  } catch (error) {
    logger.error('❌ Failed to get enhanced booking details:', error);

    if (error.message === 'Booking not found') {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to get booking details',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/bookings/enhanced/:bookingId/cancel - Cancel enhanced booking
 */
router.post('/enhanced/:bookingId/cancel', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;

    logger.info('❌ Cancelling enhanced booking', { bookingId, reason });

    const result = await enhancedBookingService.cancelBooking(
      bookingId, 
      reason || 'User cancellation'
    );

    res.json(result);

  } catch (error) {
    logger.error('❌ Enhanced booking cancellation failed:', error);

    if (error.message === 'Booking not found') {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
        error: error.message
      });
    }

    if (error.message === 'Booking is already cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled',
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Provider bookings listing
router.get('/provider/bookings', async (req, res) => {
  try {
    console.log('🔍 Provider bookings request:', {
      query: req.query,
      user: req.user,
      headers: req.headers
    });

    const { serviceType } = req.query;
    const providerId = req.user?.username || req.user?.userId;
    
    console.log('🔍 Provider ID extraction:', {
      username: req.user?.username,
      userId: req.user?.userId,
      extractedProviderId: providerId
    });

    if (!providerId) {
      console.log('❌ No provider ID found');
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // First, let's see all bookings to understand the data structure
    const allBookings = await Booking.find({}).sort({ createdAt: -1 }).limit(5);
    console.log('🔍 Sample bookings in database:', {
      count: allBookings.length,
      bookings: allBookings.map(b => ({
        id: b._id,
        serviceType: b.serviceType,
        serviceProvider: b.serviceProvider,
        status: b.status,
        userId: b.userId
      }))
    });

    // Filter bookings by service type and provider
    let filter = {};
    if (serviceType) {
      filter.serviceType = serviceType;
    } else {
      filter.serviceType = 'accommodation'; // Default to accommodation
    }

    // For transport bookings, filter by serviceProvider matching the logged-in user
    if (serviceType === 'transportation') {
      filter.serviceProvider = providerId;
      console.log('🔍 Transport bookings filter:', filter);
    } else if (serviceType === 'accommodation') {
      filter.serviceProvider = providerId;
      console.log('🔍 Accommodation bookings filter:', filter);
    }

    console.log('🔍 Final database filter:', filter);

    const bookings = await Booking.find(filter).sort({ createdAt: -1 });
    
    console.log('🔍 Found bookings:', {
      count: bookings.length,
      bookings: bookings.map(b => ({
        id: b._id,
        serviceType: b.serviceType,
        serviceProvider: b.serviceProvider,
        status: b.status
      }))
    });

    return res.json({ success: true, data: bookings, count: bookings.length });
  } catch (err) {
    console.error('❌ Provider bookings error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch provider bookings' });
  }
});

module.exports = router;