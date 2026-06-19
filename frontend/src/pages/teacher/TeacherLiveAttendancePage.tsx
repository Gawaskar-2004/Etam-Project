import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { attendanceApi, timetableApi, studentsApi } from '@/lib/api';
import TeacherLayout from '@/components/layouts/TeacherLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  CheckCircle, XCircle, AlertCircle,
  Users, TrendingUp, RefreshCw, Activity, GraduationCap, Shield, CalendarDays
} from 'lucide-react';

// ─── Metric Card ──────────────────────────────────────────────────────────
function MetricCard({ label, value, icon: Icon, iconBg, iconColor, subtitle, loading }: any) {
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
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

// ─── Class Card ───────────────────────────────────────────────────────────
function ClassCard({ cls, isSelected, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`group bg-white rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden text-left w-full ${
        isSelected ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-100'
      }`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-lg bg-indigo-50 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm leading-tight">{cls.name}</p>
              {cls.item_name && (
                <p className="text-[10px] text-gray-400 mt-0.5">Section {cls.item_name}</p>
              )}
            </div>
          </div>
          {isSelected && <CheckCircle className="h-5 w-5 text-indigo-600 shrink-0" />}
        </div>
      </div>
    </button>
  );
}

// ─── Helper for initials ──────────────────────────────────────────────────
const initials = (name: string) =>
  name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

// ─── Status Badge ─────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'present':
      return <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle className="h-3 w-3" />Present</span>;
    case 'absent':
      return <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border bg-rose-50 text-rose-700 border-rose-200"><XCircle className="h-3 w-3" />Absent</span>;
    default:
      return <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border bg-gray-50 text-gray-500 border-gray-200"><AlertCircle className="h-3 w-3" />Not Marked</span>;
  }
}

