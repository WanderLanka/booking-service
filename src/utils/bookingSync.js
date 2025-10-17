/**
 * Helper functions for syncing booking data with Guide Service
 */

const logger = require('./logger');

/**
 * Update tour package booking count in guide-service
 * @param {string} packageId - Tour package ID
 * @param {number} increment - Number to increment (can be negative for decrement)
 */
async function updatePackageBookingCount(packageId, increment = 1) {
  try {
    const GUIDE_SERVICE_URL = process.env.GUIDE_SERVICE_URL || 'http://localhost:3005';
    const endpoint = `${GUIDE_SERVICE_URL}/tourpackages/${packageId}/booking-count`;
    
    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ increment }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.warn(`Failed to update booking count for package ${packageId}: ${errorText}`);
      return false;
    }
    
    const result = await response.json();
    logger.info(`Updated booking count for package ${packageId}: ${increment > 0 ? '+' : ''}${increment}`);
    return true;
  } catch (error) {
    logger.error(`Error updating booking count for package ${packageId}:`, error);
    return false;
  }
}

/**
 * Fetch tour package details from guide-service
 * @param {string} packageId - Tour package ID
 */
async function fetchPackageDetails(packageId) {
  try {
    const GUIDE_SERVICE_URL = process.env.GUIDE_SERVICE_URL || 'http://localhost:3005';
    const endpoint = `${GUIDE_SERVICE_URL}/tourpackages/${packageId}`;
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch package details: ${response.status}`);
    }
    
    const result = await response.json();
    return result.data || result;
  } catch (error) {
    logger.error(`Error fetching package details for ${packageId}:`, error);
    throw error;
  }
}

/**
 * Check guide availability for a date range
 * @param {string} guideId - Guide ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {string} excludeBookingId - Booking ID to exclude (for updates)
 */
async function checkGuideAvailability(guideId, startDate, endDate, excludeBookingId = null) {
  try {
    const TourPackageBooking = require('../models/TourPackageBooking');
    
    const query = {
      guideId,
      status: { $in: ['pending', 'confirmed', 'in_progress'] },
      $or: [
        { startDate: { $lt: new Date(endDate) }, endDate: { $gt: new Date(startDate) } },
      ],
    };
    
    if (excludeBookingId) {
      query._id = { $ne: excludeBookingId };
    }
    
    const overlapping = await TourPackageBooking.findOne(query);
    
    return {
      available: !overlapping,
      conflict: overlapping ? {
        bookingId: overlapping._id,
        packageTitle: overlapping.packageTitle,
        startDate: overlapping.startDate,
        endDate: overlapping.endDate,
      } : null,
    };
  } catch (error) {
    logger.error('Error checking guide availability:', error);
    throw error;
  }
}

/**
 * Sync booking status with guide service (for guide's schedule)
 */
async function syncBookingWithGuide(booking, action = 'create') {
  try {
    const GUIDE_SERVICE_URL = process.env.GUIDE_SERVICE_URL || 'http://localhost:3005';
    const endpoint = `${GUIDE_SERVICE_URL}/guide/${booking.guideId}/bookings/sync`;
    
    const payload = {
      bookingId: booking._id.toString(),
      action, // 'create', 'update', 'cancel'
      startDate: booking.startDate,
      endDate: booking.endDate,
      packageId: booking.packageId,
      status: booking.status,
    };
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      logger.warn(`Failed to sync booking with guide service: ${response.status}`);
      return false;
    }
    
    logger.info(`Synced booking ${booking._id} with guide service (action: ${action})`);
    return true;
  } catch (error) {
    logger.error('Error syncing booking with guide:', error);
    return false;
  }
}

module.exports = {
  updatePackageBookingCount,
  fetchPackageDetails,
  checkGuideAvailability,
  syncBookingWithGuide,
};
