/**
 * studentController.js
 *
 * ✅ FIX: MySQL returns is_temp_password as TINYINT(1) = integer 1, not boolean true.
 *    All activation checks now use  Number(student.is_temp_password) === 1
 *    instead of  === true  so auto-activation actually fires.
 */

const bcrypt         = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const nodemailer     = require('nodemailer');
const pool           = require('../config/db');

// ─── SMTP Transporter ─────────────────────────────────────────────────────────
const mailer = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── Welcome email HTML ───────────────────────────────────────────────────────
function buildWelcomeEmailHtml({ studentName, username, tempPassword, institutionName }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to ${institutionName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:16px;overflow:hidden;
                 box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#3b82f6 100%);
                       padding:36px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;justify-content:center;
                          width:56px;height:56px;background:rgba(255,255,255,0.2);
                          border-radius:14px;margin-bottom:16px;">
                <span style="font-size:28px;">✅</span>
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                Welcome to ${institutionName}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 8px;color:#374151;font-size:15px;">
                Dear <strong>${studentName}</strong>,
              </p>
              <p style="margin:0 0 24px;color:#6b7280;font-size:14px;line-height:1.6;">
                Congratulations on joining <strong>${institutionName}</strong>!
                Here are your login credentials to access your account on our mobile app.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#f8faff;border:1.5px solid #e0e7ff;
                       border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:12px;">
                          <span style="font-size:11px;font-weight:600;color:#6366f1;
                                       text-transform:uppercase;letter-spacing:1px;">Username</span><br/>
                          <span style="font-size:14px;font-weight:600;color:#4f46e5;">${username}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="border-top:1px solid #e0e7ff;padding-top:12px;">
                          <span style="font-size:11px;font-weight:600;color:#6366f1;
                                       text-transform:uppercase;letter-spacing:1px;">Temporary Password</span><br/>
                          <span style="font-size:22px;font-weight:700;color:#111827;
                                       letter-spacing:3px;font-family:'Courier New',monospace;">${tempPassword}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <div style="background:#fff7ed;border:1px solid #fed7aa;
                          border-radius:10px;padding:14px 18px;">
                <p style="margin:0;color:#92400e;font-size:12px;line-height:1.5;">
                  🔒 <strong>Security tip:</strong> Please change your password after your
                  first login. Your account will be activated automatically once you set
                  a new password. Do not share your credentials with anyone.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #f3f4f6;
                       padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                This is an automated message from ${institutionName}.
                If you did not expect this email, please contact your institution admin.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

// ─── Shared SELECT ────────────────────────────────────────────────────────────
const STUDENT_SELECT = `
    SELECT s.*,
           COALESCE(ac.name,   s.category)   AS category_name,
           COALESCE(asc2.name, s.subcategory) AS subcategory_name,
           COALESCE(ai.name,   s.item)        AS item_name,
           inst.name                          AS institution_name
    FROM students s
    LEFT JOIN academic_category    ac   ON ac.id   = s.category_id
    LEFT JOIN academic_subcategory asc2 ON asc2.id = s.subcategory_id
    LEFT JOIN academic_item        ai   ON ai.id   = s.item_id
    LEFT JOIN institutions         inst ON inst.id  = s.institution_id
`;

// ─── GET ALL STUDENTS ─────────────────────────────────────────────────────────
const getStudents = async (req, res) => {
  const {
    category_id, subcategory_id, item_id, search, status,
    residence_type, shift_time, attendance_type, student_status, user_id,
  } = req.query;

  let sql = STUDENT_SELECT + ' WHERE s.institution_id = ?';
  const params = [req.user.institution_id];

  if (user_id)         { sql += ' AND s.user_id = ?';          params.push(user_id); }
  if (category_id)     { sql += ' AND s.category_id = ?';      params.push(category_id); }
  if (item_id)         { sql += ' AND s.item_id = ?';          params.push(item_id); }
  if (status)          { sql += ' AND s.status = ?';           params.push(status); }
  if (residence_type)  { sql += ' AND s.residence_type = ?';   params.push(residence_type); }
  if (shift_time)      { sql += ' AND s.shift_time = ?';       params.push(shift_time); }
  if (attendance_type) { sql += ' AND s.attendance_type = ?';  params.push(attendance_type); }
  if (student_status)  { sql += ' AND s.student_status = ?';   params.push(student_status); }

  if (subcategory_id) {
    const [subRows] = await pool.query(
      'SELECT name FROM academic_subcategory WHERE id = ? LIMIT 1',
      [subcategory_id]
    );
    const subName = subRows[0]?.name || '';
    sql += ' AND (s.subcategory_id = ? OR s.subcategory = ? OR s.subcategory = ?)';
    params.push(subcategory_id, subcategory_id, subName);
  }

  if (search) {
    sql += ' AND (s.full_name LIKE ? OR s.roll_number LIKE ? OR s.register_number LIKE ? OR s.student_email LIKE ? OR s.student_mobile LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like, like);
  }

  sql += ' ORDER BY s.full_name';

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('getStudents error:', err);
    res.status(500).json({ error: 'Failed to get students', detail: err.message });
  }
};

// ─── GET SINGLE STUDENT ───────────────────────────────────────────────────────
const getStudent = async (req, res) => {
  try {
    const [rows] = await pool.query(
      STUDENT_SELECT + ' WHERE s.id = ? AND s.institution_id = ?',
      [req.params.id, req.user.institution_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Student not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('getStudent error:', err);
    res.status(500).json({ error: 'Failed to get student', detail: err.message });
  }
};

// ─── CREATE STUDENT ───────────────────────────────────────────────────────────
const createStudent = async (req, res) => {
  try {
    const {
      full_name, date_of_birth, gender, blood_group,
      photo_url, address, parent_name, parent_contact,
      student_email,
      student_mobile,
      register_number,
      category_id, subcategory_id, item_id,
      category, subcategory, academic_layer, item,
      roll_number, status,
      residence_type, shift_time, attendance_type, student_status,
      institution_id,
      temp_password,
      is_temp_password,
    } = req.body;

    if (!full_name) {
      return res.status(400).json({ error: 'full_name is required' });
    }

    const institutionId = institution_id || req.user?.institution_id;
    if (!institutionId) {
      return res.status(400).json({ error: 'institution_id is required' });
    }

    const studentId = uuidv4();

    // Force inactive when is_temp_password is set
    const resolvedStatus = is_temp_password ? 'inactive' : (student_status || 'inactive');

    await pool.query(
      `INSERT INTO students (
        id, institution_id, full_name, date_of_birth, gender, blood_group,
        photo_url, address, parent_name, parent_contact,
        student_email, student_mobile,
        register_number,
        category_id, subcategory_id, item_id,
        category, subcategory, academic_layer, item,
        roll_number, status,
        residence_type, shift_time, attendance_type,
        student_status, is_temp_password,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        NOW(), NOW()
      )`,
      [
        studentId, institutionId, full_name,
        date_of_birth || null, gender || 'male', blood_group || null,
        photo_url || null, address || null, parent_name || null,
        parent_contact || null,
        student_email || null,
        student_mobile || null,
        register_number || null,
        category_id || null, subcategory_id || null, item_id || null,
        category || null, subcategory || null, academic_layer || null, item || null,
        roll_number || null, status || 'active',
        residence_type || 'day_scholar', shift_time || 'full_time',
        attendance_type || 'manual',
        resolvedStatus,
        is_temp_password ? 1 : 0,
      ]
    );

    // Create / update user account
    if (temp_password && student_email) {
      try {
        const [existing] = await pool.query(
          'SELECT id, role FROM users WHERE LOWER(email) = LOWER(?)',
          [student_email]
        );

        const hashedPassword = await bcrypt.hash(temp_password, 10);

        if (existing.length === 0) {
          const userId = uuidv4();
          await pool.query(
            `INSERT INTO users
               (id, email, password, role, full_name, institution_id,
                is_active, must_change_password, created_at)
             VALUES (?, ?, ?, 'student', ?, ?, 1, 1, NOW())`,
            [userId, student_email, hashedPassword, full_name, institutionId]
          );
          console.log(`✅ Student user created: ${student_email} [role=student, must_change_password=1]`);
        } else {
          await pool.query(
            `UPDATE users
             SET password = ?, is_active = 1, full_name = ?,
                 role = 'student',
                 must_change_password = 1
             WHERE LOWER(email) = LOWER(?)`,
            [hashedPassword, full_name, student_email]
          );
          console.log(`🔄 Student user updated: ${student_email} [role=student, must_change_password=1]`);
        }
      } catch (userErr) {
        console.error('⚠️  Could not create/update user account:', userErr.message);
      }
    }

    // Send welcome email
    if (temp_password && student_email) {
      let institutionName = 'ETAM';
      try {
        const [instRows] = await pool.query(
          'SELECT name FROM institutions WHERE id = ? LIMIT 1',
          [institutionId]
        );
        if (instRows[0]?.name) institutionName = instRows[0].name;
      } catch (_) { /* use default */ }

      try {
        await mailer.sendMail({
          from:    `"${institutionName}" <${process.env.SMTP_USER}>`,
          to:      student_email,
          subject: `Welcome to ${institutionName} — Your Login Credentials`,
          html:    buildWelcomeEmailHtml({
            studentName:     full_name,
            username:        student_email,
            tempPassword:    temp_password,
            institutionName,
          }),
        });
        console.log(`📧 Welcome email sent to ${student_email}`);
      } catch (emailErr) {
        console.error('⚠️  Welcome email failed:', emailErr.message);
      }
    }

    const [rows] = await pool.query(
      STUDENT_SELECT + ' WHERE s.id = ?',
      [studentId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createStudent error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Register number or roll number already exists' });
    }
    res.status(500).json({ error: 'Failed to create student', detail: err.message, code: err.code });
  }
};

// ─── UPDATE STUDENT ───────────────────────────────────────────────────────────
const updateStudent = async (req, res) => {
  const fields = [
    'full_name', 'category_id', 'subcategory_id', 'item_id',
    'category', 'subcategory', 'academic_layer', 'item',
    'date_of_birth', 'gender', 'blood_group', 'roll_number', 'register_number',
    'student_email', 'address', 'parent_name', 'parent_contact',
    'student_mobile',
    'photo_url', 'status',
    'residence_type', 'shift_time', 'attendance_type', 'student_status',
    'is_temp_password',
  ];

  try {
    const updateParts = [];
    const values      = [];

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updateParts.push(`${f} = ?`);
        if (f === 'date_of_birth' && req.body[f]) {
          values.push(req.body[f].toString().split('T')[0]);
        } else {
          values.push(req.body[f]);
        }
      }
    }

    if (updateParts.length === 0) {
      return res.json({ message: 'No fields to update' });
    }

    values.push(req.params.id, req.user.institution_id);

    await pool.query(
      `UPDATE students SET ${updateParts.join(', ')}, updated_at = NOW()
       WHERE id = ? AND institution_id = ?`,
      values
    );
    res.json({ message: 'Student updated successfully' });
  } catch (err) {
    console.error('updateStudent error:', err);
    res.status(500).json({ error: 'Failed to update student', detail: err.message });
  }
};

// ─── DELETE STUDENT ───────────────────────────────────────────────────────────
const deleteStudent = async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM students WHERE id = ? AND institution_id = ?',
      [req.params.id, req.user.institution_id]
    );
    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    console.error('deleteStudent error:', err);
    res.status(500).json({ error: 'Failed to delete student', detail: err.message });
  }
};

