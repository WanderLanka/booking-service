const express = require('express');

const createRouter = require('./create');
const getRouter = require('./get');
const listRouter = require('./list');
const cancelRouter = require('./cancel');
const approveRouter = require('./approve');
const declineRouter = require('./decline');
const payRouter = require('./pay');
const completeRouter = require('./complete');

const router = express.Router();

router.use('/create', createRouter);
router.use('/get', getRouter);
router.use('/list', listRouter);
router.use('/cancel', cancelRouter);
router.use('/approve', approveRouter);
router.use('/decline', declineRouter);
router.use('/pay', payRouter);
router.use('/complete', completeRouter);

module.exports = router;
