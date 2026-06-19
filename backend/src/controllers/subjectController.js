const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

// GET /api/subjects
const getSubjects = async (req, res) => {
  const { category_id, subcategory_id, item_id, search, status } = req.query;
  let sql = `SELECT s.* FROM subjects s WHERE s.institution_id = ?`;
  const params = [req.user.institution_id];

  if (category_id) { 
    sql += ' AND s.category_id = ?'; 
    params.push(category_id); 
  }
  if (subcategory_id) { 
    sql += ' AND s.subcategory_id = ?'; 
    params.push(subcategory_id); 
  }
  if (item_id) { 
    sql += ' AND s.item_id = ?'; 
    params.push(item_id); 
  }
  if (status) { 
    sql += ' AND s.status = ?'; 
    params.push(status); 
  }
  if (search) {
    sql += ' AND (s.name LIKE ? OR s.code LIKE ? OR s.subject_code LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY s.name';

  const [rows] = await db.query(sql, params);
  res.json(rows);
};

// GET /api/subjects/:id
const getSubject = async (req, res) => {
  const [rows] = await db.query(
    `SELECT s.*,
       ac.name as category_name,
       asc2.name as subcategory_name,
       ai.name as item_name,
       (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', st.id, 'full_name', st.full_name, 'staff_code', st.staff_code))
        FROM subject_staff_assignment ssa 
        JOIN staff st ON st.id = ssa.staff_id 
        WHERE ssa.subject_id = s.id
       ) as assigned_staff
     FROM subjects s
     LEFT JOIN academic_category ac ON ac.id = s.category_id
     LEFT JOIN academic_subcategory asc2 ON asc2.id = s.subcategory_id
     LEFT JOIN academic_item ai ON ai.id = s.item_id
     WHERE s.id = ? AND s.institution_id = ?`,
    [req.params.id, req.user.institution_id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Subject not found' });
  res.json(rows[0]);
};

// POST /api/subjects
const createSubject = async (req, res) => {
  const {
    name,
    code,
    subject_code,
    category_id,
    subcategory_id,
    item_id,
    description,
    status
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const id = uuidv4();
    const branchId = null;
    
    await db.query(
      `INSERT INTO subjects (
        id, institution_id, branch_id, name, code, subject_code,
        category_id, subcategory_id, item_id, description, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, req.user.institution_id, branchId, name, code || null, subject_code || null,
        category_id || null, subcategory_id || null, item_id || null, description || null, status || 'active'
      ]
    );
    
    const [rows] = await db.query('SELECT * FROM subjects WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createSubject error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Subject code already exists' });
    }
    res.status(500).json({ error: 'Failed to create subject', detail: err.message });
  }
};

// PUT /api/subjects/:id
const updateSubject = async (req, res) => {
  const fields = [
    'name', 'code', 'subject_code',
    'category_id', 'subcategory_id', 'item_id',
    'description', 'status'
  ];
  
  try {
    const updateParts = [];
    const values = [];

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updateParts.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    }

    if (updateParts.length === 0) {
      return res.json({ message: 'No fields to update' });
    }

    values.push(req.params.id, req.user.institution_id);

    await db.query(
      `UPDATE subjects SET ${updateParts.join(', ')} WHERE id = ? AND institution_id = ?`,
      values
    );
    res.json({ message: 'Subject updated successfully' });
  } catch (err) {
    console.error('updateSubject error:', err);
    res.status(500).json({ error: 'Failed to update subject', detail: err.message });
  }
};

// DELETE /api/subjects/:id
const deleteSubject = async (req, res) => {
  try {
    const subjectId = req.params.id;
    const institutionId = req.user.institution_id;

    // ── Helper: safely check a table only if it exists in the DB ────────────
    const tableExists = async (tableName) => {
      const [rows] = await db.query(
        `SELECT COUNT(*) as cnt 
         FROM information_schema.tables 
         WHERE table_schema = DATABASE() AND table_name = ?`,
        [tableName]
      );
      return rows[0].cnt > 0;
    };

    // ── Check timetable_entries (only if the table exists) ──────────────────
    if (await tableExists('timetable_entries')) {
      const [timetableEntries] = await db.query(
        'SELECT id FROM timetable_entries WHERE subject_id = ? LIMIT 1',
        [subjectId]
      );
      if (timetableEntries.length > 0) {
        return res.status(400).json({
          error: 'Cannot delete subject — it is already used in a timetable.',
        });
      }
    }

    // ── Check exam_schedules (only if the table exists) ─────────────────────
    if (await tableExists('exam_schedules')) {
      const [examRows] = await db.query(
        'SELECT id FROM exam_schedules WHERE subject_id = ? LIMIT 1',
        [subjectId]
      );
      if (examRows.length > 0) {
        return res.status(400).json({
          error: 'Cannot delete subject — it is already used in an exam schedule.',
        });
      }
    }

    // ── Check subject_staff_assignment ───────────────────────────────────────
    if (await tableExists('subject_staff_assignment')) {
      await db.query(
        'DELETE FROM subject_staff_assignment WHERE subject_id = ?',
        [subjectId]
      );
    }

    // ── Finally delete the subject ───────────────────────────────────────────
    const [result] = await db.query(
      'DELETE FROM subjects WHERE id = ? AND institution_id = ?',
      [subjectId, institutionId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Subject not found or already deleted.' });
    }

    res.json({ message: 'Subject deleted successfully' });
  } catch (err) {
    console.error('deleteSubject error:', err);
    res.status(500).json({ error: 'Failed to delete subject', detail: err.message });
  }
};

// POST /api/subjects/:id/assign-staff
const assignStaff = async (req, res) => {
  const { assignments } = req.body;
  const subjectId = req.params.id;
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM subject_staff_assignment WHERE subject_id = ?', [subjectId]);
    
    for (const a of assignments) {
      await conn.query(
        `INSERT INTO subject_staff_assignment (id, subject_id, staff_id, category_id, subcategory_id, item_id) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), subjectId, a.staff_id, a.category_id || null, a.subcategory_id || null, a.item_id || null]
      );
    }
    
    await conn.commit();
    res.json({ message: 'Staff assigned successfully' });
  } catch (err) {
    await conn.rollback();
    console.error('assignStaff error:', err);
    res.status(500).json({ error: 'Failed to assign staff', detail: err.message });
  } finally {
    conn.release();
  }
};

module.exports = { 
  getSubjects, 
  getSubject, 
  createSubject, 
  updateSubject, 
  deleteSubject, 
  assignStaff 
};