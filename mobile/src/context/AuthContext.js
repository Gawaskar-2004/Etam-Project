import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import api from '../api/client';
import {
  setupNotificationHandler,
  requestPermissions,
  scheduleWeeklyAttendanceReport,
  cancelAllNotifications,
} from '../services/notificationService';

const AuthContext = createContext({});

// ─────────────────────────────────────────────────────────────────────────────
// normalizeUser
//
// Forces must_change_password to 0 before saving to storage or state.
// A stored token means the user already reached the dashboard — so any
// must_change_password = 1 at that point is always a stale read.
// ─────────────────────────────────────────────────────────────────────────────
const normalizeUser = (user) => {
  if (!user) return user;
  return {
    ...user,
    must_change_password:     0,
    requires_password_change: false,
  };
};

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingScreen, setPendingScreen] = useState(null);

  const notifListener    = useRef(null);
  const responseListener = useRef(null);

  useEffect(() => { setupNotificationHandler(); }, []);

  useEffect(() => {
    notifListener.current = Notifications.addNotificationReceivedListener(() => {});

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const screen = response.notification.request.content.data?.screen;
      if (screen) setPendingScreen(screen);
    });

    return () => {
      Notifications.removeNotificationSubscription(notifListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  useEffect(() => { loadUser(); }, []);

  // ── App launch: restore session ──────────────────────────────────────────
  const loadUser = async () => {
    try {
      const [storedToken, userData] = await Promise.all([
        AsyncStorage.getItem('token'),
        AsyncStorage.getItem('user'),
        new Promise(resolve => setTimeout(resolve, 2000)),
      ]);

      if (storedToken && userData) {
        const parsed   = JSON.parse(userData);
        // ── FIX: A stored token = user already set password and reached
        // dashboard. Force must_change_password off unconditionally.
        const safeUser = normalizeUser(parsed);

        // Write clean value back so next launch is also clean
        await AsyncStorage.setItem('user', JSON.stringify(safeUser));

        setToken(storedToken);
        setUser(safeUser);

        if (safeUser?.role === 'student') {
          requestPermissions().catch(() => {});
          scheduleWeeklyAttendanceReport().catch(() => {});
        }
      }
    } catch (e) {
      console.log('Load user error:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Used when AuthContext itself makes the login API call ─────────────────
  // NOTE: Does NOT normalize — LoginScreen needs the raw must_change_password
  // flag to decide whether to show the setPassword screen.
  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { token: tok, user: loggedIn } = response;

    await AsyncStorage.setItem('token', tok);
    await AsyncStorage.setItem('user', JSON.stringify(loggedIn));
    setToken(tok);
    setUser(loggedIn);

    if (loggedIn?.role === 'student') {
      const granted = await requestPermissions();
      if (granted) await scheduleWeeklyAttendanceReport();
    }
    return loggedIn;
  };

  // ── Called by LoginScreen after full auth flow is complete ────────────────
  //
  // This is called in two cases:
  //   (a) Normal login — no password change needed
  //   (b) After set-password flow — password already set
  //
  // In BOTH cases must_change_password MUST be 0. normalizeUser enforces this.
  // This is the single choke-point — nothing with must_change_password=1
  // should ever reach AsyncStorage or navigation after this point.
  // ─────────────────────────────────────────────────────────────────────────
  const loginWithToken = async (tok, userData) => {
    // ── KEY FIX: Always normalize before saving ──
    const safeUser = normalizeUser(userData);

    await AsyncStorage.setItem('token', tok);
    await AsyncStorage.setItem('user', JSON.stringify(safeUser));
    setToken(tok);
    setUser(safeUser);

    if (safeUser?.role === 'student') {
      const granted = await requestPermissions();
      if (granted) await scheduleWeeklyAttendanceReport();
    }
  };

  const logout = async () => {
    await cancelAllNotifications();
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setPendingScreen(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      loginWithToken,
      logout,
      pendingScreen,
      setPendingScreen,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);