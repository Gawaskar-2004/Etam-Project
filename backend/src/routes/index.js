const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin, requireAdminOrTeacher } = require('../middleware/auth');
const pool = require('../config/db');

// SMTP email via nodemailer
const nodemailer = require('nodemailer');

const smtpTransporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Controllers
const authCtrl        = require('../controllers/authController');
const institutionCtrl = require('../controllers/institutionController');
const academicCtrl    = require('../controllers/academicController');
const studentCtrl     = require('../controllers/studentController');
const staffCtrl       = require('../controllers/staffController');
const subjectCtrl     = require('../controllers/subjectController');
const timetableCtrl   = require('../controllers/timetableController');
const attendanceCtrl  = require('../controllers/attendanceController');
const leaveCtrl       = require('../controllers/leaveController');
const userCtrl        = require('../controllers/userController');
const { upload, uploadImage } = require('../controllers/uploadController');
const hostelController        = require('../controllers/hostelController');
const notificationCtrl        = require('../controllers/notificationController');

// ===================== PUSH NOTIFICATION SERVICE =====================
const { notifyAbsent, notifyClassStarted, notifyTeacher } = require('../services/pushService');

// ===================== AUTO NOTIFICATION SERVICE =====================
const {
  onTimetableUpdated,
  onStudentAdded,
  onAttendanceSessionCreated,
  onAttendanceMarked,
  onStaffAdded,
  onLeaveRequested,
  onLeaveStatusChanged,
} = require('../services/notificationService');

// ── Helper: get Socket.IO instance ───────────────────────────────────────────
function getIO(req) {
  return req.app.get('io') || null;
}

// ── Helper: notify the class teacher of a student + save DB notification ─────
async function notifyClassTeacherOfLeave({ pool, io, studentId, institutionId, requesterName, leaveType, fromDate, toDate, leaveId }) {
  try {
    const [stuRows] = await pool.query(
      'SELECT subcategory_id FROM students WHERE id = ?',
      [studentId]
    );
    const subcategoryId = stuRows[0]?.subcategory_id;
    if (!subcategoryId) return;

    const [ctRows] = await pool.query(
      `SELECT u.id AS user_id, u.full_name, u.push_token
       FROM class_teachers ct
       JOIN staff  s ON s.id            = ct.staff_id
       JOIN users  u ON LOWER(u.email)  = LOWER(s.email)
       WHERE ct.subcategory_id = ?
       LIMIT 1`,
      [subcategoryId]
    );
    if (!ctRows.length) return;

    const teacher = ctRows[0];
    const title   = 'New Leave Request';
    const message = `${requesterName} submitted a ${leaveType || 'leave'} request (${fromDate} → ${toDate})`;

    if (io) {
      io.to(`user_${teacher.user_id}`).emit('notification', {
        type:       'leave_request',
        title,
        message,
        data: { leave_id: leaveId, student_id: studentId, leave_type: leaveType, from_date: fromDate, to_date: toDate },
        created_at: new Date().toISOString(),
      });
    }

    const { v4: uuidv4 } = require('uuid');
    await pool.query(
      `INSERT INTO notifications (id, user_id, type, title, message, data, is_read, created_at)
       VALUES (?, ?, 'leave_request', ?, ?, ?, FALSE, NOW())`,
      [
        uuidv4(),
        teacher.user_id,
        title,
        message,
        JSON.stringify({ leave_id: leaveId, student_id: studentId }),
      ]
    );

    if (teacher.push_token) {
      notifyTeacher(teacher.push_token, { title, body: message }).catch(console.error);
    }

    console.log(`📩 Class teacher ${teacher.full_name} notified of leave request from ${requesterName}`);
  } catch (err) {
    console.error('notifyClassTeacherOfLeave error:', err);
  }
}

// ===================== FACE RECOGNITION WITH MOCK MODE =====================
const path = require('path');

const USE_MOCK_FACE_RECOGNITION = false;
let FACE_RECOGNITION_ENABLED = !USE_MOCK_FACE_RECOGNITION;

let createCanvas, Image;
let canvasAvailable = false;

if (!USE_MOCK_FACE_RECOGNITION) {
  try {
    const canvas = require('canvas');
    createCanvas = canvas.createCanvas;
    Image = canvas.Image;
    canvas._CanvasClass = canvas.Canvas;
    global._nodeCanvas = canvas;
    canvasAvailable = true;
    console.log('✅ Canvas module loaded successfully');
  } catch (err) {
    console.warn('⚠️ Canvas module not available, using mock mode');
    FACE_RECOGNITION_ENABLED = false;
  }
}

let faceapi;
let faceapiAvailable = false;
try {
  faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
  faceapiAvailable = true;
  console.log('✅ Face-api module loaded');
} catch (err) {
  console.warn('⚠️ Face-api module not available');
}

if (!USE_MOCK_FACE_RECOGNITION && canvasAvailable && faceapiAvailable && faceapi.env) {
  try {
    faceapi.env.monkeyPatch({ Canvas: global._nodeCanvas.Canvas, Image });
    console.log('✅ Face-api monkeypatched successfully');
    FACE_RECOGNITION_ENABLED = true;
  } catch (err) {
    console.warn('⚠️ Monkeypatch failed, using mock mode');
    FACE_RECOGNITION_ENABLED = false;
  }
}

const MODEL_PATH = path.resolve(__dirname, '../../../frontend/public/models');
let faceModelsLoaded = false;

async function ensureFaceModels() {
  if (!FACE_RECOGNITION_ENABLED) return false;
  if (faceModelsLoaded) return true;
  try {
    await faceapi.tf.ready();
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH),
      faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH),
      faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH),
    ]);
    faceModelsLoaded = true;
    console.log('✅ Face recognition models loaded successfully');
    return true;
  } catch (err) {
    console.error('❌ Failed to load face models:', err.message);
    return false;
  }
}

if (FACE_RECOGNITION_ENABLED) {
  ensureFaceModels().catch(console.error);
} else {
  console.log('⚠️ Running in MOCK MODE - face recognition will use mock responses');
}

const MAX_IMAGE_DIM = 640;

