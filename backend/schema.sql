-- ETAM Database Schema

CREATE TABLE IF NOT EXISTS institutions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50),
  admin_email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  alternate_email VARCHAR(255),
  alternate_phone VARCHAR(20),
  is_setup_complete TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role ENUM('admin', 'staff', 'teacher', 'student') NOT NULL,
  institution_id CHAR(36),
  is_active TINYINT(1) DEFAULT 1,
  must_change_password TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS staff (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  institution_id CHAR(36) NOT NULL,
  user_id CHAR(36),
  employee_id VARCHAR(50),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  department VARCHAR(100),
  designation VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_staff_email (institution_id, email)
);

CREATE TABLE IF NOT EXISTS academic_category (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  institution_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  is_locked TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS academic_subcategory (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  category_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES academic_category(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS academic_item (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  subcategory_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  capacity INT,
  status VARCHAR(20) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subcategory_id) REFERENCES academic_subcategory(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subjects (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  institution_id CHAR(36) NOT NULL,
  category_id CHAR(36),
  subcategory_id CHAR(36),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES academic_category(id) ON DELETE SET NULL,
  FOREIGN KEY (subcategory_id) REFERENCES academic_subcategory(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS period_master (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  institution_id CHAR(36) NOT NULL,
  period_number INT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_break TINYINT(1) DEFAULT 0,
  break_duration INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
  UNIQUE KEY unique_period (institution_id, period_number)
);

CREATE TABLE IF NOT EXISTS rooms (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  institution_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100),
  capacity INT,
  building VARCHAR(255),
  floor VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_room (institution_id, name),
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS timetable_assignments (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  institution_id CHAR(36) NOT NULL,
  category_id CHAR(36) NOT NULL,
  subcategory_id CHAR(36) NOT NULL,
  item_id CHAR(36),
  room_id CHAR(36),
  period_number INT NOT NULL,
  day ENUM('MON','TUE','WED','THU','FRI','SAT','SUN') NOT NULL,
  staff_id CHAR(36) NOT NULL,
  subject_id CHAR(36) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_timetable_slot_v2 (institution_id, category_id, subcategory_id, item_id, period_number, day),
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
  FOREIGN KEY (item_id) REFERENCES academic_item(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS class_teachers (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  institution_id CHAR(36) NOT NULL,
  category_id CHAR(36) NOT NULL,
  subcategory_id CHAR(36) NOT NULL,
  item_id CHAR(36),
  staff_id CHAR(36) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_class_teacher_v2 (institution_id, category_id, subcategory_id, item_id),
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES academic_item(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS timetable_config (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  institution_id CHAR(36) NOT NULL,
  category_id CHAR(36) NOT NULL,
  subcategory_id CHAR(36) NOT NULL,
  item_id CHAR(36),
  config JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_config (institution_id, category_id, subcategory_id, item_id)
);

CREATE TABLE IF NOT EXISTS academic_structure_labels (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  institution_id CHAR(36) NOT NULL,
  category_label VARCHAR(100) DEFAULT 'Department',
  subcategory_label VARCHAR(100) DEFAULT 'Year',
  item_label VARCHAR(100) DEFAULT 'Section',
  status VARCHAR(20) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
);
