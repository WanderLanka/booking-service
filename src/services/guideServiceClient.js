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

async function incrementGuideBookingCount(guideId, increment = 1) {
  const baseUrl = config.guideServiceUrl;
  const url = `${baseUrl}/guide/${guideId}/booking-count`;
  try {
    const res = await axios.patch(url, { increment });
    return res.data;
  } catch (err) {
    logger.warn(`Failed to update booking count for guide ${guideId}: ${err.message}`);
    throw err;
  }
}

async function blockGuideAvailability(guideId, startDate, endDate) {
  const baseUrl = config.guideServiceUrl;
  const url = `${baseUrl}/guide/${guideId}/availability/block`;
  try {
    const res = await axios.post(url, { startDate, endDate });
    return res.data;
  } catch (err) {
    logger.warn(`Failed to block availability for guide ${guideId}: ${err.message}`);
    throw err;
  }
}

module.exports = { 
  incrementTourPackageBookingCount,
  incrementGuideBookingCount,
  blockGuideAvailability,
  /**
   * Update guide response time metric via guide-service
   */
  async updateGuideResponseTime(guideId, responseTimeMs, alpha = 0.3) {
    const baseUrl = config.guideServiceUrl;
    const url = `${baseUrl}/guide/${guideId}/response-time`;
    try {
      const res = await axios.patch(url, { responseTimeMs, alpha });
      return res.data;
    } catch (err) {
      logger.warn(`Failed to update response time for guide ${guideId}: ${err.message}`);
      // Do not throw - metric updates shouldn't break booking flows
      return null;
    }
  }
};
