const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

class PaymentAdapter {
  
  /**
   * Process payment through payment service
   */
  static async processPayment(paymentRequest) {
    try {
      const {
        bookingId,
        amount,
        currency,
        paymentMethod,
        cardDetails,
        billingAddress,
        description
      } = paymentRequest;

      // Prepare payment request for Payment Service
      const paymentServiceRequest = {
        transactionId: this.generateTransactionId(),
        bookingReference: bookingId,
        amount: parseFloat(amount),
        currency: currency || 'LKR',
        paymentMethod,
        description: description || 'WanderLanka Service Booking',
        
        // Card information (will be encrypted by payment service)
        card: {
          number: cardDetails.cardNumber?.replace(/\s+/g, ''),
          expiryMonth: this.extractExpiryMonth(cardDetails.expiryDate),
          expiryYear: this.extractExpiryYear(cardDetails.expiryDate),
          cvv: cardDetails.cvv,
          holderName: cardDetails.cardholderName
        },
        
        // Billing information
        billing: billingAddress ? {
          street: billingAddress.street,
          city: billingAddress.city,
          state: billingAddress.state,
          zipCode: billingAddress.zipCode,
          country: billingAddress.country || 'Sri Lanka'
        } : null,
        
        // Metadata for tracking
        metadata: {
          source: 'wanderlanka-web',
          bookingId,
          timestamp: new Date().toISOString()
        }
      };

      // Call Payment Service
      const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3006';
      
      const response = await axios.post(`${paymentServiceUrl}/payments/process`, paymentServiceRequest, {
        timeout: 30000, // Payment processing can take longer
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'WanderLanka-BookingService/1.0',
          'X-Service-Key': process.env.PAYMENT_SERVICE_API_KEY || 'dev-key-123'
        }
      });

      const paymentResult = response.data;

      if (paymentResult.success) {
        logger.info(`Payment processed successfully`, {
          transactionId: paymentResult.transactionId,
          bookingId,
          amount,
          currency
        });

        return {
          success: true,
          transactionId: paymentResult.transactionId,
          paymentReference: paymentResult.paymentReference,
          status: paymentResult.status,
          processedAmount: paymentResult.processedAmount,
          processingFee: paymentResult.processingFee,
          data: paymentResult
        };
      } else {
        logger.error(`Payment processing failed`, {
          bookingId,
          error: paymentResult.message,
          errorCode: paymentResult.errorCode
        });

        return {
          success: false,
          message: this.translatePaymentError(paymentResult.errorCode, paymentResult.message),
          errorCode: paymentResult.errorCode
        };
      }

    } catch (error) {
      logger.error(`Payment adapter error:`, error);

      // Handle different types of errors
      if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          message: 'Payment service is temporarily unavailable. Please try again later.',
          errorCode: 'SERVICE_UNAVAILABLE'
        };
      }

      if (error.response) {
        const errorData = error.response.data;
        return {
          success: false,
          message: this.translatePaymentError(errorData?.errorCode, errorData?.message),
          errorCode: errorData?.errorCode || 'PAYMENT_ERROR'
        };
      }

      return {
        success: false,
        message: 'Payment processing failed due to technical error',
        errorCode: 'TECHNICAL_ERROR'
      };
    }
  }

  /**
   * Process refund through payment service
   */
  static async processRefund(transactionId, amount = null, reason = 'Customer request') {
    try {
      const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3006';
      
      const refundRequest = {
        originalTransactionId: transactionId,
        refundAmount: amount, // null for full refund
        reason,
        requestId: this.generateTransactionId(),
        timestamp: new Date().toISOString()
      };

      const response = await axios.post(`${paymentServiceUrl}/payments/refund`, refundRequest, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'WanderLanka-BookingService/1.0',
          'X-Service-Key': process.env.PAYMENT_SERVICE_API_KEY || 'dev-key-123'
        }
      });

      const refundResult = response.data;

      if (refundResult.success) {
        logger.info(`Refund processed successfully`, {
          originalTransactionId: transactionId,
          refundTransactionId: refundResult.refundTransactionId,
          refundAmount: refundResult.refundAmount
        });

        return {
          success: true,
          refundTransactionId: refundResult.refundTransactionId,
          refundAmount: refundResult.refundAmount,
          status: refundResult.status,
          estimatedSettlementDate: refundResult.estimatedSettlementDate
        };
      } else {
        return {
          success: false,
          message: refundResult.message || 'Refund processing failed',
          errorCode: refundResult.errorCode
        };
      }

    } catch (error) {
      logger.error(`Refund processing error:`, error);
      
      return {
        success: false,
        message: 'Refund processing failed due to technical error',
        errorCode: 'REFUND_ERROR'
      };
    }
  }

  /**
   * Verify payment status with payment service
   */
  static async verifyPaymentStatus(transactionId) {
    try {
      const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3006';
      
      const response = await axios.get(`${paymentServiceUrl}/payments/${transactionId}/status`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'WanderLanka-BookingService/1.0',
          'X-Service-Key': process.env.PAYMENT_SERVICE_API_KEY || 'dev-key-123'
        }
      });

      return {
        success: true,
        status: response.data.status,
        data: response.data
      };

    } catch (error) {
      logger.error(`Payment status verification error:`, error);
      
      return {
        success: false,
        message: 'Unable to verify payment status'
      };
    }
  }

  /**
   * Generate unique transaction ID
   */
  static generateTransactionId() {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(4).toString('hex');
    return `WL-${timestamp}-${randomBytes}`;
  }

  /**
   * Extract expiry month from MM/YY format
   */
  static extractExpiryMonth(expiryDate) {
    if (!expiryDate) return null;
    const parts = expiryDate.split('/');
    return parts[0] ? parseInt(parts[0], 10) : null;
  }

  /**
   * Extract expiry year from MM/YY format
   */
  static extractExpiryYear(expiryDate) {
    if (!expiryDate) return null;
    const parts = expiryDate.split('/');
    if (parts[1]) {
      const year = parseInt(parts[1], 10);
      // Convert YY to YYYY (assuming 20YY for years < 50, 19YY for years >= 50)
      return year < 50 ? 2000 + year : 1900 + year;
    }
    return null;
  }

  /**
   * Translate payment error codes to user-friendly messages
   */
  static translatePaymentError(errorCode, originalMessage) {
    const errorMessages = {
      'INSUFFICIENT_FUNDS': 'Payment declined due to insufficient funds. Please check your account balance.',
      'INVALID_CARD': 'Invalid card information. Please check your card details and try again.',
      'EXPIRED_CARD': 'Your card has expired. Please use a different card.',
      'INVALID_CVV': 'Invalid security code (CVV). Please check and try again.',
      'CARD_DECLINED': 'Your card was declined. Please contact your bank or use a different card.',
      'PROCESSING_ERROR': 'Payment processing error. Please try again or use a different payment method.',
      'NETWORK_ERROR': 'Network connection error. Please check your connection and try again.',
      'TIMEOUT': 'Payment processing timed out. Please try again.',
      'DUPLICATE_TRANSACTION': 'This transaction appears to be a duplicate. Please check your bookings.',
      'AMOUNT_INVALID': 'Invalid payment amount. Please contact support.',
      'CURRENCY_NOT_SUPPORTED': 'Currency not supported. Please contact support.',
      'SERVICE_UNAVAILABLE': 'Payment service is temporarily unavailable. Please try again later.'
    };

    return errorMessages[errorCode] || originalMessage || 'Payment processing failed. Please try again.';
  }

  /**
   * Health check for payment service
   */
  static async checkPaymentServiceHealth() {
    try {
      const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3006';
      
      const response = await axios.get(`${paymentServiceUrl}/health`, { timeout: 5000 });
      
      return {
        status: 'healthy',
        response: response.data
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = PaymentAdapter;