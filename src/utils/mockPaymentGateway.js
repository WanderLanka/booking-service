/**
 * Mock Payment Gateway for Development and Testing
 * Simulates payment processing without actual payment integration
 * 
 * In production, replace with real payment gateway:
 * - Stripe
 * - PayPal
 * - Razorpay
 * - etc.
 */

const crypto = require('crypto');

class MockPaymentGateway {
  /**
   * Process a payment
   * @param {Object} paymentData - Payment information
   * @returns {Promise<Object>} Payment result
   */
  static async processPayment(paymentData) {
    const {
      amount,
      currency = 'USD',
      userId,
      bookingId,
      method = 'mock',
      customerInfo = {},
    } = paymentData;

    // Simulate network delay
    await this._simulateDelay(500, 1500);

    // Generate mock transaction ID
    const transactionId = this._generateTransactionId();

    // Simulate random payment scenarios for testing
    const scenario = this._determinePaymentScenario(amount);

    if (scenario === 'success') {
      return {
        success: true,
        transactionId,
        status: 'completed',
        amount,
        currency,
        method,
        paidAt: new Date(),
        message: 'Payment processed successfully',
        gatewayResponse: {
          mockGateway: true,
          scenario: 'success',
          authorizationCode: this._generateAuthCode(),
        },
      };
    } else if (scenario === 'processing') {
      return {
        success: true,
        transactionId,
        status: 'processing',
        amount,
        currency,
        method,
        message: 'Payment is being processed',
        gatewayResponse: {
          mockGateway: true,
          scenario: 'processing',
          estimatedCompletionTime: new Date(Date.now() + 300000), // 5 minutes
        },
      };
    } else {
      return {
        success: false,
        transactionId: null,
        status: 'failed',
        amount,
        currency,
        method,
        error: 'Payment declined',
        errorCode: 'INSUFFICIENT_FUNDS',
        message: 'Mock payment failed - insufficient funds simulation',
        gatewayResponse: {
          mockGateway: true,
          scenario: 'failed',
        },
      };
    }
  }

  /**
   * Process a refund
   * @param {Object} refundData - Refund information
   * @returns {Promise<Object>} Refund result
   */
  static async processRefund(refundData) {
    const {
      transactionId,
      amount,
      currency = 'USD',
      reason = 'Customer cancellation',
    } = refundData;

    // Simulate network delay
    await this._simulateDelay(300, 1000);

    // Generate mock refund ID
    const refundId = this._generateRefundId();

    // Mock refunds always succeed in test mode
    return {
      success: true,
      refundId,
      transactionId,
      amount,
      currency,
      status: 'refunded',
      refundedAt: new Date(),
      reason,
      message: 'Refund processed successfully',
      gatewayResponse: {
        mockGateway: true,
        refundMethod: 'original_payment_method',
        estimatedArrival: '5-10 business days',
      },
    };
  }

  /**
   * Verify a transaction status
   * @param {string} transactionId - Transaction ID to verify
   * @returns {Promise<Object>} Transaction status
   */
  static async verifyTransaction(transactionId) {
    await this._simulateDelay(200, 500);

    if (!transactionId || !transactionId.startsWith('MOCK_TXN_')) {
      return {
        success: false,
        error: 'Invalid transaction ID',
      };
    }

    return {
      success: true,
      transactionId,
      status: 'completed',
      verifiedAt: new Date(),
      gatewayResponse: {
        mockGateway: true,
        verified: true,
      },
    };
  }

  /**
   * Capture a pre-authorized payment
   * @param {Object} captureData - Capture information
   * @returns {Promise<Object>} Capture result
   */
  static async capturePayment(captureData) {
    const { transactionId, amount } = captureData;

    await this._simulateDelay(300, 800);

    return {
      success: true,
      transactionId,
      captureId: this._generateCaptureId(),
      amount,
      status: 'captured',
      capturedAt: new Date(),
      message: 'Payment captured successfully',
    };
  }

  /**
   * Generate a mock transaction ID
   * @private
   */
  static _generateTransactionId() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `MOCK_TXN_${timestamp}_${random}`;
  }

  /**
   * Generate a mock refund ID
   * @private
   */
  static _generateRefundId() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `MOCK_REFUND_${timestamp}_${random}`;
  }

  /**
   * Generate a mock authorization code
   * @private
   */
  static _generateAuthCode() {
    return crypto.randomBytes(6).toString('hex').toUpperCase();
  }

  /**
   * Generate a mock capture ID
   * @private
   */
  static _generateCaptureId() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `MOCK_CAPTURE_${timestamp}_${random}`;
  }

  /**
   * Simulate network delay
   * @private
   */
  static async _simulateDelay(minMs = 200, maxMs = 1000) {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Determine payment scenario for testing
   * @private
   */
  static _determinePaymentScenario(amount) {
    // Use amount to determine scenario for testing
    // In real usage, all would succeed
    
    // For testing: 
    // - Amounts ending in .99 fail (e.g., 99.99, 199.99)
    // - Amounts ending in .50 go to processing (e.g., 50.50, 150.50)
    // - All others succeed
    
    const amountStr = amount.toFixed(2);
    
    if (amountStr.endsWith('.99')) {
      return 'failed';
    } else if (amountStr.endsWith('.50')) {
      return 'processing';
    } else {
      return 'success';
    }
  }

  /**
   * Get supported payment methods
   */
  static getSupportedMethods() {
    return [
      { id: 'mock', name: 'Mock Payment (Test)', enabled: true },
      { id: 'credit_card', name: 'Credit Card', enabled: false },
      { id: 'paypal', name: 'PayPal', enabled: false },
      { id: 'bank_transfer', name: 'Bank Transfer', enabled: false },
    ];
  }

  /**
   * Validate payment details (for future real gateway integration)
   */
  static async validatePaymentDetails(details) {
    // Mock validation always passes
    await this._simulateDelay(100, 300);
    
    return {
      valid: true,
      message: 'Payment details validated (mock)',
    };
  }
}

module.exports = MockPaymentGateway;
