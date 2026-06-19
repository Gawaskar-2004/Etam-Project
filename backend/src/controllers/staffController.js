const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const db = require('../config/db');

// ─────────────────── SMTP Transporter (reuse from student email) ───────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─────────────────── Generate a strong temporary password ─────────────────────────
function generateTempPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&';
  const all = upper + lower + digits + symbols;
  const pick = (set) => set[Math.floor(Math.random() * set.length)];
  const chars = [
    pick(upper), pick(lower), pick(digits), pick(symbols),
    ...Array.from({ length: 4 }, () => pick(all))
  ];
  return chars.sort(() => Math.random() - 0.5).join('');
}

// ─────────────────── Build welcome email HTML (staff version) ─────────────────────
function buildStaffWelcomeEmailHtml({ staffName, username, tempPassword, institutionName }) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Welcome to ${institutionName}</title></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#4f46e5 0%,#3b82f6 100%);padding:36px 40px;text-align:center;">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:rgba(255,255,255,0.2);border-radius:14px;margin-bottom:16px;"><span style="font-size:28px;">👩‍🏫</span></div>
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Welcome to ${institutionName}</h1>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="margin:0 0 8px;color:#374151;">Dear <strong>${staffName}</strong>,</p>
          <p style="margin:0 0 24px;color:#6b7280;">Your staff account has been created. Use the credentials below to log into the mobile app.</p>
          <table width="100%" style="background:#f8faff;border:1.5px solid #e0e7ff;border-radius:12px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <table width="100%">
                <tr><td style="padding-bottom:12px;"><span style="font-size:11px;font-weight:600;color:#6366f1;">Username</span><br/><span style="font-size:14px;font-weight:600;color:#4f46e5;">${username}</span></td></tr>
                <tr><td style="border-top:1px solid #e0e7ff;padding-top:12px;"><span style="font-size:11px;font-weight:600;color:#6366f1;">Temporary Password</span><br/><span style="font-size:22px;font-weight:700;letter-spacing:3px;font-family:'Courier New',monospace;">${tempPassword}</span></td></tr>
              </table>
            </td></tr>
          </table>
          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 18px;">
            <p style="margin:0;color:#92400e;font-size:12px;">🔒 <strong>Security tip:</strong> Change your password after first login. Do not share your credentials.</p>
          </div>
        </td></tr>
        <tr><td style="background:#f9fafb;border-top:1px solid #f3f4f6;padding:20px 40px;text-align:center;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">This is an automated message from ${institutionName}. If you did not expect this email, please contact your admin.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─────────────────── Helper: generate unique staff code ──────────────────────────
const generateUniqueStaffCode = async (conn, institutionId, retries = 0) => {
  if (retries > 10) throw new Error('Unable to generate unique staff code');
  const [maxCodeRow] = await conn.query(
    `SELECT staff_code FROM staff 
     WHERE institution_id = ? 
     AND staff_code REGEXP '^STF[0-9]{6}$'
     ORDER BY CAST(SUBSTRING(staff_code, 4) AS UNSIGNED) DESC 
     LIMIT 1`,
    [institutionId]
  );
  let nextNumber = 1;
  if (maxCodeRow.length > 0) {
    const match = maxCodeRow[0].staff_code.match(/STF(\d{6})/);
    if (match) nextNumber = parseInt(match[1]) + 1;
  }
  const candidateCode = `STF${String(nextNumber).padStart(6, '0')}`;
  const [existing] = await conn.query(
    'SELECT id FROM staff WHERE staff_code = ? AND institution_id = ?',
    [candidateCode, institutionId]
  );
  if (existing.length > 0) return generateUniqueStaffCode(conn, institutionId, retries + 1);
  return candidateCode;
};

