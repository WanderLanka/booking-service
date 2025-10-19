const axios = require('axios');
const logger = require('../utils/logger');

class PaymentAdapter {
  constructor() {
    this.baseURL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3006';
    this.timeout = 15000; // Longer timeout for payment processing
  }

  /**
   * Process payment for booking
   * @param {Object} paymentData - Payment information
   * @param {number} paymentData.amount - Amount to charge
   * @param {string} paymentData.currency - Currency code (LKR, USD, etc.)
   * @param {Object} paymentData.paymentMethod - Payment method details
   * @param {string} paymentData.paymentMethod.type - Payment type (card, bank, etc.)
   * @param {Object} paymentData.paymentMethod.card - Card details
   * @param {Object} paymentData.customerInfo - Customer information
   * @param {string} paymentData.bookingReference - Booking reference ID
   * @param {string} paymentData.description - Payment description
   * @returns {Promise<Object>} Payment response
   */
  async processPayment(paymentData) {
    try {
      logger.info('💳 Processing payment', {
        amount: paymentData.amount,
        currency: paymentData.currency,
        bookingReference: paymentData.bookingReference
      });

      const response = await axios.post(`${this.baseURL}/api/payments/process`, {
        amount: paymentData.amount,
        currency: paymentData.currency || 'LKR',
        paymentMethod: {
          type: paymentData.paymentMethod.type || 'card',
          card: {
            number: paymentData.paymentMethod.card.number,
            expiryMonth: paymentData.paymentMethod.card.expiryMonth,
            expiryYear: paymentData.paymentMethod.card.expiryYear,
            cvv: paymentData.paymentMethod.card.cvv,
            holderName: paymentData.paymentMethod.card.holderName
          }
        },
        customerInfo: {
          email: paymentData.customerInfo.email,
          phone: paymentData.customerInfo.phone,
          name: paymentData.customerInfo.name
        },
        bookingReference: paymentData.bookingReference,
        description: paymentData.description || 'Wanderlanka Booking Payment',
        metadata: {
          source: 'booking-service',
          timestamp: new Date().toISOString()
        }
      }, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success && response.data.status === 'completed') {
        logger.info('✅ Payment processed successfully', {
          paymentId: response.data.paymentId,
          transactionId: response.data.transactionId
        });

        return {
          success: true,
          paymentId: response.data.paymentId,
          transactionId: response.data.transactionId,
          status: response.data.status,
          amount: response.data.amount,
          currency: response.data.currency,
          data: response.data
        };
      } else {
        throw new Error(response.data.message || 'Payment processing failed');
      }

    } catch (error) {
      logger.error('❌ Payment processing failed:', error.message);
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Payment service is currently unavailable');
      }
      
      if (error.response?.status === 402) {
        throw new Error('Payment declined: ' + (error.response.data.message || 'Insufficient funds or invalid card'));
      }
      
      throw new Error(error.response?.data?.message || 'Payment processing failed');
    }
  }

  /**
   * Refund payment
   * @param {string} paymentId - Original payment ID
   * @param {number} amount - Amount to refund (optional, defaults to full amount)
   * @param {string} reason - Refund reason
   * @returns {Promise<Object>} Refund response
   */
  async refundPayment(paymentId, amount = null, reason = 'Booking cancellation') {
    try {
      logger.info('💰 Processing refund', {
        paymentId,
        amount: amount || 'full amount',
        reason
      });

      const response = await axios.post(`${this.baseURL}/api/payments/${paymentId}/refund`, {
        amount: amount, // null for full refund
        reason,
        metadata: {
          source: 'booking-service',
          timestamp: new Date().toISOString()
        }
      }, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      logger.info('✅ Refund processed successfully', {
        refundId: response.data.refundId,
        amount: response.data.amount
      });

      return {
        success: true,
        refundId: response.data.refundId,
        amount: response.data.amount,
        status: response.data.status,
        data: response.data
      };

    } catch (error) {
      logger.error('❌ Refund processing failed:', error.message);
      throw new Error(error.response?.data?.message || 'Refund processing failed');
    }
  }

  /**
   * Get payment status
   * @param {string} paymentId - Payment ID to check
   * @returns {Promise<Object>} Payment status response
   */
  async getPaymentStatus(paymentId) {
    try {
      const response = await axios.get(`${this.baseURL}/api/payments/${paymentId}/status`, {
        timeout: this.timeout
      });

      return {
        success: true,
        paymentId: response.data.paymentId,
        status: response.data.status,
        amount: response.data.amount,
        currency: response.data.currency,
        data: response.data
      };

    } catch (error) {
      logger.error('❌ Payment status check failed:', error.message);
      throw new Error(error.response?.data?.message || 'Failed to check payment status');
    }
  }

  /**
   * Validate payment method before processing
   * @param {Object} paymentMethod - Payment method to validate
   * @returns {Promise<Object>} Validation response
   */
  async validatePaymentMethod(paymentMethod) {
    try {
      const response = await axios.post(`${this.baseURL}/api/payments/validate`, {
        paymentMethod
      }, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        valid: response.data.valid,
        message: response.data.message,
        data: response.data
      };

    } catch (error) {
      logger.error('❌ Payment method validation failed:', error.message);
      return {
        success: false,
        valid: false,
        message: error.response?.data?.message || 'Payment method validation failed'
      };
    }
  }
}

module.exports = PaymentAdapter;