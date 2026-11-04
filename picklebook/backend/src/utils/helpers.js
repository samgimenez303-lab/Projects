const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate a unique reservation reference number: e.g. PB-A1B2C3
 */
const generateRefNumber = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'PB-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Generate a cryptographically secure random token (using UUID v4)
 */
const generateRandomToken = () => {
  return uuidv4();
};

/**
 * Create a SHA-256 hash of a string token
 * @param {string} token 
 * @returns {string} hex digest
 */
const hashToken = (token) => {
  if (!token) return null;
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Calculate duration in hours between two times formatted as HH:mm:ss or HH:mm
 * @param {string} startTime '08:00:00' or '08:00'
 * @param {string} endTime '10:30:00' or '10:30'
 * @returns {number} hours e.g. 2.5
 */
const calculateDurationHours = (startTime, endTime) => {
  const [startH, startM = 0] = startTime.split(':').map(Number);
  const [endH, endM = 0] = endTime.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const diffMinutes = endMinutes - startMinutes;
  if (diffMinutes <= 0) {
    return 0;
  }
  return parseFloat((diffMinutes / 60).toFixed(2));
};

/**
 * Check if two time intervals overlap
 * Overlap exists if (startA < endB && endA > startB)
 */
const isTimeOverlapping = (startA, endA, startB, endB) => {
  return startA < endB && endA > startB;
};

/**
 * Sanitize user object to never leak passwords or private tokens
 * @param {object} user 
 * @returns {object} sanitized user
 */
const sanitizeUser = (user) => {
  if (!user) return null;
  const safe = { ...user };
  delete safe.password;
  delete safe.token_hash;
  return safe;
};

/**
 * Send standard API response format
 */
const sendResponse = (res, statusCode, { success = true, message = '', data = null, meta = null, errors = null }) => {
  const responseBody = {
    success,
    message,
    ...(data !== null && { data }),
    ...(meta !== null && { meta }),
    ...(errors !== null && { errors })
  };
  return res.status(statusCode).json(responseBody);
};

module.exports = {
  generateRefNumber,
  generateRandomToken,
  hashToken,
  calculateDurationHours,
  isTimeOverlapping,
  sanitizeUser,
  sendResponse
};
