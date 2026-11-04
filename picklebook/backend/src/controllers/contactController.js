const { pool } = require('../config/db');
const AuditLog = require('../models/AuditLog');
const { sendResponse } = require('../utils/helpers');

/**
 * Submit a contact inquiry (Public)
 */
const submitInquiry = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    const [result] = await pool.execute(
      `INSERT INTO contact_inquiries (name, email, phone, subject, message, status)
       VALUES (?, ?, ?, ?, ?, 'new')`,
      [name, email, phone || null, subject, message]
    );

    return sendResponse(res, 201, {
      success: true,
      message: 'Thank you for contacting us! We have received your inquiry and will respond promptly.',
      data: { inquiry_id: result.insertId }
    });
  } catch (error) {
    console.error('Submit contact inquiry error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to submit contact inquiry.'
    });
  }
};

/**
 * Get all contact inquiries (Admin / Staff)
 */
const getAllInquiries = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = '',
      search = ''
    } = req.query;

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (status) {
      conditions.push('ci.status = ?');
      params.push(status);
    }

    if (search) {
      conditions.push('(ci.name LIKE ? OR ci.email LIKE ? OR ci.subject LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT ci.*, u.name as replied_by_name
      FROM contact_inquiries ci
      LEFT JOIN users u ON ci.replied_by = u.id
      ${whereClause}
      ORDER BY ci.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.execute(sql, [...params, Number(limit), Number(offset)]);

    const countSql = `SELECT COUNT(*) as total FROM contact_inquiries ci ${whereClause}`;
    const [countRows] = await pool.execute(countSql, params);

    return sendResponse(res, 200, {
      success: true,
      data: {
        inquiries: rows,
        total: countRows[0].total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(countRows[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get contact inquiries error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve contact inquiries.'
    });
  }
};

/**
 * Get contact inquiry by ID
 */
const getInquiryById = async (req, res) => {
  try {
    const inquiryId = parseInt(req.params.id, 10);
    const [rows] = await pool.execute(
      `SELECT ci.*, u.name as replied_by_name
       FROM contact_inquiries ci
       LEFT JOIN users u ON ci.replied_by = u.id
       WHERE ci.id = ?`,
      [inquiryId]
    );

    if (rows.length === 0) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Inquiry not found.'
      });
    }

    return sendResponse(res, 200, {
      success: true,
      data: { inquiry: rows[0] }
    });
  } catch (error) {
    console.error('Get inquiry error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve inquiry.'
    });
  }
};

/**
 * Update contact inquiry status / notes (Admin / Staff)
 */
const updateInquiryStatus = async (req, res) => {
  try {
    const inquiryId = parseInt(req.params.id, 10);
    const { status, admin_notes } = req.body;

    const validStatuses = ['new', 'read', 'replied', 'closed'];
    if (status && !validStatuses.includes(status)) {
      return sendResponse(res, 400, {
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const updates = [];
    const values = [];

    if (status) {
      updates.push('status = ?');
      values.push(status);
      if (status === 'replied') {
        updates.push('replied_by = ?');
        values.push(req.user.id);
      }
    }

    if (admin_notes !== undefined) {
      updates.push('admin_notes = ?');
      values.push(admin_notes);
    }

    if (updates.length === 0) {
      return sendResponse(res, 400, {
        success: false,
        message: 'No fields provided for update.'
      });
    }

    values.push(inquiryId);
    await pool.execute(
      `UPDATE contact_inquiries SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    await AuditLog.log({
      userId: req.user.id,
      action: 'inquiry_update',
      entityType: 'contact_inquiry',
      entityId: inquiryId,
      details: { status, admin_notes },
      ipAddress: req.ip
    });

    return sendResponse(res, 200, {
      success: true,
      message: 'Inquiry updated successfully.'
    });
  } catch (error) {
    console.error('Update inquiry error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to update inquiry.'
    });
  }
};

/**
 * Delete inquiry (Admin only)
 */
const deleteInquiry = async (req, res) => {
  try {
    const inquiryId = parseInt(req.params.id, 10);
    const [result] = await pool.execute('DELETE FROM contact_inquiries WHERE id = ?', [inquiryId]);

    if (result.affectedRows === 0) {
      return sendResponse(res, 404, {
        success: false,
        message: 'Inquiry not found.'
      });
    }

    await AuditLog.log({
      userId: req.user.id,
      action: 'inquiry_delete',
      entityType: 'contact_inquiry',
      entityId: inquiryId,
      ipAddress: req.ip
    });

    return sendResponse(res, 200, {
      success: true,
      message: 'Inquiry deleted successfully.'
    });
  } catch (error) {
    console.error('Delete inquiry error:', error);
    return sendResponse(res, 500, {
      success: false,
      message: 'Failed to delete inquiry.'
    });
  }
};

module.exports = {
  submitInquiry,
  getAllInquiries,
  getInquiryById,
  updateInquiryStatus,
  deleteInquiry
};
