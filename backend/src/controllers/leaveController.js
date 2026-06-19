const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get { subcategory_id, item_id } pairs where this user is class teacher
// Returns array of { subcategory_id, item_id } so we can filter by BOTH
// ─────────────────────────────────────────────────────────────────────────────
async function getTeacherClasses(teacherUserId) {
  try {
    const [staffRows] = await db.query(
      `SELECT s.id FROM staff s
       JOIN users u ON LOWER(u.email) = LOWER(s.email)
       WHERE u.id = ?`,
      [teacherUserId]
    );
    if (!staffRows.length) return [];

    const [ctRows] = await db.query(
      `SELECT subcategory_id, item_id FROM class_teachers WHERE staff_id = ?`,
      [staffRows[0].id]
    );
    return ctRows; // [{ subcategory_id, item_id }, ...]
  } catch (err) {
    console.error('getTeacherClasses error:', err.message);
    return [];
  }
}

// Helper: inclusive day count
function calcDays(fromDate, toDate) {
  const from = new Date(fromDate);
  const to   = new Date(toDate);
  if (isNaN(from) || isNaN(to)) return 1;
  return Math.max(1, Math.round((to - from) / 86_400_000) + 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/leave-requests
// ─────────────────────────────────────────────────────────────────────────────
const getLeaveRequests = async (req, res) => {
  try {
    const { status, student_id, leave_type, from_date, to_date } = req.query;
    const { institution_id, role, id: userId, email } = req.user;

    let sql = `
      SELECT
        lr.id,
        lr.institution_id,
        lr.student_id,
        lr.staff_id,
        lr.leave_type,
        lr.start_date,
        lr.end_date,
        lr.from_date,
        lr.to_date,
        lr.no_of_days,
        lr.reason,
        lr.status,
        lr.reject_reason,
        lr.approved_by,
        lr.applied_at,
        lr.approved_at,
        lr.created_at,
        lr.updated_at,
        s.full_name                    AS student_name,
        s.roll_number                  AS register_number,
        s.student_email,
        COALESCE(s.residence_type, '') AS residence_type,
        COALESCE(s.parent_contact, '') AS parent_contact,
        s.subcategory_id,
        s.category_id,
        s.item_id,
        u.full_name                    AS approved_by_name
      FROM leave_requests lr
      LEFT JOIN students s ON s.id  = lr.student_id
      LEFT JOIN users    u ON u.id  = lr.approved_by
      WHERE lr.institution_id = ?
    `;
    const params = [institution_id];

    // ── Role scoping ──────────────────────────────────────────────────────────
    if (role === 'teacher') {
      const teacherClasses = await getTeacherClasses(userId);
      if (!teacherClasses.length) return res.json([]);
      // Filter by BOTH subcategory_id AND item_id so Section A teacher only sees Section A
      const classClauses = teacherClasses.map(c =>
        c.item_id
          ? '(s.subcategory_id = ? AND s.item_id = ?)'
          : '(s.subcategory_id = ?)'
      );
      sql += ` AND (${classClauses.join(' OR ')})`;
      for (const c of teacherClasses) {
        params.push(c.subcategory_id);
        if (c.item_id) params.push(c.item_id);
      }
    }

    if (role === 'student') {
      const [stuRows] = await db.query(
        `SELECT id FROM students
         WHERE LOWER(student_email) = LOWER(?) AND institution_id = ?`,
        [email, institution_id]
      );
      if (!stuRows.length) return res.json([]);
      sql += ' AND lr.student_id = ?';
      params.push(stuRows[0].id);
    }

    // ── Filters ───────────────────────────────────────────────────────────────
    if (status)     { sql += ' AND lr.status = ?';                               params.push(status);     }
    if (student_id) { sql += ' AND lr.student_id = ?';                           params.push(student_id); }
    if (leave_type) { sql += ' AND lr.leave_type = ?';                           params.push(leave_type); }
    if (from_date)  { sql += ' AND COALESCE(lr.from_date, lr.start_date) >= ?';  params.push(from_date);  }
    if (to_date)    { sql += ' AND COALESCE(lr.to_date, lr.end_date) <= ?';      params.push(to_date);    }

    sql += ' ORDER BY COALESCE(lr.applied_at, lr.created_at) DESC';

    const [rows] = await db.query(sql, params);

    // ── Enrich with academic label names ──────────────────────────────────────
    const enriched = await Promise.all(rows.map(async (row) => {
      let category_name    = null;
      let subcategory_name = null;
      let item_name        = null;

      try {
        if (row.subcategory_id) {
          const [sub] = await db.query(
            'SELECT name FROM academic_subcategory WHERE id = ? LIMIT 1',
            [row.subcategory_id]
          );
          subcategory_name = sub[0]?.name || null;
        }
        if (row.category_id) {
          const [cat] = await db.query(
            'SELECT name FROM academic_category WHERE id = ? LIMIT 1',
            [row.category_id]
          );
          category_name = cat[0]?.name || null;
        }
        if (row.item_id) {
          const [itm] = await db.query(
            'SELECT name FROM academic_item WHERE id = ? LIMIT 1',
            [row.item_id]
          );
          item_name = itm[0]?.name || null;
        }
      } catch {
        // academic tables missing — return nulls
      }

      return {
        ...row,
        from_date:  row.from_date  || row.start_date || null,
        to_date:    row.to_date    || row.end_date   || null,
        applied_at: row.applied_at || row.created_at || null,
        category_name,
        subcategory_name,
        item_name,
      };
    }));

    res.json(enriched);
  } catch (err) {
    console.error('getLeaveRequests error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/leave-requests
// ─────────────────────────────────────────────────────────────────────────────
const createLeaveRequest = async (req, res) => {
  try {
    const {
      student_id,
      leave_type = 'other',
      from_date,
      to_date,
      reason,
      // support old field names too
      start_date,
      end_date,
    } = req.body;

    const resolvedFrom = from_date || start_date;
    const resolvedTo   = to_date   || end_date;

    if (!resolvedFrom || !resolvedTo || !reason) {
      return res.status(400).json({ error: 'from_date, to_date and reason are required' });
    }

    // Resolve student for student-role users
    let resolvedStudentId = student_id;
    if (req.user.role === 'student') {
      const [stuRows] = await db.query(
        `SELECT id FROM students
         WHERE LOWER(student_email) = LOWER(?) AND institution_id = ?`,
        [req.user.email, req.user.institution_id]
      );
      if (!stuRows.length) {
        return res.status(404).json({ error: 'Student record not found for this account' });
      }
      resolvedStudentId = stuRows[0].id;
    }

    if (!resolvedStudentId) {
      return res.status(400).json({ error: 'student_id is required' });
    }

    const no_of_days = calcDays(resolvedFrom, resolvedTo);
    const id         = uuidv4();

    await db.query(
      `INSERT INTO leave_requests
         (id, institution_id, student_id,
          leave_type, start_date, end_date, from_date, to_date,
          no_of_days, reason, status, applied_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW(), NOW())`,
      [
        id,
        req.user.institution_id,
        resolvedStudentId,
        leave_type,
        resolvedFrom,
        resolvedTo,
        resolvedFrom,
        resolvedTo,
        no_of_days,
        reason,
      ]
    );

    // Return enriched row
    const [rows] = await db.query(
      `SELECT
         lr.*,
         s.full_name                    AS student_name,
         s.roll_number                  AS register_number,
         s.student_email,
         COALESCE(s.residence_type, '') AS residence_type,
         COALESCE(s.parent_contact, '') AS parent_contact,
         s.subcategory_id,
         s.category_id,
         s.item_id
       FROM leave_requests lr
       LEFT JOIN students s ON s.id = lr.student_id
       WHERE lr.id = ?`,
      [id]
    );

    const row = rows[0];

    // Enrich labels
    let category_name = null, subcategory_name = null, item_name = null;
    try {
      if (row.subcategory_id) {
        const [sub] = await db.query('SELECT name FROM academic_subcategory WHERE id = ? LIMIT 1', [row.subcategory_id]);
        subcategory_name = sub[0]?.name || null;
      }
      if (row.category_id) {
        const [cat] = await db.query('SELECT name FROM academic_category WHERE id = ? LIMIT 1', [row.category_id]);
        category_name = cat[0]?.name || null;
      }
      if (row.item_id) {
        const [itm] = await db.query('SELECT name FROM academic_item WHERE id = ? LIMIT 1', [row.item_id]);
        item_name = itm[0]?.name || null;
      }
    } catch { /* label tables optional */ }

    res.status(201).json({
      ...row,
      from_date:  row.from_date  || row.start_date,
      to_date:    row.to_date    || row.end_date,
      applied_at: row.applied_at || row.created_at,
      category_name,
      subcategory_name,
      item_name,
    });
  } catch (err) {
    console.error('createLeaveRequest error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/leave-requests/:id/approve
// FIX: was referencing undefined `subcategoryIds` — now derived from teacherClasses
// ─────────────────────────────────────────────────────────────────────────────
const approveLeave = async (req, res) => {
  try {
    const { id }                               = req.params;
    const { institution_id, role, id: userId } = req.user;

    const [leaveRows] = await db.query(
      `SELECT lr.*, s.subcategory_id, s.item_id
       FROM leave_requests lr
       LEFT JOIN students s ON s.id = lr.student_id
       WHERE lr.id = ? AND lr.institution_id = ?`,
      [id, institution_id]
    );
    if (!leaveRows.length) {
      return res.status(404).json({ error: 'Leave request not found' });
    }
    const leave = leaveRows[0];

    if (leave.status !== 'pending') {
      return res.status(400).json({ error: `Cannot approve a leave that is already '${leave.status}'` });
    }

    // ── FIX: build subcategoryIds from teacherClasses, not undefined variable ──
    if (role === 'teacher') {
      const teacherClasses = await getTeacherClasses(userId);
      const subcategoryIds = teacherClasses.map(c => c.subcategory_id);
      if (!subcategoryIds.includes(leave.subcategory_id)) {
        return res.status(403).json({ error: 'You are not the class teacher for this student' });
      }
    }

    await db.query(
      `UPDATE leave_requests
       SET status = 'approved', approved_by = ?, approved_at = NOW(), updated_at = NOW()
       WHERE id = ? AND institution_id = ?`,
      [userId, id, institution_id]
    );

    res.json({ success: true, message: 'Leave approved successfully' });
  } catch (err) {
    console.error('approveLeave error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/leave-requests/:id/reject
// FIX: same subcategoryIds bug fixed here too
// ─────────────────────────────────────────────────────────────────────────────
const rejectLeave = async (req, res) => {
  try {
    const { id }                               = req.params;
    const { reason }                           = req.body;
    const { institution_id, role, id: userId } = req.user;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'A rejection reason is required' });
    }

    const [leaveRows] = await db.query(
      `SELECT lr.*, s.subcategory_id, s.item_id
       FROM leave_requests lr
       LEFT JOIN students s ON s.id = lr.student_id
       WHERE lr.id = ? AND lr.institution_id = ?`,
      [id, institution_id]
    );
    if (!leaveRows.length) {
      return res.status(404).json({ error: 'Leave request not found' });
    }
    const leave = leaveRows[0];

    if (leave.status !== 'pending') {
      return res.status(400).json({ error: `Cannot reject a leave that is already '${leave.status}'` });
    }

    // ── FIX: build subcategoryIds from teacherClasses, not undefined variable ──
    if (role === 'teacher') {
      const teacherClasses = await getTeacherClasses(userId);
      const subcategoryIds = teacherClasses.map(c => c.subcategory_id);
      if (!subcategoryIds.includes(leave.subcategory_id)) {
        return res.status(403).json({ error: 'You are not the class teacher for this student' });
      }
    }

    await db.query(
      `UPDATE leave_requests
       SET status = 'rejected', approved_by = ?, approved_at = NOW(),
           reject_reason = ?, updated_at = NOW()
       WHERE id = ? AND institution_id = ?`,
      [userId, reason.trim(), id, institution_id]
    );

    res.json({ success: true, message: 'Leave rejected successfully' });
  } catch (err) {
    console.error('rejectLeave error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/leave-requests/:id
// ─────────────────────────────────────────────────────────────────────────────
const deleteLeaveRequest = async (req, res) => {
  try {
    const { id }                                      = req.params;
    const { institution_id, role, id: userId, email } = req.user;

    const [leaveRows] = await db.query(
      'SELECT * FROM leave_requests WHERE id = ? AND institution_id = ?',
      [id, institution_id]
    );
    if (!leaveRows.length) {
      return res.status(404).json({ error: 'Leave request not found' });
    }
    const leave = leaveRows[0];

    // Students can only soft-cancel their own pending leaves
    if (role === 'student') {
      const [stuRows] = await db.query(
        'SELECT id FROM students WHERE LOWER(student_email) = LOWER(?) AND institution_id = ?',
        [email, institution_id]
      );
      if (leave.student_id !== stuRows[0]?.id) {
        return res.status(403).json({ error: 'You can only cancel your own leave requests' });
      }
      if (leave.status !== 'pending') {
        return res.status(400).json({ error: 'Only pending leaves can be cancelled' });
      }
      await db.query(
        `UPDATE leave_requests SET status = 'cancelled', updated_at = NOW() WHERE id = ?`,
        [id]
      );
      return res.json({ success: true, message: 'Leave request cancelled' });
    }

    // Admin / teacher hard delete
    await db.query(
      'DELETE FROM leave_requests WHERE id = ? AND institution_id = ?',
      [id, institution_id]
    );
    res.json({ success: true, message: 'Leave request deleted' });
  } catch (err) {
    console.error('deleteLeaveRequest error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getLeaveRequests,
  createLeaveRequest,
  approveLeave,
  rejectLeave,
  deleteLeaveRequest,
};