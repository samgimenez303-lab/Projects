import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';

const PublicLayout = () => {
  const { pathname } = useLocation();
  const { isAuthenticated, loading } = useAuth();
  return (
    <div className="public-layout flex flex-col min-h-screen">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Toast />
      <Navbar />
      <main id="main-content" className="flex-grow" tabIndex={-1}>
        <Outlet />
      </main>
      {isAuthenticated && !loading && pathname !== '/' && <Footer />}
    </div>
  );
};

export default PublicLayout;

