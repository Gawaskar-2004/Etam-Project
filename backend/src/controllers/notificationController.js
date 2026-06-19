const pool   = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// Helper: auto-create notifications table if missing
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id           VARCHAR(36)  PRIMARY KEY,
      sender_id    VARCHAR(36)  NOT NULL,
      receiver_id  VARCHAR(36)  NOT NULL,
      title        VARCHAR(255) NOT NULL,
      message      TEXT         NOT NULL,
      type         VARCHAR(50)  DEFAULT 'SYSTEM',
      is_read      BOOLEAN      DEFAULT FALSE,
      created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_receiver (receiver_id),
      INDEX idx_created  (created_at)
    )
  `);
}

// ── POST /api/notifications ──────────────────────────────────────────
// Create a notification + emit via Socket.IO
const createNotification = async (req, res) => {
  const { senderId, receiverId, title, message, type } = req.body;

  if (!senderId || !receiverId || !title || !message) {
    return res.status(400).json({ error: 'senderId, receiverId, title, message are required' });
  }

  try {
    await ensureTable();

    const id = uuidv4();
    await pool.query(
      `INSERT INTO notifications (id, sender_id, receiver_id, title, message, type, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, FALSE, NOW())`,
      [id, senderId, receiverId, title, message, type || 'SYSTEM']
    );

    const [rows] = await pool.query('SELECT * FROM notifications WHERE id = ?', [id]);
    const notification = formatNotification(rows[0]);

    // ── Real-time push via Socket.IO ──
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${receiverId}`).emit('notification', notification);
      console.log(`🔔 Notification sent to user_${receiverId}: ${title}`);
    }

    res.status(201).json({ success: true, notification });
  } catch (err) {
    console.error('Create notification error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/notifications/:userId ──────────────────────────────────
// Get all notifications for a user (newest first)
const getNotifications = async (req, res) => {
  const { userId } = req.params;

  // Only allow users to fetch their own notifications
  if (req.user.id !== userId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    await ensureTable();

    const [rows] = await pool.query(
      `SELECT * FROM notifications
       WHERE receiver_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json(rows.map(formatNotification));
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── PATCH /api/notifications/:id/read ───────────────────────────────
// Mark a single notification as read
const markAsRead = async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND receiver_id = ?',
      [id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Mark as read error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── PATCH /api/notifications/:userId/read-all ────────────────────────
// Mark all notifications as read for a user
const markAllAsRead = async (req, res) => {
  const { userId } = req.params;

  if (req.user.id !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE receiver_id = ?',
      [userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE /api/notifications/:id ───────────────────────────────────
// Delete a single notification
const deleteNotification = async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(
      'DELETE FROM notifications WHERE id = ? AND receiver_id = ?',
      [id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── Helper: format DB row to camelCase for frontend ──────────────────
function formatNotification(row) {
  return {
    id:         row.id,
    senderId:   row.sender_id,
    receiverId: row.receiver_id,
    title:      row.title,
    message:    row.message,
    type:       row.type,
    isRead:     Boolean(row.is_read),
    createdAt:  row.created_at,
  };
}

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};