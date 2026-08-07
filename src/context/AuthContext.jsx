import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [credits, setCredits] = useState(0);
  const [activePackage, setActivePackage] = useState('Free');
  const [unlimitedCredits, setUnlimitedCredits] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setCredits(0);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setCredits(data.credits || 0);
        setActivePackage(data.activePackage || 'Free');
        setUnlimitedCredits(Boolean(data.unlimitedCredits));
        setSubscription(data.subscription || null);
      } else {
        localStorage.removeItem('token');
        setUser(null);
        setCredits(0);
      }
    } catch (err) {
      console.error('Error loading user data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    setUser(userData);
    fetchUserData();
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setCredits(0);
    setActivePackage('Free');
    setUnlimitedCredits(false);
    setSubscription(null);
  };

  const value = {
    user,
    credits,
    activePackage,
    unlimitedCredits,
    subscription,
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
