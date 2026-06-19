import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  getStudents,
  getAcademicLabels,
  getAcademicCategories,
  getAllAcademicSubcategories,
  getAllAcademicItems,
} from '@/db/api';
import { attendanceApi } from '@/lib/api';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  CheckCircle, XCircle, Clock, AlertCircle, Users,
  TrendingUp, RefreshCw, Eye, CalendarDays, Shield, Radio,
} from 'lucide-react';
import type {
  Student, AcademicStructureLabel, AcademicCategory,
  AcademicSubcategory, AcademicItem, AttendanceStatus,
} from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface AttendanceFilters {
  date: string;
  categoryId: string;
  subcategoryId: string;
  itemId: string;
}
type ViewMode = 'all' | 'department' | 'class';

// ─────────────────────────────────────────────────────────────────────────────
// Animated Count-Up Hook — identical to AdminDashboard
// ─────────────────────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900) {
  const [count, setCount] = useState(0);
  const frameRef = useRef<number>();
  const startRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    startRef.current = undefined;
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration]);

  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric Card — exact same style as AdminDashboard
// ─────────────────────────────────────────────────────────────────────────────
function MetricCard({
  label, value, icon: Icon, iconBg, iconColor, subtitle, loading,
}: {
  label: string;
  value: number | string;
  icon: any;
  iconBg: string;
  iconColor: string;
  subtitle?: string;
  loading?: boolean;
}) {
  const numVal = typeof value === 'string' ? parseInt(value) || 0 : value;
  const animated = useCountUp(loading ? 0 : numVal);
  const display = typeof value === 'string' && value.includes('%') ? `${animated}%` : animated;

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
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{display}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Avatar helpers
// ─────────────────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-cyan-100 text-cyan-700',
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Attendance Status Badge — dashboard pill style
// ─────────────────────────────────────────────────────────────────────────────
function AttendanceStatusBadge({ status }: { status: AttendanceStatus | 'not_marked' }) {
  const config: Record<string, { label: string; cls: string; dot: string }> = {
    present:    { label: 'Present',    dot: 'bg-emerald-500', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    absent:     { label: 'Absent',     dot: 'bg-rose-500',    cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    late:       { label: 'Late',       dot: 'bg-amber-500',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    excused:    { label: 'Excused',    dot: 'bg-blue-500',    cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    not_marked: { label: 'Not Marked', dot: 'bg-gray-400',    cls: 'bg-gray-50 text-gray-500 border-gray-200' },
  };
  const c = config[status] ?? config.not_marked;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${c.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Group Summary Bar — subtle, dashboard style
// ─────────────────────────────────────────────────────────────────────────────
function GroupSummaryBar({
  title, total, present, absent, percentage,
}: {
  title: string; total: number; present: number; absent: number; percentage: string;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 bg-gray-50/80 border-b border-gray-100">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-50 rounded-lg">
          <Users className="h-4 w-4 text-indigo-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> {present} Present
            </span>
            <span className="text-xs text-rose-600 flex items-center gap-1">
              <XCircle className="h-3 w-3" /> {absent} Absent
            </span>
            <span className="text-xs text-indigo-600 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> {percentage}%
            </span>
          </div>
        </div>
      </div>
      <span className="text-[10px] font-medium text-gray-500 bg-white border border-gray-200 px-2.5 py-1 rounded-full">
        {total} Students
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function LiveAttendancePage() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [labels, setLabels] = useState<AcademicStructureLabel | null>(null);
  const [categories, setCategories] = useState<AcademicCategory[]>([]);
  const [subcategories, setSubcategories] = useState<AcademicSubcategory[]>([]);
  const [items, setItems] = useState<AcademicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const [filters, setFilters] = useState<AttendanceFilters>({
    date: new Date().toISOString().split('T')[0],
    categoryId: '',
    subcategoryId: '',
    itemId: '',
  });

  useEffect(() => { fetchData(); }, [profile?.institution_id]);
  useEffect(() => { applyFilters(); }, [students, filters]);
  useEffect(() => {
    if (filters.categoryId) fetchAttendanceData();
  }, [filters]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!filters.categoryId) return;
    const id = setInterval(() => {
      fetchAttendanceData();
      setLastRefresh(new Date());
    }, 30000);
    return () => clearInterval(id);
  }, [filters.categoryId]);

  const fetchData = async () => {
    if (!profile?.institution_id) return;
    try {
      setLoading(true);
      const [studentsData, labelsData, categoriesData, subcategoriesData, itemsData] = await Promise.all([
        getStudents(profile.institution_id, 1000, 0),
        getAcademicLabels(profile.institution_id),
        getAcademicCategories(profile.institution_id),
        getAllAcademicSubcategories(profile.institution_id),
        getAllAcademicItems(profile.institution_id),
      ]);
      setStudents(studentsData || []);
      setLabels(labelsData || null);
      setCategories(categoriesData || []);
      setSubcategories(subcategoriesData || []);
      setItems(itemsData || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...students];
    if (filters.categoryId) filtered = filtered.filter(s => s.category === filters.categoryId);
    if (filters.subcategoryId) filtered = filtered.filter(s => s.subcategory === filters.subcategoryId);
    if (filters.itemId) filtered = filtered.filter(s => s.item === filters.itemId);
    setFilteredStudents(filtered);
  };

  const fetchAttendanceData = async () => {
    if (!profile?.institution_id || !filters.categoryId) return;
    try {
      setAttendanceLoading(true);
      const sessionParams: any = { date: filters.date, category_id: filters.categoryId };
      if (filters.subcategoryId) sessionParams.subcategory_id = filters.subcategoryId;
      if (filters.itemId) sessionParams.item_id = filters.itemId;

      const sessionsRaw = await attendanceApi.getSessions(sessionParams);
      const sessions: any[] = sessionsRaw?.sessions || sessionsRaw || [];
      if (!sessions.length) { setAttendanceMap({}); return; }

      const map: Record<string, AttendanceStatus> = {};
      await Promise.all(
        sessions.map(async (session: any) => {
          try {
            const recordsRaw = await attendanceApi.getRecords(session.id);
            const records: any[] = recordsRaw?.records || recordsRaw || [];
            records.forEach((r: any) => { map[r.student_id] = r.status as AttendanceStatus; });
          } catch {}
        })
      );
      setAttendanceMap(map);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleRefresh = () => { fetchAttendanceData(); };

  const getCategoryName   = (id?: string) => categories.find(c => c.id === id)?.name || id || '-';
  const getDepartmentName = (id?: string) => subcategories.find((s: any) => s.id === id)?.name || id || '-';
  const getSectionName    = (id?: string) => items.find((i: any) => i.id === id)?.name || id || '-';

  const calculateStats = () => {
    const total      = filteredStudents.length;
    const present    = filteredStudents.filter(s => attendanceMap[s.id] === 'present').length;
    const absent     = filteredStudents.filter(s => attendanceMap[s.id] === 'absent').length;
    const late       = filteredStudents.filter(s => attendanceMap[s.id] === 'late').length;
    const excused    = filteredStudents.filter(s => attendanceMap[s.id] === 'excused').length;
    const notMarked  = total - (present + absent + late + excused);
    const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : '0';
    return { total, present, absent, late, excused, notMarked, percentage };
  };

  const groupStudentsByDepartment = () => {
    const grouped: Record<string, Student[]> = {};
    filteredStudents.forEach(s => {
      const key = s.subcategory || 'unassigned';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    });
    return grouped;
  };

  const groupStudentsByClass = () => {
    const grouped: Record<string, Student[]> = {};
    filteredStudents.forEach(s => {
      const key = s.category || 'unassigned';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    });
    return grouped;
  };

  const stats = calculateStats();
  const hasFilters = !!filters.categoryId;

  // ── Shared table head row (dashboard style) ──
  const TableHeadRow = ({ cols }: { cols: string[] }) => (
    <TableRow className="border-gray-100 hover:bg-transparent bg-gray-50/60">
      {cols.map((col, i) => (
        <TableHead
          key={col}
          className={`text-[10px] font-bold uppercase tracking-widest text-gray-400 ${i === 0 ? 'pl-5' : ''} ${i === cols.length - 1 ? 'text-right pr-5' : ''}`}
        >
          {col}
        </TableHead>
      ))}
    </TableRow>
  );

  // ── Student row (reused in all views) ──
  const StudentRow = ({
    student, showDept = false, showSection = false, showClass = false, padLeft = true,
  }: {
    student: Student; showDept?: boolean; showSection?: boolean; showClass?: boolean; padLeft?: boolean;
  }) => (
    <TableRow className="border-gray-100 hover:bg-indigo-50/20 transition-colors">
      <TableCell className={`${padLeft ? 'pl-5' : 'pl-0'} py-3`}>
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 ring-2 ring-gray-100">
            <AvatarImage src={student.photo_url || undefined} />
            <AvatarFallback className={`text-xs font-bold ${getAvatarColor(student.full_name)}`}>
              {getInitials(student.full_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold text-gray-800 leading-tight">{student.full_name}</p>
            <p className="text-[11px] text-gray-400 font-mono mt-0.5">{student.register_number || '—'}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-3">
        <span className="font-mono text-xs text-gray-400">{student.register_number || '—'}</span>
      </TableCell>
      {showDept && (
        <TableCell className="py-3">
          <span className="text-xs text-gray-600">{getDepartmentName(student.subcategory)}</span>
        </TableCell>
      )}
      {showClass && (
        <TableCell className="py-3">
          <span className="text-xs text-gray-600">{getCategoryName(student.category)}</span>
        </TableCell>
      )}
      {showSection && (
        <TableCell className="py-3">
          <span className="text-xs text-gray-500">{getSectionName(student.item)}</span>
        </TableCell>
      )}
      <TableCell className="py-3 pr-5 text-right">
        <AttendanceStatusBadge status={attendanceMap[student.id] || 'not_marked'} />
      </TableCell>
    </TableRow>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* ── PAGE HEADER (dashboard style) ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Live Attendance
            </h1>
            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-bold uppercase tracking-wide">
                <span className="h-1.5 w-1.5 bg-rose-500 rounded-full animate-pulse" />
                Live
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleRefresh}
              disabled={attendanceLoading || !filters.categoryId}
              variant="outline"
              size="sm"
              className="h-9 px-3 flex items-center gap-1.5 rounded-lg border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:text-indigo-600"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${attendanceLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline text-xs font-medium">Refresh</span>
            </Button>
          </div>
        </div>

        {/* ── FILTER CARD (dashboard card style) ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <div className="p-2 rounded-lg bg-indigo-50">
              <Eye className="h-3.5 w-3.5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">View Filters</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Select a {labels?.category_label?.toLowerCase() || 'category'} to view live attendance
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5">
            {/* Date */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">Date</label>
              <input
                type="date"
                value={filters.date}
                onChange={e => setFilters({ ...filters, date: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 transition-all"
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                {labels?.category_label || 'Category'} <span className="text-rose-500">*</span>
              </label>
              <Select
                value={filters.categoryId}
                onValueChange={value => setFilters({ ...filters, categoryId: value, subcategoryId: '', itemId: '' })}
              >
                <SelectTrigger className="h-10 text-sm border-gray-200 rounded-lg">
                  <SelectValue placeholder={`Select ${labels?.category_label?.toLowerCase() || 'category'}`} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subcategory */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                {labels?.subcategory_label || 'Department'}
              </label>
              <Select
                value={filters.subcategoryId}
                onValueChange={value => setFilters({ ...filters, subcategoryId: value === 'all' ? '' : value, itemId: '' })}
              >
                <SelectTrigger className="h-10 text-sm border-gray-200 rounded-lg">
                  <SelectValue placeholder={`Select ${labels?.subcategory_label?.toLowerCase() || 'department'}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {labels?.subcategory_label || 'Departments'}</SelectItem>
                  {subcategories
                    .filter((sub: any) => sub.category_id === filters.categoryId)
                    .map(sub => <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Item / Section */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">
                {labels?.item_label || 'Section'}
              </label>
              <Select
                value={filters.itemId}
                onValueChange={value => setFilters({ ...filters, itemId: value === 'all' ? '' : value })}
              >
                <SelectTrigger className="h-10 text-sm border-gray-200 rounded-lg">
                  <SelectValue placeholder={`Select ${labels?.item_label?.toLowerCase() || 'section'}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {labels?.item_label || 'Sections'}</SelectItem>
                  {items
                    .filter((item: any) => !filters.subcategoryId || item.subcategory_id === filters.subcategoryId)
                    .map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!filters.categoryId && (
            <div className="mx-5 mb-5 flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 leading-relaxed">
                Please select a <strong>{labels?.category_label?.toLowerCase() || 'category'}</strong> to view live attendance data.
              </p>
            </div>
          )}
        </div>

        {/* ── METRIC CARDS (same as dashboard) ── */}
        {hasFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard
              label="Total Students" value={stats.total} icon={Users}
              iconBg="bg-indigo-50" iconColor="text-indigo-600" subtitle="enrolled" loading={loading}
            />
            <MetricCard
              label="Present" value={stats.present} icon={CheckCircle}
              iconBg="bg-green-50" iconColor="text-green-600" subtitle="on time" loading={loading}
            />
            <MetricCard
              label="Absent" value={stats.absent} icon={XCircle}
              iconBg="bg-red-50" iconColor="text-red-500" subtitle="not present" loading={loading}
            />
            <MetricCard
              label="Late" value={stats.late} icon={Clock}
              iconBg="bg-amber-50" iconColor="text-amber-500" subtitle="late arrivals" loading={loading}
            />
            <MetricCard
              label="Not Marked" value={stats.notMarked} icon={AlertCircle}
              iconBg="bg-gray-50" iconColor="text-gray-400" subtitle="pending" loading={loading}
            />
            <MetricCard
              label="Attendance %" value={`${stats.percentage}%`} icon={TrendingUp}
              iconBg="bg-sky-50" iconColor="text-sky-600" subtitle="today" loading={loading}
            />
          </div>
        )}

        {/* ── LIVE ATTENDANCE TABLE (dashboard card style) ── */}
        {hasFilters && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Table header with view toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Live Attendance Status</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {filteredStudents.length} students · {filters.date}
                  {attendanceLoading && (
                    <span className="ml-2 inline-flex items-center gap-1 text-amber-600">
                      <RefreshCw className="h-3 w-3 animate-spin" /> Updating…
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                {[
                  { val: 'all', label: 'All Students' },
                  { val: 'department', label: `${labels?.subcategory_label || 'Dept'}-wise` },
                  { val: 'class', label: `${labels?.category_label || 'Class'}-wise` },
                ].map(tab => (
                  <button
                    key={tab.val}
                    onClick={() => setViewMode(tab.val as ViewMode)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                      viewMode === tab.val
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            {loading ? (
              <div className="p-5 space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg bg-gray-100" />)}
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Users className="h-6 w-6 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-400">No students found</p>
                <p className="text-xs text-gray-300">No students assigned to this selection</p>
              </div>
            ) : viewMode === 'all' ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableHeadRow cols={[
                      'Student', 'Register No.',
                      labels?.subcategory_label || 'Department',
                      labels?.item_label || 'Section',
                      'Status',
                    ]} />
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map(student => (
                      <StudentRow key={student.id} student={student} showDept showSection />
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : viewMode === 'department' ? (
              <div className="divide-y divide-gray-100">
                {Object.entries(groupStudentsByDepartment()).map(([deptId, deptStudents]) => {
                  const p = deptStudents.filter(s => attendanceMap[s.id] === 'present').length;
                  const a = deptStudents.filter(s => attendanceMap[s.id] === 'absent').length;
                  const pct = deptStudents.length > 0 ? ((p / deptStudents.length) * 100).toFixed(1) : '0';
                  return (
                    <div key={deptId}>
                      <GroupSummaryBar
                        title={getDepartmentName(deptId)}
                        total={deptStudents.length}
                        present={p} absent={a} percentage={pct}
                      />
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableHeadRow cols={['Student', 'Register No.', labels?.item_label || 'Section', 'Status']} />
                          </TableHeader>
                          <TableBody>
                            {deptStudents.map(student => (
                              <StudentRow key={student.id} student={student} showSection />
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {Object.entries(groupStudentsByClass()).map(([classId, classStudents]) => {
                  const p = classStudents.filter(s => attendanceMap[s.id] === 'present').length;
                  const a = classStudents.filter(s => attendanceMap[s.id] === 'absent').length;
                  const pct = classStudents.length > 0 ? ((p / classStudents.length) * 100).toFixed(1) : '0';
                  return (
                    <div key={classId}>
                      <GroupSummaryBar
                        title={getCategoryName(classId)}
                        total={classStudents.length}
                        present={p} absent={a} percentage={pct}
                      />
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableHeadRow cols={[
                              'Student', 'Register No.',
                              labels?.subcategory_label || 'Department',
                              labels?.item_label || 'Section',
                              'Status',
                            ]} />
                          </TableHeader>
                          <TableBody>
                            {classStudents.map(student => (
                              <StudentRow key={student.id} student={student} showDept showSection />
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── FOOTER (dashboard style) ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-gray-300" />
            <span>
              Institution ID:{' '}
              <span className="font-semibold text-gray-600">{profile?.institution_id?.slice(0, 8) || '—'}…</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-bold border border-rose-100 text-[10px] uppercase tracking-wide flex items-center gap-1">
              <span className="h-1.5 w-1.5 bg-rose-500 rounded-full animate-pulse" />
              Live
            </span>
          </div>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Auto-refreshes every 30s · Last: {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </AdminLayout>
  );
}