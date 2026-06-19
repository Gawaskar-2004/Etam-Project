/**
 * notificationService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Save this file to:  backend/src/services/notificationService.js
 *
 * AUTO-NOTIFICATION TRIGGERS
 * ──────────────────────────
 * FOR TEACHERS:
 *   1. Timetable updated        → notify all affected teachers
 *   2. New student added        → notify the class teacher
 *   3. Attendance session created → notify teacher (confirmation)
 *
 * FOR ADMINS:
 *   4. Teacher marks attendance → notify all admins
 *   5. New staff added          → notify all admins
 *
 * HOW IT WORKS
 * ────────────
 * Each function:
 *   • Queries the DB for the right receiver(s)
 *   • Inserts a row into `notifications` table
 *   • Emits Socket.IO event → bell updates + toast appears instantly
 *   • If receiver is offline → notification waits in DB, shown on next login
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { v4: uuidv4 } = require('uuid');

// ── Table guard ───────────────────────────────────────────────────────────────
async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id           VARCHAR(36)  PRIMARY KEY,
      sender_id    VARCHAR(36)  NOT NULL,
      receiver_id  VARCHAR(36)  NOT NULL,
      title        VARCHAR(255) NOT NULL,
      message      TEXT         NOT NULL,
      type         VARCHAR(50)  DEFAULT 'SYSTEM',
      is_read      BOOLEAN      DEFAULT FALSE,
      created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_receiver (receiver_id),
      INDEX idx_created  (created_at)
    )
  `);
}

// ── Core send (single receiver) ───────────────────────────────────────────────
async function send(pool, io, { senderId, receiverId, title, message, type = 'SYSTEM' }) {
  if (!receiverId) return null;
  await ensureTable(pool);

  const id = uuidv4();
  await pool.query(
    `INSERT INTO notifications
       (id, sender_id, receiver_id, title, message, type, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, FALSE, NOW())`,
    [id, senderId || 'SYSTEM', receiverId, title, message, type]
  );

  const notification = {
    id,
    senderId:  senderId || 'SYSTEM',
    receiverId,
    title,
    message,
    type,
    isRead:    false,
    createdAt: new Date().toISOString(),
  };

  if (io) {
    io.to(`user_${receiverId}`).emit('notification', notification);
    console.log(`🔔 [AutoNotif] → user_${receiverId} | [${type}] ${title}`);
  }

  return notification;
}

// ── Send to multiple receivers ────────────────────────────────────────────────
async function sendToMany(pool, io, receivers, payload) {
  for (const receiverId of receivers) {
    await send(pool, io, { ...payload, receiverId }).catch(console.error);
  }
}

// ── Get all admin user IDs for an institution ─────────────────────────────────
async function getAdminIds(pool, institutionId) {
  const [rows] = await pool.query(
    `SELECT id FROM users
     WHERE role = 'admin' AND institution_id = ? AND is_active = 1`,
    [institutionId]
  );
  return rows.map(r => r.id);
}

// =============================================================================
// TRIGGER 1 — TIMETABLE UPDATED → notify affected teachers
// =============================================================================
/**
 * Call after any timetable create / update / delete.
 *
 * @param {object} pool
 * @param {object} io
 * @param {object} opts
 * @param {string} opts.institutionId
 * @param {string} opts.adminId          - who made the change
 * @param {string} opts.adminName
 * @param {string} [opts.subcategoryId]  - if set, only notify teachers of that class
 * @param {string} [opts.changeDetail]   - e.g. "Mathematics moved to Period 3 on Monday"
 */
async function onTimetableUpdated(pool, io, {
  institutionId,
  adminId,
  adminName,
  subcategoryId,
  changeDetail,
}) {
  try {
    let teacherIds = [];

    if (subcategoryId) {
      // Only teachers assigned to this specific class
      const [rows] = await pool.query(
        `SELECT DISTINCT u.id
         FROM timetable_assignments ta
         JOIN staff st ON st.id = ta.staff_id
         JOIN users u  ON LOWER(u.email) = LOWER(st.email)
         WHERE ta.subcategory_id = ?
         UNION
         SELECT DISTINCT u.id
         FROM class_teachers ct
         JOIN staff st ON st.id = ct.staff_id
         JOIN users u  ON LOWER(u.email) = LOWER(st.email)
         WHERE ct.subcategory_id = ?`,
        [subcategoryId, subcategoryId]
      );
      teacherIds = rows.map(r => r.id);
    } else {
      // All active teachers in the institution
      const [rows] = await pool.query(
        `SELECT id FROM users
         WHERE role = 'teacher' AND institution_id = ? AND is_active = 1`,
        [institutionId]
      );
      teacherIds = rows.map(r => r.id);
    }

    if (!teacherIds.length) return;

    const message = changeDetail
      ? `${changeDetail} — please check your updated schedule on the portal.`
      : `The class timetable has been updated by ${adminName || 'Admin'}. Please check your new schedule.`;

    await sendToMany(pool, io, teacherIds, {
      senderId: adminId || 'SYSTEM',
      title:    '📅 Timetable Updated',
      message,
      type:     'TIMETABLE',
    });

    console.log(`[AutoNotif] Timetable update sent to ${teacherIds.length} teacher(s)`);
  } catch (err) {
    console.error('[AutoNotif] onTimetableUpdated error:', err.message);
  }
}

