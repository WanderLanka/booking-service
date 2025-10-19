const axios = require('axios');
const logger = require('../utils/logger');

class AccommodationAdapter {
  constructor() {
    this.baseURL = process.env.ACCOMMODATION_SERVICE_URL || 'http://localhost:3003';
    this.timeout = 10000;
  }

  /**
   * Create temporary reservation (hold room without payment)
   * @param {Object} params - Reservation parameters
   * @param {string} params.accommodationId - Hotel/accommodation ID
   * @param {string} params.checkInDate - Check-in date
   * @param {string} params.checkOutDate - Check-out date
   * @param {number} params.rooms - Number of rooms
   * @param {number} params.adults - Number of adults
   * @param {number} params.children - Number of children
   * @param {string} params.bookingId - Internal booking ID for reference
   * @returns {Promise<Object>} Reservation response with reservation ID
   */
  async createTemporaryReservation(params) {
    try {
      logger.info('🔒 Creating temporary accommodation reservation', {
        accommodationId: params.accommodationId,
        bookingId: params.bookingId
      });

      // Mock response for testing (replace with actual service call when accommodation service is ready)
      logger.info('🔧 Using mock temporary reservation response for testing');
      
      const mockReservationId = `TEMP_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      return {
        success: true,
        reservationId: mockReservationId,
        tempReservationId: mockReservationId,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
        status: 'temporary',
        data: {
          accommodationId: params.accommodationId,
          rooms: params.rooms,
          checkIn: params.checkInDate,
          checkOut: params.checkOutDate
        }
      };

      // TODO: Uncomment this when accommodation service is running
      /*
      const response = await axios.post(`${this.baseURL}/api/reservations/temporary`, {
        accommodationId: params.accommodationId,
        checkInDate: params.checkInDate,
        checkOutDate: params.checkOutDate,
        rooms: params.rooms,
        adults: params.adults,
        children: params.children || 0,
        bookingReference: params.bookingId,
        holdDuration: 15 // Hold for 15 minutes
      }, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      logger.info('✅ Temporary reservation created', { 
        reservationId: response.data.reservationId 
      });

      return {
        success: true,
        reservationId: response.data.reservationId,
        holdUntil: response.data.holdUntil,
        data: response.data
      };

      // TODO: Uncomment this when accommodation service is running
      /*
      const response = await axios.post(`${this.baseURL}/api/reservations/temporary`, {
        accommodationId: params.accommodationId,
        checkInDate: params.checkInDate,
        checkOutDate: params.checkOutDate,
        rooms: params.rooms,
        adults: params.adults,
        children: params.children || 0,
        bookingReference: params.bookingId,
        holdDuration: 15 // Hold for 15 minutes
      }, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      logger.info('✅ Temporary reservation created', { 
        reservationId: response.data.reservationId 
      });

      return {
        success: true,
        reservationId: response.data.reservationId,
        holdUntil: response.data.holdUntil,
        data: response.data
      };
      */

    } catch (error) {
      logger.error('❌ Temporary reservation failed:', error.message);
      throw new Error(error.response?.data?.message || 'Failed to create temporary reservation');
    }
  }

  /**
   * Confirm reservation after successful payment
   * @param {string} reservationId - Temporary reservation ID
   * @param {string} paymentId - Payment transaction ID
   * @param {Object} guestDetails - Guest information
   * @returns {Promise<Object>} Confirmation response
   */
  async confirmReservation(reservationId, paymentId, guestDetails) {
    try {
      logger.info('✅ Confirming accommodation reservation', { 
        reservationId, 
        paymentId 
      });

      const response = await axios.post(`${this.baseURL}/api/reservations/${reservationId}/confirm`, {
        paymentId,
        guestDetails,
        status: 'confirmed'
      }, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      logger.info('✅ Reservation confirmed successfully', { 
        confirmationNumber: response.data.confirmationNumber 
      });

      return {
        success: true,
        confirmationNumber: response.data.confirmationNumber,
        data: response.data
      };

    } catch (error) {
      logger.error('❌ Reservation confirmation failed:', error.message);
      throw new Error(error.response?.data?.message || 'Failed to confirm reservation');
    }
  }

  /**
   * Cancel and release temporary reservation
   * @param {string} reservationId - Temporary reservation ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Cancellation response
   */
  async cancelReservation(reservationId, reason = 'Payment failed') {
    try {
      logger.info('❌ Cancelling accommodation reservation', { 
        reservationId, 
        reason 
      });

      const response = await axios.post(`${this.baseURL}/api/reservations/${reservationId}/cancel`, {
        reason,
        status: 'cancelled'
      }, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      logger.info('✅ Reservation cancelled successfully');

      return {
        success: true,
        message: 'Reservation cancelled and room released',
        data: response.data
      };

    } catch (error) {
      logger.error('❌ Reservation cancellation failed:', error.message);
      // Don't throw error here as this is cleanup - log and continue
      return {
        success: false,
        message: 'Failed to cancel reservation',
        error: error.message
      };
    }
  }
}

module.exports = AccommodationAdapter;