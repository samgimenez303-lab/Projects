import axios from 'axios';

// Base API URL: In dev Vite proxies /api to http://localhost:5000, or fallback to absolute
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 20000,
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('picklebook_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle auth failures and unpack errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const originalRequest = error.config;
    
    // If token expired / unauthorized
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Don't auto logout if it's already an auth attempt (login/register)
      if (!originalRequest.url.includes('/auth/login') && !originalRequest.url.includes('/auth/register')) {
        localStorage.removeItem('picklebook_token');
        localStorage.removeItem('picklebook_user');
        // Let the application route or reload if needed
        window.dispatchEvent(new Event('auth-unauthorized'));
      }
    }
    
    const message = 
      error.response?.data?.errors?.[0]?.message ||
      error.response?.data?.errors?.[0]?.msg ||
      error.response?.data?.message ||
      error.message || 
      'An unexpected error occurred. Please try again.';
      
    const apiError = new Error(message);
    apiError.response = error.response;
    apiError.status = error.response?.status;
    apiError.code = error.code;
    return Promise.reject(apiError);
  }
);

// Auth Endpoints
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getMe: () => api.get('/auth/me'),
  verifyEmail: (token) => api.post('/auth/verify-email', { token }),
  resendVerification: (email) => api.post('/auth/resend-verification', { email }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  updateProfile: (data) => api.put('/users/profile', data),
  changePassword: (data) => api.put('/users/change-password', data),
};

// Courts Endpoints
export const courtsAPI = {
  getAll: (params) => api.get('/courts', { params }),
  getById: (id) => api.get(`/courts/${id}`),
  getAvailability: (id, date) => api.get(`/courts/${id}/availability`, { params: { date } }),
  create: (data) => api.post('/courts', data),
  update: (id, data) => api.put(`/courts/${id}`, data),
  delete: (id) => api.delete(`/courts/${id}`),
  getOperatingHours: (id) => api.get(`/courts/${id}/operating-hours`),
  updateOperatingHours: (id, data) => api.put(`/courts/${id}/operating-hours`, data),
  getClosures: (courtId) => api.get('/courts/closures', { params: { courtId } }),
  addClosure: (data) => api.post('/courts/closures', data),
  deleteClosure: (closureId) => api.delete(`/courts/closures/${closureId}`),
};

// Indoor and outdoor court service descriptions
export const servicesAPI = {
  getAll: (params) => api.get('/services', { params }),
  getById: (id) => api.get(`/services/${id}`),
  create: (data) => api.post('/services', data),
  update: (id, data) => api.put(`/services/${id}`, data),
  delete: (id) => api.delete(`/services/${id}`),
};

// Reservations Endpoints
export const reservationsAPI = {
  getAll: (params) => api.get('/reservations', { params }),
  getMy: (params) => api.get('/reservations/my', { params }),
  getById: (id) => api.get(`/reservations/${id}`),
  getByRef: (ref) => api.get(`/reservations/ref/${ref}`),
  create: (data) => api.post('/reservations', data),
  cancel: (id, reason) => api.post(`/reservations/${id}/cancel`, { reason }),
  updateStatus: (id, status, notes) => api.put(`/reservations/${id}/status`, { status, notes }),
  getSummaryStats: () => api.get('/reservations/stats'),
};

// Payments Endpoints
export const paymentsAPI = {
  getInstructions: () => api.get('/payments/instructions'),
  create: (data) => api.post('/payments', data),
  getAll: (params) => api.get('/payments', { params }),
  getById: (id) => api.get(`/payments/${id}`),
  getByReservation: (reservationId) => api.get(`/payments/reservation/${reservationId}`),
  submitGCash: (data) => api.post('/payments/gcash', data),
  verify: (id, action, notes) => api.put(`/payments/${id}/verify`, { action, notes }),
};

// Contact inquiries
export const contactAPI = {
  submit: (data) => api.post('/contact', data),
  getAll: (params) => api.get('/contact', { params }),
  getById: (id) => api.get(`/contact/${id}`),
  updateStatus: (id, status, notes) => api.put(`/contact/${id}`, { status, admin_notes: notes }),
};

// Admin & Staff Endpoints
export const adminAPI = {
  getDashboardOverview: (params) => api.get('/dashboard/overview', { params }),
  getDashboardStats: () => api.get('/dashboard/stats'),
  getDashboardCharts: (params) => api.get('/dashboard/charts', { params }),
  getUsers: (params) => api.get('/users', { params }),
  updateUserRole: (id, role) => api.put(`/users/${id}`, { role }),
  toggleUserStatus: (id, is_active) => api.put(`/users/${id}`, { is_active }),
  getAuditLogs: (params) => api.get('/admin/audit-logs', { params }),
  getSettings: () => api.get('/settings'),
  updateSettings: (settings) => api.put('/settings', settings),
  getReports: (params) => api.get('/admin/reports', { params }),
  getReportsCsv: ({ type = 'reservations', ...params } = {}) => api.get(`/reports/${['reservations', 'payments', 'users'].includes(type) ? type : 'reservations'}`, { params, responseType: 'blob' }),
};

export const staffAPI = {
  searchCustomers: (search) => api.get('/staff/customers', { params: { search } }),
  createWalkInReservation: (data) => api.post('/staff/walk-in-reservations', data),
  getDailySchedule: (date) => api.get('/staff/daily', { params: { date } }),
  checkInReservation: (reservationId) => api.post(`/staff/check-in/${reservationId}`),
  recordCashPayment: (data) => api.post('/staff/cash-payment', data),
};

// Shared front desk and admin walk-in players, independent of reservations.
export const playersAPI = {
  getAll: () => api.get('/players'),
  create: (data) => api.post('/players', data),
  update: (id, data) => api.patch(`/players/${id}`, data),
  remove: (id) => api.delete(`/players/${id}`),
  timer: (id, action, duration_minutes) => api.post(`/players/${id}/timer`, { action, ...(duration_minutes === undefined ? {} : { duration_minutes }) }),
};

// The signed-in customer's booking updates and upcoming-game reminders.
export const notificationsAPI = {
  getAll: (params, config = {}) => api.get('/notifications', { ...config, params }),
  getUnreadCount: (config = {}) => api.get('/notifications/unread-count', config),
  markRead: (id, config = {}) => api.put(`/notifications/${id}/read`, {}, config),
  markAllRead: (config = {}) => api.put('/notifications/read-all', {}, config),
};

export default api;

