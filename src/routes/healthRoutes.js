const express = require('express');
const ServiceAdapter = require('../adapters/ServiceAdapter');
const PaymentAdapter = require('../adapters/PaymentAdapter');
const mongoose = require('mongoose');

const router = express.Router();

// Basic health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'booking-service', 
    timestamp: new Date().toISOString() 
  });
});

// Detailed health check including dependencies
router.get('/health/detailed', async (req, res) => {
  try {
    const healthCheck = {
      service: 'booking-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      dependencies: {}
    };

    // Check MongoDB connection
    healthCheck.dependencies.mongodb = {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      readyState: mongoose.connection.readyState
    };

    // Check service adapters
    const serviceHealth = await ServiceAdapter.checkServicesHealth();
    healthCheck.dependencies.services = serviceHealth;

    // Check payment service
    const paymentHealth = await PaymentAdapter.checkPaymentServiceHealth();
    healthCheck.dependencies.paymentService = paymentHealth;

    // Determine overall health
    const allHealthy = Object.values(healthCheck.dependencies).every(dep => 
      dep.status === 'healthy' || dep.status === 'connected'
    );

    if (!allHealthy) {
      healthCheck.status = 'degraded';
    }

    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthCheck);

  } catch (error) {
    res.status(503).json({
      service: 'booking-service',
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;