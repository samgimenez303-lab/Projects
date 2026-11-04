const Court = require('../models/Court');
const AuditLog = require('../models/AuditLog');
const { sendResponse } = require('../utils/helpers');
const { facilityNow } = require('../utils/bookingPolicy');

/**
 * Get all courts
 */
const getAllCourts = async (req, res) => {
  try {
    // If user is guest/customer, only show active courts
    let isActiveFilter = 1;
    if (req.user && ['admin', 'staff'].includes(req.user.role)) {
      isActiveFilter = req.query.is_active !== undefined ? req.query.is_active : null;
    }

    const courts = await Court.findAll({ is_active: isActiveFilter });
    return sendResponse(res, 200, {
      success: true,
      data: { courts }
    });
  } catch (error) {
    console.error('Get courts error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve courts.'
    });
  }
};

/**
 * Get single court by ID
 */
const getCourtById = async (req, res) => {
  try {
    const courtId = parseInt(req.params.id, 10);
    const court = await Court.findById(courtId);

    if (!court) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Court not found.'
      });
    }

    return sendResponse(res, 200, {
      success: true,
      data: { court }
    });
  } catch (error) {
    console.error('Get court by id error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve court details.'
    });
  }
};

/**
 * Check court availability for a specific date
 */
const getCourtAvailability = async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.id) || Number(req.params.id) < 1) return sendResponse(res, 400, { success: false, message: 'Choose a valid court.' });
    const courtId = parseInt(req.params.id, 10);
    const date = req.query.date || facilityNow().date;

    const availability = await Court.getAvailability(courtId, date);
    if (!availability) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Court not found.'
      });
    }

    return sendResponse(res, 200, {
      success: true,
      data: availability
    });
  } catch (error) {
    console.error('Get availability error:', error);
    return sendResponse(res, error.statusCode || 500, {
      success: false,
      message: error.statusCode ? error.message : 'Failed to retrieve court availability.'
    });
  }
};

/**
 * Create court (Admin only)
 */
const createCourt = async (req, res) => {
  try {
    const court = await Court.create(req.body);

    await AuditLog.log({
      userId: req.user.id,
      action: 'court_create',
      entityType: 'court',
      entityId: court.id,
      details: req.body,
      ipAddress: req.ip
    });

    return sendResponse(res, 201, {
      success: true,
      message: 'Court created successfully.',
      data: { court }
    });
  } catch (error) {
    console.error('Create court error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to create court.'
    });
  }
};

/**
 * Update court (Admin only)
 */
const updateCourt = async (req, res) => {
  try {
    const courtId = parseInt(req.params.id, 10);
    const existing = await Court.findById(courtId);
    if (!existing) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Court not found.'
      });
    }

    const updated = await Court.update(courtId, req.body);

    await AuditLog.log({
      userId: req.user.id,
      action: 'court_update',
      entityType: 'court',
      entityId: courtId,
      details: req.body,
      ipAddress: req.ip
    });

    return sendResponse(res, 200, {
      success: true,
      message: 'Court updated successfully.',
      data: { court: updated }
    });
  } catch (error) {
    console.error('Update court error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to update court.'
    });
  }
};

/**
 * Delete court (Admin only)
 */
const deleteCourt = async (req, res) => {
  try {
    const courtId = parseInt(req.params.id, 10);
    const deleted = await Court.delete(courtId);

    if (!deleted) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Court not found.'
      });
    }

    await AuditLog.log({
      userId: req.user.id,
      action: 'court_delete',
      entityType: 'court',
      entityId: courtId,
      ipAddress: req.ip
    });

    return sendResponse(res, 200, {
      success: true,
      message: 'Court deleted successfully.'
    });
  } catch (error) {
    console.error('Delete court error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to delete court. Please check if there are associated reservations.'
    });
  }
};

/**
 * Get operating hours for a court
 */
const getOperatingHours = async (req, res) => {
  try {
    const courtId = parseInt(req.params.id, 10);
    const hours = await Court.getOperatingHours(courtId);
    return sendResponse(res, 200, {
      success: true,
      data: { operating_hours: hours }
    });
  } catch (error) {
    console.error('Get operating hours error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve operating hours.'
    });
  }
};

/**
 * Update operating hours for a court (Admin only)
 */
