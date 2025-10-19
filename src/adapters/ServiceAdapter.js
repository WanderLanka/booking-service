const axios = require('axios');
const logger = require('../utils/logger');

class ServiceAdapter {
  
  /**
   * Check availability and create temporary reservation
   * Routes to specific service based on service type
   */
  static async checkAvailabilityAndReserve(serviceType, serviceId, bookingDetails) {
    try {
      switch (serviceType) {
        case 'accommodation':
          return await this.handleAccommodationReservation(serviceId, bookingDetails);
        case 'transportation':
          return await this.handleTransportationReservation(serviceId, bookingDetails);
        case 'guide':
          return await this.handleGuideReservation(serviceId, bookingDetails);
        default:
          throw new Error(`Unsupported service type: ${serviceType}`);
      }
    } catch (error) {
      logger.error(`Service adapter error for ${serviceType}:`, error);
      return {
        success: false,
        message: error.message || 'Service communication failed'
      };
    }
  }

  /**
   * Confirm a temporary reservation
   */
  static async confirmReservation(serviceType, reservationId) {
    try {
      const serviceUrl = this.getServiceUrl(serviceType);
      
      const response = await axios.post(`${serviceUrl}/reservations/${reservationId}/confirm`, {}, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'WanderLanka-BookingService/1.0'
        }
      });

      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      logger.error(`Reservation confirmation failed for ${serviceType}:`, error);
      
      if (error.response) {
        return {
          success: false,
          message: error.response.data?.message || 'Reservation confirmation failed'
        };
      }
      
      return {
        success: false,
        message: 'Service communication error during confirmation'
      };
    }
  }

  /**
   * Cancel a reservation
   */
  static async cancelReservation(serviceType, reservationId) {
    try {
      const serviceUrl = this.getServiceUrl(serviceType);
      
      await axios.delete(`${serviceUrl}/reservations/${reservationId}`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'WanderLanka-BookingService/1.0'
        }
      });

      logger.info(`Reservation cancelled`, { serviceType, reservationId });
      return { success: true };

    } catch (error) {
      logger.error(`Reservation cancellation failed:`, error);
      // Don't throw - cancellation failures shouldn't block the main flow
      return { success: false, message: error.message };
    }
  }

  /**
   * Handle accommodation service reservations
   */
  static async handleAccommodationReservation(serviceId, bookingDetails) {
    const serviceUrl = this.getServiceUrl('accommodation');
    
    const reservationRequest = {
      accommodationId: serviceId,
      checkInDate: bookingDetails.checkInDate,
      checkOutDate: bookingDetails.checkOutDate,
      rooms: bookingDetails.rooms,
      adults: bookingDetails.adults,
      children: bookingDetails.children,
      specialRequests: bookingDetails.notes
    };

    const response = await axios.post(`${serviceUrl}/reservations`, reservationRequest, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WanderLanka-BookingService/1.0'
      }
    });

    if (response.data.success) {
      return {
        success: true,
        reservationId: response.data.reservationId,
        expiresAt: response.data.expiresAt,
        data: response.data
      };
    } else {
      return {
        success: false,
        message: response.data.message || 'Accommodation not available'
      };
    }
  }

  /**
   * Handle transportation service reservations
   */
  static async handleTransportationReservation(serviceId, bookingDetails) {
    const serviceUrl = this.getServiceUrl('transportation');
    
    const reservationRequest = {
      vehicleId: serviceId,
      startDate: bookingDetails.startDate,
      days: bookingDetails.days,
      passengers: bookingDetails.passengers,
      pickupLocation: bookingDetails.pickupLocation,
      dropoffLocation: bookingDetails.dropoffLocation,
      estimatedDistance: bookingDetails.estimatedDistance
    };

    const response = await axios.post(`${serviceUrl}/reservations`, reservationRequest, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WanderLanka-BookingService/1.0'
      }
    });

    if (response.data.success) {
      return {
        success: true,
        reservationId: response.data.reservationId,
        expiresAt: response.data.expiresAt,
        data: response.data
      };
    } else {
      return {
        success: false,
        message: response.data.message || 'Transportation not available'
      };
    }
  }

  /**
   * Handle guide service reservations
   */
  static async handleGuideReservation(serviceId, bookingDetails) {
    const serviceUrl = this.getServiceUrl('guide');
    
    const reservationRequest = {
      guideId: serviceId,
      tourDate: bookingDetails.tourDate,
      duration: bookingDetails.duration,
      groupSize: bookingDetails.groupSize,
      specialRequests: bookingDetails.specialRequests
    };

    const response = await axios.post(`${serviceUrl}/reservations`, reservationRequest, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WanderLanka-BookingService/1.0'
      }
    });

    if (response.data.success) {
      return {
        success: true,
        reservationId: response.data.reservationId,
        expiresAt: response.data.expiresAt,
        data: response.data
      };
    } else {
      return {
        success: false,
        message: response.data.message || 'Guide not available'
      };
    }
  }

  /**
   * Get service URL based on service type
   */
  static getServiceUrl(serviceType) {
    const urls = {
      accommodation: process.env.ACCOMMODATION_SERVICE_URL || 'http://localhost:3003',
      transportation: process.env.TRANSPORT_SERVICE_URL || 'http://localhost:3002',
      guide: process.env.GUIDE_SERVICE_URL || 'http://localhost:3005'
    };

    const url = urls[serviceType];
    if (!url) {
      throw new Error(`No URL configured for service type: ${serviceType}`);
    }

    return url;
  }

  /**
   * Health check for all services
   */
  static async checkServicesHealth() {
    const services = ['accommodation', 'transportation', 'guide'];
    const healthChecks = {};

    for (const service of services) {
      try {
        const serviceUrl = this.getServiceUrl(service);
        const response = await axios.get(`${serviceUrl}/health`, { timeout: 5000 });
        
        healthChecks[service] = {
          status: 'healthy',
          response: response.data
        };
      } catch (error) {
        healthChecks[service] = {
          status: 'unhealthy',
          error: error.message
        };
      }
    }

    return healthChecks;
  }
}

module.exports = ServiceAdapter;