/**
 * db/api.ts - compatibility layer
 */
import {
  institutionsApi, academicApi,
  studentsApi, staffApi, subjectsApi,
  timetableApi, attendanceApi,
} from '@/lib/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const authHeader = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('auth_token')}` });

export const getInstitution = (_institutionId?: string) => institutionsApi.get();



export const getAcademicLabels = (_institutionId?: string) => academicApi.getLabels();
export const createAcademicLabels = (data: any) => academicApi.upsertLabels(data);

// ✅ FIX: accepts (id, data) but ignores id — backend uses upsert by institution
export const updateAcademicLabels = (_id: any, data: any) => academicApi.upsertLabels(data);

export const getAcademicCategories = (_institutionId?: string) => academicApi.getCategories();
export const getAllAcademicSubcategories = (_institutionId?: string) => academicApi.getSubcategories();
export const getAllAcademicItems = (_institutionId?: string) => academicApi.getItems();

export const createAcademicCategory = (data: any) => academicApi.createCategory(data);
export const createAcademicSubcategory = (data: any) => academicApi.createSubcategory(data);
export const createAcademicItem = (data: any) => academicApi.createItem(data);

export const updateAcademicCategory = (id: string, data: any) =>
  fetch(`${API_URL}/academic/categories/${id}`, { method: 'PUT', headers: authHeader(), body: JSON.stringify(data) }).then(r => r.json());
export const updateAcademicSubcategory = (id: string, data: any) =>
  fetch(`${API_URL}/academic/subcategories/${id}`, { method: 'PUT', headers: authHeader(), body: JSON.stringify(data) }).then(r => r.json());
export const updateAcademicItem = (id: string, data: any) =>
  fetch(`${API_URL}/academic/items/${id}`, { method: 'PUT', headers: authHeader(), body: JSON.stringify(data) }).then(r => r.json());

export const deleteAcademicCategory = (id: string) =>
  fetch(`${API_URL}/academic/categories/${id}`, { method: 'DELETE', headers: authHeader() }).then(r => r.json());
export const deleteAcademicSubcategory = (id: string) =>
  fetch(`${API_URL}/academic/subcategories/${id}`, { method: 'DELETE', headers: authHeader() }).then(r => r.json());
export const deleteAcademicItem = (id: string) =>
  fetch(`${API_URL}/academic/items/${id}`, { method: 'DELETE', headers: authHeader() }).then(r => r.json());

export const getStudents = (_institutionId?: string, limit = 1000, offset = 0) =>
  studentsApi.list({ limit, offset });
export const createStudent = (data: any) => studentsApi.create(data);
export const updateStudent = (id: string, data: any) => studentsApi.update(id, data);
export const deleteStudent = (id: string) => studentsApi.delete(id);

export const getStaff = (_institutionId?: string, limit = 1000, offset = 0) =>
  staffApi.list({ limit, offset });
export const createStaff = (data: any) => staffApi.create(data);
export const updateStaff = (id: string, data: any) => staffApi.update(id, data);
export const deleteStaff = (id: string) => staffApi.delete(id);
export const getStaffAcademicMappings = (staffId: string) =>
  staffApi.get(staffId).then((s: any) => s.academic_mappings || []);
export const createStaffAcademicMapping = (data: any) => staffApi.updateMapping(data.staff_id, data);
export const deleteStaffAcademicMapping = (id: string) =>
  fetch(`${API_URL}/staff/mappings/${id}`, { method: 'DELETE', headers: authHeader() }).then(r => r.json());
export const getStaffWorkload = (staffId: string) => staffApi.workload(staffId);

export const getSubjects = (_institutionId?: string) => subjectsApi.list();
export const createSubject = (data: any) => subjectsApi.create(data);
export const updateSubject = (id: string, data: any) => subjectsApi.update(id, data);
export const deleteSubject = (id: string) => subjectsApi.delete(id);
export const getSubjectStaffAssignments = (subjectId: string) =>
  fetch(`${API_URL}/subjects/${subjectId}/staff`, { headers: authHeader() }).then(r => r.json());
export const createSubjectStaffAssignment = (subjectId: string, data: any) =>
  subjectsApi.assignStaff(subjectId, data);
export const deleteSubjectStaffAssignment = (id: string) =>
  fetch(`${API_URL}/subjects/assignments/${id}`, { method: 'DELETE', headers: authHeader() }).then(r => r.json());

export const getAttendance = (
  _institutionId?: string,
  params?: { startDate?: string; endDate?: string; date?: string },
  limit = 1000, offset = 0
) => attendanceApi.getSessions({ ...params, limit, offset });

export const bulkCreateAttendance = (sessionId: string, records: any[]) =>
  attendanceApi.saveRecords(sessionId, records);

export const getAttendanceStats = (_institutionId?: string, date?: string) =>
  attendanceApi.getDailySummary(date || new Date().toISOString().split('T')[0]).then((data: any) => {
    const summary = Array.isArray(data) ? data[0] : data;
    return {
      totalPresent: Number(summary?.present || 0),
      totalAbsent: Number(summary?.absent || 0),
      totalLate: Number(summary?.late || 0),
      attendancePercentage: Number(summary?.percentage || 0),
      ...summary,
    };
  });