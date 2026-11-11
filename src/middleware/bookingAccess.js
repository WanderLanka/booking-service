const axios = require('axios');
const mongoose = require('mongoose');
const Booking = require('../models/TourPackageBooking');
const config = require('../config');

async function ownedGuide(userId) {
  const response = await axios.get(`${config.guideServiceUrl}/guide/get`, { params: { userId }, timeout: 5000 });
  return response.data?.data;
}

module.exports = async function bookingAccess(req, res, next) {
  try {
    const action = req.path.split('/')[1];
    if (action === 'create') {
      req.body.userId = req.user.userId;
      return next();
    }
    if (action === 'list') {
      if (req.user.role === 'guide') {
        const guide = await ownedGuide(req.user.userId);
        if (!guide || String(guide.userId) !== String(req.user.userId)) return res.sendStatus(403);
        req.query.guideId = String(guide._id);
        delete req.query.userId;
      } else {
        req.query.userId = req.user.userId;
        delete req.query.guideId;
      }
      return next();
    }
    const id = req.path.split('/')[2];
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, error: 'Invalid booking id' });
    const booking = await Booking.findById(id).lean();
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });
    const customer = String(booking.userId) === String(req.user.userId);
    let guideOwner = false;
    if (req.user.role === 'guide') {
      const guide = await ownedGuide(req.user.userId);
      guideOwner = guide && String(guide.userId) === String(req.user.userId) && String(guide._id) === String(booking.guideId);
    }
    const permitted = ['approve', 'decline', 'complete'].includes(action) ? guideOwner : action === 'get' ? customer || guideOwner : customer;
    if (!permitted) return res.status(403).json({ success: false, error: 'Booking access denied' });
    return next();
  } catch (error) {
    if (error.isAxiosError) return res.status(503).json({ success: false, error: 'Guide authorization unavailable' });
    return next(error);
  }
};
