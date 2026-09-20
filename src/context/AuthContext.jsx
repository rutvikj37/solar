import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../config.js';
import {
  AUTH_CHANGED_EVENT,
  clearToken,
  getToken,
  isAuthError,
  isTokenValid,
  logoutToLogin,
  setToken,
} from '../lib/auth.js';

const AuthContext = createContext(null);

const EMPTY_ENTITLEMENTS = {
  packageId: 'Free',
  packageName: 'Free',
  unlimited: false,
  features: {
    marketplace: false,
    proposals: false,
    appointments: false,
    csvExport: false,
    advancedFilters: false,
    dripAutomations: true,
    territoryLock: false,
    earlyMarketplace: false,
  },
  limits: {
    leadLimit: 0,
    emailLimit: 0,
    whatsappLimit: 0,
    crmUserLimit: 1,
    emailAutomationLimit: 1,
    territoryLockDays: 0,
  },
  usage: {
    dripCampaigns: 0,
    crmSeats: 1,
  },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [credits, setCredits] = useState(0);
  const [activePackage, setActivePackage] = useState('Free');
  const [unlimitedCredits, setUnlimitedCredits] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [entitlements, setEntitlements] = useState(EMPTY_ENTITLEMENTS);
  const [loading, setLoading] = useState(true);

  const resetSession = useCallback(() => {
    setUser(null);
    setCredits(0);
    setActivePackage('Free');
    setUnlimitedCredits(false);
    setSubscription(null);
    setEntitlements(EMPTY_ENTITLEMENTS);
  }, []);

  const fetchUserData = useCallback(async () => {
    if (!isTokenValid()) {
      if (getToken()) clearToken();
      resetSession();
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setCredits(data.credits || 0);
        setActivePackage(data.activePackage || 'Free');
        setUnlimitedCredits(Boolean(data.unlimitedCredits));
        setSubscription(data.subscription || null);
        setEntitlements(data.entitlements || EMPTY_ENTITLEMENTS);
      } else {
        if (isAuthError(res.status) || res.status === 404) {
          clearToken();
        }
        resetSession();
      }
    } catch (err) {
      console.error('Error loading user data:', err);
    } finally {
      setLoading(false);
    }
  }, [resetSession]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  useEffect(() => {
    const onAuthChanged = () => {
      if (!isTokenValid()) {
        resetSession();
        setLoading(false);
        return;
      }
      fetchUserData();
    };
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    window.addEventListener('pageshow', onAuthChanged);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
      window.removeEventListener('pageshow', onAuthChanged);
    };
  }, [fetchUserData, resetSession]);

  const login = (token, userData) => {
    setToken(token);
    setUser(userData);
    fetchUserData();
  };

  const logout = () => {
    resetSession();
    logoutToLogin();
  };

  const can = useCallback(
    (feature) => {
      if (unlimitedCredits || entitlements?.unlimited) return true;
      return Boolean(entitlements?.features?.[feature]);
    },
    [entitlements, unlimitedCredits],
  );

  const value = {
    user,
    credits,
    activePackage,
    unlimitedCredits,
    subscription,
    entitlements,
    can,
    loading,
    login,
    logout,
    refreshUserData: fetchUserData
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
