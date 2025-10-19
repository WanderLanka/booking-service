const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const authMiddleware = (req, res, next) => {
  try {
    console.log('🔐 Auth middleware - Enhanced booking service');
    console.log('Headers:', {
      authorization: req.headers.authorization ? 'Bearer [TOKEN]' : 'Missing',
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']?.substring(0, 50)
    });

    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      console.log('❌ No token provided in enhanced booking request');
      return res.status(401).json({
        success: false,
        message: 'No authentication token provided'
      });
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error('❌ JWT_SECRET not configured in enhanced booking service');
      return res.status(500).json({
        success: false,
        message: 'Authentication configuration error'
      });
    }

    console.log('🔍 Verifying token with secret:', JWT_SECRET.substring(0, 10) + '...');

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ Token verified successfully for enhanced booking:', {
      userId: decoded.userId,
      email: decoded.email,
      iat: new Date(decoded.iat * 1000).toISOString(),
      exp: new Date(decoded.exp * 1000).toISOString()
    });

    req.user = decoded;
    next();

  } catch (error) {
    console.error('❌ Enhanced booking authentication failed:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({
        error: 'Token has expired',
        code: 'AUTH_TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        error: 'Invalid or expired token',
        code: 'AUTH_TOKEN_INVALID'
      });
    }

    logger.error('Enhanced booking auth middleware error:', error);
    res.status(403).json({
      error: 'Invalid or expired token',
      code: 'AUTH_TOKEN_INVALID'
    });
  }
};

module.exports = authMiddleware;