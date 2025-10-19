const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Store reservations in memory
const reservations = new Map();

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'transportation-service',
    timestamp: new Date().toISOString()
  });
});

// Create reservation endpoint
app.post('/reservations', (req, res) => {
  try {
    const { vehicleId, startDate, days, passengers, pickupLocation, dropoffLocation } = req.body;

    console.log('Creating transportation reservation:', {
      vehicleId,
      startDate,
      days,
      passengers,
      pickupLocation,
      dropoffLocation
    });

    // Simulate availability check (85% success rate)
    const isAvailable = Math.random() > 0.15;

    if (isAvailable) {
      const reservationId = `TRANS-RES-${Date.now()}`;
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Store reservation
      reservations.set(reservationId, {
        id: reservationId,
        vehicleId,
        startDate,
        days,
        passengers,
        pickupLocation,
        dropoffLocation,
        status: 'pending',
        createdAt: new Date(),
        expiresAt
      });

      res.json({
        success: true,
        reservationId,
        expiresAt: expiresAt.toISOString(),
        message: 'Transportation reserved successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Vehicle not available for the selected dates'
      });
    }

  } catch (error) {
    console.error('Transportation reservation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Confirm reservation endpoint
app.post('/reservations/:reservationId/confirm', (req, res) => {
  try {
    const { reservationId } = req.params;
    const reservation = reservations.get(reservationId);

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found'
      });
    }

    if (new Date() > new Date(reservation.expiresAt)) {
      reservations.delete(reservationId);
      return res.status(400).json({
        success: false,
        message: 'Reservation has expired'
      });
    }

    // Update reservation status
    reservation.status = 'confirmed';
    reservation.confirmedAt = new Date();
    reservations.set(reservationId, reservation);

    console.log('Transportation reservation confirmed:', reservationId);

    res.json({
      success: true,
      reservationId,
      status: 'confirmed',
      message: 'Transportation reservation confirmed'
    });

  } catch (error) {
    console.error('Transportation confirmation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Cancel reservation endpoint
app.delete('/reservations/:reservationId', (req, res) => {
  try {
    const { reservationId } = req.params;
    const reservation = reservations.get(reservationId);

    if (reservation) {
      reservations.delete(reservationId);
      console.log('Transportation reservation cancelled:', reservationId);
    }

    res.json({
      success: true,
      message: 'Reservation cancelled'
    });

  } catch (error) {
    console.error('Transportation cancellation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`🚀 Mock Transportation Service running on port ${PORT}`);
});

module.exports = app;