// =============================================================================
// TRIGGER 2 — NEW STUDENT ADDED → notify class teacher
// =============================================================================
/**
 * Call after a student is successfully created.
 *
 * @param {object} pool
 * @param {object} io
 * @param {object} opts
 * @param {string} opts.studentName
 * @param {string} opts.subcategoryId    - the class the student was added to
 * @param {string} opts.adminId
 * @param {string} opts.adminName
 */
async function onStudentAdded(pool, io, {
  studentName,
  subcategoryId,
  adminId,
  adminName,
}) {
  try {
    if (!subcategoryId) return;

    // Find the class teacher for this class
    const [rows] = await pool.query(
      `SELECT u.id AS teacher_user_id
       FROM class_teachers ct
       JOIN staff st ON st.id = ct.staff_id
       JOIN users u  ON LOWER(u.email) = LOWER(st.email)
       WHERE ct.subcategory_id = ?
       LIMIT 1`,
      [subcategoryId]
    );

    if (!rows.length) {
      console.log(`[AutoNotif] onStudentAdded: no class teacher found for subcategory ${subcategoryId}`);
      return;
    }

    await send(pool, io, {
      senderId:   adminId || 'SYSTEM',
      receiverId: rows[0].teacher_user_id,
      title:      '👤 New Student Added',
      message:    `${studentName} has been added to your class by ${adminName || 'Admin'}. Please update your records accordingly.`,
      type:       'SYSTEM',
    });
  } catch (err) {
    console.error('[AutoNotif] onStudentAdded error:', err.message);
  }
}

// =============================================================================
// TRIGGER 3 — ATTENDANCE SESSION CREATED → notify teacher (confirmation)
// =============================================================================
/**
 * Call after a new attendance session is created.
 * Sends a confirmation to the teacher who started it.
 *
 * @param {object} pool
 * @param {object} io
 * @param {object} opts
 * @param {string} opts.teacherId        - user ID of the teacher
 * @param {string} opts.subjectName
 * @param {string} opts.subcategoryName  - class name (optional)
 * @param {string} [opts.sessionId]
 */
async function onAttendanceSessionCreated(pool, io, {
  teacherId,
  subjectName,
  subcategoryName,
  sessionId,
}) {
  try {
    if (!teacherId) return;

    const classLabel = subcategoryName ? ` for ${subcategoryName}` : '';

    await send(pool, io, {
      senderId:   'SYSTEM',
      receiverId: teacherId,
      title:      `✅ Session Started: ${subjectName || 'Class'}`,
      message:    `Attendance session${classLabel} has been started for ${subjectName || 'your class'}. You can now mark student attendance.`,
      type:       'ATTENDANCE',
    });
  } catch (err) {
    console.error('[AutoNotif] onAttendanceSessionCreated error:', err.message);
  }
}

// =============================================================================
// TRIGGER 4 — TEACHER MARKS ATTENDANCE → notify admins
// =============================================================================
/**
 * Call after attendance records are saved successfully.
 * Notifies all admins with a summary.
 *
 * @param {object} pool
 * @param {object} io
 * @param {object} opts
 * @param {string} opts.teacherId
 * @param {string} opts.teacherName
 * @param {string} opts.subjectName
 * @param {string} opts.subcategoryName   - class name
 * @param {number} opts.totalStudents
 * @param {number} opts.presentCount
 * @param {number} opts.absentCount
 * @param {string} opts.institutionId
 */
async function onAttendanceMarked(pool, io, {
  teacherId,
  teacherName,
  subjectName,
  subcategoryName,
  totalStudents,
  presentCount,
  absentCount,
  institutionId,
}) {
  try {
    if (!institutionId) return;

    const adminIds = await getAdminIds(pool, institutionId);
    if (!adminIds.length) return;

    const classLabel = subcategoryName ? ` (${subcategoryName})` : '';
    const pct = totalStudents > 0
      ? Math.round((presentCount / totalStudents) * 100)
      : 0;

    await sendToMany(pool, io, adminIds, {
      senderId: teacherId || 'SYSTEM',
      title:    `📋 Attendance Marked — ${subjectName || 'Class'}`,
      message:  `${teacherName || 'A teacher'} marked attendance for ${subjectName || 'a class'}${classLabel}. ${presentCount}/${totalStudents} present (${pct}%), ${absentCount} absent.`,
      type:     'ATTENDANCE',
    });

    console.log(`[AutoNotif] Attendance summary sent to ${adminIds.length} admin(s)`);
  } catch (err) {
    console.error('[AutoNotif] onAttendanceMarked error:', err.message);
  }
}

