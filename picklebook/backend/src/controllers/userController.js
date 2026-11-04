const bcrypt = require('bcrypt');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { sanitizeUser, sendResponse } = require('../utils/helpers');

/**
 * Get profile of current logged-in user
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    return sendResponse(res, 200, {
      success: true,
      data: { user: sanitizeUser(user) }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve profile.'
    });
  }
};

/**
 * Update profile of current logged-in user
 */
const updateProfile = async (req, res) => {
  try {
    const { name, phone, avatar_url } = req.body;
    const updated = await User.update(req.user.id, {
      name,
      phone,
      avatar_url
    });

    await AuditLog.log({
      userId: req.user.id,
      action: 'profile_update',
      entityType: 'user',
      entityId: req.user.id,
      ipAddress: req.ip
    });

    return sendResponse(res, 200, {
      success: true,
      message: 'Profile updated successfully.',
      data: { user: sanitizeUser(updated) }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to update profile.'
    });
  }
};

/**
 * Change password of current logged-in user
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByEmail(req.user.email);

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return sendResponse(res, 400, {
        success: false,
        message: 'Current password does not match.'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.updatePassword(user.id, hashedPassword);

    await AuditLog.log({
      userId: req.user.id,
      action: 'password_change',
      entityType: 'user',
      entityId: req.user.id,
      ipAddress: req.ip
    });

    return sendResponse(res, 200, {
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (error) {
    console.error('Change password error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to change password.'
    });
  }
};

/**
 * Get all users (Admin only)
 */
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', role = '', is_active = '' } = req.query;

    const result = await User.findAll({
      page,
      limit,
      search,
      role,
      is_active
    });

    result.users = result.users.map(sanitizeUser);

    return sendResponse(res, 200, {
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get all users error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve users.'
    });
  }
};

/**
 * Get user by ID (Admin only)
 */
const getUserById = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const user = await User.findById(userId);

    if (!user) {
      return sendResponse(res, 404, {
        success: false,
        message: 'User not found.'
      });
    }

    return sendResponse(res, 200, {
      success: true,
      data: { user: sanitizeUser(user) }
    });
  } catch (error) {
    console.error('Get user by id error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve user.'
    });
  }
};

/**
 * Create a new user (Admin only)
 */
const createUser = async (req, res) => {
  try {
    const { name, email, password, role, phone, email_verified } = req.body;

    const existing = await User.findByEmail(email);
    if (existing) {
      return sendResponse(res, 400, {
        success: false,
        message: 'A user with this email already exists.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'customer',
      phone: phone || null,
      email_verified: email_verified ? 1 : 0
    });

    await AuditLog.log({
      userId: req.user.id,
      action: 'admin_create_user',
      entityType: 'user',
      entityId: newUser.id,
      details: { role: newUser.role, email: newUser.email },
      ipAddress: req.ip
    });

    return sendResponse(res, 201, {
      success: true,
      message: 'User created successfully.',
      data: { user: sanitizeUser(newUser) }
    });
  } catch (error) {
    console.error('Create user error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to create user.'
    });
  }
};

/**
 * Update user (Admin only)
 */
const updateUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const existing = await User.findById(userId);

    if (!existing) {
      return sendResponse(res, 404, {
        success: false,
        message: 'User not found.'
      });
    }

    const { name, phone, role, is_active, email_verified, password } = req.body;

    const fieldsToUpdate = {};
    if (name !== undefined) fieldsToUpdate.name = name;
    if (phone !== undefined) fieldsToUpdate.phone = phone;
    if (role !== undefined) fieldsToUpdate.role = role;
    if (is_active !== undefined) fieldsToUpdate.is_active = is_active;
    if (email_verified !== undefined) fieldsToUpdate.email_verified = email_verified;

    const updated = await User.update(userId, fieldsToUpdate);

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await User.updatePassword(userId, hashedPassword);
    }

    await AuditLog.log({
      userId: req.user.id,
      action: 'admin_update_user',
      entityType: 'user',
      entityId: userId,
      details: fieldsToUpdate,
      ipAddress: req.ip
    });

    return sendResponse(res, 200, {
      success: true,
      message: 'User updated successfully.',
      data: { user: sanitizeUser(updated) }
    });
  } catch (error) {
    console.error('Update user error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to update user.'
    });
  }
};

/**
 * Delete user (Admin only)
 */
const deleteUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);

    if (userId === req.user.id) {
      return sendResponse(res, 400, {
        success: false,
        message: 'You cannot delete your own account.'
      });
    }

    const deleted = await User.delete(userId);
    if (!deleted) {
      return sendResponse(res, 404, {
        success: false,
        message: 'User not found.'
      });
    }

    await AuditLog.log({
      userId: req.user.id,
      action: 'admin_delete_user',
      entityType: 'user',
      entityId: userId,
      ipAddress: req.ip
    });

    return sendResponse(res, 200, {
      success: true,
      message: 'User deleted successfully.'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to delete user. The user may have associated reservations or payments.'
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};
