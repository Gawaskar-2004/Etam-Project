export type InstitutionType = 'school' | 'college' | 'training';
export type AttendanceMode = 'daily' | 'period' | 'session';
export type UserRole = 'admin' | 'teacher' | 'staff';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'excused' | 'not_marked';

export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  role?: UserRole;
  phone?: string;
  institution_id?: string;
  branch_id?: string;
  is_active?: boolean;
}

export interface Institution {
  id: string;
  name: string;
  type: InstitutionType;
  admin_name?: string;
  admin_email?: string;
  phone?: string;
  is_setup_complete?: boolean;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  contact_number?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
}

export interface Student {
  id: string;
  full_name: string;
  roll_number?: string;
  email?: string;
  phone?: string;
  gender?: string;
  photo_url?: string;
  category?: string;
  subcategory?: string;
  item?: string;
  institution_id?: string;
  branch_id?: string;
  is_active?: boolean;
}

export interface AcademicStructureLabel {
  id: string;
  institution_id: string;
  category_label: string;
  subcategory_label: string;
  item_label?: string;
}

export interface AcademicCategory {
  id: string;
  institution_id: string;
  name: string;
  academic_year?: string;
  status?: string;
}

export interface AcademicSubcategory {
  id: string;
  institution_id: string;
  category_id: string;
  name: string;
  status?: string;
}

export interface AcademicItem {
  id: string;
  institution_id: string;
  subcategory_id: string;
  name: string;
  status?: string;
}

export interface AttendanceStats {
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  attendancePercentage: number;
}

export interface AttendanceSession {
  id: string;
  institution_id: string;
  category_id?: string;
  subcategory_id?: string;
  item_id?: string;
  subject_id?: string;
  date: string;
  taken_by?: string;
}

export interface AttendanceRecord {
  id: string;
  attendance_session_id: string;
  student_id: string;
  student_name?: string;
  roll_number?: string;
  status: AttendanceStatus;
  remarks?: string;
}