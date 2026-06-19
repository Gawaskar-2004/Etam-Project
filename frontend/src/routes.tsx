import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import OTPVerificationPage from '@/pages/OTPVerificationPage';
import SetPasswordPage from '@/pages/SetPasswordPage';

// Setup pages
import LocationSetupPage from '@/pages/setup/LocationSetupPageSimple';
import AcademicSetupPage from '@/pages/setup/AcademicSetupPage';

// Admin pages
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import StudentManagementPage from '@/pages/admin/StudentManagementPageEnhanced';
import StaffManagementPage from '@/pages/admin/StaffManagementPageNew';
import SubjectManagementPage from '@/pages/admin/SubjectManagementPageNew';
import LiveAttendancePage from '@/pages/admin/LiveAttendancePage';
import TimetableManagementPage from '@/pages/admin/TimetableManagementPageNew2';
import ReportsPage from '@/pages/admin/ReportsPage';
import SettingsPage from '@/pages/admin/SettingsPage';
import AcademicSetupPageAdmin from '@/pages/admin/AcademicSetupPage';
import AcademicManagementPage from '@/pages/admin/AcademicManagementPage';
import AdminFaceRegistrationPage from '@/pages/admin/AdminFaceRegistrationPage';
import HostelManagementPage from '@/pages/admin/HostelManagementPage';



// Teacher pages
import TeacherDashboardPage from '@/pages/teacher/TeacherDashboardPage';
import TeacherAttendancePage from '@/pages/teacher/TeacherAttendancePage';
import TeacherStudentsPage from '@/pages/teacher/TeacherStudentPage';
import TeacherTimetablePage from '@/pages/teacher/TeacherTimetablePage';
import TeacherProfilePage from '@/pages/teacher/TeacherProfilePage';
import TeacherFaceRegistrationPage from './pages/teacher/TeacherFaceRegistrationPage';
import TeacherFaceAttendancePage from '@/pages/teacher/TeacherFaceAttendancePage';
import TeacherLiveAttendancePage from '@/pages/teacher/TeacherLiveAttendancePage';
import TeacherReportsPage from '@/pages/teacher/TeacherReportsPage';
import TeacherPerformancePage from '@/pages/teacher/TeacherPerformancePage';



import type { ReactNode } from 'react';
import TeacherLeaveManagementPage from './pages/teacher/TeacherLeaveManagementPage';


interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
}

const routes: RouteConfig[] = [
  // DEFAULT → LOGIN
  { name: 'Login',            path: '/',                element: <LoginPage /> },
  { name: 'LoginPage',        path: '/login',           element: <LoginPage /> },
  { name: 'Register',         path: '/register',        element: <RegisterPage /> },
  { name: 'OTP Verification', path: '/otp-verification',element: <OTPVerificationPage /> },
  { name: 'Set Password',     path: '/set-password',    element: <SetPasswordPage /> },

  // Setup
  
  { name: 'Location Setup', path: '/setup/location', element: <LocationSetupPage /> },
  { name: 'Academic Setup', path: '/setup/academic', element: <AcademicSetupPage /> },

  // ── ADMIN ──
  { name: 'Admin Dashboard',      path: '/admin',                      element: <AdminDashboardPage /> },
  { name: 'Student Management',   path: '/admin/students',             element: <StudentManagementPage /> },
  { name: 'Staff Management',     path: '/admin/staff',                element: <StaffManagementPage /> },
  { name: 'Subject Management',   path: '/admin/subjects',             element: <SubjectManagementPage /> },
  { name: 'Live Attendance',      path: '/admin/live-attendance',      element: <LiveAttendancePage /> },
  { name: 'Timetable Management', path: '/admin/timetable',            element: <TimetableManagementPage /> },
  { name: 'Reports',              path: '/admin/reports',              element: <ReportsPage /> },
  { name: 'Settings',             path: '/admin/settings',             element: <SettingsPage /> },
  { name: 'Academic Setup',       path: '/admin/academic-setup',       element: <AcademicSetupPageAdmin /> },
  { name: 'Academic Management',  path: '/admin/academic-management',  element: <AcademicManagementPage /> },
  { name: 'Face Registration',    path: '/admin/face-registration',    element: <AdminFaceRegistrationPage /> },
  { name: 'Hostel Management',    path: '/admin/hostel',               element: <HostelManagementPage /> },
  
  

  // ── TEACHER ──
  { name: 'Teacher Dashboard',         path: '/teacher',                    element: <TeacherDashboardPage /> },
  { name: 'Teacher Dashboard',         path: '/teacher/dashboard',          element: <TeacherDashboardPage /> },
  { name: 'Teacher Attendance',        path: '/teacher/attendance',         element: <TeacherAttendancePage /> },
  { name: 'Teacher Face Registration', path: '/teacher/face-registration',  element: <TeacherFaceRegistrationPage /> },
  { name: 'Teacher Face Attendance',   path: '/teacher/face-attendance',    element: <TeacherFaceAttendancePage /> },
  { name: 'Teacher Students',          path: '/teacher/students',           element: <TeacherStudentsPage /> },
  { name: 'Teacher Timetable',         path: '/teacher/timetable',          element: <TeacherTimetablePage /> },
  { name: 'Teacher Reports',           path: '/teacher/reports',            element: <TeacherReportsPage /> },
  { name: 'Teacher Profile',           path: '/teacher/profile',            element: <TeacherProfilePage /> },
  { name: 'Teacher Live Attendance',   path: '/teacher/live-attendance',    element: <TeacherLiveAttendancePage /> },
  { name: 'Teacher Performance',       path: '/teacher/performance',        element: <TeacherPerformancePage /> },
  { name: 'Teacher Leave Management',   path: '/teacher/leave-management',   element: <TeacherLeaveManagementPage /> },
];

export default routes;