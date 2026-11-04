import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('picklebook_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('picklebook_token') || null);
  const [loading, setLoading] = useState(true);

  // Sync session with backend on initial load
  const verifySession = useCallback(async () => {
    const currentToken = localStorage.getItem('picklebook_token');
    if (!currentToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await authAPI.getMe();
      if (response.data?.success && response.data?.data?.user) {
        const freshUser = response.data.data.user;
        setUser(freshUser);
        localStorage.setItem('picklebook_user', JSON.stringify(freshUser));
      } else {
        throw new Error('Invalid user data returned');
      }
    } catch (err) {
      console.warn('Session verification failed:', err.message);
      // If token expired, clear
      localStorage.removeItem('picklebook_token');
      localStorage.removeItem('picklebook_user');
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verifySession();

    // Listen to global unauthorized event triggered by api.js
    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
      localStorage.removeItem('picklebook_token');
      localStorage.removeItem('picklebook_user');
    };

    window.addEventListener('auth-unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
  }, [verifySession]);

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    const { token: receivedToken, user: receivedUser } = response.data?.data || {};

    if (!receivedToken || !receivedUser) {
      throw new Error(response.data?.message || 'Login failed. Invalid response from server.');
    }

    localStorage.setItem('picklebook_token', receivedToken);
    localStorage.setItem('picklebook_user', JSON.stringify(receivedUser));

    setToken(receivedToken);
    setUser(receivedUser);

    return receivedUser;
  };

  const register = async (userData) => {
    const response = await authAPI.register(userData);
    const { token: receivedToken, user: receivedUser } = response.data?.data || {};

    // If backend auto logs-in on registration:
    if (receivedToken && receivedUser) {
      localStorage.setItem('picklebook_token', receivedToken);
      localStorage.setItem('picklebook_user', JSON.stringify(receivedUser));
      setToken(receivedToken);
      setUser(receivedUser);
    }

    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('picklebook_token');
    localStorage.removeItem('picklebook_user');
    setUser(null);
    setToken(null);
  };

  const updateUserProfile = async (data) => {
    const response = await authAPI.updateProfile(data);
    const updated = response.data?.data?.user;
    if (updated) {
      const merged = { ...user, ...updated };
      setUser(merged);
      localStorage.setItem('picklebook_user', JSON.stringify(merged));
    }
    return response.data;
  };

  const changeUserPassword = async (passwords) => {
    const response = await authAPI.changePassword(passwords);
    return response.data;
  };

  const refreshUser = async () => {
    try {
      const res = await authAPI.getMe();
      if (res.data?.data?.user) {
        setUser(res.data.data.user);
        localStorage.setItem('picklebook_user', JSON.stringify(res.data.data.user));
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(user && token),
    isAdmin: user?.role === 'admin',
    isStaff: user?.role === 'staff' || user?.role === 'admin',
    isEmailVerified: Boolean(user?.email_verified),
    login,
    register,
    logout,
    updateUserProfile,
    changeUserPassword,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

