const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const Booking = require('../models/Booking');

class BookingService {
  
  /**
   * Simplified booking method - handles different service types with proper mock data
   */
  static async createBooking(bookingData) {
    const { 
      userId, 
      serviceType, 
      serviceId, 
      serviceName, 
      serviceProvider,
      totalAmount,
      bookingDetails,
      paymentDetails,
      contactInfo 
    } = bookingData;

    try {
      logger.info(`Processing ${serviceType} booking request`, { 
        userId, 
        serviceType, 
        serviceName, 
        totalAmount 
      });

      // Validate service type specific requirements
      const validationResult = this.validateServiceSpecificData(serviceType, bookingDetails);
      if (!validationResult.isValid) {
        return {
          success: false,
          message: validationResult.message,
          error: 'VALIDATION_ERROR'
        };
      }

      // Simulate processing delay (different for each service type)
      const processingTime = this.getProcessingTime(serviceType);
      await new Promise(resolve => setTimeout(resolve, processingTime));

      // Generate service-specific booking data
      const bookingId = uuidv4();
      const confirmationNumber = this.generateConfirmationNumber(serviceType);
      const transactionId = `TXN-${serviceType.toUpperCase()}-${Date.now()}`;
      const reservationId = `RES-${serviceType.toUpperCase()}-${Date.now()}`;

      // Create service-specific booking response
      const bookingResponse = this.createServiceSpecificResponse(
        serviceType, 
        bookingId, 
        confirmationNumber, 
        transactionId, 
        reservationId,
        bookingData
      );

      // Save booking to database
      try {
        const booking = new Booking({
          bookingId,
          reservationId,
          confirmationNumber,
          transactionId,
          userId,
          serviceType,
          serviceId,
          serviceName,
          serviceProvider,
          totalAmount,
          currency: bookingDetails.currency || 'LKR',
          status: 'confirmed',
          bookingDetails: {
            ...bookingDetails,
            // Add service-specific fields based on response
            ...(serviceType === 'accommodation' && {
              roomType: bookingResponse.data.accommodationDetails?.roomType,
              amenities: bookingResponse.data.accommodationDetails?.amenities
            })
          },
          contactInfo,
          paymentInfo: {
            method: 'credit_card',
            status: 'completed',
            lastFourDigits: paymentDetails.cardNumber?.slice(-4),
            paymentDate: new Date()
          },
          serviceResponseData: bookingResponse.data, // Store complete response
          metadata: {
            platform: 'web',
            source: 'direct'
          }
        });

        await booking.save();
        logger.info('Booking saved to database successfully', { bookingId });
        
      } catch (dbError) {
        logger.error('Failed to save booking to database:', dbError);
        // Continue with response even if DB save fails - booking was processed
      }

      logger.info(`${serviceType} booking completed successfully`, { 
        bookingId, 
        confirmationNumber,
        transactionId,
        serviceType
      });

      return bookingResponse;

    } catch (error) {
      logger.error(`${serviceType} booking service error:`, error);

      return {
        success: false,
        message: `${serviceType} booking failed - please try again`,
        error: 'BOOKING_ERROR'
      };
    }
  }

  /**
   * Validate service-specific booking data
   */
  static validateServiceSpecificData(serviceType, bookingDetails) {
    switch (serviceType) {
      case 'accommodation':
        if (!bookingDetails.checkInDate || !bookingDetails.checkOutDate) {
          return {
            isValid: false,
            message: 'Check-in and check-out dates are required for accommodation booking'
          };
        }
        if (!bookingDetails.rooms || bookingDetails.rooms < 1) {
          return {
            isValid: false,
            message: 'At least one room is required for accommodation booking'
          };
        }
        break;

      case 'transportation':
        if (!bookingDetails.startDate) {
          return {
            isValid: false,
            message: 'Start date is required for transportation booking'
          };
        }
        if (!bookingDetails.pickupLocation || !bookingDetails.dropoffLocation) {
          return {
            isValid: false,
            message: 'Pickup and dropoff locations are required for transportation booking'
          };
        }
        if (!bookingDetails.passengers || bookingDetails.passengers < 1) {
          return {
            isValid: false,
            message: 'At least one passenger is required for transportation booking'
          };
        }
        break;

      case 'guide':
        if (!bookingDetails.tourDate) {
          return {
            isValid: false,
            message: 'Tour date is required for guide booking'
          };
        }
        if (!bookingDetails.duration || bookingDetails.duration < 1) {
          return {
            isValid: false,
            message: 'Tour duration is required for guide booking'
          };
        }
        if (!bookingDetails.groupSize || bookingDetails.groupSize < 1) {
          return {
            isValid: false,
            message: 'Group size is required for guide booking'
          };
        }
        break;

      default:
        return {
          isValid: false,
          message: 'Invalid service type'
        };
    }

    return { isValid: true };
  }

