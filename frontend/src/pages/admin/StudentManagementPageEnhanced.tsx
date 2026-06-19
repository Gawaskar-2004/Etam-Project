import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  getStudents, createStudent, updateStudent, deleteStudent,
  getAcademicLabels, getAcademicCategories,
  getAllAcademicSubcategories, getAllAcademicItems,
} from '@/db/api';
import { uploadFile } from '@/lib/api';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { BulkUploadDialog } from '@/components/BulkUploadDialog';
import {
  Plus, Edit, Trash2, Upload, Download, User, Phone,
  GraduationCap, Search, Home, Clock, Fingerprint, Users,
  X, CalendarDays,
  ChevronDown, ChevronUp, RefreshCw, BookOpen,
  CheckCircle2, AlertCircle, Mail, Smartphone,
  ChevronLeft, ChevronRight, FileDown, Pencil,
  UserCheck, UserX, UserMinus, LayoutGrid,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import type {
  Student, AcademicStructureLabel,
  AcademicCategory, AcademicSubcategory, AcademicItem,
} from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface StudentFormData {
  fullName: string; dateOfBirth: string; gender: 'male' | 'female' | 'other';
  bloodGroup: string; photoUrl: string; address: string; parentName: string;
  parentContact: string; studentEmail: string;
  studentMobile: string;
  registerNumber: string; categoryId: string; subcategoryId: string; itemId: string;
  residenceType: 'day_scholar' | 'hostel'; shiftTime: 'full_time' | 'morning' | 'afternoon';
  attendanceType: 'face' | 'groupi' | 'manual'; studentStatus: 'active' | 'inactive' | 'relieved';
}

interface BulkEditFormData {
  studentStatus?: string;
  residenceType?: string;
  shiftTime?: string;
  attendanceType?: string;
  categoryId?: string;
  subcategoryId?: string;
  itemId?: string;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const AVATAR_COLORS = [
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700' },
];

function getAvatarStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fix date for input[type=date] — DB may return "2005-01-15T00:00:00.000Z"
// ─────────────────────────────────────────────────────────────────────────────
function toDateInputValue(val?: string | null): string {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&';
  const all = upper + lower + digits + symbols;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  const chars = [
    pick(upper), pick(lower), pick(digits), pick(symbols),
    ...Array.from({ length: 4 }, () => pick(all)),
  ];
  return chars.sort(() => Math.random() - 0.5).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric Card
// ─────────────────────────────────────────────────────────────────────────────
function MetricCard({ label, value, icon: Icon, iconBg, iconColor, subtitle, active, onClick, downloadable, onDownload }: {
  label: string; value: number; icon: any;
  iconBg: string; iconColor: string; subtitle?: string;
  active?: boolean; onClick?: () => void;
  downloadable?: boolean; onDownload?: (e: React.MouseEvent) => void;
}) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.max(1, Math.ceil(value / 40));
    const id = setInterval(() => {
      start = Math.min(start + step, value);
      setDisplay(start);
      if (start >= value) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [value]);

  return (
    <div
      onClick={onClick}
      className={`relative bg-white rounded-xl border p-4 shadow-sm transition-all duration-200 group
        ${onClick ? 'cursor-pointer hover:shadow-md' : ''}
        ${active ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-100 hover:shadow-md'}`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-gray-400">{label}</p>
        <div className="flex items-center gap-1.5">
          {downloadable && onDownload && (
            <button
              onClick={onDownload}
              title={`Download ${label} report`}
              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-gray-100 text-gray-400 hover:text-indigo-600"
            >
              <FileDown className="h-3 w-3" />
            </button>
          )}
          <div className={`p-2 rounded-lg ${iconBg}`}>
            <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
          </div>
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{display.toLocaleString()}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      {active && (
        <span className="absolute bottom-2 right-3 text-[10px] font-semibold text-indigo-500">Filtered ✓</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Badge
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    active:   { label: 'Active',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' },
    inactive: { label: 'Inactive', cls: 'bg-amber-50 text-amber-700 border-amber-100',       dot: 'bg-amber-500'   },
    relieved: { label: 'Relieved', cls: 'bg-red-50 text-red-600 border-red-100',             dot: 'bg-red-500'     },
  };
  const c = map[status ?? ''] ?? { label: 'N/A', cls: 'bg-gray-50 text-gray-500 border-gray-100', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function TempPasswordBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 text-orange-600 border border-orange-100">
      <Clock className="w-2.5 h-2.5" /> Awaiting Login
    </span>
  );
}

function AttendanceBadge({ type }: { type?: string }) {
  const map: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    face:   { label: 'Face ID', icon: <Fingerprint className="w-3 h-3" />, cls: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    groupi: { label: 'Groupi',  icon: <Users className="w-3 h-3" />,       cls: 'bg-violet-50 text-violet-600 border-violet-100' },
    manual: { label: 'Manual',  icon: <Clock className="w-3 h-3" />,       cls: 'bg-gray-50 text-gray-500 border-gray-100'        },
  };
  const c = map[type ?? 'manual'] ?? map['manual'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.cls}`}>
      {c.icon} {c.label}
    </span>
  );
}

function FilterChip({ label, active, onClick, dot }: {
  label: string; active: boolean; onClick: () => void; dot?: string;
}) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        active
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
      }`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
      {label}
    </button>
  );
}

function DeleteConfirmRow({ student, onConfirm, onCancel }: {
  student: Student; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <TableRow className="bg-red-50/50">
      <TableCell colSpan={9} className="py-3 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Delete <span className="font-semibold">{student.full_name}</span>? This cannot be undone.</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onCancel}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={onConfirm}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">
              Delete
            </button>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Edit Dialog
// ─────────────────────────────────────────────────────────────────────────────
function BulkEditDialog({
  open, onOpenChange, selectedCount, categories, subcategories, items, labels,
  onApply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedCount: number;
  categories: AcademicCategory[];
  subcategories: any[];
  items: any[];
  labels: AcademicStructureLabel | null;
  onApply: (data: BulkEditFormData) => void;
}) {
  const [formData, setFormData] = useState<BulkEditFormData>({});

  const handleApply = () => {
    const filtered: BulkEditFormData = {};
    Object.entries(formData).forEach(([k, v]) => {
      if (v && v !== '__no_change__') (filtered as any)[k] = v;
    });
    onApply(filtered);
    onOpenChange(false);
    setFormData({});
  };

  const field = (label: string, key: keyof BulkEditFormData, options: { value: string; label: string }[]) => (
    <div>
      <label className="text-xs font-medium text-gray-500 block mb-1.5">{label}</label>
      <select
        value={(formData[key] as string) || '__no_change__'}
        onChange={e => setFormData(p => ({ ...p, [key]: e.target.value }))}
        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:border-indigo-400"
      >
        <option value="__no_change__">— No change —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white rounded-2xl shadow-2xl p-0">
        <div className="px-6 py-4 border-b border-gray-100">
          <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Pencil className="h-4 w-4 text-indigo-500" />
            Bulk Update — {selectedCount} Student{selectedCount !== 1 ? 's' : ''}
          </DialogTitle>
          <p className="text-xs text-gray-400 mt-0.5">Only fields you change will be updated. Leave "No change" to keep existing values.</p>
        </div>
        <div className="px-6 py-5 grid grid-cols-2 gap-4">
          {field('Student Status', 'studentStatus', [
            { value: 'active',   label: 'Active'      },
            { value: 'inactive', label: 'Inactive'    },
            { value: 'relieved', label: 'Relieved'    },
          ])}
          {field('Residence Type', 'residenceType', [
            { value: 'day_scholar', label: 'Day Scholar' },
            { value: 'hostel',      label: 'Hostel'      },
          ])}
          {field('Shift Time', 'shiftTime', [
            { value: 'full_time',  label: 'Full Time'  },
            { value: 'morning',    label: 'Morning'    },
            { value: 'afternoon',  label: 'Afternoon'  },
          ])}
          {field('Attendance Type', 'attendanceType', [
            { value: 'face',   label: 'Face Recognition' },
            { value: 'groupi', label: 'Groupi'           },
            { value: 'manual', label: 'Manual'           },
          ])}
          {field(labels?.category_label || 'Category', 'categoryId',
            categories.map(c => ({ value: c.id, label: c.name }))
          )}
          {field(labels?.subcategory_label || 'Department', 'subcategoryId',
            subcategories.map(s => ({ value: s.id, label: s.name }))
          )}
          {field(labels?.item_label || 'Section', 'itemId',
            items.map(i => ({ value: i.id, label: i.name }))
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleApply}
            className="px-5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Apply to {selectedCount} Students
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function StudentManagementPage() {
  const { profile } = useAuth();

  const [students, setStudents]               = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [labels, setLabels]                   = useState<AcademicStructureLabel | null>(null);
  const [categories, setCategories]           = useState<AcademicCategory[]>([]);
  const [subcategories, setSubcategories]     = useState<AcademicSubcategory[]>([]);
  const [items, setItems]                     = useState<AcademicItem[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [refreshing, setRefreshing]           = useState(false);

  const [dialogOpen, setDialogOpen]           = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen]   = useState(false);
  const [bulkEditOpen, setBulkEditOpen]       = useState(false);
  const [editingStudent, setEditingStudent]   = useState<Student | null>(null);
  const [deleteTarget, setDeleteTarget]       = useState<Student | null>(null);
  const [uploading, setUploading]             = useState(false);

  // ── Selection (for bulk actions) ─────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Pagination ────────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage]   = useState(1);
  const [pageSize, setPageSize]         = useState(10);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm]                   = useState('');
  const [filterCategory, setFilterCategory]           = useState('all');
  const [filterSubcategory, setFilterSubcategory]     = useState('all');
  const [filterItem, setFilterItem]                   = useState('all');
  const [filterGender, setFilterGender]               = useState('all');
  const [filterResidenceType, setFilterResidenceType] = useState('all');
  const [filterShiftTime, setFilterShiftTime]         = useState('all');
  const [filterAttendanceType, setFilterAttendanceType] = useState('all');
  const [filterStudentStatus, setFilterStudentStatus] = useState('all');

  const [sortField, setSortField]         = useState<string>('full_name');
  const [sortDir, setSortDir]             = useState<'asc' | 'desc'>('asc');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  const form = useForm<StudentFormData>({
    defaultValues: {
      fullName: '', dateOfBirth: '', gender: 'male', bloodGroup: 'A+',
      photoUrl: '', address: '', parentName: '', parentContact: '',
      studentEmail: '', studentMobile: '', registerNumber: '',
      categoryId: '', subcategoryId: '', itemId: '',
      residenceType: 'day_scholar', shiftTime: 'full_time',
      attendanceType: 'manual', studentStatus: 'inactive',
    },
  });

  useEffect(() => { fetchData(); }, [profile?.institution_id]);

  useEffect(() => {
    applyFiltersAndSort();
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [
    students, searchTerm, filterCategory, filterSubcategory, filterItem,
    filterGender, filterResidenceType, filterShiftTime, filterAttendanceType,
    filterStudentStatus, sortField, sortDir,
  ]);

  const fetchData = async (silent = false) => {
    if (!profile?.institution_id) return;
    try {
      if (!silent) setLoading(true); else setRefreshing(true);
      const [studentsData, labelsData, categoriesData, subcategoriesData, itemsData] = await Promise.all([
        getStudents(profile.institution_id, 1000, 0),
        getAcademicLabels(profile.institution_id),
        getAcademicCategories(profile.institution_id),
        getAllAcademicSubcategories(profile.institution_id),
        getAllAcademicItems(profile.institution_id),
      ]);
      setStudents(studentsData || []);
      setFilteredStudents(studentsData || []);
      setLabels(labelsData);
      setCategories(categoriesData || []);
      setSubcategories(subcategoriesData || []);
      setItems(itemsData || []);
    } catch { toast.error('Failed to load students'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const applyFiltersAndSort = () => {
    let data = [...students];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      data = data.filter(s =>
        s.full_name?.toLowerCase().includes(q) ||
        s.register_number?.toLowerCase().includes(q) ||
        s.student_email?.toLowerCase().includes(q) ||
        s.student_mobile?.toLowerCase().includes(q)
      );
    }
    if (filterCategory !== 'all')       data = data.filter(s => s.category_id === filterCategory);
    if (filterSubcategory !== 'all')    data = data.filter(s => s.subcategory_id === filterSubcategory);
    if (filterItem !== 'all')           data = data.filter(s => s.item_id === filterItem);
    if (filterGender !== 'all')         data = data.filter(s => s.gender === filterGender);
    if (filterResidenceType !== 'all')  data = data.filter(s => s.residence_type === filterResidenceType);
    if (filterShiftTime !== 'all')      data = data.filter(s => s.shift_time === filterShiftTime);
    if (filterAttendanceType !== 'all') data = data.filter(s => s.attendance_type === filterAttendanceType);
    if (filterStudentStatus !== 'all')  data = data.filter(s => s.student_status === filterStudentStatus);
    data.sort((a, b) => {
      const av = (a as any)[sortField] ?? '';
      const bv = (b as any)[sortField] ?? '';
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    setFilteredStudents(data);
  };

  // ── Pagination computed ───────────────────────────────────────────────────
  const totalPages  = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const pagedStart  = (currentPage - 1) * pageSize;
  const pagedStudents = filteredStudents.slice(pagedStart, pagedStart + pageSize);

  const goToPage = (p: number) => {
    setCurrentPage(Math.max(1, Math.min(p, totalPages)));
    setSelectedIds(new Set());
  };

  // ── Selection helpers ─────────────────────────────────────────────────────
  const allPageSelected = pagedStudents.length > 0 && pagedStudents.every(s => selectedIds.has(s.id));
  const someSelected    = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pagedStudents.forEach(s => next.delete(s.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pagedStudents.forEach(s => next.add(s.id));
        return next;
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Bulk Update ───────────────────────────────────────────────────────────
  const handleBulkEdit = async (data: BulkEditFormData) => {
    if (!selectedIds.size) return;
    const payload: Record<string, any> = {};
    if (data.studentStatus)  payload['student_status']  = data.studentStatus;
    if (data.residenceType)  payload['residence_type']  = data.residenceType;
    if (data.shiftTime)      payload['shift_time']      = data.shiftTime;
    if (data.attendanceType) payload['attendance_type'] = data.attendanceType;
    if (data.categoryId)     { payload['category_id'] = data.categoryId; payload['category'] = data.categoryId; }
    if (data.subcategoryId)  { payload['subcategory_id'] = data.subcategoryId; payload['subcategory'] = data.subcategoryId; }
    if (data.itemId)         { payload['item_id'] = data.itemId; payload['item'] = data.itemId; }

    if (!Object.keys(payload).length) {
      toast.info('No changes selected');
      return;
    }

    let successCount = 0;
    const errors: string[] = [];
    for (const id of Array.from(selectedIds)) {
      try {
        await updateStudent(id, payload);
        successCount++;
      } catch (err: any) {
        errors.push(err.message);
      }
    }

    if (errors.length) {
      toast.error(`Updated ${successCount}, ${errors.length} failed`);
    } else {
      toast.success(`${successCount} student${successCount !== 1 ? 's' : ''} updated`);
    }
    setSelectedIds(new Set());
    fetchData(true);
  };

  // ── Export helpers ────────────────────────────────────────────────────────
  const buildExportRows = (data: Student[]) =>
    data.map(s => ({
      'Register Number': s.register_number || '',
      'Full Name':       s.full_name,
      'Date of Birth':   s.date_of_birth ? toDateInputValue(s.date_of_birth) : '',
      Gender:            s.gender || '',
      'Blood Group':     s.blood_group || '',
      Category:          getCategoryName(s.category_id),
      Subcategory:       getSubcategoryName(s.subcategory_id),
      Item:              getItemName(s.item_id),
      Address:           s.address || '',
      'Parent Name':     s.parent_name || '',
      'Parent Contact':  s.parent_contact || '',
      Email:             s.student_email || '',
      'Student Mobile':  s.student_mobile || '',
      'Residence Type':  s.residence_type?.replace('_', ' ') || '',
      'Shift Time':      s.shift_time?.replace('_', ' ') || '',
      'Attendance Type': s.attendance_type || '',
      'Student Status':  s.student_status || '',
    }));

  const exportToExcel = (data: Student[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(buildExportRows(data));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Downloaded successfully');
  };

  const handleExport = () => exportToExcel(filteredStudents, 'students');

  const handleCardDownload = (statusFilter: string, label: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    const data = students.filter(s => s.student_status === statusFilter);
    exportToExcel(data, `students_${label.toLowerCase()}`);
  };

  const handleHostelDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const data = students.filter(s => s.residence_type === 'hostel');
    exportToExcel(data, 'students_hostel');
  };

  const handleTotalDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    exportToExcel(students, 'students_all');
  };

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterCategory('all'); setFilterSubcategory('all'); setFilterItem('all');
    setFilterGender('all'); setFilterResidenceType('all'); setFilterShiftTime('all');
    setFilterAttendanceType('all'); setFilterStudentStatus('all');
    setFilterPanelOpen(false);
  };

  const hasActiveFilters =
    [filterCategory, filterSubcategory, filterItem, filterGender,
      filterResidenceType, filterShiftTime, filterAttendanceType, filterStudentStatus]
      .some(f => f !== 'all') || !!searchTerm;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please upload a valid image file'); return; }
    if (file.size > 3 * 1024 * 1024) { toast.error('File size must be less than 3MB'); return; }
    try {
      setUploading(true);
      const url = await uploadFile(file);
      form.setValue('photoUrl', url);
      toast.success('Photo uploaded');
    } catch { toast.error('Failed to upload photo'); }
    finally { setUploading(false); }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    form.reset({
      fullName:       student.full_name,
      dateOfBirth:    toDateInputValue(student.date_of_birth),
      gender:         student.gender || 'male',
      bloodGroup:     student.blood_group || 'A+',
      photoUrl:       student.photo_url || '',
      address:        student.address || '',
      parentName:     student.parent_name || '',
      parentContact:  student.parent_contact || '',
      studentEmail:   student.student_email || '',
      studentMobile:  student.student_mobile || '',
      registerNumber: student.register_number || '',
      categoryId:     student.category_id || '',
      subcategoryId:  student.subcategory_id || '',
      itemId:         student.item_id || '',
      residenceType:  student.residence_type || 'day_scholar',
      shiftTime:      student.shift_time || 'full_time',
      attendanceType: student.attendance_type || 'manual',
      studentStatus:  student.student_status || 'inactive',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (student: Student) => {
    try {
      await deleteStudent(student.id);
      toast.success('Student deleted');
      setDeleteTarget(null);
      fetchData(true);
    } catch (err: any) { toast.error(err.message || 'Failed to delete student'); }
  };

  const onSubmit = async (data: StudentFormData) => {
    if (!profile?.institution_id) return;
    try {
      const payload = {
        institution_id:   profile.institution_id,
        full_name:        data.fullName,
        date_of_birth:    data.dateOfBirth || undefined,
        gender:           data.gender,
        blood_group:      data.bloodGroup || undefined,
        photo_url:        data.photoUrl || undefined,
        address:          data.address || undefined,
        parent_name:      data.parentName || undefined,
        parent_contact:   data.parentContact || undefined,
        student_email:    data.studentEmail || undefined,
        student_mobile:   data.studentMobile || undefined,
        register_number:  data.registerNumber || undefined,
        category:         data.categoryId || undefined,
        subcategory:      data.subcategoryId || undefined,
        item:             data.itemId || undefined,
        category_id:      data.categoryId || undefined,
        subcategory_id:   data.subcategoryId || undefined,
        item_id:          data.itemId || undefined,
        residence_type:   data.residenceType,
        shift_time:       data.shiftTime,
        attendance_type:  data.attendanceType,
        student_status:   data.studentStatus,
      };

      if (editingStudent) {
        await updateStudent(editingStudent.id, payload);
        toast.success('Student updated successfully');
      } else {
        if (!data.studentEmail) {
          toast.error('Student email is required to send login credentials');
          return;
        }
        const tempPassword = generateTempPassword();
        await createStudent({
          ...payload,
          student_status:   'inactive',
          temp_password:    tempPassword,
          is_temp_password: true,
        });
        toast.success('Student created! Credentials emailed.', {
          description: `${data.studentEmail} will become Active after first password change.`,
          icon: <Mail className="h-4 w-4 text-indigo-500" />,
          duration: 5000,
        });
      }

      setDialogOpen(false);
      setEditingStudent(null);
      form.reset();
      fetchData(true);
    } catch {
      toast.error('Failed to save student');
    }
  };

  const handleBulkUpload = async (data: any[]) => {
    if (!profile?.institution_id) return;
    let successCount = 0;
    const errors: string[] = [];
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        const category = categories.find(c => c.name === row.Category);
        const tempPassword = generateTempPassword();
        await createStudent({
          institution_id:   profile.institution_id,
          full_name:        row['Full Name'],
          date_of_birth:    row['Date of Birth'] || undefined,
          gender:           row.Gender?.toLowerCase() || 'male',
          blood_group:      row['Blood Group'] || undefined,
          address:          row.Address || undefined,
          parent_name:      row['Parent Name'] || undefined,
          parent_contact:   row['Parent Contact'] || undefined,
          student_email:    row.Email || undefined,
          student_mobile:   row['Student Mobile'] || undefined,
          register_number:  row['Register Number'] || undefined,
          category:         category?.id || undefined,
          residence_type:   row['Residence Type']?.toLowerCase().replace(' ', '_') || 'day_scholar',
          shift_time:       row['Shift Time']?.toLowerCase().replace(' ', '_') || 'full_time',
          attendance_type:  row['Attendance Type']?.toLowerCase() || 'manual',
          student_status:   'inactive',
          temp_password:    tempPassword,
          is_temp_password: true,
        });
        successCount++;
      } catch (err: any) {
        errors.push(`Row ${i + 2}: ${err.message}`);
      }
    }
    if (errors.length > 0) {
      toast.error(`Uploaded ${successCount} with ${errors.length} errors`);
    } else {
      toast.success(`Successfully uploaded ${successCount} students`, {
        description: 'Students are Inactive until they log in and change their password.',
      });
    }
    fetchData(true);
  };

  const getCategoryName    = (id?: string) => id ? categories.find(c => c.id === id)?.name || '—' : '—';
  const getSubcategoryName = (id?: string) => id ? (subcategories as any[]).find(s => s.id === id)?.name || '—' : '—';
  const getItemName        = (id?: string) => id ? (items as any[]).find(i => i.id === id)?.name || '—' : '—';

  const totalStudents         = students.length;
  const activeStudents        = students.filter(s => s.student_status === 'active').length;
  const inactiveStudents      = students.filter(s => s.student_status === 'inactive').length;
  const relievedStudents      = students.filter(s => s.student_status === 'relieved').length;
  const hostelStudents        = students.filter(s => s.residence_type === 'hostel').length;
  const awaitingLoginStudents = students.filter(s => s.student_status === 'inactive' && s.is_temp_password === true).length;

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ChevronDown className="h-3 w-3 text-gray-300 inline ml-1" />;
    return sortDir === 'asc'
      ? <ChevronUp   className="h-3 w-3 text-indigo-500 inline ml-1" />
      : <ChevronDown className="h-3 w-3 text-indigo-500 inline ml-1" />;
  };

  // ── Pagination render function ────────────────────────────────────────────
  const renderPaginationBar = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }

    return (
      <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/40 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {filteredStudents.length === 0 ? '0' : `${pagedStart + 1}–${Math.min(pagedStart + pageSize, filteredStudents.length)}`} of{' '}
            <span className="font-semibold text-gray-700">{filteredStudents.length}</span>
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Rows:</span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:border-indigo-400"
            >
              {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          {pages.map((p, i) =>
            p === '...'
              ? <span key={`ellipsis-${i}`} className="px-2 text-xs text-gray-400">…</span>
              : (
                <button key={p} onClick={() => goToPage(p as number)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${
                    currentPage === p
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
                >
                  {p}
                </button>
              )
          )}

          <button
            onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {activeStudents}</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {inactiveStudents}</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> {relievedStudents}</span>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* ── PAGE HEADER ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Student Management</h1>
            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => fetchData(true)} disabled={refreshing}
              className="h-9 px-3 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => setBulkUploadOpen(true)}
              className="h-9 px-3 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-all"
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Bulk Upload</span>
            </button>
            <button
              onClick={handleExport}
              className="h-9 px-3 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <button
                  onClick={() => { setEditingStudent(null); form.reset(); }}
                  className="h-9 px-4 flex items-center gap-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Student
                </button>
              </DialogTrigger>

              {/* ── Student Form Dialog ── */}
              <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-0">
                <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl">
                  <DialogTitle className="text-base font-bold text-gray-900">
                    {editingStudent ? 'Edit Student' : 'Add New Student'}
                  </DialogTitle>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {editingStudent
                      ? `Editing record for ${editingStudent.full_name}`
                      : 'Fill in the details to enroll a new student. Student will be Inactive until they log in and change their password.'}
                  </p>
                  {!editingStudent && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100">
                        <Mail className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <p className="text-[11px] text-indigo-600 font-medium">
                          A temporary password will be auto-generated and emailed to the student upon creation.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 border border-orange-100">
                        <Clock className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                        <p className="text-[11px] text-orange-600 font-medium">
                          Student status will be set to <strong>Inactive</strong> until they log in and change their temporary password — then it auto-activates.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-6 py-5">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <Tabs defaultValue="personal" className="w-full">
                        <TabsList className="grid w-full grid-cols-4 bg-gray-100 rounded-xl p-1 h-auto gap-1">
                          {[
                            { value: 'personal', icon: User,          label: 'Personal'  },
                            { value: 'contact',  icon: Phone,         label: 'Contact'   },
                            { value: 'academic', icon: GraduationCap, label: 'Academic'  },
                            { value: 'other',    icon: Home,          label: 'Settings'  },
                          ].map(tab => (
                            <TabsTrigger key={tab.value} value={tab.value}
                              className="flex items-center gap-1.5 text-xs font-medium rounded-lg py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-700 text-gray-500"
                            >
                              <tab.icon className="h-3.5 w-3.5" />
                              {tab.label}
                            </TabsTrigger>
                          ))}
                        </TabsList>

                        {/* ── Personal ── */}
                        <TabsContent value="personal" className="space-y-4 mt-5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name="fullName" rules={{ required: 'Required' }}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-gray-500">Full Name <span className="text-red-500">*</span></FormLabel>
                                  <FormControl><Input {...field} placeholder="e.g. Arjun Sharma" className="h-9 text-sm border-gray-200" /></FormControl>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                            <FormField control={form.control} name="registerNumber"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-gray-500">Register Number</FormLabel>
                                  <FormControl><Input {...field} placeholder="e.g. REG2024001" className="h-9 text-sm border-gray-200 font-mono" /></FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField control={form.control} name="dateOfBirth"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-gray-500">Date of Birth</FormLabel>
                                  <FormControl>
                                    <Input {...field} type="date" className="h-9 text-sm border-gray-200" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField control={form.control} name="gender"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-gray-500">Gender</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-9 text-sm border-gray-200"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      <SelectItem value="male">Male</SelectItem>
                                      <SelectItem value="female">Female</SelectItem>
                                      <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <FormField control={form.control} name="bloodGroup"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-gray-500">Blood Group</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-9 text-sm border-gray-200"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      {BLOOD_GROUPS.map(bg => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField control={form.control} name="photoUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-gray-500">Profile Photo</FormLabel>
                                <FormControl>
                                  <div className="flex items-center gap-4 p-3 rounded-xl border border-gray-200 bg-gray-50">
                                    {field.value ? (
                                      <Avatar className="h-12 w-12 ring-2 ring-indigo-100">
                                        <AvatarImage src={field.value} />
                                        <AvatarFallback className="text-xs">Photo</AvatarFallback>
                                      </Avatar>
                                    ) : (
                                      <div className="h-12 w-12 rounded-full bg-white border-2 border-dashed border-gray-300 flex items-center justify-center">
                                        <User className="h-5 w-5 text-gray-300" />
                                      </div>
                                    )}
                                    <div className="flex-1">
                                      <Input type="file" accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/bmp,image/svg+xml,image/tiff,image/avif" onChange={handleFileUpload} disabled={uploading}
                                        className="h-9 text-sm border-gray-200 bg-white file:text-xs file:font-medium" />
                                      <p className="text-[11px] text-gray-400 mt-1">JPEG, PNG, WebP, GIF, BMP, SVG · Max 3 MB</p>
                                    </div>
                                  </div>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </TabsContent>

                        {/* ── Contact ── */}
                        <TabsContent value="contact" className="space-y-4 mt-5">
                          <FormField control={form.control} name="address"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-gray-500">Address</FormLabel>
                                <FormControl><Textarea {...field} placeholder="Enter full address" rows={3} className="text-sm border-gray-200 resize-none" /></FormControl>
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name="parentName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-gray-500">Parent Name</FormLabel>
                                  <FormControl><Input {...field} placeholder="e.g. Priya Sharma" className="h-9 text-sm border-gray-200" /></FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField control={form.control} name="parentContact"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-gray-500">Parent Contact</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                      <Input {...field} type="tel" placeholder="+91 98765 43210" className="h-9 text-sm border-gray-200 pl-9" />
                                    </div>
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField control={form.control} name="studentMobile"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-gray-500">Student Mobile Number</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                      <Input {...field} type="tel" placeholder="+91 98765 43210" className="h-9 text-sm border-gray-200 pl-9" />
                                    </div>
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField control={form.control} name="studentEmail"
                              rules={{ required: !editingStudent ? 'Email is required to send credentials' : false }}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-gray-500">
                                    Student Email{!editingStudent && <span className="text-red-500"> *</span>}
                                    {!editingStudent && (
                                      <span className="ml-1 text-[10px] font-normal text-indigo-500">(login username)</span>
                                    )}
                                  </FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                      <Input {...field} type="email" placeholder="student@example.com"
                                        className="h-9 text-sm border-gray-200 pl-9" />
                                    </div>
                                  </FormControl>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                          </div>
                        </TabsContent>

                        {/* ── Academic ── */}
                        <TabsContent value="academic" className="space-y-4 mt-5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name="categoryId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-gray-500">{labels?.category_label || 'Category'}</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-9 text-sm border-gray-200"><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <FormField control={form.control} name="subcategoryId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-gray-500">{labels?.subcategory_label || 'Department'}</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-9 text-sm border-gray-200"><SelectValue placeholder="Select department" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      {(subcategories as any[])
                                        .filter(sub => !form.watch('categoryId') || sub.category_id === form.watch('categoryId'))
                                        .map(sub => <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <FormField control={form.control} name="itemId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-gray-500">{labels?.item_label || 'Section'}</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-9 text-sm border-gray-200"><SelectValue placeholder="Select section" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      {(items as any[])
                                        .filter(item => !form.watch('subcategoryId') || item.subcategory_id === form.watch('subcategoryId'))
                                        .map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                          </div>
                        </TabsContent>

                        {/* ── Settings ── */}
                        <TabsContent value="other" className="space-y-4 mt-5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                              { name: 'residenceType'  as const, label: 'Residence Type',  options: [{ value: 'day_scholar', label: 'Day Scholar' }, { value: 'hostel', label: 'Hostel' }] },
                              { name: 'shiftTime'      as const, label: 'Shift Time',      options: [{ value: 'full_time', label: 'Full Time' }, { value: 'morning', label: 'Morning' }, { value: 'afternoon', label: 'Afternoon' }] },
                              { name: 'attendanceType' as const, label: 'Attendance Type', options: [{ value: 'face', label: 'Face Recognition' }, { value: 'groupi', label: 'Groupi' }, { value: 'manual', label: 'Manual' }] },
                              { name: 'studentStatus'  as const, label: 'Student Status',  options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'relieved', label: 'Relieved' }] },
                            ].map(f => (
                              <FormField key={f.name} control={form.control} name={f.name}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs font-medium text-gray-500">{f.label}</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl><SelectTrigger className="h-9 text-sm border-gray-200"><SelectValue /></SelectTrigger></FormControl>
                                      <SelectContent>
                                        {f.options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                    {f.name === 'studentStatus' && !editingStudent && (
                                      <p className="text-[11px] text-orange-500 mt-1">
                                        ⚠ Defaults to Inactive. Auto-activates after student changes temp password.
                                      </p>
                                    )}
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                        </TabsContent>
                      </Tabs>

                      <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                        <button type="button" onClick={() => setDialogOpen(false)}
                          className="h-9 px-4 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors">
                          Cancel
                        </button>
                        <button type="submit"
                          className="h-9 px-5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-1.5">
                          {editingStudent
                            ? 'Update Student'
                            : <><Mail className="h-3.5 w-3.5" /> Create & Send Credentials</>
                          }
                        </button>
                      </div>
                    </form>
                  </Form>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* ── METRIC CARDS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard
            label="Total Students" value={totalStudents} icon={Users}
            iconBg="bg-indigo-50" iconColor="text-indigo-600" subtitle="enrolled"
            downloadable onDownload={handleTotalDownload}
          />
          <MetricCard
            label="Active" value={activeStudents} icon={UserCheck}
            iconBg="bg-green-50" iconColor="text-green-600" subtitle="studying"
            active={filterStudentStatus === 'active'}
            onClick={() => { setFilterStudentStatus(filterStudentStatus === 'active' ? 'all' : 'active'); setFilterPanelOpen(true); }}
            downloadable onDownload={handleCardDownload('active', 'Active')}
          />
          <MetricCard
            label="Inactive" value={inactiveStudents} icon={Clock}
            iconBg="bg-amber-50" iconColor="text-amber-500" subtitle="on hold"
            active={filterStudentStatus === 'inactive'}
            onClick={() => { setFilterStudentStatus(filterStudentStatus === 'inactive' ? 'all' : 'inactive'); setFilterPanelOpen(true); }}
            downloadable onDownload={handleCardDownload('inactive', 'Inactive')}
          />
          <MetricCard
            label="Relieved" value={relievedStudents} icon={UserMinus}
            iconBg="bg-red-50" iconColor="text-red-500" subtitle="departed"
            active={filterStudentStatus === 'relieved'}
            onClick={() => { setFilterStudentStatus(filterStudentStatus === 'relieved' ? 'all' : 'relieved'); setFilterPanelOpen(true); }}
            downloadable onDownload={handleCardDownload('relieved', 'Relieved')}
          />
          <MetricCard
            label="Awaiting Login" value={awaitingLoginStudents} icon={Smartphone}
            iconBg="bg-orange-50" iconColor="text-orange-500" subtitle="temp password"
          />
          <MetricCard
            label="Hostel" value={hostelStudents} icon={Home}
            iconBg="bg-sky-50" iconColor="text-sky-600" subtitle="residential"
            active={filterResidenceType === 'hostel'}
            onClick={() => { setFilterResidenceType(filterResidenceType === 'hostel' ? 'all' : 'hostel'); setFilterPanelOpen(true); }}
            downloadable onDownload={handleHostelDownload}
          />
        </div>

        {/* ── FILTER BAR ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

          {/* ── Top row: search + filter toggle ── */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text" placeholder="Search by name, register number, email or mobile…"
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors placeholder:text-gray-400"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter toggle button */}
            <button
              onClick={() => setFilterPanelOpen(v => !v)}
              className={`relative h-9 px-3.5 flex items-center gap-2 rounded-lg border text-xs font-medium transition-all ${
                filterPanelOpen
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : hasActiveFilters
                    ? 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" d="M2 4h12M4 8h8M6 12h4" />
              </svg>
              Filters
              {hasActiveFilters && (
                <span className={`ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                  filterPanelOpen ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white'
                }`}>
                  {[filterStudentStatus, filterGender, filterResidenceType, filterCategory,
                    filterSubcategory, filterItem, filterShiftTime, filterAttendanceType]
                    .filter(f => f !== 'all').length}
                </span>
              )}
              <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${filterPanelOpen ? 'rotate-180' : ''}`} />
            </button>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="h-9 px-3 flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 bg-red-50 hover:bg-red-100 rounded-lg transition-all"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>

          {/* ── Collapsible filter panel ── */}
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              filterPanelOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50/40">

                {/* Row 1: Status + Gender + Residence chips */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">

                  {/* Status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 shrink-0">Status</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {[
                        { val: 'all',      label: 'All' },
                        { val: 'active',   label: 'Active',   dot: 'bg-emerald-500' },
                        { val: 'inactive', label: 'Inactive', dot: 'bg-amber-500'   },
                        { val: 'relieved', label: 'Relieved', dot: 'bg-red-500'     },
                      ].map(c => (
                        <FilterChip key={c.val} label={c.label} dot={c.dot}
                          active={filterStudentStatus === c.val}
                          onClick={() => setFilterStudentStatus(c.val)} />
                      ))}
                    </div>
                  </div>

                  <div className="w-px h-4 bg-gray-200 shrink-0" />

                  {/* Gender */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 shrink-0">Gender</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {['all', 'male', 'female', 'other'].map(v => (
                        <FilterChip key={v}
                          label={v === 'all' ? 'All' : v.charAt(0).toUpperCase() + v.slice(1)}
                          active={filterGender === v}
                          onClick={() => setFilterGender(v)} />
                      ))}
                    </div>
                  </div>

                  <div className="w-px h-4 bg-gray-200 shrink-0" />

                  {/* Residence */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 shrink-0">Residence</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {[
                        { val: 'all',        label: 'All'        },
                        { val: 'day_scholar', label: 'Day Scholar' },
                        { val: 'hostel',      label: 'Hostel'     },
                      ].map(c => (
                        <FilterChip key={c.val} label={c.label}
                          active={filterResidenceType === c.val}
                          onClick={() => setFilterResidenceType(c.val)} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Row 2: Dropdown selects */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {[
                    {
                      label: labels?.category_label || 'Category',
                      value: filterCategory,
                      onChange: setFilterCategory,
                      allLabel: 'All Categories',
                      options: categories.map(c => ({ value: c.id, label: c.name })),
                    },
                    {
                      label: labels?.subcategory_label || 'Department',
                      value: filterSubcategory,
                      onChange: setFilterSubcategory,
                      allLabel: 'All Departments',
                      options: (subcategories as any[])
                        .filter(s => filterCategory === 'all' || s.category_id === filterCategory)
                        .map(s => ({ value: s.id, label: s.name })),
                    },
                    {
                      label: labels?.item_label || 'Section',
                      value: filterItem,
                      onChange: setFilterItem,
                      allLabel: 'All Sections',
                      options: (items as any[])
                        .filter(i => filterSubcategory === 'all' || i.subcategory_id === filterSubcategory)
                        .map(i => ({ value: i.id, label: i.name })),
                    },
                    {
                      label: 'Shift',
                      value: filterShiftTime,
                      onChange: setFilterShiftTime,
                      allLabel: 'All Shifts',
                      options: [
                        { value: 'full_time',  label: 'Full Time'  },
                        { value: 'morning',    label: 'Morning'    },
                        { value: 'afternoon',  label: 'Afternoon'  },
                      ],
                    },
                    {
                      label: 'Attendance',
                      value: filterAttendanceType,
                      onChange: setFilterAttendanceType,
                      allLabel: 'All Types',
                      options: [
                        { value: 'face',   label: 'Face Recognition' },
                        { value: 'groupi', label: 'Groupi'           },
                        { value: 'manual', label: 'Manual'           },
                      ],
                    },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">
                        {f.label}
                        {f.value !== 'all' && (
                          <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 align-middle" />
                        )}
                      </label>
                      <select
                        value={f.value}
                        onChange={e => f.onChange(e.target.value)}
                        className={`w-full px-3 py-2 text-xs border rounded-lg bg-white text-gray-700 focus:outline-none focus:border-indigo-400 transition-colors ${
                          f.value !== 'all' ? 'border-indigo-300 ring-1 ring-indigo-100' : 'border-gray-200'
                        }`}
                      >
                        <option value="all">{f.allLabel}</option>
                        {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Footer: result count ── */}
          <div className={`flex items-center justify-between px-4 py-2.5 ${filterPanelOpen ? 'border-t border-gray-100' : ''}`}>
            <span className="text-xs text-gray-400 tabular-nums">
              Showing <span className="font-semibold text-gray-700">{filteredStudents.length}</span> of{' '}
              <span className="font-semibold text-gray-700">{students.length}</span> students
            </span>
            {hasActiveFilters && (
              <span className="text-xs text-indigo-600 font-medium">
                {students.length - filteredStudents.length} filtered out
              </span>
            )}
          </div>
        </div>

        {/* ── BULK ACTIONS BAR ── */}
        {someSelected && (
          <div className="flex items-center justify-between bg-indigo-600 text-white rounded-xl px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" />
              <span>{selectedIds.size} student{selectedIds.size !== 1 ? 's' : ''} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBulkEditOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-indigo-600 rounded-lg text-xs font-semibold hover:bg-indigo-50 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" /> Bulk Update
              </button>
              <button
                onClick={() => exportToExcel(students.filter(s => selectedIds.has(s.id)), 'students_selected')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-xs font-semibold hover:bg-indigo-400 transition-colors"
              >
                <FileDown className="h-3.5 w-3.5" /> Export Selected
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-1.5 rounded-lg hover:bg-indigo-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── STUDENT TABLE ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">No students found</p>
              <p className="text-xs text-gray-400">
                {hasActiveFilters ? 'Try adjusting or clearing your filters' : 'Add your first student to get started'}
              </p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-1 text-xs font-medium text-indigo-500 hover:text-indigo-700 underline underline-offset-2">
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-100 hover:bg-transparent bg-gray-50/60">
                    <TableHead className="pl-4 py-3 w-10">
                      <Checkbox
                        checked={allPageSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all on page"
                        className="border-gray-300"
                      />
                    </TableHead>
                    <TableHead className="pl-2 py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 cursor-pointer w-[230px]" onClick={() => toggleSort('full_name')}>
                      Student <SortIcon field="full_name" />
                    </TableHead>
                    <TableHead className="py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 cursor-pointer" onClick={() => toggleSort('category_id')}>
                      {labels?.category_label || 'Category'} <SortIcon field="category_id" />
                    </TableHead>
                    <TableHead className="py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">{labels?.subcategory_label || 'Dept'}</TableHead>
                    <TableHead className="py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">{labels?.item_label || 'Section'}</TableHead>
                    <TableHead className="py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Residence</TableHead>
                    <TableHead className="py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Attendance</TableHead>
                    <TableHead className="py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 cursor-pointer" onClick={() => toggleSort('student_status')}>
                      Status <SortIcon field="student_status" />
                    </TableHead>
                    <TableHead className="py-3 pr-5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedStudents.map(student => {
                    const avatarStyle    = getAvatarStyle(student.full_name);
                    const isDeleteTarget = deleteTarget?.id === student.id;
                    const awaitingLogin  = student.student_status === 'inactive' && student.is_temp_password === true;
                    const isSelected     = selectedIds.has(student.id);
                    return (
                      <>
                        <TableRow key={student.id}
                          className={`border-gray-100 transition-colors ${
                            isDeleteTarget ? 'bg-red-50/30' :
                            isSelected     ? 'bg-indigo-50/40' :
                            'hover:bg-indigo-50/20'
                          }`}>
                          <TableCell className="pl-4 py-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(student.id)}
                              aria-label={`Select ${student.full_name}`}
                              className="border-gray-300"
                            />
                          </TableCell>
                          <TableCell className="pl-2 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 ring-2 ring-gray-100 shrink-0">
                                <AvatarImage src={student.photo_url || undefined} />
                                <AvatarFallback className={`text-xs font-semibold ${avatarStyle.bg} ${avatarStyle.text}`}>
                                  {getInitials(student.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate max-w-[150px]">{student.full_name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  {student.register_number && (
                                    <p className="text-[11px] text-gray-400 font-mono">{student.register_number}</p>
                                  )}
                                  {student.student_mobile ? (
                                    <p className="text-[11px] text-gray-400 flex items-center gap-0.5">
                                      <Smartphone className="h-2.5 w-2.5" />
                                      {student.student_mobile}
                                    </p>
                                  ) : student.student_email ? (
                                    <p className="text-[11px] text-gray-400 truncate max-w-[110px]">{student.student_email}</p>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-xs font-medium text-gray-700">{getCategoryName(student.category_id || student.category)}</span>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-xs text-gray-500">{getSubcategoryName(student.subcategory_id || student.subcategory)}</span>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-xs text-gray-500">{getItemName(student.item_id || student.item)}</span>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-100">
                              {student.residence_type === 'hostel'
                                ? <><Home className="w-3 h-3" /> Hostel</>
                                : <><User className="w-3 h-3" /> Day Scholar</>}
                            </span>
                          </TableCell>
                          <TableCell className="py-3"><AttendanceBadge type={student.attendance_type} /></TableCell>
                          <TableCell className="py-3">
                            <div className="flex flex-col gap-1">
                              <StatusBadge status={student.student_status} />
                              {awaitingLogin && <TempPasswordBadge />}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 pr-5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handleEdit(student)}
                                className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => setDeleteTarget(isDeleteTarget ? null : student)}
                                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isDeleteTarget && (
                          <DeleteConfirmRow
                            student={student}
                            onConfirm={() => handleDelete(student)}
                            onCancel={() => setDeleteTarget(null)}
                          />
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* ── PAGINATION BAR — outside the ternary, inside the card div ── */}
          {!loading && filteredStudents.length > 0 && renderPaginationBar()}
        </div>

      </div>

      {/* ── Bulk Upload Dialog ── */}
      <BulkUploadDialog
        open={bulkUploadOpen} onOpenChange={setBulkUploadOpen}
        title="Bulk Upload Students"
        description="Upload multiple students at once using an Excel file"
        templateColumns={['Full Name', 'Date of Birth', 'Gender', 'Blood Group', 'Register Number', 'Category', 'Address', 'Parent Name', 'Parent Contact', 'Email', 'Student Mobile', 'Residence Type', 'Shift Time', 'Attendance Type', 'Student Status']}
        sampleData={[['Arjun Sharma', '2005-01-15', 'Male', 'A+', 'REG2024001', categories[0]?.name || 'Class 10', '123 Main St', 'Priya Sharma', '9876543210', 'arjun@example.com', '9876543212', 'Day Scholar', 'Full Time', 'Manual', 'Active']]}
        onUpload={handleBulkUpload}
      />

      {/* ── Bulk Edit Dialog ── */}
      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        selectedCount={selectedIds.size}
        categories={categories}
        subcategories={subcategories as any[]}
        items={items as any[]}
        labels={labels}
        onApply={handleBulkEdit}
      />
    </AdminLayout>
  );
}