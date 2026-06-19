-- ============================================================
-- Hostel Management Tables
-- Run this against your etam_db database
-- ============================================================

USE etam_db;

-- Hostel Blocks (Boys/Girls/Mixed wings)
CREATE TABLE IF NOT EXISTS hostel_blocks (
  id CHAR(36) PRIMARY KEY,
  institution_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  gender ENUM('boys','girls','mixed') NOT NULL DEFAULT 'boys',
  warden_name VARCHAR(255),
  warden_contact VARCHAR(50),
  total_rooms INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
);

-- Hostel Rooms
CREATE TABLE IF NOT EXISTS hostel_rooms (
  id CHAR(36) PRIMARY KEY,
  institution_id CHAR(36) NOT NULL,
  block_id CHAR(36) NOT NULL,
  room_number VARCHAR(50) NOT NULL,
  floor INT DEFAULT 1,
  room_type ENUM('single','double','triple','dormitory') NOT NULL DEFAULT 'double',
  capacity INT NOT NULL DEFAULT 2,
  occupied INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_block_room (block_id, room_number),
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
  FOREIGN KEY (block_id) REFERENCES hostel_blocks(id) ON DELETE CASCADE
);

-- Hostel Allocations (student → room)
CREATE TABLE IF NOT EXISTS hostel_allocations (
  id CHAR(36) PRIMARY KEY,
  institution_id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  room_id CHAR(36) NOT NULL,
  allocated_date DATE NOT NULL,
  vacated_date DATE,
  status ENUM('active','vacated','transferred') NOT NULL DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES hostel_rooms(id) ON DELETE CASCADE
);

-- Hostel Leave / Outpass Requests
CREATE TABLE IF NOT EXISTS hostel_leave_requests (
  id CHAR(36) PRIMARY KEY,
  institution_id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  leave_from DATE NOT NULL,
  leave_to DATE NOT NULL,
  reason TEXT,
  status ENUM('pending','approved','rejected','returned') NOT NULL DEFAULT 'pending',
  parent_notified BOOLEAN DEFAULT FALSE,
  applied_at DATE DEFAULT (CURDATE()),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Hostel Complaints & Maintenance
CREATE TABLE IF NOT EXISTS hostel_complaints (
  id CHAR(36) PRIMARY KEY,
  institution_id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  complaint_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('open','in_progress','resolved') NOT NULL DEFAULT 'open',
  raised_at DATE DEFAULT (CURDATE()),
  resolved_at DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Hostel Attendance (morning + night roll call)
CREATE TABLE IF NOT EXISTS hostel_attendance (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  institution_id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  date DATE NOT NULL,
  morning_status ENUM('present','absent','on_leave') NOT NULL DEFAULT 'absent',
  night_status ENUM('present','absent','on_leave') NOT NULL DEFAULT 'absent',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_hostel_attendance (student_id, date),
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Add room_id column to students if not already there
ALTER TABLE students ADD COLUMN IF NOT EXISTS room_id CHAR(36) DEFAULT NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_hostel_blocks_inst ON hostel_blocks(institution_id);
CREATE INDEX IF NOT EXISTS idx_hostel_rooms_block ON hostel_rooms(block_id);
CREATE INDEX IF NOT EXISTS idx_hostel_alloc_student ON hostel_allocations(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_alloc_room ON hostel_allocations(room_id);
CREATE INDEX IF NOT EXISTS idx_hostel_leaves_student ON hostel_leave_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_complaints_student ON hostel_complaints(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_attendance_date ON hostel_attendance(date);
