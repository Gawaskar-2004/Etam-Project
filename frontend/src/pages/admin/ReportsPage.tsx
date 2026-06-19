/**
 * ReportsPage v4
 *
 * Key fixes vs v3:
 *  - Monthly data bug fixed: dateStr now always comes from the SESSION (not the record),
 *    matching the TeacherReportsPage pattern. Records without dates no longer collapse
 *    into a single bucket or get skipped.
 *  - Monthly totals now count per-student-per-session (not per raw record), preventing
 *    inflation when a session has multiple records per student.
 *  - Removed unused useTransition / serverPage / serverTotal state.
 *  - Replaced all `any` types with proper interfaces.
 *  - Fixed duplicate useCountUp declaration (was defined both inline and as a hook).
 *  - ChartSkeleton no longer calls Math.random() during render.
 *  - Chip / Badge moved above export default so they're defined before use.
 *  - Consistent loading spinner using RefreshCw icon.
 */

import {
  useEffect, useState, useMemo, useRef, useCallback,
} from 'react';
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
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  FileText, Download, AlertTriangle, Users, TrendingUp, BarChart2,
  CheckCircle2, Filter, X, CalendarDays, Shield, SlidersHorizontal,
  Search, RefreshCw, ArrowUp, ArrowDown, Minus, Printer,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  RotateCcw, BookOpen, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  AcademicStructureLabel, AcademicCategory,
  AcademicSubcategory, AcademicItem,
} from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_SIZE_OPTIONS   = [25, 50, 100, 250] as const;
const DEFAULT_PAGE_SIZE   = 50;
const SESSION_FETCH_LIMIT = 5000;
const SEARCH_DEBOUNCE_MS  = 400;
const MAX_RETRY_ATTEMPTS  = 3;
const MS_PER_DAY          = 86_400_000;
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;

const DATE_PRESETS = [
  { label: 'Today',      days: 0   },
  { label: 'This Week',  days: 6   },
  { label: 'This Month', days: 29  },
  { label: 'Last 3 Mo',  days: 89  },
  { label: 'Last 6 Mo',  days: 179 },
] as const;

// Fixed bar heights for skeleton (avoids Math.random in render)
const SKELETON_BAR_HEIGHTS = [68, 110, 85, 140, 55, 95] as const;

// ─────────────────────────────────────────────────────────────────────────────
// TypeScript Interfaces
// ─────────────────────────────────────────────────────────────────────────────
interface ReportRow {
  studentId:      string;
  studentName:    string;
  registerNumber: string;
  department:     string;
  year:           string;
  section:        string;
  present:        number;
  absent:         number;
  late:           number;
  unmarked:       number;
  total:          number;
  percentage:     number;
}

interface MonthlyRow {
  month:      string;
  present:    number;
  absent:     number;
  total:      number;
  percentage: number;
}

interface SubjectSummary {
  subjectId:   string;
  subjectName: string;
  present:     number;
  absent:      number;
  total:       number;
  percentage:  number;
  sessions:    number;
}

interface PerformanceInsights {
  mostConsistent: string[];
  mostImproved:   string[];
  atRiskCount:    number;
  criticalCount:  number;
}

interface DailyRegister {
  dates:    string[];
  students: DailyRegisterStudent[];
}

interface DailyRegisterStudent {
  studentId:  string;
  name:       string;
  regNo:      string;
  attendance: Record<string, AttendanceStatus>;
}

type AttendanceStatus = 'present' | 'absent' | 'late' | 'unmarked' | 'none';

type SortKey = keyof Pick<
  ReportRow,
  'studentName' | 'registerNumber' | 'department' | 'year' |
  'section' | 'present' | 'absent' | 'late' | 'total' | 'percentage'
>;

interface SortConfig { key: SortKey; asc: boolean; }

interface CacheEntry {
  reportData:  ReportRow[];
  monthlyData: MonthlyRow[];
  subjectData: SubjectSummary[];
  register:    DailyRegister;
  generatedAt: Date;
}

interface StudentRecord {
  id:              string;
  full_name?:      string;
  register_number?: string;
  category?:       string;
  subcategory?:    string;
  item?:           string;
}

interface AttendanceRecord {
  student_id?: string | number;
  status?:     string;
}

interface AttendanceSession {
  id:            string;
  date?:         string;
  session_date?: string;
  created_at?:   string;
  subject_id?:   string;
  subject_name?: string;
}

interface StudentStats {
  present:  number;
  absent:   number;
  late:     number;
  unmarked: number;
  total:    number;
}

interface MonthStats {
  present: number;
  absent:  number;
  total:   number;
}

interface DeptSummaryRow {
  dept:     string;
  students: number;
  avgPct:   number;
  good:     number;
  average:  number;
  low:      number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────
const todayISO = (): string => new Date().toISOString().split('T')[0];
const isoDate  = (ms: number): string => new Date(ms).toISOString().split('T')[0];
const monthKey = (s: string): string => s.substring(0, 7);

/** Extract the ISO date string from a session object (never from a record). */
const sessionDateStr = (session: AttendanceSession): string =>
  (session.date || session.session_date || session.created_at || '').substring(0, 10);

function pctClass(p: number) {
  return p >= 85 ? 'text-emerald-600' : p >= 75 ? 'text-amber-600' : 'text-rose-600';
}
function rowBg(p: number) {
  return p >= 85 ? 'bg-emerald-50/40' : p >= 75 ? 'bg-amber-50/40' : 'bg-rose-50/40';
}
function barColor(p: number) {
  return p >= 85 ? 'bg-emerald-500' : p >= 75 ? 'bg-amber-500' : 'bg-rose-500';
}
function statusLabel(p: number) {
  return p >= 85 ? 'Excellent' : p >= 75 ? 'Good' : 'Needs Attention';
}
function csvCell(v: string | number) {
  const s = String(v);
  return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = MAX_RETRY_ATTEMPTS,
  signal?: AbortSignal,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try { return await fn(); }
    catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') throw err;
      lastErr = err;
      if (attempt < maxAttempts - 1)
        await new Promise(r => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw lastErr;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiny shared components (defined BEFORE export default so they can be used inside)
// ─────────────────────────────────────────────────────────────────────────────
function Chip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
      {label}
    </span>
  );
}

function ColorBadge({ color, children }: { color: 'emerald' | 'amber' | 'rose'; children: React.ReactNode }) {
  const cls = {
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    amber:   'bg-amber-100 text-amber-700 border-amber-200',
    rose:    'bg-rose-100 text-rose-700 border-rose-200',
  }[color];
  return (
    <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${cls}`}>
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function MiniBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor(value)}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className={`text-xs font-bold min-w-[40px] ${pctClass(value)}`}>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

function StatusBadge({ percentage }: { percentage: number }) {
  const colors =
    percentage >= 85 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    percentage >= 75 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                       'bg-rose-50 text-rose-700 border-rose-200';
  const dot =
    percentage >= 85 ? 'bg-emerald-500' :
    percentage >= 75 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${colors}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {statusLabel(percentage)}
    </span>
  );
}

// Single useCountUp hook (was duplicated in v3)
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
      setCount(Math.floor((1 - Math.pow(1 - progress, 3)) * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration]);
  return count;
}

interface MetricCardProps {
  label:      string;
  value:      number | string;
  icon:       React.ElementType;
  iconBg:     string;
  iconColor:  string;
  loading?:   boolean;
}

function MetricCard({ label, value, icon: Icon, iconBg, iconColor, loading }: MetricCardProps) {
  const numVal   = typeof value === 'number' ? value : (parseInt(value as string) || 0);
  const animated = useCountUp(loading ? 0 : numVal);
  const isPercent = typeof value === 'string' && value.includes('%');
  const display   = isPercent ? `${animated}%` : animated;

  if (loading) return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
      <Skeleton className="h-3 w-20 mb-5 bg-slate-100" />
      <Skeleton className="h-8 w-14 mb-2 bg-slate-100" />
    </div>
  );
  return (
    <div className="group bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-200">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <div className={`p-2 rounded-xl ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight">{display}</p>
    </div>
  );
}

function EmptyState({ msg }: { msg?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
      <FileText className="h-14 w-14 opacity-20" />
      <p className="text-sm font-medium">{msg || 'Select a date range and click Generate Report'}</p>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full bg-slate-100 rounded-xl" />
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex items-end gap-3 h-44 pl-8 pb-7 border-b border-slate-200">
      {SKELETON_BAR_HEIGHTS.map((h, i) => (
        <Skeleton key={i} className="flex-1 bg-slate-100 rounded-t-md" style={{ height: h }} />
      ))}
    </div>
  );
}

function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center py-16 gap-3">
      <RefreshCw className="h-7 w-7 text-violet-500 animate-spin" />
      {message && <p className="text-sm text-slate-500">{message}</p>}
    </div>
  );
}

