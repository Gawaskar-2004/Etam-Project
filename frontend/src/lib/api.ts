const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const getToken = () => localStorage.getItem('auth_token');
export const setToken = (t: string) => localStorage.setItem('auth_token', t);
export const removeToken = () => localStorage.removeItem('auth_token');

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || 'Request failed');
  return data;
}

const get = (path: string) => request(path);
const post = (path: string, body: any) => request(path, { method: 'POST', body: JSON.stringify(body) });
const put = (path: string, body: any) => request(path, { method: 'PUT', body: JSON.stringify(body) });
const del = (path: string) => request(path, { method: 'DELETE' });

export const authApi = {
  register: (data: any) => post('/auth/register', data),
  login: (email: string, password: string) => post('/auth/login', { email, password }),
  getMe: () => get('/auth/me'),
  updateMe: (data: any) => put('/auth/me', data),
  changePassword: (currentPassword: string, newPassword: string) =>
    post('/auth/change-password', { currentPassword, newPassword }),
  
  // ✅ OTP Methods
  sendOTP: (data: { email: string }) => post('/auth/send-otp', data),
  verifyOTP: (data: { email: string; otp: string }) => post('/auth/verify-otp', data),
  resendOTP: (data: { email: string }) => post('/auth/resend-otp', data),
};

export const institutionsApi = {
  get: () => get('/institutions/my'),
  update: (data: any) => put('/institutions/my', data),
  saveLocation: (data: any) => put('/institutions/my/location', data), // ✅ new
};


export const academicApi = {
  getLabels: () => get('/academic/labels'),
  upsertLabels: (data: any) => post('/academic/labels', data),
  getCategories: () => get('/academic/categories'),
  getSubcategories: (categoryId?: string) =>
    get(categoryId ? `/academic/subcategories?category_id=${categoryId}` : '/academic/subcategories'),
  getItems: (subcategoryId?: string) =>
    get(subcategoryId ? `/academic/items?subcategory_id=${subcategoryId}` : '/academic/items'),
  createCategory: (data: any) => post('/academic/categories', data),
  createSubcategory: (data: any) => post('/academic/subcategories', data),
  createItem: (data: any) => post('/academic/items', data),
  copyStructure: (data: any) => post('/academic/copy', data),
};

export const studentsApi = {
  list: (params?: any) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return get(`/students${q}`);
  },
  get: (id: string) => get(`/students/${id}`),
  create: (data: any) => post('/students', data),
  update: (id: string, data: any) => put(`/students/${id}`, data),
  delete: (id: string) => del(`/students/${id}`),
  attendanceSummary: (id: string) => get(`/students/${id}/attendance-summary`),
};

export const staffApi = {
  list: (params?: any) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return get(`/staff${q}`);
  },
  get: (id: string) => get(`/staff/${id}`),
  create: (data: any) => post('/staff', data),
  update: (id: string, data: any) => put(`/staff/${id}`, data),
  delete: (id: string) => del(`/staff/${id}`),
  workload: (id: string) => get(`/staff/${id}/workload`),
  assignments: (id: string) => get(`/staff/${id}/assignments`),
  classTeacher: (id: string) => get(`/staff/${id}/class-teacher`),
  updateMapping: (id: string, data: any) => put(`/staff/${id}/academic-mapping`, data),
};

export const subjectsApi = {
  list: () => get('/subjects'),
  get: (id: string) => get(`/subjects/${id}`),
  create: (data: any) => post('/subjects', data),
  update: (id: string, data: any) => put(`/subjects/${id}`, data),
  delete: (id: string) => del(`/subjects/${id}`),
  assignStaff: (id: string, data: any) => post(`/subjects/${id}/assign-staff`, data),
};

export const timetableApi = {
  getPeriods: () => get('/periods'),
  createPeriod: (data: any) => post('/periods', data),

  getTimetable: (params?: any) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return get(`/timetable${q}`);
  },

  getAssignments: (params?: any) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return get(`/timetable-assignments${q}`);
  },
  createAssignment: (data: any) => post('/timetable-assignments', data),
  deleteAssignment: (id: string) => del(`/timetable-assignments/${id}`),

  getClassTeachers: () => get('/class-teachers'),
  assignClassTeacher: (data: any) => post('/class-teachers', data),
};

export const attendanceApi = {
  getSettings: () => get('/attendance/settings'),
  updateSettings: (data: any) => post('/attendance/settings', data),

  getSessions: (params?: any) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return get(`/attendance/sessions${q}`);
  },
  createSession: (data: any) => post('/attendance/sessions', data),
  getRecords: (sessionId: string) => get(`/attendance/sessions/${sessionId}/records`),
  saveRecords: (sessionId: string, records: any[]) =>
    post(`/attendance/sessions/${sessionId}/records`, { records }),

  getStatistics: (params?: any) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return get(`/attendance/statistics${q}`);
  },
  getDailySummary: (date: string) => get(`/attendance/daily-summary?date=${date}`),
};

export const leaveApi = {
  list: (params?: any) => {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return get(`/leave-requests${q}`);
  },
  create: (data: any) => post('/leave-requests', data),
  approve: (id: string) => put(`/leave-requests/${id}/approve`, {}),
  reject: (id: string) => put(`/leave-requests/${id}/reject`, {}),
  delete: (id: string) => del(`/leave-requests/${id}`),
};


export async function uploadFile(file: File): Promise<string> {
  const token = getToken();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.url;
}