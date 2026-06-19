const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');

// Auto-create hostel tables if they don't exist
async function ensureHostelTables() {
  await pool.query(`CREATE TABLE IF NOT EXISTS hostel_blocks (
    id CHAR(36) PRIMARY KEY, institution_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL, gender ENUM('boys','girls','mixed') NOT NULL DEFAULT 'boys',
    warden_name VARCHAR(255), warden_contact VARCHAR(50), total_rooms INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS hostel_rooms (
    id CHAR(36) PRIMARY KEY, institution_id CHAR(36) NOT NULL, block_id CHAR(36) NOT NULL,
    room_number VARCHAR(50) NOT NULL, floor INT DEFAULT 1,
    room_type ENUM('single','double','triple','dormitory') NOT NULL DEFAULT 'double',
    capacity INT NOT NULL DEFAULT 2, occupied INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_block_room (block_id, room_number)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS hostel_allocations (
    id CHAR(36) PRIMARY KEY, institution_id CHAR(36) NOT NULL,
    student_id CHAR(36) NOT NULL, room_id CHAR(36) NOT NULL,
    allocated_date DATE NOT NULL, vacated_date DATE,
    status ENUM('active','vacated','transferred') NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS hostel_leave_requests (
    id CHAR(36) PRIMARY KEY, institution_id CHAR(36) NOT NULL, student_id CHAR(36) NOT NULL,
    leave_from DATE NOT NULL, leave_to DATE NOT NULL, reason TEXT,
    status ENUM('pending','approved','rejected','returned') NOT NULL DEFAULT 'pending',
    parent_notified BOOLEAN DEFAULT FALSE, applied_at DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS hostel_complaints (
    id CHAR(36) PRIMARY KEY, institution_id CHAR(36) NOT NULL, student_id CHAR(36) NOT NULL,
    complaint_type VARCHAR(100) NOT NULL, description TEXT NOT NULL,
    status ENUM('open','in_progress','resolved') NOT NULL DEFAULT 'open',
    raised_at DATE, resolved_at DATE, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS hostel_attendance (
    id CHAR(36) PRIMARY KEY, institution_id CHAR(36) NOT NULL, student_id CHAR(36) NOT NULL,
    date DATE NOT NULL,
    morning_status ENUM('present','absent','on_leave') NOT NULL DEFAULT 'absent',
    night_status ENUM('present','absent','on_leave') NOT NULL DEFAULT 'absent',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_hostel_att (student_id, date)
  )`);
  // Add room_id to students if missing
  try {
    await pool.query(`ALTER TABLE students ADD COLUMN room_id CHAR(36) DEFAULT NULL`);
  } catch (e) { /* column already exists — ignore */ }
}

// Run once on startup
ensureHostelTables().catch(err => console.error('Hostel table init error:', err.message));

// ==================== BLOCKS ====================
const getBlocks = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM hostel_blocks WHERE institution_id = ? ORDER BY name',
      [req.user.institution_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('getBlocks error:', err);
    res.status(500).json({ error: 'Failed to fetch blocks', detail: err.message });
  }
};

