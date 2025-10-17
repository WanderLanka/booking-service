const express = require('express');
const auth = require('../middleware/auth');

const createBooking = require('./createBooking');
const getBooking = require('./getBooking');
const listBookings = require('./listBookings');
const updateBooking = require('./updateBooking');
const cancelBooking = require('./cancelBooking');

const router = express.Router();

// Alias for explicit create path
router.post('/createBooking', auth, ...createBooking); // array of [validate, handler]

// Single handler controllers should not be spread
router.get('/getBooking/:id', auth, getBooking);
router.get('/listBookings', auth, listBookings);

// updateBooking exports [validate, handler]
router.patch('/updateBooking/:id', auth, ...updateBooking);

// cancelBooking is a single handler
router.post('/cancelBooking/:id', auth, cancelBooking);

module.exports = router;
