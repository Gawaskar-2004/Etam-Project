import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import {
  Plus, Clock, Trash2, Eye, Printer, BookOpen, Users, GraduationCap,
  Layers, Pencil, Check, X, CalendarDays, Settings, Shield, Coffee,
  CheckCircle, Copy, AlertTriangle, Loader2, UserCheck, ArrowLeft, LayoutGrid, List,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { academicApi, staffApi, subjectsApi } from '@/lib/api';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface Category    { id: string; name: string; }
interface Subcategory { id: string; name: string; category_id: string; }
interface Item        { id: string; name: string; subcategory_id: string; }
interface StaffMember { id: string; full_name: string; }
interface Subject     { id: string; name: string; category_id?: string; subcategory_id?: string; }
interface Labels      { category_label?: string; subcategory_label?: string; item_label?: string; }

interface BreakConfig {
  id: string;
  name: string;
  duration: number;
  afterPeriod: number;
}

interface TimetableConfig {
  shift: string;
  startTime: string;
  periodCount: number;
  categoryId: string;
  subcategoryId: string;
  itemId: string;
  periodDuration: number;
  classTeacherId: string;
  breaks: BreakConfig[];
  customPeriodTimes: Record<number, string>;
}

interface PeriodAssignment {
  id?: string;
  periodNumber: number;
  day: string;
  staffId: string;
  subjectId: string;
  staffName?: string;
  subjectName?: string;
  itemId?: string;
}

interface AssignmentForm { staffId: string; subjectId: string; }
interface ViewFilter    { categoryId: string; subcategoryId: string; itemId: string; }

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
type Day = typeof DAYS[number];

const SHIFTS = [
  { value: 'Morning',   label: 'Morning',   defaultStart: '09:30' },
  { value: 'Afternoon', label: 'Afternoon', defaultStart: '13:00' },
  { value: 'Full Time', label: 'Full Time', defaultStart: '08:00' },
];

const DEFAULT_CONFIG: TimetableConfig = {
  shift: 'Morning', startTime: '09:30',
  periodCount: 8, categoryId: '', subcategoryId: '', itemId: '',
  periodDuration: 45, classTeacherId: '',
  breaks: [{ id: '1', name: 'Break 1', duration: 15, afterPeriod: 2 }],
  customPeriodTimes: {},
};

// Subject colour palette
const SUBJECT_COLORS = [
  { bg: 'bg-indigo-50',  border: 'border-indigo-200', text: 'text-indigo-700',  sub: 'text-indigo-500',  dot: 'bg-indigo-400'  },
  { bg: 'bg-emerald-50', border: 'border-emerald-200',text: 'text-emerald-700', sub: 'text-emerald-500', dot: 'bg-emerald-400' },
  { bg: 'bg-violet-50',  border: 'border-violet-200', text: 'text-violet-700',  sub: 'text-violet-500',  dot: 'bg-violet-400'  },
  { bg: 'bg-rose-50',    border: 'border-rose-200',   text: 'text-rose-700',    sub: 'text-rose-500',    dot: 'bg-rose-400'    },
  { bg: 'bg-sky-50',     border: 'border-sky-200',    text: 'text-sky-700',     sub: 'text-sky-500',     dot: 'bg-sky-400'     },
  { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-700',   sub: 'text-amber-500',   dot: 'bg-amber-400'   },
  { bg: 'bg-teal-50',    border: 'border-teal-200',   text: 'text-teal-700',    sub: 'text-teal-500',    dot: 'bg-teal-400'    },
  { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200',text: 'text-fuchsia-700', sub: 'text-fuchsia-500', dot: 'bg-fuchsia-400' },
];

const getSubjectColor = (subjectId: string) => {
  let hash = 0;
  for (let i = 0; i < subjectId.length; i++) hash = subjectId.charCodeAt(i) + ((hash << 5) - hash);
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
};

// ─────────────────────────────────────────────
// localStorage helpers
// ─────────────────────────────────────────────
const BREAKS_KEY        = 'timetable_breaks_config';
const CLASS_TEACHER_KEY = 'timetable_class_teachers';
const PERIOD_TIMES_KEY  = 'timetable_period_times';
const PERIOD_CONFIG_KEY = 'timetable_period_config';

const safe = <T,>(fn: () => T, fallback: T): T => { try { return fn(); } catch { return fallback; } };

const loadBreaks        = (): BreakConfig[] | null => safe(() => { const r = localStorage.getItem(BREAKS_KEY); return r ? JSON.parse(r) : null; }, null);
const saveBreaks        = (b: BreakConfig[])       => safe(() => localStorage.setItem(BREAKS_KEY, JSON.stringify(b)), undefined);
const loadClassTeachers = (): Record<string,string> => safe(() => { const r = localStorage.getItem(CLASS_TEACHER_KEY); return r ? JSON.parse(r) : {}; }, {});
const saveClassTeacher  = (key: string, staffId: string) => safe(() => { const all = loadClassTeachers(); all[key] = staffId; localStorage.setItem(CLASS_TEACHER_KEY, JSON.stringify(all)); }, undefined);
const getClassTeacher   = (catId: string, subId: string, itemId: string) => loadClassTeachers()[`${catId}__${subId}__${itemId || 'all'}`] || '';
const loadPeriodTimes   = (sectionKey: string): Record<number, string> => safe(() => { const all = JSON.parse(localStorage.getItem(PERIOD_TIMES_KEY) || '{}'); return all[sectionKey] || {}; }, {});
const savePeriodTimes   = (sectionKey: string, times: Record<number, string>) => safe(() => { const all = JSON.parse(localStorage.getItem(PERIOD_TIMES_KEY) || '{}'); all[sectionKey] = times; localStorage.setItem(PERIOD_TIMES_KEY, JSON.stringify(all)); }, undefined);

interface SectionSlotConfig {
  startTime: string;
  periodCount: number;
  periodDuration: number;
  breaks: BreakConfig[];
  customPeriodTimes: Record<number, string>;
}

const saveSectionSlotConfig = (sectionKey: string, cfg: SectionSlotConfig) =>
  safe(() => {
    const all = JSON.parse(localStorage.getItem(PERIOD_CONFIG_KEY) || '{}');
    all[sectionKey] = cfg;
    localStorage.setItem(PERIOD_CONFIG_KEY, JSON.stringify(all));
  }, undefined);

const loadSectionSlotConfig = (sectionKey: string): SectionSlotConfig | null =>
  safe(() => {
    const all = JSON.parse(localStorage.getItem(PERIOD_CONFIG_KEY) || '{}');
    return all[sectionKey] || null;
  }, null);

// ─────────────────────────────────────────────
// Time utilities
// ─────────────────────────────────────────────
const timeToMinutes = (t: string): number => {
  if (!t) return 0;
  const upper = t.toUpperCase().trim();
  const ampm = upper.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (ampm) {
    let h = parseInt(ampm[1]), m = parseInt(ampm[2]);
    if (ampm[3] === 'PM' && h !== 12) h += 12;
    if (ampm[3] === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  const parts = upper.split(':');
  return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
};

const fmtTime = (mins: number): string => {
  const total = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60), m = total % 60;
  const p = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${p}`;
};

const display24h = (t: string): string => fmtTime(timeToMinutes(t));

// ─────────────────────────────────────────────
// Count-up animation hook
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// MetricCard
// ─────────────────────────────────────────────
function MetricCard({ label, value, icon: Icon, iconBg, iconColor, subtitle }: {
  label: string; value: number | string; icon: React.ElementType;
  iconBg: string; iconColor: string; subtitle?: string;
}) {
  const numVal   = typeof value === 'string' ? (parseInt(value) || 0) : value;
  const animated = useCountUp(numVal);
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-400">{label}</span>
        <div className={`p-2 rounded-lg ${iconBg}`}><Icon className={`h-3.5 w-3.5 ${iconColor}`} /></div>
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">
        {typeof value === 'string' && value.endsWith('%') ? `${animated}%` : animated}
      </p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Editable time range cell
// ─────────────────────────────────────────────
function EditableTimeRange({ value, periodIndex, onSave }: {
  value: string; periodIndex: number; onSave: (p: number, t: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const startEdit = () => {
    const start = value.split('–')[0]?.trim() || '';
    const mins = timeToMinutes(start);
    setDraft(`${String(Math.floor(mins / 60)).padStart(2,'0')}:${String(mins % 60).padStart(2,'0')}`);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };
  const commit = () => { if (draft) onSave(periodIndex, draft); setEditing(false); };
  const cancel = () => setEditing(false);
  if (editing) return (
    <div className="flex items-center gap-1 justify-center">
      <input ref={inputRef} type="time" value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
        className="border border-gray-200 rounded-md px-1 py-0.5 text-xs w-24 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
      <button onClick={commit}  className="text-emerald-600 hover:text-emerald-700"><Check className="h-3.5 w-3.5" /></button>
      <button onClick={cancel}  className="text-rose-500 hover:text-rose-600"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
  return (
    <div className="flex items-center justify-center gap-1 group cursor-pointer hover:text-indigo-600 transition-colors" onClick={startEdit} title="Click to edit time">
      <span className="text-xs whitespace-nowrap font-mono text-gray-600">{value}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 shrink-0" />
    </div>
  );
}

// ─────────────────────────────────────────────
// Slot type
// ─────────────────────────────────────────────
type SlotEntry = { period: number; startMins: number; endMins: number; isBreak?: boolean; breakName?: string };

// ─────────────────────────────────────────────
// Visual Timetable Card Grid (day columns)
// ─────────────────────────────────────────────
function VisualTimetableGrid({
  slotList, src, title, subtitle,
}: {
  slotList: SlotEntry[];
  src: PeriodAssignment[];
  title?: string;
  subtitle?: string;
}) {
  const getAsgn = (period: number, day: string) => src.find(a => a.periodNumber === period && a.day === day);

  const dayLabels: Record<string, string> = {
    MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday',
    THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday',
  };

  const uniqueSubjects = Array.from(
    new Map(src.map(a => [a.subjectId, { id: a.subjectId, name: a.subjectName || 'Unknown' }])).values()
  );

  return (
    <div className="space-y-4">
      {(title || subtitle) && (
        <div className="flex items-center justify-between">
          {title && <h3 className="text-sm font-bold text-gray-800">{title}</h3>}
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      )}

      {uniqueSubjects.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-3 border-b border-gray-100">
          {uniqueSubjects.map(subj => {
            const c = getSubjectColor(subj.id);
            return (
              <span key={subj.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${c.bg} ${c.border} ${c.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                {subj.name}
              </span>
            );
          })}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border bg-amber-50 border-amber-200 text-amber-700">
            <Coffee className="h-2.5 w-2.5" /> Break
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {DAYS.map(day => {
          const dayAssignments = src.filter(a => a.day === day);
          return (
            <div key={day} className="rounded-xl border border-gray-100 overflow-hidden bg-white shadow-sm">
              <div className={`px-3 py-2.5 text-center border-b ${dayAssignments.length > 0 ? 'bg-indigo-600' : 'bg-gray-100'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${dayAssignments.length > 0 ? 'text-indigo-200' : 'text-gray-400'}`}>{day}</p>
                <p className={`text-xs font-semibold mt-0.5 ${dayAssignments.length > 0 ? 'text-white' : 'text-gray-500'}`}>{dayLabels[day]}</p>
                <span className={`text-[9px] font-medium ${dayAssignments.length > 0 ? 'text-indigo-300' : 'text-gray-400'}`}>
                  {dayAssignments.length} period{dayAssignments.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="p-1.5 space-y-1">
                {slotList.map((slot, idx) => {
                  if (slot.isBreak) {
                    return (
                      <div key={`brk-${idx}`} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-100">
                        <Coffee className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] font-medium text-amber-600 truncate block">{slot.breakName}</span>
                          <span className="text-[8px] text-amber-400 font-mono">{fmtTime(slot.startMins)} – {fmtTime(slot.endMins)}</span>
                        </div>
                        <span className="ml-auto text-[8px] text-amber-400 font-mono shrink-0">{slot.endMins - slot.startMins}m</span>
                      </div>
                    );
                  }

                  const asgn = getAsgn(slot.period, day);
                  const timeLabel = fmtTime(slot.startMins);

                  if (!asgn) {
                    return (
                      <div key={slot.period} className="flex items-center gap-2 px-2 py-2 rounded-lg border border-dashed border-gray-100 bg-gray-50/50">
                        <span className="text-[9px] font-bold text-gray-300 w-4 text-center shrink-0">{slot.period}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-mono text-gray-300">{timeLabel}</p>
                          <p className="text-[9px] text-gray-300">Free</p>
                        </div>
                      </div>
                    );
                  }

                  const c = getSubjectColor(asgn.subjectId);
                  return (
                    <div key={slot.period} className={`relative px-2 py-2 rounded-lg border ${c.bg} ${c.border} group`}>
                      <span className={`absolute top-1.5 right-1.5 text-[8px] font-bold px-1 rounded ${c.bg} ${c.text} border ${c.border}`}>
                        P{slot.period}
                      </span>
                      <p className={`text-[9px] font-mono ${c.sub} mb-0.5`}>{timeLabel}</p>
                      <p className={`text-[11px] font-bold leading-tight truncate ${c.text}`}>{asgn.subjectName}</p>
                      <p className="text-[9px] text-gray-500 truncate mt-0.5">{asgn.staffName}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {src.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">No assignments found</p>
          <p className="text-xs mt-1 text-gray-300">Select a section to view its timetable</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Horizontal Visual Timetable Table
// ─────────────────────────────────────────────
function VisualTimetableTable({
  slotList, src,
}: {
  slotList: SlotEntry[];
  src: PeriodAssignment[];
}) {
  const getAsgn = (period: number, day: string) => src.find(a => a.periodNumber === period && a.day === day);

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full border-collapse" style={{ minWidth: 700 }}>
        <thead>
          <tr>
            <th className="bg-gray-50 border-b border-r border-gray-200 px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 w-36 text-left">
              <Clock className="h-3 w-3 inline mr-1" />Period / Time
            </th>
            {DAYS.map(d => (
              <th key={d} className="bg-gray-50 border-b border-r border-gray-200 px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-center">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slotList.map((slot, idx) => {
            if (slot.isBreak) {
              return (
                <tr key={`brk-${idx}`} className="bg-amber-50/60">
                  <td colSpan={7} className="border-b border-amber-100 px-4 py-2 text-center">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-amber-700">
                      <Coffee className="h-3 w-3" />
                      {slot.breakName} · {fmtTime(slot.startMins)} – {fmtTime(slot.endMins)} ({slot.endMins - slot.startMins} min)
                    </span>
                  </td>
                </tr>
              );
            }

            return (
              <tr key={slot.period} className="hover:bg-gray-50/50 transition-colors">
                <td className="border-b border-r border-gray-100 px-3 py-2 align-top">
                  <span className="text-[10px] font-bold text-gray-500 block">P{slot.period}</span>
                  <span className="text-[10px] font-mono text-gray-400 block mt-0.5">{fmtTime(slot.startMins)}</span>
                  <span className="text-[10px] font-mono text-gray-400 block">– {fmtTime(slot.endMins)}</span>
                </td>
                {DAYS.map(day => {
                  const asgn = getAsgn(slot.period, day);
                  if (!asgn) {
                    return (
                      <td key={day} className="border-b border-r border-gray-100 px-2 py-2 text-center">
                        <div className="h-12 flex items-center justify-center">
                          <span className="text-xs text-gray-200">—</span>
                        </div>
                      </td>
                    );
                  }
                  const c = getSubjectColor(asgn.subjectId);
                  return (
                    <td key={day} className="border-b border-r border-gray-100 px-2 py-2">
                      <div className={`rounded-lg px-2 py-2 border ${c.bg} ${c.border}`}>
                        <p className={`text-[11px] font-bold leading-tight ${c.text} truncate`}>{asgn.subjectName}</p>
                        <p className="text-[9px] text-gray-500 truncate mt-0.5">{asgn.staffName}</p>
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────
// API base helper
// ─────────────────────────────────────────────
const apiBase = () => import.meta.env.VITE_API_URL;
const authHeaders = (): Record<string,string> => {
  const token = localStorage.getItem('auth_token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

// ─────────────────────────────────────────────
// Helper: resolve the best SectionSlotConfig for a given sectionKey.
// Priority:
//   1. Saved full slot config (startTime + periodCount + periodDuration + breaks + customPeriodTimes)
//   2. Falls back to DEFAULT_CONFIG timing + any saved customPeriodTimes for that key
// ─────────────────────────────────────────────
const resolveSlotConfig = (sectionKey: string): SectionSlotConfig => {
  const saved = loadSectionSlotConfig(sectionKey);
  if (saved) {
    // Always re-merge customPeriodTimes from the period-times store
    // in case they were edited separately
    const customTimes = loadPeriodTimes(sectionKey);
    return {
      ...saved,
      customPeriodTimes: Object.keys(customTimes).length > 0 ? customTimes : saved.customPeriodTimes,
    };
  }
  return {
    startTime: DEFAULT_CONFIG.startTime,
    periodCount: DEFAULT_CONFIG.periodCount,
    periodDuration: DEFAULT_CONFIG.periodDuration,
    breaks: loadBreaks() || DEFAULT_CONFIG.breaks,
    customPeriodTimes: loadPeriodTimes(sectionKey),
  };
};

// ─────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────
export default function TimetableManagementPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Data
  const [pageLoading, setPageLoading]     = useState(false);
  const [labels, setLabels]               = useState<Labels | null>(null);
  const [categories, setCategories]       = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [items, setItems]                 = useState<Item[]>([]);
  const [staff, setStaff]                 = useState<StaffMember[]>([]);
  const [subjects, setSubjects]           = useState<Subject[]>([]);
  const [assignments, setAssignments]     = useState<PeriodAssignment[]>([]);

  // UI state
  const [dialogOpen, setDialogOpen]             = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen]     = useState(false);
  const [teacherViewOpen, setTeacherViewOpen]   = useState(false);
  const [copyDayOpen, setCopyDayOpen]           = useState(false);
  const [selectedPeriod, setSelectedPeriod]     = useState<{ period: number; day: string } | null>(null);
  const [viewAssignments, setViewAssignments]   = useState<PeriodAssignment[]>([]);
  const [viewLoading, setViewLoading]           = useState(false);
  const [viewFilter, setViewFilter]             = useState<ViewFilter>({ categoryId: '', subcategoryId: '', itemId: '' });
  const [startTimeInput, setStartTimeInput]     = useState('09:30 AM');
  const [savingCell, setSavingCell]             = useState<string | null>(null);
  const [deletingId, setDeletingId]             = useState<string | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [copyFromDay, setCopyFromDay]           = useState<Day>('MON');
  const [copyToDay, setCopyToDay]               = useState<Day>('TUE');
  const [conflictWarning, setConflictWarning]   = useState<string | null>(null);
  const [viewMode, setViewMode]                 = useState<'card' | 'table'>('card');

  // ── viewSlotConfig: holds the timing config for whatever section is currently
  //    being displayed in the View dialog. Loaded from localStorage when the
  //    view filter changes, ensuring times/breaks always match what was saved
  //    for that specific class/section.
  const [viewSlotConfig, setViewSlotConfig] = useState<SectionSlotConfig>({
    startTime: DEFAULT_CONFIG.startTime,
    periodCount: DEFAULT_CONFIG.periodCount,
    periodDuration: DEFAULT_CONFIG.periodDuration,
    breaks: DEFAULT_CONFIG.breaks,
    customPeriodTimes: {},
  });

  const printRef     = useRef<HTMLDivElement>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [config, setConfig] = useState<TimetableConfig>(() => {
    const savedBreaks = loadBreaks();
    return savedBreaks ? { ...DEFAULT_CONFIG, breaks: savedBreaks } : DEFAULT_CONFIG;
  });

  const form = useForm<AssignmentForm>({ defaultValues: { staffId: '', subjectId: '' } });

  const sectionKey = `${config.categoryId}__${config.subcategoryId}__${config.itemId || 'all'}`;

  // ── Build time slots from any config
  const buildSlots = useCallback((
    baseStart: string,
    periodCount: number,
    periodDuration: number,
    breaks: BreakConfig[],
    customTimes: Record<number, string> = {}
  ): SlotEntry[] => {
    const sortedBreaks = [...breaks].sort((a, b) => a.afterPeriod - b.afterPeriod);
    let cur = timeToMinutes(baseStart);
    const slots: SlotEntry[] = [];
    for (let i = 1; i <= periodCount; i++) {
      const start = customTimes[i] !== undefined ? timeToMinutes(customTimes[i]) : cur;
      slots.push({ period: i, startMins: start, endMins: start + periodDuration });
      cur = start + periodDuration;
      const brk = sortedBreaks.find(b => b.afterPeriod === i);
      if (brk) {
        slots.push({ period: -1, startMins: cur, endMins: cur + brk.duration, isBreak: true, breakName: brk.name });
        cur += brk.duration;
      }
    }
    return slots;
  }, []);

  // Edit-panel slots (use config state directly)
  const slots = buildSlots(
    config.startTime,
    config.periodCount,
    config.periodDuration,
    config.breaks,
    config.customPeriodTimes
  );

  // View-dialog slots — always built from viewSlotConfig which is
  // loaded specifically for the viewed section
  const viewSlots = buildSlots(
    viewSlotConfig.startTime,
    viewSlotConfig.periodCount,
    viewSlotConfig.periodDuration,
    viewSlotConfig.breaks,
    viewSlotConfig.customPeriodTimes
  );

  const dayEndTime = (() => {
    const last = [...slots].reverse().find(s => !s.isBreak);
    return last ? fmtTime(last.endMins) : '—';
  })();

  const viewDayEndTime = (() => {
    const last = [...viewSlots].reverse().find(s => !s.isBreak);
    return last ? fmtTime(last.endMins) : '—';
  })();

  const debouncedSync = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => syncPeriodTimesToDB(), 600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.startTime, config.periodDuration, config.breaks, config.customPeriodTimes]);

  // Persist breaks whenever they change
  useEffect(() => {
    saveBreaks(config.breaks);
    if (config.categoryId && config.subcategoryId) debouncedSync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.breaks]);

  // Sync to DB when timing changes
  useEffect(() => {
    if (config.categoryId && config.subcategoryId) debouncedSync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.startTime, config.periodDuration]);

  // Save full slot config per section whenever relevant edit config changes
  useEffect(() => {
    if (config.categoryId && config.subcategoryId && config.itemId) {
      saveSectionSlotConfig(sectionKey, {
        startTime: config.startTime,
        periodCount: config.periodCount,
        periodDuration: config.periodDuration,
        breaks: config.breaks,
        customPeriodTimes: config.customPeriodTimes,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.startTime, config.periodCount, config.periodDuration, config.breaks, config.customPeriodTimes, sectionKey]);

  useEffect(() => {
    if (profile?.institution_id) fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.institution_id]);

  // When a section is selected in the edit panel, restore its saved config
  useEffect(() => {
    if (config.categoryId && config.subcategoryId && config.itemId) {
      loadTimetable();
      const savedTeacher  = getClassTeacher(config.categoryId, config.subcategoryId, config.itemId);
      const savedSlotCfg  = resolveSlotConfig(sectionKey);
      setConfig(prev => ({
        ...prev,
        classTeacherId:     savedTeacher || prev.classTeacherId,
        startTime:          savedSlotCfg.startTime,
        periodCount:        savedSlotCfg.periodCount,
        periodDuration:     savedSlotCfg.periodDuration,
        breaks:             savedSlotCfg.breaks,
        customPeriodTimes:  savedSlotCfg.customPeriodTimes,
      }));
      setTimeout(() => syncPeriodTimesToDB(), 300);
    } else {
      setAssignments([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.categoryId, config.subcategoryId, config.itemId]);

  useEffect(() => {
    const shiftObj = SHIFTS.find(s => s.value === config.shift);
    if (shiftObj) {
      setStartTimeInput(display24h(shiftObj.defaultStart));
      setConfig(prev => ({ ...prev, startTime: shiftObj.defaultStart, customPeriodTimes: {} }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.shift]);

  // ── KEY FIX: When the view filter changes, load the correct slot config
  //    for the viewed section from localStorage using resolveSlotConfig.
  //    This ensures times & breaks always match what was saved for that class.
  useEffect(() => {
    if (!viewDialogOpen) return;
    if (!viewFilter.categoryId || !viewFilter.subcategoryId) return;

    // Determine the section key for the viewed section.
    // If no item selected, try each item under the subcategory to pick the first
    // one that has a saved config. If none found, fall back to default.
    const viewKey = `${viewFilter.categoryId}__${viewFilter.subcategoryId}__${viewFilter.itemId || 'all'}`;
    const resolved = resolveSlotConfig(viewKey);
    setViewSlotConfig(resolved);

    loadViewTimetable();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewFilter, viewDialogOpen]);

  useEffect(() => () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current); }, []);

  // ── Data fetching
  const fetchData = async () => {
    try {
      setPageLoading(true);
      const [labelsData, catsData, subsData, itemsData, staffData, subjData] = await Promise.all([
        academicApi.getLabels(),
        academicApi.getCategories(),
        academicApi.getSubcategories(),
        academicApi.getItems(),
        staffApi.list({ limit: 1000 }),
        subjectsApi.list(),
      ]);
      setLabels(labelsData || null);
      setCategories(Array.isArray(catsData) ? catsData : []);
      setSubcategories(Array.isArray(subsData) ? subsData : []);
      setItems(Array.isArray(itemsData) ? itemsData : []);
      setStaff(Array.isArray(staffData) ? staffData : []);
      setSubjects(Array.isArray(subjData) ? subjData : []);
    } catch { toast.error('Failed to load data'); } finally { setPageLoading(false); }
  };

  const mapAssignment = (item: Record<string, unknown>): PeriodAssignment => ({
    id: item.id as string,
    periodNumber: item.period_number as number,
    day: item.day as string,
    staffId: item.staff_id as string,
    subjectId: item.subject_id as string,
    staffName: (item.staff_name as string) || 'Unknown',
    subjectName: (item.subject_name as string) || 'Unknown',
    itemId: item.item_id as string,
  });

  const loadTimetable = async () => {
    if (!config.categoryId || !config.subcategoryId || !config.itemId) return;
    try {
      const params = new URLSearchParams({ category_id: config.categoryId, subcategory_id: config.subcategoryId, item_id: config.itemId });
      const data = await fetch(`${apiBase()}/timetable-assignments?${params}`, { headers: authHeaders() }).then(r => r.json());
      const list = Array.isArray(data) ? data : (data?.assignments || []);
      setAssignments(list.map(mapAssignment).filter((a: PeriodAssignment) => a.itemId === config.itemId));
    } catch (err) { console.error(err); }
  };

  const loadViewTimetable = async () => {
    if (!viewFilter.categoryId || !viewFilter.subcategoryId) return;
    setViewLoading(true);
    try {
      const params = new URLSearchParams({ category_id: viewFilter.categoryId, subcategory_id: viewFilter.subcategoryId });
      if (viewFilter.itemId) params.append('item_id', viewFilter.itemId);
      const data = await fetch(`${apiBase()}/timetable-assignments?${params}`, { headers: authHeaders() }).then(r => r.json());
      const list = Array.isArray(data) ? data : (data?.assignments || []);
      const mapped = list.map(mapAssignment);
      setViewAssignments(viewFilter.itemId ? mapped.filter((a: PeriodAssignment) => a.itemId === viewFilter.itemId) : mapped);
    } catch { } finally { setViewLoading(false); }
  };

  const syncPeriodTimesToDB = async () => {
    const base = apiBase();
    const mins2hhmm = (m: number) => {
      const t = ((m % 1440) + 1440) % 1440;
      return `${String(Math.floor(t / 60)).padStart(2,'0')}:${String(t % 60).padStart(2,'0')}:00`;
    };
    const currentSlots = buildSlots(config.startTime, config.periodCount, config.periodDuration, config.breaks, config.customPeriodTimes);
    const periodsPayload = currentSlots.filter(s => !s.isBreak).map(s => {
      const slotIdx   = currentSlots.indexOf(s);
      const nextEntry = currentSlots[slotIdx + 1];
      return {
        period_number: s.period,
        start_time:    mins2hhmm(s.startMins),
        end_time:      mins2hhmm(s.endMins),
        is_break:      false,
        break_duration: nextEntry?.isBreak ? (nextEntry.endMins - nextEntry.startMins) : null,
      };
    });
    await fetch(`${base}/periods/sync`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ periods: periodsPayload }),
    }).catch(() => {});
  };

  const checkTeacherConflict = (staffId: string, period: number, day: string, excludeId?: string): string | null => {
    const conflict = assignments.find(a =>
      a.staffId === staffId && a.periodNumber === period && a.day === day && a.id !== excludeId
    );
    if (conflict) {
      const sName = staff.find(s => s.id === staffId)?.full_name || 'This teacher';
      return `${sName} is already assigned to Period ${period} on ${day}.`;
    }
    return null;
  };

  const checkDuplicateSlot = (period: number, day: string, excludeId?: string): boolean =>
    assignments.some(a => a.periodNumber === period && a.day === day && a.id !== excludeId);

  const handleCellClick = (period: number, day: string) => {
    if (!config.itemId) { toast.error('Please select a section first.'); return; }
    const existing = assignments.find(a => a.periodNumber === period && a.day === day);
    form.reset({ staffId: existing?.staffId || '', subjectId: existing?.subjectId || '' });
    setSelectedPeriod({ period, day });
    setConflictWarning(null);
    setDialogOpen(true);
  };

  const watchedStaffId = form.watch('staffId');
  useEffect(() => {
    if (!watchedStaffId || !selectedPeriod) { setConflictWarning(null); return; }
    const existing = assignments.find(a => a.periodNumber === selectedPeriod.period && a.day === selectedPeriod.day);
    const conflict = checkTeacherConflict(watchedStaffId, selectedPeriod.period, selectedPeriod.day, existing?.id);
    setConflictWarning(conflict);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedStaffId, selectedPeriod]);

  const onSubmit = async (data: AssignmentForm) => {
    if (!selectedPeriod || !config.categoryId || !config.subcategoryId || !config.itemId) {
      toast.error('Missing required config'); return;
    }
    const existing = assignments.find(a => a.periodNumber === selectedPeriod.period && a.day === selectedPeriod.day);
    const conflict = checkTeacherConflict(data.staffId, selectedPeriod.period, selectedPeriod.day, existing?.id);
    if (conflict) { toast.error(conflict); return; }
    if (!existing && checkDuplicateSlot(selectedPeriod.period, selectedPeriod.day)) {
      toast.error('A subject is already assigned to this period/day.'); return;
    }
    const cellKey = `${selectedPeriod.period}-${selectedPeriod.day}`;
    setSavingCell(cellKey);
    const body = JSON.stringify({
      category_id: config.categoryId, subcategory_id: config.subcategoryId, item_id: config.itemId,
      period_number: selectedPeriod.period, day: selectedPeriod.day,
      staff_id: data.staffId, subject_id: data.subjectId,
    });
    try {
      if (existing?.id) {
        const res = await fetch(`${apiBase()}/timetable-assignments/${existing.id}`, { method: 'PUT', headers: authHeaders(), body });
        if (!res.ok) throw new Error('Update failed');
        setAssignments(prev => prev.map(a => a.id === existing.id ? {
          ...a, staffId: data.staffId, subjectId: data.subjectId,
          staffName: staff.find(s => s.id === data.staffId)?.full_name || 'Unknown',
          subjectName: subjects.find(s => s.id === data.subjectId)?.name || 'Unknown',
        } : a));
        toast.success('Assignment updated');
      } else {
        const res  = await fetch(`${apiBase()}/timetable-assignments`, { method: 'POST', headers: authHeaders(), body });
        if (!res.ok) throw new Error('Save failed');
        const saved = await res.json();
        setAssignments(prev => [...prev, {
          id: saved?.id || saved?.assignment?.id,
          periodNumber: selectedPeriod.period, day: selectedPeriod.day,
          staffId: data.staffId, subjectId: data.subjectId,
          staffName: staff.find(s => s.id === data.staffId)?.full_name || 'Unknown',
          subjectName: subjects.find(s => s.id === data.subjectId)?.name || 'Unknown',
          itemId: config.itemId,
        }]);
        toast.success('Assignment saved');
      }
      setDialogOpen(false);
      form.reset();
      debouncedSync();
    } catch (err: unknown) {
      toast.error(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      loadTimetable();
    } finally { setSavingCell(null); }
  };

  const handleDelete = async () => {
    const existing = assignments.find(a => a.periodNumber === selectedPeriod?.period && a.day === selectedPeriod?.day);
    if (!existing?.id) { toast.error('No assignment to delete'); return; }
    setDeletingId(existing.id);
    try {
      const res = await fetch(`${apiBase()}/timetable-assignments/${existing.id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error();
      setAssignments(prev => prev.filter(a => a.id !== existing.id));
      toast.success('Deleted');
      setDeleteDialogOpen(false);
      setDialogOpen(false);
      form.reset();
    } catch { toast.error('Failed to delete'); loadTimetable(); }
    finally { setDeletingId(null); }
  };

  const handleSubmitConfig = async () => {
    if (!config.categoryId || !config.subcategoryId) { toast.error('Select department and year'); return; }
    if (!config.itemId)          { toast.error('Please select a section'); return; }
    if (!config.classTeacherId)  { toast.error('Please assign a class teacher'); return; }
    try {
      const res = await fetch(`${apiBase()}/class-teachers`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          category_id: config.categoryId, subcategory_id: config.subcategoryId,
          item_id: config.itemId, staff_id: config.classTeacherId,
        }),
      });
      if (!res.ok) throw new Error();
      saveClassTeacher(sectionKey, config.classTeacherId);
      // Persist full slot config so View dialog always has the correct timing
      saveSectionSlotConfig(sectionKey, {
        startTime: config.startTime,
        periodCount: config.periodCount,
        periodDuration: config.periodDuration,
        breaks: config.breaks,
        customPeriodTimes: config.customPeriodTimes,
      });
      await syncPeriodTimesToDB();
      toast.success('Timetable config saved');
    } catch { toast.error('Failed to save'); }
  };

  const handlePeriodTimeEdit = (periodIndex: number, newTime24h: string) => {
    const updated = { ...config.customPeriodTimes, [periodIndex]: newTime24h };
    setConfig(prev => ({ ...prev, customPeriodTimes: updated }));
    savePeriodTimes(sectionKey, updated);
    // Keep section slot config in sync so View dialog picks it up
    saveSectionSlotConfig(sectionKey, {
      startTime: config.startTime,
      periodCount: config.periodCount,
      periodDuration: config.periodDuration,
      breaks: config.breaks,
      customPeriodTimes: updated,
    });
  };

  const handleCopyDay = async () => {
    if (copyFromDay === copyToDay) { toast.error('Source and target day must differ'); return; }
    const source = assignments.filter(a => a.day === copyFromDay);
    if (source.length === 0) { toast.error(`No assignments on ${copyFromDay} to copy`); return; }
    let copied = 0, skipped = 0;
    for (const asgn of source) {
      const alreadyExists = assignments.find(a => a.periodNumber === asgn.periodNumber && a.day === copyToDay);
      if (alreadyExists) { skipped++; continue; }
      const body = JSON.stringify({
        category_id: config.categoryId, subcategory_id: config.subcategoryId, item_id: config.itemId,
        period_number: asgn.periodNumber, day: copyToDay, staff_id: asgn.staffId, subject_id: asgn.subjectId,
      });
      const res = await fetch(`${apiBase()}/timetable-assignments`, { method: 'POST', headers: authHeaders(), body });
      if (res.ok) copied++;
    }
    toast.success(`Copied ${copied} periods to ${copyToDay}${skipped ? ` (${skipped} skipped)` : ''}`);
    setCopyDayOpen(false);
    loadTimetable();
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const vCat  = categories.find(c => c.id === viewFilter.categoryId)?.name || '';
    const vSub  = subcategories.find(s => s.id === viewFilter.subcategoryId)?.name || '';
    const vItem = items.find(i => i.id === viewFilter.itemId)?.name || '';
    win.document.write(`
      <html><head><title>Timetable</title>
      <style>body{font-family:sans-serif;padding:20px}h2{margin-bottom:4px}p{margin:0 0 12px;color:#555;font-size:13px}
      table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:center}
      th{background:#f3f4f6;font-weight:600}.break-row td{background:#fef3c7;color:#92400e}</style>
      </head><body><h2>Class Timetable</h2>
      <p>${vCat}${vSub ? ' → '+vSub:''}${vItem ? ' → Section '+vItem:''} · ${config.shift} · Ends ${viewDayEndTime}</p>
      ${content.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  };

  const teacherWorkload = staff.map(t => ({
    ...t,
    count: assignments.filter(a => a.staffId === t.id).length,
  })).filter(t => t.count > 0).sort((a, b) => b.count - a.count);

  const teacherAssignments = viewAssignments.filter(a => a.staffId === selectedTeacherId);

  const getAsgn = (period: number, day: string, src: PeriodAssignment[] = assignments) =>
    src.find(a => a.periodNumber === period && a.day === day);

  const filteredSubs      = subcategories.filter(s => !config.categoryId || s.category_id === config.categoryId);
  const filteredItems     = items.filter(i => !config.subcategoryId || i.subcategory_id === config.subcategoryId);
  const filteredSubjects  = subjects.filter(s =>
    s.category_id === config.categoryId || s.subcategory_id === config.subcategoryId || (!s.category_id && !s.subcategory_id)
  );
  const selCatName  = categories.find(c => c.id === config.categoryId)?.name || '';
  const selSubName  = subcategories.find(s => s.id === config.subcategoryId)?.name || '';
  const selItemName = items.find(i => i.id === config.itemId)?.name || '';

  const existingForSelected = selectedPeriod ? getAsgn(selectedPeriod.period, selectedPeriod.day) : undefined;

  const viewFilteredSubs  = subcategories.filter(s => !viewFilter.categoryId || s.category_id === viewFilter.categoryId);
  const viewFilteredItems = items.filter(i => !viewFilter.subcategoryId || i.subcategory_id === viewFilter.subcategoryId);
  const vCatName  = categories.find(c => c.id === viewFilter.categoryId)?.name || '';
  const vSubName  = subcategories.find(s => s.id === viewFilter.subcategoryId)?.name || '';
  const vItemName = items.find(i => i.id === viewFilter.itemId)?.name || '';

  const totalAssignments = assignments.length;
  const assignedCells    = config.periodCount * DAYS.length;
  const coveragePercent  = assignedCells ? Math.round((totalAssignments / assignedCells) * 100) : 0;

  // ─────────────────────────────────────────────
  // Timetable Grid (Edit mode — interactive table)
  // ─────────────────────────────────────────────
  const TimetableGrid = ({
    interactive, slotList, src, showEditableTime = false,
  }: {
    interactive: boolean;
    slotList: SlotEntry[];
    src: PeriodAssignment[];
    showEditableTime?: boolean;
  }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50/60 border-b border-gray-100">
            <th className="border border-gray-200 p-3 text-center font-bold text-[10px] uppercase tracking-widest text-gray-400 w-10">#</th>
            <th className="border border-gray-200 p-3 text-center font-bold text-[10px] uppercase tracking-widest text-gray-400 min-w-[160px]">
              <span className="flex items-center justify-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Time
                {showEditableTime && <span className="text-[9px] font-normal text-gray-400 ml-1">(click to edit)</span>}
              </span>
            </th>
            {DAYS.map(d => (
              <th key={d} className="border border-gray-200 p-3 text-center font-bold text-[10px] uppercase tracking-widest text-gray-400 min-w-[120px]">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slotList.map((slot, idx) => {
            if (slot.isBreak) return (
              <tr key={`brk-${idx}`}>
                <td colSpan={8} className="border border-gray-200 p-2 text-center text-xs font-semibold bg-amber-50 text-amber-700">
                  ☕ {slot.breakName} &nbsp;({fmtTime(slot.startMins)} – {fmtTime(slot.endMins)})
                </td>
              </tr>
            );
            const timeRange = `${fmtTime(slot.startMins)} – ${fmtTime(slot.endMins)}`;
            return (
              <tr key={slot.period} className={interactive ? 'hover:bg-indigo-50/20 transition-colors' : ''}>
                <td className="border border-gray-200 p-3 text-center font-medium text-xs text-gray-500">{slot.period}</td>
                <td className="border border-gray-200 p-2 text-center text-xs text-gray-500">
                  {showEditableTime
                    ? <EditableTimeRange value={timeRange} periodIndex={slot.period} onSave={handlePeriodTimeEdit} />
                    : <span className="whitespace-nowrap font-mono text-gray-600">{timeRange}</span>}
                </td>
                {DAYS.map(day => {
                  const asgn    = getAsgn(slot.period, day, src);
                  const cellKey = `${slot.period}-${day}`;
                  const saving  = savingCell === cellKey;
                  return (
                    <td key={day} className="border border-gray-200 p-1 text-center">
                      {saving ? (
                        <div className="w-full h-12 flex items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                        </div>
                      ) : asgn ? (
                        interactive ? (
                          <button
                            onClick={() => handleCellClick(slot.period, day)}
                            className="w-full p-2 rounded-lg bg-indigo-50/60 border border-indigo-200 hover:bg-indigo-100 transition-colors text-left"
                          >
                            <div className="font-bold text-xs truncate text-indigo-700">{asgn.subjectName}</div>
                            <div className="text-gray-500 text-[10px] truncate">{asgn.staffName}</div>
                          </button>
                        ) : (
                          <div className="p-2 text-left rounded-lg bg-indigo-50/60 border border-indigo-200">
                            <div className="font-bold text-xs text-indigo-700">{asgn.subjectName}</div>
                            <div className="text-gray-500 text-[10px]">{asgn.staffName}</div>
                          </div>
                        )
                      ) : interactive ? (
                        <button
                          className="w-full h-12 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50/40 rounded-lg transition-colors flex items-center justify-center"
                          onClick={() => handleCellClick(slot.period, day)}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* ── Page Header ── */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <button
              onClick={() => navigate(-1)}
              className="mt-0.5 flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4 text-gray-500" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Timetable Management</h1>
              <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                Configure class routines, assign teachers, and manage periods
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-mono text-gray-400">{pageLoading ? 'Loading…' : `${totalAssignments} assignments`}</p>
            <div className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500">
              <Shield className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* ── Metric Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Total Periods"  value={config.periodCount}    icon={Clock}       iconBg="bg-indigo-50"  iconColor="text-indigo-600"  />
          <MetricCard label="Breaks"         value={config.breaks.length}  icon={Coffee}      iconBg="bg-amber-50"   iconColor="text-amber-600"   />
          <MetricCard label="Assignments"    value={totalAssignments}      icon={BookOpen}    iconBg="bg-emerald-50" iconColor="text-emerald-600" />
          <MetricCard label="Coverage"       value={`${coveragePercent}%`} icon={CheckCircle} iconBg="bg-purple-50"  iconColor="text-purple-600"  />
        </div>

        {/* ── End Time Banner ── */}
        {config.categoryId && config.subcategoryId && (
          <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-sm">
            <Clock className="h-4 w-4 text-indigo-500 shrink-0" />
            <span className="text-indigo-700 font-medium">
              School day: <span className="font-bold">{display24h(config.startTime)}</span>
              <span className="mx-2 text-indigo-400">→</span>
              <span className="font-bold">{dayEndTime}</span>
            </span>
            <span className="ml-auto text-indigo-400 text-xs">{config.periodCount} periods · {config.breaks.length} break{config.breaks.length !== 1 ? 's' : ''}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">

          {/* ── Configuration Card ── */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
              <div className="p-2 rounded-lg bg-indigo-50"><Settings className="h-4 w-4 text-indigo-600" /></div>
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Class Routine Configuration</h2>
                <p className="text-xs text-gray-400 mt-0.5">Configure timetable settings for each section</p>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Shift */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Shift *</Label>
                <Select value={config.shift} onValueChange={v => setConfig({ ...config, shift: v })}>
                  <SelectTrigger className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400"><SelectValue /></SelectTrigger>
                  <SelectContent>{SHIFTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Start time */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Start Time *</Label>
                <Input
                  type="text" placeholder="e.g. 09:30 AM or 09:30" value={startTimeInput}
                  onChange={e => {
                    setStartTimeInput(e.target.value);
                    const mins = timeToMinutes(e.target.value);
                    if (mins > 0) setConfig(prev => ({ ...prev, startTime: `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`, customPeriodTimes: {} }));
                  }}
                  onBlur={() => { const mins = timeToMinutes(startTimeInput); if (mins >= 0) setStartTimeInput(fmtTime(mins)); }}
                  className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 bg-white"
                />
                <p className="text-[10px] text-gray-400">Enter time like "09:30 AM" or "09:30"</p>
              </div>

              {/* Period count */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">No. of Periods *</Label>
                <Select value={config.periodCount.toString()} onValueChange={v => setConfig({ ...config, periodCount: parseInt(v) })}>
                  <SelectTrigger className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400"><SelectValue /></SelectTrigger>
                  <SelectContent>{[4,5,6,7,8,9,10].map(n => <SelectItem key={n} value={n.toString()}>{String(n).padStart(2,'0')}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Period duration */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Period Duration (minutes) *</Label>
                <Input type="number" min={10} value={config.periodDuration}
                  onChange={e => setConfig({ ...config, periodDuration: parseInt(e.target.value) || 45 })}
                  className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 bg-white" />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  <GraduationCap className="h-3.5 w-3.5" /> {labels?.category_label || 'Department'} *
                </Label>
                <Select value={config.categoryId} onValueChange={v => setConfig({ ...config, categoryId: v, subcategoryId: '', itemId: '', classTeacherId: '' })}>
                  <SelectTrigger className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400"><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Subcategory */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  <Users className="h-3.5 w-3.5" /> {labels?.subcategory_label || 'Year'} *
                </Label>
                <Select value={config.subcategoryId} onValueChange={v => setConfig({ ...config, subcategoryId: v, itemId: '', classTeacherId: '' })}>
                  <SelectTrigger className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400"><SelectValue placeholder="Select year / class" /></SelectTrigger>
                  <SelectContent>{filteredSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Item/Section */}
              {config.subcategoryId && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    <Layers className="h-3.5 w-3.5" /> {labels?.item_label || 'Section'} *
                  </Label>
                  <Select value={config.itemId || ''} onValueChange={v => setConfig({ ...config, itemId: v, classTeacherId: '' })}>
                    <SelectTrigger className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400"><SelectValue placeholder="Select section" /></SelectTrigger>
                    <SelectContent>{filteredItems.map(item => <SelectItem key={item.id} value={item.id}>Section {item.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

              {/* Class teacher */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Class Teacher *</Label>
                <Select value={config.classTeacherId} onValueChange={v => setConfig({ ...config, classTeacherId: v })}>
                  <SelectTrigger className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400"><SelectValue placeholder="Select class teacher" /></SelectTrigger>
                  <SelectContent>{staff.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
                </Select>
                {config.classTeacherId && (
                  <p className="text-[11px] text-emerald-600 flex items-center gap-1 mt-1">
                    <CheckCircle className="h-3 w-3" /> {staff.find(s => s.id === config.classTeacherId)?.full_name}
                  </p>
                )}
              </div>

              {/* Teacher Workload */}
              {teacherWorkload.length > 0 && (
                <div className="pt-4 border-t border-gray-100 space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-indigo-400" /> Teacher Workload (this section)
                  </h3>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {teacherWorkload.map(t => (
                      <div key={t.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 truncate max-w-[180px]">{t.full_name}</span>
                        <span className={`font-bold tabular-nums px-1.5 py-0.5 rounded text-[10px] ${
                          t.count >= 10 ? 'bg-rose-50 text-rose-600' : t.count >= 6 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>{t.count} period{t.count !== 1 ? 's' : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Breaks */}
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <h3 className="font-bold text-sm flex items-center gap-2 text-gray-700">
                  <Clock className="h-4 w-4 text-amber-500" /> Break Configuration
                </h3>
                {config.breaks.map((brk, idx) => (
                  <div key={brk.id} className="p-4 bg-amber-50/40 rounded-lg border border-amber-200 space-y-3">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Break Name</Label>
                      <Input value={brk.name} placeholder="e.g. Lunch Break"
                        onChange={e => { const nb = [...config.breaks]; nb[idx].name = e.target.value; setConfig({ ...config, breaks: nb }); }}
                        className="h-9 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 bg-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Duration (min)</Label>
                        <Input type="number" min={5} value={brk.duration}
                          onChange={e => { const nb = [...config.breaks]; nb[idx].duration = parseInt(e.target.value) || 15; setConfig({ ...config, breaks: nb }); }}
                          className="h-9 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 bg-white" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">After Period</Label>
                        <Select value={brk.afterPeriod.toString()} onValueChange={v => { const nb = [...config.breaks]; nb[idx].afterPeriod = parseInt(v); setConfig({ ...config, breaks: nb }); }}>
                          <SelectTrigger className="h-9 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>{Array.from({ length: config.periodCount - 1 }, (_, i) => i + 1).map(n => <SelectItem key={n} value={n.toString()}>Period {n}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    {config.breaks.length > 1 && (
                      <Button variant="destructive" size="sm" className="h-8 text-xs rounded-lg"
                        onClick={() => setConfig({ ...config, breaks: config.breaks.filter((_, i) => i !== idx) })}>
                        Remove Break
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" className="w-full h-10 text-xs border border-gray-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50/30"
                  onClick={() => setConfig({ ...config, breaks: [...config.breaks, { id: crypto.randomUUID(), name: `Break ${config.breaks.length + 1}`, duration: 15, afterPeriod: Math.min((config.breaks[config.breaks.length - 1]?.afterPeriod || 2) + 2, config.periodCount - 1) }] })}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Break
                </Button>
              </div>
            </div>
          </div>

          {/* ── Timetable Grid Card ── */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-5 py-4 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Class Routine</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {config.categoryId && config.subcategoryId && config.itemId ? (
                    <span className="flex items-center gap-1 flex-wrap">
                      <span className="font-semibold text-gray-700">{selCatName}</span>
                      <span className="text-gray-400">→</span>
                      <span className="font-semibold text-gray-700">{selSubName}</span>
                      <span className="text-gray-400">→</span>
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">Section {selItemName}</span>
                      <span className="text-gray-400 ml-1 text-[10px]">· Click a cell to assign</span>
                    </span>
                  ) : config.categoryId && config.subcategoryId ? 'Select a section to start editing' : 'Select department, year and section'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {config.itemId && (
                  <Button variant="outline" size="sm" className="h-9 text-xs rounded-lg border border-gray-200 hover:border-indigo-400"
                    onClick={() => setCopyDayOpen(true)}>
                    <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Day
                  </Button>
                )}
                <Button variant="outline" size="sm" className="h-9 text-xs rounded-lg border border-gray-200 hover:border-indigo-400"
                  onClick={() => {
                    setViewFilter({ categoryId: config.categoryId, subcategoryId: config.subcategoryId, itemId: config.itemId });
                    setViewDialogOpen(true);
                  }}>
                  <Eye className="h-3.5 w-3.5 mr-1.5" /> View Timetable
                </Button>
                <Button variant="outline" size="sm" className="h-9 text-xs rounded-lg border border-gray-200 hover:border-indigo-400"
                  onClick={() => {
                    setViewFilter({ categoryId: config.categoryId, subcategoryId: config.subcategoryId, itemId: config.itemId });
                    setTeacherViewOpen(true);
                    loadViewTimetable();
                  }}>
                  <UserCheck className="h-3.5 w-3.5 mr-1.5" /> Teacher View
                </Button>
              </div>
            </div>

            <div className="p-5">
              {!config.categoryId || !config.subcategoryId || !config.itemId ? (
                <div className="text-center py-16 text-gray-400">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Select department, year and section</p>
                  <p className="text-xs mt-1 text-gray-400/70">Each section has its own independent timetable</p>
                </div>
              ) : pageLoading ? (
                <div className="text-center py-16 text-gray-400 flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                </div>
              ) : (
                <>
                  <TimetableGrid interactive slotList={slots} src={assignments} showEditableTime />
                  <div className="flex justify-between items-center gap-2 mt-6 pt-4 border-t border-gray-200">
                    <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg border border-gray-200"
                      onClick={() => { const saved = loadBreaks(); setConfig({ ...DEFAULT_CONFIG, breaks: saved || DEFAULT_CONFIG.breaks }); setStartTimeInput('09:30 AM'); }}>
                      Reset Config
                    </Button>
                    <Button onClick={handleSubmitConfig} size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm">
                      Save Class Teacher
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-gray-300" />
            <span>Institution ID: <span className="font-semibold text-gray-600">{profile?.institution_id?.slice(0, 8) || '—'}…</span></span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold border border-emerald-200 text-[10px] uppercase tracking-wide flex items-center gap-1">
              <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" /> Active
            </span>
          </div>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" /> Real-time updates
          </span>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          Assignment Dialog
      ════════════════════════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-white rounded-xl border border-gray-100">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">{existingForSelected ? 'Edit Assignment' : 'New Assignment'}</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Period {selectedPeriod?.period} — {selectedPeriod?.day}
              {selItemName && <> · <strong>Section {selItemName}</strong></>}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {conflictWarning && (
                <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-rose-500" />
                  <span>{conflictWarning}</span>
                </div>
              )}
              <FormField control={form.control} name="staffId" rules={{ required: 'Staff is required' }} render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Staff *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className={`h-10 text-sm border rounded-lg focus:border-indigo-400 ${conflictWarning ? 'border-rose-300' : 'border-gray-200'}`}>
                        <SelectValue placeholder="Select staff" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {staff.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="flex items-center gap-2">
                            {t.full_name}
                            <span className="text-[10px] text-gray-400">({assignments.filter(a => a.staffId === t.id).length} periods)</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs text-rose-500" />
                </FormItem>
              )} />
              <FormField control={form.control} name="subjectId" rules={{ required: 'Subject is required' }} render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Subject *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400"><SelectValue placeholder="Select subject" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredSubjects.length === 0
                        ? <SelectItem value="__none__" disabled>No subjects for this class</SelectItem>
                        : filteredSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs text-rose-500" />
                </FormItem>
              )} />
              <div className="flex justify-between gap-2 pt-2">
                {existingForSelected && (
                  <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)} className="rounded-lg" disabled={!!deletingId}>
                    {deletingId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
                    Delete
                  </Button>
                )}
                <div className="flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)} className="rounded-lg border border-gray-200">Cancel</Button>
                <Button type="submit" size="sm" disabled={!!savingCell} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
                  {savingCell ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  {existingForSelected ? 'Update' : 'Save'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-xl border border-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-gray-900">Delete Assignment</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-500">
              Remove Period {selectedPeriod?.period} on {selectedPeriod?.day}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg border border-gray-200">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={!!deletingId} className="bg-rose-600 hover:bg-rose-700 rounded-lg">
              {deletingId ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Copy Day Dialog */}
      <Dialog open={copyDayOpen} onOpenChange={setCopyDayOpen}>
        <DialogContent className="max-w-sm bg-white rounded-xl border border-gray-100">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Copy className="h-4 w-4 text-indigo-500" /> Copy Day Schedule
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Copy all period assignments from one day to another. Existing assignments in the target day will be skipped.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Copy From</Label>
              <Select value={copyFromDay} onValueChange={v => setCopyFromDay(v as Day)}>
                <SelectTrigger className="h-10 text-sm border border-gray-200 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d} ({assignments.filter(a => a.day === d).length} periods)</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Copy To</Label>
              <Select value={copyToDay} onValueChange={v => setCopyToDay(v as Day)}>
                <SelectTrigger className="h-10 text-sm border border-gray-200 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>{DAYS.filter(d => d !== copyFromDay).map(d => <SelectItem key={d} value={d}>{d} ({assignments.filter(a => a.day === d).length} periods)</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCopyDayOpen(false)} className="rounded-lg border border-gray-200">Cancel</Button>
            <Button size="sm" onClick={handleCopyDay} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Schedule
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════
          View Timetable Dialog
      ════════════════════════════════════════════ */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-6xl w-full max-h-[90vh] overflow-y-auto bg-white rounded-xl border border-gray-100">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <div>
                <DialogTitle className="text-base font-bold text-gray-900">View Class Timetable</DialogTitle>
                <DialogDescription className="text-xs text-gray-500">
                  Filter by department, year and section to see the full schedule
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                {/* View mode toggle */}
                <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setViewMode('card')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                      viewMode === 'card' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                    title="Card view — day columns"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" /> Cards
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                      viewMode === 'table' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                    title="Table view — period rows"
                  >
                    <List className="h-3.5 w-3.5" /> Table
                  </button>
                </div>
                {viewFilter.categoryId && viewFilter.subcategoryId && (
                  <Button variant="outline" size="sm" onClick={handlePrint} className="flex items-center gap-2 h-8 text-xs rounded-lg border border-gray-200">
                    <Printer className="h-3.5 w-3.5" /> Print
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Filter row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{labels?.category_label || 'Department'}</Label>
              <Select value={viewFilter.categoryId} onValueChange={v => setViewFilter({ categoryId: v, subcategoryId: '', itemId: '' })}>
                <SelectTrigger className="h-9 text-sm border border-gray-200 rounded-lg"><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{labels?.subcategory_label || 'Year'}</Label>
              <Select value={viewFilter.subcategoryId} disabled={!viewFilter.categoryId} onValueChange={v => setViewFilter(f => ({ ...f, subcategoryId: v, itemId: '' }))}>
                <SelectTrigger className="h-9 text-sm border border-gray-200 rounded-lg"><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>{viewFilteredSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Section</Label>
              <Select value={viewFilter.itemId || ''} disabled={!viewFilter.subcategoryId} onValueChange={v => setViewFilter(f => ({ ...f, itemId: v }))}>
                <SelectTrigger className="h-9 text-sm border border-gray-200 rounded-lg"><SelectValue placeholder="All sections" /></SelectTrigger>
                <SelectContent>{viewFilteredItems.map(item => <SelectItem key={item.id} value={item.id}>Section {item.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Timing info banner — shows exactly what timing is used for this viewed section */}
          {viewFilter.categoryId && viewFilter.subcategoryId && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-lg text-xs">
              <Clock className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              <span className="text-indigo-700">
                Start: <strong>{display24h(viewSlotConfig.startTime)}</strong>
                <span className="mx-2 text-indigo-300">·</span>
                {viewSlotConfig.periodCount} periods
                <span className="mx-2 text-indigo-300">·</span>
                {viewSlotConfig.periodDuration} min each
                <span className="mx-2 text-indigo-300">·</span>
                {viewSlotConfig.breaks.length} break{viewSlotConfig.breaks.length !== 1 ? 's' : ''}
                {viewSlotConfig.breaks.map(b => (
                  <span key={b.id} className="ml-2 text-indigo-400">
                    ({b.name}: {b.duration}m after P{b.afterPeriod})
                  </span>
                ))}
                <span className="mx-2 text-indigo-300">·</span>
                Ends <strong>{viewDayEndTime}</strong>
              </span>
            </div>
          )}

          {/* Breadcrumb */}
          {viewFilter.categoryId && viewFilter.subcategoryId && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">{vCatName}</span>
              <span className="text-gray-400 text-xs">→</span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">{vSubName}</span>
              {vItemName && (
                <>
                  <span className="text-gray-400 text-xs">→</span>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">Section {vItemName}</span>
                </>
              )}
              {viewAssignments.length > 0 && (
                <span className="ml-auto text-[10px] text-gray-400">
                  {viewAssignments.length} assignment{viewAssignments.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {/* Content */}
          {!viewFilter.categoryId || !viewFilter.subcategoryId ? (
            <div className="text-center py-16 text-gray-400">
              <Eye className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Select department and year to view timetable</p>
              <p className="text-xs mt-1 text-gray-300">You can optionally filter by section</p>
            </div>
          ) : viewLoading ? (
            <div className="text-center py-16 text-gray-400 flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading timetable…
            </div>
          ) : (
            <>
              {/* Hidden printable area uses viewSlots for correct times */}
              <div ref={printRef} className="hidden">
                <TimetableGrid interactive={false} slotList={viewSlots} src={viewAssignments} showEditableTime={false} />
              </div>

              {/* Visual view — both card and table use viewSlots */}
              {viewMode === 'card' ? (
                <VisualTimetableGrid slotList={viewSlots} src={viewAssignments} />
              ) : (
                <VisualTimetableTable slotList={viewSlots} src={viewAssignments} />
              )}

              {/* Legend */}
              <div className="flex flex-wrap gap-4 text-xs text-gray-500 border-t pt-3">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-indigo-50 border border-indigo-200" /> Assigned
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-amber-100 border border-amber-200" /> Break
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-300 font-medium">—</span>&nbsp;Free period
                </div>
                <div className="ml-auto text-[10px] text-gray-300">
                  {viewMode === 'card' ? 'Card view: one column per day' : 'Table view: one row per period'}
                </div>
              </div>

              {viewAssignments.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-4">No assignments found for this selection.</p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════
          Teacher View Dialog
      ════════════════════════════════════════════ */}
      <Dialog open={teacherViewOpen} onOpenChange={setTeacherViewOpen}>
        <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-y-auto bg-white rounded-xl border border-gray-100">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-indigo-500" /> Teacher Timetable View
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">See all periods assigned to a specific teacher</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Select Teacher</Label>
            <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
              <SelectTrigger className="h-10 text-sm border border-gray-200 rounded-lg">
                <SelectValue placeholder="Choose a teacher…" />
              </SelectTrigger>
              <SelectContent>
                {staff.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.full_name}
                    <span className="ml-2 text-[10px] text-gray-400">({viewAssignments.filter(a => a.staffId === t.id).length} periods)</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedTeacherId && (
            <>
              <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-sm">
                <UserCheck className="h-4 w-4 text-indigo-500 shrink-0" />
                <span className="font-semibold text-indigo-800">{staff.find(s => s.id === selectedTeacherId)?.full_name}</span>
                <span className="ml-auto text-xs text-indigo-600 font-medium">{teacherAssignments.length} period{teacherAssignments.length !== 1 ? 's' : ''} assigned</span>
              </div>
              {viewLoading ? (
                <div className="text-center py-10 text-gray-400 flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" /> Loading…
                </div>
              ) : teacherAssignments.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">No periods assigned to this teacher in the selected view.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="border border-gray-200 p-3 text-left text-[10px] uppercase tracking-widest text-gray-400">Day</th>
                        <th className="border border-gray-200 p-3 text-left text-[10px] uppercase tracking-widest text-gray-400">Period</th>
                        <th className="border border-gray-200 p-3 text-left text-[10px] uppercase tracking-widest text-gray-400">Time</th>
                        <th className="border border-gray-200 p-3 text-left text-[10px] uppercase tracking-widest text-gray-400">Subject</th>
                        <th className="border border-gray-200 p-3 text-left text-[10px] uppercase tracking-widest text-gray-400">Section</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...teacherAssignments]
                        .sort((a, b) => DAYS.indexOf(a.day as Day) - DAYS.indexOf(b.day as Day) || a.periodNumber - b.periodNumber)
                        .map((asgn, i) => {
                          // Resolve slot config for this specific assignment's section
                          const asgnSectionKey = `${viewFilter.categoryId}__${viewFilter.subcategoryId}__${asgn.itemId || 'all'}`;
                          const asgnSlotCfg    = resolveSlotConfig(asgnSectionKey);
                          const asgnSlots      = buildSlots(
                            asgnSlotCfg.startTime,
                            asgnSlotCfg.periodCount,
                            asgnSlotCfg.periodDuration,
                            asgnSlotCfg.breaks,
                            asgnSlotCfg.customPeriodTimes
                          );
                          const slot      = asgnSlots.find(s => !s.isBreak && s.period === asgn.periodNumber);
                          const timeRange = slot ? `${fmtTime(slot.startMins)} – ${fmtTime(slot.endMins)}` : '—';
                          const sectionName = items.find(it => it.id === asgn.itemId)?.name || asgn.itemId || '—';
                          const c = getSubjectColor(asgn.subjectId);
                          return (
                            <tr key={i} className="hover:bg-indigo-50/20 transition-colors">
                              <td className="border border-gray-200 p-3 font-bold text-xs text-gray-700">{asgn.day}</td>
                              <td className="border border-gray-200 p-3 text-xs text-gray-600">Period {asgn.periodNumber}</td>
                              <td className="border border-gray-200 p-3 font-mono text-xs text-gray-500">{timeRange}</td>
                              <td className="border border-gray-200 p-3">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${c.bg} ${c.border} ${c.text}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                                  {asgn.subjectName}
                                </span>
                              </td>
                              <td className="border border-gray-200 p-3 text-xs text-gray-500">Section {sectionName}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}