// ─── CHANGE PASSWORD (Student self-service) ───────────────────────────────────
//
// ✅ FIX: MySQL TINYINT(1) is returned as Number 1, not boolean true.
//    Using Number(student.is_temp_password) === 1 for correct activation check.
// ─────────────────────────────────────────────────────────────────────────────
const changePassword = async (req, res) => {
  const { old_password, new_password } = req.body;

  if (!old_password || !new_password) {
    return res.status(400).json({ error: 'old_password and new_password are required' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  if (old_password === new_password) {
    return res.status(400).json({ error: 'New password must be different from the temporary password' });
  }

  try {
    // 1. Fetch the current user record
    const [userRows] = await pool.query(
      'SELECT id, email, password, role, institution_id FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );

    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userRows[0];

    // 2. Verify old (temp) password
    const isMatch = await bcrypt.compare(old_password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // 3. Hash and save new password; clear must_change_password flag
    const hashedNew = await bcrypt.hash(new_password, 10);
    await pool.query(
      `UPDATE users
       SET password = ?, must_change_password = 0, updated_at = NOW()
       WHERE id = ?`,
      [hashedNew, user.id]
    );
    console.log(`🔑 Password changed for user: ${user.email}`);

    // 4. Auto-activate student
    const [studentRows] = await pool.query(
      `SELECT id, student_status, is_temp_password FROM students
       WHERE LOWER(student_email) = LOWER(?) AND institution_id = ?
       LIMIT 1`,
      [user.email, user.institution_id]
    );

    if (studentRows.length) {
      const student        = studentRows[0];
      const isTempPassword = Number(student.is_temp_password) === 1; // ✅ FIXED
      const isInactive     = student.student_status === 'inactive';

      console.log(`[changePassword] student=${user.email} status=${student.student_status} is_temp_password=${student.is_temp_password} (type: ${typeof student.is_temp_password})`);

      if (isInactive && isTempPassword) {
        await pool.query(
          `UPDATE students
           SET is_temp_password = 0,
               student_status   = 'active',
               updated_at       = NOW()
           WHERE id = ?`,
          [student.id]
        );
        console.log(`✅ Student auto-activated after password change: ${user.email}`);
      } else {
        console.log(`ℹ️  Student not auto-activated: isInactive=${isInactive}, isTempPassword=${isTempPassword}`);
      }
    } else {
      console.warn(`⚠️  No student row found for email: ${user.email} — status not updated`);
    }

    res.json({
      message: 'Password changed successfully. Your account is now active.',
      activated: studentRows.length > 0,
    });
  } catch (err) {
    console.error('changePassword error:', err);
    res.status(500).json({ error: 'Failed to change password', detail: err.message });
  }
};

// ─── ATTENDANCE SUMMARY ───────────────────────────────────────────────────────
const getStudentAttendanceSummary = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT sub.id as subject_id, sub.name as subject_name,
         COUNT(ar.id) as total_sessions,
         SUM(ar.status = 'present') as present_count,
         SUM(ar.status = 'absent')  as absent_count,
         SUM(ar.status = 'late')    as late_count,
         SUM(ar.status = 'leave')   as leave_count,
         ROUND(SUM(ar.status = 'present') / COUNT(ar.id) * 100, 2) as attendance_percentage
       FROM attendance_record ar
       JOIN attendance_session ases ON ases.id = ar.attendance_session_id
       JOIN subjects sub ON sub.id = ases.subject_id
       WHERE ar.student_id = ?
       GROUP BY sub.id, sub.name`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('getStudentAttendanceSummary error:', err);
    res.status(500).json({ error: 'Failed to get attendance summary', detail: err.message });
  }
};

// ─── REPAIR / MIGRATE legacy category IDs ────────────────────────────────────
const repairSubcategoryIds = async (req, res) => {
  try {
    const [r1] = await pool.query(`
      UPDATE students s
      JOIN academic_subcategory asc2 ON asc2.id = s.subcategory
      SET s.subcategory_id = s.subcategory,
          s.category_id = COALESCE(s.category_id, asc2.category_id)
      WHERE s.institution_id = ?
        AND (s.subcategory_id IS NULL OR s.subcategory_id = '')
        AND s.subcategory IS NOT NULL AND s.subcategory != ''
    `, [req.user.institution_id]);

    const [r2] = await pool.query(`
      UPDATE students s
      JOIN academic_subcategory asc2 ON asc2.name = s.subcategory
      JOIN academic_category ac ON ac.id = asc2.category_id AND ac.institution_id = s.institution_id
      SET s.subcategory_id = asc2.id,
          s.category_id = COALESCE(s.category_id, asc2.category_id)
      WHERE s.institution_id = ?
        AND (s.subcategory_id IS NULL OR s.subcategory_id = '')
        AND s.subcategory IS NOT NULL AND s.subcategory != ''
    `, [req.user.institution_id]);

    const [r3] = await pool.query(`
      UPDATE students s
      JOIN academic_category ac ON ac.id = s.category
      SET s.category_id = s.category
      WHERE s.institution_id = ?
        AND (s.category_id IS NULL OR s.category_id = '')
        AND s.category IS NOT NULL AND s.category != ''
    `, [req.user.institution_id]);

    const fixed = (r1.affectedRows || 0) + (r2.affectedRows || 0) + (r3.affectedRows || 0);
    res.json({
      message: `Repaired ${fixed} student records`,
      details: { byUUID: r1.affectedRows, byName: r2.affectedRows, categoryFix: r3.affectedRows },
    });
  } catch (err) {
    console.error('Repair error:', err);
    res.status(500).json({ error: 'Repair failed', detail: err.message });
  }
};

// ─── EXPORTS ──────────────────────────────────────────────────────────────────
module.exports = {
  repairSubcategoryIds,
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  getStudentAttendanceSummary,
  changePassword,
};