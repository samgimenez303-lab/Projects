const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { sendResponse } = require('../utils/helpers');

/**
 * Middleware to authenticate requests using JWT Bearer token
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendResponse(res, 401, {
        success: false,
        message: 'Authentication token required.'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return sendResponse(res, 401, {
        success: false,
        message: 'Invalid authentication header format.'
      });
    }

    const secret = process.env.JWT_SECRET || 'dev-jwt-secret-picklebook-2024-change-in-production';
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return sendResponse(res, 401, {
          success: false,
          message: 'Authentication token has expired. Please log in again.'
        });
      }
      return sendResponse(res, 401, {
        success: false,
        message: 'Invalid authentication token.'
      });
    }

    // Verify user exists and is active in database
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, phone, avatar_url, email_verified, is_active FROM users WHERE id = ?',
      [decoded.id]
    );

    if (rows.length === 0) {
      return sendResponse(res, 401, {
        success: false,
        message: 'User account no longer exists.'
      });
    }

    const user = rows[0];
    if (!user.is_active) {
      return sendResponse(res, 403, {
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Server error during authentication.'
    });
  }
};

/**
 * Middleware to authorize specific roles (e.g. authorize('admin'), authorize('staff', 'admin'))
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendResponse(res, 401, {
        success: false,
        message: 'Unauthorized. Please sign in.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return sendResponse(res, 403, {
        success: false,
        message: 'Forbidden. You do not have permission to perform this action.'
      });
    }

    next();
  };
};

/**
 * Optional authentication: attaches user if token is valid, continues as guest if not
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      req.user = null;
      return next();
    }

    const secret = process.env.JWT_SECRET || 'dev-jwt-secret-picklebook-2024-change-in-production';
    const decoded = jwt.verify(token, secret);

    const [rows] = await pool.execute(
      'SELECT id, name, email, role, email_verified, is_active FROM users WHERE id = ?',
      [decoded.id]
    );

    if (rows.length > 0 && rows[0].is_active) {
      req.user = rows[0];
    } else {
      req.user = null;
    }
    next();
  } catch (err) {
    req.user = null;
    next();
  }
};

/**
 * Ensure the authenticated user has verified their email address
 */
const requireEmailVerified = (req, res, next) => {
  if (!req.user) {
    return sendResponse(res, 401, {
      success: false,
      message: 'Unauthorized.'
    });
  }

  if (!req.user.email_verified) {
    return sendResponse(res, 403, {
      success: false,
      message: 'Please verify your email address to continue.'
    });
  }

  next();
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth,
  requireEmailVerified
};
