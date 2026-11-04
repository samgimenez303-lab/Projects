import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import { portalPathForRole } from '../utils/navigation';

const ProtectedRoute = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner fullScreen message="Checking authentication..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (['/dashboard', '/book'].includes(location.pathname) && ['admin', 'staff'].includes(user?.role)) {
    return <Navigate to={portalPathForRole(user.role)} replace />;
  }

  return children ? children : <Outlet />;
};

export default ProtectedRoute;

