const crypto = require('crypto');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createPaymentIntent({ amount, currency, metadata }) {
  // Simulate network + gateway processing
  await delay(200);
  const intentId = `mockpi_${crypto.randomBytes(8).toString('hex')}`;
  return {
    id: intentId,
    status: 'requires_capture',
    amount,
    currency,
    metadata,
    provider: 'mockpay',
  };
}

async function capturePayment(intentId) {
  await delay(200);
  // 95% success rate mock
  const success = Math.random() < 0.95;
  if (!success) {
    return { id: intentId, status: 'failed' };
  }
  return { id: intentId, status: 'captured' };
}

module.exports = { createPaymentIntent, capturePayment };
