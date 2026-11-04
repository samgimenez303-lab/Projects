const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const {
  generateRandomToken,
  hashToken,
  sanitizeUser,
  sendResponse
} = require('../utils/helpers');
const {
  sendVerificationEmail,
  sendPasswordResetEmail
} = require('../config/email');

/**
 * Generate JWT token for an authenticated user
 */
const generateJwt = (user) => {
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-picklebook-2024-change-in-production';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    secret,
    { expiresIn }
  );
};

/**
 * Register a new customer
 */
const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return sendResponse(res, 400, {
        success: false,
        message: 'An account with this email address already exists.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'customer',
      phone: phone || null,
      email_verified: 0
    });

    // Generate email verification token (UUID -> SHA256)
    const rawToken = generateRandomToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await User.createEmailVerificationToken(newUser.id, tokenHash, expiresAt);

    // Send verification email
    await sendVerificationEmail(newUser.email, newUser.name, rawToken);

    await AuditLog.log({
      userId: newUser.id,
      action: 'user_register',
      entityType: 'user',
      entityId: newUser.id,
      ipAddress: req.ip
    });

    return sendResponse(res, 201, {
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      data: {
        user: sanitizeUser(newUser)
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Server error during registration. Please try again.'
    });
  }
};

/**
 * User login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findByEmail(email);
    if (!user) {
      return sendResponse(res, 401, {
        success: false,
        message: 'Invalid email or password.'
      });
    }

    if (!user.is_active) {
      return sendResponse(res, 403, {
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendResponse(res, 401, {
        success: false,
        message: 'Invalid email or password.'
      });
    }

    await User.updateLastLogin(user.id);
    const token = generateJwt(user);

    await AuditLog.log({
      userId: user.id,
      action: 'user_login',
      entityType: 'user',
      entityId: user.id,
      ipAddress: req.ip
    });

    return sendResponse(res, 200, {
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: sanitizeUser(user)
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Server error during login.'
    });
  }
};

/**
 * Verify user's email address
 */
const verifyEmail = async (req, res) => {
  try {
    const rawToken = req.query.token || req.body.token;

    if (!rawToken) {
      return sendResponse(res, 400, {
        success: false,
        message: 'Verification token is required.'
      });
    }

    const tokenHash = hashToken(rawToken);
    const tokenRecord = await User.findEmailVerificationToken(tokenHash);

    if (!tokenRecord) {
      return sendResponse(res, 400, {
        success: false,
        message: 'Invalid or expired verification token.'
      });
    }

    await User.setEmailVerified(tokenRecord.user_id, 1);
    await User.markEmailVerificationTokenUsed(tokenRecord.id);

    await AuditLog.log({
      userId: tokenRecord.user_id,
      action: 'email_verified',
      entityType: 'user',
      entityId: tokenRecord.user_id,
      ipAddress: req.ip
    });

    return sendResponse(res, 200, {
      success: true,
      message: 'Email address successfully verified! You may now access all features.'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Server error during email verification.'
    });
  }
};

/**
 * Resend email verification link
 */
const resendVerification = async (req, res) => {
  try {
    const email = req.body.email || (req.user && req.user.email);

    if (!email) {
      return sendResponse(res, 400, {
        success: false,
        message: 'Email address is required.'
      });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return sendResponse(res, 200, {
        success: true,
        message: 'If the account exists, a new verification email has been sent.'
      });
    }

    if (user.email_verified) {
      return sendResponse(res, 400, {
        success: false,
        message: 'This account email is already verified.'
      });
    }

    const rawToken = generateRandomToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await User.createEmailVerificationToken(user.id, tokenHash, expiresAt);
    await sendVerificationEmail(user.email, user.name, rawToken);

    return sendResponse(res, 200, {
      success: true,
      message: 'Verification email has been resent.'
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Server error while resending verification email.'
    });
  }
};

/**
 * Request password reset link
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findByEmail(email);
    if (user && user.is_active) {
      const rawToken = generateRandomToken();
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await User.createPasswordResetToken(user.id, tokenHash, expiresAt);
      await sendPasswordResetEmail(user.email, user.name, rawToken);

      await AuditLog.log({
        userId: user.id,
        action: 'forgot_password_requested',
        entityType: 'user',
        entityId: user.id,
        ipAddress: req.ip
      });
    }

    return sendResponse(res, 200, {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Server error during password reset request.'
    });
  }
};

/**
 * Reset password with valid token
 */
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const tokenHash = hashToken(token);
    const tokenRecord = await User.findPasswordResetToken(tokenHash);

    if (!tokenRecord) {
      return sendResponse(res, 400, {
        success: false,
        message: 'Password reset link is invalid or has expired.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.updatePassword(tokenRecord.user_id, hashedPassword);
    await User.markPasswordResetTokenUsed(tokenRecord.id);

    await AuditLog.log({
      userId: tokenRecord.user_id,
      action: 'password_reset_completed',
      entityType: 'user',
      entityId: tokenRecord.user_id,
      ipAddress: req.ip
    });

    return sendResponse(res, 200, {
      success: true,
      message: 'Password has been successfully reset! You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Server error while resetting password.'
    });
  }
};

/**
 * Get currently authenticated user profile
 */
const me = async (req, res) => {
  try {
    return sendResponse(res, 200, {
      success: true,
      data: {
        user: sanitizeUser(req.user)
      }
    });
  } catch (error) {
    console.error('Me controller error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Server error fetching user profile.'
    });
  }
};

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  me
};
