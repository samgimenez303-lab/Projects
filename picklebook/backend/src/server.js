require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { testConnection } = require('./config/db');
const { apiLimiter } = require('./middleware/rateLimiter');
const { sendResponse } = require('./utils/helpers');
const { startGameReminders } = require('./services/gameReminders');

// Import routes
const authRoutes = require('./routes/auth');
const courtRoutes = require('./routes/courts');
const serviceRoutes = require('./routes/services');
const reservationRoutes = require('./routes/reservations');
const paymentRoutes = require('./routes/payments');
const userRoutes = require('./routes/users');
const dashboardRoutes = require('./routes/dashboard');
const contactRoutes = require('./routes/contact');
const notificationRoutes = require('./routes/notifications');
const reportRoutes = require('./routes/reports');
const staffRoutes = require('./routes/staff');
const settingsRoutes = require('./routes/settings');
const playerRoutes = require('./routes/players');

const app = express();
const PORT = process.env.PORT || 5000;

// =================== SECURITY & CORE MIDDLEWARE ===================
app.use(helmet());

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({
  origin: [frontendUrl, 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply general rate limiting to all /api routes
app.use('/api', apiLimiter);

// =================== HEALTH CHECK ===================
app.get('/api/health', (req, res) => {
  return sendResponse(res, 200, {
    success: true,
    message: 'PickleBook API is running smoothly.',
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// =================== API ROUTE MOUNTING ===================
app.use('/api/auth', authRoutes);
app.use('/api/courts', courtRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/players', playerRoutes);

// =================== 404 HANDLER ===================
app.use((req, res) => {
  return sendResponse(res, 404, {
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`
  });
});

// =================== GLOBAL ERROR HANDLER ===================
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);

  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal server error. Please try again later.'
    : err.message || 'An unexpected error occurred.';

  return sendResponse(res, statusCode, {
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// =================== SERVER INITIALIZATION ===================
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, async () => {
    console.log(`PickleBook API server listening on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    await testConnection();
    if (server.listening) {
      const stopReminders = startGameReminders();
      server.once('close', stopReminders);
    }
  });
}

module.exports = app;