// ─────────────────── GET all staff ───────────────────────────────────────────────
const getStaff = async (req, res) => {
  const { search, status, role } = req.query;
  let sql = `SELECT s.* FROM staff s WHERE s.institution_id = ?`;
  const params = [req.user.institution_id];
  if (status) { sql += ' AND s.status = ?'; params.push(status); }
  if (role)   { sql += ' AND s.role = ?';   params.push(role); }
  if (search) {
    sql += ' AND (s.full_name LIKE ? OR s.email LIKE ? OR s.staff_code LIKE ? OR s.mobile_number LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY s.full_name';
  try {
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('getStaff error:', err);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
};

// ─────────────────── GET staff by ID ────────────────────────────────────────────
const getStaffById = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.* FROM staff s WHERE s.id = ? AND s.institution_id = ?`,
      [req.params.id, req.user.institution_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Staff not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('getStaffById error:', err);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
};

// ─────────────────── CREATE staff (with welcome email) ──────────────────────────
const createStaff = async (req, res) => {
  const {
    full_name, email, phone, mobile_number, date_of_birth, gender,
    qualification, experience, experience_years, role, user_role,
    department, staff_type, designation, employment_type,
    date_of_joining, photo_url, address, username, status,
  } = req.body;

  if (!full_name) return res.status(400).json({ error: 'full_name is required' });
  if (!email) return res.status(400).json({ error: 'email is required' });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Check existing staff by email
    const [existingStaffByEmail] = await conn.query(
      'SELECT id FROM staff WHERE email = ? AND institution_id = ?',
      [email.toLowerCase(), req.user.institution_id]
    );
    if (existingStaffByEmail.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Staff with this email already exists', field: 'email' });
    }

    // Generate unique staff code
    const staffCode = await generateUniqueStaffCode(conn, req.user.institution_id);

    // --- Generate temp password and hash ---
    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // --- Handle user account (create or update) ---
    const [existingUser] = await conn.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    let userId;
    let userExists = false;

    if (existingUser.length > 0) {
      userId = existingUser[0].id;
      userExists = true;
      // Update existing user – set password and activate
      await conn.query(
        `UPDATE users SET password = ?, full_name = ?, role = ?, institution_id = ?, is_active = 1, updated_at = NOW()
         WHERE id = ?`,
        [hashedPassword, full_name, role || 'teacher', req.user.institution_id, userId]
      );
    } else {
      userId = uuidv4();
      await conn.query(
        `INSERT INTO users (id, email, password, full_name, role, institution_id, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [userId, email.toLowerCase(), hashedPassword, full_name, role || 'teacher', req.user.institution_id]
      );
    }

    // Insert staff record
    const staffId = uuidv4();
    await conn.query(
      `INSERT INTO staff (
        id, institution_id, full_name, email, phone, mobile_number,
        date_of_birth, gender, qualification, experience, experience_years,
        role, user_role, department, staff_type, designation, employment_type,
        date_of_joining, photo_url, address, username, staff_code, status,
        user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        staffId, req.user.institution_id, full_name, email.toLowerCase(), phone || null, mobile_number || null,
        date_of_birth || null, gender || null, qualification || null, experience || null,
        experience_years || 0, role || 'teacher', user_role || 'staff', department || null,
        staff_type || null, designation || null, employment_type || 'full_time',
        date_of_joining || null, photo_url || null, address || null, username || null,
        staffCode, status || 'active', userId
      ]
    );

    // --- Send welcome email with temp password ---
    let institutionName = 'ETAM';
    try {
      const [instRows] = await conn.query('SELECT name FROM institutions WHERE id = ? LIMIT 1', [req.user.institution_id]);
      if (instRows[0]?.name) institutionName = instRows[0].name;
    } catch (_) {}

    await transporter.sendMail({
      from: `"${institutionName}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Welcome to ${institutionName} – Your Staff Login Credentials`,
      html: buildStaffWelcomeEmailHtml({
        staffName: full_name,
        username: email,
        tempPassword,
        institutionName,
      }),
    });
    console.log(`📧 Staff welcome email sent to ${email}`);

    await conn.commit();

    const [rows] = await conn.query('SELECT * FROM staff WHERE id = ?', [staffId]);
    res.status(201).json({
      ...rows[0],
      message: userExists
        ? 'Staff created and linked to existing user account. Welcome email sent.'
        : 'Staff created successfully. Welcome email with temporary password sent.',
    });
  } catch (err) {
    await conn.rollback();
    console.error('createStaff error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Duplicate entry (staff code or email)', field: 'general' });
    }
    res.status(500).json({ error: 'Failed to create staff: ' + err.message });
  } finally {
    conn.release();
  }
};

