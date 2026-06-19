import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'sonner';

const NotificationContext = createContext(null);

// ── SOCKET needs base URL without /api ──
const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');

// ── API already includes /api from .env ──
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ── Get current user from JWT stored as 'auth_token' ──
const getUser = () => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) return { token: null, user: null };
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { token, user: { id: payload.userId, role: payload.role } };
  } catch {
    return { token: null, user: null };
  }
};

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  // ── Fetch notifications from backend ──
  const fetchNotifications = useCallback(async () => {
    const { token, user } = getUser();
    if (!token || !user) return;
    try {
      const res = await fetch(`${API_URL}/notifications/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.isRead).length);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, []);

  // ── Mark single notification as read ──
  const markAsRead = useCallback(async (notificationId) => {
    const { token } = getUser();
    if (!token) return;
    try {
      await fetch(`${API_URL}/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  }, []);

  // ── Mark all notifications as read ──
  const markAllAsRead = useCallback(async () => {
    const { token, user } = getUser();
    if (!token || !user) return;
    try {
      await fetch(`${API_URL}/notifications/${user.id}/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  }, []);

  // ── Delete a notification ──
  const deleteNotification = useCallback(async (notificationId) => {
    const { token } = getUser();
    if (!token) return;
    try {
      await fetch(`${API_URL}/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => {
        const removed = prev.find(n => n.id === notificationId);
        if (removed && !removed.isRead) {
          setUnreadCount(c => Math.max(0, c - 1));
        }
        return prev.filter(n => n.id !== notificationId);
      });
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  }, []);

  // ── Send a notification (admin → teacher or teacher → admin) ──
  const sendNotification = useCallback(async ({ receiverId, title, message, type }) => {
    const { token, user } = getUser();
    if (!token || !user) return;
    try {
      await fetch(`${API_URL}/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          senderId: user.id,
          receiverId,
          title,
          message,
          type: type || 'SYSTEM',
        }),
      });
    } catch (err) {
      console.error('Failed to send notification:', err);
    }
  }, []);

  // ── Socket.IO connection ──
  useEffect(() => {
    const { token, user } = getUser();
    if (!token || !user) return;

    // Fetch existing notifications on mount
    fetchNotifications();

    // Connect socket to base URL (without /api)
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join', { userId: user.id, role: user.role });
      console.log('🔔 Notification socket connected');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // ── Listen for incoming real-time notifications ──
    socket.on('notification', (newNotification) => {
      setNotifications(prev => [newNotification, ...prev]);
      setUnreadCount(prev => prev + 1);

      toast(newNotification.title, {
        description: newNotification.message,
        duration: 5000,
        icon: getNotificationIcon(newNotification.type),
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isConnected,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        sendNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// ── Hook ──
export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}

// ── Helper: icon per notification type ──
function getNotificationIcon(type) {
  const icons = {
    ATTENDANCE:      '📋',
    TIMETABLE:       '📅',
    LEAVE:           '🏖️',
    SYSTEM:          '📢',
    PERFORMANCE:     '📊',
    FACE_ATTENDANCE: '📸',
    MEETING:         '🤝',
  };
  return icons[type] || '🔔';
}