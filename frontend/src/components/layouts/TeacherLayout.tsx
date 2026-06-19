import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import NotificationBell from '@/components/NotificationBell';
import {
  LayoutDashboard, Users, Calendar, ClipboardCheck,
  Menu, LogOut, GraduationCap, Activity, FileText,
  Settings, UserCheck, Clock, BarChart3, Home, ScanFace, Camera, Shield
} from 'lucide-react';


interface TeacherLayoutProps { children: ReactNode; }

const menuItems = [
  { icon: Home,            label: 'Dashboard',          path: '/teacher',                    group: 'dashboard' },
  { icon: Calendar,        label: 'My Timetable',       path: '/teacher/timetable',          group: 'schedule' },
  { icon: ClipboardCheck,  label: 'Manual Attendance',  path: '/teacher/attendance',         group: 'attendance' },
  { icon: ScanFace,        label: 'Face Attendance',    path: '/teacher/face-attendance',    group: 'attendance' },
  { icon: Camera,          label: 'Live Attendance',    path: '/teacher/live-attendance',    group: 'attendance' },
  { icon: UserCheck,       label: 'Face Registration',  path: '/teacher/face-registration',  group: 'management' },
  { icon: Users,           label: 'My Students',        path: '/teacher/students',           group: 'management' },
  { icon: BarChart3,       label: 'Reports',            path: '/teacher/reports',            group: 'management' },
  { icon: Activity,        label: 'Performance',        path: '/teacher/performance',        group: 'management' },
  { icon: Calendar,        label: 'Leave Management',   path: '/teacher/leave-management',   group: 'management' },
  { icon: Settings,        label: 'Profile',            path: '/teacher/profile',            group: 'settings' },
];

function Sidebar() {
  const location = useLocation();
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const currentUser = user || profile;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      {/* Header — Logo + Bell */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">ETAM</h1>
              <p className="text-xs text-gray-400">Teacher Panel</p>
            </div>
          </div>
          {/* ✅ Notification Bell — desktop sidebar */}
          <NotificationBell />
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
                <span>{item.label}</span>
                {item.label === 'Face Attendance' && (
                  <Badge className="ml-auto text-[10px] px-1.5 py-0 bg-indigo-100 text-indigo-700 border-indigo-200">
                    AI
                  </Badge>
                )}
                {item.label === 'Live Attendance' && (
                  <Badge className="ml-auto text-[10px] px-1.5 py-0 bg-rose-100 text-rose-700 border-rose-200 animate-pulse">
                    LIVE
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User Footer */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700 flex-shrink-0">
            {currentUser?.full_name?.charAt(0).toUpperCase() || 'T'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{currentUser?.full_name}</p>
            <p className="text-xs text-gray-400 truncate">{currentUser?.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  );
}

function MobileHeader() {
  const { user, profile } = useAuth();
  const currentUser = user || profile;
  const location = useLocation();

  const currentPage = menuItems.find(item => item.path === location.pathname)?.label || 'Dashboard';

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm lg:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
            <GraduationCap className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">ETAM</h1>
            <p className="text-xs text-gray-400">{currentPage}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* ✅ Notification Bell — mobile top bar */}
          <NotificationBell />

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 border-gray-200">
                <Menu className="h-4 w-4 text-gray-500" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <Sidebar />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}

export default function TeacherLayout({ children }: TeacherLayoutProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 bg-white border-r border-gray-100">
        <Sidebar />
      </aside>

      {/* Mobile Header */}
      <MobileHeader />

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="lg:p-6 p-4 pt-20 lg:pt-6 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}