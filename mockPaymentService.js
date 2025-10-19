const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'payment-service',
    timestamp: new Date().toISOString()
  });
});

// Process payment endpoint
app.post('/payments/process', (req, res) => {
  try {
    const { transactionId, bookingReference, amount, currency, card, billing } = req.body;

    console.log('Processing payment:', {
      transactionId,
      bookingReference,
      amount,
      currency
    });

    // Simulate payment processing delay
    setTimeout(() => {
      // Simulate 95% success rate
      const isSuccess = Math.random() > 0.05;

      if (isSuccess) {
        res.json({
          success: true,
          transactionId: transactionId || `TXN-${Date.now()}`,
          paymentReference: `PAY-${Date.now()}`,
          status: 'completed',
          processedAmount: amount,
          processingFee: amount * 0.029, // 2.9% processing fee
          currency: currency || 'LKR',
          timestamp: new Date().toISOString()
        });
      } else {
        // Simulate failure
        const errorCodes = ['INSUFFICIENT_FUNDS', 'CARD_DECLINED', 'INVALID_CARD', 'PROCESSING_ERROR'];
        const randomError = errorCodes[Math.floor(Math.random() * errorCodes.length)];
        
        res.status(400).json({
          success: false,
          message: 'Payment processing failed',
          errorCode: randomError,
          timestamp: new Date().toISOString()
        });
      }
    }, 1500); // 1.5 second delay to simulate processing

  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal payment processing error',
      errorCode: 'INTERNAL_ERROR'
    });
  }
});

// Process refund endpoint
app.post('/payments/refund', (req, res) => {
  try {
    const { originalTransactionId, refundAmount, reason } = req.body;

    console.log('Processing refund:', {
      originalTransactionId,
      refundAmount,
      reason
    });

    // Simulate refund processing
    setTimeout(() => {
      res.json({
        success: true,
        refundTransactionId: `RFD-${Date.now()}`,
        refundAmount: refundAmount || 100, // Default refund amount
        status: 'processed',
        estimatedSettlementDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        timestamp: new Date().toISOString()
      });
    }, 1000);

  } catch (error) {
    console.error('Refund processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal refund processing error'
    });
  }
});

// Get payment status endpoint
app.get('/payments/:transactionId/status', (req, res) => {
  const { transactionId } = req.params;

  res.json({
    success: true,
    transactionId,
    status: 'completed',
    amount: 100, // Mock amount
    currency: 'LKR',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => {
  console.log(`🚀 Mock Payment Service running on port ${PORT}`);
});

module.exports = app;