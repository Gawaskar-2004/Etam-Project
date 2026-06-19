import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import NotificationBell from '@/components/NotificationBell';
import {
  LayoutDashboard, Users, UserCog,
  FileText, Settings, Menu, LogOut,
  GraduationCap, Activity, Building,
} from 'lucide-react';

interface AdminLayoutProps { children: ReactNode; }

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard',          path: '/admin',                 group: 'main' },
  { icon: Users,           label: 'Student Management', path: '/admin/students',        group: 'main' },
  { icon: UserCog,         label: 'Staff Management',   path: '/admin/staff',           group: 'main' },
  { icon: Building,        label: 'Hostel Management',  path: '/admin/hostel',          group: 'main' },
  { icon: Activity,        label: 'Live Attendance',    path: '/admin/live-attendance', group: 'main' },
  { icon: FileText,        label: 'Reports',            path: '/admin/reports',         group: 'main' },
  { icon: Settings,        label: 'Settings',           path: '/admin/settings',        group: 'main' },
];

function Sidebar() {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => { await signOut(); navigate('/login'); };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      {/* Logo + Bell (desktop) */}
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <GraduationCap className="h-4.5 w-4.5 text-white" style={{ height: 18, width: 18 }} />
            </div>
            <div>
              <span className="text-base font-bold text-gray-900 tracking-tight">ETAM</span>
              <p className="text-[10px] text-gray-400 leading-none mt-0.5">Admin Panel</p>
            </div>
          </div>
          {/* ✅ Notification Bell — desktop sidebar */}
          <NotificationBell />
        </div>
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 py-4">
        <nav className="px-3 space-y-0.5">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                  ${isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                  }
                `}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
                <span>{item.label}</span>
                {isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-500" />
                )}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User + Logout */}
      <div className="px-4 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700 flex-shrink-0">
            {profile?.full_name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-800 truncate">{profile?.full_name || 'Admin'}</p>
            <p className="text-xs text-gray-400 truncate">{profile?.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-60 shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-bold text-gray-900">ETAM</span>
          </div>

          <div className="flex items-center gap-2">
            {/* ✅ Notification Bell — mobile top bar */}
            <NotificationBell />

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-60">
                <Sidebar />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="min-h-full p-4 pt-20 lg:p-6 lg:pt-6">
          {children}
        </div>
      </main>
    </div>
  );
}