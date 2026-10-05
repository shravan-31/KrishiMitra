/**
 * KrishiMitra — useAuth Hook
 *
 * AuthProvider wraps the app and provides authentication context.
 * useAuth() hook exposes: { user, loading, loginWithGoogle, logout }
 *
 * Cookie-based JWT — all requests include credentials.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

import { BACKEND_URL } from '../config';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Fetch current user on mount ────────────────────────────────────────
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/auth/me`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  // ── Redirect to Google OAuth ───────────────────────────────────────────
  const loginWithGoogle = useCallback(() => {
    window.location.href = `${BACKEND_URL}/auth/google/login`;
  }, []);

  // ── Login with email and password ──────────────────────────────────────
  const loginWithEmail = useCallback(async (email, password) => {
    try {
      const res = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        return { success: true };
      } else {
        return { success: false, error: data.detail || 'Failed to login' };
      }
    } catch (err) {
      return { success: false, error: 'Network error, please try again' };
    }
  }, []);

  // ── Register with email, password, and name ────────────────────────────
  const register = useCallback(async (email, password, full_name) => {
    try {
      const res = await fetch(`${BACKEND_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        return { success: true };
      } else {
        return { success: false, error: data.detail || 'Failed to register' };
      }
    } catch (err) {
      return { success: false, error: 'Network error, please try again' };
    }
  }, []);

  // ── Logout: clear cookie + state ───────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      await fetch(`${BACKEND_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Swallow — cookie deletion happens server-side
    }
    setUser(null);
    window.location.href = '/';
  }, []);

  const value = { user, loading, loginWithGoogle, logout, loginWithEmail, register };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export default useAuth;
