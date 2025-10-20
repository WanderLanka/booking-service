const axios = require('axios');

class ItineraryAdapter {
  constructor() {
    this.baseURL = process.env.ITINERARY_SERVICE_URL || 'http://localhost:3008';
    this.timeout = 10000; // 10 seconds timeout
  }

  /**
   * Store completed trip data in itinerary service
   * @param {Object} tripData - Complete trip data including itinerary, bookings, and payment info
   * @returns {Promise<Object>} Response from itinerary service
   */
  async storeCompletedTrip(tripData) {
    try {
      const response = await axios.post(`${this.baseURL}/store-completed-trip`, tripData, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json',
          'x-service': 'booking-service'
        }
      });

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get itinerary by ID
   * @param {string} itineraryId - Itinerary ID
   * @returns {Promise<Object>} Itinerary data
   */
  async getItineraryById(itineraryId) {
    try {
      const response = await axios.get(`${this.baseURL}/itinerary/${itineraryId}`, {
        timeout: this.timeout,
        headers: {
          'x-service': 'booking-service'
        }
      });
      return response.data;
    } catch (error) {
      console.error('[ItineraryAdapter] Error fetching itinerary:', error.message);
      throw error;
    }
  }

  /**
   * Check itinerary service health
   * @returns {Promise<Object>} Health status
   */
  async checkHealth() {
    try {
      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000,
        headers: {
          'x-service': 'booking-service'
        }
      });
      return response.data;
    } catch (error) {
      console.error('[ItineraryAdapter] Health check failed:', error.message);
      throw error;
    }
  }
}

module.exports = ItineraryAdapter;