// ─────────────────── UPDATE staff (no email sent) ───────────────────────────────
const updateStaff = async (req, res) => {
  const { id } = req.params;
  const {
    full_name, email, phone, mobile_number, date_of_birth, gender,
    qualification, experience, experience_years, role, user_role,
    department, staff_type, designation, employment_type,
    date_of_joining, photo_url, address, username, status
  } = req.body;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [staffExists] = await conn.query(
      'SELECT id, user_id, email FROM staff WHERE id = ? AND institution_id = ?',
      [id, req.user.institution_id]
    );
    if (staffExists.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Staff not found' });
    }

    if (email && email.toLowerCase() !== staffExists[0].email) {
      const [existingStaff] = await conn.query(
        'SELECT id FROM staff WHERE email = ? AND institution_id = ? AND id != ?',
        [email.toLowerCase(), req.user.institution_id, id]
      );
      if (existingStaff.length > 0) {
        await conn.rollback();
        return res.status(409).json({ error: 'Another staff member already uses this email', field: 'email' });
      }
    }

    const fields = [];
    const values = [];
    const fieldMap = {
      full_name, email: email ? email.toLowerCase() : undefined,
      phone, mobile_number, date_of_birth, gender,
      qualification, experience, experience_years, role, user_role,
      department, staff_type, designation, employment_type,
      date_of_joining, photo_url, address, username, status
    };
    for (const [key, value] of Object.entries(fieldMap)) {
      if (value !== undefined && value !== null) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    fields.push('updated_at = NOW()');
    if (fields.length === 1) {
      await conn.rollback();
      return res.status(400).json({ error: 'No fields to update' });
    }
    values.push(id, req.user.institution_id);
    await conn.query(`UPDATE staff SET ${fields.join(', ')} WHERE id = ? AND institution_id = ?`, values);

    if (email || full_name) {
      const userUpdates = [];
      const userValues = [];
      if (email) { userUpdates.push('email = ?'); userValues.push(email.toLowerCase()); }
      if (full_name) { userUpdates.push('full_name = ?'); userValues.push(full_name); }
      userUpdates.push('updated_at = NOW()');
      userValues.push(staffExists[0].user_id);
      await conn.query(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, userValues);
    }

    await conn.commit();
    const [updatedStaff] = await conn.query('SELECT * FROM staff WHERE id = ? AND institution_id = ?', [id, req.user.institution_id]);
    res.json({ message: 'Staff updated successfully', staff: updatedStaff[0] });
  } catch (err) {
    await conn.rollback();
    console.error('updateStaff error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Duplicate entry', field: 'general' });
    }
    res.status(500).json({ error: 'Failed to update staff: ' + err.message });
  } finally {
    conn.release();
  }
};

