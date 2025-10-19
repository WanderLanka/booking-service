const Booking = require('../models/Booking');
const AdapterRegistry = require('../adapters');
const logger = require('../utils/logger');

class EnhancedBookingService {
  constructor() {
    this.accommodationAdapter = AdapterRegistry.getAccommodationAdapter();
    this.paymentAdapter = AdapterRegistry.getPaymentAdapter();
  }

  /**
   * Create complete booking with accommodation reservation and payment
   * @param {Object} bookingData - Complete booking information
   * @returns {Promise<Object>} Booking confirmation response
   */
  async createCompleteBooking(bookingData) {
    // Generate unique booking ID using timestamp and random string
    const bookingId = `BKG_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    let tempReservationId = null;
    let paymentId = null;

    try {
      logger.info('🎯 Starting complete booking process', { 
        bookingId,
        serviceType: bookingData.serviceType,
        userId: bookingData.userId 
      });

      // Step 1: Create pending booking record
      const pendingBooking = await this.createPendingBooking(bookingId, bookingData);
      
      // Step 2: Create temporary reservation (without availability check)
      const reservation = await this.createTemporaryReservation(bookingData, bookingId);
      tempReservationId = reservation.reservationId;

      // Step 3: Update booking with reservation details
      await this.updateBookingWithReservation(bookingId, reservation);

      // Step 4: Skip payment processing for now - directly finalize booking
      logger.info('⏭️  Skipping payment processing - directly finalizing booking');
      
      // Create mock payment data for booking finalization
      const mockPayment = {
        paymentId: `MOCK_PAY_${Date.now()}`,
        transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        status: 'completed',
        amount: bookingData.totalAmount,
        currency: bookingData.bookingDetails?.currency || 'LKR',
        paymentMethod: 'mock_success',
        processedAt: new Date()
      };

      // Step 5: Update booking to confirmed status (skip payment processing)
      const confirmedBooking = await this.finalizeBookingWithoutPayment(
        bookingId, 
        mockPayment, 
        tempReservationId,
        bookingData
      );

      // Step 6: Return success response
      return {
        success: true,
        message: 'Booking completed successfully (without payment processing)',
        data: {
          bookingId: confirmedBooking.bookingId,
          confirmationNumber: confirmedBooking.confirmationNumber,
          status: confirmedBooking.status,
          serviceDetails: {
            serviceType: confirmedBooking.serviceType,
            serviceName: confirmedBooking.serviceName,
            provider: confirmedBooking.serviceProvider
          },
          reservationDetails: {
            reservationId: confirmedBooking.reservationDetails.reservationId,
            tempReservationId: confirmedBooking.reservationDetails.tempReservationId,
            confirmedAt: confirmedBooking.reservationDetails.confirmedAt
          },
          paymentDetails: {
            transactionId: confirmedBooking.paymentDetails.transactionId,
            amount: confirmedBooking.totalAmount,
            currency: confirmedBooking.currency,
            status: confirmedBooking.paymentDetails.paymentStatus
          },
          customerInfo: {
            email: confirmedBooking.contactInfo.email,
            phone: confirmedBooking.contactInfo.phone
          },
          bookingTimeline: confirmedBooking.bookingTimeline
        }
      };

    } catch (error) {
      logger.error('❌ Complete booking process failed:', error.message);

      // Rollback operations
      await this.rollbackBooking(bookingId, tempReservationId, paymentId, error.message);

      throw error;
    }
  }

  /**
   * Create pending booking record in database
   */
  async createPendingBooking(bookingId, bookingData) {
    try {
      // Debug logging
      console.log('🔍 Creating pending booking with data:', {
        bookingId,
        userId: bookingData.userId,
        serviceType: bookingData.serviceType,
        hasBookingDetails: !!bookingData.bookingDetails,
        hasContactInfo: !!bookingData.contactInfo
      });

      // Validate required fields
      if (!bookingData.userId) {
        throw new Error('User ID is required but not provided');
      }

      // Generate confirmation number
      const confirmationNumber = Booking.generateConfirmationNumber();
      
      const booking = new Booking({
        bookingId,
        confirmationNumber,
        userId: bookingData.userId,
        serviceType: bookingData.serviceType,
        serviceId: bookingData.serviceId,
        serviceName: bookingData.serviceName,
        serviceProvider: bookingData.serviceProvider || 'Unknown Provider',
        status: 'pending',
        totalAmount: bookingData.totalAmount,
        currency: bookingData.bookingDetails?.currency || 'LKR',
        
        // Store all booking details based on service type
        bookingDetails: {
          currency: bookingData.bookingDetails?.currency || 'LKR',
          
          // Accommodation specific fields
          ...(bookingData.serviceType === 'accommodation' && {
            checkInDate: new Date(bookingData.bookingDetails.checkInDate),
            checkOutDate: new Date(bookingData.bookingDetails.checkOutDate),
            rooms: bookingData.bookingDetails.rooms,
            adults: bookingData.bookingDetails.adults,
            children: bookingData.bookingDetails.children || 0,
            nights: bookingData.bookingDetails.nights
          }),
          
          // Transportation specific fields
          ...(bookingData.serviceType === 'transportation' && {
            startDate: new Date(bookingData.bookingDetails.startDate),
            days: bookingData.bookingDetails.days,
            passengers: bookingData.bookingDetails.passengers,
            pickupLocation: bookingData.bookingDetails.pickupLocation,
            dropoffLocation: bookingData.bookingDetails.dropoffLocation,
            estimatedDistance: bookingData.bookingDetails.estimatedDistance,
            pricingPerKm: bookingData.bookingDetails.pricingPerKm,
            vehicleType: bookingData.bookingDetails.vehicleType,
            departureTime: bookingData.bookingDetails.departureTime
          }),
          
          // Guide service specific fields
          ...(bookingData.serviceType === 'guide' && {
            tourDate: new Date(bookingData.bookingDetails.tourDate),
            duration: bookingData.bookingDetails.duration,
            groupSize: bookingData.bookingDetails.groupSize,
            specialRequests: bookingData.bookingDetails.specialRequests,
            guideLanguages: bookingData.bookingDetails.guideLanguages
          })
        },
        
        // Payment details (secure - no sensitive card data stored)
        paymentDetails: {
          paymentStatus: 'pending',
          paymentMethod: 'card',
          cardholderName: bookingData.paymentDetails?.cardholderName,
          // Only store last 4 digits for reference
          cardLast4: bookingData.paymentDetails?.cardNumber?.slice(-4)
        },
        
        // Contact information
        contactInfo: {
          email: bookingData.contactInfo.email,
          phone: bookingData.contactInfo.phone,
          emergencyContact: bookingData.contactInfo.emergencyContact,
          firstName: bookingData.contactInfo.firstName,
          lastName: bookingData.contactInfo.lastName
        },
        
        // Initialize reservation details
        reservationDetails: {
          reservationStatus: 'pending'
        },
        
        // Initialize booking timeline
        bookingTimeline: [{
          step: 'booking_created',
          status: 'completed',
          message: 'Booking record created successfully',
          timestamp: new Date()
        }],
        
        // Metadata
        metadata: {
          platform: 'web',
          source: 'enhanced_booking_service'
        }
      });

      await booking.save();
      logger.info('✅ Pending booking created in database', { 
        bookingId, 
        confirmationNumber,
        serviceType: bookingData.serviceType 
      });
      
      return booking;
    } catch (error) {
      logger.error('❌ Failed to create pending booking:', error.message);
      throw new Error(`Failed to create booking record: ${error.message}`);
    }
  }

  /**
   * Create temporary reservation with accommodation service (without availability check)
   */
  async createTemporaryReservation(bookingData, bookingId) {
    try {
      // Create temporary reservation directly (without availability check)
      const reservation = await this.accommodationAdapter.createTemporaryReservation({
        accommodationId: bookingData.serviceId,
        checkInDate: bookingData.bookingDetails.checkInDate,
        checkOutDate: bookingData.bookingDetails.checkOutDate,
        rooms: bookingData.bookingDetails.rooms,
        adults: bookingData.bookingDetails.adults,
        children: bookingData.bookingDetails.children,
        bookingId
      });

      logger.info('✅ Temporary reservation created', { 
        reservationId: reservation.reservationId 
      });

      return reservation;
    } catch (error) {
      logger.error('❌ Temporary reservation failed:', error.message);
      throw error;
    }
  }

  /**
   * Update booking with reservation details
   */
  async updateBookingWithReservation(bookingId, reservation) {
    try {
      const booking = await Booking.findOne({ bookingId });
      if (!booking) {
        throw new Error('Booking not found');
      }

      // Update reservation details
      booking.reservationDetails.reservationId = reservation.reservationId;
      booking.reservationDetails.tempReservationId = reservation.tempReservationId;
      booking.reservationDetails.reservationStatus = 'confirmed';
      booking.reservationDetails.confirmedAt = new Date();
      booking.reservationDetails.expiresAt = reservation.expiresAt;

      // Add timeline step
      booking.addTimelineStep(
        'reservation_created',
        'completed',
        `Temporary reservation created: ${reservation.reservationId}`
      );

      await booking.save();
      logger.info('✅ Booking updated with reservation details', { 
        bookingId, 
        reservationId: reservation.reservationId 
      });
    } catch (error) {
      logger.error('❌ Failed to update booking with reservation:', error.message);
      throw new Error(`Failed to update booking record: ${error.message}`);
    }
  }

  /**
   * Process payment for the booking
   */
  async processBookingPayment(bookingData, bookingId) {
    try {
      // Parse card details from payment details
      const paymentDetails = bookingData.paymentDetails;
      const [expiryMonth, expiryYear] = (paymentDetails.expiryDate || '').split('/');

      const payment = await this.paymentAdapter.processPayment({
        amount: bookingData.totalAmount,
        currency: bookingData.bookingDetails.currency || 'LKR',
        paymentMethod: {
          type: 'card',
          card: {
            number: paymentDetails.cardNumber,
            expiryMonth: parseInt(expiryMonth),
            expiryYear: parseInt(expiryYear),
            cvv: paymentDetails.cvv,
            holderName: paymentDetails.cardholderName
          }
        },
        customerInfo: {
          email: bookingData.contactInfo.email,
          phone: bookingData.contactInfo.phone,
          name: paymentDetails.cardholderName
        },
        bookingReference: bookingId,
        description: `Payment for ${bookingData.serviceType} booking - ${bookingData.serviceName}`
      });

      logger.info('✅ Payment processed successfully', { 
        paymentId: payment.paymentId 
      });

      return payment;
    } catch (error) {
      logger.error('❌ Payment processing failed:', error.message);
      throw error;
    }
  }

  /**
   * Confirm reservation after successful payment
   */
  async confirmBookingReservation(reservationId, paymentId, bookingData) {
    try {
      const confirmation = await this.accommodationAdapter.confirmReservation(
        reservationId,
        paymentId,
        {
          name: bookingData.paymentDetails.cardholderName,
          email: bookingData.contactInfo.email,
          phone: bookingData.contactInfo.phone
        }
      );

      logger.info('✅ Reservation confirmed', { 
        confirmationNumber: confirmation.confirmationNumber 
      });

      return confirmation;
    } catch (error) {
      logger.error('❌ Reservation confirmation failed:', error.message);
      throw error;
    }
  }

  /**
   * Finalize booking without payment processing (for testing/mock)
   */
  async finalizeBookingWithoutPayment(bookingId, mockPayment, tempReservationId, bookingData) {
    try {
      const booking = await Booking.findOne({ bookingId });
      if (!booking) {
        throw new Error('Booking not found');
      }

      // Update booking status and mock payment details
      booking.status = 'confirmed';
      booking.paymentDetails.paymentStatus = 'completed';
      booking.paymentDetails.transactionId = mockPayment.transactionId;
      booking.paymentDetails.paymentDate = new Date();
      booking.paymentDetails.paymentMethod = 'mock_success';
      
      // Update reservation details
      booking.reservationDetails.reservationStatus = 'confirmed';
      booking.reservationDetails.confirmedAt = new Date();

      // Add timeline steps
      booking.addTimelineStep(
        'payment_skipped',
        'completed',
        'Payment processing skipped for testing - mock success'
      );
      
      booking.addTimelineStep(
        'booking_confirmed',
        'completed',
        `Booking confirmed with number: ${booking.confirmationNumber}`
      );

      await booking.save();

      logger.info('✅ Booking finalized successfully (without payment)', { 
        bookingId,
        confirmationNumber: booking.confirmationNumber,
        mockTransactionId: mockPayment.transactionId
      });

      return booking;
    } catch (error) {
      logger.error('❌ Failed to finalize booking without payment:', error.message);
      throw new Error(`Failed to finalize booking record: ${error.message}`);
    }
  }

  /**
   * Finalize booking with all confirmation details
   */
  async finalizeBooking(bookingId, payment, confirmation, bookingData) {
    try {
      const booking = await Booking.findOne({ bookingId });
      if (!booking) {
        throw new Error('Booking not found');
      }

      // Update booking status and payment details
      booking.status = 'confirmed';
      booking.paymentDetails.paymentStatus = 'completed';
      booking.paymentDetails.transactionId = payment.transactionId;
      booking.paymentDetails.paymentDate = new Date();
      
      // Update reservation details
      booking.reservationDetails.reservationStatus = 'confirmed';
      booking.reservationDetails.confirmedAt = new Date();

      // Add final timeline steps
      booking.addTimelineStep(
        'payment_completed',
        'completed',
        `Payment processed successfully: ${payment.transactionId}`
      );
      
      booking.addTimelineStep(
        'booking_confirmed',
        'completed',
        `Booking confirmed with number: ${booking.confirmationNumber}`
      );

      await booking.save();

      logger.info('✅ Booking finalized successfully', { 
        bookingId,
        confirmationNumber: booking.confirmationNumber,
        transactionId: payment.transactionId
      });

      return booking;
    } catch (error) {
      logger.error('❌ Failed to finalize booking:', error.message);
      throw new Error(`Failed to finalize booking record: ${error.message}`);
    }
  }

  /**
   * Rollback booking in case of failure
   */
  async rollbackBooking(bookingId, reservationId, paymentId, reason) {
    logger.info('🔄 Starting booking rollback', { 
      bookingId, 
      reservationId, 
      paymentId, 
      reason 
    });

    try {
      // Cancel reservation if it was created
      if (reservationId) {
        await this.accommodationAdapter.cancelReservation(reservationId, reason);
      }

      // Refund payment if it was processed
      if (paymentId) {
        try {
          await this.paymentAdapter.refundPayment(paymentId, null, reason);
        } catch (refundError) {
          logger.error('❌ Refund failed during rollback:', refundError.message);
          // Continue with booking cancellation even if refund fails
        }
      }

      // Update booking status to cancelled
      if (bookingId) {
        await Booking.findOneAndUpdate(
          { bookingId },
          {
            status: 'cancelled',
            cancellationReason: reason,
            updatedAt: new Date()
          }
        );
      }

      logger.info('✅ Booking rollback completed', { bookingId });
    } catch (error) {
      logger.error('❌ Rollback failed:', error.message);
      // Don't throw error from rollback to avoid masking original error
    }
  }

  /**
   * Get booking status and details
   */
  /**
   * Get booking details by booking ID
   */
  async getBookingDetails(bookingId) {
    try {
      const booking = await Booking.findOne({ bookingId });
      if (!booking) {
        throw new Error('Booking not found');
      }

      return {
        success: true,
        message: 'Booking details retrieved successfully',
        data: {
          bookingId: booking.bookingId,
          confirmationNumber: booking.confirmationNumber,
          status: booking.status,
          serviceDetails: {
            serviceType: booking.serviceType,
            serviceName: booking.serviceName,
            provider: booking.serviceProvider
          },
          reservationDetails: {
            reservationId: booking.reservationDetails.reservationId,
            tempReservationId: booking.reservationDetails.tempReservationId,
            confirmedAt: booking.reservationDetails.confirmedAt,
            reservationStatus: booking.reservationDetails.reservationStatus
          },
          paymentDetails: {
            transactionId: booking.paymentDetails.transactionId,
            amount: booking.totalAmount,
            currency: booking.currency,
            status: booking.paymentDetails.paymentStatus,
            paymentDate: booking.paymentDetails.paymentDate
          },
          customerInfo: {
            email: booking.contactInfo.email,
            phone: booking.contactInfo.phone
          },
          bookingDetails: booking.getServiceSpecificDetails(),
          bookingTimeline: booking.bookingTimeline,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt
        }
      };
    } catch (error) {
      logger.error('❌ Failed to get booking details:', error.message);
      throw error;
    }
  }

  /**
   * Cancel existing booking
   */
  async cancelBooking(bookingId, reason = 'User cancellation') {
    try {
      const booking = await Booking.findOne({ bookingId });
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status === 'cancelled') {
        throw new Error('Booking is already cancelled');
      }

      // Cancel reservation if it exists
      if (booking.reservationDetails.reservationId) {
        try {
          await this.accommodationAdapter.cancelReservation(
            booking.reservationDetails.reservationId, 
            reason
          );
          
          // Update reservation status
          booking.reservationDetails.reservationStatus = 'cancelled';
          booking.addTimelineStep(
            'reservation_cancelled',
            'completed',
            `Reservation cancelled: ${reason}`
          );
        } catch (error) {
          logger.error('❌ Failed to cancel reservation:', error.message);
          // Continue with booking cancellation even if reservation cancellation fails
        }
      }

      // Process refund if payment was completed
      if (booking.paymentDetails.transactionId && booking.paymentDetails.paymentStatus === 'completed') {
        try {
          const refund = await this.paymentAdapter.refundPayment(
            booking.paymentDetails.transactionId, 
            booking.totalAmount, 
            reason
          );
          
          // Update payment status
          booking.paymentDetails.paymentStatus = 'refunded';
          booking.paymentDetails.refundAmount = booking.totalAmount;
          booking.paymentDetails.refundDate = new Date();
          booking.paymentDetails.refundReason = reason;
          
          booking.addTimelineStep(
            'payment_refunded',
            'completed',
            `Refund processed: ${refund.refundId}`
          );
        } catch (error) {
          logger.error('❌ Failed to process refund:', error.message);
          // Continue with booking cancellation even if refund fails
          booking.addTimelineStep(
            'refund_failed',
            'failed',
            `Refund failed: ${error.message}`
          );
        }
      }

      // Update booking status
      booking.status = 'cancelled';
      booking.cancellationDate = new Date();
      booking.cancellationReason = reason;
      
      booking.addTimelineStep(
        'booking_cancelled',
        'completed',
        `Booking cancelled: ${reason}`
      );

      await booking.save();

      logger.info('✅ Booking cancelled successfully', { 
        bookingId, 
        reason 
      });

      return {
        success: true,
        message: 'Booking cancelled successfully',
        data: {
          bookingId: booking.bookingId,
          status: booking.status,
          refundStatus: booking.paymentDetails.paymentStatus,
          refundAmount: booking.paymentDetails.refundAmount
        }
      };
    } catch (error) {
      logger.error('❌ Failed to cancel booking:', error.message);
      throw error;
    }
  }

  /**
   * Get all bookings for a specific authenticated user
   */
  async getUserBookings(userId, userEmail) {
    try {
      logger.info('📋 Getting user bookings for authenticated user', { userId, userEmail });

      // Security: Ensure at least one user identifier is provided
      if (!userId && !userEmail) {
        logger.warn('❌ No user criteria provided for getUserBookings');
        return {
          success: true,
          message: 'No user criteria provided',
          data: []
        };
      }

      // Build secure query filter - only for the authenticated user
      const filter = {};
      
      // Primary filter: by userId (most secure)
      if (userId) {
        filter.userId = userId;
        logger.info('🔒 Filtering bookings by userId:', userId);
      }
      
      // Secondary filter: by email (if userId not available)
      if (userEmail && !userId) {
        filter['contactInfo.email'] = userEmail;
        logger.info('🔒 Filtering bookings by email:', userEmail);
      }

      // Additional security: Ensure we're not querying all bookings
      if (Object.keys(filter).length === 0) {
        logger.error('❌ No valid filter criteria - potential security issue');
        throw new Error('No valid user filter criteria provided');
      }

      logger.info('🔍 Database query filter:', filter);

      // Find bookings ONLY for the authenticated user
      const bookings = await Booking.find(filter)
        .sort({ createdAt: -1 })
        .lean();

      logger.info(`📋 Found ${bookings.length} bookings for authenticated user`, { 
        userId, 
        userEmail,
        filterUsed: Object.keys(filter)
      });

      // Transform bookings to match expected format
      const transformedBookings = bookings.map(booking => ({
        _id: booking._id,
        id: booking.bookingId,
        serviceType: booking.serviceType,
        serviceName: booking.serviceName,
        serviceProvider: booking.serviceProvider,
        status: booking.status,
        totalAmount: booking.totalAmount,
        currency: booking.currency,
        bookingDetails: booking.getServiceSpecificDetails ? booking.getServiceSpecificDetails() : booking.bookingDetails,
        contactInfo: booking.contactInfo,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        confirmationNumber: booking.confirmationNumber,
        image: booking.image || '/api/placeholder/300/200'
      }));

      // Security log: Confirm we only returned user's own bookings
      logger.info('✅ User bookings retrieved securely', {
        userId,
        userEmail,
        bookingCount: transformedBookings.length,
        bookingIds: transformedBookings.map(b => b.id)
      });

      return {
        success: true,
        message: 'User bookings retrieved successfully',
        data: transformedBookings
      };

    } catch (error) {
      logger.error('❌ Failed to get user bookings:', {
        error: error.message,
        userId,
        userEmail
      });
      throw error;
    }
  }
}

module.exports = EnhancedBookingService;