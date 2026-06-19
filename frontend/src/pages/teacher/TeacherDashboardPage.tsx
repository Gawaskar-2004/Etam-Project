import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import TeacherLayout from '@/components/layouts/TeacherLayout';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, GraduationCap, CheckCircle, XCircle, Clock,
  CalendarDays, RefreshCw, BookOpen,
  Award, BarChart3, Camera, UserPlus, CheckSquare,
  Shield, AlertTriangle, ArrowUpRight, PieChart,
  Activity, Star,
} from 'lucide-react';
import { timetableApi, studentsApi, attendanceApi, staffApi } from '@/lib/api';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const DAY_MAP: Record<string, string> = {
  SUNDAY: 'SUN', MONDAY: 'MON', TUESDAY: 'TUE', WEDNESDAY: 'WED',
  THURSDAY: 'THU', FRIDAY: 'FRI', SATURDAY: 'SAT',
};

const CARD_PALETTES = [
  { bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-100' },
  { bg: 'bg-sky-50',    text: 'text-sky-600',    ring: 'ring-sky-100'    },
  { bg: 'bg-emerald-50',text: 'text-emerald-600',ring: 'ring-emerald-100'},
  { bg: 'bg-amber-50',  text: 'text-amber-600',  ring: 'ring-amber-100'  },
  { bg: 'bg-rose-50',   text: 'text-rose-600',   ring: 'ring-rose-100'   },
  { bg: 'bg-teal-50',   text: 'text-teal-600',   ring: 'ring-teal-100'   },
  { bg: 'bg-indigo-50', text: 'text-indigo-600', ring: 'ring-indigo-100' },
] as const;

// ─────────────────────────────────────────────────────────────
// TypeScript Interfaces
// ─────────────────────────────────────────────────────────────
interface Assignment {
  id: string;
  subject_id?: string;
  subject_name?: string;
  day?: string;
  period_number?: number;
  start_time?: string | null;
  end_time?: string | null;
  period_start_time?: string | null;
  period_end_time?: string | null;
  subcategory_id?: string;
  item_id?: string;
  category_id?: string;
  category_name?: string;
  subcategory_name?: string;
  item_name?: string;
  class_name?: string;
  full_class_name?: string;
}

interface ClassSummary {
  id: string;
  name: string;
  subcategory_id?: string;
  item_id?: string;
  category_id?: string;
}

interface ClassStats extends ClassSummary {
  total: number;
  present: number;
  absent: number;
}

interface ScheduledClass {
  id: string;
  period_number: number;
  subject_name: string;
  class_name: string;
  start_time: string | null;
  end_time: string | null;
  student_count: number;
}

interface ActivityItem {
  id: number;
  type: 'attendance' | 'success' | 'warning' | 'system' | 'student';
  message: string;
  time: string;
  details?: string;
  isNew: boolean;
}

interface DashboardStats {
  myStudents: number;
  todayClasses: number;
  subjects: number;
}

interface StaffMember {
  id: string;
  user_id?: string;
  email?: string;
}

interface ClassTeacherEntry {
  staff_id: string;
  category_id?: string;
  subcategory_id?: string;
  item_id?: string;
  category_name?: string;
  subcategory_name?: string;
  item_name?: string;
}

interface AttendanceRecord {
  student_id: string | number;
  status: string;
}

interface AttendanceSession {
  id: string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const fmt12 = (t: string | null | undefined): string => {
  if (!t) return '';
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const buildClassName = (item: Partial<Assignment>): string => {
  if (item.category_name && item.subcategory_name && item.item_name)
    return `${item.category_name} ${item.subcategory_name} ${item.item_name}`;
  if (item.subcategory_name && item.item_name)
    return `${item.subcategory_name} ${item.item_name}`;
  if (item.subcategory_name) return item.subcategory_name;
  if (item.item_name) return `Section ${item.item_name}`;
  return item.class_name || 'Class';
};

const getTodayCode = (): string => {
  const full = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  return DAY_MAP[full] ?? full.slice(0, 3);
};

const timeToMinutes = (t: string | null | undefined): number => {
  if (!t) return -1;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const isCurrentPeriod = (start: string | null, end: string | null): boolean => {
  if (!start || !end) return false;
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  return now >= timeToMinutes(start) && now <= timeToMinutes(end);
};

const normId = (v: unknown): string =>
  v == null || v === '' ? '' : String(v);

const fetchAttendanceForStudents = async (
  studentIds: Set<string>,
  sessions: AttendanceSession[]
): Promise<{ present: number; absent: number }> => {
  if (sessions.length === 0 || studentIds.size === 0) return { present: 0, absent: 0 };
  const studentStatusMap = new Map<string, Set<string>>();
  await Promise.all(
    sessions.map(async (session) => {
      try {
        const recs: unknown = await attendanceApi.getRecords(session.id).catch(() => []);
        const recList: AttendanceRecord[] = Array.isArray(recs) ? recs : ((recs as { records?: AttendanceRecord[] })?.records ?? []);
        recList.forEach((r) => {
          const sid = String(r.student_id);
          if (!studentIds.has(sid)) return;
          if (!studentStatusMap.has(sid)) studentStatusMap.set(sid, new Set());
          studentStatusMap.get(sid)!.add(r.status);
        });
      } catch { /* silent */ }
    })
  );
  let present = 0, absent = 0;
  studentIds.forEach((sid) => {
    const statuses = studentStatusMap.get(sid);
    if (!statuses) return;
    if (statuses.has('present')) present++;
    else if (statuses.has('absent')) absent++;
  });
  return { present, absent };
};

// ─────────────────────────────────────────────────────────────
// Sub-components — Admin-matched typography & card sizes
// ─────────────────────────────────────────────────────────────

// Metric Card  (matches admin: rounded-xl, p-4, text-2xl value, text-xs labels)
interface MetricCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  subtitle?: string;
  loading?: boolean;
}

function MetricCard({ label, value, icon: Icon, iconBg, iconColor, subtitle, loading }: MetricCardProps) {
  const numVal = typeof value === 'string' ? (parseInt(value) || 0) : value;
  const [count, setCount] = useState(0);
  const isPercent = typeof value === 'string' && value.includes('%');

  useEffect(() => {
    if (loading || numVal === 0) { setCount(0); return; }
    const duration = 900;
    let start: number | undefined;
    let frame: number;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setCount(Math.floor((1 - Math.pow(1 - p, 3)) * numVal));
      if (p < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [numVal, loading]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <Skeleton className="h-3 w-20 mb-4 bg-gray-100" />
        <Skeleton className="h-7 w-14 mb-2 bg-gray-100" />
        <Skeleton className="h-3 w-16 bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-400">{label}</span>
        <div className={`p-2 rounded-lg ${iconBg}`}>
          <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">
        {isPercent ? `${count}%` : count}
      </p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

// Course Card  (matches admin card: rounded-xl, p-4, text-sm headings)
interface CourseCardProps {
  cls: ClassStats;
  isHomeroom: boolean;
  rank: number;
  onClick?: () => void;
}

function CourseCard({ cls, isHomeroom, rank, onClick }: CourseCardProps) {
  const pct = cls.total > 0 ? Math.round((cls.present / cls.total) * 100) : 0;
  const palette = CARD_PALETTES[rank % CARD_PALETTES.length];
  const statusColor = pct >= 85 ? 'text-green-600' : pct >= 70 ? 'text-amber-600' : pct > 0 ? 'text-red-500' : 'text-gray-300';
  const barColor   = pct >= 85 ? 'bg-green-500' : pct >= 70 ? 'bg-amber-500' : pct > 0 ? 'bg-red-500' : 'bg-gray-200';
  const initial    = cls.name.charAt(0).toUpperCase();

  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 cursor-pointer overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-lg ${palette.bg} flex items-center justify-center flex-shrink-0`}>
              <span className={`text-sm font-bold ${palette.text}`}>
                {isHomeroom ? 'HC' : initial}
              </span>
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm leading-tight line-clamp-2">{cls.name}</p>
              {isHomeroom && (
                <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
                  <Star className="h-2.5 w-2.5" /> Homeroom
                </span>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className={`text-xl font-bold leading-none ${statusColor}`}>
              {cls.total === 0 ? '—' : `${pct}%`}
            </p>
            <p className="text-[10px] font-medium text-gray-400 mt-0.5">Present</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Enrolled', val: cls.total,   color: 'text-gray-700'   },
            { label: 'Present',  val: cls.present,  color: 'text-green-600' },
            { label: 'Absent',   val: cls.absent,   color: 'text-red-500'    },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 rounded-lg py-2 text-center border border-gray-100">
              <p className={`text-sm font-bold ${s.color}`}>{s.val}</p>
              <p className="text-[9px] font-medium text-gray-400 uppercase mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <span className="text-[10px] font-medium text-gray-400">Attendance rate</span>
            <span className={`text-[10px] font-semibold ${statusColor}`}>
              {cls.total === 0 ? 'No data' : `${pct}%`}
            </span>
          </div>
          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColor} transition-all duration-1000`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="flex items-center justify-end mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <span className="text-[10px] font-semibold text-indigo-600 flex items-center gap-1">
            View Details <ArrowUpRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </div>
  );
}

// Schedule Item  (matches admin card density)
interface ScheduleItemProps {
  cls: ScheduledClass;
  index: number;
}

function ScheduleItem({ cls, index }: ScheduleItemProps) {
  const timeStr = cls.start_time && cls.end_time
    ? `${fmt12(cls.start_time)} – ${fmt12(cls.end_time)}`
    : `Period ${cls.period_number}`;
  const isCurrent = isCurrentPeriod(cls.start_time, cls.end_time);
  const p = CARD_PALETTES[index % CARD_PALETTES.length];

  return (
    <div className={`bg-white rounded-lg border transition-all duration-200 hover:shadow-sm ${isCurrent ? 'border-indigo-200 ring-1 ring-indigo-100 shadow-sm' : 'border-gray-100'}`}>
      <div className="flex items-center gap-3 p-3">
        <div className={`w-8 h-8 rounded-lg ${p.bg} flex flex-col items-center justify-center flex-shrink-0`}>
          <span className={`text-xs font-bold ${p.text}`}>{cls.period_number}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-800 truncate">{cls.subject_name}</p>
            {isCurrent && (
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 flex-shrink-0 animate-pulse">NOW</span>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{cls.class_name} · {cls.student_count} students</p>
        </div>
        <div className="text-right flex-shrink-0">
          {cls.start_time ? (
            <>
              <p className="text-[10px] font-semibold text-indigo-600">{fmt12(cls.start_time)}</p>
              <p className="text-[9px] text-gray-400">{fmt12(cls.end_time)}</p>
            </>
          ) : (
            <p className="text-[10px] font-medium text-gray-400">P{cls.period_number}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Quick Action  (matches admin quick-action card style)
interface QuickActionProps {
  href: string;
  icon: React.ElementType;
  label: string;
  desc: string;
  badge?: string | null;
  color: string;
}

function QuickAction({ href, icon: Icon, label, desc, badge, color }: QuickActionProps) {
  return (
    <Link
      to={href}
      className="group flex flex-col gap-3 p-4 rounded-xl border border-gray-100 bg-white hover:border-indigo-100 hover:bg-indigo-50/30 hover:shadow-sm transition-all duration-200"
    >
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        {badge && (
          <span className="text-[10px] font-medium text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">{badge}</span>
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors leading-tight">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </Link>
  );
}

// Activity Feed  (matches admin density)
const ACTIVITY_STYLES: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  attendance: { color: 'text-green-600', bg: 'bg-green-50',  icon: CheckCircle  },
  success:    { color: 'text-amber-600', bg: 'bg-amber-50',  icon: Award        },
  warning:    { color: 'text-red-500',   bg: 'bg-red-50',    icon: AlertTriangle },
  system:     { color: 'text-gray-500',  bg: 'bg-gray-50',   icon: Activity     },
  student:    { color: 'text-sky-600',   bg: 'bg-sky-50',    icon: Users        },
};

function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  if (!activities.length) {
    return (
      <div className="py-10 text-center">
        <Activity className="h-7 w-7 text-gray-200 mx-auto mb-2" />
        <p className="text-xs text-gray-400">No recent activity</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-gray-100">
      {activities.map((act) => {
        const cfg = ACTIVITY_STYLES[act.type] ?? ACTIVITY_STYLES.system;
        const Icon = cfg.icon;
        return (
          <div key={act.id} className="flex items-start gap-3 p-3.5 hover:bg-gray-50 transition-colors">
            <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 leading-tight">{act.message}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Clock className="h-2.5 w-2.5 text-gray-300" />
                <span className="text-[10px] text-gray-400">{act.time}</span>
                {act.details && (
                  <>
                    <span className="text-gray-200">·</span>
                    <span className="text-[10px] text-gray-400">{act.details}</span>
                  </>
                )}
              </div>
            </div>
            {act.isNew && (
              <span className="flex-shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 animate-pulse self-start mt-0.5">
                NEW
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Right column skeleton
function RightColSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-32 bg-gray-100" />
        {[1,2,3].map(i => <Skeleton key={i} className="h-[60px] rounded-lg bg-gray-100" />)}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-28 bg-gray-100" />
        {[1,2].map(i => <Skeleton key={i} className="h-14 rounded-lg bg-gray-100" />)}
      </div>
    </div>
  );
}

// Section header  (admin-style: smaller, lighter)
function SectionHeader({ title, badge }: { title: string; badge?: string | number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-sm font-semibold text-gray-800">{title}</span>
      {badge !== undefined && (
        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-50 text-gray-500 border border-gray-100">
          {badge}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────
export default function TeacherDashboardPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const currentUser = user || profile;

  const [loading, setLoading]                   = useState(true);
  const [refreshing, setRefreshing]             = useState(false);
  const [stats, setStats]                       = useState<DashboardStats>({ myStudents: 0, todayClasses: 0, subjects: 0 });
  const [myClass, setMyClass]                   = useState<ClassStats | null>(null);
  const [assignedClasses, setAssignedClasses]   = useState<ClassStats[]>([]);
  const [todaySchedule, setTodaySchedule]       = useState<ScheduledClass[]>([]);
  const [totalClasses, setTotalClasses]         = useState(0);
  const [activities, setActivities]             = useState<ActivityItem[]>([]);

  // ── Data fetchers ──────────────────────────────────────────
  const fetchMyStaffId = async (): Promise<string | null> => {
    try {
      const staffList: StaffMember[] = await staffApi.list({ limit: 1000 });
      const me = Array.isArray(staffList)
        ? staffList.find(s => s.user_id === currentUser?.id || s.email === currentUser?.email)
        : null;
      return me?.id ?? null;
    } catch { return null; }
  };

  const fetchMyCtEntry = async (staffId: string): Promise<ClassTeacherEntry | null> => {
    try {
      const list: ClassTeacherEntry[] = await timetableApi.getClassTeachers();
      return Array.isArray(list) ? (list.find(ct => ct.staff_id === staffId) ?? null) : null;
    } catch { return null; }
  };

  const fetchClassAttendance = async (
    subcategory_id: unknown,
    item_id: unknown,
    studentIds: Set<string>
  ): Promise<{ present: number; absent: number }> => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const raw: unknown = await attendanceApi.getSessions({
        date: today, subcategory_id, ...(item_id ? { item_id } : {}),
      }).catch(() => []);
      const sessions: AttendanceSession[] = Array.isArray(raw) ? raw : ((raw as { sessions?: AttendanceSession[] })?.sessions ?? []);
      return fetchAttendanceForStudents(studentIds, sessions);
    } catch { return { present: 0, absent: 0 }; }
  };

  const fetchClassStats = async (cls: ClassSummary): Promise<ClassStats> => {
    try {
      const raw: unknown = await studentsApi.list({ subcategory_id: cls.subcategory_id, item_id: cls.item_id ?? undefined });
      const stList: { id: string | number }[] = Array.isArray(raw) ? raw : ((raw as { students?: { id: string | number }[] })?.students ?? []);
      const studentIds = new Set<string>(stList.map(s => String(s.id)));
      const { present, absent } = await fetchClassAttendance(cls.subcategory_id, cls.item_id, studentIds);
      return { ...cls, total: stList.length, present, absent };
    } catch { return { ...cls, total: 0, present: 0, absent: 0 }; }
  };

  const buildActivities = (
    myClassResult: ClassStats | null,
    assigned: ClassStats[]
  ): ActivityItem[] => {
    const acts: ActivityItem[] = [];
    if (myClassResult && myClassResult.present > 0)
      acts.push({ id: 1, type: 'attendance', message: `Marked ${myClassResult.present} students present`, time: 'Today', isNew: true, details: `${myClassResult.absent} absent` });
    const highCls = assigned.find(c => c.total > 0 && c.present / c.total >= 0.9);
    if (highCls)
      acts.push({ id: 2, type: 'success', message: `${highCls.name} — 90%+ attendance`, time: 'Today', isNew: false, details: 'Excellent' });
    const lowCls = assigned.find(c => c.total > 0 && c.present / c.total < 0.6);
    if (lowCls)
      acts.push({ id: 3, type: 'warning', message: `${lowCls.name} attendance below 60%`, time: 'Today', isNew: true, details: 'Action needed' });
    if (!acts.length)
      acts.push({ id: 4, type: 'system', message: 'Dashboard up to date', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isNew: false });
    return acts;
  };

  // ── Main load ──────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      setLoading(true);
      const todayCode = getTodayCode();

      const res: unknown = await timetableApi.getAssignments({ user_id: currentUser.id });
      const assignments: Assignment[] = Array.isArray(res) ? res : ((res as { assignments?: Assignment[] })?.assignments ?? []);
      const subjectSet = new Set(assignments.map(a => a.subject_id).filter(Boolean));

      // Build class map
      const classMap = new Map<string, ClassSummary>();
      assignments.forEach(a => {
        const key = `${normId(a.subcategory_id)}_${normId(a.item_id)}`;
        if (!classMap.has(key)) {
          classMap.set(key, {
            id: key,
            name: buildClassName(a),
            subcategory_id: a.subcategory_id,
            item_id: a.item_id,
            category_id: a.category_id,
          });
        }
      });

      // Staff + homeroom
      const staffId = await fetchMyStaffId();
      const ctEntry = staffId ? await fetchMyCtEntry(staffId) : null;

      // Homeroom class stats
      let myClassResult: ClassStats | null = null;
      if (ctEntry) {
        const homroomSummary: ClassSummary = {
          id: `ct_${ctEntry.category_id}_${ctEntry.subcategory_id}_${ctEntry.item_id ?? ''}`,
          name: [ctEntry.category_name, ctEntry.subcategory_name, ctEntry.item_name].filter(Boolean).join(' '),
          subcategory_id: ctEntry.subcategory_id,
          item_id: ctEntry.item_id,
          category_id: ctEntry.category_id,
        };
        myClassResult = await fetchClassStats(homroomSummary);
      }

      // Teaching assignments (excluding homeroom)
      const allClasses = Array.from(classMap.values());
      const teachingClasses = ctEntry
        ? allClasses.filter(tc => {
            if (normId(tc.subcategory_id) !== normId(ctEntry.subcategory_id)) return true;
            return !(normId(tc.item_id) === normId(ctEntry.item_id) || !tc.item_id || !ctEntry.item_id);
          })
        : allClasses;

      const assignedWithStats = await Promise.all(teachingClasses.map(fetchClassStats));

      // Today's schedule
      const todayList = assignments
        .filter(a => (a.day ?? '').toUpperCase() === todayCode)
        .sort((a, b) => (a.period_number ?? 99) - (b.period_number ?? 99));

      const statsMap = new Map<string, number>(assignedWithStats.map(c => [c.id, c.total]));
      const todayFormatted: ScheduledClass[] = todayList.map(item => {
        const key = `${normId(item.subcategory_id)}_${normId(item.item_id)}`;
        return {
          id: item.id,
          period_number: item.period_number ?? 0,
          subject_name: item.subject_name ?? 'Subject',
          class_name: classMap.get(key)?.name ?? buildClassName(item),
          start_time: item.start_time ?? item.period_start_time ?? null,
          end_time:   item.end_time   ?? item.period_end_time   ?? null,
          student_count: statsMap.get(key) ?? (myClassResult && key === myClassResult.id ? myClassResult.total : 0),
        };
      });

      setMyClass(myClassResult);
      setAssignedClasses(assignedWithStats);
      setTodaySchedule(todayFormatted);
      setTotalClasses((myClassResult ? 1 : 0) + assignedWithStats.length);
      setStats({ myStudents: myClassResult?.total ?? 0, todayClasses: todayList.length, subjects: subjectSet.size });
      setActivities(buildActivities(myClassResult, assignedWithStats));
    } catch (err) {
      console.error(err);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) { navigate('/login'); return; }
    load();
  }, [currentUser, authLoading, load]);

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
    toast.success('Dashboard refreshed');
  }, [load]);

  // ── Derived values ─────────────────────────────────────────
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const quickActions = useMemo(() => [
    { href: '/teacher/face-attendance',   icon: Camera,       label: 'Face Attend',   desc: 'AI-powered',     badge: 'AI',  color: 'bg-violet-600' },
    { href: '/teacher/face-registration', icon: UserPlus,     label: 'Face Register', desc: 'Enrol students', badge: null,  color: 'bg-sky-500'    },
    { href: '/teacher/attendance',        icon: CheckSquare,  label: 'Manual Mark',   desc: 'Classic method', badge: null,  color: 'bg-emerald-600'},
    { href: '/teacher/students',          icon: Users,        label: 'Students',      desc: 'Full roster',    badge: null,  color: 'bg-indigo-600' },
    { href: '/teacher/reports',           icon: PieChart,     label: 'Reports',       desc: 'Analytics',      badge: 'New', color: 'bg-rose-500'   },
    { href: '/teacher/my-timetable',      icon: CalendarDays, label: 'Timetable',     desc: 'Weekly view',    badge: null,  color: 'bg-amber-500'  },
    { href: '/teacher/performance',       icon: BarChart3,    label: 'Performance',   desc: 'My analytics',   badge: null,  color: 'bg-teal-600'   },
  ], []);

  if (authLoading) {
    return (
      <TeacherLayout>
        <div className="space-y-5">
          <Skeleton className="h-10 w-56 rounded-xl bg-gray-100" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl bg-gray-100" />)}
          </div>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-5">

        {/* ── Page Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {greeting}, {currentUser?.full_name?.split(' ')[0] ?? 'Professor'} 👋
            </h1>
            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {todayName} · {todayDate}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={refreshData}
              disabled={refreshing}
              className="h-9 px-3 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-all disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline text-xs font-medium">Refresh</span>
            </button>
            <div className="h-9 px-3 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white">
              <Shield className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide hidden sm:inline">Faculty</span>
            </div>
          </div>
        </div>

        {/* ── Metrics ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Total Classes"   value={totalClasses}       icon={BookOpen}      iconBg="bg-violet-50"  iconColor="text-violet-600"  loading={loading} subtitle="assigned" />
          <MetricCard label="My Students"     value={stats.myStudents}   icon={Users}         iconBg="bg-sky-50"     iconColor="text-sky-600"     loading={loading} subtitle="homeroom" />
          <MetricCard label="Today's Classes" value={stats.todayClasses} icon={CalendarDays}  iconBg="bg-emerald-50" iconColor="text-emerald-600" loading={loading} subtitle="scheduled" />
          <MetricCard label="Subjects"        value={stats.subjects}     icon={GraduationCap} iconBg="bg-amber-50"   iconColor="text-amber-600"   loading={loading} subtitle="teaching" />
        </div>

        {/* ── Main Grid ── */}
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Left: Courses */}
          <div className="lg:col-span-2 space-y-5">

            {/* Homeroom */}
            {!loading && myClass && (
              <div>
                <SectionHeader title="My Primary Class" badge="Homeroom" />
                <CourseCard cls={myClass} isHomeroom rank={0} />
              </div>
            )}

            {/* Teaching assignments */}
            {!loading && assignedClasses.length > 0 && (
              <div>
                <SectionHeader title="Teaching Assignments" badge={`${assignedClasses.length} courses`} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {assignedClasses.map((cls, idx) => (
                    <CourseCard key={cls.id} cls={cls} isHomeroom={false} rank={idx + 1} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!loading && !myClass && assignedClasses.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
                <GraduationCap className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                <p className="font-semibold text-gray-400 text-sm">No classes assigned yet</p>
                <p className="text-xs text-gray-300 mt-1">Your courses will appear here once configured</p>
              </div>
            )}

            {/* Loading skeleton */}
            {loading && (
              <div className="space-y-3">
                {[1,2].map(i => <Skeleton key={i} className="h-44 rounded-xl bg-gray-100" />)}
              </div>
            )}
          </div>

          {/* Right: Schedule + Activity */}
          <div className="space-y-5">
            {loading ? (
              <RightColSkeleton />
            ) : (
              <>
                {/* Today's schedule */}
                <div>
                  <SectionHeader title="Today's Lectures" badge={`${todaySchedule.length} periods`} />
                  {todaySchedule.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-100 py-12 text-center">
                      <div className="text-3xl mb-2">📭</div>
                      <p className="font-semibold text-gray-400 text-sm">No lectures today</p>
                      <p className="text-xs text-gray-300 mt-1">Enjoy your day!</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-0.5">
                      {todaySchedule.map((cls, i) => (
                        <ScheduleItem key={cls.id} cls={cls} index={i} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Activity feed */}
                <div>
                  <SectionHeader title="Recent Activity" badge="Live" />
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <ActivityFeed activities={activities} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Quick Actions ── */}
        <div>
          <SectionHeader title="Quick Actions" />
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {quickActions.map((a) => (
              <QuickAction key={a.href} {...a} />
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-gray-300" />
            <span>
              Signed in as <span className="font-medium text-gray-600">{currentUser?.full_name ?? 'Teacher'}</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-semibold border border-indigo-100 text-[10px] uppercase tracking-wide">Faculty</span>
          </div>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-green-400 rounded-full animate-pulse" />
            ETAM · Education &amp; Attendance Management
          </span>
        </div>
      </div>
    </TeacherLayout>
  );
}