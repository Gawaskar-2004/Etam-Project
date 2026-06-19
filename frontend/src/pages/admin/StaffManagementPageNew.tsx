import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { staffApi, uploadFile } from '@/lib/api';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus, Edit, Trash2, Download, User, Phone,
  Briefcase, Search, Clock, X, SlidersHorizontal,
  Users, Award, CalendarDays, RefreshCw,
  CheckCircle, Mail, FileDown, Pencil, AlertCircle,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  CheckCircle2, UserCheck,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface StaffFormData {
  full_name: string; gender: string; date_of_birth: string;
  mobile_number: string; email: string; address: string;
  qualification: string; experience_years: number; photo_url: string;
  designation: string; employment_type: string; date_of_joining: string; status: string;
}

interface BulkEditFormData {
  status?: string;
  employment_type?: string;
  designation?: string;
}

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
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric Card (with download button like StudentManagement)
// ─────────────────────────────────────────────────────────────────────────────
function MetricCard({ label, value, icon: Icon, iconBg, iconColor, subtitle, loading, active, onClick, downloadable, onDownload }: {
  label: string; value: number; icon: any;
  iconBg: string; iconColor: string; subtitle?: string; loading?: boolean;
  active?: boolean; onClick?: () => void;
  downloadable?: boolean; onDownload?: (e: React.MouseEvent) => void;
}) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (loading) { setDisplay(0); return; }
    let start = 0;
    const step = Math.max(1, Math.ceil(value / 40));
    const id = setInterval(() => {
      start = Math.min(start + step, value);
      setDisplay(start);
      if (start >= value) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [value, loading]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <Skeleton className="h-3 w-20 mb-3 bg-gray-100" />
        <Skeleton className="h-7 w-14 mb-2 bg-gray-100" />
        <Skeleton className="h-3 w-16 bg-gray-100" />
      </div>
    );
  }

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
// Badges
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status?: string }) {
  const isActive = status === 'active';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
      isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

function EmploymentBadge({ type }: { type?: string }) {
  const map: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    full_time: { label: 'Full Time', icon: <Briefcase className="w-3 h-3" />, cls: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    part_time: { label: 'Part Time', icon: <Clock className="w-3 h-3" />,     cls: 'bg-violet-50 text-violet-600 border-violet-100' },
    contract:  { label: 'Contract',  icon: <Award className="w-3 h-3" />,     cls: 'bg-sky-50 text-sky-600 border-sky-100' },
  };
  const cfg = map[type ?? 'full_time'] ?? map['full_time'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
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

// ─────────────────────────────────────────────────────────────────────────────
// Delete Confirm Row
// ─────────────────────────────────────────────────────────────────────────────
function DeleteConfirmRow({ staff, onConfirm, onCancel }: {
  staff: any; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <tr className="bg-red-50/50">
      <td colSpan={9} className="py-3 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Delete <span className="font-semibold">{staff.full_name}</span>? This cannot be undone.</span>
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
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Edit Dialog
// ─────────────────────────────────────────────────────────────────────────────
function BulkEditDialog({
  open, onOpenChange, selectedCount, uniqueDesignations, onApply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedCount: number;
  uniqueDesignations: string[];
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
            Bulk Update — {selectedCount} Staff Member{selectedCount !== 1 ? 's' : ''}
          </DialogTitle>
          <p className="text-xs text-gray-400 mt-0.5">Only fields you change will be updated. Leave "No change" to keep existing values.</p>
        </div>
        <div className="px-6 py-5 grid grid-cols-2 gap-4">
          {field('Status', 'status', [
            { value: 'active',   label: 'Active'   },
            { value: 'inactive', label: 'Inactive' },
          ])}
          {field('Employment Type', 'employment_type', [
            { value: 'full_time', label: 'Full Time' },
            { value: 'part_time', label: 'Part Time' },
            { value: 'contract',  label: 'Contract'  },
          ])}
          {uniqueDesignations.length > 0 && field('Designation', 'designation',
            uniqueDesignations.map(d => ({ value: d, label: d }))
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleApply}
            className="px-5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Apply to {selectedCount} Staff
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function StaffManagementPage() {
  const { user, profile } = useAuth();

  const [staff, setStaff]           = useState<any[]>([]);
  const [filtered, setFiltered]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [uploading, setUploading]   = useState(false);

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Pagination ────────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize]       = useState(10);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm]               = useState('');
  const [filterStatus, setFilterStatus]           = useState('all');
  const [filterEmploymentType, setFilterEmploymentType] = useState('all');
  const [filterDesignation, setFilterDesignation] = useState('all');
  const [filterGender, setFilterGender]           = useState('all');
  const [filterPanelOpen, setFilterPanelOpen]     = useState(false);

  const [sortField, setSortField] = useState<string>('full_name');
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('asc');

  const form = useForm<StaffFormData>({
    defaultValues: {
      full_name: '', gender: 'male', date_of_birth: '',
      mobile_number: '', email: '', address: '',
      qualification: '', experience_years: 0, photo_url: '',
      designation: '', employment_type: 'full_time',
      date_of_joining: new Date().toISOString().split('T')[0], status: 'active',
    },
  });

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    applyFiltersAndSort();
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [staff, searchTerm, filterStatus, filterEmploymentType, filterDesignation, filterGender, sortField, sortDir]);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true); else setRefreshing(true);
      const staffData = await staffApi.list();
      setStaff(staffData || []);
    } catch { toast.error('Failed to load staff data'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const applyFiltersAndSort = () => {
    let list = [...staff];
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      list = list.filter(s =>
        s.full_name?.toLowerCase().includes(t) || s.staff_code?.toLowerCase().includes(t) ||
        s.email?.toLowerCase().includes(t) || s.mobile_number?.toLowerCase().includes(t)
      );
    }
    if (filterStatus !== 'all')          list = list.filter(s => s.status === filterStatus);
    if (filterEmploymentType !== 'all')  list = list.filter(s => s.employment_type === filterEmploymentType);
    if (filterDesignation !== 'all')     list = list.filter(s => s.designation === filterDesignation);
    if (filterGender !== 'all')          list = list.filter(s => s.gender === filterGender);
    list.sort((a, b) => {
      const av = a[sortField] ?? '';
      const bv = b[sortField] ?? '';
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    setFiltered(list);
  };

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages    = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedStart    = (currentPage - 1) * pageSize;
  const pagedStaff    = filtered.slice(pagedStart, pagedStart + pageSize);

  const goToPage = (p: number) => {
    setCurrentPage(Math.max(1, Math.min(p, totalPages)));
    setSelectedIds(new Set());
  };

  // ── Selection helpers ─────────────────────────────────────────────────────
  const allPageSelected = pagedStaff.length > 0 && pagedStaff.every(s => selectedIds.has(s.id));
  const someSelected    = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pagedStaff.forEach(s => next.delete(s.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        pagedStaff.forEach(s => next.add(s.id));
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
    if (data.status)          payload['status']          = data.status;
    if (data.employment_type) payload['employment_type'] = data.employment_type;
    if (data.designation)     payload['designation']     = data.designation;

    if (!Object.keys(payload).length) { toast.info('No changes selected'); return; }

    let successCount = 0;
    const errors: string[] = [];
    for (const id of Array.from(selectedIds)) {
      try {
        await staffApi.update(id, payload);
        successCount++;
      } catch (err: any) { errors.push(err.message); }
    }
    if (errors.length) toast.error(`Updated ${successCount}, ${errors.length} failed`);
    else toast.success(`${successCount} staff member${successCount !== 1 ? 's' : ''} updated`);
    setSelectedIds(new Set());
    fetchData(true);
  };

  // ── Export helpers ────────────────────────────────────────────────────────
  const buildExportRows = (data: any[]) =>
    data.map(s => ({
      'Staff Code':        s.staff_code || '',
      'Full Name':         s.full_name,
      'Gender':            s.gender || '',
      'Date of Birth':     s.date_of_birth || '',
      'Designation':       s.designation || '',
      'Employment Type':   s.employment_type?.replace('_', ' ') || '',
      'Date of Joining':   s.date_of_joining || '',
      'Mobile':            s.mobile_number || '',
      'Email':             s.email || '',
      'Qualification':     s.qualification || '',
      'Experience (Years)': s.experience_years || '',
      'Address':           s.address || '',
      'Status':            s.status || 'active',
    }));

  const exportToExcel = (data: any[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(buildExportRows(data));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Staff');
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Downloaded successfully');
  };

  const handleExport = () => exportToExcel(filtered, 'staff');

  const handleCardDownload = (statusFilter: string, label: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    exportToExcel(staff.filter(s => s.status === statusFilter), `staff_${label.toLowerCase()}`);
  };

  const handleFullTimeDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    exportToExcel(staff.filter(s => s.employment_type === 'full_time'), 'staff_full_time');
  };

  const handleTotalDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    exportToExcel(staff, 'staff_all');
  };

  // ── Sort ──────────────────────────────────────────────────────────────────
  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ChevronDown className="h-3 w-3 text-gray-300 inline ml-1" />;
    return sortDir === 'asc'
      ? <ChevronUp   className="h-3 w-3 text-indigo-500 inline ml-1" />
      : <ChevronDown className="h-3 w-3 text-indigo-500 inline ml-1" />;
  };

  // ── Filters ───────────────────────────────────────────────────────────────
  const clearFilters = () => {
    setSearchTerm(''); setFilterStatus('all');
    setFilterEmploymentType('all'); setFilterDesignation('all'); setFilterGender('all');
    setFilterPanelOpen(false);
  };

  const hasActiveFilters = filterStatus !== 'all' || filterEmploymentType !== 'all' ||
    filterDesignation !== 'all' || filterGender !== 'all' || !!searchTerm;

  const uniqueDesignations = Array.from(new Set(staff.map(s => s.designation).filter(Boolean)));

  // ── Metrics ───────────────────────────────────────────────────────────────
  const totalStaff      = staff.length;
  const activeStaff     = staff.filter(s => s.status === 'active').length;
  const inactiveStaff   = staff.filter(s => s.status === 'inactive').length;
  const fullTimeStaff   = staff.filter(s => s.employment_type === 'full_time').length;
  const partTimeStaff   = staff.filter(s => s.employment_type === 'part_time').length;
  const contractStaff   = staff.filter(s => s.employment_type === 'contract').length;

  // ── Form handlers ─────────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return; }
    if (file.size > 1024 * 1024) { toast.error('File size must be less than 1MB'); return; }
    try {
      setUploading(true);
      const url = await uploadFile(file);
      form.setValue('photo_url', url);
      toast.success('Photo uploaded!');
    } catch { toast.error('Failed to upload photo'); }
    finally { setUploading(false); }
  };

  const handleEdit = (s: any) => {
    setEditingStaff(s);
    form.reset({
      full_name: s.full_name || '', gender: s.gender || 'male',
      date_of_birth: s.date_of_birth || '', mobile_number: s.mobile_number || '',
      email: s.email || '', address: s.address || '',
      qualification: s.qualification || '', experience_years: s.experience_years || 0,
      photo_url: s.photo_url || '', designation: s.designation || '',
      employment_type: s.employment_type || 'full_time',
      date_of_joining: s.date_of_joining || '', status: s.status || 'active',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (s: any) => {
    try {
      await staffApi.delete(s.id);
      toast.success('Staff deleted');
      setDeleteTarget(null);
      fetchData(true);
    } catch (err: any) { toast.error(err.message || 'Failed to delete'); }
  };

  const onSubmit = async (data: StaffFormData) => {
    if (!data.email) { toast.error('Email is required'); return; }
    try {
      const payload = {
        full_name: data.full_name, email: data.email,
        mobile_number: data.mobile_number || undefined, phone: data.mobile_number || undefined,
        date_of_birth: data.date_of_birth || undefined, gender: data.gender,
        qualification: data.qualification || undefined, experience_years: data.experience_years || undefined,
        photo_url: data.photo_url || undefined, address: data.address || undefined,
        designation: data.designation || undefined, employment_type: data.employment_type,
        date_of_joining: data.date_of_joining || undefined, status: data.status, user_role: 'staff',
      };
      if (editingStaff) {
        await staffApi.update(editingStaff.id, payload);
        toast.success('Staff updated successfully!');
      } else {
        await staffApi.create(payload);
        toast.success(`Staff created! A welcome email with a temporary password has been sent to ${data.email}`);
      }
      setDialogOpen(false); setEditingStaff(null); form.reset(); fetchData(true);
    } catch (err: any) { toast.error(err.message || 'Failed to save staff'); }
  };

  // ── Pagination render ─────────────────────────────────────────────────────
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
            {filtered.length === 0 ? '0' : `${pagedStart + 1}–${Math.min(pagedStart + pageSize, filtered.length)}`} of{' '}
            <span className="font-semibold text-gray-700">{filtered.length}</span>
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
              ? <span key={`e-${i}`} className="px-2 text-xs text-gray-400">…</span>
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
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {activeStaff}</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {inactiveStaff}</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> {fullTimeStaff}</span>
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
            <h1 className="text-xl font-bold text-gray-900">Staff Management</h1>
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
              onClick={handleExport}
              className="h-9 px-3 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <button
                  onClick={() => { setEditingStaff(null); form.reset(); }}
                  className="h-9 px-4 flex items-center gap-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Staff
                </button>
              </DialogTrigger>

              {/* ── Staff Form Dialog ── */}
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-0">
                <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl">
                  <DialogTitle className="text-base font-bold text-gray-900">
                    {editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
                  </DialogTitle>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {editingStaff ? `Editing record for ${editingStaff.full_name}` : 'Fill in the details to add a new staff member'}
                  </p>
                  {!editingStaff && (
                    <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100">
                      <Mail className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      <p className="text-[11px] text-indigo-600 font-medium">
                        A temporary password will be auto‑generated and emailed to the staff member upon creation.
                      </p>
                    </div>
                  )}
                </div>

                <div className="px-6 py-5">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <Tabs defaultValue="personal" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 bg-gray-100 rounded-xl p-1 h-auto gap-1">
                          {[
                            { value: 'personal',     icon: User,      label: 'Personal'     },
                            { value: 'contact',      icon: Phone,     label: 'Contact'      },
                            { value: 'professional', icon: Briefcase, label: 'Professional' },
                          ].map(tab => (
                            <TabsTrigger key={tab.value} value={tab.value}
                              className="flex items-center gap-1.5 text-xs font-medium rounded-lg py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-700 text-gray-500"
                            >
                              <tab.icon className="h-3.5 w-3.5" />
                              {tab.label}
                            </TabsTrigger>
                          ))}
                        </TabsList>

                        {/* Personal */}
                        <TabsContent value="personal" className="space-y-4 mt-5">
                          <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="full_name" rules={{ required: 'Full name is required' }}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-gray-500">Full Name <span className="text-red-500">*</span></FormLabel>
                                  <FormControl><Input {...field} placeholder="Enter full name" className="h-9 text-sm border-gray-200" /></FormControl>
                                  <FormMessage className="text-xs" />
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
                            <FormField control={form.control} name="date_of_birth"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-gray-500">Date of Birth</FormLabel>
                                  <FormControl><Input {...field} type="date" className="h-9 text-sm border-gray-200" /></FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField control={form.control} name="qualification"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-gray-500">Qualification</FormLabel>
                                  <FormControl><Input {...field} placeholder="e.g., M.Sc, B.Ed" className="h-9 text-sm border-gray-200" /></FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField control={form.control} name="experience_years"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-gray-500">Experience (Years)</FormLabel>
                                  <FormControl>
                                    <Input {...field} type="number" onChange={e => field.onChange(parseInt(e.target.value) || 0)} className="h-9 text-sm border-gray-200" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField control={form.control} name="photo_url"
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
                                      <Input type="file" accept="image/*" onChange={handleFileUpload} disabled={uploading}
                                        className="h-9 text-sm border-gray-200 bg-white file:text-xs file:font-medium" />
                                      <p className="text-[11px] text-gray-400 mt-1">JPEG or PNG · Max 1 MB</p>
                                    </div>
                                  </div>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </TabsContent>

                        {/* Contact */}
                        <TabsContent value="contact" className="space-y-4 mt-5">
                          <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="mobile_number"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-gray-500">Mobile Number</FormLabel>
                                  <FormControl><Input {...field} placeholder="Enter mobile number" className="h-9 text-sm border-gray-200" /></FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField control={form.control} name="email" rules={{ required: 'Email is required' }}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-gray-500">Email <span className="text-red-500">*</span></FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                      <Input {...field} type="email" placeholder="staff@example.com"
                                        disabled={!!editingStaff}
                                        className="h-9 text-sm border-gray-200 pl-9" />
                                    </div>
                                  </FormControl>
                                  <FormDescription className="text-xs text-gray-400">
                                    A welcome email with a temporary password will be sent to this address.
                                  </FormDescription>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField control={form.control} name="address"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs font-medium text-gray-500">Address</FormLabel>
                                <FormControl><Textarea {...field} placeholder="Enter address" rows={3} className="text-sm border-gray-200 resize-none" /></FormControl>
                              </FormItem>
                            )}
                          />
                        </TabsContent>

                        {/* Professional */}
                        <TabsContent value="professional" className="space-y-4 mt-5">
                          <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="designation"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-gray-500">Designation</FormLabel>
                                  <FormControl><Input {...field} placeholder="e.g., Professor, Lecturer" className="h-9 text-sm border-gray-200" /></FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField control={form.control} name="employment_type"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-gray-500">Employment Type</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-9 text-sm border-gray-200"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      <SelectItem value="full_time">Full Time</SelectItem>
                                      <SelectItem value="part_time">Part Time</SelectItem>
                                      <SelectItem value="contract">Contract</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <FormField control={form.control} name="date_of_joining"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-gray-500">Date of Joining</FormLabel>
                                  <FormControl><Input {...field} type="date" className="h-9 text-sm border-gray-200" /></FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField control={form.control} name="status"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-medium text-gray-500">Status</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-9 text-sm border-gray-200"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      <SelectItem value="active">Active</SelectItem>
                                      <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                          </div>
                          {!editingStaff && (
                            <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-4">
                              <Mail className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-semibold text-emerald-700 mb-1">What happens next?</p>
                                <p className="text-xs text-emerald-600">
                                  The staff member will receive an email with a temporary password.
                                  They can log into the mobile app using their email and that password,
                                  then change it after first login.
                                </p>
                              </div>
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>

                      <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                        <button type="button" onClick={() => setDialogOpen(false)}
                          className="h-9 px-4 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors">
                          Cancel
                        </button>
                        <button type="submit"
                          className="h-9 px-5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-1.5">
                          {editingStaff ? 'Update Staff' : <><Mail className="h-3.5 w-3.5" /> Create & Send Credentials</>}
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
            label="Total Staff" value={totalStaff} icon={Users}
            iconBg="bg-indigo-50" iconColor="text-indigo-600" subtitle="registered"
            loading={loading}
            downloadable onDownload={handleTotalDownload}
          />
          <MetricCard
            label="Active" value={activeStaff} icon={CheckCircle}
            iconBg="bg-green-50" iconColor="text-green-600" subtitle="on duty"
            loading={loading}
            active={filterStatus === 'active'}
            onClick={() => { setFilterStatus(filterStatus === 'active' ? 'all' : 'active'); setFilterPanelOpen(true); }}
            downloadable onDownload={handleCardDownload('active', 'Active')}
          />
          <MetricCard
            label="Inactive" value={inactiveStaff} icon={Clock}
            iconBg="bg-amber-50" iconColor="text-amber-500" subtitle="off duty"
            loading={loading}
            active={filterStatus === 'inactive'}
            onClick={() => { setFilterStatus(filterStatus === 'inactive' ? 'all' : 'inactive'); setFilterPanelOpen(true); }}
            downloadable onDownload={handleCardDownload('inactive', 'Inactive')}
          />
          <MetricCard
            label="Full Time" value={fullTimeStaff} icon={Briefcase}
            iconBg="bg-violet-50" iconColor="text-violet-600" subtitle="permanent"
            loading={loading}
            active={filterEmploymentType === 'full_time'}
            onClick={() => { setFilterEmploymentType(filterEmploymentType === 'full_time' ? 'all' : 'full_time'); setFilterPanelOpen(true); }}
            downloadable onDownload={handleFullTimeDownload}
          />
          <MetricCard
            label="Part Time" value={partTimeStaff} icon={Clock}
            iconBg="bg-sky-50" iconColor="text-sky-500" subtitle="part-time"
            loading={loading}
            active={filterEmploymentType === 'part_time'}
            onClick={() => { setFilterEmploymentType(filterEmploymentType === 'part_time' ? 'all' : 'part_time'); setFilterPanelOpen(true); }}
          />
          <MetricCard
            label="Contract" value={contractStaff} icon={Award}
            iconBg="bg-rose-50" iconColor="text-rose-500" subtitle="contracted"
            loading={loading}
            active={filterEmploymentType === 'contract'}
            onClick={() => { setFilterEmploymentType(filterEmploymentType === 'contract' ? 'all' : 'contract'); setFilterPanelOpen(true); }}
          />
        </div>

        {/* ── FILTER BAR ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Top row: search + toggle */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text" placeholder="Search by name, staff code, email or mobile…"
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors placeholder:text-gray-400"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

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
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {hasActiveFilters && (
                <span className={`ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                  filterPanelOpen ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white'
                }`}>
                  {[filterStatus, filterGender, filterEmploymentType, filterDesignation]
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

          {/* Collapsible filter panel */}
          <div className={`grid transition-all duration-300 ease-in-out ${filterPanelOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden">
              <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50/40">

                {/* Row 1: Status + Gender chips */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 shrink-0">Status</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {[
                        { val: 'all',      label: 'All'      },
                        { val: 'active',   label: 'Active',   dot: 'bg-emerald-500' },
                        { val: 'inactive', label: 'Inactive', dot: 'bg-amber-500'   },
                      ].map(c => (
                        <FilterChip key={c.val} label={c.label} dot={c.dot}
                          active={filterStatus === c.val}
                          onClick={() => setFilterStatus(c.val)} />
                      ))}
                    </div>
                  </div>

                  <div className="w-px h-4 bg-gray-200 shrink-0" />

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
                </div>

                <div className="border-t border-gray-100" />

                {/* Row 2: Dropdown selects */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    {
                      label: 'Employment Type',
                      value: filterEmploymentType,
                      onChange: setFilterEmploymentType,
                      allLabel: 'All Types',
                      options: [
                        { value: 'full_time', label: 'Full Time' },
                        { value: 'part_time', label: 'Part Time' },
                        { value: 'contract',  label: 'Contract'  },
                      ],
                    },
                    {
                      label: 'Designation',
                      value: filterDesignation,
                      onChange: setFilterDesignation,
                      allLabel: 'All Designations',
                      options: uniqueDesignations.map(d => ({ value: d, label: d })),
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

          {/* Footer: result count */}
          <div className={`flex items-center justify-between px-4 py-2.5 ${filterPanelOpen ? 'border-t border-gray-100' : ''}`}>
            <span className="text-xs text-gray-400 tabular-nums">
              Showing <span className="font-semibold text-gray-700">{filtered.length}</span> of{' '}
              <span className="font-semibold text-gray-700">{staff.length}</span> staff members
            </span>
            {hasActiveFilters && (
              <span className="text-xs text-indigo-600 font-medium">
                {staff.length - filtered.length} filtered out
              </span>
            )}
          </div>
        </div>

        {/* ── BULK ACTIONS BAR ── */}
        {someSelected && (
          <div className="flex items-center justify-between bg-indigo-600 text-white rounded-xl px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" />
              <span>{selectedIds.size} staff member{selectedIds.size !== 1 ? 's' : ''} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBulkEditOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-indigo-600 rounded-lg text-xs font-semibold hover:bg-indigo-50 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" /> Bulk Update
              </button>
              <button
                onClick={() => exportToExcel(staff.filter(s => selectedIds.has(s.id)), 'staff_selected')}
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

        {/* ── STAFF TABLE ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">
                <Users className="h-6 w-6 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">
                {hasActiveFilters ? 'No staff match your filters' : 'No staff yet — add your first member!'}
              </p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs text-indigo-500 underline underline-offset-2 hover:text-indigo-700 transition-colors">
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
                    <TableHead className="pl-2 py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 cursor-pointer" onClick={() => toggleSort('full_name')}>
                      Staff <SortIcon field="full_name" />
                    </TableHead>
                    <TableHead className="py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Staff Code</TableHead>
                    <TableHead className="py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 cursor-pointer" onClick={() => toggleSort('designation')}>
                      Designation <SortIcon field="designation" />
                    </TableHead>
                    <TableHead className="py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Employment</TableHead>
                    <TableHead className="py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 cursor-pointer" onClick={() => toggleSort('date_of_joining')}>
                      Joined <SortIcon field="date_of_joining" />
                    </TableHead>
                    <TableHead className="py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Contact</TableHead>
                    <TableHead className="py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 cursor-pointer" onClick={() => toggleSort('status')}>
                      Status <SortIcon field="status" />
                    </TableHead>
                    <TableHead className="py-3 pr-5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedStaff.map(s => {
                    const avatarStyle    = getAvatarStyle(s.full_name || 'S');
                    const isDeleteTarget = deleteTarget?.id === s.id;
                    const isSelected     = selectedIds.has(s.id);
                    return (
                      <>
                        <TableRow key={s.id}
                          className={`border-gray-100 transition-colors ${
                            isDeleteTarget ? 'bg-red-50/30' :
                            isSelected     ? 'bg-indigo-50/40' :
                            'hover:bg-indigo-50/20'
                          }`}
                        >
                          <TableCell className="pl-4 py-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(s.id)}
                              aria-label={`Select ${s.full_name}`}
                              className="border-gray-300"
                            />
                          </TableCell>
                          <TableCell className="pl-2 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 ring-2 ring-gray-100 shrink-0">
                                <AvatarImage src={s.photo_url || undefined} />
                                <AvatarFallback className={`text-xs font-semibold ${avatarStyle.bg} ${avatarStyle.text}`}>
                                  {getInitials(s.full_name || 'S')}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate max-w-[150px]">{s.full_name}</p>
                                <p className="text-[11px] text-gray-400 truncate max-w-[150px] mt-0.5">{s.email || '—'}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="font-mono text-xs text-gray-400">{s.staff_code || '—'}</span>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-sm font-medium text-gray-700">{s.designation || '—'}</span>
                          </TableCell>
                          <TableCell className="py-3"><EmploymentBadge type={s.employment_type} /></TableCell>
                          <TableCell className="py-3">
                            <span className="text-xs text-gray-500">
                              {s.date_of_joining
                                ? new Date(s.date_of_joining).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                                : '—'}
                            </span>
                          </TableCell>
                          <TableCell className="py-3">
                            <span className="text-xs text-gray-600">{s.mobile_number || '—'}</span>
                          </TableCell>
                          <TableCell className="py-3"><StatusBadge status={s.status} /></TableCell>
                          <TableCell className="py-3 pr-5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handleEdit(s)}
                                className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => setDeleteTarget(isDeleteTarget ? null : s)}
                                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isDeleteTarget && (
                          <DeleteConfirmRow
                            staff={s}
                            onConfirm={() => handleDelete(s)}
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

          {/* Pagination bar */}
          {!loading && filtered.length > 0 && renderPaginationBar()}
        </div>

      </div>

      {/* ── Bulk Edit Dialog ── */}
      <BulkEditDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        selectedCount={selectedIds.size}
        uniqueDesignations={uniqueDesignations}
        onApply={handleBulkEdit}
      />
    </AdminLayout>
  );
}