const updateOperatingHours = async (req, res) => {
  try {
    const courtId = parseInt(req.params.id, 10);
    const { hours } = req.body;

    if (!Array.isArray(hours)) {
      return sendResponse(res, 400, {
        success: false,
        message: 'Hours array is required.'
      });
    }

    const updated = await Court.setOperatingHours(courtId, hours);

    await AuditLog.log({
      userId: req.user.id,
      action: 'court_hours_update',
      entityType: 'court',
      entityId: courtId,
      details: { hours },
      ipAddress: req.ip
    });

    return sendResponse(res, 200, {
      success: true,
      message: 'Operating hours updated successfully.',
      data: { operating_hours: updated }
    });
  } catch (error) {
    console.error('Update operating hours error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to update operating hours.'
    });
  }
};

/**
 * Get court closures
 */
const getClosures = async (req, res) => {
  try {
    const courtId = req.params.id ? parseInt(req.params.id, 10) : null;
    const { startDate, endDate } = req.query;

    const closures = await Court.getClosures(courtId, startDate, endDate);
    return sendResponse(res, 200, {
      success: true,
      data: { closures }
    });
  } catch (error) {
    console.error('Get closures error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve closures.'
    });
  }
};

/**
 * Add a closure (Admin / Staff)
 */
const addClosure = async (req, res) => {
  try {
    const { court_id, closure_date, reason } = req.body;

    if (!closure_date) {
      return sendResponse(res, 400, {
        success: false,
        message: 'Closure date is required.'
      });
    }

    const closureId = await Court.addClosure({
      court_id: court_id || null,
      closure_date,
      reason: reason || null,
      created_by: req.user.id
    });

    await AuditLog.log({
      userId: req.user.id,
      action: 'closure_create',
      entityType: 'court_closure',
      entityId: closureId,
      details: { court_id, closure_date, reason },
      ipAddress: req.ip
    });

    return sendResponse(res, 201, {
      success: true,
      message: 'Court closure scheduled successfully.',
      data: { closure_id: closureId }
    });
  } catch (error) {
    console.error('Add closure error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to schedule closure.'
    });
  }
};

/**
 * Delete a closure (Admin / Staff)
 */
const deleteClosure = async (req, res) => {
  try {
    const closureId = parseInt(req.params.closureId, 10);
    const deleted = await Court.deleteClosure(closureId);

    if (!deleted) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Closure not found.'
      });
    }

    await AuditLog.log({
      userId: req.user.id,
      action: 'closure_delete',
      entityType: 'court_closure',
      entityId: closureId,
      ipAddress: req.ip
    });

    return sendResponse(res, 200, {
      success: true,
      message: 'Closure removed successfully.'
    });
  } catch (error) {
    console.error('Delete closure error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to remove closure.'
    });
  }
};

/**
 * Add image to court (Admin only)
 */
const addCourtImage = async (req, res) => {
  try {
    const courtId = parseInt(req.params.id, 10);
    const { image_url, alt_text, is_primary, sort_order } = req.body;

    if (!image_url) {
      return sendResponse(res, 400, {
        success: false,
        message: 'Image URL is required.'
      });
    }

    const imageId = await Court.addImage(courtId, image_url, alt_text, is_primary, sort_order);

    return sendResponse(res, 201, {
      success: true,
      message: 'Image added successfully.',
      data: { image_id: imageId }
    });
  } catch (error) {
    console.error('Add image error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to add image.'
    });
  }
};

/**
 * Delete court image (Admin only)
 */
const deleteCourtImage = async (req, res) => {
  try {
    const imageId = parseInt(req.params.imageId, 10);
    const deleted = await Court.deleteImage(imageId);

    if (!deleted) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Image not found.'
      });
    }

    return sendResponse(res, 200, {
      success: true,
      message: 'Image removed successfully.'
    });
  } catch (error) {
    console.error('Delete image error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to delete image.'
    });
  }
};

/**
 * Set primary image for court (Admin only)
 */
const setPrimaryCourtImage = async (req, res) => {
  try {
    const courtId = parseInt(req.params.id, 10);
    const imageId = parseInt(req.params.imageId, 10);

    await Court.setPrimaryImage(courtId, imageId);

    return sendResponse(res, 200, {
      success: true,
      message: 'Primary image updated.'
    });
  } catch (error) {
    console.error('Set primary image error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to set primary image.'
    });
  }
};

module.exports = {
  getAllCourts,
  getCourtById,
  getCourtAvailability,
  createCourt,
  updateCourt,
  deleteCourt,
  getOperatingHours,
  updateOperatingHours,
  getClosures,
  addClosure,
  deleteClosure,
  addCourtImage,
  deleteCourtImage,
  setPrimaryCourtImage
};