export default function TeacherLiveAttendancePage() {
  const { user, profile } = useAuth();
  const currentUser = user || profile;

  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const date = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (currentUser?.id) loadClasses();
  }, [currentUser?.id]);

  useEffect(() => {
    if (!selectedClass || !autoRefresh) return;
    const interval = setInterval(() => {
      fetchAttendance(selectedClass);
      setLastRefresh(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedClass, autoRefresh]);

  const loadClasses = async () => {
    try {
      const data = await timetableApi.getAssignments({ user_id: currentUser!.id });
      const assignments = Array.isArray(data) ? data : (data?.assignments || []);

      const map = new Map<string, any>();
      assignments.forEach((item: any) => {
        const classKey = `${item.subcategory_id || 'none'}_${item.item_id || 'none'}`;
        if (!map.has(classKey)) {
          let className = '';
          if (item.category_name && item.subcategory_name && item.item_name) {
            className = `${item.category_name} ${item.subcategory_name} ${item.item_name}`;
          } else if (item.subcategory_name && item.item_name) {
            className = `${item.subcategory_name} ${item.item_name}`;
          } else if (item.subcategory_name) {
            className = item.subcategory_name;
          } else if (item.item_name) {
            className = `Section ${item.item_name}`;
          } else {
            className = item.class_name || 'Class';
          }
          map.set(classKey, {
            id: classKey,
            category_id: item.category_id,
            subcategory_id: item.subcategory_id,
            item_id: item.item_id,
            name: className,
            item_name: item.item_name,
          });
        }
      });
      setClasses(Array.from(map.values()));
    } catch (error) {
      console.error('Failed to load classes:', error);
    }
  };

  const selectClass = async (cls: any) => {
    setSelectedClass(cls);
    setLoading(true);
    try {
      const raw = await studentsApi.list({
        subcategory_id: cls.subcategory_id,
        item_id: cls.item_id || undefined
      });
      setStudents(Array.isArray(raw) ? raw : (raw?.students || []));
      await fetchAttendance(cls);
    } catch (error) {
      console.error('Failed to load students:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async (cls: any) => {
    try {
      const sessionsRaw = await attendanceApi.getSessions({
        date,
        subcategory_id: cls.subcategory_id,
        category_id: cls.category_id,
        item_id: cls.item_id || undefined
      });
      const sessions = sessionsRaw?.sessions || sessionsRaw || [];
      if (!sessions.length) {
        setAttendanceMap({});
        return;
      }

      const map: Record<string, string> = {};
      await Promise.all(sessions.map(async (session: any) => {
        try {
          const recordsRaw = await attendanceApi.getRecords(session.id);
          const records = recordsRaw?.records || recordsRaw || [];
          records.forEach((r: any) => {
            map[r.student_id] = r.status;
          });
        } catch (err) {
          console.error('Failed to fetch records:', err);
        }
      }));
      setAttendanceMap(map);
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
    }
  };

  const handleRefresh = () => {
    if (selectedClass) {
      fetchAttendance(selectedClass);
      setLastRefresh(new Date());
    }
  };

  // Stats (late removed)
  const total = students.length;
  const present = students.filter(s => attendanceMap[s.id] === 'present').length;
  const absent = students.filter(s => attendanceMap[s.id] === 'absent').length;
  const notMarked = total - present - absent;
  const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : '0';
  const pctNum = parseFloat(percentage);

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* ── PAGE HEADER ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Live Attendance</h1>
            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Real‑time attendance for your classes · {date}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-xs text-gray-500">{autoRefresh ? 'Auto refresh ON' : 'Paused'}</span>
            </div>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="h-9 px-3 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-all"
            >
              {autoRefresh ? 'Pause' : 'Resume'}
            </button>
            <button
              onClick={handleRefresh}
              disabled={!selectedClass}
              className="h-9 px-3 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-all disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Refresh</span>
            </button>
            <div className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500">
              <Shield className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* ── AUTO-REFRESH STATUS CARD ── */}
        {selectedClass && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-xs text-gray-500">
                {autoRefresh ? 'Auto-refreshing every 30 seconds' : 'Auto-refresh paused'}
              </span>
            </div>
            <span className="text-xs text-gray-400">Last refresh: {lastRefresh.toLocaleTimeString()}</span>
          </div>
        )}

        {/* ── CLASS SELECTION ── */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-indigo-500" />
            Select Class
          </h2>
          {classes.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
              <GraduationCap className="h-12 w-12 mx-auto text-gray-200 mb-3" />
              <p className="font-medium text-gray-400">No classes assigned</p>
              <p className="text-xs text-gray-300 mt-1">Ask admin to set up your timetable</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {classes.map((cls) => (
                <ClassCard
                  key={cls.id}
                  cls={cls}
                  isSelected={selectedClass?.id === cls.id}
                  onClick={() => selectClass(cls)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── STATS & STUDENT TABLE ── */}
        {selectedClass && (
          <>
            {/* Metric Cards — 5 columns (Late removed) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <MetricCard
                label="Total Students"
                value={total}
                icon={Users}
                iconBg="bg-indigo-50"
                iconColor="text-indigo-600"
              />
              <MetricCard
                label="Present"
                value={present}
                icon={CheckCircle}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
              />
              <MetricCard
                label="Absent"
                value={absent}
                icon={XCircle}
                iconBg="bg-rose-50"
                iconColor="text-rose-600"
              />
              <MetricCard
                label="Not Marked"
                value={notMarked}
                icon={AlertCircle}
                iconBg="bg-gray-50"
                iconColor="text-gray-500"
              />
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-400">Attendance %</span>
                  <div className={`p-2 rounded-lg ${pctNum >= 75 ? 'bg-emerald-50' : pctNum >= 50 ? 'bg-amber-50' : 'bg-rose-50'}`}>
                    <TrendingUp className={`h-3.5 w-3.5 ${pctNum >= 75 ? 'text-emerald-600' : pctNum >= 50 ? 'text-amber-600' : 'text-rose-600'}`} />
                  </div>
                </div>
                <p className={`text-2xl font-bold tabular-nums ${pctNum >= 75 ? 'text-emerald-600' : pctNum >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{percentage}%</p>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${pctNum >= 75 ? 'bg-emerald-500' : pctNum >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Progress Details */}
            {total > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Present: <strong className="text-gray-800">{present}</strong></span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Absent: <strong className="text-gray-800">{absent}</strong></span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-400" /> Not Marked: <strong className="text-gray-800">{notMarked}</strong></span>
                </div>
              </div>
            )}

            {/* Student Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">Live Attendance — {selectedClass.name}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{date} · {students.length} students enrolled</p>
                </div>
                {students.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                      <CheckCircle className="h-3 w-3" /> {present} Present
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                      <XCircle className="h-3 w-3" /> {absent} Absent
                    </span>
                  </div>
                )}
              </div>

              {loading ? (
                <div className="p-5 space-y-3">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg bg-gray-100" />)}
                </div>
              ) : students.length === 0 ? (
                <div className="py-16 text-center">
                  <Users className="h-12 w-12 mx-auto text-gray-200 mb-3" />
                  <p className="font-medium text-gray-400">No students found</p>
                  <p className="text-xs text-gray-300 mt-1">No students enrolled in this class</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50/60 border-b border-gray-100">
                      <tr>
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Student</th>
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Register Number</th>
                        <th className="text-left p-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {students.map(student => {
                        const status = attendanceMap[student.id] || 'not_marked';
                        const isPresent = status === 'present';
                        const isAbsent = status === 'absent';
                        return (
                          <tr
                            key={student.id}
                            className={`transition-colors ${isPresent ? 'bg-emerald-50/20 hover:bg-emerald-50/40' : isAbsent ? 'bg-rose-50/20 hover:bg-rose-50/40' : 'hover:bg-gray-50'}`}
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold shadow-sm ${
                                  isPresent ? 'bg-emerald-100 text-emerald-700' : isAbsent ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {initials(student.full_name)}
                                </div>
                                <span className="font-medium text-gray-800 text-sm">{student.full_name}</span>
                              </div>
                            </td>
                            <td className="p-4 font-mono text-sm text-gray-400">
                              {student.register_number || '—'}
                            </td>
                            <td className="p-4">
                              <StatusBadge status={status} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* No class selected placeholder */}
        {!selectedClass && classes.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 py-20 text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
              <Activity className="h-8 w-8 text-gray-300" />
            </div>
            <p className="font-medium text-gray-400">Select a class above</p>
            <p className="text-xs text-gray-300 mt-1">Choose a class to view live attendance</p>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-gray-300" />
            <span>
              Institution ID:{' '}
              <span className="font-semibold text-gray-600">{currentUser?.institution_id?.slice(0, 8) || '—'}…</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-bold border border-indigo-100 text-[10px] uppercase tracking-wide">
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