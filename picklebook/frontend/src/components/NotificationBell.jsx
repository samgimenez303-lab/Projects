import React, { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Check, RefreshCw, X } from 'lucide-react';
import { useInbox } from '../context/InboxContext';
import { isUnreadNotification, notificationLink } from '../utils/notifications';
import '../styles/notifications.css';

export default function NotificationBell({ onDark = false }) {
  const inbox = useInbox();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const panelId = useId();
  const headingId = useId();
  const location = useLocation();

  useEffect(() => { setOpen(false); }, [location.pathname, location.search, inbox.enabled]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = event => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onResize = () => setOpen(false);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  if (!inbox.enabled) return null;
  const { notifications, total, unreadCount, loading, refreshing, busy, error, refresh, markRead, markAllRead } = inbox;

  return (
    <div className={`notification-inbox${onDark ? ' notification-inbox-on-dark' : ''}`} ref={containerRef} onBlur={event => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button ref={buttonRef} type="button" className="notification-bell" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'} aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => {
        setOpen(previous => !previous);
        if (!open) refresh();
      }}>
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 && <span className="notification-badge" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      {open && (
        <section className="notification-panel" id={panelId} aria-labelledby={headingId}>
          <header className="notification-header">
            <div><h2 id={headingId}>Notifications</h2><p>{loading ? 'Checking for updates...' : unreadCount ? `${unreadCount} unread` : 'Booking updates and game reminders'}</p></div>
            <button type="button" className="notification-icon-button" aria-label="Close notifications" onClick={() => { setOpen(false); buttonRef.current?.focus(); }}><X size={18} aria-hidden="true" /></button>
          </header>
          <div className="notification-toolbar">
            <button type="button" disabled={busy || loading || !unreadCount} onClick={markAllRead}><Check size={14} aria-hidden="true" />Mark all as read</button>
            <button type="button" disabled={busy || refreshing} onClick={refresh} aria-label="Refresh notifications"><RefreshCw size={14} aria-hidden="true" />Refresh</button>
          </div>
          {error && <p className="notification-error" role="alert">{error}</p>}
          <div className="notification-content" aria-busy={loading || refreshing}>
            {loading ? <p className="notification-empty" role="status">Loading your notifications...</p> : !notifications.length ? <p className="notification-empty">{error ? 'Use Refresh to try loading your inbox again.' : 'No notifications yet. Your booking updates and game reminders will appear here.'}</p> : (
              <ul className="notification-list">
                {notifications.map(notification => {
                  const unread = isUnreadNotification(notification);
                  const link = notificationLink(notification.link);
                  return (
                    <li key={notification.id} className={unread ? 'notification-item notification-item-unread' : 'notification-item'}>
                      <div className="notification-item-title"><h3>{notification.title}</h3>{unread && <span className="notification-unread-dot"><span className="sr-only">Unread</span></span>}</div>
                      <p>{notification.message}</p>
                      <div className="notification-item-actions">
                        {link && <Link to={link} onClick={() => { if (unread) markRead(notification.id); setOpen(false); }}>{link.startsWith('/reservations/') ? 'View reservation' : 'View details'}</Link>}
                        {unread && <button type="button" disabled={busy} onClick={() => markRead(notification.id)} aria-label={`Mark ${notification.title} as read`}>Mark read</button>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {total > notifications.length && <p className="notification-footer">Showing your latest {notifications.length} notifications.</p>}
        </section>
      )}
    </div>
  );
}
