const express = require('express');
const { createPaymentIntent, capturePayment } = require('../services/mockPaymentGateway');

const router = express.Router();

// Simple mock payment test
router.post('/mock/test', async (req, res, next) => {
  try {
    const amount = Number(req.body?.amount ?? 100);
    const currency = req.body?.currency || 'USD';
    const intent = await createPaymentIntent({ amount, currency, metadata: { reason: 'test' } });
    const captured = await capturePayment(intent.id);
    res.json({ success: true, data: { intent, capture: captured } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
