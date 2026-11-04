const Service = require('../models/Service');
const AuditLog = require('../models/AuditLog');
const { sendResponse } = require('../utils/helpers');

/**
 * Get all services
 */
const getAllServices = async (req, res) => {
  try {
    let isActiveFilter = 1;
    if (req.user && ['admin', 'staff'].includes(req.user.role)) {
      isActiveFilter = req.query.is_active !== undefined ? req.query.is_active : null;
    }

    const { category } = req.query;
    if (category && !['indoor', 'outdoor'].includes(category)) {
      return sendResponse(res, 400, { success: false, message: 'Service category must be indoor or outdoor.' });
    }
    if (req.query.is_active !== undefined && !['0', '1'].includes(String(req.query.is_active))) {
      return sendResponse(res, 400, { success: false, message: 'is_active must be 0 or 1.' });
    }
    const services = await Service.findAll({
      is_active: isActiveFilter,
      category: category || null
    });

    return sendResponse(res, 200, {
      success: true,
      data: { services }
    });
  } catch (error) {
    console.error('Get services error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve services.'
    });
  }
};

/**
 * Get service by ID
 */
const getServiceById = async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id, 10);
    const service = await Service.findById(serviceId);

    const canViewInactive = req.user && ['admin', 'staff'].includes(req.user.role);
    if (!service || service.legacy_category || (!service.is_active && !canViewInactive)) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Service not found.'
      });
    }

    return sendResponse(res, 200, {
      success: true,
      data: { service }
    });
  } catch (error) {
    console.error('Get service error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve service.'
    });
  }
};

/**
 * Create a new service (Admin only)
 */
const createService = async (req, res) => {
  try {
    const service = await Service.create(req.body);

    await AuditLog.log({
      userId: req.user.id,
      action: 'service_create',
      entityType: 'service',
      entityId: service.id,
      details: req.body,
      ipAddress: req.ip
    });

    return sendResponse(res, 201, {
      success: true,
      message: 'Service created successfully.',
      data: { service }
    });
  } catch (error) {
    console.error('Create service error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to create service.'
    });
  }
};

/**
 * Update service (Admin only)
 */
const updateService = async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id, 10);
    const existing = await Service.findById(serviceId);

    if (!existing || existing.legacy_category) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Service not found.'
      });
    }

    const updated = await Service.update(serviceId, req.body);

    await AuditLog.log({
      userId: req.user.id,
      action: 'service_update',
      entityType: 'service',
      entityId: serviceId,
      details: req.body,
      ipAddress: req.ip
    });

    return sendResponse(res, 200, {
      success: true,
      message: 'Service updated successfully.',
      data: { service: updated }
    });
  } catch (error) {
    console.error('Update service error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to update service.'
    });
  }
};

/**
 * Delete service (Admin only)
 */
const deleteService = async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id, 10);
    const deleted = await Service.delete(serviceId);

    if (!deleted) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Service not found.'
      });
    }

    await AuditLog.log({
      userId: req.user.id,
      action: 'service_delete',
      entityType: 'service',
      entityId: serviceId,
      ipAddress: req.ip
    });

    return sendResponse(res, 200, {
      success: true,
      message: 'Service archived successfully. Historical bookings are preserved.'
    });
  } catch (error) {
    console.error('Delete service error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to delete service. It may be linked to existing reservations.'
    });
  }
};

module.exports = {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  deleteService
};
