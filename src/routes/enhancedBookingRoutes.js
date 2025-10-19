const express = require('express');
const { body, validationResult } = require('express-validator');
const EnhancedBookingService = require('../services/EnhancedBookingService');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

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
router.post('/enhanced', validateEnhancedBookingRequest, async (req, res) => {
  console.log('🎯 POST /enhanced endpoint reached - Enhanced booking flow');
  console.log('Enhanced booking request details:', {
    method: req.method,
    url: req.url,
    user: req.user ? req.user.userId : 'No user attached',
    body: {
      serviceType: req.body.serviceType,
      serviceId: req.body.serviceId,
      serviceName: req.body.serviceName,
      totalAmount: req.body.totalAmount
    }
  });

  try {
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

/**
 * GET /test - Simple test endpoint to verify service is working
 */
router.get('/test', (req, res) => {
  console.log('🎯 GET /test endpoint reached');
  res.json({
    success: true,
    message: 'Enhanced booking service is working',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /userBookings - Get all bookings for the authenticated user
 */
router.get('/userBookings', async (req, res) => {
  try {
    console.log('🎯 GET /userBookings endpoint reached');
    console.log('Request details:', {
      method: req.method,
      url: req.url,
      user: req.user ? {
        userId: req.user.userId,
        email: req.user.email,
        role: req.user.role
      } : 'No user attached',
      headers: {
        authorization: req.headers.authorization ? 'Present' : 'Missing'
      }
    });

    // Extract user information from JWT token
    const userId = req.user?.userId;
    const userEmail = req.user?.email;
    const userRole = req.user?.role;
    
    logger.info('📋 Getting user bookings for authenticated user', { 
      userId, 
      userEmail, 
      userRole,
      timestamp: new Date().toISOString()
    });

    // Validate that user information exists in token
    if (!userId && !userEmail) {
      console.log('❌ No user information found in JWT token');
      logger.warn('❌ Unauthorized access attempt - no user info in token');
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'No user information found in token'
      });
    }

    // Additional security: Ensure user is authenticated
    if (!req.user) {
      console.log('❌ No user object attached to request');
      logger.warn('❌ Unauthorized access attempt - no user object');
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'User not authenticated'
      });
    }

    console.log('✅ Authenticated user found, fetching bookings for:', { userId, userEmail });
    
    // Get bookings ONLY for the authenticated user
    const result = await enhancedBookingService.getUserBookings(userId, userEmail);

    console.log('✅ getUserBookings service completed successfully for user:', { userId, userEmail });
    logger.info('✅ User bookings retrieved successfully', { 
      userId, 
      userEmail, 
      bookingCount: result.data?.length || 0 
    });
    
    res.json(result);

  } catch (error) {
    console.error('❌ Failed to get user bookings:', error);
    logger.error('❌ Failed to get user bookings:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
      userEmail: req.user?.email
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get user bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;