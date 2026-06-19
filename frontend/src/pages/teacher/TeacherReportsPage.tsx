import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  attendanceApi,
  timetableApi,
  studentsApi,
  academicApi,
} from '@/lib/api';
import TeacherLayout from '@/components/layouts/TeacherLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  FileText, Download, AlertTriangle, Users,
  TrendingUp, BarChart2, CheckCircle2,
  RefreshCw, CalendarDays, Shield,
  BookOpen, UserCheck, ClipboardList,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface TeacherClass {
  id: string;
  name: string;
  subcategory_id: string;
  item_id: string;
  category_id: string;
  category_name: string;
  subcategory_name: string;
  item_name: string;
  student_count: number;
  subjects: { id: string; name: string }[];
}

// Report 1 – Daily Attendance
interface DailyRecord {
  studentId: string;
  studentName: string;
  registerNumber: string;
  status: 'present' | 'absent' | 'late';
  subject: string;
}

// Report 2 – Subject-wise
interface SubjectRow {
  subjectId: string;
  subjectName: string;
  totalClasses: number;
  totalPresent: number;
  totalAbsent: number;
  percentage: number;
}

// Report 3 – Student Attendance
interface StudentRow {
  studentId: string;
  studentName: string;
  registerNumber: string;
  present: number;
  absent: number;
  late: number;
  total: number;
  percentage: number;
}

// Report 4 – Low Attendance
// reuses StudentRow filtered by threshold

// Report 5 – Monthly
interface MonthRow {
  month: string;
  monthKey: string;
  present: number;
  absent: number;
  total: number;
  percentage: number;
}

