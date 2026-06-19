const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const db = require('../config/db');

// ─────────────────────────────────────────────────────────────────────────────
// Email transporter (Nodemailer)
// ─────────────────────────────────────────────────────────────────────────────
const createTransporter = () => {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout:   10000,
    socketTimeout:     15000,
  });
};

// Verify SMTP on startup
const verifySmtp = () => {
  const transporter = createTransporter();
  transporter.verify((err) => {
    if (err) {
      console.error('❌ SMTP connection FAILED:', err.message);
      console.error('   Check SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in your .env');
    } else {
      console.log('✅ SMTP connection ready — emails will send correctly');
    }
  });
};

verifySmtp();

// Send OTP email
const sendOtpEmail = async (toEmail, fullName, otp) => {
  const transporter = createTransporter();
  const displayName = fullName || toEmail.split('@')[0];

  const mailOptions = {
    from:    process.env.SMTP_FROM || `ETAM <${process.env.SMTP_USER}>`,
    to:      toEmail,
    subject: 'Your ETAM Password Reset Code',
    text: `
Hi ${displayName},

Your password reset code is: ${otp}

This code expires in 15 minutes.

If you did not request a password reset, please ignore this email.

— ETAM Team
    `.trim(),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Password Reset</title>
</head>
<body style="margin:0;padding:0;background:#F0F4FF;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4FF;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:16px;overflow:hidden;
                      box-shadow:0 4px 24px rgba(79,70,229,0.10);">
          <tr>
            <td style="background:linear-gradient(135deg,#1E1B4B 0%,#4F46E5 100%);
                        padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:900;letter-spacing:2px;">
                ETAM
              </h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:12px;
                         font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">
                Education Time &amp; Attendance
              </p>
             </td>
           </tr>
           <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;color:#5A6A8A;font-size:13px;font-weight:700;
                         text-transform:uppercase;letter-spacing:1px;">
                Password Reset
              </p>
              <h2 style="margin:0 0 16px;color:#0D1B3E;font-size:22px;font-weight:800;">
                Hi ${displayName},
              </h2>
              <p style="margin:0 0 28px;color:#5A6A8A;font-size:15px;line-height:1.6;">
                We received a request to reset your ETAM password.
                Use the code below to complete the reset. This code expires in
                <strong style="color:#0D1B3E;">15 minutes</strong>.
              </p>

              <div style="background:#EEF2FF;border:2px dashed #4F46E5;border-radius:16px;
                           padding:28px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 8px;color:#5A6A8A;font-size:12px;font-weight:700;
                           text-transform:uppercase;letter-spacing:1.5px;">
                  Your Reset Code
                </p>
                <p style="margin:0;color:#4F46E5;font-size:42px;font-weight:900;
                           letter-spacing:12px;font-family:monospace;">
                  ${otp}
                </p>
              </div>

              <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;
                           padding:14px 18px;margin-bottom:28px;">
                <p style="margin:0;color:#92400E;font-size:13px;line-height:1.5;">
                  📧 <strong>Can't find this email?</strong> Check your
                  <strong>spam or junk folder</strong> and mark it as "Not Spam"
                  so future emails arrive in your inbox.
                </p>
              </div>

              <p style="margin:0;color:#96A5C0;font-size:13px;line-height:1.6;">
                If you didn't request a password reset, you can safely ignore this email.
                Your password will not be changed.
              </p>
             </td>
           </tr>
           <tr>
            <td style="background:#F1F5F9;padding:20px 40px;text-align:center;
                        border-top:1px solid #E8EEFF;">
              <p style="margin:0;color:#96A5C0;font-size:11px;">
                © ETAM Management System · Secure &amp; Encrypted
              </p>
             </td>
           </tr>
         </table>
       </td>
     </td>
   </tr>
</body>
</html>
    `.trim(),
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`[Email] ✅ OTP sent to ${toEmail} — messageId: ${info.messageId}`);
  return info;
};

// ─────────────────────────────────────────────────────────────────────────────
// Send welcome email with temporary password
// ─────────────────────────────────────────────────────────────────────────────
const sendWelcomeEmail = async (toEmail, fullName, tempPassword) => {
  const transporter = createTransporter();
  const displayName = fullName || toEmail.split('@')[0];

  const mailOptions = {
    from:    process.env.SMTP_FROM || `ETAM <${process.env.SMTP_USER}>`,
    to:      toEmail,
    subject: 'Welcome to ETAM - Your Login Credentials',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Welcome to ETAM</title>
</head>
<body style="margin:0;padding:0;background:#F0F4FF;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4FF;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:16px;overflow:hidden;
                      box-shadow:0 4px 24px rgba(79,70,229,0.10);">
          <tr>
            <td style="background:linear-gradient(135deg,#1E1B4B 0%,#4F46E5 100%);
                        padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:900;">ETAM</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:12px;">
                Education Time &amp; Attendance Management
              </p>
             </td>
           </tr>
            <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="margin:0 0 16px;color:#0D1B3E;">Welcome ${displayName}!</h2>
              <p style="margin:0 0 20px;color:#5A6A8A;line-height:1.6;">
                Your account has been created successfully. Use the temporary password below to log in.
              </p>
              
              <div style="background:#EEF2FF;border:2px solid #4F46E5;border-radius:16px;
                           padding:20px;text-align:center;margin-bottom:20px;">
                <p style="margin:0 0 8px;color:#5A6A8A;font-size:12px;">Temporary Password</p>
                <p style="margin:0;color:#4F46E5;font-size:28px;font-weight:900;
                           letter-spacing:4px;font-family:monospace;">${tempPassword}</p>
              </div>
              
              <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;
                           padding:14px 18px;margin-bottom:20px;">
                <p style="margin:0;color:#92400E;font-size:13px;">
                  ⚠️ <strong>Important:</strong> You will be required to change this password after your first login.
                </p>
              </div>
              
              <p style="margin:0;color:#96A5C0;font-size:12px;">
                If you didn't expect this email, please contact your institution administrator.
              </p>
            </td>
            </tr>
            <tr>
            <td style="background:#F1F5F9;padding:20px;text-align:center;">
              <p style="margin:0;color:#96A5C0;font-size:11px;">© ETAM Management System</p>
            </td>
            </tr>
          </table>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`[Email] ✅ Welcome email sent to ${toEmail}`);
  return info;
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────
const register = async (req, res) => {
  const {
    email,
    password,
    full_name,
    role,
    employee_id,
    is_active,
    institution_id: reqInstitutionId,
    institution_name,
    institution_type,
    phone,
    alternate_email,
    alternate_phone,
  } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      await conn.rollback();
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    const mustChange = role === 'teacher' || role === 'staff' || role === 'student' ? 1 : 0;

    if (reqInstitutionId) {
      await conn.query(
        `INSERT INTO users (id, email, password, full_name, role, employee_id, is_active, institution_id, must_change_password)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, email, hashedPassword, full_name || '',
          role || 'teacher', employee_id || null,
          is_active !== false, reqInstitutionId, mustChange,
        ]
      );

      if (role === 'teacher' || role === 'staff') {
        await conn.query(
          `UPDATE staff SET user_id = ?
           WHERE TRIM(LOWER(email)) = TRIM(LOWER(?)) AND institution_id = ?`,
          [userId, email, reqInstitutionId]
        ).catch(() => {});
      }

      if (role === 'student') {
        await conn.query(
          `UPDATE students SET user_id = ?
           WHERE TRIM(LOWER(student_email)) = TRIM(LOWER(?)) AND institution_id = ?`,
          [userId, email, reqInstitutionId]
        ).catch((err) => {
          console.warn('register: student user_id link failed:', err.message);
        });
      }

      await conn.commit();
      const [rows] = await conn.query(
        'SELECT id, email, full_name, role, is_active, institution_id, must_change_password FROM users WHERE id = ?',
        [userId]
      );
      return res.status(201).json({ user: rows[0] });
    }

    // Admin self-registration (creates institution)
    const institutionId = uuidv4();

    await conn.query(
      `INSERT INTO institutions (id, name, type, admin_email, phone, alternate_email, alternate_phone, is_setup_complete)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        institutionId, institution_name || 'My Institution',
        institution_type || 'school', email,
        phone || null, alternate_email || null, alternate_phone || null,
      ]
    );

    const userFullName = full_name || email.split('@')[0];

    await conn.query(
      `INSERT INTO users (id, email, password, full_name, role, institution_id, is_active, email_verified, must_change_password)
       VALUES (?, ?, ?, ?, 'admin', ?, true, 0, 0)`,
      [userId, email, hashedPassword, userFullName, institutionId]
    );

    await conn.commit();

    const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    res.status(201).json({
      token,
      user: {
        id: userId, email, full_name: userFullName,
        role: 'admin', institution_id: institutionId, must_change_password: 0,
      },
      institution_id: institutionId,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  } finally {
    conn.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const [rows] = await db.query(
      `SELECT * FROM users
       WHERE TRIM(LOWER(email)) = TRIM(LOWER(?))
       AND is_active = 1`,
      [normalizedEmail]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    if (!user.password) {
      return res.status(401).json({
        error: 'Account not activated. Please contact your admin.',
      });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.role === 'teacher' || user.role === 'staff') {
      await db.query(
        `UPDATE staff SET user_id = ?
         WHERE TRIM(LOWER(email)) = TRIM(LOWER(?))
         AND institution_id = ?
         AND (user_id IS NULL OR user_id = '')`,
        [user.id, user.email, user.institution_id]
      ).catch(() => {});
    }

    if (user.role === 'student') {
      await db.query(
        `UPDATE students SET user_id = ?
         WHERE TRIM(LOWER(student_email)) = TRIM(LOWER(?))
         AND institution_id = ?
         AND (user_id IS NULL OR user_id = '')`,
        [user.id, user.email, user.institution_id]
      ).catch((err) => {
        console.warn('login: student user_id link failed:', err.message);
      });
    }

    let fullProfile = { ...user };

    if (user.role === 'student') {
      const [studentRows] = await db.query(
        `SELECT
           s.id AS student_db_id, s.roll_number, s.class_id,
           s.batch, s.section, s.admission_no, s.student_status, s.is_temp_password,
           c.name AS class_name, c.grade, c.academic_year
         FROM students s
         LEFT JOIN classes c ON s.class_id = c.id
         WHERE (s.user_id = ? OR TRIM(LOWER(s.student_email)) = TRIM(LOWER(?)))
         AND s.institution_id = ? LIMIT 1`,
        [user.id, user.email, user.institution_id]
      ).catch(() => [[]]);
      if (studentRows.length) fullProfile = { ...fullProfile, ...studentRows[0] };
    }

    if (user.role === 'teacher' || user.role === 'staff') {
      const [staffRows] = await db.query(
        `SELECT
           st.id AS staff_db_id, st.employee_id AS staff_employee_id,
           st.department, st.designation
         FROM staff st
         WHERE (st.user_id = ? OR TRIM(LOWER(st.email)) = TRIM(LOWER(?)))
         AND st.institution_id = ? LIMIT 1`,
        [user.id, user.email, user.institution_id]
      ).catch(() => [[]]);
      if (staffRows.length) fullProfile = { ...fullProfile, ...staffRows[0] };
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    const { password: _, ...safeProfile } = fullProfile;

    const [freshRows] = await db.query(
      'SELECT must_change_password FROM users WHERE id = ?',
      [user.id]
    );
    const freshMustChange = Number(freshRows[0]?.must_change_password) === 1;

    console.log(`[login] user=${user.email} must_change_password=${freshMustChange}`);

    safeProfile.must_change_password = freshMustChange ? 1 : 0;

    res.json({
      token,
      user: safeProfile,
      requires_password_change: freshMustChange,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/check-email
// ─────────────────────────────────────────────────────────────────────────────
const checkEmail = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const [rows] = await db.query(
      `SELECT id, email, must_change_password FROM users
       WHERE TRIM(LOWER(email)) = TRIM(LOWER(?))`,
      [email.toLowerCase().trim()]
    );
    if (rows.length) {
      return res.json({
        exists: true,
        must_change_password: Number(rows[0].must_change_password) === 1,
      });
    }
    return res.json({ exists: false });
  } catch (err) {
    console.error('Check email error:', err);
    res.status(500).json({ error: 'Failed to check email' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/set-password-by-email
//
// ✅ FIX: MySQL returns is_temp_password as integer 1, not boolean true.
//         Use Number(...) === 1 instead of === true for the activation check.
// ─────────────────────────────────────────────────────────────────────────────
const setPasswordByEmail = async (req, res) => {
  const { email, new_password, user_id } = req.body;

  if (!new_password) return res.status(400).json({ error: 'New password is required' });
  if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const hashedPassword = await bcrypt.hash(new_password, 12);
    let resolvedUserId = user_id;
    let resolvedEmail = email;
    let resolvedRole = null;
    let resolvedInstitutionId = null;

    if (user_id) {
      const [foundUsers] = await conn.query(
        `SELECT id, email, institution_id, role FROM users WHERE id = ?`,
        [user_id]
      );
      if (!foundUsers.length) {
        await conn.rollback();
        return res.status(404).json({ error: 'User not found' });
      }
      resolvedUserId       = foundUsers[0].id;
      resolvedEmail        = foundUsers[0].email;
      resolvedRole         = foundUsers[0].role;
      resolvedInstitutionId = foundUsers[0].institution_id;
    } else {
      const [foundUsers] = await conn.query(
        `SELECT id, email, institution_id, role FROM users WHERE TRIM(LOWER(email)) = TRIM(LOWER(?))`,
        [email]
      );
      if (!foundUsers.length) {
        await conn.rollback();
        return res.status(404).json({ error: 'User not found' });
      }
      resolvedUserId       = foundUsers[0].id;
      resolvedEmail        = foundUsers[0].email;
      resolvedRole         = foundUsers[0].role;
      resolvedInstitutionId = foundUsers[0].institution_id;
    }

    // Update password and clear must_change_password flag
    const [updateResult] = await conn.query(
      `UPDATE users SET password = ?, must_change_password = 0, last_password_change = NOW() WHERE id = ?`,
      [hashedPassword, resolvedUserId]
    );

    if (updateResult.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'User not found or update failed' });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ✅ FIX: MySQL TINYINT(1) comes back as Number 1, not boolean true.
    //    The original code used === true which always failed, keeping the
    //    student permanently Inactive even after password change.
    //    Now using Number(student.is_temp_password) === 1 for correct comparison.
    // ─────────────────────────────────────────────────────────────────────────
    if (resolvedRole === 'student') {
      const [studentCheck] = await conn.query(
        `SELECT id, student_status, is_temp_password FROM students
         WHERE user_id = ? OR TRIM(LOWER(student_email)) = TRIM(LOWER(?))`,
        [resolvedUserId, resolvedEmail]
      );

      if (studentCheck.length > 0) {
        const student = studentCheck[0];
        const isTempPassword = Number(student.is_temp_password) === 1; // ✅ FIXED
        const isInactive     = student.student_status === 'inactive';

        console.log(`[SetPassword] student=${resolvedEmail} status=${student.student_status} is_temp_password=${student.is_temp_password} (type: ${typeof student.is_temp_password})`);

        if (isInactive && isTempPassword) {
          await conn.query(
            `UPDATE students
             SET student_status = 'active',
                 is_temp_password = 0,
                 activated_at = NOW()
             WHERE id = ?`,
            [student.id]
          );
          console.log(`[SetPassword] ✅ Student ${resolvedEmail} auto-activated after password change`);
        } else {
          console.log(`[SetPassword] ℹ️  Student ${resolvedEmail} not activated: isInactive=${isInactive}, isTempPassword=${isTempPassword}`);
        }
      }
    }

    if (resolvedRole === 'teacher' || resolvedRole === 'staff') {
      await conn.query(
        `UPDATE staff SET user_id = ? WHERE TRIM(LOWER(email)) = TRIM(LOWER(?))
         AND institution_id = ? AND (user_id IS NULL OR user_id = '')`,
        [resolvedUserId, resolvedEmail, resolvedInstitutionId]
      ).catch((err) => console.warn('setPasswordByEmail: staff link failed:', err.message));
    }

    if (resolvedRole === 'student') {
      await conn.query(
        `UPDATE students SET user_id = ? WHERE TRIM(LOWER(student_email)) = TRIM(LOWER(?))
         AND institution_id = ? AND (user_id IS NULL OR user_id = '')`,
        [resolvedUserId, resolvedEmail, resolvedInstitutionId]
      ).catch((err) => console.warn('setPasswordByEmail: student link failed:', err.message));
    }

    await conn.commit();

    // Generate new token after password change
    const newToken = jwt.sign(
      { userId: resolvedUserId, email: resolvedEmail, role: resolvedRole },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Get updated user data (reflects new student_status = 'active')
    const [updatedUser] = await db.query(
      'SELECT id, email, full_name, role, institution_id, must_change_password FROM users WHERE id = ?',
      [resolvedUserId]
    );

    console.log(`[SetPassword] ✅ Password updated for ${resolvedEmail}, new token generated`);

    return res.json({
      success: true,
      message: 'Password set successfully',
      token: newToken,
      user: updatedUser[0],
      requires_password_change: false,
    });
  } catch (err) {
    await conn.rollback();
    console.error('setPasswordByEmail error:', err);
    return res.status(500).json({ error: 'Failed to set password: ' + err.message });
  } finally {
    conn.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────────────────────────────────────
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const genericResponse = { message: 'If that email exists, a reset code has been sent.' };

  try {
    const [rows] = await db.query(
      `SELECT id, email, full_name, is_active FROM users
       WHERE TRIM(LOWER(email)) = TRIM(LOWER(?))`,
      [email.toLowerCase().trim()]
    );

    if (!rows.length || !rows[0].is_active) {
      console.log(`[ForgotPassword] Email not found or inactive: ${email}`);
      return res.json(genericResponse);
    }

    const user = rows[0];

    const otp   = Math.floor(100000 + Math.random() * 900000).toString();
    const otpId = uuidv4();

    await db.query(`
      CREATE TABLE IF NOT EXISTS password_reset_otps (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        otp VARCHAR(6) NOT NULL,
        expires_at DATETIME NOT NULL,
        is_used BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_otp (otp),
        INDEX idx_expires (expires_at)
      )
    `);

    await db.query('DELETE FROM password_reset_otps WHERE email = ?', [user.email]);

    await db.query(
      `INSERT INTO password_reset_otps (id, email, otp, expires_at, created_at)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE), NOW())`,
      [otpId, user.email, otp]
    );

    console.log(`[ForgotPassword] OTP for ${user.email}: ${otp}`);

    try {
      await sendOtpEmail(user.email, user.full_name, otp);
      console.log(`[ForgotPassword] ✅ Email sent successfully to ${user.email}`);
    } catch (emailErr) {
      console.error(`[ForgotPassword] ❌ Email send FAILED:`, emailErr.message);

      if (process.env.NODE_ENV !== 'production') {
        return res.status(500).json({
          error: 'Failed to send email. Check SMTP configuration.',
          dev_otp: otp,
          dev_hint: 'Use this OTP to test',
        });
      }

      return res.status(500).json({
        error: 'Failed to send reset email. Please try again or contact support.',
      });
    }

    return res.json(genericResponse);
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/verify-otp
// ─────────────────────────────────────────────────────────────────────────────
const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  try {
    const [rows] = await db.query(
      `SELECT * FROM password_reset_otps
       WHERE email = ? AND otp = ? AND expires_at > NOW() AND is_used = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [email.toLowerCase().trim(), otp]
    );

    if (rows.length === 0) {
      const [expiredRows] = await db.query(
        `SELECT * FROM password_reset_otps
         WHERE email = ? AND otp = ? AND is_used = FALSE
         ORDER BY created_at DESC LIMIT 1`,
        [email.toLowerCase().trim(), otp]
      );

      if (expiredRows.length > 0) {
        return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
      }

      return res.status(400).json({ error: 'Invalid OTP. Please check and try again.' });
    }

    const otpRecord = rows[0];

    await db.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        is_used BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_token (token)
      )
    `);

    await db.query('UPDATE password_reset_otps SET is_used = TRUE WHERE id = ?', [otpRecord.id]);

    const resetToken = jwt.sign(
      { email: otpRecord.email, purpose: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    await db.query('DELETE FROM password_reset_tokens WHERE email = ?', [otpRecord.email]);

    const tokenId = uuidv4();
    await db.query(
      `INSERT INTO password_reset_tokens (id, email, token, expires_at, created_at)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE), NOW())`,
      [tokenId, otpRecord.email, resetToken]
    );

    console.log(`[VerifyOTP] ✅ OTP verified for ${otpRecord.email}`);
    res.json({ reset_token: resetToken });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Failed to verify code' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/reset-password
//
// ✅ FIX: Same MySQL tinyint issue fixed here too.
// ─────────────────────────────────────────────────────────────────────────────
const resetPassword = async (req, res) => {
  const { reset_token, new_password } = req.body;

  if (!reset_token || !new_password) {
    return res.status(400).json({ error: 'Reset token and new password are required' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  let payload;
  try {
    payload = jwt.verify(reset_token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(400).json({ error: 'Reset link is invalid or has expired' });
  }

  if (payload.purpose !== 'password_reset') {
    return res.status(400).json({ error: 'Invalid reset token' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [tokenRows] = await conn.query(
      `SELECT * FROM password_reset_tokens
       WHERE token = ? AND email = ? AND expires_at > NOW() AND is_used = FALSE`,
      [reset_token, payload.email]
    );

    if (tokenRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const [userRows] = await conn.query(
      'SELECT id, email, role FROM users WHERE TRIM(LOWER(email)) = TRIM(LOWER(?))',
      [payload.email]
    );

    if (!userRows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userRows[0];

    await conn.query('UPDATE password_reset_tokens SET is_used = TRUE WHERE id = ?', [tokenRows[0].id]);

    const hashedPassword = await bcrypt.hash(new_password, 12);
    await conn.query(
      `UPDATE users SET password = ?, must_change_password = 0, last_password_change = NOW() WHERE id = ?`,
      [hashedPassword, user.id]
    );

    // ✅ FIX: Same MySQL tinyint comparison fix applied here
    if (user.role === 'student') {
      const [studentCheck] = await conn.query(
        `SELECT id, student_status, is_temp_password FROM students
         WHERE user_id = ? OR TRIM(LOWER(student_email)) = TRIM(LOWER(?))`,
        [user.id, payload.email]
      );

      if (studentCheck.length > 0) {
        const student        = studentCheck[0];
        const isTempPassword = Number(student.is_temp_password) === 1; // ✅ FIXED
        const isInactive     = student.student_status === 'inactive';

        if (isInactive && isTempPassword) {
          await conn.query(
            `UPDATE students
             SET student_status = 'active',
                 is_temp_password = 0,
                 activated_at = NOW()
             WHERE id = ?`,
            [student.id]
          );
          console.log(`[ResetPassword] ✅ Student ${payload.email} auto-activated after password reset`);
        }
      }
    }

    await conn.commit();

    const newToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const [updatedUser] = await db.query(
      'SELECT id, email, full_name, role, institution_id, must_change_password FROM users WHERE id = ?',
      [user.id]
    );

    console.log(`[ResetPassword] ✅ Password reset for email=${payload.email}, new token generated`);

    res.json({
      message: 'Password reset successfully',
      token: newToken,
      user: updatedUser[0],
    });
  } catch (err) {
    await conn.rollback();
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  } finally {
    conn.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         u.id, u.email, u.full_name, u.role, u.phone,
         u.is_active, u.institution_id, u.must_change_password,
         i.name AS institution_name, i.type AS institution_type,
         i.admin_email, i.alternate_email, i.alternate_phone
       FROM users u
       LEFT JOIN institutions i ON u.institution_id = i.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    let profile = rows[0];

    if (profile.role === 'student') {
      await db.query(
        `UPDATE students SET user_id = ? WHERE TRIM(LOWER(student_email)) = TRIM(LOWER(?))
         AND institution_id = ? AND (user_id IS NULL OR user_id = '')`,
        [profile.id, profile.email, profile.institution_id]
      ).catch(() => {});

      const [studentRows] = await db.query(
        `SELECT s.id AS student_db_id, s.roll_number, s.class_id, s.student_status, s.is_temp_password,
                s.batch, s.section, s.admission_no,
                c.name AS class_name, c.grade, c.academic_year
         FROM students s
         LEFT JOIN classes c ON s.class_id = c.id
         WHERE (s.user_id = ? OR TRIM(LOWER(s.student_email)) = TRIM(LOWER(?)))
         AND s.institution_id = ? LIMIT 1`,
        [profile.id, profile.email, profile.institution_id]
      ).catch(() => [[]]);
      if (studentRows.length) profile = { ...profile, ...studentRows[0] };
    }

    if (profile.role === 'teacher' || profile.role === 'staff') {
      await db.query(
        `UPDATE staff SET user_id = ? WHERE TRIM(LOWER(email)) = TRIM(LOWER(?))
         AND institution_id = ? AND (user_id IS NULL OR user_id = '')`,
        [profile.id, profile.email, profile.institution_id]
      ).catch(() => {});

      const [staffRows] = await db.query(
        `SELECT st.id AS staff_db_id, st.employee_id AS staff_employee_id,
                st.department, st.designation
         FROM staff st
         WHERE (st.user_id = ? OR TRIM(LOWER(st.email)) = TRIM(LOWER(?)))
         AND st.institution_id = ? LIMIT 1`,
        [profile.id, profile.email, profile.institution_id]
      ).catch(() => [[]]);
      if (staffRows.length) profile = { ...profile, ...staffRows[0] };
    }

    profile.must_change_password = 0;
    res.json(profile);
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/me
// ─────────────────────────────────────────────────────────────────────────────
const updateMe = async (req, res) => {
  const { full_name, phone } = req.body;
  try {
    await db.query(
      'UPDATE users SET full_name = ?, phone = ? WHERE id = ?',
      [full_name, phone, req.user.id]
    );
    res.json({ message: 'Profile updated' });
  } catch (err) {
    console.error('Update me error:', err);
    res.status(500).json({ error: 'Update failed' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/change-password
// ─────────────────────────────────────────────────────────────────────────────
const changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  try {
    const [rows] = await db.query(
      'SELECT password FROM users WHERE id = ?', [req.user.id]
    );

    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(current_password, rows[0].password);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(new_password, 12);
    await db.query(
      `UPDATE users SET password = ?, must_change_password = 0, last_password_change = NOW() WHERE id = ?`,
      [hashed, req.user.id]
    );

    res.json({ message: 'Password changed successfully', requires_password_change: false });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/invite/:token
// ─────────────────────────────────────────────────────────────────────────────
const verifyInvite = async (req, res) => {
  const { token } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT id, email, full_name, role, institution_id, invite_token_expiry
       FROM users WHERE invite_token = ?`,
      [token]
    );
    if (!rows.length) return res.status(404).json({ error: 'Invalid or expired invite link' });

    const user = rows[0];
    if (new Date(user.invite_token_expiry) < new Date()) {
      return res.status(410).json({ error: 'Invite link has expired. Ask your admin to resend.' });
    }
    res.json({ valid: true, email: user.email, full_name: user.full_name, role: user.role });
  } catch (err) {
    console.error('Verify invite error:', err);
    res.status(500).json({ error: 'Failed to verify invite' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/set-password (invite token flow)
// ─────────────────────────────────────────────────────────────────────────────
const setPassword = async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const [rows] = await db.query(
      `SELECT id, email, full_name, role, institution_id, invite_token_expiry
       FROM users WHERE invite_token = ?`,
      [token]
    );
    if (!rows.length) return res.status(404).json({ error: 'Invalid or expired invite link' });

    const user = rows[0];
    if (new Date(user.invite_token_expiry) < new Date()) {
      return res.status(410).json({ error: 'Invite link has expired' });
    }

    const hashed = await bcrypt.hash(password, 12);
    await db.query(
      `UPDATE users SET password = ?, invite_token = NULL, invite_token_expiry = NULL,
       is_active = true, must_change_password = 0 WHERE id = ?`,
      [hashed, user.id]
    );

    if (user.role === 'teacher' || user.role === 'staff') {
      await db.query(
        `UPDATE staff SET user_id = ? WHERE TRIM(LOWER(email)) = TRIM(LOWER(?))
         AND institution_id = ? AND (user_id IS NULL OR user_id = '')`,
        [user.id, user.email, user.institution_id]
      ).catch(() => {});
    }

    if (user.role === 'student') {
      await db.query(
        `UPDATE students SET user_id = ? WHERE TRIM(LOWER(student_email)) = TRIM(LOWER(?))
         AND institution_id = ? AND (user_id IS NULL OR user_id = '')`,
        [user.id, user.email, user.institution_id]
      ).catch((err) => console.warn('setPassword (invite): student link failed:', err.message));
    }

    const jwtToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    res.json({
      message: 'Password set successfully',
      token: jwtToken,
      user: {
        id: user.id, email: user.email, full_name: user.full_name,
        role: user.role, institution_id: user.institution_id, must_change_password: 0,
      },
    });
  } catch (err) {
    console.error('Set password error:', err);
    res.status(500).json({ error: 'Failed to set password' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  register,
  login,
  checkEmail,
  setPasswordByEmail,
  forgotPassword,
  verifyOtp,
  resetPassword,
  getMe,
  updateMe,
  changePassword,
  verifyInvite,
  setPassword,
};