import { type ReactNode, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/useAuth'; // ✅ FIXED: was @/context/AuthContext
import { Smartphone, GraduationCap, LogOut } from 'lucide-react';

// ✅ FIX: Only truly public routes (no auth needed)
const PUBLIC_ROUTES = [
  '/login', '/register', '/otp-verification', '/set-password',
];

// ✅ FIX: Setup routes — logged-in users can always access these
// RouteGuard will NEVER redirect away from these paths
const SETUP_ROUTES = [
  '/setup/location', '/setup/academic', '/setup/branch',
];

const ROLE_HOME: Record<string, string> = {
  admin:       '/admin',
  teacher:     '/teacher',
  staff:       '/teacher',
  coordinator: '/teacher',
};

const TEACHER_ROLES = ['teacher', 'staff', 'coordinator'];

// ─────────────────────────────────────────────────────────────────────────────
// Student blocked screen
// ─────────────────────────────────────────────────────────────────────────────
function StudentWebBlocked({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-sm w-full text-center space-y-5">

        <div className="flex justify-center">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <Smartphone className="h-8 w-8 text-indigo-600" />
            </div>
            <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-indigo-600 flex items-center justify-center">
              <GraduationCap className="h-3.5 w-3.5 text-white" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-lg font-bold text-gray-900">Use the Mobile App</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            The student portal is only available on the mobile app.
            Please download the app to access your dashboard, attendance, and timetable.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <a
            href="#"
            className="flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            Download on App Store
          </a>
          <a
            href="#"
            className="flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.18 23.76c.3.17.64.24.99.2L14.64 12 11 8.36 3.18 23.76zm17.11-10.93L17.6 11.4l-3.87 3.87 3.87 3.87 2.71-1.46c.78-.42.78-1.63-.02-2.05zM2.35.28C2.13.51 2 .87 2 1.33v21.34c0 .46.13.82.36 1.05L3.07 23 13.56 12 3.07 1 2.35.28zM14.64 12L3.7.26c-.17-.03-.35-.02-.52.02L14.64 12z"/>
            </svg>
            Get it on Google Play
          </a>
        </div>

        <button
          onClick={onSignOut}
          className="flex items-center justify-center gap-1.5 w-full h-9 text-xs font-medium text-gray-400 hover:text-red-500 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RouteGuard
// ─────────────────────────────────────────────────────────────────────────────
export function RouteGuard({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const locationState = location.state as Record<string, unknown> | null;
  const fromOTPVerification = locationState?.fromOTPVerification === true;

  useEffect(() => {
    if (loading) return;

    const path = location.pathname;
    const isPublic = PUBLIC_ROUTES.some(r => path.startsWith(r));
    const isSetup = SETUP_ROUTES.some(r => path.startsWith(r));

    // Not logged in
    if (!user) {
      if (!isPublic && !isSetup) {
        navigate('/login', { state: { from: path }, replace: true });
      }
      return;
    }

    const role = user.role || '';
    const roleHome = ROLE_HOME[role];

    // Student on web → show blocked screen (handled in render)
    if (role === 'student') return;

    // If on a setup route, NEVER redirect
    if (isSetup) return;

    // If user just came from OTP verification and is on /login, let them log in
    if (fromOTPVerification && path === '/login') return;

    // Logged-in user on public route → redirect to role home
    if (isPublic || path === '/') {
      navigate(roleHome || '/admin', { replace: true });
      return;
    }

    // Teacher/staff → block /admin routes
    if (TEACHER_ROLES.includes(role) && path.startsWith('/admin')) {
      navigate('/teacher', { replace: true });
      return;
    }

    // Admin → block /teacher routes
    if (role === 'admin' && path.startsWith('/teacher')) {
      navigate('/admin', { replace: true });
      return;
    }

  }, [user, loading, location.pathname, fromOTPVerification]);

  // Loading spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 flex flex-col items-center gap-4">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full border-2 border-gray-100" />
            <div className="absolute inset-0 rounded-full border-2 border-t-indigo-600 animate-spin" />
          </div>
          <p className="text-sm text-gray-400 font-medium">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  // Student on web → show mobile-only screen
  if (user?.role === 'student') {
    return (
      <StudentWebBlocked
        onSignOut={async () => {
          await signOut();
          navigate('/login', { replace: true });
        }}
      />
    );
  }

  return <>{children}</>;
}