import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';

import { C } from './src/config/constants';
import { createApi, api } from './src/api/client';
import { saveSession, loadSession, clearSession } from './src/utils/storage';
import styles from './src/styles/globalStyles';

import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import ProfileScreen from './src/screens/ProfileScreen';

import TeacherDashboard from './src/screens/teacher/TeacherDashboard';
import TeacherTimetableScreen from './src/screens/teacher/TeacherTimetableScreen';
import TeacherReportsScreen from './src/screens/teacher/TeacherReportsScreen';
import AttendanceSelectScreen from './src/screens/teacher/AttendanceSelectScreen';
import TeacherFaceAttendanceScreen from './src/screens/teacher/TeacherFaceAttendanceScreen';
import TeacherFaceRegistrationScreen from './src/screens/teacher/TeacherFaceRegistrationScreen';
import TeacherMarkAttendanceScreen from './src/screens/teacher/TeacherMarkAttendanceScreen';
import TeacherMyStudentsScreen from './src/screens/teacher/TeacherMyStudentsScreen';
import TeacherLeaveManagementScreen from './src/screens/teacher/TeacherLeaveManagementScreen';

import StudentDashboard from './src/screens/student/StudentDashboard';
import StudentMyAttendanceScreen from './src/screens/student/StudentMyAttendanceScreen';
import StudentTimetableScreen from './src/screens/student/StudentTimetableScreen';
import StudentLeaveScreen from './src/screens/student/StudentLeaveScreen';

import {
  setupNotificationHandler,
  setupAndroidChannel,
  requestPermissions,
  setupTapListener,
  setupBackgroundListener,
  scheduleDailyTimetableReminder,
  scheduleWeeklyAttendanceReport,
  scheduleTeacherDailyReminder,
  cancelAllNotifications,
} from './src/services/NotificationService';

// ─────────────────────────────────────────────────────────────────────────────
// sanitizeUser
// ─────────────────────────────────────────────────────────────────────────────
const sanitizeUser = (user) => ({
  ...user,
  must_change_password: 0,
  requires_password_change: false,
});

