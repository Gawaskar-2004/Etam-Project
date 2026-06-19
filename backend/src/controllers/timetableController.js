const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────

/** Validate HH:MM:SS or HH:MM time strings */
const isValidTime = (t) => /^\d{2}:\d{2}(:\d{2})?$/.test(t ?? '');

/** Run a callback inside a transaction; auto-rollback on error */
const withTransaction = async (fn) => {
  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/** Standard error logger + responder */
const fail = (res, status, message, err = null) => {
  if (err) console.error(`[Timetable] ${message}:`, err);
  return res.status(status).json({ error: message });
};

// ─────────────────────────────────────────────────────────────────────
// PERIOD MASTER
// ─────────────────────────────────────────────────────────────────────

const getPeriods = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM period_master WHERE institution_id = ? ORDER BY period_number',
      [req.user.institution_id]
    );
    res.json(rows);
  } catch (err) {
    fail(res, 500, 'Failed to fetch periods', err);
  }
};

const createPeriod = async (req, res) => {
  const { period_number, start_time, end_time, is_break, break_duration } = req.body;

  if (!period_number || !start_time || !end_time)
    return fail(res, 400, 'period_number, start_time, and end_time are required');
  if (!isValidTime(start_time) || !isValidTime(end_time))
    return fail(res, 400, 'start_time and end_time must be in HH:MM or HH:MM:SS format');
  if (typeof period_number !== 'number' || period_number < 1 || period_number > 20)
    return fail(res, 400, 'period_number must be between 1 and 20');

  try {
    const id = uuidv4();
    await db.query(
      `INSERT INTO period_master (id, institution_id, period_number, start_time, end_time, is_break, break_duration)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.institution_id, period_number, start_time, end_time, is_break || false, break_duration || null]
    );
    const [rows] = await db.query('SELECT * FROM period_master WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return fail(res, 409, 'Period number already exists for this institution');
    fail(res, 500, 'Failed to create period', err);
  }
};

const updatePeriod = async (req, res) => {
  const { period_number, start_time, end_time, is_break, break_duration } = req.body;

  if (!start_time || !end_time)
    return fail(res, 400, 'start_time and end_time are required');
  if (!isValidTime(start_time) || !isValidTime(end_time))
    return fail(res, 400, 'start_time and end_time must be in HH:MM or HH:MM:SS format');

  try {
    const [result] = await db.query(
      `UPDATE period_master SET period_number=?, start_time=?, end_time=?, is_break=?, break_duration=?
       WHERE id=? AND institution_id=?`,
      [period_number, start_time, end_time, is_break ?? false, break_duration || null, req.params.id, req.user.institution_id]
    );
    if (result.affectedRows === 0) return fail(res, 404, 'Period not found');
    res.json({ message: 'Period updated' });
  } catch (err) {
    fail(res, 500, 'Failed to update period', err);
  }
};

const deletePeriod = async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM period_master WHERE id = ? AND institution_id = ?',
      [req.params.id, req.user.institution_id]
    );
    if (result.affectedRows === 0) return fail(res, 404, 'Period not found');
    res.json({ message: 'Period deleted' });
  } catch (err) {
    fail(res, 500, 'Failed to delete period', err);
  }
};

/**
 * POST /api/periods/sync
 * Upsert all period times at once from timetable config.
 * Runs inside a single transaction — all-or-nothing.
 */
const syncPeriods = async (req, res) => {
  const { periods } = req.body;

  if (!Array.isArray(periods) || periods.length === 0)
    return fail(res, 400, 'periods array is required and must not be empty');
  if (periods.length > 30)
    return fail(res, 400, 'periods array must not exceed 30 entries');

  for (const p of periods) {
    if (!p.period_number || !p.start_time || !p.end_time)
      return fail(res, 400, `Each period must have period_number, start_time, and end_time (failed on period ${p.period_number ?? '?'})`);
    if (!isValidTime(p.start_time) || !isValidTime(p.end_time))
      return fail(res, 400, `Invalid time format for period ${p.period_number}`);
  }

  try {
    await withTransaction(async (conn) => {
      for (const p of periods) {
        const [existing] = await conn.query(
          'SELECT id FROM period_master WHERE institution_id = ? AND period_number = ?',
          [req.user.institution_id, p.period_number]
        );
        if (existing.length) {
          await conn.query(
            'UPDATE period_master SET start_time=?, end_time=?, is_break=?, break_duration=? WHERE id=?',
            [p.start_time, p.end_time, p.is_break || false, p.break_duration || null, existing[0].id]
          );
        } else {
          await conn.query(
            `INSERT INTO period_master (id, institution_id, period_number, start_time, end_time, is_break, break_duration)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), req.user.institution_id, p.period_number, p.start_time, p.end_time, p.is_break || false, p.break_duration || null]
          );
        }
      }
    });
    res.json({ message: 'Periods synced', count: periods.length });
  } catch (err) {
    fail(res, 500, 'Failed to sync periods — transaction rolled back', err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// TIMETABLE CONFIGURATION
// ─────────────────────────────────────────────────────────────────────

const saveTimetableConfig = async (req, res) => {
  const { category_id, subcategory_id, item_id, config } = req.body;

  if (!category_id || !subcategory_id || !item_id || !config)
    return fail(res, 400, 'category_id, subcategory_id, item_id, and config are required');
  if (typeof config !== 'object' || Array.isArray(config))
    return fail(res, 400, 'config must be a JSON object');

  try {
    await db.query(
      `INSERT INTO timetable_config (id, institution_id, category_id, subcategory_id, item_id, config)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE config = VALUES(config), updated_at = NOW()`,
      [uuidv4(), req.user.institution_id, category_id, subcategory_id, item_id, JSON.stringify(config)]
    );
    res.json({ success: true, message: 'Timetable configuration saved' });
  } catch (err) {
    fail(res, 500, 'Failed to save configuration', err);
  }
};

const getTimetableConfig = async (req, res) => {
  const { category_id, subcategory_id, item_id } = req.query;

  if (!category_id || !subcategory_id || !item_id)
    return fail(res, 400, 'category_id, subcategory_id, and item_id are required');

  try {
    const [rows] = await db.query(
      `SELECT config FROM timetable_config
       WHERE institution_id = ? AND category_id = ? AND subcategory_id = ? AND item_id = ?`,
      [req.user.institution_id, category_id, subcategory_id, item_id]
    );
    if (rows.length === 0) return fail(res, 404, 'Configuration not found');
    const parsed = typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : rows[0].config;
    res.json(parsed);
  } catch (err) {
    fail(res, 500, 'Failed to retrieve configuration', err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// TIMETABLE (legacy — kept for compatibility)
// ─────────────────────────────────────────────────────────────────────

const getTimetable = async (req, res) => {
  const { category_id, subcategory_id, item_id, academic_year, day_of_week } = req.query;
  try {
    let sql = `
      SELECT t.*, s.name as subject_name, s.code as subject_code,
             st.full_name as staff_name, st.staff_code,
             pm.start_time as period_start, pm.end_time as period_end
      FROM timetable t
      LEFT JOIN subjects s ON s.id = t.subject_id
      LEFT JOIN staff st ON st.id = t.staff_id
      LEFT JOIN period_master pm ON pm.id = t.period_id
      WHERE t.institution_id = ?`;
    const params = [req.user.institution_id];

    if (category_id)    { sql += ' AND t.category_id = ?';    params.push(category_id); }
    if (subcategory_id) { sql += ' AND t.subcategory_id = ?'; params.push(subcategory_id); }
    if (item_id)        { sql += ' AND t.item_id = ?';        params.push(item_id); }
    if (academic_year)  { sql += ' AND t.academic_year = ?';  params.push(academic_year); }
    if (day_of_week)    { sql += ' AND t.day_of_week = ?';    params.push(day_of_week); }
    sql += ' ORDER BY t.day_of_week, t.period_number';

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    fail(res, 500, 'Failed to fetch timetable', err);
  }
};

const createTimetableEntry = async (req, res) => {
  const {
    branch_id, category_id, subcategory_id, item_id, academic_year,
    day_of_week, period_number, period_id, start_time, end_time, subject_id, staff_id,
  } = req.body;

  if (!category_id || !subcategory_id || !day_of_week || !period_number)
    return fail(res, 400, 'category_id, subcategory_id, day_of_week, and period_number are required');

  try {
    if (staff_id && day_of_week) {
      const [conflict] = await db.query(
        `SELECT id FROM timetable
         WHERE staff_id = ? AND day_of_week = ? AND institution_id = ? AND period_number = ?`,
        [staff_id, day_of_week, req.user.institution_id, period_number]
      );
      if (conflict.length)
        return fail(res, 409, 'Teacher is already assigned to another class at this period and day');
    }

    const id = uuidv4();
    await db.query(
      `INSERT INTO timetable
         (id, institution_id, branch_id, category_id, subcategory_id, item_id, academic_year,
          day_of_week, period_number, period_id, start_time, end_time, subject_id, staff_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.institution_id, branch_id, category_id, subcategory_id, item_id, academic_year,
       day_of_week, period_number, period_id, start_time, end_time, subject_id, staff_id]
    );
    const [rows] = await db.query('SELECT * FROM timetable WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    fail(res, 500, 'Failed to create timetable entry', err);
  }
};

const updateTimetableEntry = async (req, res) => {
  const { day_of_week, period_number, period_id, start_time, end_time, subject_id, staff_id, is_locked } = req.body;
  try {
    const [result] = await db.query(
      `UPDATE timetable
       SET day_of_week=?, period_number=?, period_id=?, start_time=?, end_time=?,
           subject_id=?, staff_id=?, is_locked=?
       WHERE id=? AND institution_id=?`,
      [day_of_week, period_number, period_id, start_time, end_time,
       subject_id, staff_id, is_locked ?? false, req.params.id, req.user.institution_id]
    );
    if (result.affectedRows === 0) return fail(res, 404, 'Timetable entry not found');
    res.json({ message: 'Timetable entry updated' });
  } catch (err) {
    fail(res, 500, 'Failed to update timetable entry', err);
  }
};

const deleteTimetableEntry = async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM timetable WHERE id = ? AND institution_id = ?',
      [req.params.id, req.user.institution_id]
    );
    if (result.affectedRows === 0) return fail(res, 404, 'Timetable entry not found');
    res.json({ message: 'Entry deleted' });
  } catch (err) {
    fail(res, 500, 'Failed to delete timetable entry', err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// TIMETABLE ASSIGNMENTS  ✅ FIXED — duplicate periods removed
// ─────────────────────────────────────────────────────────────────────

const VALID_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const buildClassName = (row) => {
  const parts = [row.category_name, row.subcategory_name, row.item_name].filter(Boolean);
  return parts.join(' ') || 'Class';
};

const getTimetableAssignments = async (req, res) => {
  let { category_id, subcategory_id, item_id, staff_id, user_id } = req.query;

  try {
    // Resolve user_id → staff_id for teacher view
    if (user_id && !staff_id) {
      const [staffRows] = await db.query(
        'SELECT id FROM staff WHERE user_id = ? AND institution_id = ? LIMIT 1',
        [user_id, req.user.institution_id]
      );
      if (staffRows.length) {
        staff_id = staffRows[0].id;
      } else {
        const [userRows] = await db.query('SELECT email FROM users WHERE id = ? LIMIT 1', [user_id]);
        if (userRows.length) {
          const [staffByEmail] = await db.query(
            'SELECT id FROM staff WHERE email = ? AND institution_id = ? LIMIT 1',
            [userRows[0].email, req.user.institution_id]
          );
          if (staffByEmail.length) staff_id = staffByEmail[0].id;
        }
      }
    }

    let sql = `
      SELECT
        ta.id,
        ta.period_number,
        ta.day,
        ta.category_id,
        ta.subcategory_id,
        ta.item_id,
        ta.staff_id,
        ta.subject_id,
        ta.created_at,
        ta.updated_at,
        s.name  AS subject_name,
        st.full_name AS staff_name,
        st.staff_code,
        cat.name AS category_name,
        cat.academic_year,
        sub.name AS subcategory_name,
        it.name  AS item_name,
        it.capacity,
        MIN(pm.start_time) AS period_start_time,
        MIN(pm.end_time)   AS period_end_time,
        MIN(pm.is_break)   AS period_is_break
      FROM timetable_assignments ta
      LEFT JOIN subjects          s   ON s.id   = ta.subject_id
      LEFT JOIN staff             st  ON st.id  = ta.staff_id
      LEFT JOIN academic_category cat ON cat.id = ta.category_id
      LEFT JOIN academic_subcategory sub ON sub.id = ta.subcategory_id
      LEFT JOIN academic_item     it  ON it.id  = ta.item_id
      LEFT JOIN period_master     pm  ON pm.institution_id = ta.institution_id
                                     AND pm.period_number  = ta.period_number
      WHERE ta.institution_id = ?`;

    const params = [req.user.institution_id];
    if (category_id)    { sql += ' AND ta.category_id = ?';    params.push(category_id); }
    if (subcategory_id) { sql += ' AND ta.subcategory_id = ?'; params.push(subcategory_id); }
    if (item_id)        { sql += ' AND ta.item_id = ?';        params.push(item_id); }
    if (staff_id)       { sql += ' AND ta.staff_id = ?';       params.push(staff_id); }

    // ✅ FIX: GROUP BY ta.id prevents duplicate rows from period_master JOIN
    sql += ` GROUP BY ta.id, ta.period_number, ta.day, ta.category_id, ta.subcategory_id,
             ta.item_id, ta.staff_id, ta.subject_id, ta.created_at, ta.updated_at,
             s.name, st.full_name, st.staff_code, cat.name, cat.academic_year,
             sub.name, it.name, it.capacity`;

    sql += ` ORDER BY FIELD(ta.day, 'MON','TUE','WED','THU','FRI','SAT','SUN'), ta.period_number`;

    const [rows] = await db.query(sql, params);

    const formatted = rows.map((row) => ({
      id:               row.id,
      period_number:    row.period_number,
      day:              row.day,
      subject_name:     row.subject_name  || 'Unknown Subject',
      subject_id:       row.subject_id,
      staff_name:       row.staff_name    || 'Unknown Staff',
      staff_id:         row.staff_id,
      category_id:      row.category_id,
      category_name:    row.category_name,
      subcategory_id:   row.subcategory_id,
      subcategory_name: row.subcategory_name,
      item_id:          row.item_id,
      item_name:        row.item_name,
      full_class_name:  buildClassName(row),
      class_name:       row.subcategory_name || row.category_name,
      capacity:         row.capacity,
      start_time:       row.period_start_time || null,
      end_time:         row.period_end_time   || null,
      is_break:         row.period_is_break   || false,
    }));

    res.json(formatted);
  } catch (err) {
    fail(res, 500, 'Failed to fetch assignments', err);
  }
};

/**
 * POST   /api/timetable-assignments       → create
 * PUT    /api/timetable-assignments/:id   → update
 */
const WEEKLY_PERIOD_CAP = parseInt(process.env.TEACHER_WEEKLY_PERIOD_CAP || '40', 10);

const upsertTimetableAssignment = async (req, res) => {
  const { category_id, subcategory_id, item_id, period_number, day, staff_id, subject_id } = req.body;
  const isUpdate = Boolean(req.params.id);

  if (!category_id || !subcategory_id || !period_number || !day || !staff_id || !subject_id)
    return fail(res, 400, 'category_id, subcategory_id, period_number, day, staff_id, and subject_id are all required');

  if (!VALID_DAYS.includes(day.toUpperCase()))
    return fail(res, 400, `day must be one of: ${VALID_DAYS.join(', ')}`);

  const pn = parseInt(period_number, 10);
  if (isNaN(pn) || pn < 1 || pn > 20)
    return fail(res, 400, 'period_number must be an integer between 1 and 20');

  try {
    const conflictQuery = isUpdate
      ? `SELECT ta.id, it.name as item_name, cat.name as category_name, sub.name as subcategory_name
         FROM timetable_assignments ta
         LEFT JOIN academic_item it ON it.id = ta.item_id
         LEFT JOIN academic_category cat ON cat.id = ta.category_id
         LEFT JOIN academic_subcategory sub ON sub.id = ta.subcategory_id
         WHERE ta.staff_id = ? AND ta.day = ? AND ta.period_number = ?
           AND ta.institution_id = ? AND ta.id != ?`
      : `SELECT ta.id, it.name as item_name, cat.name as category_name, sub.name as subcategory_name
         FROM timetable_assignments ta
         LEFT JOIN academic_item it ON it.id = ta.item_id
         LEFT JOIN academic_category cat ON cat.id = ta.category_id
         LEFT JOIN academic_subcategory sub ON sub.id = ta.subcategory_id
         WHERE ta.staff_id = ? AND ta.day = ? AND ta.period_number = ?
           AND ta.institution_id = ?`;

    const conflictParams = isUpdate
      ? [staff_id, day, pn, req.user.institution_id, req.params.id]
      : [staff_id, day, pn, req.user.institution_id];

    const [conflicts] = await db.query(conflictQuery, conflictParams);
    if (conflicts.length) {
      const c = conflicts[0];
      const sectionName = [c.category_name, c.subcategory_name, c.item_name].filter(Boolean).join(' ');
      return fail(res, 409, `Teacher conflict: this teacher is already assigned to Period ${pn} on ${day} in "${sectionName}"`);
    }

    if (!isUpdate) {
      const dupSlotSql = item_id
        ? `SELECT id FROM timetable_assignments
           WHERE institution_id = ? AND category_id = ? AND subcategory_id = ?
             AND item_id = ? AND period_number = ? AND day = ?`
        : `SELECT id FROM timetable_assignments
           WHERE institution_id = ? AND category_id = ? AND subcategory_id = ?
             AND item_id IS NULL AND period_number = ? AND day = ?`;

      const dupSlotParams = item_id
        ? [req.user.institution_id, category_id, subcategory_id, item_id, pn, day]
        : [req.user.institution_id, category_id, subcategory_id, pn, day];

      const [dupSlot] = await db.query(dupSlotSql, dupSlotParams);
      if (dupSlot.length)
        return fail(res, 409, `A subject is already assigned to Period ${pn} on ${day} for this section. Update the existing assignment instead.`);
    }

    const workloadQuery = isUpdate
      ? `SELECT COUNT(*) as total FROM timetable_assignments
         WHERE staff_id = ? AND institution_id = ? AND id != ?`
      : `SELECT COUNT(*) as total FROM timetable_assignments
         WHERE staff_id = ? AND institution_id = ?`;

    const workloadParams = isUpdate
      ? [staff_id, req.user.institution_id, req.params.id]
      : [staff_id, req.user.institution_id];

    const [[{ total }]] = await db.query(workloadQuery, workloadParams);
    if (total >= WEEKLY_PERIOD_CAP)
      return fail(res, 422, `Teacher has reached the weekly period cap of ${WEEKLY_PERIOD_CAP} periods`);

    if (isUpdate) {
      const [result] = await db.query(
        `UPDATE timetable_assignments
         SET staff_id=?, subject_id=?, updated_at=NOW()
         WHERE id=? AND institution_id=?`,
        [staff_id, subject_id, req.params.id, req.user.institution_id]
      );
      if (result.affectedRows === 0) return fail(res, 404, 'Assignment not found');

      const [rows] = await db.query(
        `SELECT ta.*, s.name AS subject_name, st.full_name AS staff_name,
                cat.name AS category_name, sub.name AS subcategory_name, it.name AS item_name
         FROM timetable_assignments ta
         LEFT JOIN subjects s ON s.id = ta.subject_id
         LEFT JOIN staff st ON st.id = ta.staff_id
         LEFT JOIN academic_category cat ON cat.id = ta.category_id
         LEFT JOIN academic_subcategory sub ON sub.id = ta.subcategory_id
         LEFT JOIN academic_item it ON it.id = ta.item_id
         WHERE ta.id = ? AND ta.institution_id = ?`,
        [req.params.id, req.user.institution_id]
      );
      const row = rows[0];
      if (row) row.full_class_name = buildClassName(row);
      return res.json(row || { message: 'Assignment updated' });
    }

    const id = uuidv4();
    await db.query(
      `INSERT INTO timetable_assignments
         (id, institution_id, category_id, subcategory_id, item_id, period_number, day, staff_id, subject_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.institution_id, category_id, subcategory_id, item_id || null, pn, day, staff_id, subject_id]
    );

    const [rows] = await db.query(
      `SELECT ta.*, s.name AS subject_name, st.full_name AS staff_name,
              cat.name AS category_name, sub.name AS subcategory_name, it.name AS item_name
       FROM timetable_assignments ta
       LEFT JOIN subjects s ON s.id = ta.subject_id
       LEFT JOIN staff st ON st.id = ta.staff_id
       LEFT JOIN academic_category cat ON cat.id = ta.category_id
       LEFT JOIN academic_subcategory sub ON sub.id = ta.subcategory_id
       LEFT JOIN academic_item it ON it.id = ta.item_id
       WHERE ta.id = ?`,
      [id]
    );
    const row = rows[0];
    if (row) row.full_class_name = buildClassName(row);
    res.status(201).json(row || { id, message: 'Assignment saved' });

  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return fail(res, 409, `A subject is already assigned to Period ${pn} on ${day} for this section. Update the existing assignment instead.`);
    }
    fail(res, 500, 'Failed to save assignment', err);
  }
};

const deleteTimetableAssignment = async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM timetable_assignments WHERE id = ? AND institution_id = ?',
      [req.params.id, req.user.institution_id]
    );
    if (result.affectedRows === 0) return fail(res, 404, 'Assignment not found');
    res.json({ message: 'Assignment deleted' });
  } catch (err) {
    fail(res, 500, 'Failed to delete assignment', err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// WORKLOAD SUMMARY
// ─────────────────────────────────────────────────────────────────────
const getTeacherWorkload = async (req, res) => {
  const { category_id, subcategory_id, item_id } = req.query;
  try {
    let sql = `
      SELECT
        ta.staff_id,
        st.full_name AS staff_name,
        st.staff_code,
        COUNT(*) AS total_periods,
        SUM(CASE WHEN ta.day = 'MON' THEN 1 ELSE 0 END) AS mon,
        SUM(CASE WHEN ta.day = 'TUE' THEN 1 ELSE 0 END) AS tue,
        SUM(CASE WHEN ta.day = 'WED' THEN 1 ELSE 0 END) AS wed,
        SUM(CASE WHEN ta.day = 'THU' THEN 1 ELSE 0 END) AS thu,
        SUM(CASE WHEN ta.day = 'FRI' THEN 1 ELSE 0 END) AS fri,
        SUM(CASE WHEN ta.day = 'SAT' THEN 1 ELSE 0 END) AS sat
      FROM timetable_assignments ta
      LEFT JOIN staff st ON st.id = ta.staff_id
      WHERE ta.institution_id = ?`;

    const params = [req.user.institution_id];
    if (category_id)    { sql += ' AND ta.category_id = ?';    params.push(category_id); }
    if (subcategory_id) { sql += ' AND ta.subcategory_id = ?'; params.push(subcategory_id); }
    if (item_id)        { sql += ' AND ta.item_id = ?';        params.push(item_id); }

    sql += ' GROUP BY ta.staff_id, st.full_name, st.staff_code ORDER BY total_periods DESC';

    const [rows] = await db.query(sql, params);
    res.json({ workload: rows, cap: WEEKLY_PERIOD_CAP });
  } catch (err) {
    fail(res, 500, 'Failed to fetch workload', err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// CLASS TEACHERS
// ─────────────────────────────────────────────────────────────────────

const getClassTeachers = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ct.*,
              st.full_name AS staff_name,
              st.staff_code,
              cat.name AS category_name,
              sub.name AS subcategory_name,
              it.name  AS item_name
       FROM class_teachers ct
       LEFT JOIN staff st ON st.id = ct.staff_id
       LEFT JOIN academic_category cat ON cat.id = ct.category_id
       LEFT JOIN academic_subcategory sub ON sub.id = ct.subcategory_id
       LEFT JOIN academic_item it ON it.id = ct.item_id
       WHERE ct.institution_id = ?`,
      [req.user.institution_id]
    );
    res.json(rows);
  } catch (err) {
    fail(res, 500, 'Failed to fetch class teachers', err);
  }
};

const upsertClassTeacher = async (req, res) => {
  const { category_id, subcategory_id, item_id, staff_id } = req.body;

  if (!category_id || !subcategory_id || !staff_id)
    return fail(res, 400, 'category_id, subcategory_id, and staff_id are required');

  try {
    const [staffCheck] = await db.query(
      'SELECT id FROM staff WHERE id = ? AND institution_id = ?',
      [staff_id, req.user.institution_id]
    );
    if (!staffCheck.length) return fail(res, 404, 'Staff member not found in this institution');

    const id = uuidv4();
    await db.query(
      `INSERT INTO class_teachers (id, institution_id, category_id, subcategory_id, item_id, staff_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE staff_id=VALUES(staff_id), item_id=VALUES(item_id), updated_at=NOW()`,
      [id, req.user.institution_id, category_id, subcategory_id, item_id || null, staff_id]
    );

    const [rows] = await db.query(
      `SELECT ct.*,
              st.full_name AS staff_name,
              cat.name AS category_name,
              sub.name AS subcategory_name,
              it.name  AS item_name
       FROM class_teachers ct
       LEFT JOIN staff st ON st.id = ct.staff_id
       LEFT JOIN academic_category cat ON cat.id = ct.category_id
       LEFT JOIN academic_subcategory sub ON sub.id = ct.subcategory_id
       LEFT JOIN academic_item it ON it.id = ct.item_id
       WHERE ct.institution_id = ? AND ct.category_id = ? AND ct.subcategory_id = ?
         AND COALESCE(ct.item_id, '') = ?
       LIMIT 1`,
      [req.user.institution_id, category_id, subcategory_id, item_id || '']
    );

    res.status(201).json(rows[0] || { message: 'Class teacher assigned' });
  } catch (err) {
    fail(res, 500, 'Failed to assign class teacher', err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// DEBUG
// ─────────────────────────────────────────────────────────────────────

const debugTimetable = async (req, res) => {
  if (process.env.NODE_ENV === 'production')
    return fail(res, 403, 'Debug endpoint is disabled in production');

  const { staff_id } = req.query;
  if (!staff_id) return fail(res, 400, 'staff_id is required');

  try {
    const [rows] = await db.query(
      `SELECT
         ta.id, ta.period_number, ta.day,
         ta.category_id, ta.subcategory_id, ta.item_id,
         cat.name AS category_name,
         sub.name AS subcategory_name,
         it.name  AS item_name,
         s.name   AS subject_name,
         CONCAT_WS(' ',
           NULLIF(cat.name, ''),
           NULLIF(sub.name, ''),
           NULLIF(it.name, '')
         ) AS full_class_name
       FROM timetable_assignments ta
       LEFT JOIN academic_category    cat ON cat.id = ta.category_id
       LEFT JOIN academic_subcategory sub ON sub.id = ta.subcategory_id
       LEFT JOIN academic_item        it  ON it.id  = ta.item_id
       LEFT JOIN subjects             s   ON s.id   = ta.subject_id
       WHERE ta.staff_id = ? AND ta.institution_id = ?
       ORDER BY ta.day, ta.period_number`,
      [staff_id, req.user.institution_id]
    );

    res.json({ success: true, staff_id, count: rows.length, assignments: rows });
  } catch (err) {
    fail(res, 500, 'Debug query failed', err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────

module.exports = {
  getPeriods,
  createPeriod,
  updatePeriod,
  deletePeriod,
  syncPeriods,
  saveTimetableConfig,
  getTimetableConfig,
  getTimetable,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
  getTimetableAssignments,
  upsertTimetableAssignment,
  deleteTimetableAssignment,
  getTeacherWorkload,
  getClassTeachers,
  upsertClassTeacher,
  debugTimetable,
};