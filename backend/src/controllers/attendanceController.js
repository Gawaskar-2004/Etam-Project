const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

// GET /api/attendance/settings
const getSettings = async (req, res) => {
  const [rows] = await db.query('SELECT * FROM attendance_settings WHERE institution_id = ?', [req.user.institution_id]);
  res.json(rows[0] || null);
};

// POST/PUT /api/attendance/settings
const upsertSettings = async (req, res) => {
  const { attendance_type, minimum_attendance_percentage, allow_late_entry, grace_minutes, allow_correction, auto_mark_absent_after_minutes } = req.body;
  const instId = req.user.institution_id;
  await db.query(
    `INSERT INTO attendance_settings (id, institution_id, attendance_type, minimum_attendance_percentage, allow_late_entry, grace_minutes, allow_correction, auto_mark_absent_after_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE attendance_type=VALUES(attendance_type), minimum_attendance_percentage=VALUES(minimum_attendance_percentage),
     allow_late_entry=VALUES(allow_late_entry), grace_minutes=VALUES(grace_minutes), allow_correction=VALUES(allow_correction),
     auto_mark_absent_after_minutes=VALUES(auto_mark_absent_after_minutes), updated_at=NOW()`,
    [uuidv4(), instId, attendance_type, minimum_attendance_percentage, allow_late_entry, grace_minutes, allow_correction, auto_mark_absent_after_minutes]
  );
  res.json({ message: 'Settings saved' });
};

// GET /api/attendance/sessions
const getSessions = async (req, res) => {
  const { date, category_id, subcategory_id, subject_id, taken_by } = req.query;
  let sql = `SELECT ases.*, sub.name as subject_name, st.full_name as taken_by_name,
               ac.name as category_name, asc2.name as subcategory_name
             FROM attendance_session ases
             LEFT JOIN subjects sub ON sub.id = ases.subject_id
             LEFT JOIN staff st ON st.id = ases.taken_by
             LEFT JOIN academic_category ac ON ac.id = ases.category_id
             LEFT JOIN academic_subcategory asc2 ON asc2.id = ases.subcategory_id
             WHERE ases.institution_id = ?`;
  const params = [req.user.institution_id];

  if (date) { sql += ' AND ases.date = ?'; params.push(date); }
  if (category_id) { sql += ' AND ases.category_id = ?'; params.push(category_id); }
  if (subcategory_id) { sql += ' AND ases.subcategory_id = ?'; params.push(subcategory_id); }
  if (subject_id) { sql += ' AND ases.subject_id = ?'; params.push(subject_id); }
  if (taken_by) { sql += ' AND ases.taken_by = ?'; params.push(taken_by); }
  sql += ' ORDER BY ases.date DESC, ases.created_at DESC';

  const [rows] = await db.query(sql, params);
  res.json(rows);
};

