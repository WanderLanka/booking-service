const express = require('express');
const auth = require('../middleware/auth');

const createBooking = require('./createBooking');
const getBooking = require('./getBooking');
const listBookings = require('./listBookings');
const updateBooking = require('./updateBooking');
const cancelBooking = require('./cancelBooking');

const router = express.Router();

// All tourpackage routes are protected
router.post('/bookings', auth, ...createBooking);
router.get('/bookings', auth, listBookings);
router.get('/bookings/:id', auth, getBooking);
router.patch('/bookings/:id', auth, ...updateBooking);
router.post('/bookings/:id/cancel', auth, cancelBooking);

module.exports = router;
