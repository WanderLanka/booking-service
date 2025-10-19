const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');

const auth = (req, res, next) => {
  console.log('🔐 Booking Service Auth Middleware - Incoming request:', {
    method: req.method,
    url: req.url,
    path: req.path,
    headers: {
      authorization: req.headers['authorization'] ? 'Present' : 'Missing',
      'x-platform': req.headers['x-platform']
    }
  });
  
  const header = req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    console.log('❌ No token provided to booking service');
    return res.status(401).json({ 
      success: false, 
      message: 'No token provided',
      error: 'Access token required',
      code: 'AUTH_TOKEN_MISSING'
    });
  }

  console.log('🔍 Booking Service verifying token...');
  console.log('JWT Secret being used:', jwtSecret);
  console.log('Token (first 50 chars):', token.substring(0, 50) + '...');

  try {
    const decoded = jwt.verify(token, jwtSecret);
    console.log('✅ Token verified successfully in booking service, user:', {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
      platform: decoded.platform
    });
    req.user = decoded;
    return next();
  } catch (err) {
    console.log('❌ Token verification failed in booking service:', {
      error: err.message,
      name: err.name,
      expiredAt: err.expiredAt
    });
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid token',
      error: 'Invalid or expired token',
      code: 'AUTH_TOKEN_INVALID'
    });
  }
};

module.exports = auth;