// =============================================================================
// TRIGGER 5 — NEW STAFF ADDED → notify admins
// =============================================================================
/**
 * Call after a staff member is successfully created.
 *
 * @param {object} pool
 * @param {object} io
 * @param {object} opts
 * @param {string} opts.staffName
 * @param {string} opts.staffEmail
 * @param {string} opts.staffRole        - e.g. "Mathematics Teacher"
 * @param {string} opts.adminId          - who added the staff
 * @param {string} opts.adminName
 * @param {string} opts.institutionId
 */
async function onStaffAdded(pool, io, {
  staffName,
  staffEmail,
  staffRole,
  adminId,
  adminName,
  institutionId,
}) {
  try {
    if (!institutionId) return;

    const adminIds = await getAdminIds(pool, institutionId);
    // Remove the admin who performed the action (no need to notify yourself)
    const receivers = adminIds.filter(id => id !== adminId);
    if (!receivers.length) return;

    await sendToMany(pool, io, receivers, {
      senderId: adminId || 'SYSTEM',
      title:    '👩‍🏫 New Staff Added',
      message:  `${adminName || 'Admin'} added a new staff member: ${staffName}${staffRole ? ` (${staffRole})` : ''}. Email: ${staffEmail || 'N/A'}.`,
      type:     'SYSTEM',
    });

    console.log(`[AutoNotif] New staff notification sent to ${receivers.length} admin(s)`);
  } catch (err) {
    console.error('[AutoNotif] onStaffAdded error:', err.message);
  }
}

// =============================================================================
// TRIGGER 6 — LEAVE REQUEST CREATED → notify admins
// =============================================================================
/**
 * Call after a leave request is submitted.
 *
 * @param {object} pool
 * @param {object} io
 * @param {object} opts
 * @param {string} opts.requesterName
 * @param {string} opts.requesterId
 * @param {string} opts.leaveType
 * @param {string} opts.fromDate
 * @param {string} opts.toDate
 * @param {string} opts.institutionId
 */
async function onLeaveRequested(pool, io, {
  requesterName,
  requesterId,
  leaveType,
  fromDate,
  toDate,
  institutionId,
}) {
  try {
    if (!institutionId) return;

    const adminIds = await getAdminIds(pool, institutionId);
    if (!adminIds.length) return;

    await sendToMany(pool, io, adminIds, {
      senderId: requesterId || 'SYSTEM',
      title:    '📝 New Leave Request',
      message:  `${requesterName || 'A user'} has submitted a ${leaveType || 'leave'} request from ${fromDate} to ${toDate}. Please review and approve/reject.`,
      type:     'LEAVE',
    });

    console.log(`[AutoNotif] Leave request sent to ${adminIds.length} admin(s)`);
  } catch (err) {
    console.error('[AutoNotif] onLeaveRequested error:', err.message);
  }
}

// =============================================================================
// TRIGGER 7 — LEAVE REQUEST APPROVED/REJECTED → notify requester
// =============================================================================
/**
 * Call after admin approves or rejects a leave request.
 *
 * @param {object} pool
 * @param {object} io
 * @param {object} opts
 * @param {string} opts.requesterId      - user ID to notify
 * @param {string} opts.adminId
 * @param {string} opts.adminName
 * @param {string} opts.status           - 'approved' | 'rejected'
 * @param {string} opts.leaveType
 * @param {string} opts.fromDate
 * @param {string} opts.toDate
 * @param {string} [opts.reason]         - rejection reason (optional)
 */
async function onLeaveStatusChanged(pool, io, {
  requesterId,
  adminId,
  adminName,
  status,
  leaveType,
  fromDate,
  toDate,
  reason,
}) {
  try {
    if (!requesterId) return;

    const isApproved = status === 'approved';
    const emoji      = isApproved ? '✅' : '❌';
    const label      = isApproved ? 'Approved' : 'Rejected';
    let message      = `Your ${leaveType || 'leave'} request (${fromDate} to ${toDate}) has been ${label.toLowerCase()} by ${adminName || 'Admin'}.`;
    if (!isApproved && reason) message += ` Reason: ${reason}`;

    await send(pool, io, {
      senderId:   adminId || 'SYSTEM',
      receiverId: requesterId,
      title:      `${emoji} Leave Request ${label}`,
      message,
      type:       'LEAVE',
    });
  } catch (err) {
    console.error('[AutoNotif] onLeaveStatusChanged error:', err.message);
  }
}

// =============================================================================
module.exports = {
  onTimetableUpdated,
  onStudentAdded,
  onAttendanceSessionCreated,
  onAttendanceMarked,
  onStaffAdded,
  onLeaveRequested,
  onLeaveStatusChanged,
  // exposed for tests
  _send: send,
};