// ─────────────────── DELETE staff (soft delete if has assignments) ───────────────
const deleteStaff = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [staffRows] = await conn.query(
      'SELECT user_id, staff_code, email FROM staff WHERE id = ? AND institution_id = ?',
      [req.params.id, req.user.institution_id]
    );
    if (staffRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Staff not found' });
    }
    const [hasAssignments] = await conn.query(
      'SELECT COUNT(*) as count FROM subject_staff_assignment WHERE staff_id = ?',
      [req.params.id]
    );
    if (hasAssignments[0].count > 0) {
      await conn.query('UPDATE staff SET status = "inactive", updated_at = NOW() WHERE id = ?', [req.params.id]);
      if (staffRows[0].user_id) {
        await conn.query('UPDATE users SET is_active = false, updated_at = NOW() WHERE id = ?', [staffRows[0].user_id]);
      }
      await conn.commit();
      return res.json({ message: 'Staff deactivated successfully (has existing assignments)', softDelete: true });
    }
    await conn.query('DELETE FROM staff WHERE id = ? AND institution_id = ?', [req.params.id, req.user.institution_id]);
    if (staffRows[0].user_id) {
      const [otherStaff] = await conn.query('SELECT id FROM staff WHERE user_id = ? AND id != ?', [staffRows[0].user_id, req.params.id]);
      if (otherStaff.length === 0) {
        await conn.query('DELETE FROM users WHERE id = ?', [staffRows[0].user_id]);
      }
    }
    await conn.commit();
    res.json({ message: 'Staff deleted successfully' });
  } catch (err) {
    await conn.rollback();
    console.error('deleteStaff error:', err);
    res.status(500).json({ error: 'Failed to delete staff: ' + err.message });
  } finally {
    conn.release();
  }
};

// ─────────────────── Additional endpoints (workload, assignments, etc.) ──────────
const getStaffWorkload = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.id, s.staff_code, s.full_name,
        COUNT(DISTINCT ssa.subject_id) as subject_count,
        COALESCE(SUM(sub.weekly_period_count), 0) as total_weekly_periods
      FROM staff s
      LEFT JOIN subject_staff_assignment ssa ON s.id = ssa.staff_id
      LEFT JOIN subjects sub ON ssa.subject_id = sub.id
      WHERE s.id = ? AND s.institution_id = ?
      GROUP BY s.id, s.staff_code, s.full_name`,
      [req.params.id, req.user.institution_id]
    );
    res.json(rows[0] || { workload: null });
  } catch (err) {
    console.error('getStaffWorkload error:', err);
    res.status(500).json({ error: 'Failed to fetch workload' });
  }
};

const getStaffAssignments = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
        ta.id, ta.period_number, ta.day,
        ta.category_id, ta.subcategory_id, ta.item_id, ta.subject_id,
        s.name as subject_name, s.code as subject_code,
        cat.name as category_name,
        sub.name as subcategory_name,
        it.name as item_name,
        CONCAT(
          COALESCE(cat.name, ''),
          CASE WHEN cat.name IS NOT NULL AND (sub.name IS NOT NULL OR it.name IS NOT NULL) THEN ' ' ELSE '' END,
          COALESCE(sub.name, ''),
          CASE WHEN sub.name IS NOT NULL AND it.name IS NOT NULL THEN ' ' ELSE '' END,
          COALESCE(it.name, '')
        ) as full_class_name
      FROM timetable_assignments ta
      LEFT JOIN subjects s ON s.id = ta.subject_id
      LEFT JOIN academic_category cat ON cat.id = ta.category_id
      LEFT JOIN academic_subcategory sub ON sub.id = ta.subcategory_id
      LEFT JOIN academic_item it ON it.id = ta.item_id
      WHERE ta.staff_id = ? AND ta.institution_id = ?
      ORDER BY FIELD(ta.day, 'MON','TUE','WED','THU','FRI','SAT'), ta.period_number`,
      [req.params.id, req.user.institution_id]
    );
    const assignments = rows.map(row => ({
      id: row.id, period_number: row.period_number, day: row.day,
      subject_name: row.subject_name || 'Subject', subject_code: row.subject_code, subject_id: row.subject_id,
      category_name: row.category_name, subcategory_name: row.subcategory_name, item_name: row.item_name,
      full_class_name: row.full_class_name || 'Class', class_name: row.subcategory_name || row.category_name,
      category_id: row.category_id, subcategory_id: row.subcategory_id, item_id: row.item_id
    }));
    res.json(assignments);
  } catch (err) {
    console.error('getStaffAssignments error:', err);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
};

