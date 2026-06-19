// src/services/NotificationService.js
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from '../api/client';

// ── Read projectId from app.json extra instead of hardcoding ──────────────
const PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId
  ?? '1ced6c9a-156f-44a5-bcdc-fb241e3661b1';

export function setupNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export async function setupAndroidChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('attendance', {
    name: 'Attendance Alerts',
    importance: Notifications.AndroidImportance.HIGH,
    sound: true,
    vibrationPattern: [0, 250, 250, 250],
  });

  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// requestPermissions
// ─────────────────────────────────────────────────────────────────────────────
export async function requestPermissions(token) {
  if (!Device.isDevice) {
    console.warn('⚠️  Push notifications only work on physical devices');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('❌ Notification permission denied');
    return false;
  }

  // Get Expo push token
  let expoPushToken;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: PROJECT_ID,
    });
    expoPushToken = tokenData.data;
    console.log('📱 Expo push token:', expoPushToken);
  } catch (err) {
    console.error('❌ Failed to get push token:', err.message);
    return false;
  }

  // Save token to backend
  try {
    await api.put('/users/push-token', { push_token: expoPushToken }, token);
    console.log('✅ Push token saved to server successfully');
  } catch (err) {
    console.error('❌ Failed to save push token:', err.message);
    // Non-fatal — local notifications still work
  }

  return true;
}

export function setupTapListener(onTap) {
  return Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    if (data?.screen) onTap(data);
  });
}

export function setupBackgroundListener(onReceive) {
  return Notifications.addNotificationReceivedListener(notification => {
    const data = notification.request.content.data;
    if (onReceive) onReceive(data);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX: Use Notifications.SchedulableTriggerInputTypes instead of plain strings.
// Plain strings like 'daily' / 'weekly' silently fail in Expo SDK 50+.
// ─────────────────────────────────────────────────────────────────────────────
export async function scheduleDailyTimetableReminder() {
  await Notifications.cancelScheduledNotificationAsync('daily-timetable').catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: 'daily-timetable',
    content: {
      title: '📅 Good morning!',
      body: "Check your timetable for today's classes.",
      data: { screen: 'studentTimetable' },
      channelId: 'reminders',
      android: { channelId: 'reminders' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 8,
      minute: 0,
    },
  });
  console.log('✅ Daily timetable reminder scheduled');
}

export async function scheduleWeeklyAttendanceReport() {
  await Notifications.cancelScheduledNotificationAsync('weekly-attendance').catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: 'weekly-attendance',
    content: {
      title: '📊 Weekly Attendance Report',
      body: 'Tap to check your attendance summary for the week.',
      data: { screen: 'myAttendance' },
      channelId: 'reminders',
      android: { channelId: 'reminders' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 2,
      hour: 9,
      minute: 0,
    },
  });
  console.log('✅ Weekly attendance report scheduled');
}

export async function scheduleTeacherDailyReminder() {
  await Notifications.cancelScheduledNotificationAsync('teacher-daily').catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: 'teacher-daily',
    content: {
      title: '🏫 Classes today',
      body: 'View your timetable and mark attendance.',
      data: { screen: 'dashboard' },
      channelId: 'reminders',
      android: { channelId: 'reminders' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 8,
      minute: 0,
    },
  });
  console.log('✅ Teacher daily reminder scheduled');
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}