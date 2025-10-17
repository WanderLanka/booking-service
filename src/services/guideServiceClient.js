const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

async function incrementTourPackageBookingCount(tourPackageId, increment = 1) {
  const baseUrl = config.guideServiceUrl;
  const url = `${baseUrl}/tourpackages/${tourPackageId}/booking-count`;
  try {
    const res = await axios.patch(url, { increment });
    return res.data;
  } catch (err) {
    logger.warn(`Failed to update booking count for package ${tourPackageId}: ${err.message}`);
    throw err;
  }
}

module.exports = { incrementTourPackageBookingCount };