  /**
   * Get processing time based on service type
   */
  static getProcessingTime(serviceType) {
    const processingTimes = {
      'accommodation': 2500, // Hotels take longer to confirm
      'transportation': 2000, // Vehicle bookings are medium
      'guide': 1500 // Guide bookings are fastest
    };

    return processingTimes[serviceType] || 2000;
  }

  /**
   * Generate service-specific confirmation numbers
   */
  static generateConfirmationNumber(serviceType) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    
    const prefixes = {
      'accommodation': 'HTL',
      'transportation': 'VHC', 
      'guide': 'GDE'
    };

    const prefix = prefixes[serviceType] || 'SVC';
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Create service-specific booking response
   */
  static createServiceSpecificResponse(serviceType, bookingId, confirmationNumber, transactionId, reservationId, bookingData) {
    const baseResponse = {
      success: true,
      message: `${serviceType} booking confirmed successfully`,
      data: {
        bookingId,
        reservationId,
        confirmationNumber,
        transactionId,
        status: 'confirmed',
        totalAmount: bookingData.totalAmount,
        currency: bookingData.bookingDetails.currency || 'LKR',
        serviceDetails: {
          type: serviceType,
          name: bookingData.serviceName,
          provider: bookingData.serviceProvider
        },
        contactInfo: {
          email: bookingData.contactInfo.email,
          phone: bookingData.contactInfo.phone
        }
      }
    };

    // Add service-specific details
    switch (serviceType) {
      case 'accommodation':
        baseResponse.data.accommodationDetails = {
          checkInDate: bookingData.bookingDetails.checkInDate,
          checkOutDate: bookingData.bookingDetails.checkOutDate,
          rooms: bookingData.bookingDetails.rooms,
          adults: bookingData.bookingDetails.adults,
          children: bookingData.bookingDetails.children,
          nights: bookingData.bookingDetails.nights,
          roomType: 'Standard Room', // Mock data
          amenities: ['WiFi', 'Breakfast', 'Pool Access'] // Mock amenities
        };
        break;

      case 'transportation':
        baseResponse.data.transportationDetails = {
          startDate: bookingData.bookingDetails.startDate,
          days: bookingData.bookingDetails.days,
          passengers: bookingData.bookingDetails.passengers,
          pickupLocation: bookingData.bookingDetails.pickupLocation,
          dropoffLocation: bookingData.bookingDetails.dropoffLocation,
          estimatedDistance: bookingData.bookingDetails.estimatedDistance,
          vehicleType: 'Sedan', // Mock data
          driverName: 'Kamal Silva', // Mock driver
          driverPhone: '+94 77 123 4567' // Mock phone
        };
        break;

      case 'guide':
        baseResponse.data.guideDetails = {
          tourDate: bookingData.bookingDetails.tourDate,
          duration: bookingData.bookingDetails.duration,
          groupSize: bookingData.bookingDetails.groupSize,
          specialRequests: bookingData.bookingDetails.specialRequests,
          guideName: 'Sunil Perera', // Mock guide name
          guidePhone: '+94 71 987 6543', // Mock phone
          languages: ['English', 'Sinhala'], // Mock languages
          meetingPoint: 'Hotel Lobby' // Mock meeting point
        };
        break;
    }

    return baseResponse;
  }

  /**
   * Get booking by ID for a specific user (enhanced mock with service types)
   */
  static async getBookingById(bookingId, userId) {
    try {
      logger.info(`Getting mock booking`, { bookingId, userId });

      // Simulate different service types for demo
      const serviceTypes = ['accommodation', 'transportation', 'guide'];
      const randomServiceType = serviceTypes[Math.floor(Math.random() * serviceTypes.length)];

      // Return mock booking data based on service type
      const baseBooking = {
        bookingId,
        userId,
        serviceType: randomServiceType,
        status: 'confirmed',
        totalAmount: 150,
        currency: 'LKR',
        createdAt: new Date().toISOString(),
        confirmationNumber: this.generateConfirmationNumber(randomServiceType)
      };

      // Add service-specific details
      switch (randomServiceType) {
        case 'accommodation':
          baseBooking.serviceName = 'Grand Hotel Colombo';
          baseBooking.accommodationDetails = {
            checkInDate: '2025-11-01',
            checkOutDate: '2025-11-03',
            rooms: 1,
            adults: 2,
            children: 0,
            nights: 2
          };
          break;

        case 'transportation':
          baseBooking.serviceName = 'Toyota Corolla Rental';
          baseBooking.transportationDetails = {
            startDate: '2025-11-01',
            days: 3,
            passengers: 4,
            pickupLocation: 'Colombo Airport',
            dropoffLocation: 'Galle'
          };
          break;

        case 'guide':
          baseBooking.serviceName = 'Sigiriya Tour Guide';
          baseBooking.guideDetails = {
            tourDate: '2025-11-01',
            duration: 8,
            groupSize: 4,
            specialRequests: 'Early morning start'
          };
          break;
      }

      return {
        success: true,
        data: baseBooking
      };

    } catch (error) {
      logger.error(`Error fetching mock booking:`, error);
      return {
        success: false,
        message: 'Error retrieving booking'
      };
    }
  }

