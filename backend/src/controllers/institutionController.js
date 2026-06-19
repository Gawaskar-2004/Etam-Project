const db = require('../config/db');

// GET /api/institutions/my
const getMyInstitution = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM institutions WHERE id = ?', [req.user.institution_id]);
    if (!rows.length) return res.status(404).json({ error: 'Institution not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch institution' });
  }
};

// PUT /api/institutions/my — partial update using COALESCE
const updateInstitution = async (req, res) => {
  const { name, type, admin_name, admin_email, phone, is_setup_complete } = req.body;
  try {
    await db.query(
      `UPDATE institutions SET
        name               = COALESCE(?, name),
        type               = COALESCE(?, type),
        admin_name         = COALESCE(?, admin_name),
        admin_email        = COALESCE(?, admin_email),
        phone              = COALESCE(?, phone),
        is_setup_complete  = COALESCE(?, is_setup_complete)
       WHERE id = ?`,
      [
        name              ?? null,
        type              ?? null,
        admin_name        ?? null,
        admin_email       ?? null,
        phone             ?? null,
        is_setup_complete ?? null,
        req.user.institution_id,
      ]
    );
    res.json({ message: 'Institution updated' });
  } catch (err) {
    console.error('Update institution error:', err);
    res.status(500).json({ error: 'Failed to update institution' });
  }
};

module.exports = { getMyInstitution, updateInstitution };




