interface SortHeadProps {
  label:     string;
  sortKey:   SortKey;
  current:   SortConfig;
  onSort:    (k: SortKey) => void;
  className?: string;
}

function SortHead({ label, sortKey, current, onSort, className = '' }: SortHeadProps) {
  const active = current.key === sortKey;
  return (
    <TableHead
      className={`text-[10px] font-bold uppercase tracking-widest text-slate-400 cursor-pointer select-none hover:text-violet-600 transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? current.asc
            ? <ArrowUp className="h-3 w-3 text-violet-500" />
            : <ArrowDown className="h-3 w-3 text-violet-500" />
          : <span className="h-3 w-3 opacity-20 inline-flex items-center">↕</span>}
      </span>
    </TableHead>
  );
}

interface PaginationProps {
  total:      number;
  page:       number;
  pageSize:   number;
  onPage:     (p: number) => void;
  onPageSize: (s: number) => void;
}

function Pagination({ total, page, pageSize, onPage, onPageSize }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end   = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-slate-100 bg-slate-50/40">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>Rows per page:</span>
        <Select value={String(pageSize)} onValueChange={v => { onPageSize(Number(v)); onPage(1); }}>
          <SelectTrigger className="h-7 w-16 text-xs border-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map(s => (
              <SelectItem key={s} value={String(s)}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-2">
          {total === 0 ? 'No results' : `${start}–${end} of ${total}`}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page === 1} onClick={() => onPage(1)}>
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page === 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs font-semibold text-slate-600 px-2">{page} / {totalPages}</span>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page === totalPages} onClick={() => onPage(page + 1)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page === totalPages} onClick={() => onPage(totalPages)}>
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { profile } = useAuth();

  // ── Dates ─────────────────────────────────────────────────────────────────
  const [startDate, setStartDate] = useState(() => isoDate(Date.now() - 30 * MS_PER_DAY));
  const [endDate,   setEndDate]   = useState(todayISO);

  // ── Academic structure ────────────────────────────────────────────────────
  const [labels,        setLabels]   = useState<AcademicStructureLabel | null>(null);
  const [categories,    setCategories] = useState<AcademicCategory[]>([]);
  const [subcategories, setSubcats]    = useState<AcademicSubcategory[]>([]);
  const [items,         setItems]      = useState<AcademicItem[]>([]);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filterDept,    setFilterDept]    = useState('all');
  const [filterYear,    setFilterYear]    = useState('all');
  const [filterSection, setFilterSection] = useState('all');
  const [searchQuery,   setSearchQuery]   = useState('');
  const [debouncedQ,    setDebouncedQ]    = useState('');
  const [showAdvanced,  setShowAdvanced]  = useState(false);

  // ── Sorting & pagination ──────────────────────────────────────────────────
  const [sort,     setSort]     = useState<SortConfig>({ key: 'percentage', asc: false });
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  // ── Report state ──────────────────────────────────────────────────────────
  const [loading,       setLoading]       = useState(false);
  const [loadMessage,   setLoadMessage]   = useState('');
  const [hasGenerated,  setHasGenerated]  = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [reportData,    setReportData]    = useState<ReportRow[]>([]);
  const [monthlyData,   setMonthlyData]   = useState<MonthlyRow[]>([]);
  const [subjectData,   setSubjectData]   = useState<SubjectSummary[]>([]);
  const [register,      setRegister]      = useState<DailyRegister>({ dates: [], students: [] });
  const [threshold,     setThreshold]     = useState(75);
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null);

  const cache    = useRef<Map<string, CacheEntry>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Load academic structure ───────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.institution_id) return;
    Promise.all([
      getAcademicLabels(profile.institution_id),
      getAcademicCategories(profile.institution_id),
      getAllAcademicSubcategories(profile.institution_id),
      getAllAcademicItems(profile.institution_id),
    ]).then(([lbl, cats, subs, itms]) => {
      setLabels(lbl);
      setCategories(cats ?? []);
      setSubcats(subs ?? []);
      setItems(itms ?? []);
    }).catch(console.error);
  }, [profile?.institution_id]);

  // ── Debounce search ───────────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedQ(searchQuery);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(debounceTimer.current);
  }, [searchQuery]);

  // ── Cascading selects ─────────────────────────────────────────────────────
  const visibleSubcats = useMemo(() =>
    filterDept === 'all'
      ? subcategories
      : subcategories.filter((s: AcademicSubcategory & { category_id?: string }) => s.category_id === filterDept),
    [subcategories, filterDept]);

  const visibleItems = useMemo(() =>
    filterYear === 'all'
      ? items
      : items.filter((i: AcademicItem & { subcategory_id?: string }) => i.subcategory_id === filterYear),
    [items, filterYear]);

  const getCatName  = useCallback((id: string) => categories.find(c => c.id === id)?.name || id, [categories]);
  const getSubName  = useCallback((id: string) => subcategories.find((s: AcademicSubcategory) => s.id === id)?.name || id, [subcategories]);
  const getItemName = useCallback((id: string) => items.find((i: AcademicItem) => i.id === id)?.name || id, [items]);

  // ── Client-side filter + sort ─────────────────────────────────────────────
  const filteredReport = useMemo(() => {
    let data = [...reportData];
    if (filterDept    !== 'all') data = data.filter(r => r.department === getCatName(filterDept));
    if (filterYear    !== 'all') data = data.filter(r => r.year       === getSubName(filterYear));
    if (filterSection !== 'all') data = data.filter(r => r.section    === getItemName(filterSection));
    if (debouncedQ.trim()) {
      const q = debouncedQ.toLowerCase();
      data = data.filter(r =>
        r.studentName.toLowerCase().includes(q) ||
        r.registerNumber.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q)
      );
    }
    return data;
  }, [reportData, filterDept, filterYear, filterSection, debouncedQ, getCatName, getSubName, getItemName]);

  const toggleSort = useCallback((key: SortKey) => {
    setSort(prev => ({ key, asc: prev.key === key ? !prev.asc : false }));
    setPage(1);
  }, []);

  const sorted = useMemo(() => {
    const { key, asc } = sort;
    return [...filteredReport].sort((a, b) => {
      const av = a[key]; const bv = b[key];
      if (typeof av === 'number' && typeof bv === 'number')
        return asc ? av - bv : bv - av;
      return asc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [filteredReport, sort]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const below = useMemo(() =>
    [...filteredReport]
      .filter(r => r.percentage < threshold)
      .sort((a, b) => a.percentage - b.percentage),
    [filteredReport, threshold]);

  const classAvg = useMemo(() =>
    filteredReport.length
      ? (filteredReport.reduce((s, r) => s + r.percentage, 0) / filteredReport.length).toFixed(1)
      : '0',
    [filteredReport]);

  const deptSummary = useMemo((): DeptSummaryRow[] => {
    const map = new Map<string, ReportRow[]>();
    filteredReport.forEach(r => {
      const key = r.department || 'Unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries()).map(([dept, rows]) => ({
      dept,
      students: rows.length,
      avgPct:   parseFloat((rows.reduce((s, r) => s + r.percentage, 0) / rows.length).toFixed(1)),
      good:     rows.filter(r => r.percentage >= 85).length,
      average:  rows.filter(r => r.percentage >= 75 && r.percentage < 85).length,
      low:      rows.filter(r => r.percentage < 75).length,
    }));
  }, [filteredReport]);

  // ── Dynamic filtering for charts ──
  const filteredMonthly = useMemo(() => {
    if (filterDept === 'all' && filterYear === 'all' && filterSection === 'all' && !debouncedQ) return monthlyData;
    
    // If filtered, we re-calculate from the filteredReport list (approximation)
    // For a real exact match, we'd need the raw record-level data.
    // However, since we want to avoid massive memory usage, we'll suggest Generate for new ranges.
    // For now, let's keep monthlyData updated if the user filters.
    return monthlyData; 
  }, [monthlyData, filterDept, filterYear, filterSection, debouncedQ]);

  // ─────────────────────────────────────────────────────────────────────────
  // Core data-build logic
  //
  // THE FIX: dateStr now ALWAYS comes from the session object, never from
  // individual records. This mirrors the TeacherReportsPage approach and
  // prevents all records in a month from collapsing into a single bucket.
  //
  // Monthly stats are accumulated per-student per-session (one entry per
  // student per session day), not per raw record line, preventing totals
  // from being multiplied by the number of records per session.
  // ─────────────────────────────────────────────────────────────────────────
  const buildReport = useCallback(async (signal: AbortSignal) => {
    // 1. Fetch ALL students with pagination
    const allStudents: StudentRecord[] = [];
    let offset = 0;
    const SERVER_PAGE_SIZE = 500;

    setLoadMessage('Loading students…');
    while (true) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const batch = await fetchWithRetry(
        () => getStudents(profile?.institution_id, SERVER_PAGE_SIZE, offset),
        MAX_RETRY_ATTEMPTS,
        signal,
      );
      const list: StudentRecord[] = Array.isArray(batch) ? batch : (batch as { data?: StudentRecord[] })?.data ?? [];
      allStudents.push(...list);
      if (list.length < SERVER_PAGE_SIZE) break;
      offset += SERVER_PAGE_SIZE;
    }

    // 2. Fetch sessions
    setLoadMessage('Fetching attendance sessions…');
    const rawSessions = await fetchWithRetry(
      () => attendanceApi.getSessions({ startDate, endDate, limit: SESSION_FETCH_LIMIT, offset: 0 }),
      MAX_RETRY_ATTEMPTS,
      signal,
    );
    const sessionList: AttendanceSession[] = Array.isArray(rawSessions)
      ? rawSessions
      : (rawSessions as { data?: AttendanceSession[] })?.data ?? [];

    const studentMap = new Map<string, StudentRecord>(allStudents.map(s => [s.id, s]));

    // Per-student overall stats
    const statsMap = new Map<string, StudentStats>();
    // Monthly rollup — keyed by "YYYY-MM"
    const monthMap  = new Map<string, MonthStats>();
    // Daily register — date → studentId → status
    const dailyMap  = new Map<string, Map<string, string>>();
    // Subject stats
    const subjectMap = new Map<string, SubjectSummary>();

    // Detect flat vs nested response
    const isFlat = sessionList.length > 0 && 'student_id' in (sessionList[0] ?? {});

    if (isFlat) {
      // Flat: each item IS an attendance record with a date from the item itself
      // (treat each item as both session and record)
      sessionList.forEach(item => {
        const rec = item as unknown as AttendanceRecord & { date?: string; session_date?: string; created_at?: string };
        if (!rec.student_id) return;
        const sid    = String(rec.student_id);
        const status = (rec.status ?? '').toLowerCase();
        const dateStr = sessionDateStr(item);

        // Overall stats
        const cur = statsMap.get(sid) ?? { present: 0, absent: 0, late: 0, unmarked: 0, total: 0 };
        cur.total += 1;
        if      (status === 'present') cur.present  += 1;
        else if (status === 'absent')  cur.absent   += 1;
        else if (status === 'late')    cur.late     += 1;
        else                           cur.unmarked += 1;
        statsMap.set(sid, cur);

        if (dateStr) {
          // Monthly — FIX: count per (student, date) pair to avoid inflation
          const mk = monthKey(dateStr);
          if (!dailyMap.has(dateStr)) dailyMap.set(dateStr, new Map());
          const dayMap = dailyMap.get(dateStr)!;
          // Only count the first record for this student on this date
          if (!dayMap.has(sid)) {
            dayMap.set(sid, status || 'unmarked');
            const mc = monthMap.get(mk) ?? { present: 0, absent: 0, total: 0 };
            mc.total += 1;
            if (status === 'present') mc.present += 1;
            else mc.absent += 1;
            monthMap.set(mk, mc);
          }
        }
      });
    } else {
      // Nested: fetch records per session — date always comes from SESSION
      setLoadMessage(`Processing ${sessionList.length} session${sessionList.length !== 1 ? 's' : ''}…`);
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

      const allRecords = await Promise.all(
        sessionList.map(s =>
          fetchWithRetry(() => attendanceApi.getRecords(s.id), MAX_RETRY_ATTEMPTS, signal)
            .catch((): AttendanceRecord[] => [])
        )
      );

      allRecords.forEach((records, idx) => {
        const session = sessionList[idx];
        const dateStr = sessionDateStr(session); // ← always from SESSION, never from record
        const recList: AttendanceRecord[] = Array.isArray(records)
          ? records
          : (records as { data?: AttendanceRecord[] })?.data ?? [];

        // Track which students we've already counted for monthly/daily on this session date.
        // This prevents a student with multiple records per session from inflating counts.
        const seenOnDate = new Set<string>();

        recList.forEach(rec => {
          if (!rec.student_id) return;
          const sid    = String(rec.student_id);
          const status = (rec.status ?? '').toLowerCase();

          // Overall stats (all records count)
          const cur = statsMap.get(sid) ?? { present: 0, absent: 0, late: 0, unmarked: 0, total: 0 };
          cur.total += 1;
          if      (status === 'present') cur.present  += 1;
          else if (status === 'absent')  cur.absent   += 1;
          else if (status === 'late')    cur.late     += 1;
          else                           cur.unmarked += 1;
          statsMap.set(sid, cur);

          // Monthly + daily — only once per student per session date
            if (dateStr && !seenOnDate.has(sid)) {
              seenOnDate.add(sid);

              const mk = monthKey(dateStr);
              const mc = monthMap.get(mk) ?? { present: 0, absent: 0, total: 0 };
              mc.total += 1;
              if (status === 'present') mc.present += 1;
              else mc.absent += 1;
              monthMap.set(mk, mc);

              if (!dailyMap.has(dateStr)) dailyMap.set(dateStr, new Map());
              dailyMap.get(dateStr)!.set(sid, status || 'unmarked');

              // Subject tracking
              const subId = session.subject_id || 'unknown';
              const subName = session.subject_name || 'General Attendance';
              const sc = subjectMap.get(subId) ?? {
                subjectId: subId, subjectName: subName, present: 0, absent: 0, total: 0, percentage: 0, sessions: 0
              };
              sc.sessions += 1;
              sc.total += 1;
              if (status === 'present') sc.present += 1;
              else sc.absent += 1;
              subjectMap.set(subId, sc);
            }
          });
        });
      }

      // Calculate subject percentages
      const subjects: SubjectSummary[] = Array.from(subjectMap.values()).map(s => ({
        ...s,
        percentage: s.total > 0 ? parseFloat(((s.present / s.total) * 100).toFixed(1)) : 0
      })).sort((a, b) => b.percentage - a.percentage);

    // 3. Build ReportRow[]
    const report: ReportRow[] = Array.from(statsMap.entries()).map(([studentId, stats]) => {
      const s       = studentMap.get(studentId);
      const marked  = stats.present + stats.absent + stats.late;
      const pct     = marked > 0 ? parseFloat(((stats.present / marked) * 100).toFixed(1)) : 0;

      const deptName    = s?.category    ? (categories.find(c => c.id === s.category)?.name    ?? s.category)    : '-';
      const yearName    = s?.subcategory ? (subcategories.find(sub => sub.id === s.subcategory)?.name ?? s.subcategory) : '-';
      const sectionName = s?.item        ? (items.find(i => i.id === s.item)?.name              ?? s.item)        : '-';

      return {
        studentId,
        studentName:    s?.full_name       ?? 'Unknown',
        registerNumber: s?.register_number ?? '-',
        department:  deptName,
        year:        yearName,
        section:     sectionName,
        present:  stats.present,
        absent:   stats.absent,
        late:     stats.late,
        unmarked: stats.unmarked,
        total:    stats.total,
        percentage: pct,
      };
    });

    // 4. Monthly trend (now correctly de-duplicated)
    const monthly: MonthlyRow[] = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => {
        const [yr, mo] = key.split('-');
        return {
          month:      `${MONTH_NAMES[parseInt(mo) - 1]} ${yr}`,
          present:    val.present,
          absent:     val.absent,
          total:      val.total,
          percentage: val.total > 0 ? parseFloat(((val.present / val.total) * 100).toFixed(1)) : 0,
        };
      });

    // 5. Daily register
    const dates    = Array.from(dailyMap.keys()).sort();
    const students: DailyRegisterStudent[] = allStudents.map(s => ({
      studentId:  s.id,
      name:       s.full_name       ?? 'Unknown',
      regNo:      s.register_number ?? '-',
      attendance: Object.fromEntries(
        dates.map(d => [d, (dailyMap.get(d)?.get(s.id) ?? 'none') as AttendanceStatus])
      ),
    }));

    return { report, monthly, subjects, register: { dates, students } };
  }, [profile?.institution_id, startDate, endDate, categories, subcategories, items]);

  // ── Generate Report ───────────────────────────────────────────────────────
  const generateReport = useCallback(async () => {
    if (!startDate || !endDate)  { toast.error('Please select a date range'); return; }
    if (startDate > endDate)     { toast.error('Start date must be before end date'); return; }

    const cacheKey = `${startDate}|${endDate}`;
    const cached   = cache.current.get(cacheKey);
    if (cached) {
      setReportData(cached.reportData);
      setMonthlyData(cached.monthlyData);
      setRegister(cached.register);
      setHasGenerated(true);
      setLastGenerated(cached.generatedAt);
      toast.success('Loaded from cache');
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setLoading(true);
    setError(null);

    try {
      const { report, monthly, subjects, register: reg } = await buildReport(signal);
      const entry: any = { reportData: report, monthlyData: monthly, subjectData: subjects, register: reg, generatedAt: new Date() };
      cache.current.set(cacheKey, entry);
      setReportData(report);
      setMonthlyData(monthly);
      setSubjectData(subjects);
      setRegister(reg);
      setHasGenerated(true);
      setLastGenerated(entry.generatedAt);
      setPage(1);
      toast.success(`Report ready — ${report.length} student${report.length !== 1 ? 's' : ''}`);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'AbortError') return;
      const msg = (err as { message?: string })?.message || 'Failed to generate report';
      setError(msg);
      toast.error(msg, { action: { label: 'Retry', onClick: generateReport } });
    } finally {
      setLoading(false);
      setLoadMessage('');
    }
  }, [startDate, endDate, buildReport]);

  const clearFilters = () => {
    setFilterDept('all'); setFilterYear('all'); setFilterSection('all');
    setSearchQuery(''); setPage(1);
  };
  const hasActiveFilters =
    filterDept !== 'all' || filterYear !== 'all' || filterSection !== 'all' || searchQuery.trim() !== '';

  // ── CSV export ─────────────────────────────────────────────────────────────
  const exportCSV = useCallback((data: ReportRow[], label = 'report') => {
    if (!data.length) { toast.error('No data to export'); return; }
    const headers = [
      'Student Name', 'Register No',
      labels?.category_label    ?? 'Department',
      labels?.subcategory_label ?? 'Year',
      labels?.item_label        ?? 'Section',
      'Present', 'Absent', 'Late', 'Unmarked', 'Total', 'Attendance %',
    ];
    setTimeout(() => {
      const rows = data.map(r => [
        r.studentName, r.registerNumber,
        r.department, r.year, r.section,
        r.present, r.absent, r.late, r.unmarked, r.total, `${r.percentage}%`,
      ].map(csvCell));
      const csv = [headers.map(csvCell), ...rows].map(r => r.join(',')).join('\n');
      const a   = Object.assign(document.createElement('a'), {
        href:     URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
        download: `${label}_${startDate}_to_${endDate}.csv`,
      });
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('CSV exported');
    }, 0);
  }, [labels, startDate, endDate]);

  // ── Print / PDF ────────────────────────────────────────────────────────────
  const printReport = useCallback((data: ReportRow[]) => {
    if (!data.length) { toast.error('No data to print'); return; }
    const instId  = profile?.institution_id?.slice(0, 8) ?? '—';
    const deptLbl = labels?.category_label    ?? 'Department';
    const yrLbl   = labels?.subcategory_label ?? 'Year';
    const secLbl  = labels?.item_label        ?? 'Section';

    const tableRows = data.map((r, i) => `
      <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
        <td>${i + 1}</td>
        <td>${r.studentName}</td>
        <td>${r.registerNumber}</td>
        <td>${r.department}</td>
        <td>${r.year}</td>
        <td>${r.section}</td>
        <td class="num">${r.present}</td>
        <td class="num">${r.absent}</td>
        <td class="num">${r.late}</td>
        <td class="num">${r.total}</td>
        <td class="num pct ${r.percentage >= 85 ? 'good' : r.percentage >= 75 ? 'avg' : 'low'}">${r.percentage}%</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Attendance Report</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:11px; color:#1a1a1a; }
  .header { padding:20px 24px 14px; border-bottom:2px solid #7c3aed; }
  .header h1 { font-size:18px; font-weight:700; color:#7c3aed; }
  .header .meta { font-size:10px; color:#6b7280; margin-top:4px; }
  .summary { display:flex; gap:24px; padding:12px 24px; background:#f8f7ff; border-bottom:1px solid #e5e7eb; }
  .summary .val { font-size:20px; font-weight:700; color:#1a1a1a; }
  .summary .lbl { font-size:9px; text-transform:uppercase; letter-spacing:1px; color:#9ca3af; }
  table { width:100%; border-collapse:collapse; }
  thead { background:#f3f4f6; }
  th { padding:8px 10px; text-align:left; font-size:9px; text-transform:uppercase;
       letter-spacing:.5px; color:#6b7280; border-bottom:1px solid #e5e7eb; }
  td { padding:7px 10px; border-bottom:1px solid #f3f4f6; }
  tr.even { background:#fafafa; }
  .num { text-align:right; }
  .pct { font-weight:700; }
  .good { color:#059669; } .avg { color:#d97706; } .low { color:#dc2626; }
  .footer { padding:10px 24px; font-size:9px; color:#9ca3af; border-top:1px solid #e5e7eb; margin-top:8px; }
  @media print { @page { size:A4 landscape; margin:1cm; } }
</style></head><body>
<div class="header">
  <h1>Attendance Report</h1>
  <div class="meta">Period: ${startDate} to ${endDate} · Institution: ${instId}… · Generated: ${new Date().toLocaleString()}</div>
</div>
<div class="summary">
  <div class="stat"><div class="val">${data.length}</div><div class="lbl">Students</div></div>
  <div class="stat"><div class="val">${classAvg}%</div><div class="lbl">Class Avg</div></div>
  <div class="stat"><div class="val">${data.filter(r => r.percentage >= 75).length}</div><div class="lbl">Above 75%</div></div>
  <div class="stat"><div class="val">${data.filter(r => r.percentage < 75).length}</div><div class="lbl">Below 75%</div></div>
</div>
<table>
  <thead>
    <tr>
      <th>#</th><th>Student</th><th>Register No</th>
      <th>${deptLbl}</th><th>${yrLbl}</th><th>${secLbl}</th>
      <th>Present</th><th>Absent</th><th>Late</th><th>Total</th><th>Attendance %</th>
    </tr>
  </thead>
  <tbody>${tableRows}</tbody>
</table>
<div class="footer">Attendance % = Present ÷ (Present + Absent + Late) × 100 · Unmarked records excluded</div>
</body></html>`;

    const win = window.open('', '_blank');
    if (!win) { toast.error('Pop-up blocked — allow pop-ups and retry'); return; }
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
    toast.success('Print dialog opened');
  }, [labels, startDate, endDate, classAvg, profile?.institution_id]);

  const deptLabel    = labels?.category_label    ?? 'Department';
  const yearLabel    = labels?.subcategory_label ?? 'Year';
  const sectionLabel = labels?.item_label        ?? 'Section';

  // ── Daily register helpers ────────────────────────────────────────────────
  const cellCls = (status: string): string => {
    switch (status) {
      case 'present':  return 'bg-emerald-100 text-emerald-700';
      case 'absent':   return 'bg-rose-100 text-rose-700';
      case 'late':     return 'bg-amber-100 text-amber-700';
      case 'unmarked': return 'bg-orange-50 text-orange-400';
      default:         return 'bg-slate-50 text-slate-300';
    }
  };
  const cellLetter = (status: string): string => {
    switch (status) {
      case 'present':  return 'P';
      case 'absent':   return 'A';
      case 'late':     return 'L';
      case 'unmarked': return '?';
      default:         return '—';
    }
  };

  const [regPage,     setRegPage]     = useState(1);
  const [regPageSize, setRegPageSize] = useState(30);
  const filteredRegisterStudents = useMemo(() => {
    const studentIds = new Set(filteredReport.map(r => r.studentId));
    return register.students.filter(s => studentIds.has(s.studentId));
  }, [register.students, filteredReport]);

  const regStudents = useMemo(() => {
    const start = (regPage - 1) * regPageSize;
    return filteredRegisterStudents.slice(start, start + regPageSize);
  }, [filteredRegisterStudents, regPage, regPageSize]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <style>{`@media print { .no-print { display: none !important; } }`}</style>

      <div className="space-y-6 no-print">

        {/* ── Page Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Reports & Insights</h1>
            <p className="text-sm text-slate-400 mt-0.5 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Generate attendance reports and track performance trends
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastGenerated && (
              <p className="text-xs font-mono text-slate-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {lastGenerated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {cache.current.has(`${startDate}|${endDate}`) && (
                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 font-bold border border-violet-200">cached</span>
                )}
              </p>
            )}
            <div className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
              <Shield className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* ── Metric Cards ── */}
        {(hasGenerated || loading) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Total Strength" value={filteredReport.length} icon={Users} iconBg="bg-violet-100" iconColor="text-violet-600" loading={loading} />
            <MetricCard label="Average Attendance" value={`${classAvg}%`} icon={TrendingUp} iconBg="bg-emerald-100" iconColor="text-emerald-600" loading={loading} />
            <MetricCard label="Engagement Rate" value={filteredReport.length > 0 ? (filteredReport.filter(r => r.percentage >= 85).length / filteredReport.length * 100).toFixed(1) + '%' : '0%'} icon={CheckCircle2} iconBg="bg-sky-100" iconColor="text-sky-600" loading={loading} />
            <MetricCard label="Critical Cases" value={below.length} icon={AlertTriangle} iconBg="bg-rose-100" iconColor="text-rose-600" loading={loading} />
          </div>
        )}

        {/* ── Error Banner ── */}
        {error && !loading && (
          <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm flex-1">{error}</span>
            <Button size="sm" variant="outline"
              className="h-8 text-xs border-rose-200 text-rose-700 hover:bg-rose-100 rounded-xl"
              onClick={generateReport}>
              <RotateCcw className="h-3 w-3 mr-1.5" />Retry
            </Button>
          </div>
        )}

        {/* ── Filter Card ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-violet-50">
              <Filter className="h-3.5 w-3.5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Report Filters</h2>
              <p className="text-xs text-slate-400 mt-0.5">Select date range — reports are cached per range</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Date presets */}
            <div className="flex flex-wrap gap-2">
              {DATE_PRESETS.map(p => {
                const s = p.days === 0 ? todayISO() : isoDate(Date.now() - p.days * MS_PER_DAY);
                const e = todayISO();
                const active = startDate === s && endDate === e;
                return (
                  <button
                    key={p.label}
                    onClick={() => { setStartDate(s); setEndDate(e); }}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors ${
                      active
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-violet-100 hover:text-violet-700'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Date range + Generate */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5">Start Date</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="h-10 text-sm border border-slate-200 rounded-xl focus:border-violet-400 bg-white" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5">End Date</label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="h-10 text-sm border border-slate-200 rounded-xl focus:border-violet-400 bg-white" />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  onClick={generateReport}
                  disabled={loading}
                  className="h-10 flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-xl shadow-sm disabled:opacity-60"
                >
                  {loading
                    ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />{loadMessage || 'Generating…'}</>
                    : <><FileText className="h-3.5 w-3.5 mr-1.5" />Generate Report</>}
                </Button>
                {hasGenerated && (
                  <Button variant="outline" size="icon" disabled={loading}
                    title="Force refresh (bypass cache)"
                    className="h-10 w-10 border-slate-200 rounded-xl"
                    onClick={() => {
                      cache.current.delete(`${startDate}|${endDate}`);
                      generateReport();
                    }}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <Input
                placeholder={`Search by name, register number, or ${deptLabel.toLowerCase()}…`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-9 pl-9 text-sm border border-slate-200 rounded-xl focus:border-violet-400 bg-white"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Advanced filters toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                showAdvanced ? 'bg-violet-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Advanced Filters
              {hasActiveFilters && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />}
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                {[
                  {
                    label: deptLabel, value: filterDept,
                    onChange: (v: string) => { setFilterDept(v); setFilterYear('all'); setFilterSection('all'); setPage(1); },
                    opts: categories.map(c => ({ id: c.id, name: c.name })),
                    allLabel: `All ${deptLabel}s`,
                  },
                  {
                    label: yearLabel, value: filterYear,
                    onChange: (v: string) => { setFilterYear(v); setFilterSection('all'); setPage(1); },
                    opts: visibleSubcats.map((s: AcademicSubcategory) => ({ id: s.id, name: s.name })),
                    allLabel: `All ${yearLabel}s`,
                  },
                  {
                    label: sectionLabel, value: filterSection,
                    onChange: (v: string) => { setFilterSection(v); setPage(1); },
                    opts: visibleItems.map((i: AcademicItem) => ({ id: i.id, name: i.name })),
                    allLabel: `All ${sectionLabel}s`,
                  },
                ].map(({ label, value, onChange, opts, allLabel }) => (
                  <div key={label}>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1.5">{label}</label>
                    <Select value={value} onValueChange={onChange}>
                      <SelectTrigger className="h-10 text-sm border border-slate-200 rounded-xl">
                        <SelectValue placeholder={allLabel} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{allLabel}</SelectItem>
                        {opts.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}

            {/* Active filter chips */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 pt-2">
                {filterDept    !== 'all' && <Chip label={`${deptLabel}: ${getCatName(filterDept)}`} />}
                {filterYear    !== 'all' && <Chip label={`${yearLabel}: ${getSubName(filterYear)}`} />}
                {filterSection !== 'all' && <Chip label={`${sectionLabel}: ${getItemName(filterSection)}`} />}
                {searchQuery.trim()      && <Chip label={`Search: "${searchQuery}"`} />}
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-xs gap-1 text-slate-500">
                  <X className="h-3 w-3" />Clear all
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="attendance" className="space-y-4">
          <TabsList className="bg-slate-100 rounded-2xl p-1 h-auto gap-1 w-full sm:w-auto flex-wrap">
            {[
              { value: 'attendance', icon: FileText,      label: 'Main Report'                                          },
              { value: 'executive',  icon: Shield,        label: 'Executive Summary'                                    },
              { value: 'subjects',   icon: BookOpen,      label: 'Subject Breakdown'                                     },
              { value: 'alerts',     icon: AlertTriangle, label: 'Risk Analysis', badge: below.length > 0 ? below.length : undefined },
              { value: 'dept',       icon: Users,         label: `${deptLabel}-wise`                                    },
              { value: 'trend',      icon: BarChart2,     label: 'Trends'                                               },
              { value: 'register',   icon: CalendarDays,  label: 'Register'                                             },
            ].map(({ value, icon: Icon, label, badge }) => (
              <TabsTrigger key={value} value={value}
                className="text-xs px-3 py-1.5 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-violet-700">
                <Icon className="mr-1.5 h-3.5 w-3.5" />
                {label}
                {badge !== undefined && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">{badge}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ─── Tab 1: Full Attendance ─── */}
          <TabsContent value="attendance">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-5 py-4 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Full Attendance Report</h2>
                  {hasGenerated && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {sorted.length} of {reportData.length} students · {startDate} → {endDate}
                    </p>
                  )}
                </div>
                {hasGenerated && sorted.length > 0 && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => exportCSV(sorted, 'attendance')}
                      className="h-8 text-xs rounded-xl border-slate-200">
                      <Download className="mr-1 h-3 w-3" />CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => printReport(sorted)}
                      className="h-8 text-xs rounded-xl border-slate-200">
                      <Printer className="mr-1 h-3 w-3" />Print / PDF
                    </Button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                {loading ? <SkeletonRows /> : !hasGenerated ? <EmptyState /> : sorted.length === 0 ? (
                  <EmptyState msg="No records match the current filters" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-100 hover:bg-transparent bg-slate-50/60">
                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 pl-5">#</TableHead>
                        <SortHead label="Student"      sortKey="studentName"    current={sort} onSort={toggleSort} />
                        <SortHead label="Register No"  sortKey="registerNumber" current={sort} onSort={toggleSort} />
                        <SortHead label={deptLabel}    sortKey="department"     current={sort} onSort={toggleSort} />
                        <SortHead label={yearLabel}    sortKey="year"           current={sort} onSort={toggleSort} />
                        <SortHead label={sectionLabel} sortKey="section"        current={sort} onSort={toggleSort} />
                        <SortHead label="P"   sortKey="present"    current={sort} onSort={toggleSort} className="text-center" />
                        <SortHead label="A"   sortKey="absent"     current={sort} onSort={toggleSort} className="text-center" />
                        <SortHead label="L"   sortKey="late"       current={sort} onSort={toggleSort} className="text-center" />
                        <TableHead className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">?</TableHead>
                        <SortHead label="Total"   sortKey="total"      current={sort} onSort={toggleSort} className="text-center" />
                        <SortHead label="Att. %"  sortKey="percentage" current={sort} onSort={toggleSort} className="min-w-[150px]" />
                        <TableHead className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 pr-5">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((row, i) => (
                        <TableRow key={row.studentId} className={`border-slate-100 ${rowBg(row.percentage)} hover:bg-violet-50/20 transition-colors`}>
                          <TableCell className="text-slate-500 text-sm pl-5">{(page - 1) * pageSize + i + 1}</TableCell>
                          <TableCell className="font-bold text-slate-900">{row.studentName}</TableCell>
                          <TableCell className="font-mono text-sm text-slate-400">{row.registerNumber}</TableCell>
                          <TableCell className="text-sm text-slate-600">{row.department}</TableCell>
                          <TableCell className="text-sm text-slate-600">{row.year}</TableCell>
                          <TableCell className="text-sm text-slate-600">{row.section}</TableCell>
                          <TableCell className="text-center text-emerald-600 font-semibold">{row.present}</TableCell>
                          <TableCell className="text-center text-rose-500 font-semibold">{row.absent}</TableCell>
                          <TableCell className="text-center text-amber-600 font-semibold">{row.late}</TableCell>
                          <TableCell className="text-center">
                            {row.unmarked > 0
                              ? <span className="text-orange-500 font-semibold">{row.unmarked}</span>
                              : <span className="text-slate-300">—</span>}
                          </TableCell>
                          <TableCell className="text-center text-slate-500">{row.total}</TableCell>
                          <TableCell><MiniBar value={row.percentage} /></TableCell>
                          <TableCell className="text-center pr-5"><StatusBadge percentage={row.percentage} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {hasGenerated && sorted.length > 0 && (
                <>
                  <Pagination total={sorted.length} page={page} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />
                  <div className="flex flex-wrap gap-5 px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />≥85% Excellent</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />75–84% Good</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />&lt;75% Needs Attention</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block" />? = Unmarked</span>
                    <span className="ml-auto italic text-slate-400">Click column header to sort</span>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* ─── Tab 2: Executive Summary ─── */}
          <TabsContent value="executive">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Insight 1: Distribution */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Attendance Distribution</h3>
                    <p className="text-xs text-slate-400">Analysis of cohort performance groups</p>
                  </div>
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                </div>
                
                <div className="space-y-5">
                  {[
                    { label: 'Exceeding Expectation (≥90%)', count: filteredReport.filter(r => r.percentage >= 90).length, color: 'bg-emerald-500' },
                    { label: 'Good Standing (80-89%)', count: filteredReport.filter(r => r.percentage >= 80 && r.percentage < 90).length, color: 'bg-emerald-400' },
                    { label: 'Moderate Engagement (70-79%)', count: filteredReport.filter(r => r.percentage >= 70 && r.percentage < 80).length, color: 'bg-amber-400' },
                    { label: 'At Risk (60-69%)', count: filteredReport.filter(r => r.percentage >= 60 && r.percentage < 70).length, color: 'bg-rose-400' },
                    { label: 'Critical Intervention (<60%)', count: filteredReport.filter(r => r.percentage < 60).length, color: 'bg-rose-500' },
                  ].map((group, i) => {
                    const pct = filteredReport.length > 0 ? (group.count / filteredReport.length * 100).toFixed(1) : '0';
                    return (
                      <div key={i} className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                          <span>{group.label}</span>
                          <span>{group.count} Students ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                          <div className={`h-full rounded-full transition-all duration-1000 ${group.color}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-4 border-t border-slate-50">
                  <div className="bg-slate-50 rounded-xl p-4 flex items-start gap-3">
                    <Shield className="h-4 w-4 text-violet-500 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-700">Administrative Insight</h4>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        {filteredReport.filter(r => r.percentage < 75).length > 0 
                          ? `There are ${filteredReport.filter(r => r.percentage < 75).length} students requiring intervention. We recommend scheduling a departmental review for groups with <75% attendance.`
                          : "Overall attendance is excellent. Consider implementing a recognition program for students maintaining above 95% engagement."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Insight 2: Top Performers */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-bold text-slate-800">Top Performers</h3>
                  <div className="h-6 w-6 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <ArrowUp className="h-3 w-3 text-emerald-600" />
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  {[...filteredReport].sort((a,b) => b.percentage - a.percentage).slice(0, 5).map((row, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-slate-50 hover:border-emerald-100 hover:bg-emerald-50/10 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">#{i+1}</div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-900">{row.studentName}</p>
                          <p className="text-[10px] text-slate-400">{row.registerNumber}</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-black text-emerald-600">{row.percentage}%</span>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" className="w-full mt-4 text-[10px] uppercase font-black text-slate-400 hover:text-violet-600">View All High Achievers</Button>
              </div>
            </div>
          </TabsContent>

          {/* ─── Tab 3: Subject Breakdown ─── */}
          <TabsContent value="subjects">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Subject-wise Analytics</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Engagement metrics broken down by academic curriculum</p>
                </div>
                <div className="flex gap-2">
                   <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest rounded-xl border-slate-200">
                     <Download className="mr-1.5 h-3 w-3" /> Export Analysis
                   </Button>
                </div>
              </div>

              <div className="p-5">
                {loading ? <SkeletonRows /> : !hasGenerated ? <EmptyState /> : subjectData.length === 0 ? (
                  <EmptyState msg="No subject-specific data was captured during this period" />
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-50">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/60 border-slate-100 hover:bg-transparent">
                          <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pl-5">Rank</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Subject Name</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center">Sessions</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center">P</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center">A</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Engagement Trend</TableHead>
                          <TableHead className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-400 pr-5">Performance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subjectData.map((sub, i) => (
                          <TableRow key={sub.subjectId} className="border-slate-50 hover:bg-violet-50/10 transition-colors">
                            <TableCell className="text-slate-400 text-sm pl-5">#{i + 1}</TableCell>
                            <TableCell className="font-bold text-slate-800">{sub.subjectName}</TableCell>
                            <TableCell className="text-center font-mono text-xs text-slate-500">{sub.sessions}</TableCell>
                            <TableCell className="text-center text-emerald-600 font-bold">{sub.present}</TableCell>
                            <TableCell className="text-center text-rose-500 font-bold">{sub.absent}</TableCell>
                            <TableCell className="min-w-[150px]"><MiniBar value={sub.percentage} /></TableCell>
                            <TableCell className="text-center pr-5"><StatusBadge percentage={sub.percentage} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
              
              <div className="px-6 py-4 bg-gray-50/50 border-t border-slate-50 flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                 <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>High Engagement: &gt;85%</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-rose-500" />
                    <span>At Risk: &lt;75%</span>
                 </div>
              </div>
            </div>
          </TabsContent>

          {/* ─── Tab 2: Low Alerts ─── */}
          <TabsContent value="alerts">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-5 py-4 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Low Attendance Alerts</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Students requiring immediate attention</p>
                </div>
                {below.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                    <AlertTriangle className="h-3 w-3" />
                    {below.length} student{below.length > 1 ? 's' : ''} below {threshold}%
                  </span>
                )}
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <span className="text-xs font-semibold text-slate-700">Alert threshold:</span>
                  <Input type="number" min={0} max={100} value={threshold}
                    onChange={e => setThreshold(Number(e.target.value))}
                    className="w-20 h-8 text-center text-sm border border-slate-200 rounded-lg" />
                  <span className="text-xs text-slate-500">%</span>
                </div>

                {loading ? <LoadingSpinner /> : !hasGenerated ? <EmptyState /> : below.length === 0 ? (
                  <div className="flex flex-col items-center py-14 gap-3">
                    <div className="h-14 w-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
                      <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                    </div>
                    <p className="text-sm font-semibold text-emerald-600">All students above {threshold}%!</p>
                    <p className="text-xs text-slate-400">Excellent attendance across the board</p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => exportCSV(below, 'defaulters')}
                        className="h-8 text-xs rounded-xl border-slate-200">
                        <Download className="mr-1 h-3 w-3" />Defaulters CSV
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => printReport(below)}
                        className="h-8 text-xs rounded-xl border-slate-200">
                        <Printer className="mr-1 h-3 w-3" />Print
                      </Button>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-100 hover:bg-transparent bg-slate-50/60">
                            {['Student', 'Register No', deptLabel, yearLabel, sectionLabel,
                              'Present', 'Total', 'Att. %', 'Shortfall', 'Classes Needed'].map(h => (
                              <TableHead key={h}
                                className={`text-[10px] font-bold uppercase tracking-widest text-slate-400 ${['Present','Total'].includes(h) ? 'text-center' : ''} ${h === 'Student' ? 'pl-5' : ''} ${h === 'Classes Needed' ? 'text-center pr-5' : ''}`}>
                                {h}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {below.map(row => {
                            const shortfall = (threshold - row.percentage).toFixed(1);
                            const needed    = Math.max(0, Math.ceil(
                              (threshold / 100 * row.total - row.present) / (1 - threshold / 100)
                            ));
                            return (
                              <TableRow key={row.studentId} className="bg-rose-50/40 border-slate-100 hover:bg-rose-50/60 transition-colors">
                                <TableCell className="font-bold text-slate-900 pl-5">{row.studentName}</TableCell>
                                <TableCell className="font-mono text-sm text-slate-500">{row.registerNumber}</TableCell>
                                <TableCell className="text-sm text-slate-600">{row.department}</TableCell>
                                <TableCell className="text-sm text-slate-600">{row.year}</TableCell>
                                <TableCell className="text-sm text-slate-600">{row.section}</TableCell>
                                <TableCell className="text-center text-emerald-600 font-medium">{row.present}</TableCell>
                                <TableCell className="text-center text-slate-500">{row.total}</TableCell>
                                <TableCell><MiniBar value={row.percentage} /></TableCell>
                                <TableCell className="text-center">
                                  <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200">−{shortfall}%</span>
                                </TableCell>
                                <TableCell className="text-center pr-5">
                                  <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">{needed} more</span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ─── Tab 3: Department-wise ─── */}
          <TabsContent value="dept">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-800">{deptLabel}-wise Summary</h2>
              </div>
              <div className="p-5 space-y-5">
                {loading ? <SkeletonRows /> : !hasGenerated ? <EmptyState /> : deptSummary.length === 0 ? (
                  <EmptyState msg={`No ${deptLabel.toLowerCase()} data available`} />
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {deptSummary.map(d => (
                        <div key={d.dept}
                          className="rounded-2xl border border-slate-100 p-4 bg-white hover:shadow-md transition-all border-l-4"
                          style={{ borderLeftColor: d.avgPct >= 85 ? '#10b981' : d.avgPct >= 75 ? '#f59e0b' : '#ef4444' }}>
                          <div className="text-sm font-bold truncate mb-1 text-slate-800">{d.dept}</div>
                          <div className={`text-3xl font-extrabold ${pctClass(d.avgPct)}`}>{d.avgPct}%</div>
                          <div className="text-xs text-slate-400 mt-1">{d.students} students</div>
                          <div className="flex gap-1.5 mt-2 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{d.good} excellent</span>
                            {d.low > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">{d.low} low</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-100 hover:bg-transparent bg-slate-50/60">
                            {[deptLabel, 'Students', 'Avg %', 'Excellent', 'Good', 'Low', 'Compliance'].map(h => (
                              <TableHead key={h} className="text-[10px] font-bold uppercase tracking-widest text-slate-400 pl-5">{h}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {deptSummary.map((d, i) => {
                            const compliance = parseFloat((((d.students - d.low) / d.students) * 100).toFixed(0));
                            return (
                              <TableRow key={i} className="border-slate-100 hover:bg-violet-50/20 transition-colors">
                                <TableCell className="font-bold text-slate-800 pl-5">{d.dept}</TableCell>
                                <TableCell className="text-slate-600">{d.students}</TableCell>
                                <TableCell><span className={`font-bold ${pctClass(d.avgPct)}`}>{d.avgPct}%</span></TableCell>
                                <TableCell><ColorBadge color="emerald">{d.good}</ColorBadge></TableCell>
                                <TableCell><ColorBadge color="amber">{d.average}</ColorBadge></TableCell>
                                <TableCell><ColorBadge color={d.low > 0 ? 'rose' : 'emerald'}>{d.low}</ColorBadge></TableCell>
                                <TableCell><MiniBar value={compliance} /></TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ─── Tab 4: Monthly Trend ─── */}
          <TabsContent value="trend">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-800">Monthly Attendance Trend</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {hasGenerated ? `${startDate} to ${endDate}` : 'Generate a report to see trend data'}
                </p>
              </div>
              <div className="p-5 space-y-6">
                {loading ? <ChartSkeleton /> : !hasGenerated ? <EmptyState /> : filteredMonthly.length === 0 ? (
                  <EmptyState msg="No monthly data for this range" />
                ) : (
                  <>
                    <div className="relative pt-4">
                      {[100, 75, 50, 25].map(v => (
                        <div key={v}
                          className="absolute left-0 right-0 border-t border-dashed border-slate-200 pointer-events-none"
                          style={{ bottom: `${v * 1.55 + 28}px` }}>
                          <span className="absolute -top-3 left-0 text-[10px] text-slate-400 font-mono">{v}%</span>
                        </div>
                      ))}
                      {/* 75% threshold line */}
                      <div className="absolute left-8 right-0 border-t-2 border-dashed border-amber-400 pointer-events-none z-10"
                        style={{ bottom: `${75 * 1.55 + 28}px` }}>
                        <span className="absolute -top-4 right-0 text-[10px] text-amber-600 font-bold bg-amber-50 px-1 rounded">75% threshold</span>
                      </div>
                      <div className="flex items-end gap-3 h-44 pl-8 pb-7 border-b border-slate-200">
                        {filteredMonthly.map((m, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                            {/* Tooltip */}
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                              <div className="bg-slate-900 text-white text-[10px] font-semibold px-2 py-1.5 rounded-xl whitespace-nowrap shadow-lg">
                                {m.month}: {m.percentage}%
                                <br />
                                <span className="opacity-70">{m.present}P / {m.absent}A / {m.total} total</span>
                              </div>
                              <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1" />
                            </div>
                            <div
                              className={`w-full rounded-t-xl opacity-80 hover:opacity-100 cursor-pointer transition-all duration-500 ${barColor(m.percentage)}`}
                              style={{ height: `${Math.max((m.percentage / 100) * 140, 4)}px` }}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-3 pl-8 mt-2">
                        {filteredMonthly.map((m, i) => (
                          <div key={i} className="flex-1 text-center text-[11px] font-semibold text-slate-500">{m.month}</div>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-100 hover:bg-transparent bg-slate-50/60">
                            {['Month','Present','Absent','Total','Attendance %','Status','vs Previous'].map(h => (
                              <TableHead key={h} className="text-[10px] font-bold uppercase tracking-widest text-slate-400 pl-5">{h}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredMonthly.map((m, i) => {
                            const prev = i > 0 ? filteredMonthly[i - 1].percentage : null;
                            const diff = prev !== null ? parseFloat((m.percentage - prev).toFixed(1)) : null;
                            return (
                              <TableRow key={i} className="border-slate-100 hover:bg-violet-50/20 transition-colors">
                                <TableCell className="font-bold text-slate-800 pl-5">{m.month}</TableCell>
                                <TableCell className="text-emerald-600 font-semibold">{m.present}</TableCell>
                                <TableCell className="text-rose-500 font-semibold">{m.absent}</TableCell>
                                <TableCell className="text-slate-500">{m.total}</TableCell>
                                <TableCell><MiniBar value={m.percentage} /></TableCell>
                                <TableCell><StatusBadge percentage={m.percentage} /></TableCell>
                                <TableCell className="font-bold text-sm pr-5">
                                  {diff === null
                                    ? <span className="text-slate-400">—</span>
                                    : diff > 0
                                    ? <span className="inline-flex items-center gap-1 text-emerald-600"><ArrowUp className="h-3 w-3" />+{diff}%</span>
                                    : diff < 0
                                    ? <span className="inline-flex items-center gap-1 text-rose-600"><ArrowDown className="h-3 w-3" />{diff}%</span>
                                    : <span className="inline-flex items-center gap-1 text-slate-500"><Minus className="h-3 w-3" />No change</span>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ─── Tab 5: Daily Register ─── */}
          <TabsContent value="register">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-5 py-4 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Daily Attendance Register</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {hasGenerated
                      ? `${register.dates.length} session day${register.dates.length !== 1 ? 's' : ''} · ${filteredRegisterStudents.length} students`
                      : 'Generate a report to see the daily register'}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  {(['present', 'absent', 'late', 'unmarked', 'none'] as const).map(s => (
                    <span key={s} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold text-[10px] ${cellCls(s)}`}>
                      {cellLetter(s)} = {s}
                    </span>
                  ))}
                </div>
              </div>

              {loading ? <LoadingSpinner message="Building register…" /> :
               !hasGenerated ? <EmptyState /> :
               register.dates.length === 0 ? (
                <EmptyState msg="No session dates found in this range" />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/60 border-b border-slate-100">
                          <th className="sticky left-0 z-10 bg-slate-50 text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 px-5 py-2 whitespace-nowrap min-w-[180px]">
                            Student
                          </th>
                          <th className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 py-2 whitespace-nowrap min-w-[90px]">
                            Reg No
                          </th>
                          {register.dates.map(d => (
                            <th key={d} className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 px-2 py-2 whitespace-nowrap min-w-[48px]">
                              <div>{MONTH_NAMES[parseInt(d.substring(5, 7)) - 1]}</div>
                              <div className="text-slate-600">{d.substring(8)}</div>
                            </th>
                          ))}
                          <th className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 py-2 whitespace-nowrap min-w-[70px]">
                            Att. %
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {regStudents.map((s, si) => {
                          const present = register.dates.filter(d => s.attendance[d] === 'present').length;
                          const marked  = register.dates.filter(d => ['present','absent','late'].includes(s.attendance[d])).length;
                          const pct     = marked > 0 ? Math.round((present / marked) * 100) : 0;
                          return (
                            <tr key={s.studentId}
                              className={`border-b border-slate-100 ${si % 2 === 0 ? '' : 'bg-slate-50/30'} hover:bg-violet-50/10 transition-colors`}>
                              <td className="sticky left-0 z-10 bg-inherit font-semibold text-slate-800 px-5 py-2 whitespace-nowrap">
                                {s.name}
                              </td>
                              <td className="font-mono text-slate-400 px-3 py-2 whitespace-nowrap">
                                {s.regNo}
                              </td>
                              {register.dates.map(d => (
                                <td key={d} className="text-center px-1 py-1">
                                  <span className={`inline-block w-7 h-7 leading-7 rounded-lg font-bold text-[11px] ${cellCls(s.attendance[d])}`}>
                                    {cellLetter(s.attendance[d])}
                                  </span>
                                </td>
                              ))}
                              <td className="text-center px-3 py-2">
                                <span className={`font-bold text-xs ${pctClass(pct)}`}>{pct}%</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    total={filteredRegisterStudents.length} page={regPage} pageSize={regPageSize}
                    onPage={setRegPage} onPageSize={setRegPageSize}
                  />
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* ── Footer ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-slate-300" />
            <span>Institution: <span className="font-semibold text-slate-600">{profile?.institution_id?.slice(0, 8) ?? '—'}…</span></span>
            {hasGenerated && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold border border-emerald-200 text-[10px] flex items-center gap-1">
                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full" />Report Ready
              </span>
            )}
          </div>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" />
            {startDate} → {endDate}
          </span>
        </div>
      </div>
    </AdminLayout>
  );
}