// Report 6 – Class-wise
interface ClassRow {
  className: string;
  totalStudents: number;
  present: number;
  absent: number;
  total: number;
  percentage: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Helpers
// ─────────────────────────────────────────────────────────────────────────────
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const REPORT_TYPES = [
  { id: 'daily',    label: 'Daily Attendance',     icon: CalendarDays,  desc: 'Present / Absent / Late per day' },
  { id: 'subject',  label: 'Subject-wise',          icon: BookOpen,      desc: 'Attendance % per subject' },
  { id: 'student',  label: 'Student Attendance',    icon: UserCheck,     desc: 'Individual student summary' },
  { id: 'low',      label: 'Low Attendance',        icon: AlertTriangle, desc: 'Students below threshold' },
  { id: 'monthly',  label: 'Monthly Trend',         icon: TrendingUp,    desc: 'Month-wise attendance summary' },
  { id: 'classwise',label: 'Class-wise',            icon: BarChart2,     desc: 'Whole class attendance %' },
] as const;

type ReportType = typeof REPORT_TYPES[number]['id'];

const pctColor = (p: number) =>
  p >= 85 ? '#10b981' : p >= 75 ? '#f59e0b' : '#ef4444';

const pctTextClass = (p: number) =>
  p >= 85 ? 'text-emerald-600' : p >= 75 ? 'text-amber-500' : 'text-rose-500';

const rowBg = (p: number) =>
  p >= 85 ? 'bg-emerald-50/30' : p >= 75 ? 'bg-amber-50/30' : 'bg-rose-50/30';

const statusBadge = (p: number) => ({
  cls: p >= 85
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : p >= 75
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-rose-50 text-rose-700 border-rose-200',
  dot: p >= 85 ? 'bg-emerald-500' : p >= 75 ? 'bg-amber-500' : 'bg-rose-500',
  label: p >= 85 ? 'Excellent' : p >= 75 ? 'Average' : 'Low',
});

function MiniBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, value)}%`, backgroundColor: pctColor(value) }}
        />
      </div>
      <span className={`text-xs font-bold min-w-[42px] text-right ${pctTextClass(value)}`}>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

function StatusBadge({ p }: { p: number }) {
  const s = statusBadge(p);
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-5 px-5 py-3 text-xs text-gray-500 border-t border-gray-100 bg-gray-50/40">
      {[
        { color: '#10b981', label: 'Excellent ≥ 85%' },
        { color: '#f59e0b', label: 'Average 75–84%' },
        { color: '#ef4444', label: 'Low < 75%' },
      ].map(l => (
        <div key={l.label} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
          {l.label}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ msg }: { msg?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
      <ClipboardList className="h-12 w-12 opacity-20" />
      <p className="text-sm font-medium text-center max-w-xs">
        {msg || 'Select filters and click Generate Report'}
      </p>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, bg, iconColor, loading }: any) {
  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <Skeleton className="h-3 w-20 mb-4" /><Skeleton className="h-7 w-14 mb-2" /><Skeleton className="h-3 w-16" />
    </div>
  );
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-400">{label}</span>
        <div className={`p-2 rounded-lg ${bg}`}>
          <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
    </div>
  );
}

function doExportCSV(rows: any[][], cols: string[], filename: string) {
  if (!rows.length) { toast.error('No data to export'); return; }
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const csv = [cols.map(esc).join(','), ...rows.map(r => r.map((c: any) => esc(String(c))).join(','))].join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
  toast.success('Exported successfully');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function TeacherReportsPage() {
  const { profile, user } = useAuth();
  const currentUser = user || profile;

  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // ── Filters ──────────────────────────────────────────────────────────────
  const [activeReport, setActiveReport] = useState<ReportType>('daily');
  const [startDate, setStartDate]       = useState(monthAgo);
  const [endDate, setEndDate]           = useState(today);
  const [selectedDate, setSelectedDate] = useState(today); // for daily report

  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [selectedClass, setSelectedClass]   = useState<TeacherClass | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(true);

  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [lowThreshold, setLowThreshold]       = useState(75);

  // ── Academic labels ───────────────────────────────────────────────────────
  const [deptLabel,    setDeptLabel]    = useState('Department');
  const [yearLabel,    setYearLabel]    = useState('Year');
  const [sectionLabel, setSectionLabel] = useState('Section');

  // ── Loading / state ───────────────────────────────────────────────────────
  const [loading,      setLoading]      = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [loadMessage,  setLoadMessage]  = useState('');

  // ── Report data ───────────────────────────────────────────────────────────
  const [dailyData,   setDailyData]   = useState<DailyRecord[]>([]);
  const [subjectData, setSubjectData] = useState<SubjectRow[]>([]);
  const [studentData, setStudentData] = useState<StudentRow[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthRow[]>([]);
  const [classData,   setClassData]   = useState<ClassRow | null>(null);

  // ── Pagination ────────────────────────────────────────────────────────────
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ─────────────────────────────────────────────────────────────────────────
  // Load teacher classes
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.id) return;
    const load = async () => {
      setLoadingClasses(true);
      try {
        const data = await timetableApi.getAssignments({ user_id: currentUser.id });
        const list = Array.isArray(data) ? data : (data?.assignments || []);

        const map = new Map<string, TeacherClass>();
        list.forEach((item: any) => {
          const key = `${item.subcategory_id || 'none'}_${item.item_id || 'none'}`;
          if (!map.has(key)) {
            const name =
              item.category_name && item.subcategory_name && item.item_name
                ? `${item.category_name} ${item.subcategory_name} ${item.item_name}`
                : item.subcategory_name && item.item_name
                ? `${item.subcategory_name} ${item.item_name}`
                : item.subcategory_name || `Section ${item.item_name}` || 'Class';

            map.set(key, {
              id: key, name,
              subcategory_id: item.subcategory_id,
              item_id: item.item_id,
              category_id: item.category_id,
              category_name: item.category_name,
              subcategory_name: item.subcategory_name,
              item_name: item.item_name,
              student_count: 0,
              subjects: [],
            });
          }
        });

        const classes = await Promise.all(
          Array.from(map.values()).map(async cls => {
            try {
              const students = await studentsApi.list({ subcategory_id: cls.subcategory_id, item_id: cls.item_id || undefined });
              const count = Array.isArray(students) ? students.length : (students?.data?.length || 0);
              const subjects = list
                .filter((i: any) => i.subcategory_id === cls.subcategory_id && i.item_id === cls.item_id)
                .map((i: any) => ({ id: i.subject_id, name: i.subject_name || 'Subject' }))
                .filter((s: any, idx: number, arr: any[]) => s.id && arr.findIndex((t: any) => t.id === s.id) === idx);
              return { ...cls, student_count: count, subjects };
            } catch { return { ...cls, student_count: 0, subjects: [] }; }
          })
        );

        const filtered = classes.filter(c => c.student_count > 0);
        setTeacherClasses(filtered);
        if (filtered.length > 0) setSelectedClass(filtered[0]);
      } catch { toast.error('Failed to load your classes'); }
      finally { setLoadingClasses(false); }
    };
    load();
  }, [currentUser?.id]);

  useEffect(() => {
    academicApi.getLabels()
      .then((lbl: any) => {
        if (lbl?.category_label)    setDeptLabel(lbl.category_label);
        if (lbl?.subcategory_label) setYearLabel(lbl.subcategory_label);
        if (lbl?.item_label)        setSectionLabel(lbl.item_label);
      }).catch(() => {});
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Core fetch helpers
  // ─────────────────────────────────────────────────────────────────────────
  async function fetchStudents(cls: TeacherClass) {
    const res = await studentsApi.list({ subcategory_id: cls.subcategory_id, item_id: cls.item_id || undefined });
    return (Array.isArray(res) ? res : res?.data || []) as any[];
  }

  async function fetchSessionsAndRecords(cls: TeacherClass, start: string, end: string) {
    setLoadMessage('Fetching sessions...');
    const sessRes = await attendanceApi.getSessions({
      subcategory_id: cls.subcategory_id,
      item_id: cls.item_id || undefined,
      startDate: start,
      endDate: end,
      limit: 5000,
    });
    const allSessions: any[] = Array.isArray(sessRes) ? sessRes : sessRes?.data || [];
    const startMs = new Date(start).getTime();
    const endMs   = new Date(end + 'T23:59:59').getTime();
    const sessions = allSessions.filter((s: any) => {
      const d = new Date(s.date || s.session_date || s.created_at || '').getTime();
      return !d || (d >= startMs && d <= endMs);
    });

    setLoadMessage(`Processing ${sessions.length} sessions...`);
    const records = await Promise.all(
      sessions.map((s: any) => attendanceApi.getRecords(s.id).catch(() => []))
    );
    return { sessions, records };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GENERATE REPORT
  // ─────────────────────────────────────────────────────────────────────────
  const generateReport = async () => {
    if (!selectedClass) { toast.error('Please select a class'); return; }

    setLoading(true);
    setHasGenerated(false);
    setLoadMessage('Loading students...');
    clearAllData();

    try {
      const studentList = await fetchStudents(selectedClass);
      if (studentList.length === 0) {
        toast.warning('No students found for this class');
        setHasGenerated(true);
        return;
      }
      const studentIdSet = new Set(studentList.map((s: any) => s.id));

      // ── REPORT 1: Daily Attendance ──────────────────────────────────────
      if (activeReport === 'daily') {
        const sessRes = await attendanceApi.getSessions({
          subcategory_id: selectedClass.subcategory_id,
          item_id: selectedClass.item_id || undefined,
          startDate: selectedDate,
          endDate: selectedDate,
          limit: 200,
        });
        const sessions: any[] = Array.isArray(sessRes) ? sessRes : sessRes?.data || [];
        const dayMs = new Date(selectedDate).setHours(0,0,0,0);
        const daySessions = sessions.filter((s: any) => {
          const d = new Date(s.date || s.session_date || s.created_at || '').setHours(0,0,0,0);
          return d === dayMs;
        });

        if (daySessions.length === 0) {
          toast.info('No sessions found for this date');
          setDailyData(studentList.map((st: any) => ({
            studentId: st.id, studentName: st.full_name || 'Unknown',
            registerNumber: st.register_number || '-', status: 'absent' as const,
            subject: '—',
          })));
          setHasGenerated(true);
          return;
        }

        const allRecords = await Promise.all(
          daySessions.map((s: any) => attendanceApi.getRecords(s.id).catch(() => []))
        );
        const rows: DailyRecord[] = [];
        allRecords.forEach((recs: any, idx: number) => {
          const sess = daySessions[idx];
          const list: any[] = Array.isArray(recs) ? recs : recs?.data || [];
          list.forEach((rec: any) => {
            if (!rec.student_id || !studentIdSet.has(rec.student_id)) return;
            const st = studentList.find((s: any) => s.id === rec.student_id);
            rows.push({
              studentId: rec.student_id,
              studentName: st?.full_name || 'Unknown',
              registerNumber: st?.register_number || '-',
              status: rec.status || 'absent',
              subject: sess.subject_name || selectedSubject !== 'all'
                ? (selectedClass.subjects.find(s => s.id === selectedSubject)?.name || sess.subject_name || '—')
                : (sess.subject_name || '—'),
            });
          });
        });

        // add students with no records as absent
        const recordedIds = new Set(rows.map(r => r.studentId));
        studentList.forEach((st: any) => {
          if (!recordedIds.has(st.id)) {
            rows.push({
              studentId: st.id, studentName: st.full_name || 'Unknown',
              registerNumber: st.register_number || '-', status: 'absent',
              subject: daySessions[0]?.subject_name || '—',
            });
          }
        });
        setDailyData(rows);
        toast.success(`Daily report — ${rows.length} records`);
      }

      // ── REPORT 2: Subject-wise ──────────────────────────────────────────
      else if (activeReport === 'subject') {
        const { sessions, records } = await fetchSessionsAndRecords(selectedClass, startDate, endDate);
        const subMap = new Map<string, { name: string; totalClasses: number; present: number; absent: number; studentSet: Set<string> }>();

        records.forEach((recs: any, idx: number) => {
          const sess = sessions[idx];
          const subId = sess?.subject_id;
          const subName = sess?.subject_name || 'Unknown Subject';
          if (!subId) return;
          const list: any[] = Array.isArray(recs) ? recs : recs?.data || [];
          list.forEach((rec: any) => {
            if (!rec.student_id || !studentIdSet.has(rec.student_id)) return;
            if (!subMap.has(subId)) subMap.set(subId, { name: subName, totalClasses: 0, present: 0, absent: 0, studentSet: new Set() });
            const s = subMap.get(subId)!;
            s.totalClasses += 1;
            s.studentSet.add(rec.student_id);
            if (rec.status === 'present') s.present += 1; else s.absent += 1;
          });
        });

        const rows: SubjectRow[] = Array.from(subMap.entries()).map(([id, s]) => ({
          subjectId: id,
          subjectName: s.name,
          totalClasses: s.totalClasses,
          totalPresent: s.present,
          totalAbsent: s.absent,
          percentage: s.totalClasses > 0 ? parseFloat(((s.present / s.totalClasses) * 100).toFixed(1)) : 0,
        }));
        setSubjectData(rows);
        toast.success(`Subject report — ${rows.length} subjects`);
      }

      // ── REPORT 3: Student Attendance ───────────────────────────────────
      else if (activeReport === 'student') {
        const { sessions, records } = await fetchSessionsAndRecords(selectedClass, startDate, endDate);
        const statsMap = new Map<string, { present: number; absent: number; late: number; total: number }>();

        records.forEach((recs: any, idx: number) => {
          const sess = sessions[idx];
          if (selectedSubject !== 'all' && sess?.subject_id !== selectedSubject) return;
          const list: any[] = Array.isArray(recs) ? recs : recs?.data || [];
          list.forEach((rec: any) => {
            if (!rec.student_id || !studentIdSet.has(rec.student_id)) return;
            const cur = statsMap.get(rec.student_id) || { present: 0, absent: 0, late: 0, total: 0 };
            cur.total += 1;
            if (rec.status === 'present') cur.present += 1;
            else if (rec.status === 'absent') cur.absent += 1;
            else if (rec.status === 'late') cur.late += 1;
            statsMap.set(rec.student_id, cur);
          });
        });

        const rows: StudentRow[] = studentList.map((st: any) => {
          const s = statsMap.get(st.id) || { present: 0, absent: 0, late: 0, total: 0 };
          return {
            studentId: st.id,
            studentName: st.full_name || 'Unknown',
            registerNumber: st.register_number || '-',
            present: s.present, absent: s.absent, late: s.late, total: s.total,
            percentage: s.total > 0 ? parseFloat(((s.present / s.total) * 100).toFixed(1)) : 0,
          };
        });
        setStudentData(rows);
        toast.success(`Student report — ${rows.length} students`);
      }

      // ── REPORT 4: Low Attendance (same as student, filtered) ──────────
      else if (activeReport === 'low') {
        const { sessions, records } = await fetchSessionsAndRecords(selectedClass, startDate, endDate);
        const statsMap = new Map<string, { present: number; absent: number; late: number; total: number }>();

        records.forEach((recs: any) => {
          const list: any[] = Array.isArray(recs) ? recs : recs?.data || [];
          list.forEach((rec: any) => {
            if (!rec.student_id || !studentIdSet.has(rec.student_id)) return;
            const cur = statsMap.get(rec.student_id) || { present: 0, absent: 0, late: 0, total: 0 };
            cur.total += 1;
            if (rec.status === 'present') cur.present += 1;
            else if (rec.status === 'absent') cur.absent += 1;
            else if (rec.status === 'late') cur.late += 1;
            statsMap.set(rec.student_id, cur);
          });
        });

        const rows: StudentRow[] = studentList.map((st: any) => {
          const s = statsMap.get(st.id) || { present: 0, absent: 0, late: 0, total: 0 };
          return {
            studentId: st.id, studentName: st.full_name || 'Unknown',
            registerNumber: st.register_number || '-',
            present: s.present, absent: s.absent, late: s.late, total: s.total,
            percentage: s.total > 0 ? parseFloat(((s.present / s.total) * 100).toFixed(1)) : 0,
          };
        }).filter(r => r.percentage < lowThreshold).sort((a, b) => a.percentage - b.percentage);
        setStudentData(rows);
        toast.success(`Low attendance — ${rows.length} students below ${lowThreshold}%`);
      }

      // ── REPORT 5: Monthly ──────────────────────────────────────────────
      else if (activeReport === 'monthly') {
        const { sessions, records } = await fetchSessionsAndRecords(selectedClass, startDate, endDate);
        const monthMap = new Map<string, { present: number; absent: number; total: number }>();

        records.forEach((recs: any, idx: number) => {
          const sess = sessions[idx];
          const dateStr = sess?.date || sess?.session_date || sess?.created_at || '';
          if (!dateStr) return;
          const d = new Date(dateStr);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const list: any[] = Array.isArray(recs) ? recs : recs?.data || [];
          list.forEach((rec: any) => {
            if (!rec.student_id || !studentIdSet.has(rec.student_id)) return;
            const mc = monthMap.get(key) || { present: 0, absent: 0, total: 0 };
            mc.total += 1;
            if (rec.status === 'present') mc.present += 1; else mc.absent += 1;
            monthMap.set(key, mc);
          });
        });

        const rows: MonthRow[] = Array.from(monthMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, val]) => {
            const [yr, mo] = key.split('-');
            return {
              monthKey: key,
              month: `${MONTH_NAMES[parseInt(mo) - 1]} ${yr}`,
              present: val.present, absent: val.absent, total: val.total,
              percentage: val.total > 0 ? parseFloat(((val.present / val.total) * 100).toFixed(1)) : 0,
            };
          });
        setMonthlyData(rows);
        toast.success(`Monthly report — ${rows.length} months`);
      }

      // ── REPORT 6: Class-wise ───────────────────────────────────────────
      else if (activeReport === 'classwise') {
        const { sessions, records } = await fetchSessionsAndRecords(selectedClass, startDate, endDate);
        let present = 0, absent = 0, total = 0;

        records.forEach((recs: any) => {
          const list: any[] = Array.isArray(recs) ? recs : recs?.data || [];
          list.forEach((rec: any) => {
            if (!rec.student_id || !studentIdSet.has(rec.student_id)) return;
            total += 1;
            if (rec.status === 'present') present += 1; else absent += 1;
          });
        });

        setClassData({
          className: selectedClass.name,
          totalStudents: studentList.length,
          present, absent, total,
          percentage: total > 0 ? parseFloat(((present / total) * 100).toFixed(1)) : 0,
        });
        toast.success(`Class-wise report generated`);
      }

      setHasGenerated(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to generate report');
    } finally {
      setLoading(false);
      setLoadMessage('');
    }
  };

  function clearAllData() {
    setDailyData([]);
    setSubjectData([]);
    setStudentData([]);
    setMonthlyData([]);
    setClassData(null);
    setPage(1);
  }

  // ── Daily summary counts ──────────────────────────────────────────────────
  const dailyPresent = useMemo(() => dailyData.filter(r => r.status === 'present').length, [dailyData]);
  const dailyAbsent  = useMemo(() => dailyData.filter(r => r.status === 'absent').length,  [dailyData]);
  const dailyLate    = useMemo(() => dailyData.filter(r => r.status === 'late').length,    [dailyData]);

  // ── Student data pagination ───────────────────────────────────────────────
  const totalPages    = Math.ceil(studentData.length / pageSize);
  const paginatedRows = studentData.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [studentData.length]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <TeacherLayout>
      <div className="space-y-6">

        {/* ── PAGE HEADER ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Attendance Reports</h1>
            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
              <BarChart2 className="h-3.5 w-3.5" />
              Generate and export attendance reports for your classes
            </p>
          </div>
          <div className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400">
            <Shield className="h-4 w-4" />
          </div>
        </div>

        {/* ── REPORT TYPE SELECTOR ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {REPORT_TYPES.map(rt => {
            const Icon = rt.icon;
            const active = activeReport === rt.id;
            return (
              <button
                key={rt.id}
                onClick={() => { setActiveReport(rt.id); setHasGenerated(false); clearAllData(); }}
                className={`flex flex-col items-start gap-2 p-3.5 rounded-xl border text-left transition-all duration-150 ${
                  active
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100'
                    : 'bg-white border-gray-100 text-gray-600 hover:border-indigo-200 hover:bg-indigo-50/30 shadow-sm'
                }`}
              >
                <div className={`p-1.5 rounded-md ${active ? 'bg-indigo-500' : 'bg-gray-100'}`}>
                  <Icon className={`h-3.5 w-3.5 ${active ? 'text-white' : 'text-gray-500'}`} />
                </div>
                <div>
                  <p className={`text-xs font-bold leading-tight ${active ? 'text-white' : 'text-gray-800'}`}>
                    {rt.label}
                  </p>
                  <p className={`text-[10px] mt-0.5 leading-tight ${active ? 'text-indigo-200' : 'text-gray-400'}`}>
                    {rt.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── FILTERS CARD ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <div className="p-2 rounded-lg bg-indigo-50">
              <CalendarDays className="h-3.5 w-3.5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Filters</h2>
              <p className="text-xs text-gray-400 mt-0.5">Select class, date range, and subject</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Row 1: Class */}
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                  Class
                </label>
                {loadingClasses ? (
                  <Skeleton className="h-10 w-full rounded-lg" />
                ) : (
                  <Select
                    value={selectedClass?.id || ''}
                    onValueChange={val => {
                      const cls = teacherClasses.find(c => c.id === val);
                      setSelectedClass(cls || null);
                      setHasGenerated(false);
                      clearAllData();
                    }}
                  >
                    <SelectTrigger className="h-10 text-sm border border-gray-200 rounded-lg">
                      <SelectValue placeholder="Choose a class" />
                    </SelectTrigger>
                    <SelectContent>
                      {teacherClasses.map(cls => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name} ({cls.student_count} students)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {teacherClasses.length === 0 && !loadingClasses && (
                  <p className="text-xs text-amber-600 mt-1">No classes assigned. Please contact admin.</p>
                )}
              </div>

              {/* Subject filter — for daily & student reports */}
              {(activeReport === 'daily' || activeReport === 'student') && selectedClass?.subjects.length > 0 && (
                <div className="flex-1 min-w-[180px]">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                    Subject (optional)
                  </label>
                  <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger className="h-10 text-sm border border-gray-200 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Subjects</SelectItem>
                      {selectedClass.subjects.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Threshold — for low attendance report */}
              {activeReport === 'low' && (
                <div className="flex-1 min-w-[160px]">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                    Threshold (%)
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number" min={0} max={100}
                      value={lowThreshold}
                      onChange={e => setLowThreshold(Number(e.target.value))}
                      className="h-10 w-24 text-sm border border-gray-200 rounded-lg text-center"
                    />
                    <span className="text-sm text-gray-500">% threshold</span>
                  </div>
                </div>
              )}
            </div>

            {/* Row 2: Date(s) */}
            <div className="flex flex-wrap gap-3 items-end">
              {activeReport === 'daily' ? (
                <div className="flex-1 min-w-[160px]">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">Date</label>
                  <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="h-10 text-sm border border-gray-200 rounded-lg" />
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">Start Date</label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10 text-sm border border-gray-200 rounded-lg" />
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">End Date</label>
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10 text-sm border border-gray-200 rounded-lg" />
                  </div>
                  <div className="flex gap-2">
                    {(['30days','thismonth','3months'] as const).map(r => (
                      <Button key={r} onClick={() => {
                        const end = new Date(); const start = new Date();
                        if (r === '30days') start.setDate(end.getDate() - 30);
                        else if (r === 'thismonth') start.setDate(1);
                        else start.setMonth(end.getMonth() - 3);
                        setStartDate(start.toISOString().split('T')[0]);
                        setEndDate(end.toISOString().split('T')[0]);
                      }} variant="outline" size="sm" className="h-9 text-xs rounded-lg border border-gray-200">
                        {r === '30days' ? 'Last 30d' : r === 'thismonth' ? 'This month' : 'Last 3m'}
                      </Button>
                    ))}
                  </div>
                </>
              )}

              {/* Generate / Refresh */}
              <div className="flex gap-2">
                <Button
                  onClick={generateReport}
                  disabled={loading || !selectedClass}
                  className="h-9 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-4"
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  {loading ? loadMessage || 'Generating...' : 'Generate Report'}
                </Button>
                {hasGenerated && (
                  <Button onClick={generateReport} variant="outline" size="sm" disabled={loading} className="h-9 w-9 p-0 rounded-lg border border-gray-200">
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            REPORT VIEWS
        ════════════════════════════════════════════════════════════════ */}

        {/* ── REPORT 1: Daily Attendance ─────────────────────────────── */}
        {activeReport === 'daily' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Daily Attendance Report</h2>
                {hasGenerated && selectedClass && (
                  <p className="text-xs text-gray-400 mt-0.5">{selectedClass.name} · {selectedDate}</p>
                )}
              </div>
              {hasGenerated && dailyData.length > 0 && (
                <Button variant="outline" size="sm" onClick={() =>
                  doExportCSV(
                    dailyData.map(r => [r.studentName, r.registerNumber, r.subject, r.status]),
                    ['Student Name', 'Register Number', 'Subject', 'Status'],
                    `daily_attendance_${selectedDate}.csv`
                  )} className="h-8 text-xs rounded-lg border border-gray-200">
                  <Download className="h-3 w-3 mr-1" /> Export CSV
                </Button>
              )}
            </div>

            {hasGenerated && dailyData.length > 0 && (
              <div className="grid grid-cols-3 gap-3 p-5 pb-0">
                <MetricCard label="Present" value={dailyPresent} icon={CheckCircle2} bg="bg-emerald-50" iconColor="text-emerald-600" />
                <MetricCard label="Absent"  value={dailyAbsent}  icon={AlertTriangle} bg="bg-rose-50"    iconColor="text-rose-600" />
                <MetricCard label="Late"    value={dailyLate}    icon={RefreshCw}     bg="bg-amber-50"   iconColor="text-amber-600" />
              </div>
            )}

            <div className="p-5">
              {loading ? (
                <div className="flex flex-col items-center py-14 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                  <p className="text-sm text-gray-500">{loadMessage}</p>
                </div>
              ) : !hasGenerated ? <EmptyState /> : dailyData.length === 0 ? <EmptyState msg="No records for this date" /> : (
                <div className="overflow-x-auto rounded-lg border border-gray-100">
                  <table className="w-full">
                    <thead className="bg-gray-50/60 border-b border-gray-100">
                      <tr>
                        <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 w-10">#</th>
                        <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Student Name</th>
                        <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Register No.</th>
                        <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Subject</th>
                        <th className="text-center p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {dailyData.map((row, i) => (
                        <tr key={`${row.studentId}-${i}`} className={
                          row.status === 'present' ? 'bg-emerald-50/30' :
                          row.status === 'late'    ? 'bg-amber-50/30'   : 'bg-rose-50/30'
                        }>
                          <td className="p-3 text-sm text-gray-500">{i + 1}</td>
                          <td className="p-3 font-semibold text-gray-800">{row.studentName}</td>
                          <td className="p-3 font-mono text-sm text-gray-600">{row.registerNumber}</td>
                          <td className="p-3 text-sm text-gray-600">{row.subject}</td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                              row.status === 'present' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              row.status === 'late'    ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                row.status === 'present' ? 'bg-emerald-500' :
                                row.status === 'late'    ? 'bg-amber-500'   : 'bg-rose-500'
                              }`} />
                              {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── REPORT 2: Subject-wise ────────────────────────────────── */}
        {activeReport === 'subject' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Subject-wise Attendance Report</h2>
                {hasGenerated && selectedClass && (
                  <p className="text-xs text-gray-400 mt-0.5">{selectedClass.name} · {startDate} to {endDate}</p>
                )}
              </div>
              {hasGenerated && subjectData.length > 0 && (
                <Button variant="outline" size="sm" onClick={() =>
                  doExportCSV(
                    subjectData.map(s => [s.subjectName, s.totalClasses, s.totalPresent, s.totalAbsent, `${s.percentage}%`]),
                    ['Subject', 'Total Classes', 'Present', 'Absent', 'Attendance %'],
                    `subject_report_${selectedClass?.name}_${startDate}_to_${endDate}.csv`
                  )} className="h-8 text-xs rounded-lg border border-gray-200">
                  <Download className="h-3 w-3 mr-1" /> Export CSV
                </Button>
              )}
            </div>

            <div className="p-5 space-y-5">
              {loading ? (
                <div className="flex flex-col items-center py-14 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                  <p className="text-sm text-gray-500">{loadMessage}</p>
                </div>
              ) : !hasGenerated ? <EmptyState /> : subjectData.length === 0 ? <EmptyState msg="No subject data found for this period" /> : (
                <>
                  {/* Subject cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {subjectData.map(s => (
                      <div key={s.subjectId} className="rounded-xl border border-gray-100 p-4 bg-white shadow-sm"
                        style={{ borderLeft: `4px solid ${pctColor(s.percentage)}` }}>
                        <div className="flex items-center gap-1.5 mb-3">
                          <BookOpen className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span className="text-sm font-semibold text-gray-800 truncate">{s.subjectName}</span>
                        </div>
                        <div className={`text-3xl font-extrabold ${pctTextClass(s.percentage)}`}>{s.percentage}%</div>
                        <div className="text-xs text-gray-400 mt-1">{s.totalClasses} classes recorded</div>
                        <div className="mt-3"><MiniBar value={s.percentage} /></div>
                        <div className="flex justify-between text-[11px] text-gray-400 mt-2">
                          <span className="text-emerald-600 font-medium">✓ {s.totalPresent} present</span>
                          <span className="text-rose-500 font-medium">✗ {s.totalAbsent} absent</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto rounded-lg border border-gray-100">
                    <table className="w-full">
                      <thead className="bg-gray-50/60 border-b border-gray-100">
                        <tr>
                          <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">#</th>
                          <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Subject</th>
                          <th className="text-center p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Classes</th>
                          <th className="text-center p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Present</th>
                          <th className="text-center p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Absent</th>
                          <th className="min-w-[160px] p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Attendance %</th>
                          <th className="text-center p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {subjectData.map((s, i) => (
                          <tr key={s.subjectId} className={rowBg(s.percentage)}>
                            <td className="p-3 text-sm text-gray-500">{i + 1}</td>
                            <td className="p-3 font-semibold text-gray-800">{s.subjectName}</td>
                            <td className="p-3 text-center text-gray-500">{s.totalClasses}</td>
                            <td className="p-3 text-center text-emerald-600 font-medium">{s.totalPresent}</td>
                            <td className="p-3 text-center text-rose-500 font-medium">{s.totalAbsent}</td>
                            <td className="p-3"><MiniBar value={s.percentage} /></td>
                            <td className="p-3 text-center"><StatusBadge p={s.percentage} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Legend />
                </>
              )}
            </div>
          </div>
        )}

        {/* ── REPORT 3: Student Attendance ──────────────────────────── */}
        {activeReport === 'student' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Student Attendance Report</h2>
                {hasGenerated && selectedClass && (
                  <p className="text-xs text-gray-400 mt-0.5">{selectedClass.name} · {studentData.length} students · {startDate} to {endDate}</p>
                )}
              </div>
              {hasGenerated && studentData.length > 0 && (
                <Button variant="outline" size="sm" onClick={() =>
                  doExportCSV(
                    studentData.map(r => [r.studentName, r.registerNumber, r.present, r.absent, r.late, r.total, `${r.percentage}%`]),
                    ['Student Name', 'Register Number', 'Present', 'Absent', 'Late', 'Total', 'Attendance %'],
                    `student_attendance_${selectedClass?.name}_${startDate}_to_${endDate}.csv`
                  )} className="h-8 text-xs rounded-lg border border-gray-200">
                  <Download className="h-3 w-3 mr-1" /> Export CSV
                </Button>
              )}
            </div>

            {hasGenerated && studentData.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 pb-0">
                <MetricCard label="Total Students"  value={studentData.length} icon={Users} bg="bg-indigo-50" iconColor="text-indigo-600" />
                <MetricCard label="Class Average"   value={`${(studentData.reduce((s,r) => s + r.percentage, 0) / studentData.length).toFixed(1)}%`} icon={TrendingUp} bg="bg-emerald-50" iconColor="text-emerald-600" />
                <MetricCard label="Above 75%"       value={studentData.filter(r => r.percentage >= 75).length} icon={CheckCircle2} bg="bg-emerald-50" iconColor="text-emerald-600" />
                <MetricCard label="Below 75%"       value={studentData.filter(r => r.percentage < 75).length}  icon={AlertTriangle} bg="bg-rose-50"    iconColor="text-rose-600" />
              </div>
            )}

            <div className="p-5">
              {loading ? (
                <div className="flex flex-col items-center py-14 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                  <p className="text-sm text-gray-500">{loadMessage}</p>
                </div>
              ) : !hasGenerated ? <EmptyState /> : studentData.length === 0 ? <EmptyState msg="No records found for this period" /> : (
                <>
                  <div className="overflow-x-auto rounded-lg border border-gray-100">
                    <table className="w-full">
                      <thead className="bg-gray-50/60 border-b border-gray-100">
                        <tr>
                          <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 w-10">#</th>
                          <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Student Name</th>
                          <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Register No.</th>
                          <th className="text-center p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Present</th>
                          <th className="text-center p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Absent</th>
                          <th className="text-center p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Late</th>
                          <th className="text-center p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Total</th>
                          <th className="min-w-[160px] p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Attendance %</th>
                          <th className="text-center p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginatedRows.map((row, i) => (
                          <tr key={row.studentId} className={rowBg(row.percentage)}>
                            <td className="p-3 text-sm text-gray-500">{(page - 1) * pageSize + i + 1}</td>
                            <td className="p-3 font-semibold text-gray-800">{row.studentName}</td>
                            <td className="p-3 font-mono text-sm text-gray-600">{row.registerNumber}</td>
                            <td className="p-3 text-center text-emerald-600 font-medium">{row.present}</td>
                            <td className="p-3 text-center text-rose-500 font-medium">{row.absent}</td>
                            <td className="p-3 text-center text-amber-600 font-medium">{row.late}</td>
                            <td className="p-3 text-center text-gray-500">{row.total}</td>
                            <td className="p-3"><MiniBar value={row.percentage} /></td>
                            <td className="p-3 text-center"><StatusBadge p={row.percentage} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between gap-3 pt-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Rows:</span>
                      <Select value={pageSize.toString()} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
                        <SelectTrigger className="w-18 h-8 text-xs border border-gray-200 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-8 w-8 p-0 rounded-lg border border-gray-200">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs text-gray-600">Page {page} of {totalPages || 1}</span>
                      <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="h-8 w-8 p-0 rounded-lg border border-gray-200">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Legend />
                </>
              )}
            </div>
          </div>
        )}

        {/* ── REPORT 4: Low Attendance ───────────────────────────────── */}
        {activeReport === 'low' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Low Attendance Report</h2>
                {hasGenerated && selectedClass && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedClass.name} · Students below {lowThreshold}% · {startDate} to {endDate}
                  </p>
                )}
              </div>
              {hasGenerated && studentData.length > 0 && (
                <Button variant="outline" size="sm" onClick={() =>
                  doExportCSV(
                    studentData.map(r => [r.studentName, r.registerNumber, r.present, r.absent, r.total, `${r.percentage}%`, `${(lowThreshold - r.percentage).toFixed(1)}%`]),
                    ['Student Name', 'Register Number', 'Present', 'Absent', 'Total', 'Attendance %', 'Shortfall'],
                    `low_attendance_${selectedClass?.name}_below${lowThreshold}pct.csv`
                  )} className="h-8 text-xs rounded-lg border border-gray-200">
                  <Download className="h-3 w-3 mr-1" /> Export CSV
                </Button>
              )}
            </div>

            <div className="p-5">
              {loading ? (
                <div className="flex flex-col items-center py-14 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                  <p className="text-sm text-gray-500">{loadMessage}</p>
                </div>
              ) : !hasGenerated ? <EmptyState /> : studentData.length === 0 ? (
                <div className="flex flex-col items-center py-14 gap-3">
                  <CheckCircle2 className="h-14 w-14 text-emerald-400 opacity-70" />
                  <p className="font-semibold text-emerald-600">All students are above {lowThreshold}%!</p>
                  <p className="text-xs text-gray-400">Great attendance across the class.</p>
                </div>
              ) : (
                <>
                  {/* Alert banner */}
                  <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 rounded-lg px-4 py-3 mb-4">
                    <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                    <p className="text-sm font-medium text-rose-700">
                      {studentData.length} student{studentData.length !== 1 ? 's' : ''} below {lowThreshold}% attendance — immediate attention required.
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-gray-100">
                    <table className="w-full">
                      <thead className="bg-gray-50/60 border-b border-gray-100">
                        <tr>
                          <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 w-10">#</th>
                          <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Student Name</th>
                          <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Register No.</th>
                          <th className="text-center p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Present</th>
                          <th className="text-center p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Absent</th>
                          <th className="text-center p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Total</th>
                          <th className="min-w-[160px] p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Attendance %</th>
                          <th className="text-center p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Shortfall</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {studentData.map((row, i) => (
                          <tr key={row.studentId} className="bg-rose-50/30">
                            <td className="p-3 text-sm text-gray-500">{i + 1}</td>
                            <td className="p-3 font-semibold text-gray-800">{row.studentName}</td>
                            <td className="p-3 font-mono text-sm text-gray-600">{row.registerNumber}</td>
                            <td className="p-3 text-center text-emerald-600 font-medium">{row.present}</td>
                            <td className="p-3 text-center text-rose-500 font-medium">{row.absent}</td>
                            <td className="p-3 text-center text-gray-500">{row.total}</td>
                            <td className="p-3"><MiniBar value={row.percentage} /></td>
                            <td className="p-3 text-center">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                                −{(lowThreshold - row.percentage).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── REPORT 5: Monthly Trend ────────────────────────────────── */}
        {activeReport === 'monthly' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Monthly Attendance Report</h2>
                {hasGenerated && selectedClass && (
                  <p className="text-xs text-gray-400 mt-0.5">{selectedClass.name} · {startDate} to {endDate}</p>
                )}
              </div>
              {hasGenerated && monthlyData.length > 0 && (
                <Button variant="outline" size="sm" onClick={() =>
                  doExportCSV(
                    monthlyData.map(m => [m.month, m.present, m.absent, m.total, `${m.percentage}%`]),
                    ['Month', 'Present', 'Absent', 'Total', 'Attendance %'],
                    `monthly_attendance_${selectedClass?.name}.csv`
                  )} className="h-8 text-xs rounded-lg border border-gray-200">
                  <Download className="h-3 w-3 mr-1" /> Export CSV
                </Button>
              )}
            </div>

            <div className="p-5 space-y-6">
              {loading ? (
                <div className="flex flex-col items-center py-14 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                  <p className="text-sm text-gray-500">{loadMessage}</p>
                </div>
              ) : !hasGenerated ? <EmptyState /> : monthlyData.length === 0 ? <EmptyState msg="No monthly data for this range" /> : (
                <>
                  {/* Bar chart */}
                  <div className="relative">
                    {[100, 75, 50, 25].map(v => (
                      <div key={v} className="absolute left-8 right-0 border-t border-dashed border-gray-100 pointer-events-none"
                        style={{ bottom: `${v * 1.55 + 32}px` }}>
                        <span className="absolute -top-3 -left-7 text-[10px] text-gray-400">{v}%</span>
                      </div>
                    ))}
                    {/* 75% line highlighted */}
                    <div className="absolute left-8 right-0 border-t border-dashed border-amber-300 pointer-events-none"
                      style={{ bottom: `${75 * 1.55 + 32}px` }} />

                    <div className="flex items-end gap-2 h-52 pl-8 pb-8 border-b border-gray-200">
                      {monthlyData.map((m, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1 group cursor-default">
                          <span className={`text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity ${pctTextClass(m.percentage)}`}>
                            {m.percentage}%
                          </span>
                          <div
                            className="w-full rounded-t-lg transition-all duration-500 opacity-80 hover:opacity-100"
                            style={{
                              height: `${Math.max((m.percentage / 100) * 155, 4)}px`,
                              backgroundColor: pctColor(m.percentage),
                            }}
                            title={`${m.month}: ${m.percentage}%`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 pl-8 mt-2">
                      {monthlyData.map((m, i) => (
                        <div key={i} className="flex-1 text-center text-[11px] font-medium text-gray-500">{m.month}</div>
                      ))}
                    </div>
                  </div>

                  {/* Summary cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {monthlyData.map((m, i) => {
                      const prev = i > 0 ? monthlyData[i - 1].percentage : null;
                      const diff = prev !== null ? m.percentage - prev : null;
                      return (
                        <div key={i} className="rounded-xl border border-gray-100 p-3 shadow-sm"
                          style={{ borderTop: `3px solid ${pctColor(m.percentage)}` }}>
                          <p className="text-xs font-bold text-gray-700 mb-2">{m.month}</p>
                          <p className={`text-xl font-extrabold ${pctTextClass(m.percentage)}`}>{m.percentage}%</p>
                          <p className="text-[11px] text-gray-400 mt-1">{m.total} records</p>
                          {diff !== null && (
                            <p className={`text-[11px] font-semibold mt-1 ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-500' : 'text-gray-400'}`}>
                              {diff > 0 ? `↑ +${diff.toFixed(1)}%` : diff < 0 ? `↓ ${diff.toFixed(1)}%` : '→ No change'}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Detailed table */}
                  <div className="overflow-x-auto rounded-lg border border-gray-100">
                    <table className="w-full">
                      <thead className="bg-gray-50/60 border-b border-gray-100">
                        <tr>
                          <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Month</th>
                          <th className="text-center p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Present</th>
                          <th className="text-center p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Absent</th>
                          <th className="text-center p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Total</th>
                          <th className="min-w-[160px] p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Attendance %</th>
                          <th className="text-center p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</th>
                          <th className="text-center p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">vs Previous</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {monthlyData.map((m, i) => {
                          const prev = i > 0 ? monthlyData[i - 1].percentage : null;
                          const diff = prev !== null ? m.percentage - prev : null;
                          return (
                            <tr key={i} className={rowBg(m.percentage)}>
                              <td className="p-3 font-semibold text-gray-800">{m.month}</td>
                              <td className="p-3 text-center text-emerald-600 font-medium">{m.present}</td>
                              <td className="p-3 text-center text-rose-500 font-medium">{m.absent}</td>
                              <td className="p-3 text-center text-gray-500">{m.total}</td>
                              <td className="p-3"><MiniBar value={m.percentage} /></td>
                              <td className="p-3 text-center"><StatusBadge p={m.percentage} /></td>
                              <td className="p-3 text-center text-sm font-semibold">
                                {diff === null ? <span className="text-gray-400">—</span>
                                  : diff > 0 ? <span className="text-emerald-600">↑ +{diff.toFixed(1)}%</span>
                                  : diff < 0 ? <span className="text-rose-500">↓ {diff.toFixed(1)}%</span>
                                  : <span className="text-gray-400">→</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <Legend />
                </>
              )}
            </div>
          </div>
        )}

        {/* ── REPORT 6: Class-wise ───────────────────────────────────── */}
        {activeReport === 'classwise' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Class-wise Attendance Report</h2>
                {hasGenerated && selectedClass && (
                  <p className="text-xs text-gray-400 mt-0.5">{selectedClass.name} · {startDate} to {endDate}</p>
                )}
              </div>
              {hasGenerated && classData && (
                <Button variant="outline" size="sm" onClick={() =>
                  doExportCSV(
                    [[classData.className, classData.totalStudents, classData.present, classData.absent, classData.total, `${classData.percentage}%`]],
                    ['Class', 'Total Students', 'Present', 'Absent', 'Total Records', 'Attendance %'],
                    `classwise_report_${classData.className.replace(/ /g,'_')}.csv`
                  )} className="h-8 text-xs rounded-lg border border-gray-200">
                  <Download className="h-3 w-3 mr-1" /> Export CSV
                </Button>
              )}
            </div>

            <div className="p-5">
              {loading ? (
                <div className="flex flex-col items-center py-14 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                  <p className="text-sm text-gray-500">{loadMessage}</p>
                </div>
              ) : !hasGenerated ? <EmptyState /> : !classData ? <EmptyState msg="No data found for this class and period" /> : (
                <div className="space-y-6">
                  {/* Big percentage display */}
                  <div className="flex flex-col items-center justify-center py-10 gap-4">
                    <div
                      className="relative h-44 w-44 flex items-center justify-center rounded-full"
                      style={{
                        background: `conic-gradient(${pctColor(classData.percentage)} ${classData.percentage * 3.6}deg, #f3f4f6 0deg)`,
                      }}
                    >
                      <div className="absolute inset-4 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                        <span className={`text-4xl font-extrabold ${pctTextClass(classData.percentage)}`}>
                          {classData.percentage}%
                        </span>
                        <span className="text-xs text-gray-400 font-medium mt-1">attendance</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-800">{classData.className}</p>
                      <StatusBadge p={classData.percentage} />
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <MetricCard label="Total Students"  value={classData.totalStudents} icon={Users}        bg="bg-indigo-50"  iconColor="text-indigo-600" />
                    <MetricCard label="Total Present"   value={classData.present}       icon={CheckCircle2}  bg="bg-emerald-50" iconColor="text-emerald-600" />
                    <MetricCard label="Total Absent"    value={classData.absent}        icon={AlertTriangle} bg="bg-rose-50"    iconColor="text-rose-600" />
                    <MetricCard label="Total Records"   value={classData.total}         icon={ClipboardList} bg="bg-gray-100"   iconColor="text-gray-500" />
                  </div>

                  {/* Attendance bar */}
                  <div className="rounded-xl border border-gray-100 p-5">
                    <div className="flex justify-between text-xs font-medium text-gray-600 mb-2">
                      <span>Class Attendance</span>
                      <span className={pctTextClass(classData.percentage)}>{classData.percentage}%</span>
                    </div>
                    <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${classData.percentage}%`, backgroundColor: pctColor(classData.percentage) }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-gray-400 mt-2">
                      <span>0%</span>
                      <span className="text-amber-500 font-medium">75% threshold</span>
                      <span>100%</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Present rate</p>
                          <p className="text-base font-bold text-emerald-600">
                            {classData.total > 0 ? ((classData.present / classData.total) * 100).toFixed(1) : 0}%
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                          <AlertTriangle className="h-5 w-5 text-rose-500" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Absent rate</p>
                          <p className="text-base font-bold text-rose-500">
                            {classData.total > 0 ? ((classData.absent / classData.total) * 100).toFixed(1) : 0}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── FOOTER ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-gray-300" />
            <span>
              Institution ID:{' '}
              <span className="font-semibold text-gray-600">{currentUser?.institution_id?.slice(0, 8) || '—'}…</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold border border-emerald-200 text-[10px] uppercase tracking-wide">
              Active
            </span>
          </div>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" />
            {activeReport === 'daily'
              ? `Date: ${selectedDate}`
              : `${startDate} to ${endDate}`}
          </span>
        </div>

      </div>
    </TeacherLayout>
  );
}                