const express = require('express');

const createRouter = require('./create');
const getRouter = require('./get');
const listRouter = require('./list');
const cancelRouter = require('./cancel');

const router = express.Router();

router.use('/create', createRouter);
router.use('/get', getRouter);
router.use('/list', listRouter);
router.use('/cancel', cancelRouter);

module.exports = router;