async function base64ToImage(imageBase64) {
  if (!FACE_RECOGNITION_ENABLED) return null;
  try {
    const base64Data = imageBase64.replace(/^data:image\/(jpeg|jpg|png|webp);base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload  = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = buffer;
    });

    let { width, height } = img;
    if (width > MAX_IMAGE_DIM || height > MAX_IMAGE_DIM) {
      const scale = MAX_IMAGE_DIM / Math.max(width, height);
      width  = Math.round(width  * scale);
      height = Math.round(height * scale);
    }

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    console.log(`   📐 Image resized to ${width}x${height} for face detection`);

    const { data } = imageData;
    const rgb = new Float32Array(width * height * 3);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      rgb[j]     = data[i];
      rgb[j + 1] = data[i + 1];
      rgb[j + 2] = data[i + 2];
    }
    return faceapi.tf.tensor3d(rgb, [height, width, 3]);
  } catch (err) {
    console.error('Base64 to image error:', err);
    return null;
  }
}

async function extractFaceDescriptor(imageBase64) {
  if (!FACE_RECOGNITION_ENABLED) return null;
  if (!imageBase64) return null;
  try {
    const modelsReady = await ensureFaceModels();
    if (!modelsReady) return null;
    const tensor = await base64ToImage(imageBase64);
    if (!tensor) return null;
    let detection;
    try {
      detection = await faceapi
        .detectSingleFace(tensor, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.2 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
    } finally {
      tensor.dispose();
    }
    if (!detection) return null;
    return {
      descriptor: Array.from(detection.descriptor),
      faceCount:  1,
      confidence: detection.detection.score,
    };
  } catch (error) {
    console.error('Error extracting face descriptor:', error.message);
    return null;
  }
}

function calculateDistance(desc1, desc2) {
  if (!desc1 || !desc2 || desc1.length !== desc2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    const diff = desc1[i] - desc2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

const FACE_MATCH_THRESHOLD = 0.55;

// ===================== AUTH =====================
router.post('/auth/register',         authCtrl.register);
router.get('/auth/invite/:token',     authCtrl.verifyInvite);
router.post('/auth/set-password',     authCtrl.setPassword);
router.post('/auth/login',            authCtrl.login);
router.get('/auth/me',                authenticate, authCtrl.getMe);
router.put('/auth/me',                authenticate, authCtrl.updateMe);
router.put('/auth/change-password',   authenticate, authCtrl.changePassword);
router.post('/auth/forgot-password',  authCtrl.forgotPassword);
router.post('/auth/verify-reset-otp', authCtrl.verifyOtp);
router.post('/auth/reset-password',   authCtrl.resetPassword);

// ===================== OTP EMAIL HELPER =====================
async function sendOTPEmail(email, otpCode, isResend = false) {
  try {
    await smtpTransporter.sendMail({
      from:    `"ETAM" <${process.env.SMTP_USER}>`,
      to:      email,
      subject: isResend ? 'Your New Verification Code' : 'Your Verification Code',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; text-align: center; border-radius: 16px 16px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { background: #ffffff; padding: 40px 30px; border-radius: 0 0 16px 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
            .otp-code { font-size: 42px; font-weight: bold; text-align: center; padding: 25px; background: #F3F4F6; border-radius: 12px; margin: 25px 0; letter-spacing: 8px; color: #4F46E5; font-family: monospace; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px; }
            .warning { background: #FEF3C7; padding: 12px; border-radius: 8px; margin: 20px 0; font-size: 13px; color: #92400E; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>🔐 Email Verification</h1></div>
            <div class="content">
              <p style="font-size: 16px;">Hello,</p>
              <p style="font-size: 16px;">Thank you for registering! Please use the verification code below:</p>
              <div class="otp-code"><strong>${otpCode}</strong></div>
              <p style="font-size: 14px;">This code will expire in <strong>10 minutes</strong>.</p>
              <div class="warning"><strong>⚠️ Security Tip:</strong> Never share this code with anyone.</div>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #E5E7EB;" />
              <p style="font-size: 13px; color: #6B7280;">If you didn't request this code, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply.</p>
              <p>&copy; 2024 ETAM. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Send email error:', error);
    return { success: false, error };
  }
}

// ===================== OTP ENDPOINTS =====================

// Send OTP
router.post('/auth/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();

    const [tables] = await pool.query("SHOW TABLES LIKE 'otp_verifications'");
    if (tables.length === 0) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS otp_verifications (
          id VARCHAR(36) PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          otp VARCHAR(6) NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_verified BOOLEAN DEFAULT FALSE,
          INDEX idx_email (email),
          INDEX idx_expires (expires_at)
        )
      `);
    }

    await pool.query('DELETE FROM otp_verifications WHERE email = ?', [email]);
    await pool.query(
      `INSERT INTO otp_verifications (id, email, otp, expires_at, created_at)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), NOW())`,
      [id, email, otp]
    );

    const emailResult = await sendOTPEmail(email, otp, false);
    const [stored]    = await pool.query('SELECT expires_at FROM otp_verifications WHERE id = ?', [id]);

    console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
    console.log(`║                    🔐 OTP VERIFICATION CODE                   ║`);
    console.log(`╠══════════════════════════════════════════════════════════════╣`);
    console.log(`║  📧 Email: ${email.padEnd(44)}║`);
    console.log(`║  🔢 OTP: ${otp.padEnd(48)}║`);
    console.log(`║  ⏰ Expires at: ${String(stored[0]?.expires_at).padEnd(38)}║`);
    console.log(`║  ✅ Valid for: 10 minutes                                    ║`);
    if (emailResult.success) {
      console.log(`║  📨 Email status: SENT to ${email.padEnd(31)}║`);
    } else {
      console.log(`║  ⚠️ Email status: FAILED - Check SMTP config                 ║`);
    }
    console.log(`╚══════════════════════════════════════════════════════════════╝\n`);

    if (!emailResult.success) {
      return res.json({
        success:  true,
        message:  'OTP generated. Check terminal for code.',
        warning:  'Email sending failed. Please check SMTP configuration.',
        expiresIn: 600,
        resendIn:  60,
        ...(process.env.NODE_ENV === 'development' && { devOTP: otp }),
      });
    }
    res.json({ success: true, message: 'Verification code sent to your email', expiresIn: 600, resendIn: 60 });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ FIX: Shared verify OTP logic (used by both route names below)
async function handleVerifyOTP(req, res) {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });
  try {
    const [rows] = await pool.query(
      `SELECT * FROM otp_verifications
       WHERE email = ? AND otp = ? AND expires_at > NOW() AND is_verified = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [email, otp]
    );

    if (rows.length === 0) {
      const [expiredRows] = await pool.query(
        `SELECT * FROM otp_verifications
         WHERE email = ? AND otp = ? AND is_verified = FALSE
         ORDER BY created_at DESC LIMIT 1`,
        [email, otp]
      );
      if (expiredRows.length > 0) {
        return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
      }
      return res.status(400).json({ error: 'Invalid OTP. Please check and try again.' });
    }

    await pool.query('UPDATE otp_verifications SET is_verified = TRUE WHERE id = ?', [rows[0].id]);
    await pool.query(
      'UPDATE users SET email_verified = TRUE, email_verified_at = NOW() WHERE LOWER(email) = LOWER(?)',
      [email]
    );

    console.log(`✅ Email verified successfully: ${email}`);
    res.json({ success: true, message: 'Email verified successfully', verified: true });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: err.message });
  }
}

// ✅ FIX: Frontend calls /auth/verify-otp — this was MISSING before (was only /auth/verify-email-otp)
router.post('/auth/verify-otp',       handleVerifyOTP);
// Keep old name as alias so nothing else breaks
router.post('/auth/verify-email-otp', handleVerifyOTP);

// Resend OTP
router.post('/auth/resend-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();

    await pool.query('DELETE FROM otp_verifications WHERE email = ?', [email]);
    await pool.query(
      `INSERT INTO otp_verifications (id, email, otp, expires_at, created_at)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), NOW())`,
      [id, email, otp]
    );

    const emailResult = await sendOTPEmail(email, otp, true);
    const [stored]    = await pool.query('SELECT expires_at FROM otp_verifications WHERE id = ?', [id]);

    console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
    console.log(`║                  🔄 RESENT OTP CODE                           ║`);
    console.log(`╠══════════════════════════════════════════════════════════════╣`);
    console.log(`║  📧 Email: ${email.padEnd(44)}║`);
    console.log(`║  🔢 New OTP: ${otp.padEnd(45)}║`);
    console.log(`║  ⏰ Expires at: ${String(stored[0]?.expires_at).padEnd(38)}║`);
    if (emailResult.success) {
      console.log(`║  📨 Email status: SENT to ${email.padEnd(31)}║`);
    } else {
      console.log(`║  ⚠️ Email status: FAILED - Check SMTP config                 ║`);
    }
    console.log(`╚══════════════════════════════════════════════════════════════╝\n`);

    res.json({
      success:  true,
      message:  emailResult.success ? 'New verification code sent to your email' : 'OTP generated. Check terminal for code.',
      expiresIn: 600,
      resendIn:  60,
    });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===================== AUTH EXTRAS =====================
router.post('/auth/check-email', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const emailLower = email.trim().toLowerCase();
  try {
    const [userRows] = await pool.query('SELECT id, role FROM users WHERE LOWER(email) = ?', [emailLower]);
    if (userRows.length > 0) return res.json({ exists: true, role: userRows[0].role, type: 'user' });

    const [stuRows] = await pool.query('SELECT id, full_name FROM students WHERE LOWER(student_email) = ?', [emailLower]);
    if (stuRows.length > 0) return res.json({ exists: true, role: 'student', type: 'student', name: stuRows[0].full_name });

    const [staffRows] = await pool.query('SELECT id, full_name FROM staff WHERE LOWER(email) = ?', [emailLower]);
    if (staffRows.length > 0) return res.json({ exists: true, role: 'teacher', type: 'staff', name: staffRows[0].full_name });

    res.json({ exists: false });
  } catch (err) {
    console.error('check-email error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/auth/set-password-by-email', async (req, res) => {
  const { email, new_password } = req.body;
  if (!email || !new_password) return res.status(400).json({ error: 'Email and password required' });
  const emailLower = email.trim().toLowerCase();
  try {
    const bcrypt = require('bcryptjs');
    const { v4: uuidv4 } = require('uuid');
    const hash = await bcrypt.hash(new_password, 10);

    const [userRows] = await pool.query('SELECT id FROM users WHERE LOWER(email) = ?', [emailLower]);
    if (userRows.length > 0) {
      await pool.query('UPDATE users SET password = ?, is_active = 1 WHERE LOWER(email) = ?', [hash, emailLower]);
      return res.json({ success: true, message: 'Password updated successfully' });
    }

    const [stuRows] = await pool.query('SELECT id, full_name, institution_id FROM students WHERE LOWER(student_email) = ?', [emailLower]);
    if (stuRows.length > 0) {
      const student = stuRows[0];
      const userId  = uuidv4();
      await pool.query(
        'INSERT INTO users (id, email, password, role, full_name, institution_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [userId, email, hash, 'student', student.full_name, student.institution_id]
      );
      return res.json({ success: true, message: 'Student account created successfully' });
    }

    const [staffRows] = await pool.query('SELECT id, full_name, institution_id FROM staff WHERE email = ?', [email]);
    if (staffRows.length > 0) {
      const staff  = staffRows[0];
      const userId = uuidv4();
      await pool.query(
        'INSERT INTO users (id, email, password, role, full_name, institution_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [userId, email, hash, 'teacher', staff.full_name, staff.institution_id]
      );
      return res.json({ success: true, message: 'Teacher account created successfully' });
    }

    return res.status(404).json({ error: 'Email not found. Please contact your admin.' });
  } catch (err) {
    console.error('Set password error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===================== INSTITUTION =====================
router.get('/institutions/my', authenticate, institutionCtrl.getMyInstitution);
router.put('/institutions/my', authenticate, requireAdmin, institutionCtrl.updateInstitution);

// ===================== USER MANAGEMENT =====================
router.get('/users',  authenticate, requireAdmin, userCtrl.getUsers);
router.post('/users', authenticate, requireAdmin, userCtrl.createUser);

router.put('/users/push-token', authenticate, async (req, res) => {
  const { push_token } = req.body;
  if (!push_token) return res.status(400).json({ error: 'push_token required' });
  try {
    await pool.query('UPDATE users SET push_token = ? WHERE id = ?', [push_token, req.user.id]);
    console.log(`📱 Push token saved for user: ${req.user.id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Save push token error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/users/:id',    authenticate, requireAdmin, userCtrl.getUser);
router.put('/users/:id',    authenticate, requireAdmin, userCtrl.updateUser);
router.delete('/users/:id', authenticate, requireAdmin, userCtrl.deleteUser);


// ===================== ACADEMIC STRUCTURE =====================
router.get('/academic/labels',  authenticate, academicCtrl.getLabels);
router.post('/academic/labels', authenticate, requireAdmin, academicCtrl.upsertLabels);

router.get('/academic/categories',         authenticate, academicCtrl.getCategories);
router.post('/academic/categories',        authenticate, requireAdmin, academicCtrl.createCategory);
router.put('/academic/categories/:id',     authenticate, requireAdmin, academicCtrl.updateCategory);
router.delete('/academic/categories/:id',  authenticate, requireAdmin, academicCtrl.deleteCategory);

router.get('/academic/subcategories',        authenticate, academicCtrl.getSubcategories);
router.post('/academic/subcategories',       authenticate, requireAdmin, academicCtrl.createSubcategory);
router.put('/academic/subcategories/:id',    authenticate, requireAdmin, academicCtrl.updateSubcategory);
router.delete('/academic/subcategories/:id', authenticate, requireAdmin, academicCtrl.deleteSubcategory);

router.get('/academic/items',        authenticate, academicCtrl.getItems);
router.post('/academic/items',       authenticate, requireAdmin, academicCtrl.createItem);
router.put('/academic/items/:id',    authenticate, requireAdmin, academicCtrl.updateItem);
router.delete('/academic/items/:id', authenticate, requireAdmin, academicCtrl.deleteItem);

router.post('/academic/copy', authenticate, requireAdmin, academicCtrl.copyAcademicStructure);

// ===================== STUDENTS =====================
router.get('/students/by-email/:email/attendance-summary', authenticate, async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();
    const [stuRows] = await pool.query(
      'SELECT id, full_name, roll_number, subcategory_id, category_id, item_id FROM students WHERE LOWER(student_email) = ?',
      [email]
    );
    if (!stuRows.length) return res.json([]);

    const student = stuRows[0];
    const [attendanceData] = await pool.query(
      `SELECT
         sub.id as subject_id, sub.name as subject_name, sub.code as subject_code,
         COUNT(DISTINCT ases.id) as total_sessions,
         SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
         ROUND(SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) / NULLIF(COUNT(DISTINCT ases.id), 0) * 100, 2) as attendance_percentage
       FROM attendance_session ases
       LEFT JOIN subjects sub ON sub.id = ases.subject_id
       LEFT JOIN attendance_record ar ON ar.attendance_session_id = ases.id AND ar.student_id = ?
       WHERE ases.institution_id = ? AND ases.subcategory_id = ?
         ${student.item_id ? 'AND (ases.item_id = ? OR ases.item_id IS NULL)' : ''}
       GROUP BY sub.id, sub.name, sub.code
       HAVING total_sessions > 0
       ORDER BY sub.name`,
      student.item_id
        ? [student.id, req.user.institution_id, student.subcategory_id, student.item_id]
        : [student.id, req.user.institution_id, student.subcategory_id]
    );

    if (!attendanceData.length) return res.json([]);

    res.json(attendanceData.map(item => ({
      subject_id:            item.subject_id,
      subject_name:          item.subject_name || 'General',
      subject_code:          item.subject_code,
      total_sessions:        parseInt(item.total_sessions)  || 0,
      present_count:         parseInt(item.present_count)   || 0,
      absent_count:          (parseInt(item.total_sessions) || 0) - (parseInt(item.present_count) || 0),
      attendance_percentage: parseFloat(item.attendance_percentage) || 0,
    })));
  } catch (err) {
    console.error('Student attendance by email error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/students/repair-subcategory-ids', authenticate, requireAdmin, studentCtrl.repairSubcategoryIds);
router.post('/students/change-password',         authenticate, studentCtrl.changePassword);

router.get('/students',      authenticate, studentCtrl.getStudents);
router.get('/students/:id',  authenticate, studentCtrl.getStudent);

router.post('/students', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const originalJson = res.json.bind(res);
    let responseData = null;
    res.json = (data) => { responseData = data; originalJson(data); };

    await studentCtrl.createStudent(req, res);

    if (responseData && !responseData.error) {
      onStudentAdded(pool, getIO(req), {
        studentName:   req.body.full_name || 'A new student',
        subcategoryId: req.body.subcategory_id,
        adminId:       req.user.id,
        adminName:     req.user.full_name || req.user.email,
      }).catch(console.error);
    }
  } catch (err) { next(err); }
});

router.put('/students/:id',    authenticate, requireAdmin, studentCtrl.updateStudent);
router.delete('/students/:id', authenticate, requireAdmin, studentCtrl.deleteStudent);

router.get('/students/:id/attendance-summary', authenticate, async (req, res) => {
  try {
    let studentId = req.params.id;
    if (req.user.role === 'student') {
      const [stuRows] = await pool.query(
        'SELECT id FROM students WHERE LOWER(student_email) = LOWER(?)', [req.user.email]
      );
      if (stuRows.length > 0) studentId = stuRows[0].id;
    }
    const [rows] = await pool.query(
      `SELECT sub.id as subject_id, sub.name as subject_name, sub.code as subject_code, sub.course_type,
         COUNT(DISTINCT ases.id) as total_sessions,
         SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
         ROUND(SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) / NULLIF(COUNT(DISTINCT ases.id), 0) * 100, 2) as attendance_percentage
       FROM attendance_session ases
       LEFT JOIN subjects sub ON sub.id = ases.subject_id
       LEFT JOIN attendance_record ar ON ar.attendance_session_id = ases.id AND ar.student_id = ?
       WHERE ases.institution_id = ?
       GROUP BY sub.id, sub.name, sub.code, sub.course_type
       HAVING total_sessions > 0`,
      [studentId, req.user.institution_id]
    );
    res.json(rows.map(item => ({
      subject_id:            item.subject_id,
      subject_name:          item.subject_name || 'General',
      subject_code:          item.subject_code,
      course_type:           item.course_type,
      total_sessions:        parseInt(item.total_sessions)  || 0,
      present_count:         parseInt(item.present_count)   || 0,
      absent_count:          (parseInt(item.total_sessions) || 0) - (parseInt(item.present_count) || 0),
      attendance_percentage: parseFloat(item.attendance_percentage) || 0,
    })));
  } catch (err) {
    console.error('attendance summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===================== FACE DESCRIPTOR ROUTES =====================
router.post('/students/:id/face-descriptor', authenticate, requireAdminOrTeacher, async (req, res) => {
  const { id } = req.params;
  const { face_descriptor, face_photo } = req.body;
  try {
    let descriptorString;
    if (typeof face_descriptor === 'string') {
      let parsed;
      try { parsed = JSON.parse(face_descriptor); } catch (e) {
        return res.status(400).json({ error: 'face_descriptor string is not valid JSON' });
      }
      if (!Array.isArray(parsed) || parsed.length !== 128)
        return res.status(400).json({ error: `Invalid descriptor: expected 128 values, got ${parsed?.length}` });
      descriptorString = face_descriptor;
    } else if (Array.isArray(face_descriptor)) {
      if (face_descriptor.length !== 128)
        return res.status(400).json({ error: `Invalid descriptor: expected 128 values, got ${face_descriptor.length}` });
      descriptorString = JSON.stringify(face_descriptor);
    } else {
      return res.status(400).json({ error: 'face_descriptor must be a JSON string or array of 128 numbers' });
    }
    await pool.query(
      'UPDATE students SET face_descriptor = ?, face_photo = ? WHERE id = ?',
      [descriptorString, face_photo || null, id]
    );
    res.json({ success: true, message: 'Face descriptor saved' });
  } catch (err) {
    console.error('Face descriptor save error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/students/:id/face-descriptor', authenticate, requireAdminOrTeacher, async (req, res) => {
  try {
    await pool.query('UPDATE students SET face_descriptor = NULL, face_photo = NULL WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Face descriptor removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================== HOSTEL MANAGEMENT =====================
router.get('/hostel/blocks',          authenticate, hostelController.getBlocks);
router.post('/hostel/blocks',         authenticate, requireAdmin, hostelController.createBlock);
router.put('/hostel/blocks/:id',      authenticate, requireAdmin, hostelController.updateBlock);
router.delete('/hostel/blocks/:id',   authenticate, requireAdmin, hostelController.deleteBlock);

router.get('/hostel/rooms',           authenticate, hostelController.getRooms);
router.post('/hostel/rooms',          authenticate, requireAdmin, hostelController.createRoom);
router.put('/hostel/rooms/:id',       authenticate, requireAdmin, hostelController.updateRoom);
router.delete('/hostel/rooms/:id',    authenticate, requireAdmin, hostelController.deleteRoom);

router.get('/hostel/allocations',     authenticate, hostelController.getAllocations);
router.post('/hostel/allocations',    authenticate, requireAdmin, hostelController.createAllocation);
router.put('/hostel/allocations/:id', authenticate, requireAdmin, hostelController.updateAllocation);

router.get('/hostel/leaves',          authenticate, hostelController.getLeaves);
router.post('/hostel/leaves',         authenticate, requireAdmin, hostelController.createLeave);
router.put('/hostel/leaves/:id',      authenticate, requireAdmin, hostelController.updateLeave);

router.get('/hostel/complaints',      authenticate, hostelController.getComplaints);
router.post('/hostel/complaints',     authenticate, requireAdmin, hostelController.createComplaint);
router.put('/hostel/complaints/:id',  authenticate, requireAdmin, hostelController.updateComplaint);

router.get('/hostel/students',        authenticate, hostelController.getHostelStudents);

router.get('/hostel/attendance',            authenticate, hostelController.getAttendance);
router.put('/hostel/attendance/:id',        authenticate, requireAdmin, hostelController.updateAttendance);
router.post('/hostel/attendance/batch',     authenticate, requireAdmin, hostelController.markAttendanceBatch);

// ===================== STAFF =====================
router.get('/staff/by-email/:email', authenticate, staffCtrl.getStaffByEmail);
router.get('/staff',                 authenticate, staffCtrl.getStaff);
router.get('/staff/:id',             authenticate, staffCtrl.getStaffById);

router.post('/staff', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const originalJson = res.json.bind(res);
    let responseData = null;
    res.json = (data) => { responseData = data; originalJson(data); };

    await staffCtrl.createStaff(req, res);

    if (responseData && !responseData.error) {
      onStaffAdded(pool, getIO(req), {
        staffName:     req.body.full_name   || 'New Staff',
        staffEmail:    req.body.email       || '',
        staffRole:     req.body.designation || req.body.role || '',
        adminId:       req.user.id,
        adminName:     req.user.full_name   || req.user.email,
        institutionId: req.user.institution_id,
      }).catch(console.error);
    }
  } catch (err) { next(err); }
});

router.put('/staff/:id',    authenticate, requireAdmin, staffCtrl.updateStaff);
router.delete('/staff/:id', authenticate, requireAdmin, staffCtrl.deleteStaff);

router.get('/staff/:id/workload',          authenticate, staffCtrl.getStaffWorkload);
router.get('/staff/:id/assignments',       authenticate, staffCtrl.getStaffAssignments);
router.get('/staff/:id/class-teacher',     authenticate, staffCtrl.getStaffClassTeacher);
router.post('/staff/:id/academic-mapping', authenticate, requireAdmin, staffCtrl.updateAcademicMapping);

// ===================== SUBJECTS =====================
router.get('/subjects',              authenticate, subjectCtrl.getSubjects);
router.get('/subjects/:id',          authenticate, subjectCtrl.getSubject);
router.post('/subjects',             authenticate, requireAdmin, subjectCtrl.createSubject);
router.put('/subjects/:id',          authenticate, requireAdmin, subjectCtrl.updateSubject);
router.delete('/subjects/:id',       authenticate, requireAdmin, subjectCtrl.deleteSubject);
router.post('/subjects/:id/assign-staff', authenticate, requireAdmin, subjectCtrl.assignStaff);

// ===================== TIMETABLE =====================
router.get('/periods',        authenticate, timetableCtrl.getPeriods);
router.post('/periods/sync',  authenticate, requireAdmin, timetableCtrl.syncPeriods);
router.post('/periods',       authenticate, requireAdmin, timetableCtrl.createPeriod);
router.put('/periods/:id',    authenticate, requireAdmin, timetableCtrl.updatePeriod);
router.delete('/periods/:id', authenticate, requireAdmin, timetableCtrl.deletePeriod);

router.get('/timetable', authenticate, timetableCtrl.getTimetable);

router.post('/timetable', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const originalJson = res.json.bind(res);
    let responseData = null;
    res.json = (data) => { responseData = data; originalJson(data); };
    await timetableCtrl.createTimetableEntry(req, res);
    if (responseData && !responseData.error) {
      onTimetableUpdated(pool, getIO(req), {
        institutionId: req.user.institution_id,
        adminId:       req.user.id,
        adminName:     req.user.full_name || req.user.email,
        subcategoryId: req.body.subcategory_id,
        changeDetail:  req.body.subject_name ? `New timetable entry added for ${req.body.subject_name}` : null,
      }).catch(console.error);
    }
  } catch (err) { next(err); }
});

router.put('/timetable/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const originalJson = res.json.bind(res);
    let responseData = null;
    res.json = (data) => { responseData = data; originalJson(data); };
    await timetableCtrl.updateTimetableEntry(req, res);
    if (responseData && !responseData.error) {
      onTimetableUpdated(pool, getIO(req), {
        institutionId: req.user.institution_id,
        adminId:       req.user.id,
        adminName:     req.user.full_name || req.user.email,
        subcategoryId: req.body.subcategory_id,
        changeDetail:  req.body.subject_name ? `Timetable entry updated for ${req.body.subject_name}` : null,
      }).catch(console.error);
    }
  } catch (err) { next(err); }
});

router.delete('/timetable/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const originalJson = res.json.bind(res);
    let responseData = null;
    res.json = (data) => { responseData = data; originalJson(data); };
    await timetableCtrl.deleteTimetableEntry(req, res);
    if (responseData && !responseData.error) {
      onTimetableUpdated(pool, getIO(req), {
        institutionId: req.user.institution_id,
        adminId:       req.user.id,
        adminName:     req.user.full_name || req.user.email,
        changeDetail:  'A timetable entry has been removed',
      }).catch(console.error);
    }
  } catch (err) { next(err); }
});

router.get('/timetable-assignments', authenticate, timetableCtrl.getTimetableAssignments);

router.post('/timetable-assignments', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const originalJson = res.json.bind(res);
    let responseData = null;
    res.json = (data) => { responseData = data; originalJson(data); };
    await timetableCtrl.upsertTimetableAssignment(req, res);
    if (responseData && !responseData.error) {
      onTimetableUpdated(pool, getIO(req), {
        institutionId: req.user.institution_id,
        adminId:       req.user.id,
        adminName:     req.user.full_name || req.user.email,
        subcategoryId: req.body.subcategory_id,
        changeDetail:  'Teacher assignment updated in the timetable',
      }).catch(console.error);
    }
  } catch (err) { next(err); }
});

router.put('/timetable-assignments/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const originalJson = res.json.bind(res);
    let responseData = null;
    res.json = (data) => { responseData = data; originalJson(data); };
    await timetableCtrl.upsertTimetableAssignment(req, res);
    if (responseData && !responseData.error) {
      onTimetableUpdated(pool, getIO(req), {
        institutionId: req.user.institution_id,
        adminId:       req.user.id,
        adminName:     req.user.full_name || req.user.email,
        subcategoryId: req.body.subcategory_id,
        changeDetail:  'Teacher assignment updated in the timetable',
      }).catch(console.error);
    }
  } catch (err) { next(err); }
});

router.delete('/timetable-assignments/:id', authenticate, requireAdmin, timetableCtrl.deleteTimetableAssignment);

router.get('/class-teachers',  authenticate, timetableCtrl.getClassTeachers);
router.post('/class-teachers', authenticate, requireAdmin, timetableCtrl.upsertClassTeacher);

router.post('/timetable-config', authenticate, requireAdmin, timetableCtrl.saveTimetableConfig);
router.get('/timetable-config',  authenticate, timetableCtrl.getTimetableConfig);

// ===================== ATTENDANCE =====================
router.get('/attendance/settings',  authenticate, attendanceCtrl.getSettings);
router.post('/attendance/settings', authenticate, requireAdmin, attendanceCtrl.upsertSettings);
router.get('/attendance/sessions',  authenticate, attendanceCtrl.getSessions);

router.post('/attendance/sessions', authenticate, requireAdminOrTeacher, async (req, res, next) => {
  try {
    const originalJson = res.json.bind(res);
    let responseData = null;
    res.json = (data) => { responseData = data; originalJson(data); };
    await attendanceCtrl.createSession(req, res);
    if (responseData && !responseData.error) {
      const subjectName   = req.body.subject_name || 'a class';
      const subcategoryId = req.body.subcategory_id;
      if (subcategoryId) notifyClassStarted(pool, subcategoryId, subjectName).catch(console.error);
      onAttendanceSessionCreated(pool, getIO(req), {
        teacherId:       req.user.id,
        subjectName,
        subcategoryName: req.body.subcategory_name || null,
        sessionId:       responseData.id || responseData.session_id || null,
      }).catch(console.error);
    }
  } catch (err) { next(err); }
});

router.get('/attendance/sessions/:id/records', authenticate, attendanceCtrl.getRecords);

router.post('/attendance/sessions/:id/records', authenticate, requireAdminOrTeacher, async (req, res, next) => {
  try {
    const originalJson = res.json.bind(res);
    let responseData = null;
    res.json = (data) => { responseData = data; originalJson(data); };
    await attendanceCtrl.markAttendance(req, res);
    if (responseData && !responseData.error) {
      const records     = req.body.records || [];
      const subjectName = req.body.subject_name || 'a class';
      for (const record of records) {
        if (record.status === 'absent' && record.student_id)
          notifyAbsent(pool, record.student_id, subjectName).catch(console.error);
      }
      onAttendanceMarked(pool, getIO(req), {
        teacherId:       req.user.id,
        teacherName:     req.user.full_name || req.user.email,
        subjectName,
        subcategoryName: req.body.subcategory_name || null,
        totalStudents:   records.length,
        presentCount:    records.filter(r => r.status === 'present').length,
        absentCount:     records.filter(r => r.status === 'absent').length,
        institutionId:   req.user.institution_id,
      }).catch(console.error);
    }
  } catch (err) { next(err); }
});

router.put('/attendance/records/:id', authenticate, requireAdminOrTeacher, attendanceCtrl.updateRecord);

router.get('/attendance/statistics',    authenticate, attendanceCtrl.getStatistics);
router.get('/attendance/daily-summary', authenticate, attendanceCtrl.getDailySummary);

router.get('/attendance/students/by-email/:email/attendance-summary', authenticate, attendanceCtrl.getStudentAttendanceSummaryByEmail);
router.get('/attendance/students/:id/attendance-summary',             authenticate, attendanceCtrl.getStudentAttendanceById);
router.get('/attendance/subject-summary',                             authenticate, attendanceCtrl.getSubjectAttendanceSummary);

// ===================== FACE RECOGNITION =====================
router.post('/attendance/face-recognize', authenticate, async (req, res) => {
  try {
    const { image, subcategory_id, item_id } = req.body;
    if (!image)          return res.status(400).json({ error: 'image is required' });
    if (!subcategory_id) return res.status(400).json({ error: 'subcategory_id is required' });

    let queryDescriptor = null;
    if (FACE_RECOGNITION_ENABLED) {
      const result = await extractFaceDescriptor(image);
      if (result && result.descriptor) {
        queryDescriptor = result.descriptor;
      } else {
        return res.json({ matched: false, student_id: null, message: 'No face detected in image. Position face clearly in frame.' });
      }
    } else {
      return res.json({ matched: false, student_id: null, message: 'Face recognition unavailable — use manual attendance.' });
    }

    let query = `
      SELECT id, full_name, roll_number, face_descriptor FROM students
      WHERE subcategory_id = ? AND face_descriptor IS NOT NULL
      AND face_descriptor != '' AND LENGTH(face_descriptor) > 100
    `;
    let params = [subcategory_id];
    if (item_id) { query += ` AND (item_id = ? OR item_id IS NULL)`; params.push(item_id); }

    const [students] = await pool.query(query, params);
    if (!students.length) return res.json({ matched: false, student_id: null, message: 'No students with registered faces in this class' });

    let bestMatch = null, bestDistance = Infinity;
    for (const student of students) {
      try {
        let storedDesc = student.face_descriptor;
        if (typeof storedDesc === 'string') storedDesc = JSON.parse(storedDesc);
        if (!Array.isArray(storedDesc) || storedDesc.length !== 128) continue;
        const dist = calculateDistance(queryDescriptor, storedDesc);
        if (dist < bestDistance) { bestDistance = dist; bestMatch = student; }
      } catch (e) { /* skip malformed */ }
    }

    if (bestMatch && bestDistance < FACE_MATCH_THRESHOLD) {
      const confidence = Math.max(0, (1 - bestDistance / FACE_MATCH_THRESHOLD) * 100).toFixed(1);
      return res.json({
        matched:      true,
        student_id:   bestMatch.id,
        student_name: bestMatch.full_name,
        roll_number:  bestMatch.roll_number,
        confidence:   parseFloat(confidence),
        distance:     bestDistance.toFixed(4),
        message:      'Face recognized successfully',
      });
    }

    return res.json({ matched: false, student_id: null, message: `No match found (closest distance: ${bestDistance.toFixed(4)})` });
  } catch (error) {
    console.error('Face recognition error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/face/check-duplicate', authenticate, async (req, res) => {
  const { image_base64, exclude_student_id } = req.body;
  if (!image_base64) return res.status(400).json({ error: 'Image required' });
  if (!FACE_RECOGNITION_ENABLED) return res.json({ isDuplicate: false, checkedCount: 0, message: 'Face recognition unavailable' });
  try {
    const result = await extractFaceDescriptor(image_base64);
    if (!result || !result.descriptor) return res.json({ isDuplicate: false, checkedCount: 0, message: 'No face detected in image' });
    let query = `SELECT id, full_name, face_descriptor FROM students WHERE face_descriptor IS NOT NULL AND LENGTH(face_descriptor) > 100`;
    const params = [];
    if (exclude_student_id) { query += ` AND id != ?`; params.push(exclude_student_id); }
    const [students] = await pool.query(query, params);
    for (const student of students) {
      try {
        let stored = student.face_descriptor;
        if (typeof stored === 'string') stored = JSON.parse(stored);
        if (!Array.isArray(stored) || stored.length !== 128) continue;
        if (calculateDistance(result.descriptor, stored) < FACE_MATCH_THRESHOLD)
          return res.json({ isDuplicate: true, studentName: student.full_name, studentId: student.id });
      } catch (e) { /* skip */ }
    }
    res.json({ isDuplicate: false, checkedCount: students.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/face/detect', authenticate, async (req, res) => {
  const { image_base64 } = req.body;
  if (!image_base64) return res.status(400).json({ error: 'Image required' });
  if (!FACE_RECOGNITION_ENABLED) return res.status(503).json({ error: 'Face recognition models are not loaded on this server.' });
  try {
    const result = await extractFaceDescriptor(image_base64);
    if (!result || !result.descriptor)
      return res.status(400).json({ error: 'No face detected in image. Use a clear, well-lit photo with face fully visible.' });
    res.json({ success: true, descriptor: result.descriptor, faceCount: result.faceCount || 1, confidence: result.confidence || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/attendance/match-face', authenticate, async (req, res) => {
  const { face_descriptor, subcategory_id, item_id } = req.body;
  if (!face_descriptor || !subcategory_id) return res.status(400).json({ error: 'face_descriptor and subcategory_id required' });
  try {
    let query = `SELECT id, full_name, roll_number, face_descriptor FROM students WHERE subcategory_id = ? AND face_descriptor IS NOT NULL AND face_descriptor != ''`;
    let params = [subcategory_id];
    if (item_id) { query += ` AND (item_id = ? OR item_id IS NULL)`; params.push(item_id); }
    const [students] = await pool.query(query, params);
    if (!students.length) return res.json({ matched_student_id: null, message: 'No face data registered in this class' });

    const queryDesc  = typeof face_descriptor === 'string' ? JSON.parse(face_descriptor) : face_descriptor;
    const THRESHOLD  = 12.0;
    let bestMatch = null, bestDistance = Infinity;

    for (const student of students) {
      try {
        let storedDesc = typeof student.face_descriptor === 'string' ? JSON.parse(student.face_descriptor) : student.face_descriptor;
        if (!Array.isArray(storedDesc) || storedDesc.length !== 128) continue;
        const distance = calculateDistance(queryDesc, storedDesc);
        if (distance < bestDistance) { bestDistance = distance; bestMatch = student; }
      } catch {}
    }

    if (bestMatch && bestDistance < THRESHOLD) {
      return res.json({
        matched_student_id: bestMatch.id,
        student_name: bestMatch.full_name,
        roll_number:  bestMatch.roll_number,
        distance:     bestDistance.toFixed(3),
        confidence:   Math.max(0, (1 - (bestDistance / THRESHOLD)) * 100).toFixed(1) + '%',
      });
    }
    return res.json({ matched_student_id: null, message: `No match found (best distance: ${bestDistance.toFixed(3)})` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/attendance/face-recognize-test', authenticate, async (req, res) => {
  const { subcategory_id, item_id } = req.body;
  try {
    let query = `SELECT id, full_name, roll_number FROM students WHERE subcategory_id = ?`;
    let params = [subcategory_id];
    if (item_id) { query += ` AND item_id = ?`; params.push(item_id); }
    const [students] = await pool.query(query, params);
    if (students.length > 0) {
      return res.json({ matched: true, student_id: students[0].id, student_name: students[0].full_name, roll_number: students[0].roll_number, confidence: 100, message: 'Test match successful' });
    }
    return res.json({ matched: false, message: 'No students found' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===================== LEAVE REQUESTS =====================
router.get('/leave-requests', authenticate, leaveCtrl.getLeaveRequests);

router.post('/leave-requests', authenticate, async (req, res, next) => {
  try {
    const originalJson = res.json.bind(res);
    let responseData = null;
    res.json = (data) => { responseData = data; originalJson(data); };

    await leaveCtrl.createLeaveRequest(req, res);

    if (responseData && !responseData.error) {
      notifyClassTeacherOfLeave({
        pool,
        io:            getIO(req),
        studentId:     responseData.student_id,
        institutionId: req.user.institution_id,
        requesterName: req.user.full_name || req.user.email,
        leaveType:     req.body.leave_type || 'leave',
        fromDate:      req.body.from_date  || '',
        toDate:        req.body.to_date    || '',
        leaveId:       responseData.id,
      }).catch(console.error);

      onLeaveRequested(pool, getIO(req), {
        requesterName: req.user.full_name || req.user.email,
        requesterId:   req.user.id,
        leaveType:     req.body.leave_type || 'Leave',
        fromDate:      req.body.from_date  || '',
        toDate:        req.body.to_date    || '',
        institutionId: req.user.institution_id,
      }).catch(console.error);
    }
  } catch (err) { next(err); }
});

router.put('/leave-requests/:id/approve', authenticate, requireAdminOrTeacher, async (req, res, next) => {
  try {
    const [leaveRows] = await pool.query(
      'SELECT * FROM leave_requests WHERE id = ?', [req.params.id]
    );

    const originalJson = res.json.bind(res);
    let responseData = null;
    res.json = (data) => { responseData = data; originalJson(data); };

    await leaveCtrl.approveLeave(req, res);

    if (responseData && !responseData.error && leaveRows.length) {
      const leave = leaveRows[0];
      onLeaveStatusChanged(pool, getIO(req), {
        requesterId: leave.student_id,
        adminId:     req.user.id,
        adminName:   req.user.full_name || req.user.email,
        status:      'approved',
        leaveType:   leave.leave_type || 'Leave',
        fromDate:    leave.from_date  || '',
        toDate:      leave.to_date    || '',
      }).catch(console.error);
    }
  } catch (err) { next(err); }
});

router.put('/leave-requests/:id/reject', authenticate, requireAdminOrTeacher, async (req, res, next) => {
  try {
    const [leaveRows] = await pool.query(
      'SELECT * FROM leave_requests WHERE id = ?', [req.params.id]
    );

    const originalJson = res.json.bind(res);
    let responseData = null;
    res.json = (data) => { responseData = data; originalJson(data); };

    await leaveCtrl.rejectLeave(req, res);

    if (responseData && !responseData.error && leaveRows.length) {
      const leave = leaveRows[0];
      onLeaveStatusChanged(pool, getIO(req), {
        requesterId: leave.student_id,
        adminId:     req.user.id,
        adminName:   req.user.full_name || req.user.email,
        status:      'rejected',
        leaveType:   leave.leave_type || 'Leave',
        fromDate:    leave.from_date  || '',
        toDate:      leave.to_date    || '',
        reason:      req.body.reason  || null,
      }).catch(console.error);
    }
  } catch (err) { next(err); }
});

router.delete('/leave-requests/:id', authenticate, leaveCtrl.deleteLeaveRequest);

// ===================== FILE UPLOAD =====================
router.post('/upload', authenticate, upload.single('file'), uploadImage);

// ===================== DEBUG =====================
router.get('/timetable/debug', authenticate, timetableCtrl.debugTimetable);

router.get('/debug/attendance/:email', authenticate, async (req, res) => {
  try {
    const email = req.params.email.toLowerCase();
    const [stuRows] = await pool.query('SELECT id, full_name FROM students WHERE LOWER(student_email) = ?', [email]);
    if (!stuRows.length) return res.json({ error: 'Student not found' });
    const studentId = stuRows[0].id;
    const [records] = await pool.query(
      `SELECT ar.*, ases.date, ases.subject_id, sub.name as subject_name
       FROM attendance_record ar
       JOIN attendance_session ases ON ases.id = ar.attendance_session_id
       LEFT JOIN subjects sub ON sub.id = ases.subject_id
       WHERE ar.student_id = ? ORDER BY ases.date DESC`,
      [studentId]
    );
    const [sessions] = await pool.query(
      `SELECT ases.*, sub.name as subject_name
       FROM attendance_session ases
       LEFT JOIN subjects sub ON sub.id = ases.subject_id
       WHERE ases.subcategory_id = (SELECT subcategory_id FROM students WHERE id = ?)
       ORDER BY ases.date DESC`,
      [studentId]
    );
    res.json({ student: stuRows[0], records_count: records.length, sessions_count: sessions.length, records: records.slice(0, 20), sessions: sessions.slice(0, 20) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/debug/face/:student_id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, full_name, roll_number, subcategory_id, item_id, face_photo, LENGTH(face_descriptor) as descriptor_length FROM students WHERE id = ?',
      [req.params.student_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Student not found' });
    const s = rows[0];
    res.json({ id: s.id, name: s.full_name, roll_number: s.roll_number, subcategory_id: s.subcategory_id, item_id: s.item_id, has_face_photo: !!s.face_photo, descriptor_length: s.descriptor_length, descriptor_valid: s.descriptor_length > 100 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================== SEND EMAIL =====================
router.post('/send-email', authenticate, async (req, res) => {
  const { to, subject, html } = req.body;
  if (!to || !subject || !html) return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.status(400).json({ error: 'Invalid email address' });
  try {
    const info = await smtpTransporter.sendMail({
      from:    `"${process.env.INSTITUTION_NAME || 'ETAM'}" <${process.env.SMTP_USER}>`,
      to, subject, html,
    });
    console.log(`📧 Email sent to ${to} — MessageId: ${info.messageId}`);
    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('❌ Send email error:', error);
    return res.status(500).json({ error: error.message || 'Failed to send email' });
  }
});

// Save institution location
router.put('/institutions/my/location', authenticate, async (req, res) => {
  const { address, city, state, country, pincode, latitude, longitude } = req.body;
  try {
    await pool.query(
      `UPDATE institutions 
       SET address=?, city=?, state=?, country=?, pincode=?, latitude=?, longitude=?
       WHERE id=?`,
      [address, city, state, country, pincode, latitude, longitude, req.user.institution_id]
    );
    res.json({ success: true, message: 'Location saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================== NOTIFICATIONS =====================
router.post('/notifications',                   authenticate, notificationCtrl.createNotification);
router.get('/notifications/:userId',            authenticate, notificationCtrl.getNotifications);
router.patch('/notifications/:userId/read-all', authenticate, notificationCtrl.markAllAsRead);
router.patch('/notifications/:id/read',         authenticate, notificationCtrl.markAsRead);
router.delete('/notifications/:id',             authenticate, notificationCtrl.deleteNotification);

module.exports = router;