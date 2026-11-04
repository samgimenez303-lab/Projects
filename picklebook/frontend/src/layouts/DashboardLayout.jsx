import React, { useState } from 'react';
import { NavLink, Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';
import ThemeToggle from '../components/ThemeToggle';
import NotificationBell from '../components/NotificationBell';
import useDialog from '../hooks/useDialog';
import { portalPathForRole } from '../utils/navigation';
import {
  LayoutDashboard,
  Calendar,
  PlusCircle,
  User,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Shield,
  Briefcase,
  Home
} from 'lucide-react';

const DashboardLayout = () => {
  const { user, logout, isAdmin, isStaff } = useAuth();
  const portalTarget = portalPathForRole(user?.role);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarRef = useDialog(sidebarOpen, () => setSidebarOpen(false));
  const pageName = location.pathname.startsWith('/reservations/') ? 'Reservation details' : ({ '/dashboard': 'Your overview', '/my-reservations': 'My reservations', '/profile': 'Account profile' }[location.pathname] || 'Your court space');

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const menuItems = [
    { name: 'Dashboard', path: isStaff ? portalTarget : '/dashboard', icon: LayoutDashboard },
    { name: 'My Reservations', path: '/my-reservations', icon: Calendar },
    ...(!isStaff ? [{ name: 'Book Court', path: '/book', icon: PlusCircle }] : []),
    { name: 'Account Profile', path: '/profile', icon: User },
  ];

  return (
    <div className="dashboard-shell min-h-screen flex flex-col md:flex-row">
      <a href="#dashboard-main" className="skip-link">Skip to content</a>
      <Toast />

      {/* Mobile Header Bar */}
      <div className="dashboard-mobile-header md:hidden bg-navy-900 text-white px-4 py-3.5 flex items-center justify-between border-b border-navy-800 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            aria-expanded={sidebarOpen}
            aria-controls="member-navigation"
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-navy-800"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Link to="/" className="dashboard-mobile-brand flex items-center gap-1.5">
            <img src="/favicon.svg" alt="" width="27" height="27" />
            <span className="font-bold text-lg font-display">PickleBook</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle className="theme-toggle-on-dark" />
          <NotificationBell onDark />
          <Link
            to={isStaff ? portalTarget : '/book'}
            className="px-2.5 py-1 bg-pickle-600 text-white text-xs font-semibold rounded-lg"
          >
            {isAdmin ? 'Admin portal' : isStaff ? 'Front desk' : 'Create session'}
          </Link>
          <div className="hidden sm:flex w-7 h-7 rounded-full bg-pickle-500 text-white items-center justify-center font-bold text-xs">
            {user?.name?.charAt(0) || 'U'}
          </div>
        </div>
      </div>

      {/* Backdrop for mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Customer Sidebar Navigation */}
      <aside
        id="member-navigation"
        ref={sidebarRef}
        aria-label="Member navigation"
        className={`dashboard-sidebar fixed md:sticky top-0 left-0 h-screen w-64 bg-navy-900 text-slate-300 flex flex-col z-50 transition-transform duration-300 ease-in-out md:translate-x-0 ${
          sidebarOpen ? 'sidebar-open translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header */}
        <div className="p-6 border-b border-navy-800 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <img src="/favicon.svg" alt="" width="36" height="36" />
            <div className="flex flex-col">
              <span className="text-xl font-black text-white font-display tracking-tight leading-none">
                Pickle<span className="text-pickle-400">Book</span>
              </span>
              <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
                Member Area
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
            className="md:hidden text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-4 mx-4 mt-4 bg-navy-800/80 rounded-xl border border-navy-700/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-pickle-500 text-white flex items-center justify-center font-black text-base shadow">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                end={item.path === '/dashboard'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-pickle-600 text-white font-bold shadow-md'
                      : 'text-slate-300 hover:bg-navy-800 hover:text-white'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.name}</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-60" />
              </NavLink>
            );
          })}

          {/* Quick links to Admin / Staff if elevated */}
          {isAdmin && (
            <div className="pt-4 mt-4 border-t border-navy-800">
              <span className="px-3 text-[10px] font-bold tracking-wider uppercase text-slate-500">
                Staff & Admin
              </span>
              <Link
                to="/admin"
                className="mt-1 flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-accent-400 hover:bg-navy-800"
              >
                <Shield className="w-5 h-5" />
                <span>Admin Portal</span>
              </Link>
            </div>
          )}

          {isStaff && !isAdmin && (
            <div className="pt-4 mt-4 border-t border-navy-800">
              <span className="px-3 text-[10px] font-bold tracking-wider uppercase text-slate-500">
                Staff
              </span>
              <Link
                to="/staff"
                className="mt-1 flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-accent-400 hover:bg-navy-800"
              >
                <Briefcase className="w-5 h-5" />
                <span>Staff Portal</span>
              </Link>
            </div>
          )}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-navy-800 space-y-2">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Back to Public Website</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="dashboard-topbar hidden md:flex"><div><span>YOUR COURT SPACE</span><p>{pageName}</p></div><div className="flex items-center gap-4"><ThemeToggle /><NotificationBell />{!isStaff && <Link to="/book" className="btn-primary text-xs gap-2 py-2 px-3"><PlusCircle size={16} />Create session</Link>}<Link to={isStaff ? portalTarget : '/courts'} className="text-link">{isAdmin ? 'Open admin portal' : isStaff ? 'Open front desk' : 'Explore courts'} <ChevronRight size={16} /></Link></div></div>
        <main id="dashboard-main" tabIndex={-1} className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;

