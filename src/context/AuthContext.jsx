import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { selectPlanDisplay } from '../lib/planDisplay.js';
import {
  AUTH_CHANGED_EVENT,
  clearToken,
  fetchMeResult,
  getToken,
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
  const [scanQuota, setScanQuota] = useState(null);
  const [creditsUsedToday, setCreditsUsedToday] = useState(0);
  const [loading, setLoading] = useState(true);

  const resetSession = useCallback(() => {
    setUser(null);
    setCredits(0);
    setActivePackage('Free');
    setUnlimitedCredits(false);
    setSubscription(null);
    setEntitlements(EMPTY_ENTITLEMENTS);
    setScanQuota(null);
    setCreditsUsedToday(0);
  }, []);

  const fetchUserData = useCallback(async ({ force = false } = {}) => {
    if (!isTokenValid()) {
      if (getToken()) clearToken();
      resetSession();
      setLoading(false);
      return;
    }

    try {
      const result = await fetchMeResult({ force });
      if (result.status === 'ok') {
        const data = result.data;
        setUser(data.user);
        setCredits(data.credits || 0);
        setActivePackage(data.activePackage || 'Free');
        setUnlimitedCredits(Boolean(data.unlimitedCredits));
        setSubscription(data.subscription || null);
        setEntitlements(data.entitlements || EMPTY_ENTITLEMENTS);
        setScanQuota(data.scanQuota || null);
        setCreditsUsedToday(Number(data.creditsUsedToday) || 0);
      } else if (result.status === 'unauthorized' || result.status === 'no_token') {
        resetSession();
      }
      // Transient errors (429/5xx/network): keep the last known state.
    } catch (err) {
      console.error('Error loading user data:', err);
    } finally {
      setLoading(false);
    }
  }, [resetSession]);

  const refreshUserData = useCallback(() => fetchUserData({ force: true }), [fetchUserData]);

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

  const plan = useMemo(
    () =>
      selectPlanDisplay({ user, credits, activePackage, subscription, entitlements, unlimitedCredits }),
    [user, credits, activePackage, subscription, entitlements, unlimitedCredits],
  );

  const value = {
    user,
    credits,
    plan,
    activePackage,
    unlimitedCredits,
    subscription,
    entitlements,
    scanQuota,
    creditsUsedToday,
    can,
    loading,
    login,
    logout,
    refreshUserData
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
