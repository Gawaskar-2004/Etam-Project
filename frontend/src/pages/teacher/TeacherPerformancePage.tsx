import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import TeacherLayout from '@/components/layouts/TeacherLayout';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Trophy, RefreshCw, CalendarDays, AlertTriangle,
  ArrowLeft, Users, School,
  CheckSquare, AlertCircle, Info, GraduationCap,
  ChevronRight, Shield,
} from 'lucide-react';
import { timetableApi, attendanceApi, staffApi } from '@/lib/api';
import { toast } from 'sonner';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const startOfWeek = () => {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

const SUBJECT_ICONS: Record<number, string> = {
  0: '📖', 1: '🧪', 2: '🔢', 3: '🌍', 4: '✏️', 5: '🎵', 6: '🎨', 7: '🌐',
};

const SUBJECT_COLORS = [
  '#4F46E5', '#059669', '#D97706', '#3B82F6',
  '#EC4899', '#8B5CF6', '#F97316', '#06B6D4',
];

// ─── Filter Chip ──────────────────────────────────────────────────────────────
function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all duration-150 ${
        active
          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
          : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600'
      }`}
    >
      {label}
    </button>
  );
}

// ─── Section Label ────────────────────────────────────────────────────────────
function SectionLabel({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="w-1 h-5 rounded-full bg-indigo-500" />
      <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{title}</span>
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, icon: Icon, iconBg, iconColor, sub }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-400">{label}</span>
        <div className={`p-2 rounded-lg ${iconBg}`}>
          <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, color, height = 6 }: { value: number; color?: string; height?: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const c = color || (pct >= 80 ? '#059669' : pct >= 60 ? '#D97706' : '#EF4444');
  return (
    <div className="w-full bg-gray-100 rounded-full overflow-hidden" style={{ height }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: c }}
      />
    </div>
  );
}

// ─── Subject Row ──────────────────────────────────────────────────────────────
function SubjectRow({ name, classes, avg, color, emoji, totalStudents }: any) {
  const badge =
    avg >= 80
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : avg >= 65
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-rose-100 text-rose-700 border-rose-200';
  const barColor = avg >= 80 ? '#10b981' : avg >= 65 ? '#f59e0b' : '#ef4444';

  return (
    <div className="py-4 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-lg bg-gray-50"
          style={{ border: `1px solid ${color}20` }}
        >
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-sm font-semibold text-gray-800 truncate">{name}</p>
            <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badge}`}>
              {avg}%
            </span>
          </div>
          <p className="text-[11px] text-gray-400 mb-2">
            {classes} sessions{totalStudents ? ` · ${totalStudents} students` : ''}
          </p>
          <ProgressBar value={avg} color={barColor} />
        </div>
      </div>
      {avg < 65 && classes > 0 && (
        <div className="flex items-center gap-2 mt-2.5 bg-rose-50 px-3 py-2 rounded-lg border border-rose-200">
          <AlertTriangle className="h-3 w-3 text-rose-600 shrink-0" />
          <p className="text-[11px] text-rose-700 font-semibold">Below 65% threshold — needs improvement</p>
        </div>
      )}
      {classes === 0 && (
        <div className="flex items-center gap-2 mt-2.5 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
          <Info className="h-3 w-3 text-gray-400 shrink-0" />
          <p className="text-[11px] text-gray-500 font-semibold">No sessions recorded yet</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TeacherPerformancePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const currentUser = user || profile;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('This Week');
  const [perf, setPerf] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentUser?.id) return;
    setError(null);

    try {
      // ── STEP 1: Resolve this teacher's staff record using their user account id.
      // staffApi.list() returns all staff in the institution.
      // We match by user_id field (the FK linking staff → auth user).
      let myStaffId: string | null = null;
      let mySubcatIds: string[] = [];

      try {
        const staffRaw = await staffApi.list();
        const staffList: any[] = Array.isArray(staffRaw)
          ? staffRaw
          : staffRaw?.staff || staffRaw?.data || [];

        // Find the staff record whose user_id matches the logged-in user
        const myStaffRecord = staffList.find(
          s =>
            String(s.user_id) === String(currentUser.id) ||
            String(s.auth_user_id) === String(currentUser.id) ||
            String(s.id) === String(currentUser.id)
        );

        if (myStaffRecord) {
          myStaffId = String(myStaffRecord.id);
        }
      } catch {
        // If staff lookup fails, fall through — we'll filter by user_id param
      }

      // ── STEP 2: Get timetable assignments for THIS teacher only.
      // Pass user_id so the backend returns only this teacher's assignments.
      // Also pass staff_id if we resolved it above.
      const params: Record<string, string> = {
        user_id: String(currentUser.id),
      };
      if (myStaffId) params.staff_id = myStaffId;

      const ttRaw = await timetableApi.getAssignments(params).catch(() => []);
      const allAssignments: any[] = Array.isArray(ttRaw)
        ? ttRaw
        : ttRaw?.assignments || ttRaw?.data || [];

      // ── STEP 3: If assignments came back with staff_id on each row,
      // filter client-side to be absolutely sure we only see our own.
      const myAssignments = allAssignments.filter(a => {
        if (myStaffId && a.staff_id) {
          return String(a.staff_id) === myStaffId;
        }
        if (a.user_id) {
          return String(a.user_id) === String(currentUser.id);
        }
        // No staff identifier on row — include it (backend already filtered)
        return true;
      });

      mySubcatIds = [
        ...new Set(myAssignments.map((a: any) => a.subcategory_id).filter(Boolean)),
      ] as string[];

      // ── STEP 4: Date range from filter
      let rangeStart: string, rangeEnd: string;
      if (activeFilter === 'Today') {
        rangeStart = rangeEnd = todayStr();
      } else if (activeFilter === 'This Week') {
        rangeStart = startOfWeek().toISOString().split('T')[0];
        rangeEnd = todayStr();
      } else if (activeFilter === 'This Month') {
        rangeStart = startOfMonth().toISOString().split('T')[0];
        rangeEnd = todayStr();
      } else {
        // This Semester — last 4 months
        const d = new Date();
        d.setMonth(d.getMonth() - 4);
        rangeStart = d.toISOString().split('T')[0];
        rangeEnd = todayStr();
      }

      // Days of week that fall in the range
      const daysInRange = new Set<string>();
      const cur = new Date(rangeStart);
      while (cur <= new Date(rangeEnd)) {
        daysInRange.add(DAYS[cur.getDay()]);
        cur.setDate(cur.getDate() + 1);
      }
      const scheduledInRange = myAssignments.filter(a =>
        daysInRange.has(a.day?.toUpperCase?.() || a.day)
      );

      // Full date list for session fetching
      const dateList: string[] = [];
      const d2 = new Date(rangeStart);
      while (d2 <= new Date(rangeEnd)) {
        dateList.push(d2.toISOString().split('T')[0]);
        d2.setDate(d2.getDate() + 1);
      }

      // ── STEP 5: Fetch sessions only for THIS teacher's subcategories.
      // Pass staff_id / user_id on each session fetch so backend filters too.
      const sessionFetches: Promise<any[]>[] = [];
      for (const date of dateList) {
        for (const scId of mySubcatIds) {
          const sessParams: Record<string, string> = {
            date,
            subcategory_id: String(scId),
          };
          if (myStaffId) sessParams.staff_id = myStaffId;
          sessParams.user_id = String(currentUser.id);

          sessionFetches.push(
            attendanceApi
              .getSessions(sessParams)
              .then((d: any) => {
                const list = Array.isArray(d) ? d : d?.sessions || d?.data || [];
                return list.map((s: any) => ({ ...s, _date: date }));
              })
              .catch(() => [])
          );
        }
      }
      const allSessions = (await Promise.all(sessionFetches)).flat();

      // ── STEP 6: Client-side guard — keep only sessions created by this teacher.
      // Sessions have created_by / staff_id / user_id depending on your backend.
      const mySessions = allSessions.filter(s => {
        if (myStaffId && s.staff_id) return String(s.staff_id) === myStaffId;
        if (s.created_by) return String(s.created_by) === String(currentUser.id);
        if (s.user_id) return String(s.user_id) === String(currentUser.id);
        // If no identifier, include (backend already filtered by subcategory)
        return true;
      });

      // ── STEP 7: Fetch records for each session
      const allRecordsArr = await Promise.all(
        mySessions.map(sess =>
          attendanceApi
            .getRecords(sess.id)
            .then((d: any) => ({
              sessId: sess.id,
              subcatId: sess.subcategory_id,
              records: Array.isArray(d) ? d : d?.records || d?.data || [],
            }))
            .catch(() => ({ sessId: sess.id, subcatId: sess.subcategory_id, records: [] }))
        )
      );
      const recordsBySessId: Record<string, any[]> = {};
      allRecordsArr.forEach(r => { recordsBySessId[r.sessId] = r.records; });

      // ── STEP 8: Today's summary
      const todayKey = DAYS[new Date().getDay()];
      const todayScheduled = myAssignments.filter(
        a => (a.day?.toUpperCase?.() || a.day) === todayKey
      );
      const todaySessions = mySessions.filter(s => s._date === todayStr());
      const completedToday = todaySessions.length;
      const remainingToday = Math.max(0, todayScheduled.length - completedToday);
      const todayPct =
        todayScheduled.length > 0
          ? Math.round((completedToday / todayScheduled.length) * 100)
          : 0;

      // ── STEP 9: Attendance totals across range
      let totalPresent = 0, totalStudentsInRecords = 0;
      mySessions.forEach(sess => {
        const records = recordsBySessId[sess.id] || [];
        totalPresent += records.filter((r: any) => r.status === 'present').length;
        totalStudentsInRecords += records.length;
      });
      const avgAttendance =
        totalStudentsInRecords > 0
          ? Math.round((totalPresent / totalStudentsInRecords) * 100)
          : 0;
      const markedPct =
        scheduledInRange.length > 0
          ? Math.min(100, Math.round((mySessions.length / scheduledInRange.length) * 100))
          : 0;
      const pendingSessions = Math.max(0, scheduledInRange.length - mySessions.length);

      // ── STEP 10: Performance score
      const score = Math.round(markedPct * 0.4 + avgAttendance * 0.4 + todayPct * 0.2);
      const scoreLabel =
        score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 55 ? 'Average' : 'Needs Improvement';
      const scoreColor =
        score >= 85 ? '#10b981' : score >= 70 ? '#6366f1' : score >= 55 ? '#f59e0b' : '#ef4444';

      // ── STEP 11: Subject breakdown — only from THIS teacher's assignments
      const subjectMap: Record<string, any> = {};
      myAssignments.forEach(a => {
        if (!a.subject_id) return;
        if (!subjectMap[a.subject_id]) {
          subjectMap[a.subject_id] = {
            name: a.subject_name || `Subject ${a.subject_id}`,
            sessionCount: 0,
            totalPct: 0,
            totalStudents: 0,
          };
        }
      });
      mySessions.forEach(sess => {
        const records = recordsBySessId[sess.id] || [];
        const present = records.filter((r: any) => r.status === 'present').length;
        const total = records.length;
        if (total === 0) return;
        const pct = Math.round((present / total) * 100);
        const match = myAssignments.find(
          a =>
            String(a.subcategory_id) === String(sess.subcategory_id) &&
            (a.period_id ? String(a.period_id) === String(sess.period_id) : true)
        );
        const sid = match?.subject_id;
        if (sid && subjectMap[sid]) {
          subjectMap[sid].totalPct += pct;
          subjectMap[sid].sessionCount++;
          subjectMap[sid].totalStudents = Math.max(subjectMap[sid].totalStudents, total);
        }
      });
      const subjects = Object.values(subjectMap).map((s: any, i) => ({
        name: s.name,
        classes: s.sessionCount,
        avg: s.sessionCount > 0 ? Math.round(s.totalPct / s.sessionCount) : 0,
        emoji: SUBJECT_ICONS[i % 8],
        color: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
        totalStudents: s.totalStudents,
      }));

      // Unique students touched by this teacher in this period
      const uniqueStudentIds = new Set<string>();
      allRecordsArr.forEach(({ records }) => {
        records.forEach((r: any) => {
          if (r.student_id) uniqueStudentIds.add(String(r.student_id));
        });
      });

      setPerf({
        classesTaken: mySessions.length,
        markedPct,
        avgAttendance,
        pendingSessions,
        totalStudents: uniqueStudentIds.size || totalStudentsInRecords,
        score,
        scoreLabel,
        scoreColor,
        scheduledToday: todayScheduled.length,
        completedToday,
        remainingToday,
        todayPct,
        subjects,
        myStaffId, // for debug if needed
      });
    } catch (err: any) {
      console.error('TeacherPerformancePage error:', err);
      setError(err?.message || 'Failed to load performance data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter, currentUser?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) { navigate('/login'); return; }
    setLoading(true);
    fetchData();
  }, [fetchData, authLoading]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    toast.success('Performance data refreshed');
  };

  const date = new Date().toISOString().split('T')[0];
  const filters = ['Today', 'This Week', 'This Month', 'This Semester'];

  // ── Loading skeleton
  if (authLoading || (loading && !perf)) {
    return (
      <TeacherLayout>
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <Skeleton className="h-7 w-48 bg-gray-100 rounded" />
              <Skeleton className="h-4 w-32 mt-2 bg-gray-100 rounded" />
            </div>
            <Skeleton className="h-9 w-9 rounded-lg bg-gray-100" />
          </div>
          <div className="flex gap-2">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-24 rounded-full bg-gray-100" />)}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-24 rounded-xl bg-gray-100" />)}
          </div>
          <Skeleton className="h-40 rounded-xl bg-gray-100" />
          <Skeleton className="h-64 rounded-xl bg-gray-100" />
        </div>
      </TeacherLayout>
    );
  }

  // ── Error state
  if (error) {
    return (
      <TeacherLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Link to="/teacher/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Performance</h1>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
            <p className="text-base font-bold text-gray-800 mb-2">Could not load data</p>
            <p className="text-sm text-gray-500 mb-6">{error}</p>
            <button
              onClick={() => { setLoading(true); fetchData(); }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-6">

        {/* ── HEADER ── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Link to="/teacher/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h1 className="text-xl font-bold text-gray-900">Performance</h1>
            </div>
            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Attendance analytics & insights · {date}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-all"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* ── FILTER CHIPS ── */}
        <div className="flex gap-2 flex-wrap">
          {filters.map(f => (
            <FilterChip key={f} label={f} active={activeFilter === f} onClick={() => setActiveFilter(f)} />
          ))}
        </div>

        {/* ── METRIC CARDS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard
            label="Sessions Taken"
            value={perf?.classesTaken ?? 0}
            icon={School}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-600"
          />
          <MetricCard
            label="Marked %"
            value={`${perf?.markedPct ?? 0}%`}
            icon={CheckSquare}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
          />
          <MetricCard
            label="Avg Attendance"
            value={`${perf?.avgAttendance ?? 0}%`}
            icon={Users}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
          />
          <MetricCard
            label="Pending"
            value={perf?.pendingSessions ?? 0}
            icon={AlertCircle}
            iconBg="bg-rose-50"
            iconColor="text-rose-600"
          />
          <MetricCard
            label="Total Students"
            value={perf?.totalStudents ?? 0}
            icon={GraduationCap}
            iconBg="bg-purple-50"
            iconColor="text-purple-600"
          />
          {/* Score card */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-400">Perf Score</span>
              <div className="p-2 rounded-lg bg-indigo-50">
                <Trophy className="h-3.5 w-3.5 text-indigo-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 tabular-nums">
              {perf?.score ?? 0}
              <span className="text-sm font-normal text-gray-400">/100</span>
            </p>
            <p className="text-xs mt-1 font-semibold" style={{ color: perf?.scoreColor }}>
              {perf?.scoreLabel}
            </p>
          </div>
        </div>

        {/* ── TODAY'S SUMMARY ── */}
        <div className="space-y-3">
          <SectionLabel title="Today's Summary" />
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-indigo-50">
                <CalendarDays className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Today's Schedule</h3>
                <p className="text-xs text-gray-400">{date}</p>
              </div>
              <Link
                to="/teacher/attendance"
                className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[11px] font-semibold transition-colors"
              >
                Mark Attendance <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="grid grid-cols-3 divide-x divide-gray-100 mb-4">
              {[
                { val: perf?.scheduledToday ?? 0, label: 'Scheduled', color: '#6366f1' },
                { val: perf?.completedToday ?? 0, label: 'Completed', color: '#10b981' },
                { val: perf?.remainingToday ?? 0, label: 'Remaining', color: '#ef4444' },
              ].map(s => (
                <div key={s.label} className="flex flex-col items-center py-2">
                  <p className="text-2xl font-bold" style={{ color: s.color }}>{s.val}</p>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-between text-xs font-medium text-gray-500 mb-1.5">
              <span>Today's Progress</span>
              <span className="text-indigo-600 font-bold">{perf?.todayPct ?? 0}%</span>
            </div>
            <ProgressBar value={perf?.todayPct ?? 0} color="#6366f1" height={8} />

            {(perf?.scheduledToday ?? 0) === 0 && (
              <p className="text-center text-xs text-gray-400 mt-3 font-medium">
                No classes scheduled for today
              </p>
            )}
          </div>
        </div>

        {/* ── SUBJECT-WISE PERFORMANCE ── */}
        {(perf?.subjects?.length ?? 0) > 0 && (
          <div className="space-y-3">
            <SectionLabel title="Subject-wise Performance" />

            {(() => {
              const sorted = [...(perf.subjects as any[])].sort((a, b) => b.avg - a.avg);
              const best = sorted[0];
              const worst = sorted[sorted.length - 1];
              if (!best || !worst || best.name === worst.name) return null;
              return (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                    <p className="text-[10px] font-bold text-emerald-700 mb-1">★ Best Subject</p>
                    <p className="text-sm font-bold text-emerald-800 truncate">{best.name}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">{best.avg}% avg</p>
                  </div>
                  <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
                    <p className="text-[10px] font-bold text-rose-700 mb-1">⚠ Needs Focus</p>
                    <p className="text-sm font-bold text-rose-800 truncate">{worst.name}</p>
                    <p className="text-xs text-rose-600 mt-0.5">{worst.avg}% avg</p>
                  </div>
                </div>
              );
            })()}

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">Subject Breakdown</h3>
                <p className="text-xs text-gray-400">{perf.subjects.length} subjects assigned</p>
              </div>
              <div className="px-4">
                {perf.subjects.map((s: any, i: number) => (
                  <SubjectRow key={i} {...s} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── EMPTY STATE ── */}
        {perf?.classesTaken === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 py-14 text-center">
            <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center">
              <School className="h-7 w-7 text-gray-300" />
            </div>
            <p className="font-semibold text-gray-400">No sessions recorded</p>
            <p className="text-xs text-gray-300 mt-1">Mark attendance to start seeing performance data.</p>
            <Link
              to="/teacher/attendance"
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Mark Attendance <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-gray-300" />
            <span>
              Institution ID:{' '}
              <span className="font-semibold text-gray-600">
                {currentUser?.institution_id?.slice(0, 8) || '—'}…
              </span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold border border-emerald-200 text-[10px] uppercase tracking-wide">
              Live
            </span>
          </div>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" />
            ETAM · Education & Attendance Management
          </span>
        </div>

      </div>
    </TeacherLayout>
  );
}