export default function App() {
  const [token, setToken]                 = useState(null);
  const [user, setUser]                   = useState(null);
  const [authLoading, setAuthLoading]     = useState(true);
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [screenHistory, setScreenHistory] = useState([]);

  const tapListenerRef = useRef(null);
  const bgListenerRef  = useRef(null);

  // ── Notification handler + Android channel ───────────────────────────────
  useEffect(() => {
    setupNotificationHandler();
    setupAndroidChannel();
  }, []);

  // ── Load saved session on startup ────────────────────────────────────────
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const [session] = await Promise.all([
      loadSession(),
      new Promise(resolve => setTimeout(resolve, 2000)),
    ]);

    if (session?.token && session?.user) {
      const cleanUser = sanitizeUser(session.user);
      setToken(session.token);
      setUser(cleanUser);
      await saveSession(session.token, cleanUser);
    }

    setAuthLoading(false);
  };

  // ── Logout ───────────────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    await cancelAllNotifications();

    tapListenerRef.current?.remove();
    tapListenerRef.current = null;

    bgListenerRef.current?.remove();
    bgListenerRef.current = null;

    await clearSession();
    setToken(null);
    setUser(null);
    setCurrentScreen('dashboard');
    setScreenHistory([]);
  }, []);

  useEffect(() => {
    Object.assign(api, createApi(handleLogout));
  }, [handleLogout]);

  // ── Login ────────────────────────────────────────────────────────────────
  const handleLogin = async (newToken, newUser) => {
    const clean = sanitizeUser(newUser);
    await saveSession(newToken, clean);
    setToken(newToken);
    setUser(clean);
    setCurrentScreen('dashboard');
    setScreenHistory([]);
  };

  // ── Notifications after login ────────────────────────────────────────────
  useEffect(() => {
    if (!token || !user) return;

    const initNotifications = async () => {
      const granted = await requestPermissions(token);
      if (!granted) return;

      const isTeacher = ['teacher', 'staff', 'coordinator'].includes(user?.role);

      if (isTeacher) {
        await scheduleTeacherDailyReminder();
      } else {
        await scheduleDailyTimetableReminder();
        await scheduleWeeklyAttendanceReport();
      }

      tapListenerRef.current = setupTapListener((data) => {
        if (data?.screen) navigateTo(data.screen);
      });

      bgListenerRef.current = setupBackgroundListener((data) => {
        console.log('📬 Notification received while app open:', data);
      });
    };

    initNotifications();

    return () => {
      tapListenerRef.current?.remove();
      tapListenerRef.current = null;
      bgListenerRef.current?.remove();
      bgListenerRef.current = null;
    };
  }, [token, user]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const navigateTo = (screen) => {
    setScreenHistory(prev => [...prev, currentScreen]);
    setCurrentScreen(screen);
  };

  const navigateBack = () => {
    setScreenHistory(prev => {
      const history = [...prev];
      const last = history.pop() || 'dashboard';
      setCurrentScreen(last);
      return history;
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (authLoading) return <SplashScreen />;

  if (!token) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const isTeacher = ['teacher', 'staff', 'coordinator'].includes(user?.role);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return isTeacher
          ? <TeacherDashboard token={token} user={user} onNavigate={navigateTo} />
          : <StudentDashboard token={token} user={user} onNavigate={navigateTo} />;
      case 'attendance':
        return <AttendanceSelectScreen token={token} user={user} onNavigate={navigateTo} />;
      case 'teacherFaceAttendance':
        return <TeacherFaceAttendanceScreen token={token} user={user} onBack={navigateBack} />;
      case 'teacherFaceRegistration':
        return <TeacherFaceRegistrationScreen token={token} user={user} onBack={navigateBack} />;
      case 'teacherMarkAttendance':
        return <TeacherMarkAttendanceScreen token={token} user={user} onBack={navigateBack} />;
      case 'teacherMyStudents':
        return <TeacherMyStudentsScreen token={token} user={user} onBack={navigateBack} />;
      case 'teacherReports':
        return <TeacherReportsScreen token={token} user={user} onBack={navigateBack} />;
      case 'teacherTimetable':
        return <TeacherTimetableScreen token={token} user={user} onBack={navigateBack} />;
      case 'teacherLeaveManagement':
        return <TeacherLeaveManagementScreen token={token} user={user} onNavigate={navigateTo} onBack={navigateBack} />;
      case 'myAttendance':
        return <StudentMyAttendanceScreen token={token} user={user} onBack={navigateBack} />;
      case 'studentTimetable':
        return <StudentTimetableScreen token={token} user={user} onBack={navigateBack} />;
      case 'studentLeave':
        return <StudentLeaveScreen token={token} user={user} onNavigate={navigateTo} onBack={navigateBack} />;
      case 'profile':
        return <ProfileScreen user={user} token={token} onLogout={handleLogout} />;
      default:
        return isTeacher
          ? <TeacherDashboard token={token} user={user} onNavigate={navigateTo} />
          : <StudentDashboard token={token} user={user} onNavigate={navigateTo} />;
    }
  };

  const tabs = isTeacher ? [
    { id: 'dashboard',               label: 'Home',       icon: '🏠' },
    { id: 'attendance',              label: 'Attendance', icon: '✅' },
    { id: 'teacherFaceRegistration', label: 'Register',   icon: '🤳' },
    { id: 'profile',                 label: 'Profile',    icon: '👤' },
  ] : [
    { id: 'dashboard',        label: 'Home',     icon: '🏠' },
    { id: 'myAttendance',     label: 'Stats',    icon: '📊' },
    { id: 'studentTimetable', label: 'Schedule', icon: '📅' },
    { id: 'profile',          label: 'Profile',  icon: '👤' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.background }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.background} />
      <View style={{ flex: 1 }}>{renderScreen()}</View>
      <View style={styles.tabBar}>
        {tabs.map(tab => {
          const isActive = currentScreen === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabItem}
              onPress={() => { setScreenHistory([]); setCurrentScreen(tab.id); }}
            >
              <View style={[styles.tabItemInner, isActive && styles.tabItemInnerActive]}>
                <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>{tab.icon}</Text>
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}