  /**
   * Get all bookings for a user (enhanced mock with different service types)
   */
  static async getUserBookings(userId, filters = {}) {
    try {
      logger.info(`Getting mock user bookings`, { userId, filters });

      // Create mock bookings for different service types
      const mockBookings = [
        {
          bookingId: `acc-${Date.now()}`,
          serviceType: 'accommodation',
          serviceName: 'Cinnamon Grand Hotel',
          status: 'confirmed',
          totalAmount: 200,
          currency: 'LKR',
          createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          confirmationNumber: this.generateConfirmationNumber('accommodation'),
          accommodationDetails: {
            checkInDate: '2025-11-15',
            checkOutDate: '2025-11-17',
            rooms: 1,
            nights: 2
          }
        },
        {
          bookingId: `trans-${Date.now()}`,
          serviceType: 'transportation',
          serviceName: 'Airport Transfer Van',
          status: 'confirmed',
          totalAmount: 75,
          currency: 'LKR',
          createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          confirmationNumber: this.generateConfirmationNumber('transportation'),
          transportationDetails: {
            startDate: '2025-11-20',
            passengers: 6,
            pickupLocation: 'Hotel',
            dropoffLocation: 'Airport'
          }
        },
        {
          bookingId: `guide-${Date.now()}`,
          serviceType: 'guide',
          serviceName: 'Kandy Cultural Tour Guide',
          status: 'confirmed',
          totalAmount: 120,
          currency: 'LKR',
          createdAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
          confirmationNumber: this.generateConfirmationNumber('guide'),
          guideDetails: {
            tourDate: '2025-11-25',
            duration: 6,
            groupSize: 4
          }
        }
      ];

      // Apply filters if provided
      let filteredBookings = mockBookings;
      
      if (filters.serviceType) {
        filteredBookings = mockBookings.filter(booking => booking.serviceType === filters.serviceType);
      }
      
      if (filters.status) {
        filteredBookings = filteredBookings.filter(booking => booking.status === filters.status);
      }

      // Apply pagination
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedBookings = filteredBookings.slice(startIndex, endIndex);

      return {
        success: true,
        data: {
          bookings: paginatedBookings,
          pagination: {
            page,
            limit,
            total: filteredBookings.length,
            totalPages: Math.ceil(filteredBookings.length / limit)
          }
        }
      };

    } catch (error) {
      logger.error(`Error fetching mock user bookings:`, error);
      return {
        success: false,
        message: 'Error retrieving bookings'
      };
    }
  }

  /**
   * Cancel a booking (enhanced mock with service-specific logic)
   */
  static async cancelBooking(bookingId, userId, reason) {
    try {
      logger.info(`Cancelling mock booking`, { bookingId, userId, reason });

      // Simulate different cancellation policies based on booking ID prefix
      let cancellationPolicy = 'standard';
      let refundAmount = 0;
      let cancellationFee = 0;

      if (bookingId.includes('acc-') || bookingId.includes('HTL-')) {
        // Accommodation cancellation policy
        cancellationPolicy = 'accommodation';
        refundAmount = 180; // 90% refund for hotels
        cancellationFee = 20;
      } else if (bookingId.includes('trans-') || bookingId.includes('VHC-')) {
        // Transportation cancellation policy  
        cancellationPolicy = 'transportation';
        refundAmount = 67.5; // 90% refund for vehicles
        cancellationFee = 7.5;
      } else if (bookingId.includes('guide-') || bookingId.includes('GDE-')) {
        // Guide cancellation policy
        cancellationPolicy = 'guide';
        refundAmount = 108; // 90% refund for guides
        cancellationFee = 12;
      }

      // Simulate processing time based on service type
      await new Promise(resolve => setTimeout(resolve, 1000));

      logger.info(`Booking cancelled successfully`, { 
        bookingId, 
        userId, 
        reason, 
        cancellationPolicy,
        refundAmount,
        cancellationFee
      });

      return {
        success: true,
        message: 'Booking cancelled successfully',
        data: {
          bookingId,
          status: 'cancelled',
          cancellationDate: new Date().toISOString(),
          cancellationReason: reason,
          refundDetails: {
            refundAmount,
            cancellationFee,
            refundMethod: 'Original payment method',
            estimatedRefundTime: '3-5 business days'
          },
          cancellationPolicy
        }
      };

    } catch (error) {
      logger.error(`Error cancelling mock booking:`, error);
      return {
        success: false,
        message: 'Error cancelling booking'
      };
    }
  }
}

module.exports = BookingService;