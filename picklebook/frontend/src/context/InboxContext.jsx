import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { notificationsAPI } from '../services/api';
import { isUnreadNotification } from '../utils/notifications';

const InboxContext = createContext({ enabled: false });

function InboxSession({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const active = useRef(true);
  const refreshRequest = useRef(null);
  const actionRequest = useRef(null);

  const refresh = useCallback(async () => {
    if (!active.current || actionRequest.current) return;
    refreshRequest.current?.abort();
    const controller = new AbortController();
    refreshRequest.current = controller;
    setRefreshing(true);
    try {
      const [list, count] = await Promise.all([
        notificationsAPI.getAll({ page: 1, limit: 10 }, { signal: controller.signal }),
        notificationsAPI.getUnreadCount({ signal: controller.signal }),
      ]);
      if (!active.current || controller.signal.aborted) return;
      const data = list.data?.data;
      const unread = Number(count.data?.data?.unread_count);
      if (!Array.isArray(data?.notifications) || !Number.isFinite(unread)) throw new Error('Invalid notifications response');
      setNotifications(data.notifications);
      setTotal(Number(data.total) || 0);
      setUnreadCount(Math.max(0, unread));
      setLoadError('');
    } catch {
      if (active.current && !controller.signal.aborted) setLoadError('Notifications could not be loaded. Please try again.');
    } finally {
      if (active.current && !controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
      if (refreshRequest.current === controller) refreshRequest.current = null;
    }
  }, []);

  useEffect(() => {
    active.current = true;
    refresh();
    const interval = window.setInterval(refresh, 60000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      active.current = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      refreshRequest.current?.abort();
      actionRequest.current?.abort();
    };
  }, [refresh]);

  const markRead = async (id = null) => {
    if (!active.current || actionRequest.current) return false;
    const item = notifications.find(notification => notification.id === id);
    if (id !== null && (!item || !isUnreadNotification(item))) return true;
    refreshRequest.current?.abort();
    const controller = new AbortController();
    actionRequest.current = controller;
    setBusy(true);
    setRefreshing(false);
    setActionError('');
    try {
      if (id === null) await notificationsAPI.markAllRead({ signal: controller.signal });
      else await notificationsAPI.markRead(id, { signal: controller.signal });
      if (!active.current || controller.signal.aborted) return false;
      setNotifications(previous => previous.map(notification => id === null || notification.id === id ? { ...notification, is_read: 1 } : notification));
      setUnreadCount(previous => id === null ? 0 : Math.max(0, previous - 1));
      return true;
    } catch (error) {
      if (active.current && !controller.signal.aborted) {
        // Another tab may already have read or removed this notification.
        if (id !== null && error.status === 404) return true;
        setActionError('Your read status could not be saved. Please try again.');
      }
      return false;
    } finally {
      if (actionRequest.current === controller) actionRequest.current = null;
      if (active.current && !controller.signal.aborted) {
        setBusy(false);
        refresh();
      }
    }
  };

  return <InboxContext.Provider value={{ enabled: true, notifications, total, unreadCount, loading, refreshing, busy, error: actionError || loadError, refresh, markRead, markAllRead: () => markRead() }}>{children}</InboxContext.Provider>;
}

export function InboxProvider({ children }) {
  const { user, token, isAuthenticated, loading } = useAuth();
  if (!isAuthenticated || loading) return <InboxContext.Provider value={{ enabled: false }}>{children}</InboxContext.Provider>;
  // A fresh provider prevents the previous account's notifications appearing
  // after logout or an account/token change, even while a request is pending.
  return <InboxSession key={`${user.id}:${token}`}>{children}</InboxSession>;
}

export const useInbox = () => useContext(InboxContext);