const createBlock = async (req, res) => {
  const { name, gender, warden_name, warden_contact, total_rooms } = req.body;
  if (!name || !gender) return res.status(400).json({ error: 'name and gender are required' });
  try {
    const id = uuidv4();
    await pool.query(
      `INSERT INTO hostel_blocks (id, institution_id, name, gender, warden_name, warden_contact, total_rooms) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.institution_id, name, gender, warden_name || null, warden_contact || null, total_rooms || 0]
    );
    const [rows] = await pool.query('SELECT * FROM hostel_blocks WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createBlock error:', err);
    res.status(500).json({ error: 'Failed to create block', detail: err.message });
  }
};

const updateBlock = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  try {
    const allowedFields = ['name', 'gender', 'warden_name', 'warden_contact', 'total_rooms'];
    const updateParts = [];
    const values = [];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateParts.push(`${field} = ?`);
        values.push(updates[field]);
      }
    }
    if (updateParts.length === 0) return res.json({ message: 'No fields to update' });
    values.push(id, req.user.institution_id);
    await pool.query(`UPDATE hostel_blocks SET ${updateParts.join(', ')} WHERE id = ? AND institution_id = ?`, values);
    const [rows] = await pool.query('SELECT * FROM hostel_blocks WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Block not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updateBlock error:', err);
    res.status(500).json({ error: 'Failed to update block', detail: err.message });
  }
};

const deleteBlock = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM hostel_blocks WHERE id = ? AND institution_id = ?', [id, req.user.institution_id]);
    res.json({ message: 'Block deleted successfully' });
  } catch (err) {
    console.error('deleteBlock error:', err);
    res.status(500).json({ error: 'Failed to delete block', detail: err.message });
  }
};

// ==================== ROOMS ====================
const getRooms = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, b.name as block_name 
       FROM hostel_rooms r
       JOIN hostel_blocks b ON r.block_id = b.id
       WHERE r.institution_id = ?
       ORDER BY b.name, r.room_number`,
      [req.user.institution_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('getRooms error:', err);
    res.status(500).json({ error: 'Failed to fetch rooms', detail: err.message });
  }
};

const createRoom = async (req, res) => {
  const { block_id, room_number, floor, room_type, capacity } = req.body;
  if (!block_id || !room_number || !room_type || !capacity) {
    return res.status(400).json({ error: 'block_id, room_number, room_type, capacity are required' });
  }
  try {
    const id = uuidv4();
    await pool.query(
      `INSERT INTO hostel_rooms (id, institution_id, block_id, room_number, floor, room_type, capacity, occupied) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, req.user.institution_id, block_id, room_number, floor || 1, room_type, capacity]
    );
    const [rows] = await pool.query(
      `SELECT r.*, b.name as block_name FROM hostel_rooms r JOIN hostel_blocks b ON r.block_id = b.id WHERE r.id = ?`,
      [id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createRoom error:', err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Room number already exists in this block' });
    res.status(500).json({ error: 'Failed to create room', detail: err.message });
  }
};

const updateRoom = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  try {
    const allowedFields = ['block_id', 'room_number', 'floor', 'room_type', 'capacity'];
    const updateParts = [];
    const values = [];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateParts.push(`${field} = ?`);
        values.push(updates[field]);
      }
    }
    if (updateParts.length === 0) return res.json({ message: 'No fields to update' });
    values.push(id, req.user.institution_id);
    await pool.query(`UPDATE hostel_rooms SET ${updateParts.join(', ')} WHERE id = ? AND institution_id = ?`, values);
    const [rows] = await pool.query(
      `SELECT r.*, b.name as block_name FROM hostel_rooms r JOIN hostel_blocks b ON r.block_id = b.id WHERE r.id = ?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Room not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updateRoom error:', err);
    res.status(500).json({ error: 'Failed to update room', detail: err.message });
  }
};

const deleteRoom = async (req, res) => {
  const { id } = req.params;
  try {
    const [alloc] = await pool.query('SELECT id FROM hostel_allocations WHERE room_id = ? AND status = "active" LIMIT 1', [id]);
    if (alloc.length > 0) return res.status(400).json({ error: 'Cannot delete room with active allocations' });
    await pool.query('DELETE FROM hostel_rooms WHERE id = ? AND institution_id = ?', [id, req.user.institution_id]);
    res.json({ message: 'Room deleted successfully' });
  } catch (err) {
    console.error('deleteRoom error:', err);
    res.status(500).json({ error: 'Failed to delete room', detail: err.message });
  }
};

// ==================== ALLOCATIONS ====================
const getAllocations = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, 
              s.full_name as student_name, s.register_number, s.photo_url as student_photo,
              r.room_number, b.name as block_name
       FROM hostel_allocations a
       JOIN students s ON a.student_id = s.id
       JOIN hostel_rooms r ON a.room_id = r.id
       JOIN hostel_blocks b ON r.block_id = b.id
       WHERE a.institution_id = ?
       ORDER BY a.allocated_date DESC`,
      [req.user.institution_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('getAllocations error:', err);
    res.status(500).json({ error: 'Failed to fetch allocations', detail: err.message });
  }
};

const createAllocation = async (req, res) => {
  const { student_id, room_id, allocated_date } = req.body;
  if (!student_id || !room_id) return res.status(400).json({ error: 'student_id and room_id are required' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [room] = await connection.query('SELECT capacity, occupied FROM hostel_rooms WHERE id = ? AND institution_id = ?', [room_id, req.user.institution_id]);
    if (!room.length) { await connection.rollback(); return res.status(404).json({ error: 'Room not found' }); }
    if (room[0].occupied >= room[0].capacity) { await connection.rollback(); return res.status(400).json({ error: 'Room is full' }); }
    const [existing] = await connection.query('SELECT id FROM hostel_allocations WHERE student_id = ? AND status = "active" LIMIT 1', [student_id]);
    if (existing.length) { await connection.rollback(); return res.status(400).json({ error: 'Student already has an active room allocation' }); }
    const id = uuidv4();
    const allocDate = allocated_date || new Date().toISOString().split('T')[0];
    await connection.query(`INSERT INTO hostel_allocations (id, institution_id, student_id, room_id, allocated_date, status) VALUES (?, ?, ?, ?, ?, 'active')`, [id, req.user.institution_id, student_id, room_id, allocDate]);
    await connection.query('UPDATE hostel_rooms SET occupied = occupied + 1 WHERE id = ?', [room_id]);
    await connection.query('UPDATE students SET room_id = ? WHERE id = ?', [room_id, student_id]);
    await connection.commit();
    const [rows] = await connection.query(`SELECT a.*, s.full_name as student_name, s.register_number, r.room_number, b.name as block_name FROM hostel_allocations a JOIN students s ON a.student_id = s.id JOIN hostel_rooms r ON a.room_id = r.id JOIN hostel_blocks b ON r.block_id = b.id WHERE a.id = ?`, [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    await connection.rollback();
    console.error('createAllocation error:', err);
    res.status(500).json({ error: 'Failed to create allocation', detail: err.message });
  } finally {
    connection.release();
  }
};

const updateAllocation = async (req, res) => {
  const { id } = req.params;
  const { status, vacated_date } = req.body;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [alloc] = await connection.query('SELECT room_id, student_id, status FROM hostel_allocations WHERE id = ? AND institution_id = ?', [id, req.user.institution_id]);
    if (!alloc.length) { await connection.rollback(); return res.status(404).json({ error: 'Allocation not found' }); }
    const oldStatus = alloc[0].status;
    const newStatus = status || oldStatus;
    const vacated = (newStatus === 'vacated' && oldStatus !== 'vacated') ? (vacated_date || new Date().toISOString().split('T')[0]) : null;
    await connection.query('UPDATE hostel_allocations SET status = ?, vacated_date = COALESCE(?, vacated_date) WHERE id = ?', [newStatus, vacated, id]);
    if (oldStatus === 'active' && newStatus !== 'active') {
      await connection.query('UPDATE hostel_rooms SET occupied = occupied - 1 WHERE id = ?', [alloc[0].room_id]);
      await connection.query('UPDATE students SET room_id = NULL WHERE id = ?', [alloc[0].student_id]);
    } else if (oldStatus !== 'active' && newStatus === 'active') {
      await connection.query('UPDATE hostel_rooms SET occupied = occupied + 1 WHERE id = ?', [alloc[0].room_id]);
      await connection.query('UPDATE students SET room_id = ? WHERE id = ?', [alloc[0].room_id, alloc[0].student_id]);
    }
    await connection.commit();
    res.json({ message: 'Allocation updated successfully' });
  } catch (err) {
    await connection.rollback();
    console.error('updateAllocation error:', err);
    res.status(500).json({ error: 'Failed to update allocation', detail: err.message });
  } finally {
    connection.release();
  }
};

// ==================== LEAVE REQUESTS ====================
const getLeaves = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT l.*, s.full_name as student_name, s.register_number
       FROM hostel_leave_requests l
       JOIN students s ON l.student_id = s.id
       WHERE l.institution_id = ?
       ORDER BY l.applied_at DESC`,
      [req.user.institution_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('getLeaves error:', err);
    res.status(500).json({ error: 'Failed to fetch leave requests', detail: err.message });
  }
};

const createLeave = async (req, res) => {
  const { student_id, leave_from, leave_to, reason } = req.body;
  if (!student_id || !leave_from || !leave_to) return res.status(400).json({ error: 'student_id, leave_from, leave_to are required' });
  try {
    const id = uuidv4();
    await pool.query(`INSERT INTO hostel_leave_requests (id, institution_id, student_id, leave_from, leave_to, reason, status, applied_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', CURDATE())`, [id, req.user.institution_id, student_id, leave_from, leave_to, reason || null]);
    const [rows] = await pool.query(`SELECT l.*, s.full_name as student_name, s.register_number FROM hostel_leave_requests l JOIN students s ON l.student_id = s.id WHERE l.id = ?`, [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createLeave error:', err);
    res.status(500).json({ error: 'Failed to create leave request', detail: err.message });
  }
};

const updateLeave = async (req, res) => {
  const { id } = req.params;
  const { status, parent_notified } = req.body;
  try {
    const updates = [];
    const values = [];
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (parent_notified !== undefined) { updates.push('parent_notified = ?'); values.push(parent_notified); }
    if (updates.length === 0) return res.json({ message: 'No fields to update' });
    values.push(id, req.user.institution_id);
    await pool.query(`UPDATE hostel_leave_requests SET ${updates.join(', ')} WHERE id = ? AND institution_id = ?`, values);
    res.json({ message: 'Leave request updated successfully' });
  } catch (err) {
    console.error('updateLeave error:', err);
    res.status(500).json({ error: 'Failed to update leave request', detail: err.message });
  }
};

// ==================== COMPLAINTS ====================
const getComplaints = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, s.full_name as student_name, r.room_number
       FROM hostel_complaints c
       JOIN students s ON c.student_id = s.id
       LEFT JOIN hostel_rooms r ON s.room_id = r.id
       WHERE c.institution_id = ?
       ORDER BY c.raised_at DESC`,
      [req.user.institution_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('getComplaints error:', err);
    res.status(500).json({ error: 'Failed to fetch complaints', detail: err.message });
  }
};

const createComplaint = async (req, res) => {
  const { student_id, complaint_type, description } = req.body;
  if (!student_id || !complaint_type || !description) return res.status(400).json({ error: 'student_id, complaint_type, description are required' });
  try {
    const id = uuidv4();
    await pool.query(`INSERT INTO hostel_complaints (id, institution_id, student_id, complaint_type, description, status, raised_at) VALUES (?, ?, ?, ?, ?, 'open', CURDATE())`, [id, req.user.institution_id, student_id, complaint_type, description]);
    const [rows] = await pool.query(`SELECT c.*, s.full_name as student_name, r.room_number FROM hostel_complaints c JOIN students s ON c.student_id = s.id LEFT JOIN hostel_rooms r ON s.room_id = r.id WHERE c.id = ?`, [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createComplaint error:', err);
    res.status(500).json({ error: 'Failed to create complaint', detail: err.message });
  }
};

const updateComplaint = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    let resolvedAt = null;
    if (status === 'resolved') resolvedAt = new Date().toISOString().split('T')[0];
    await pool.query(`UPDATE hostel_complaints SET status = ?, resolved_at = COALESCE(?, resolved_at) WHERE id = ? AND institution_id = ?`, [status, resolvedAt, id, req.user.institution_id]);
    res.json({ message: 'Complaint updated successfully' });
  } catch (err) {
    console.error('updateComplaint error:', err);
    res.status(500).json({ error: 'Failed to update complaint', detail: err.message });
  }
};

// ==================== ATTENDANCE ====================
const getAttendance = async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];
  const institutionId = req.user.institution_id;

  try {
    // Auto-generate attendance rows for all hostel students if none exist for this date
    const [existing] = await pool.query(
      'SELECT id FROM hostel_attendance WHERE institution_id = ? AND date = ? LIMIT 1',
      [institutionId, targetDate]
    );

    if (existing.length === 0) {
      // Fetch all hostel students
      const [hostelStudents] = await pool.query(
        `SELECT id FROM students WHERE institution_id = ? AND residence_type = 'hostel' AND status = 'active'`,
        [institutionId]
      );
      if (hostelStudents.length > 0) {
        const values = hostelStudents.map(s =>
          `(UUID(), '${institutionId}', '${s.id}', '${targetDate}', 'absent', 'absent')`
        ).join(',');
        await pool.query(
          `INSERT IGNORE INTO hostel_attendance (id, institution_id, student_id, date, morning_status, night_status) VALUES ${values}`
        );
      }
    }

    // Now fetch attendance with student + room info
    const [rows] = await pool.query(
      `SELECT a.*, s.full_name as student_name,
              COALESCE(r2.room_number, r.room_number) as room_number
       FROM hostel_attendance a
       JOIN students s ON a.student_id = s.id
       LEFT JOIN hostel_allocations ha ON ha.student_id = s.id AND ha.status = 'active'
       LEFT JOIN hostel_rooms r ON ha.room_id = r.id
       LEFT JOIN hostel_rooms r2 ON s.room_id = r2.id
       WHERE a.institution_id = ? AND a.date = ?
       ORDER BY s.full_name`,
      [institutionId, targetDate]
    );
    res.json(rows);
  } catch (err) {
    console.error('getAttendance error:', err);
    res.status(500).json({ error: 'Failed to fetch attendance', detail: err.message });
  }
};

const updateAttendance = async (req, res) => {
  const { id } = req.params;
  const { morning_status, night_status } = req.body;
  try {
    const parts = [];
    const values = [];
    if (morning_status !== undefined) { parts.push('morning_status = ?'); values.push(morning_status); }
    if (night_status !== undefined)   { parts.push('night_status = ?');   values.push(night_status); }
    if (parts.length === 0) return res.json({ message: 'Nothing to update' });
    values.push(id, req.user.institution_id);
    await pool.query(`UPDATE hostel_attendance SET ${parts.join(', ')} WHERE id = ? AND institution_id = ?`, values);
    res.json({ message: 'Attendance updated successfully' });
  } catch (err) {
    console.error('updateAttendance error:', err);
    res.status(500).json({ error: 'Failed to update attendance', detail: err.message });
  }
};

const markAttendanceBatch = async (req, res) => {
  const { date, records } = req.body;
  if (!date || !records || !Array.isArray(records)) return res.status(400).json({ error: 'date and records array are required' });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const rec of records) {
      await connection.query(`INSERT INTO hostel_attendance (id, institution_id, student_id, date, morning_status, night_status) VALUES (UUID(), ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE morning_status = VALUES(morning_status), night_status = VALUES(night_status)`, [req.user.institution_id, rec.student_id, date, rec.morning_status || 'absent', rec.night_status || 'absent']);
    }
    await connection.commit();
    res.json({ message: `Attendance marked for ${records.length} students on ${date}` });
  } catch (err) {
    await connection.rollback();
    console.error('markAttendanceBatch error:', err);
    res.status(500).json({ error: 'Failed to mark attendance', detail: err.message });
  } finally {
    connection.release();
  }
};

// ==================== HOSTEL STUDENTS ONLY ====================
// Returns students whose residence_type = 'hostel' in the students table
const getHostelStudents = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id, s.full_name, s.register_number, s.roll_number,
              r.room_number, b.name as block_name
       FROM students s
       LEFT JOIN hostel_allocations a ON a.student_id = s.id AND a.status = 'active'
       LEFT JOIN hostel_rooms r ON a.room_id = r.id
       LEFT JOIN hostel_blocks b ON r.block_id = b.id
       WHERE s.institution_id = ? AND s.residence_type = 'hostel'
       ORDER BY s.full_name`,
      [req.user.institution_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('getHostelStudents error:', err);
    res.status(500).json({ error: 'Failed to fetch hostel students', detail: err.message });
  }
};

module.exports = {
  getBlocks, createBlock, updateBlock, deleteBlock,
  getRooms, createRoom, updateRoom, deleteRoom,
  getAllocations, createAllocation, updateAllocation,
  getLeaves, createLeave, updateLeave,
  getComplaints, createComplaint, updateComplaint,
  getAttendance, updateAttendance, markAttendanceBatch,
  getHostelStudents,
};