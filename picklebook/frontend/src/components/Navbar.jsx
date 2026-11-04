import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Briefcase, Calendar, ChevronDown, LayoutDashboard, LogOut, Menu, Shield, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../styles/navigation.css';
import ThemeToggle from './ThemeToggle';
import NotificationBell from './NotificationBell';
import { portalPathForRole } from '../utils/navigation';

const publicLinks = [
  { label: 'Home', to: '/' },
  { label: 'Courts', to: '/courts' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
];
const guestLinks = publicLinks.filter(link => ['/', '/about'].includes(link.to));

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, isStaff, logout, loading: authLoading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [scrolled, setScrolled] = useState(() => window.scrollY > 32);
  const navigationRef = useRef(null);
  const accountRef = useRef(null);
  const mobileButtonRef = useRef(null);
  const accountButtonRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';
  const hasAuthenticatedSession = isAuthenticated && !authLoading;
  const isManagement = isAdmin || isStaff;
  const authenticatedLinks = isManagement ? publicLinks.filter(link => link.to !== '/courts') : publicLinks;
  const desktopLinks = isHome || !hasAuthenticatedSession ? guestLinks : authenticatedLinks;
  const mobileLinks = hasAuthenticatedSession ? authenticatedLinks : guestLinks;
  const primaryTarget = isManagement ? portalPathForRole(user?.role) : '/book';
  const primaryLabel = isAdmin ? 'Open admin portal' : isStaff ? 'Open front desk' : 'Create session';
  const accountLinks = [
    ...(isAdmin ? [{ label: 'Admin portal', to: '/admin', Icon: Shield }] : []),
    ...(isStaff && !isAdmin ? [{ label: 'Staff portal', to: '/staff', Icon: Briefcase }] : []),
    ...(!isManagement ? [
      { label: 'Dashboard', to: '/dashboard', Icon: LayoutDashboard },
      { label: 'My reservations', to: '/my-reservations', Icon: Calendar },
    ] : []),
    { label: 'Account profile', to: '/profile', Icon: User },
  ];

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onPointerDown = event => {
      if (accountRef.current && !accountRef.current.contains(event.target)) setAccountOpen(false);
      if (navigationRef.current && !navigationRef.current.contains(event.target)) setMobileOpen(false);
    };
    const onKeyDown = event => {
      if (event.key !== 'Escape') return;
      if (mobileOpen) mobileButtonRef.current?.focus();
      else if (accountOpen) accountButtonRef.current?.focus();
      setMobileOpen(false);
      setAccountOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen, accountOpen]);

  const signOut = () => {
    logout();
    setAccountOpen(false);
    setMobileOpen(false);
    navigate('/');
  };

  const renderAccountLinks = () => accountLinks.map(({ label, to, Icon }) => (
    <Link key={to} to={to} onClick={() => { setAccountOpen(false); setMobileOpen(false); }}>
      <Icon size={16} aria-hidden="true" />{label}
    </Link>
  ));

  return (
    <nav ref={navigationRef} aria-label="Main navigation" className={['pb-nav', isHome ? 'pb-nav-home' : 'pb-nav-inner', scrolled ? 'pb-nav-scrolled' : '', mobileOpen ? 'pb-nav-open' : ''].join(' ')}>
      <div className="pb-nav-bar page-container">
        <Link to="/" className="pb-nav-brand" aria-label="PickleBook home">
          <img src="/favicon.svg" alt="" width="39" height="39" />
          <span>Pickle<span>Book</span><span className="pb-nav-brand-dot">.</span></span>
        </Link>
        <div className="pb-nav-desktop">
          <div className="pb-nav-links">
            {desktopLinks.map(({ label, to }) => (
              <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'pb-nav-link pb-nav-link-active' : 'pb-nav-link'}>{label}</NavLink>
            ))}
          </div>
          <ThemeToggle />
          {hasAuthenticatedSession && <NotificationBell onDark={isHome} />}
          {hasAuthenticatedSession ? (
            <div className="pb-nav-account" ref={accountRef}>
              <button ref={accountButtonRef} type="button" className="pb-nav-account-button" aria-expanded={accountOpen} aria-controls="account-menu" onClick={() => setAccountOpen(value => !value)}>
                <span className="pb-nav-avatar">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                <span>{user?.name?.split(' ')[0] || 'Account'}</span>
                <ChevronDown size={14} aria-hidden="true" />
              </button>
              {accountOpen && (
                <div className="pb-nav-dropdown" id="account-menu">
                  <div className="pb-nav-user"><strong>{user?.name}</strong><span>{user?.email}</span><small>{user?.role}</small></div>
                  {renderAccountLinks()}
                  <button type="button" onClick={signOut} className="pb-nav-signout"><LogOut size={16} aria-hidden="true" />Sign out</button>
                </div>
              )}
            </div>
          ) : <Link to="/login" className="pb-nav-signin">Sign In <ArrowUpRight size={15} aria-hidden="true" /></Link>}
          {hasAuthenticatedSession && <Link to={primaryTarget} className="pb-nav-book">{primaryLabel} <ArrowUpRight size={15} aria-hidden="true" /></Link>}
        </div>
        <div className="pb-nav-mobile-actions">
          <ThemeToggle />
          {hasAuthenticatedSession && <NotificationBell onDark={isHome} />}
          {!hasAuthenticatedSession && <Link to="/login" className="pb-nav-mobile-signin">Sign In</Link>}
          <button ref={mobileButtonRef} type="button" className="pb-nav-menu-toggle" aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={() => setMobileOpen(value => !value)}>
            {mobileOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="pb-nav-mobile-panel" id="mobile-navigation">
          <div className="pb-nav-mobile-links">
            {mobileLinks.map(({ label, to }) => <NavLink key={to} end={to === '/'} to={to} onClick={() => setMobileOpen(false)} className={({ isActive }) => isActive ? 'pb-nav-mobile-link active' : 'pb-nav-mobile-link'}>{label}<ArrowUpRight size={16} aria-hidden="true" /></NavLink>)}
          </div>
          {hasAuthenticatedSession && <Link to={primaryTarget} className="pb-nav-book" onClick={() => setMobileOpen(false)}>{primaryLabel} <ArrowUpRight size={16} aria-hidden="true" /></Link>}
          {hasAuthenticatedSession && (
            <div className="pb-nav-mobile-account">
              <div className="pb-nav-user"><strong>{user?.name}</strong><span>{user?.email}</span><small>{user?.role}</small></div>
              {renderAccountLinks()}
              <button type="button" className="pb-nav-signout" onClick={signOut}><LogOut size={16} aria-hidden="true" />Sign out</button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