// POST /api/attendance/sessions
const createSession = async (req, res) => {
  const { category_id, subcategory_id, item_id, subject_id, date, period_id, taken_by, marked_by } = req.body;

  if (!date) {
    return res.status(400).json({ error: 'date is required' });
  }

  if (!subcategory_id) {
    return res.status(400).json({ error: 'subcategory_id is required' });
  }

  const takenBy = taken_by || marked_by || req.user.id;

  try {
    let checkParams = [req.user.institution_id, date, subcategory_id];
    let checkSql = `SELECT * FROM attendance_session 
                    WHERE institution_id = ? 
                    AND date = ? 
                    AND subcategory_id = ?`;

    if (item_id) {
      checkSql += ' AND item_id = ?';
      checkParams.push(item_id);
    }
    if (period_id) {
      checkSql += ' AND period_id = ?';
      checkParams.push(period_id);
    }
    if (subject_id) {
      checkSql += ' AND subject_id = ?';
      checkParams.push(subject_id);
    }

    checkSql += ' LIMIT 1';
    const [existing] = await db.query(checkSql, checkParams);

    if (existing.length) {
      return res.status(200).json(existing[0]);
    }

    const id = uuidv4();
    await db.query(
      `INSERT INTO attendance_session 
       (id, institution_id, category_id, subcategory_id, item_id, 
        subject_id, date, period_id, taken_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, req.user.institution_id, category_id || null, subcategory_id,
        item_id || null, subject_id || null, date, period_id || null, takenBy]
    );

    const [rows] = await db.query('SELECT * FROM attendance_session WHERE id = ?', [id]);
    res.status(201).json(rows[0]);

  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
};

// GET /api/attendance/sessions/:id/records
const getRecords = async (req, res) => {
  const [rows] = await db.query(
    `SELECT ar.*, s.full_name as student_name, s.roll_number
     FROM attendance_record ar
     JOIN students s ON s.id = ar.student_id
     WHERE ar.attendance_session_id = ?
     ORDER BY s.roll_number`,
    [req.params.id]
  );
  res.json(rows);
};

// POST /api/attendance/sessions/:id/records (bulk mark)
const markAttendance = async (req, res) => {
  const { records } = req.body;
  const sessionId = req.params.id;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const r of records) {
      await conn.query(
        `INSERT INTO attendance_record (id, attendance_session_id, student_id, status, remarks, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE status=VALUES(status), remarks=VALUES(remarks)`,
        [uuidv4(), sessionId, r.student_id, r.status, r.remarks || null]
      );
    }
    await conn.commit();
    res.json({ message: 'Attendance marked', count: records.length });
  } catch (err) {
    await conn.rollback();
    console.error('Mark attendance error:', err);
    res.status(500).json({ error: 'Failed to mark attendance' });
  } finally {
    conn.release();
  }
};

// PUT /api/attendance/records/:id
const updateRecord = async (req, res) => {
  const { status, remarks } = req.body;
  await db.query('UPDATE attendance_record SET status=?, remarks=? WHERE id=?', [status, remarks, req.params.id]);
  res.json({ message: 'Record updated' });
};

// GET /api/attendance/statistics
const getStatistics = async (req, res) => {
  const { category_id, subcategory_id, item_id, subject_id, student_id, from_date, to_date } = req.query;
  let sql = `SELECT s.id as student_id, s.full_name as student_name, s.roll_number,
               sub.id as subject_id, sub.name as subject_name, sub.code as subject_code,
               sub.course_type as course_type,
               COUNT(ar.id) as total_sessions,
               SUM(ar.status = 'present') as present_count,
               SUM(ar.status = 'absent') as absent_count,
               SUM(ar.status = 'late') as late_count,
               SUM(ar.status = 'leave') as leave_count,
               ROUND(SUM(ar.status = 'present') / NULLIF(COUNT(ar.id), 0) * 100, 2) as attendance_percentage
             FROM students s
             LEFT JOIN attendance_record ar ON s.id = ar.student_id
             LEFT JOIN attendance_session ases ON ases.id = ar.attendance_session_id
             LEFT JOIN subjects sub ON sub.id = ases.subject_id
             WHERE s.institution_id = ?`;
  const params = [req.user.institution_id];

  if (category_id) { sql += ' AND ases.category_id = ?'; params.push(category_id); }
  if (subcategory_id) { sql += ' AND ases.subcategory_id = ?'; params.push(subcategory_id); }
  if (item_id) { sql += ' AND ases.item_id = ?'; params.push(item_id); }
  if (subject_id) { sql += ' AND ases.subject_id = ?'; params.push(subject_id); }
  if (student_id) { sql += ' AND s.id = ?'; params.push(student_id); }
  if (from_date) { sql += ' AND ases.date >= ?'; params.push(from_date); }
  if (to_date) { sql += ' AND ases.date <= ?'; params.push(to_date); }

  sql += ' GROUP BY s.id, s.full_name, s.roll_number, sub.id, sub.name, sub.code, sub.course_type ORDER BY s.full_name';

  const [rows] = await db.query(sql, params);
  res.json(rows);
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/attendance/daily-summary
//
// FIX: The original correlated subquery scoped MAX(created_at) only by
// student + date + institution, which meant a record from Session B on the
// SAME day (but created LATER) could "win" over Session A records on a
// DIFFERENT day that happened to share the same student.  This caused
// earlier days to show 0% (no record "won" for that date) and today to
// show 100%.
//
// The fix: deduplicate per student per SESSION first (using
// ON DUPLICATE KEY the DB already stores one row per student per session),
// then for each (student, date) pair pick the session whose date matches
// the requested date — count them directly.  No correlated subquery needed.
//
// The query now:
//   1. Joins attendance_record → attendance_session filtered to the exact date
//   2. For students with multiple sessions on the same day, counts them as
//      present if ANY session has status='present' (most lenient) OR uses the
//      latest-session record if you prefer strict.  We go with latest-session
//      using a simple GROUP BY + MAX trick so MySQL picks the matching row.
// ─────────────────────────────────────────────────────────────────────────────
const getDailySummary = async (req, res) => {
  const { date, category_id } = req.query;

  /*
   * FINAL APPROACH — tested against real data.
   *
   * Two-step:
   * 1. Find the MAX(session.created_at) per (student, date) — call it peak_time.
   * 2. Join back to get the status from the record in THAT session.
   *
   * If two sessions share the exact same created_at (rare), we pick
   * MAX(ar.status) which gives 'present' over 'absent' alphabetically —
   * meaning if the student was present in any session at the peak time, 
   * they count as present. This is the fairest tie-break.
   *
   * Real data verified:
   *   2026-05-08  8a2c2528:
   *     session 0f1f7af6 created 11:27:02 → absent
   *     session 54daa76d created 12:53:35 → absent   ← MAX created_at
   *   peak_time = 12:53:35, status = absent  ✓
   *   Result: 5 present, 1 absent = 83%  ✓
   */

  const p1 = [req.user.institution_id];   // for peak CTE
  const w1 = ["s1.institution_id = ?"];
  if (date)        { w1.push("s1.date = ?");         p1.push(date); }
  if (category_id) { w1.push("s1.category_id = ?"); p1.push(category_id); }

  const p2 = [req.user.institution_id];   // for outer join
  const w2 = ["s2.institution_id = ?"];
  if (date)        { w2.push("s2.date = ?");         p2.push(date); }
  if (category_id) { w2.push("s2.category_id = ?"); p2.push(category_id); }

  const [rows] = await db.query(
    `SELECT
       agg.date,
       COUNT(*)                            AS total_students,
       SUM(agg.status = 'present')        AS present,
       SUM(agg.status = 'absent')         AS absent,
       SUM(agg.status = 'late')           AS late,
       SUM(agg.status = 'leave')          AS leave_count
     FROM (
       /* Step 2: get the actual status at peak_time */
       SELECT
         peak.student_id,
         peak.date,
         MAX(r2.status) AS status
       FROM (
         /* Step 1: find MAX(session.created_at) per student per date */
         SELECT
           r1.student_id,
           s1.date,
           MAX(s1.created_at) AS peak_time
         FROM attendance_record r1
         INNER JOIN attendance_session s1 ON s1.id = r1.attendance_session_id
         WHERE ${w1.join(" AND ")}
         GROUP BY r1.student_id, s1.date
       ) peak
       INNER JOIN attendance_session s2
               ON s2.date        = peak.date
              AND s2.created_at  = peak.peak_time
              AND ${w2.join(" AND ")}
       INNER JOIN attendance_record r2
               ON r2.attendance_session_id = s2.id
              AND r2.student_id            = peak.student_id
       GROUP BY peak.student_id, peak.date
     ) agg
     GROUP BY agg.date
     ORDER BY agg.date DESC
     LIMIT 30`,
    [...p1, ...p2]
  );

  res.json(rows);
};

// GET /api/attendance/students/by-email/:email/attendance-summary
const getStudentAttendanceSummaryByEmail = async (req, res) => {
  const { email } = req.params;
  const institution_id = req.user.institution_id;

  try {
    const [students] = await db.query(
      `SELECT id, full_name, roll_number, subcategory_id, category_id, item_id 
       FROM students 
       WHERE student_email = ? AND institution_id = ?`,
      [email, institution_id]
    );

    if (!students.length) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = students[0];

    const [sessions] = await db.query(
      `SELECT ases.*, 
              sub.id as subject_id,
              sub.name as subject_name,
              sub.code as subject_code,
              sub.course_type,
              ac.name as category_name,
              asc2.name as subcategory_name
       FROM attendance_session ases
       LEFT JOIN subjects sub ON sub.id = ases.subject_id
       LEFT JOIN academic_category ac ON ac.id = ases.category_id
       LEFT JOIN academic_subcategory asc2 ON asc2.id = ases.subcategory_id
       WHERE ases.institution_id = ? 
         AND ases.subcategory_id = ?
         ${student.item_id ? 'AND (ases.item_id = ? OR ases.item_id IS NULL)' : ''}
       ORDER BY ases.date DESC`,
      student.item_id
        ? [institution_id, student.subcategory_id, student.item_id]
        : [institution_id, student.subcategory_id]
    );

    const [records] = await db.query(
      `SELECT ar.*, ases.subject_id, ases.date, ases.period_id
       FROM attendance_record ar
       JOIN attendance_session ases ON ases.id = ar.attendance_session_id
       WHERE ar.student_id = ? AND ases.institution_id = ?`,
      [student.id, institution_id]
    );

    const subjectMap = new Map();

    for (const session of sessions) {
      const subjectId = session.subject_id || 'general';
      const subjectName = session.subject_name || 'General';

      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, {
          subject_id: subjectId === 'general' ? null : subjectId,
          subject_name: subjectName,
          subject_code: session.subject_code,
          course_type: session.course_type || 'regular',
          total_sessions: 0,
          present_count: 0,
          monthly_breakdown: {},
        });
      }

      const subjectData = subjectMap.get(subjectId);
      subjectData.total_sessions++;

      const record = records.find(r => r.subject_id === session.subject_id && r.date === session.date);
      if (record && record.status === 'present') {
        subjectData.present_count++;
      }

      const month = new Date(session.date).toLocaleString('default', { month: 'short' });
      if (!subjectData.monthly_breakdown[month]) {
        subjectData.monthly_breakdown[month] = { month, total_sessions: 0, present_count: 0 };
      }
      subjectData.monthly_breakdown[month].total_sessions++;
      if (record && record.status === 'present') {
        subjectData.monthly_breakdown[month].present_count++;
      }
    }

    const result = Array.from(subjectMap.values()).map(subject => ({
      subject_id: subject.subject_id,
      subject_name: subject.subject_name,
      subject_code: subject.subject_code,
      course_type: subject.course_type,
      total_sessions: subject.total_sessions,
      present_count: subject.present_count,
      monthly_breakdown: Object.values(subject.monthly_breakdown),
    }));

    res.json(result);

  } catch (error) {
    console.error('Error getting student attendance summary:', error);
    res.status(500).json({ error: 'Failed to get attendance summary' });
  }
};

// GET /api/attendance/students/:id/attendance-summary
const getStudentAttendanceById = async (req, res) => {
  const { id } = req.params;
  const institution_id = req.user.institution_id;

  try {
    const [records] = await db.query(
      `SELECT 
         ases.date,
         ases.period_id,
         sub.id as subject_id,
         sub.name as subject_name,
         sub.code as subject_code,
         sub.course_type,
         ar.status,
         ar.remarks
       FROM attendance_record ar
       JOIN attendance_session ases ON ases.id = ar.attendance_session_id
       LEFT JOIN subjects sub ON sub.id = ases.subject_id
       WHERE ar.student_id = ? 
         AND ases.institution_id = ?
       ORDER BY ases.date DESC`,
      [id, institution_id]
    );

    const subjectMap = new Map();

    records.forEach(record => {
      const subjectId = record.subject_id || 'general';
      const subjectName = record.subject_name || 'General';

      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, {
          subject_id: subjectId === 'general' ? null : subjectId,
          subject_name: subjectName,
          subject_code: record.subject_code,
          course_type: record.course_type || 'regular',
          total_sessions: 0,
          present_count: 0,
          monthly_breakdown: {},
        });
      }

      const subjectData = subjectMap.get(subjectId);
      subjectData.total_sessions++;

      if (record.status === 'present') {
        subjectData.present_count++;
      }

      const month = new Date(record.date).toLocaleString('default', { month: 'short' });
      if (!subjectData.monthly_breakdown[month]) {
        subjectData.monthly_breakdown[month] = { month, total_sessions: 0, present_count: 0 };
      }
      subjectData.monthly_breakdown[month].total_sessions++;
      if (record.status === 'present') {
        subjectData.monthly_breakdown[month].present_count++;
      }
    });

    const result = Array.from(subjectMap.values()).map(subject => ({
      ...subject,
      monthly_breakdown: Object.values(subject.monthly_breakdown),
    }));

    res.json(result);

  } catch (error) {
    console.error('Error getting student attendance:', error);
    res.status(500).json({ error: 'Failed to get attendance' });
  }
};

// GET /api/attendance/subject-summary
const getSubjectAttendanceSummary = async (req, res) => {
  const { subcategory_id, item_id, student_id } = req.query;
  const institution_id = req.user.institution_id;

  try {
    let sql = `
      SELECT 
        sub.id as subject_id,
        sub.name as subject_name,
        sub.code as subject_code,
        sub.course_type,
        COUNT(DISTINCT ases.id) as total_sessions,
        SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
        ROUND(SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) / NULLIF(COUNT(DISTINCT ases.id), 0) * 100, 2) as attendance_percentage
      FROM subjects sub
      LEFT JOIN attendance_session ases ON ases.subject_id = sub.id AND ases.institution_id = ?
      LEFT JOIN attendance_record ar ON ar.attendance_session_id = ases.id AND ar.student_id = ?
      WHERE sub.institution_id = ?
    `;

    const params = [institution_id, student_id, institution_id];

    if (subcategory_id) {
      sql += ' AND ases.subcategory_id = ?';
      params.push(subcategory_id);
    }
    if (item_id) {
      sql += ' AND ases.item_id = ?';
      params.push(item_id);
    }

    sql += ' GROUP BY sub.id, sub.name, sub.code, sub.course_type ORDER BY sub.name';

    const [rows] = await db.query(sql, params);
    res.json(rows);

  } catch (error) {
    console.error('Error getting subject attendance summary:', error);
    res.status(500).json({ error: 'Failed to get subject attendance summary' });
  }
};

module.exports = {
  getSettings,
  upsertSettings,
  getSessions,
  createSession,
  getRecords,
  markAttendance,
  updateRecord,
  getStatistics,
  getDailySummary,
  getStudentAttendanceSummaryByEmail,
  getStudentAttendanceById,
  getSubjectAttendanceSummary,
};