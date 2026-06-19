const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require('../controllers/notificationController');

// Create a notification (admin or teacher)
router.post('/', authenticate, createNotification);

// Get all notifications for a user
router.get('/:userId', authenticate, getNotifications);

// Mark single notification as read
router.patch('/:id/read', authenticate, markAsRead);

// Mark ALL notifications as read for a user
router.patch('/:userId/read-all', authenticate, markAllAsRead);

// Delete a notification
router.delete('/:id', authenticate, deleteNotification);

module.exports = router;