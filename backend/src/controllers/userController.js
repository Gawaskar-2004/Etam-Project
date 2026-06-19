const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

// GET /api/users — list all users in the same institution
const getUsers = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, email, full_name, role, phone, is_active, institution_id,
              employee_id, photo_url, created_at, updated_at
       FROM users
       WHERE institution_id = ?
       ORDER BY created_at DESC`,
      [req.user.institution_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// GET /api/users/:id
const getUser = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, email, full_name, role, phone, is_active, institution_id,
              employee_id, photo_url, created_at, updated_at
       FROM users WHERE id = ? AND institution_id = ?`,
      [req.params.id, req.user.institution_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

// POST /api/users — create user within institution (admin only)
const createUser = async (req, res) => {
  const { email, password, full_name, role, employee_id, is_active } = req.body;
  if (!email || !password || !full_name || !role) {
    return res.status(400).json({ error: 'email, password, full_name, role are required' });
  }
  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    await db.query(
      `INSERT INTO users (id, email, password, full_name, role, employee_id, is_active, institution_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, email, hashedPassword, full_name, role, employee_id || null, is_active !== false, req.user.institution_id]
    );
    const [rows] = await db.query(
      'SELECT id, email, full_name, role, is_active, institution_id, employee_id, created_at FROM users WHERE id = ?',
      [userId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

// PUT /api/users/:id — update user (admin only)
const updateUser = async (req, res) => {
  const { full_name, role, employee_id, is_active, phone } = req.body;
  try {
    await db.query(
      `UPDATE users SET full_name = COALESCE(?, full_name), role = COALESCE(?, role),
       employee_id = COALESCE(?, employee_id), is_active = COALESCE(?, is_active),
       phone = COALESCE(?, phone)
       WHERE id = ? AND institution_id = ?`,
      [full_name, role, employee_id, is_active, phone, req.params.id, req.user.institution_id]
    );
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

// DELETE /api/users/:id
const deleteUser = async (req, res) => {
  try {
    await db.query(
      'UPDATE users SET is_active = false WHERE id = ? AND institution_id = ?',
      [req.params.id, req.user.institution_id]
    );
    res.json({ message: 'User deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
};

module.exports = { getUsers, getUser, createUser, updateUser, deleteUser };