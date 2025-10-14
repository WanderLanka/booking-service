const express = require('express');
const auth = require('../middleware/auth');

const createReservation = require('./createReservation');
const getReservation = require('./getReservation');
const listReservations = require('./listReservations');
const updateReservation = require('./updateReservation');
const cancelReservation = require('./cancelReservation');

const router = express.Router();

// All tourguide routes are protected
router.post('/reservations', auth, ...createReservation);
router.get('/reservations', auth, listReservations);
router.get('/reservations/:id', auth, getReservation);
router.patch('/reservations/:id', auth, ...updateReservation);
router.post('/reservations/:id/cancel', auth, cancelReservation);

module.exports = router;
