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
    service: 'guide-service',
    timestamp: new Date().toISOString()
  });
});

// Create reservation endpoint
app.post('/reservations', (req, res) => {
  try {
    const { guideId, tourDate, duration, groupSize, specialRequests } = req.body;

    console.log('Creating guide reservation:', {
      guideId,
      tourDate,
      duration,
      groupSize,
      specialRequests
    });

    // Simulate availability check (80% success rate)
    const isAvailable = Math.random() > 0.2;

    if (isAvailable) {
      const reservationId = `GUIDE-RES-${Date.now()}`;
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Store reservation
      reservations.set(reservationId, {
        id: reservationId,
        guideId,
        tourDate,
        duration,
        groupSize,
        specialRequests,
        status: 'pending',
        createdAt: new Date(),
        expiresAt
      });

      res.json({
        success: true,
        reservationId,
        expiresAt: expiresAt.toISOString(),
        message: 'Guide reserved successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Guide not available for the selected date and time'
      });
    }

  } catch (error) {
    console.error('Guide reservation error:', error);
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

    console.log('Guide reservation confirmed:', reservationId);

    res.json({
      success: true,
      reservationId,
      status: 'confirmed',
      message: 'Guide reservation confirmed'
    });

  } catch (error) {
    console.error('Guide confirmation error:', error);
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
      console.log('Guide reservation cancelled:', reservationId);
    }

    res.json({
      success: true,
      message: 'Reservation cancelled'
    });

  } catch (error) {
    console.error('Guide cancellation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`🚀 Mock Guide Service running on port ${PORT}`);
});

module.exports = app;