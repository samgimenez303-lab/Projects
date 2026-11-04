import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { InboxProvider } from './context/InboxContext';

// Layouts
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';
import AdminLayout from './layouts/AdminLayout';

// Route Guards
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';

// Public Pages
import Home from './pages/Home';
const About = lazy(() => import('./pages/About'));
const Courts = lazy(() => import('./pages/Courts'));
const CourtDetails = lazy(() => import('./pages/CourtDetails'));
const Services = lazy(() => import('./pages/Services'));
const Contact = lazy(() => import('./pages/Contact'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const NewReservation = lazy(() => import('./pages/NewReservation'));

// Customer Protected Pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const MyReservations = lazy(() => import('./pages/MyReservations'));
const ReservationDetails = lazy(() => import('./pages/ReservationDetails'));
const Profile = lazy(() => import('./pages/Profile'));

// Staff & Admin Pages
const StaffDashboard = lazy(() => import('./pages/StaffDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminPlayers = lazy(() => import('./pages/AdminPlayers'));
const AdminCourts = lazy(() => import('./pages/AdminCourts'));
const AdminServices = lazy(() => import('./pages/AdminServices'));
const AdminReservations = lazy(() => import('./pages/AdminReservations'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminPayments = lazy(() => import('./pages/AdminPayments'));
const AdminContacts = lazy(() => import('./pages/AdminContacts'));
const AdminReports = lazy(() => import('./pages/AdminReports'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const NotFound = lazy(() => import('./pages/NotFound'));

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => { if (!hash) window.scrollTo(0, 0); }, [pathname, hash]);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <AuthProvider>
          <InboxProvider>
          <ScrollToTop />
          <ErrorBoundary>
          <Suspense fallback={<LoadingSpinner fullScreen message="Getting your court space ready..." />}>
          <Routes>
            {/* Public Layout Routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<About />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/courts" element={<Courts />} />
                <Route path="/courts/:id" element={<CourtDetails />} />
                <Route path="/services" element={<Services />} />
                <Route path="/book" element={<NewReservation />} />
              </Route>
              <Route path="/contact" element={<Contact />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="*" element={<NotFound />} />

              {/* Staff Portal with PublicLayout navbar for ease of switching */}
              <Route
                path="/staff"
                element={
                  <AdminRoute allowedRoles={['staff', 'admin']}>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                      <StaffDashboard />
                    </div>
                  </AdminRoute>
                }
              />
            </Route>

            {/* Customer Dashboard Layout Routes (Protected) */}
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/my-reservations" element={<MyReservations />} />
              <Route path="/reservations/:id" element={<ReservationDetails />} />
              <Route path="/profile" element={<Profile />} />
            </Route>

            {/* Admin Management Layout Routes (Admin Guarded) */}
            <Route
              path="/admin"
              element={
                <AdminRoute allowedRoles={['admin']}>
                  <AdminLayout />
                </AdminRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="players" element={<AdminPlayers />} />
              <Route path="courts" element={<AdminCourts />} />
              <Route path="services" element={<AdminServices />} />
              <Route path="reservations" element={<AdminReservations />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="contacts" element={<AdminContacts />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

          </Routes>
          </Suspense>
          </ErrorBoundary>
          </InboxProvider>
        </AuthProvider>
      </NotificationProvider>
    </BrowserRouter>
  );
}

export default App;

