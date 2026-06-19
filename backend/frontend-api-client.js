// ============================================================
// api.js - Drop-in replacement for Supabase in your React frontend
// Place this file in: src/lib/api.js
// Then replace all supabase imports with this client
// ============================================================

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ===================== TOKEN HELPERS =====================
export const getToken = () => localStorage.getItem('auth_token');
export const setToken = (token) => localStorage.setItem('auth_token', token);
export const removeToken = () => localStorage.removeItem('auth_token');

// ===================== BASE FETCH =====================
const request = async (method, endpoint, body = null, isFormData = false) => {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const options = { method, headers };
  if (body) options.body = isFormData ? body : JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

const get = (endpoint) => request('GET', endpoint);
const post = (endpoint, body) => request('POST', endpoint, body);
const put = (endpoint, body) => request('PUT', endpoint, body);
const del = (endpoint) => request('DELETE', endpoint);

// ===================== AUTH =====================
export const auth = {
  register: (data) => post('/auth/register', data),
  login: async (email, password) => {
    const res = await post('/auth/login', { email, password });
    setToken(res.token);
    return res;
  },
  logout: () => { removeToken(); },
  getUser: () => get('/auth/me'),
  updateProfile: (data) => put('/auth/me', data),
  changePassword: (data) => put('/auth/change-password', data),
};

// ===================== INSTITUTION =====================
export const institutions = {
  get: () => get('/institutions/me'),
  update: (data) => put('/institutions/me', data),
};

// ===================== BRANCHES =====================
export const branches = {
  list: () => get('/branches'),
  get: (id) => get(`/branches/${id}`),
  create: (data) => post('/branches', data),
  update: (id, data) => put(`/branches/${id}`, data),
  delete: (id) => del(`/branches/${id}`),
};

// ===================== ACADEMIC STRUCTURE =====================
export const academic = {
  // Labels
  getLabels: () => get('/academic/labels'),
  saveLabels: (data) => post('/academic/labels', data),

  // Categories
  getCategories: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/academic/categories${q ? '?' + q : ''}`);
  },
  createCategory: (data) => post('/academic/categories', data),
  updateCategory: (id, data) => put(`/academic/categories/${id}`, data),
  deleteCategory: (id) => del(`/academic/categories/${id}`),

  // Subcategories
  getSubcategories: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/academic/subcategories${q ? '?' + q : ''}`);
  },
  createSubcategory: (data) => post('/academic/subcategories', data),
  updateSubcategory: (id, data) => put(`/academic/subcategories/${id}`, data),
  deleteSubcategory: (id) => del(`/academic/subcategories/${id}`),

  // Items
  getItems: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/academic/items${q ? '?' + q : ''}`);
  },
  createItem: (data) => post('/academic/items', data),
  updateItem: (id, data) => put(`/academic/items/${id}`, data),
  deleteItem: (id) => del(`/academic/items/${id}`),

  // Copy structure
  copyStructure: (from_year, to_year) => post('/academic/copy', { from_year, to_year }),
};

// ===================== STUDENTS =====================
export const students = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/students${q ? '?' + q : ''}`);
  },
  get: (id) => get(`/students/${id}`),
  create: (data) => post('/students', data),
  update: (id, data) => put(`/students/${id}`, data),
  delete: (id) => del(`/students/${id}`),
  attendanceSummary: (id) => get(`/students/${id}/attendance-summary`),
};

// ===================== STAFF =====================
export const staff = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/staff${q ? '?' + q : ''}`);
  },
  get: (id) => get(`/staff/${id}`),
  create: (data) => post('/staff', data),
  update: (id, data) => put(`/staff/${id}`, data),
  delete: (id) => del(`/staff/${id}`),
  workload: (id) => get(`/staff/${id}/workload`),
  updateMapping: (id, mappings) => post(`/staff/${id}/academic-mapping`, { mappings }),
};

// ===================== SUBJECTS =====================
export const subjects = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/subjects${q ? '?' + q : ''}`);
  },
  get: (id) => get(`/subjects/${id}`),
  create: (data) => post('/subjects', data),
  update: (id, data) => put(`/subjects/${id}`, data),
  delete: (id) => del(`/subjects/${id}`),
  assignStaff: (id, assignments) => post(`/subjects/${id}/assign-staff`, { assignments }),
};

// ===================== TIMETABLE =====================
export const timetable = {
  // Periods
  getPeriods: () => get('/periods'),
  createPeriod: (data) => post('/periods', data),
  updatePeriod: (id, data) => put(`/periods/${id}`, data),
  deletePeriod: (id) => del(`/periods/${id}`),

  // Timetable entries
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/timetable${q ? '?' + q : ''}`);
  },
  create: (data) => post('/timetable', data),
  update: (id, data) => put(`/timetable/${id}`, data),
  delete: (id) => del(`/timetable/${id}`),

  // Timetable assignments
  getAssignments: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/timetable-assignments${q ? '?' + q : ''}`);
  },
  upsertAssignment: (data) => post('/timetable-assignments', data),
  deleteAssignment: (id) => del(`/timetable-assignments/${id}`),

  // Class teachers
  getClassTeachers: () => get('/class-teachers'),
  assignClassTeacher: (data) => post('/class-teachers', data),
};

// ===================== ATTENDANCE =====================
export const attendance = {
  // Settings
  getSettings: () => get('/attendance/settings'),
  saveSettings: (data) => post('/attendance/settings', data),

  // Sessions
  getSessions: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/attendance/sessions${q ? '?' + q : ''}`);
  },
  createSession: (data) => post('/attendance/sessions', data),
  getRecords: (sessionId) => get(`/attendance/sessions/${sessionId}/records`),
  markAttendance: (sessionId, records) => post(`/attendance/sessions/${sessionId}/records`, { records }),
  updateRecord: (recordId, data) => put(`/attendance/records/${recordId}`, data),

  // Reports
  getStatistics: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/attendance/statistics${q ? '?' + q : ''}`);
  },
  getDailySummary: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/attendance/daily-summary${q ? '?' + q : ''}`);
  },
};

// ===================== LEAVE REQUESTS =====================
export const leaveRequests = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return get(`/leave-requests${q ? '?' + q : ''}`);
  },
  create: (data) => post('/leave-requests', data),
  approve: (id) => put(`/leave-requests/${id}/approve`),
  reject: (id) => put(`/leave-requests/${id}/reject`),
  delete: (id) => del(`/leave-requests/${id}`),
};

// ===================== FILE UPLOAD =====================
export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return request('POST', '/upload', formData, true);
};
