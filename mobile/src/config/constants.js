// ==================== CONFIG ====================
export const BASE_URL = 'https://trustless-presbyterial-landen.ngrok-free.dev/api';
export const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const API_TIMEOUT = 30000;

// Default period timings (you can fetch from API)
export const DEFAULT_PERIOD_TIMINGS = {
  1: { start: '08:00 AM', end: '09:00 AM', name: 'Period 1' },
  2: { start: '09:00 AM', end: '10:00 AM', name: 'Period 2' },
  3: { start: '10:00 AM', end: '11:00 AM', name: 'Period 3' },
  4: { start: '11:00 AM', end: '12:00 PM', name: 'Period 4' },
  5: { start: '12:00 PM', end: '01:00 PM', name: 'Lunch Break' },
  6: { start: '01:00 PM', end: '02:00 PM', name: 'Period 5' },
  7: { start: '02:00 PM', end: '03:00 PM', name: 'Period 6' },
  8: { start: '03:00 PM', end: '04:00 PM', name: 'Period 7' },
};

// ==================== COLORS ====================
export const C = {
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight: '#818CF8',
  primaryBg: '#EEF2FF',
  secondary: '#EC4899',
  success: '#10B981',
  successLight: '#D1FAE5',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#3B82F6',
  infoLight: '#EFF6FF',
  dark: '#0F172A',
  gray: '#64748B',
  lightGray: '#F8FAFC',
  white: '#FFFFFF',
  background: '#F8FAFC',
  border: '#E2E8F0',
  cardBg: '#FFFFFF',
  shadow: '#000000',
};
