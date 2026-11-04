const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');
const { authenticate, authorize } = require('../middleware/auth');
const { sendResponse } = require('../utils/helpers');

/**
 * Get all system settings
 * (Public/authenticated can see booking settings and contact info)
 */
router.get('/', async (req, res) => {
  try {
    const settings = await Settings.getAll();
    return sendResponse(res, 200, {
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve settings.'
    });
  }
});

/**
 * Update system settings (Admin only)
 */
router.put('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const settingsPayload = req.body;

    if (!settingsPayload || typeof settingsPayload !== 'object') {
      return sendResponse(res, 400, {
        success: false,
        message: 'Settings object is required.'
      });
    }

    const updated = await Settings.setMany(settingsPayload, req.user.id);

    await AuditLog.log({
      userId: req.user.id,
      action: 'settings_update',
      entityType: 'settings',
      details: settingsPayload,
      ipAddress: req.ip
    });

    return sendResponse(res, 200, {
      success: true,
      message: 'Settings updated successfully.',
      data: updated
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to update settings.'
    });
  }
});

module.exports = router;
