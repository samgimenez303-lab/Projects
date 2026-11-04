const Notification = require('../models/Notification');
const { sendResponse } = require('../utils/helpers');

/**
 * Get current user's notifications
 */
const getUserNotifications = async (req, res) => {
  try {
    const { unreadOnly = 'false', page = 1, limit = 20 } = req.query;

    const result = await Notification.findByUser(req.user.id, {
      unreadOnly: unreadOnly === 'true',
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    });

    return sendResponse(res, 200, {
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve notifications.'
    });
  }
};

/**
 * Get count of unread notifications
 */
const getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Notification.getUnreadCount(req.user.id);
    return sendResponse(res, 200, {
      success: true,
      data: { unread_count: unreadCount }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve unread count.'
    });
  }
};

/**
 * Mark a single notification as read
 */
const markAsRead = async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id, 10);
    const updated = await Notification.markAsRead(notificationId, req.user.id);

    if (!updated) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Notification not found or already read.'
      });
    }

    return sendResponse(res, 200, {
      success: true,
      message: 'Notification marked as read.'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to mark notification as read.'
    });
  }
};

/**
 * Mark all notifications as read for current user
 */
const markAllAsRead = async (req, res) => {
  try {
    const count = await Notification.markAllAsRead(req.user.id);
    return sendResponse(res, 200, {
      success: true,
      message: `${count} notification(s) marked as read.`
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to mark notifications as read.'
    });
  }
};

/**
 * Delete a notification
 */
const deleteNotification = async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id, 10);
    const deleted = await Notification.delete(notificationId, req.user.id);

    if (!deleted) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Notification not found.'
      });
    }

    return sendResponse(res, 200, {
      success: true,
      message: 'Notification deleted.'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to delete notification.'
    });
  }
};

module.exports = {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification
};
