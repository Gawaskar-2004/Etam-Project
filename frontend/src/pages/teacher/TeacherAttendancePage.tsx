import { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import TeacherLayout from '@/components/layouts/TeacherLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { timetableApi, studentsApi, attendanceApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  Calendar, Users, CheckCircle, XCircle, Save,
  GraduationCap, Search, Clock, BookOpen,
  ArrowLeft, ChevronRight, ListChecks, RefreshCw, Shield, CalendarDays,
  AlertTriangle, RotateCcw,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const TODAY = DAYS[new Date().getDay()];

const PERIOD_PALETTE = [
  { gradStart: '#4F46E5', gradEnd: '#7C3AED', bg: '#EEF2FF', border: '#C7D2FE', text: '#4338CA', accent: '#4F46E5' },
  { gradStart: '#059669', gradEnd: '#047857', bg: '#ECFDF5', border: '#6EE7B7', text: '#065F46', accent: '#059669' },
  { gradStart: '#D97706', gradEnd: '#B45309', bg: '#FEF3C7', border: '#FCD34D', text: '#92400E', accent: '#D97706' },
  { gradStart: '#DB2777', gradEnd: '#BE185D', bg: '#FDF2F8', border: '#F9A8D4', text: '#9D174D', accent: '#DB2777' },
  { gradStart: '#EA580C', gradEnd: '#C2410C', bg: '#FFF7ED', border: '#FDBA74', text: '#9A3412', accent: '#EA580C' },
  { gradStart: '#2563EB', gradEnd: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', accent: '#2563EB' },
  { gradStart: '#7C3AED', gradEnd: '#6D28D9', bg: '#F5F3FF', border: '#C4B5FD', text: '#5B21B6', accent: '#7C3AED' },
  { gradStart: '#0891B2', gradEnd: '#0E7490', bg: '#ECFEFF', border: '#A5F3FC', text: '#155E75', accent: '#0891B2' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const initials = (name: string) =>
  name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

const formatTo12Hour = (time24: string) => {
  if (!time24) return '';
  const [hour, minute] = time24.split(':');
  let h = parseInt(hour, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${minute} ${ampm}`;
};

const todayDateStr = () => new Date().toISOString().split('T')[0];
const yesterdayDateStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};
const dayNameForDate = (dateStr: string) => {
  return DAYS[new Date(dateStr + 'T00:00:00').getDay()];
};

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function ClassCard({ cls, isSelected, onSelect, assignments, activeDay }: any) {
  const periodsToday = assignments.filter(
    (a: any) => a.subcategory_id === cls.subcategory_id && a.item_id === cls.item_id && a.day === activeDay
  ).length;
  const uniqueDays = new Set(
    assignments
      .filter((a: any) => a.subcategory_id === cls.subcategory_id && a.item_id === cls.item_id)
      .map((a: any) => a.day)
  ).size;

  return (
    <button
      onClick={() => onSelect(cls)}
      className={`group text-left bg-white rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${
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
              <p className="text-[10px] text-gray-400 mt-0.5">{cls.student_count ?? '—'} students</p>
            </div>
          </div>
          {isSelected && <CheckCircle className="h-5 w-5 text-indigo-600 shrink-0" />}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg py-2.5 text-center border border-gray-100">
            <p className="text-xl font-bold text-indigo-600">{periodsToday}</p>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Today</p>
          </div>
          <div className="bg-gray-50 rounded-lg py-2.5 text-center border border-gray-100">
            <p className="text-xl font-bold text-indigo-600">{uniqueDays}</p>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Days/Week</p>
          </div>
        </div>
      </div>
    </button>
  );
}

function PeriodCard({ period, isSelected, onSelect, hasSaved }: any) {
  const timeStr =
    period.start_time && period.end_time
      ? `${formatTo12Hour(period.start_time)} – ${formatTo12Hour(period.end_time)}`
      : null;
  const idx = (period.period_number - 1) % PERIOD_PALETTE.length;
  const cc = PERIOD_PALETTE[idx];

  return (
    <button
      onClick={() => onSelect(period)}
      className={`group w-full text-left bg-white rounded-lg border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${
        isSelected
          ? 'border-indigo-300 ring-1 ring-indigo-200'
          : hasSaved
          ? 'border-amber-300 ring-1 ring-amber-100'
          : 'border-gray-100'
      }`}
    >
      <div className="flex items-stretch">
        {/* colour accent strip */}
        <div className="w-1 shrink-0" style={{ background: `linear-gradient(to bottom, ${cc.gradStart}, ${cc.gradEnd})` }} />
        <div className="flex-1 p-4">
          <div className="flex items-center gap-3">
            <div
              className="h-12 w-12 rounded-lg flex flex-col items-center justify-center shrink-0 text-white"
              style={{ background: `linear-gradient(135deg, ${cc.gradStart}, ${cc.gradEnd})` }}
            >
              <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">P</span>
              <span className="text-lg font-black leading-none">{period.period_number}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 text-sm truncate leading-tight">
                {period.subject_name || `Period ${period.period_number}`}
              </p>
              {timeStr && (
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3 text-gray-400" />
                  <span className="text-xs font-medium text-gray-500">{timeStr}</span>
                </div>
              )}
            </div>
            {hasSaved && !isSelected && (
              <span className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700">
                <RotateCcw className="h-2.5 w-2.5" />
                Saved
              </span>
            )}
            {isSelected && <CheckCircle className="h-5 w-5 text-indigo-600 shrink-0" />}
          </div>
        </div>
      </div>
    </button>
  );
}

function StudentRow({ student, index, onToggle }: any) {
  const isChanged =
    student.originalPresent !== null &&
    student.originalPresent !== undefined &&
    student.present !== student.originalPresent;

  return (
    <button
      onClick={() => onToggle(student.id)}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors border-b border-gray-100 last:border-0 ${
        student.present ? 'hover:bg-emerald-50/40' : 'hover:bg-rose-50/40'
      }`}
    >
      <span className="text-xs font-bold text-gray-400 w-6 text-center shrink-0">{index + 1}</span>
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 ${
          student.present ? 'bg-emerald-500' : 'bg-rose-500'
        }`}
      >
        {initials(student.full_name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-gray-800 text-sm truncate">{student.full_name}</p>
          {isChanged && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[9px] font-bold text-amber-700">
              <RotateCcw className="h-2 w-2" />
              Updated
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[11px] text-gray-400">
            {student.register_number || student.registration_number || student.reg_no || student.roll_number || '—'}
          </p>
          {isChanged && student.originalPresent !== null && (
            <p className="text-[10px] text-gray-400">
              Was:{' '}
              <span className={`font-bold ${student.originalPresent ? 'text-emerald-600' : 'text-rose-600'}`}>
                {student.originalPresent ? 'Present' : 'Absent'}
              </span>
            </p>
          )}
        </div>
      </div>
      <div
        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold shrink-0 ${
          student.present ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
        }`}
      >
        {student.present ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
        {student.present ? 'P' : 'A'}
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TeacherAttendancePage() {
  const { user, profile } = useAuth();
  const currentUser = user || profile;

  // ── date mode (today / yesterday) ─────────────────────────────────────────
  const [dateMode, setDateMode] = useState<'today' | 'yesterday'>('today');
  const selectedDate = dateMode === 'yesterday' ? yesterdayDateStr() : todayDateStr();
  const activeDay = dayNameForDate(selectedDate);

  // ── wizard step ───────────────────────────────────────────────────────────
  const [step, setStep] = useState(1);

  // ── step-1 data ───────────────────────────────────────────────────────────
  const [classes, setClasses] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [selectedClass, setSelectedClass] = useState<any>(null);

  // ── step-2 (period selection) ─────────────────────────────────────────────
  const [selectedPeriodData, setSelectedPeriodData] = useState<any>(null);
  const [periodSavedMap, setPeriodSavedMap] = useState<Record<string, string>>({}); // periodKey → sessionId

  // ── step-3 (student marking) ──────────────────────────────────────────────
  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [existingSessionId, setExistingSessionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // ── derived counts ────────────────────────────────────────────────────────
  const presentCount = students.filter(s => s.present).length;
  const absentCount  = students.length - presentCount;
  const updatedCount = students.filter(
    s => s.originalPresent !== null && s.originalPresent !== undefined && s.present !== s.originalPresent
  ).length;
  const attendancePct = students.length > 0 ? Math.round((presentCount / students.length) * 100) : 0;
  const isUpdateMode  = !!existingSessionId;

  // ── periods for selected class on active day ───────────────────────────────
  const periodsForClass = useMemo(() => {
    if (!selectedClass) return [];
    return assignments
      .filter(
        (a: any) =>
          a.subcategory_id === selectedClass.subcategory_id &&
          a.item_id === selectedClass.item_id &&
          a.day === activeDay
      )
      .sort((a: any, b: any) => a.period_number - b.period_number);
  }, [selectedClass, assignments, activeDay]);

  // ── filtered students ──────────────────────────────────────────────────────
  const filteredStudents = useMemo(
    () =>
      students.filter(s => {
        const q = search.trim().toLowerCase();
        const matchSearch =
          !q ||
          (s.full_name || '').toLowerCase().includes(q) ||
          String(s.register_number || s.registration_number || s.reg_no || s.roll_number || '').toLowerCase().includes(q);
        const matchStatus =
          filterStatus === 'all' ||
          (filterStatus === 'present' && s.present) ||
          (filterStatus === 'absent' && !s.present);
        return matchSearch && matchStatus;
      }),
    [students, search, filterStatus]
  );

  // ── load classes on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (currentUser?.id) loadClasses();
  }, [currentUser?.id]);

  // ── reset period saved map when date mode or class changes ────────────────
  useEffect(() => {
    setPeriodSavedMap({});
  }, [dateMode, selectedClass]);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1 — Load classes
  // ─────────────────────────────────────────────────────────────────────────
  const loadClasses = async () => {
    try {
      setLoadingClasses(true);
      const data = await timetableApi.getAssignments({ user_id: currentUser.id });
      const all: any[] = Array.isArray(data) ? data : (data?.assignments || []);
      setAssignments(all);

      // Build unique class map
      const map = new Map<string, any>();
      all.forEach((item: any) => {
        const key = `${item.subcategory_id || 'none'}_${item.item_id || 'none'}`;
        if (!map.has(key)) {
          const name =
            item.full_class_name ||
            [item.category_name, item.subcategory_name, item.item_name].filter(Boolean).join(' ') ||
            'Class';
          map.set(key, {
            id: key,
            category_id:    item.category_id,
            subcategory_id: item.subcategory_id,
            item_id:        item.item_id,
            name,
            item_name: item.item_name,
          });
        }
      });

      // Fetch student counts in parallel
      const list = await Promise.all(
        Array.from(map.values()).map(async cls => {
          try {
            const r = await studentsApi.list({
              subcategory_id: cls.subcategory_id,
              item_id: cls.item_id || undefined,
            });
            return { ...cls, student_count: Array.isArray(r) ? r.length : (r?.students || []).length };
          } catch {
            return { ...cls, student_count: 0 };
          }
        })
      );
      setClasses(list);
    } catch {
      toast.error('Failed to load classes');
    } finally {
      setLoadingClasses(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1→2 — Select class, preload which periods have saved sessions
  // ─────────────────────────────────────────────────────────────────────────
  const handleSelectClass = async (cls: any) => {
    setSelectedClass(cls);
    setSelectedPeriodData(null);
    setPeriodSavedMap({});

    // Preload saved-session map (same as mobile preloadPeriodSavedMap)
    try {
      const sessionsRaw = await attendanceApi
        .getSessions({
          date:           selectedDate,
          subcategory_id: cls.subcategory_id,
          ...(cls.category_id ? { category_id: cls.category_id } : {}),
          ...(cls.item_id     ? { item_id:     cls.item_id     } : {}),
        })
        .catch(() => []);

      const allSessions: any[] = sessionsRaw?.sessions || sessionsRaw || [];
      const map: Record<string, string> = {};
      allSessions.forEach((s: any) => {
        const key = String(s.period_id || s.period_number);
        map[key] = s.id;
      });
      setPeriodSavedMap(map);
    } catch { /* silent */ }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2→3 — Select period, load students + existing attendance
  //            *** THIS IS THE CORE FIX matching mobile app logic ***
  // ─────────────────────────────────────────────────────────────────────────
  const handleSelectPeriod = (period: any) => {
    setSelectedPeriodData(period);
  };

  const proceedToMark = async () => {
    if (!selectedClass || !selectedPeriodData) {
      toast.error('Select a class and period first');
      return;
    }

    try {
      setLoadingStudents(true);
      setSaved(false);
      setExistingSessionId(null);
      setSearch('');
      setFilterStatus('all');

      // ── 1. Fetch students ────────────────────────────────────────────────
      const raw = await studentsApi.list({
        subcategory_id: selectedClass.subcategory_id,
        item_id:        selectedClass.item_id || undefined,
      });
      const studentList: any[] = Array.isArray(raw) ? raw : (raw?.students || raw || []);

      // ── 2. Fetch existing sessions for this date+class (same as mobile) ──
      const sessionsRaw = await attendanceApi
        .getSessions({
          date:           selectedDate,
          subcategory_id: selectedClass.subcategory_id,
          ...(selectedClass.category_id ? { category_id: selectedClass.category_id } : {}),
          ...(selectedClass.item_id     ? { item_id:     selectedClass.item_id     } : {}),
        })
        .catch(() => []);

      const allSessions: any[] = sessionsRaw?.sessions || sessionsRaw || [];

      // ── 3. Find session matching this period ─────────────────────────────
      const periodSessions = allSessions.filter(
        (s: any) =>
          String(s.period_id)     === String(selectedPeriodData.period_number) ||
          String(s.period_number) === String(selectedPeriodData.period_number)
      );

      // ── 4. Load existing attendance records if session exists ────────────
      const existingMap: Record<string, string> = {};
      let foundSessionId: string | null = null;

      if (periodSessions.length > 0) {
        foundSessionId = periodSessions[0].id;

        const recsResults = await Promise.all(
          periodSessions.map((s: any) =>
            attendanceApi.getRecords(s.id).catch(() => [])
          )
        );

        recsResults.forEach((recRaw: any) => {
          const records: any[] = Array.isArray(recRaw)
            ? recRaw
            : (recRaw?.records || recRaw?.data || []);
          records.forEach((r: any) => {
            if (r?.student_id) existingMap[r.student_id] = r.status;
          });
        });
      }

      const hasExisting = Object.keys(existingMap).length > 0;
      setExistingSessionId(foundSessionId);

      // ── 5. Merge: use saved status if exists, else default present ────────
      //    (mobile uses null default; web defaults to present for fresh sessions)
      setStudents(
        studentList.map((s: any) => {
          const savedStatus = existingMap[s.id]; // 'present' | 'absent' | undefined
          const present = hasExisting
            ? savedStatus === 'present'   // ← use saved value exactly
            : true;                       // ← fresh session, default to present
          return {
            ...s,
            present,
            originalPresent: hasExisting ? savedStatus === 'present' : null,
          };
        })
      );

      setStep(2);
    } catch {
      toast.error('Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // SAVE — create new session OR update existing (mirrors mobile saveAttendance)
  // ─────────────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!students.length || !selectedClass || !selectedPeriodData) {
      toast.error('No students loaded');
      return;
    }

    try {
      setSaving(true);

      if (existingSessionId) {
        // ── UPDATE existing session records ──────────────────────────────
        const records = students.map(s => ({
          student_id: s.id,
          status:     s.present ? 'present' : 'absent',
          remarks:    null,
        }));

        try {
          await attendanceApi.updateRecords(existingSessionId, { records });
        } catch {
          // Fallback to POST if PUT not supported
          await attendanceApi.saveRecords(existingSessionId, records);
        }
      } else {
        // ── CREATE new session ───────────────────────────────────────────
        const session = await attendanceApi.createSession({
          date:           selectedDate,
          subcategory_id: selectedClass.subcategory_id,
          category_id:    selectedClass.category_id    || null,
          item_id:        selectedClass.item_id        || null,
          subject_id:     selectedPeriodData?.subject_id || null,   // ← THE FIX
          period_id:      selectedPeriodData.period_number,
          taken_by:       currentUser?.id,
        });

        if (!session?.id) {
          toast.error('Could not create session');
          return;
        }

        await attendanceApi.saveRecords(
          session.id,
          students.map(s => ({
            student_id: s.id,
            status:     s.present ? 'present' : 'absent',
            remarks:    null,
          }))
        );

        setExistingSessionId(session.id);
      }

      // Mark originalPresent = current present so "Updated" badges reset
      setStudents(prev => prev.map(s => ({ ...s, originalPresent: s.present })));
      setSaved(true);

      toast.success(
        isUpdateMode
          ? `Updated! ${presentCount} present · ${absentCount} absent`
          : `Saved! ${presentCount} present · ${absentCount} absent`
      );

      // Update period saved map
      setPeriodSavedMap(prev => ({
        ...prev,
        [String(selectedPeriodData.period_number)]: existingSessionId || 'new',
      }));
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Student actions
  // ─────────────────────────────────────────────────────────────────────────
  const toggle    = (id: string) => setStudents(p => p.map(s => s.id === id ? { ...s, present: !s.present } : s));
  const toggleAll = (v: boolean) => setStudents(p => p.map(s => ({ ...s, present: v })));

  const goBackToStep1 = () => {
    setStep(1);
    setStudents([]);
    setSearch('');
    setFilterStatus('all');
    setExistingSessionId(null);
    setSaved(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <TeacherLayout>
      <div className="space-y-6 pb-24">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Mark Attendance</h1>
            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadClasses}
              disabled={loadingClasses}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-all"
            >
              <RefreshCw className={`h-4 w-4 ${loadingClasses ? 'animate-spin' : ''}`} />
            </button>
            <div className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500">
              <Shield className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* ── Date mode toggle (Today / Yesterday) ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="font-medium">Date:</span>
          </div>
          <div className="flex gap-2">
            {(['today', 'yesterday'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => {
                  setDateMode(mode);
                  // Reset period selection when date changes
                  setSelectedPeriodData(null);
                  setPeriodSavedMap({});
                  if (step === 2) {
                    setStep(1);
                    setStudents([]);
                    setSaved(false);
                    setExistingSessionId(null);
                  }
                }}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  dateMode === mode
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                }`}
              >
                {mode === 'today' ? 'Today' : 'Yesterday'}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400 font-medium ml-auto">
            {activeDay} · {selectedDate}
          </span>
        </div>

        {/* ── Step indicator ── */}
        <div className="flex justify-end items-center gap-2">
          {[
            { num: 1, label: 'Select Class & Period' },
            { num: 2, label: 'Mark Attendance' },
          ].map(({ num, label }, i) => (
            <>
              {i > 0 && <ChevronRight key={`arrow-${num}`} className="h-3.5 w-3.5 text-gray-300" />}
              <div
                key={num}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  step === num ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                    step === num ? 'bg-indigo-600 text-white' : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {num}
                </span>
                {label}
              </div>
            </>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            STEP 1 — Select Class & Period
        ══════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-6">

            {/* Select Class */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-indigo-500" />
                Select Class
              </h2>
              {loadingClasses ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
                </div>
              ) : classes.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
                  <GraduationCap className="h-12 w-12 mx-auto text-gray-200 mb-3" />
                  <p className="font-medium text-gray-400">No classes assigned</p>
                  <p className="text-xs text-gray-300 mt-1">Ask admin to set up your timetable</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classes.map(cls => (
                    <ClassCard
                      key={cls.id}
                      cls={cls}
                      isSelected={selectedClass?.id === cls.id}
                      onSelect={handleSelectClass}
                      assignments={assignments}
                      activeDay={activeDay}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Select Period */}
            {selectedClass && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-indigo-500" />
                  Select Period
                  <span className="text-gray-400 font-normal">· {activeDay}</span>
                </h2>

                {periodsForClass.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {periodsForClass.map(period => {
                      const key = String(period.period_number);
                      const hasSaved = !!periodSavedMap[key];
                      return (
                        <PeriodCard
                          key={period.period_number}
                          period={period}
                          isSelected={selectedPeriodData?.period_number === period.period_number}
                          onSelect={handleSelectPeriod}
                          hasSaved={hasSaved}
                        />
                      );
                    })}
                  </div>
                ) : (
                  /* No timetable periods — manual selector */
                  <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <p className="text-sm text-amber-700 font-medium">No periods scheduled — pick manually:</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(p => (
                        <button
                          key={p}
                          onClick={() =>
                            handleSelectPeriod({ period_number: p, subject_name: null, start_time: null, end_time: null, subject_id: null })
                          }
                          className={`w-14 h-14 rounded-xl text-sm font-bold border-2 transition-all duration-200 ${
                            selectedPeriodData?.period_number === p
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-400'
                          }`}
                        >
                          P{p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Ready to Mark banner */}
            {selectedClass && selectedPeriodData && (
              <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <ListChecks className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">
                        Ready to Mark
                        {periodSavedMap[String(selectedPeriodData.period_number)] && (
                          <span className="ml-2 text-[10px] font-bold text-amber-600 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">
                            Has saved records
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {selectedClass.name} · P{selectedPeriodData.period_number}
                        {selectedPeriodData.subject_name && ` · ${selectedPeriodData.subject_name}`}
                        {' · '}
                        {dateMode === 'yesterday' ? 'Yesterday' : 'Today'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={proceedToMark}
                    disabled={loadingStudents}
                    className="flex items-center gap-2 bg-indigo-600 text-white font-semibold text-sm px-4 py-2 rounded-lg shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-60"
                  >
                    {loadingStudents ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        Load Students <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STEP 2 — Mark students
        ══════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-5">

            {/* Session info bar */}
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <button
                  onClick={goBackToStep1}
                  className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center hover:bg-indigo-100 transition-colors shrink-0"
                >
                  <ArrowLeft className="h-4 w-4 text-indigo-600" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-800 text-sm truncate">{selectedClass?.name}</p>
                    {isUpdateMode && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700">
                        <RotateCcw className="h-2.5 w-2.5" />
                        Update Mode
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    Period {selectedPeriodData?.period_number}
                    {selectedPeriodData?.subject_name && ` · ${selectedPeriodData.subject_name}`}
                    {' · '}{selectedDate}
                    {dateMode === 'yesterday' ? ' (Yesterday)' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 bg-indigo-50 rounded-lg px-3 py-1.5 shrink-0">
                  <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                  <span className="text-xs font-medium text-indigo-700">{students.length} students</span>
                </div>
              </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard label="Total"   value={students.length} icon={Users}        iconBg="bg-indigo-50"  iconColor="text-indigo-600" />
              <MetricCard label="Present" value={presentCount}    icon={CheckCircle}  iconBg="bg-emerald-50" iconColor="text-emerald-600" />
              <MetricCard label="Absent"  value={absentCount}     icon={XCircle}      iconBg="bg-rose-50"    iconColor="text-rose-600" />
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-400">Attendance %</span>
                  {updatedCount > 0 && (
                    <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
                      {updatedCount} changed
                    </span>
                  )}
                </div>
                <p className={`text-2xl font-bold tabular-nums ${attendancePct >= 75 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {attendancePct}%
                </p>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${attendancePct >= 75 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${attendancePct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Search + filter bar */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search name or register number..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 transition-all"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { id: 'all',     label: `All (${students.length})` },
                  { id: 'present', label: `Present (${presentCount})` },
                  { id: 'absent',  label: `Absent (${absentCount})` },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setFilterStatus(id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                      filterStatus === id
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <div className="flex-1" />
                <button
                  onClick={() => toggleAll(true)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                >
                  ✓ All Present
                </button>
                <button
                  onClick={() => toggleAll(false)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors"
                >
                  ✗ All Absent
                </button>
              </div>
            </div>

            {/* Student list */}
            {filteredStudents.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
                <Search className="h-12 w-12 mx-auto text-gray-200 mb-3" />
                <p className="text-gray-400 font-medium">No students found</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {filteredStudents.map((student, idx) => (
                  <StudentRow key={student.id} student={student} index={idx} onToggle={toggle} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-gray-300" />
            <span>
              Institution ID:{' '}
              <span className="font-semibold text-gray-600">
                {currentUser?.institution_id?.slice(0, 8) || '—'}…
              </span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-bold border border-indigo-100 text-[10px] uppercase tracking-wide">
              Faculty
            </span>
          </div>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" />
            ETAM · Education & Attendance Management
          </span>
        </div>
      </div>

      {/* ══ Sticky Save Bar (step 2 only) ══════════════════════════════════════ */}
      {step === 2 && (
        <div className="fixed bottom-0 left-0 md:left-64 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-lg px-4 py-3">
          <div className="flex items-center justify-between gap-3 max-w-screen-xl mx-auto">
            <div>
              <p className="text-sm font-medium text-gray-700">
                <span className="text-emerald-600">{presentCount} Present</span>
                <span className="text-gray-300 mx-1">·</span>
                <span className="text-rose-600">{absentCount} Absent</span>
                {updatedCount > 0 && (
                  <span className="text-amber-600 ml-1">· {updatedCount} changed</span>
                )}
              </p>
              <p className="text-xs text-gray-400">
                {selectedClass?.name} · P{selectedPeriodData?.period_number}
                {isUpdateMode ? ' · Update Mode' : ''}
                {saved ? ' · ✓ Saved' : ''}
              </p>
            </div>
            <button
              onClick={save}
              disabled={saving}
              className={`flex items-center gap-2 font-semibold text-sm px-5 py-2 rounded-lg shadow-sm transition-colors disabled:opacity-60 text-white ${
                isUpdateMode
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : saved
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  {isUpdateMode ? 'Updated!' : 'Saved!'}
                </>
              ) : (
                <>
                  {isUpdateMode ? <RotateCcw className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {isUpdateMode ? 'Update Attendance' : 'Save Attendance'}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </TeacherLayout>
  );
}