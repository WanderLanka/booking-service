const TourPackageBooking = require('../../models/TourPackageBooking');
const logger = require('../../utils/logger');

module.exports = async (req, res) => {
  try {
    const { 
      packageId, 
      userId, 
      guideId,
      status, 
      startDate,
      endDate,
      paymentStatus,
      role, // 'traveler' or 'guide' - determines which bookings to show
      page = 1,
      limit = 20,
      sort = '-createdAt',
    } = req.query;

    const requestingUserId = req.user?.id;
    const requestingUserRole = req.user?.role;

    logger.info(`List bookings request by user ${requestingUserId}, role: ${requestingUserRole}`);

    // Build filter
    const filter = {};
    
    // Role-based filtering
    if (role === 'traveler' || (!role && !guideId)) {
      // Show bookings made by this user (as a traveler)
      filter.userId = requestingUserId;
    } else if (role === 'guide' || guideId) {
      // Show bookings for tours guided by this user
      filter.guideId = guideId || requestingUserId;
    }

    // Admin can see all bookings
    if (requestingUserRole === 'admin' || requestingUserRole === 'Sysadmin') {
      delete filter.userId;
      delete filter.guideId;
      
      // Admin can filter by specific user or guide
      if (userId) filter.userId = userId;
      if (guideId) filter.guideId = guideId;
    }

    // Additional filters
    if (packageId) filter.packageId = packageId;
    if (status) {
      filter.status = status.includes(',') 
        ? { $in: status.split(',') } 
        : status;
    }
    if (paymentStatus) filter['payment.status'] = paymentStatus;
    
    // Date range filters
    if (startDate || endDate) {
      filter.startDate = {};
      if (startDate) filter.startDate.$gte = new Date(startDate);
      if (endDate) filter.startDate.$lte = new Date(endDate);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Execute query
    const [bookings, total] = await Promise.all([
      TourPackageBooking
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      TourPackageBooking.countDocuments(filter),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limitNum);
    const hasMore = page < totalPages;

    logger.info(`Found ${bookings.length} bookings (total: ${total})`);

    return res.json({ 
      success: true, 
      data: bookings,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        totalPages,
        hasMore,
      },
    });
  } catch (err) {
    logger.error('List bookings error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to list bookings',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};
