const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

// GET /api/branches
const getBranches = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM branches WHERE institution_id = ? ORDER BY name',
      [req.user.institution_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
};

// GET /api/branches/:id
const getBranch = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM branches WHERE id = ? AND institution_id = ?',
      [req.params.id, req.user.institution_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Branch not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch branch' });
  }
};

// POST /api/branches
const createBranch = async (req, res) => {
  const { name, code, contact_number, address, city, state, pincode, country, latitude, longitude } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Name and code are required' });

  try {
    const id = uuidv4();
    await db.query(
      `INSERT INTO branches (id, institution_id, name, code, contact_number, address, city, state, pincode, country, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.institution_id, name, code, contact_number || null, address || null, city || null, state || null, pincode || null, country || null, latitude || null, longitude || null]
    );
    const [rows] = await db.query('SELECT * FROM branches WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Branch code already exists' });
    res.status(500).json({ error: 'Failed to create branch' });
  }
};

// PUT /api/branches/:id — supports partial updates (only fields sent are updated)
const updateBranch = async (req, res) => {
  const { name, code, contact_number, address, city, state, pincode, country, latitude, longitude } = req.body;
  try {
    const result = await db.query(
      `UPDATE branches SET
        name           = COALESCE(?, name),
        code           = COALESCE(?, code),
        contact_number = COALESCE(?, contact_number),
        address        = COALESCE(?, address),
        city           = COALESCE(?, city),
        state          = COALESCE(?, state),
        pincode        = COALESCE(?, pincode),
        country        = COALESCE(?, country),
        latitude       = COALESCE(?, latitude),
        longitude      = COALESCE(?, longitude)
       WHERE id = ? AND institution_id = ?`,
      [
        name       ?? null,
        code       ?? null,
        contact_number ?? null,
        address    ?? null,
        city       ?? null,
        state      ?? null,
        pincode    ?? null,
        country    ?? null,
        latitude   ?? null,
        longitude  ?? null,
        req.params.id,
        req.user.institution_id,
      ]
    );
    res.json({ message: 'Branch updated' });
  } catch (err) {
    console.error('Update branch error:', err);
    res.status(500).json({ error: 'Failed to update branch' });
  }
};

// DELETE /api/branches/:id
const deleteBranch = async (req, res) => {
  try {
    await db.query('DELETE FROM branches WHERE id = ? AND institution_id = ?', [req.params.id, req.user.institution_id]);
    res.json({ message: 'Branch deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete branch' });
  }
};

module.exports = { getBranches, getBranch, createBranch, updateBranch, deleteBranch };




























