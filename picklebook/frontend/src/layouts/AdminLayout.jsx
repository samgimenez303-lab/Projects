import React, { useState } from 'react';
import { NavLink, Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';
import ThemeToggle from '../components/ThemeToggle';
import NotificationBell from '../components/NotificationBell';
import useDialog from '../hooks/useDialog';
import {
  LayoutDashboard,
  Timer,
  Calendar,
  Grid,
  Package,
  Users,
  CreditCard,
  MessageSquare,
  BarChart3,
  Settings,
  Briefcase,
  LogOut,
  Menu,
  X,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarRef = useDialog(sidebarOpen, () => setSidebarOpen(false));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navSections = [
    {
      label: 'Main',
      items: [
        { name: 'Overview', path: '/admin', icon: LayoutDashboard, end: true },
        { name: 'Players & Timers', path: '/admin/players', icon: Timer },
        { name: 'Reservations', path: '/admin/reservations', icon: Calendar },
        { name: 'Payments', path: '/admin/payments', icon: CreditCard },
      ],
    },
    {
      label: 'Facility Management',
      items: [
        { name: 'Court Management', path: '/admin/courts', icon: Grid },
        { name: 'Court Services', path: '/admin/services', icon: Grid },
      ],
    },
    {
      label: 'System & Reports',
      items: [
        { name: 'Users & Roles', path: '/admin/users', icon: Users },
        { name: 'Inquiries', path: '/admin/contacts', icon: MessageSquare },
        { name: 'Reports & Export', path: '/admin/reports', icon: BarChart3 },
        { name: 'Settings', path: '/admin/settings', icon: Settings },
      ],
    },
  ];

  return (
    <div className="dashboard-shell min-h-screen flex flex-col md:flex-row">
      <a href="#admin-main" className="skip-link">Skip to content</a>
      <Toast />

      {/* Mobile Bar */}
      <div className="dashboard-mobile-header md:hidden bg-navy-950 text-white px-4 py-3 flex items-center justify-between gap-2 border-b border-navy-800 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open management navigation"
            aria-expanded={sidebarOpen}
            aria-controls="management-navigation"
            className="p-1 rounded-lg text-slate-300 hover:text-white"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-bold text-sm font-display flex items-center gap-1.5">
            <img src="/favicon.svg" alt="" width="24" height="24" />
            <span>Admin Center</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle className="theme-toggle-on-dark" />
          <NotificationBell onDark />
        </div>
      </div>

      {/* Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Admin Sidebar */}
      <aside
        id="management-navigation"
        ref={sidebarRef}
        aria-label="Management navigation"
        className={`dashboard-sidebar fixed md:sticky top-0 left-0 h-screen w-64 bg-navy-950 text-slate-300 flex flex-col z-50 transition-transform duration-300 ease-in-out md:translate-x-0 ${
          sidebarOpen ? 'sidebar-open translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-5 border-b border-navy-800 flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" width="36" height="36" />
            <div>
              <span className="text-lg font-black text-white font-display tracking-tight leading-none block">
                Pickle<span className="text-pickle-400">Book</span>
              </span>
              <span className="text-[10px] font-bold uppercase text-pickle-400 tracking-wider">
                Management Console
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

        {/* Admin info */}
        <div className="px-4 py-3 mx-4 mt-3 rounded-lg bg-navy-900 border border-navy-800/80 flex items-center justify-between">
          <div className="truncate">
            <p className="text-xs font-bold text-white truncate">{user?.name}</p>
            <p className="text-[10px] text-pickle-400 uppercase font-semibold">{user?.role} access</p>
          </div>
          <Link
            to="/staff"
            className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 bg-navy-800 px-2 py-1 rounded"
            title="Switch to Staff Check-In"
          >
            <Briefcase className="w-3 h-3" />
            <span>Staff</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.name}
                      to={item.path}
                      end={Boolean(item.end)}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          isActive
                            ? 'bg-pickle-600 text-white font-bold shadow-sm'
                            : 'text-slate-300 hover:bg-navy-900 hover:text-white'
                        }`
                      }
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span>{item.name}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer actions */}
        <div className="p-3 border-t border-navy-800 space-y-1">
          <Link
            to="/"
            className="flex items-center justify-between px-3 py-2 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-navy-900"
          >
            <span className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Public Website</span>
            </span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Admin Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="dashboard-topbar hidden md:flex"><div><span>FACILITY MANAGEMENT</span><p>{navSections.flatMap(section => section.items).find(item => item.path === location.pathname)?.name || 'Management console'}</p></div><div className="flex items-center gap-4"><ThemeToggle /><NotificationBell /><Link to="/staff" className="text-link"><Briefcase size={16} /> Open front desk</Link></div></div>
        <main id="admin-main" tabIndex={-1} className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;