const getStaffClassTeacher = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ct.id, ct.category_id, ct.subcategory_id, ct.item_id,
        cat.name as category_name, sub.name as subcategory_name, it.name as item_name,
        CONCAT(
          COALESCE(cat.name, ''),
          CASE WHEN cat.name IS NOT NULL AND (sub.name IS NOT NULL OR it.name IS NOT NULL) THEN ' ' ELSE '' END,
          COALESCE(sub.name, ''),
          CASE WHEN sub.name IS NOT NULL AND it.name IS NOT NULL THEN ' ' ELSE '' END,
          COALESCE(it.name, '')
        ) as full_class_name
      FROM class_teachers ct
      LEFT JOIN academic_category cat ON cat.id = ct.category_id
      LEFT JOIN academic_subcategory sub ON sub.id = ct.subcategory_id
      LEFT JOIN academic_item it ON it.id = ct.item_id
      WHERE ct.staff_id = ? AND ct.institution_id = ?
      ORDER BY cat.name, sub.name, it.name`,
      [req.params.id, req.user.institution_id]
    );
    res.json(rows.map(row => ({
      id: row.id, category_id: row.category_id, subcategory_id: row.subcategory_id, item_id: row.item_id,
      category_name: row.category_name, subcategory_name: row.subcategory_name, item_name: row.item_name,
      full_class_name: row.full_class_name || 'Class', class_name: row.subcategory_name || row.category_name,
      section_name: row.subcategory_name || ''
    })));
  } catch (err) {
    console.error('getStaffClassTeacher error:', err);
    res.status(500).json({ error: 'Failed to fetch class teacher assignments' });
  }
};

const updateAcademicMapping = async (req, res) => {
  const { mappings } = req.body;
  const staffId = req.params.id;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [staffExists] = await conn.query('SELECT id FROM staff WHERE id = ? AND institution_id = ?', [staffId, req.user.institution_id]);
    if (staffExists.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Staff not found' });
    }
    await conn.query('DELETE FROM staff_academic_mapping WHERE staff_id = ?', [staffId]);
    if (mappings && mappings.length > 0) {
      for (const m of mappings) {
        await conn.query(
          `INSERT INTO staff_academic_mapping (id, staff_id, category_id, subcategory_id, item_id)
           VALUES (?, ?, ?, ?, ?)`,
          [uuidv4(), staffId, m.category_id, m.subcategory_id || null, m.item_id || null]
        );
      }
    }
    await conn.commit();
    res.json({ message: 'Academic mapping updated successfully' });
  } catch (err) {
    await conn.rollback();
    console.error('updateAcademicMapping error:', err);
    res.status(500).json({ error: 'Failed to update mapping: ' + err.message });
  } finally {
    conn.release();
  }
};

const getStaffByEmail = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM staff WHERE email = ? AND institution_id = ? LIMIT 1',
      [decodeURIComponent(req.params.email).toLowerCase(), req.user.institution_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Staff not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('getStaffByEmail error:', err);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
};

const checkStaffEmail = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, full_name, status, staff_code FROM staff WHERE email = ? AND institution_id = ?',
      [decodeURIComponent(req.params.email).toLowerCase(), req.user.institution_id]
    );
    res.json({ exists: rows.length > 0, staff: rows[0] || null });
  } catch (err) {
    console.error('checkStaffEmail error:', err);
    res.status(500).json({ error: 'Failed to check email' });
  }
};

const checkStaffCode = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, full_name FROM staff WHERE staff_code = ? AND institution_id = ?',
      [req.params.code, req.user.institution_id]
    );
    res.json({ available: rows.length === 0, exists: rows.length > 0, staff: rows[0] || null });
  } catch (err) {
    console.error('checkStaffCode error:', err);
    res.status(500).json({ error: 'Failed to check staff code' });
  }
};

module.exports = {
  getStaffByEmail,
  getStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  getStaffWorkload,
  getStaffAssignments,
  getStaffClassTeacher,
  updateAcademicMapping,
  checkStaffEmail,
  checkStaffCode
};