// src/services/pushService.js
// Uses Expo Push API — no Firebase account needed!

async function sendPushNotification(pushToken, title, body, data = {}) {
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) return;

  const message = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    data,
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    const result = await response.json();
    console.log('📱 Push sent:', result?.data?.status || result);
  } catch (err) {
    console.error('Push notification error:', err.message);
  }
}

// Notify student when marked absent
async function notifyAbsent(pool, studentId, subjectName) {
  try {
    const [rows] = await pool.query(
      `SELECT u.push_token, s.full_name 
       FROM students s
       LEFT JOIN users u ON LOWER(u.email) = LOWER(s.student_email)
       WHERE s.id = ?`,
      [studentId]
    );
    if (!rows.length || !rows[0].push_token) return;
    await sendPushNotification(
      rows[0].push_token,
      '⚠️ Attendance Alert',
      `You were marked absent in ${subjectName || 'a class'}`,
      { screen: 'myAttendance' }
    );
    console.log(`📱 Absent notification sent to: ${rows[0].full_name}`);
  } catch (err) {
    console.error('notifyAbsent error:', err.message);
  }
}

// Notify all students in a class when attendance session is opened
async function notifyClassStarted(pool, subcategoryId, subjectName) {
  try {
    const [students] = await pool.query(
      `SELECT u.push_token, s.full_name FROM students s
       LEFT JOIN users u ON LOWER(u.email) = LOWER(s.student_email)
       WHERE s.subcategory_id = ? AND u.push_token IS NOT NULL`,
      [subcategoryId]
    );
    console.log(`📱 Notifying ${students.length} students that attendance started`);
    for (const s of students) {
      await sendPushNotification(
        s.push_token,
        '📋 Attendance Started',
        `Mark your attendance for ${subjectName || 'current class'}`,
        { screen: 'myAttendance' }
      );
    }
  } catch (err) {
    console.error('notifyClassStarted error:', err.message);
  }
}

// Notify a teacher
async function notifyTeacher(pool, teacherId, title, body, data = {}) {
  try {
    const [rows] = await pool.query(
      'SELECT push_token FROM users WHERE id = ?',
      [teacherId]
    );
    if (!rows.length || !rows[0].push_token) return;
    await sendPushNotification(rows[0].push_token, title, body, data);
  } catch (err) {
    console.error('notifyTeacher error:', err.message);
  }
}

module.exports = { sendPushNotification, notifyAbsent, notifyClassStarted, notifyTeacher };