import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getAcademicLabels,
  getAcademicCategories,
  getAllAcademicSubcategories,
  getAllAcademicItems,
  getStaff,
} from '@/db/api';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus, Edit, Trash2, Download, Upload, Search,
  BookOpen, GraduationCap, AlertCircle, Loader2,
  Layers, CheckCircle, X, SlidersHorizontal, Calendar,
  Shield, RefreshCw, TrendingUp, ArrowLeft, Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import type { Subject, AcademicStructureLabel, AcademicCategory, AcademicSubcategory, AcademicItem, Staff } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface SubjectFormData {
  categoryId: string;
  subcategoryId: string;
  name: string;
  subjectCode: string;
  description: string;
  status: 'active' | 'inactive';
}

interface GroupedSubjects {
  [departmentId: string]: {
    departmentName: string;
    years: {
      [yearId: string]: {
        yearName: string;
        subjects: Subject[];
      };
    };
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated Count-Up Hook
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
// Metric Card
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
// Progressive Filter Panel (slides in from right / overlays)
// ─────────────────────────────────────────────────────────────────────────────
function FilterPanel({
  open,
  onClose,
  filterCategory,
  setFilterCategory,
  filterSubcategory,
  setFilterSubcategory,
  filterStatus,
  setFilterStatus,
  categories,
  subcategories,
  deptLabel,
  yearLabel,
  onClear,
  hasActiveFilters,
  filteredCount,
  totalCount,
}: {
  open: boolean;
  onClose: () => void;
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  filterSubcategory: string;
  setFilterSubcategory: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  categories: AcademicCategory[];
  subcategories: AcademicSubcategory[];
  deptLabel: string;
  yearLabel: string;
  onClear: () => void;
  hasActiveFilters: boolean;
  filteredCount: number;
  totalCount: number;
}) {
  // Count active filters
  const activeCount = [
    filterCategory !== 'all',
    filterSubcategory !== 'all',
    filterStatus !== 'all',
  ].filter(Boolean).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Sliding Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-96 z-50 bg-white shadow-2xl border-l border-gray-100 flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/60">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="flex items-center justify-center h-8 w-8 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-indigo-600" />
                Filter Subjects
                {activeCount > 0 && (
                  <span className="h-5 w-5 flex items-center justify-center rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                    {activeCount}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Showing <span className="font-semibold text-gray-700">{filteredCount}</span> of <span className="font-semibold text-gray-700">{totalCount}</span> subjects
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center h-8 w-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Panel Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* Status */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-3">
              Status
            </label>
            <div className="flex flex-col gap-2">
              {[
                { val: 'all', label: 'All Statuses', desc: 'Show every subject' },
                { val: 'active', label: 'Active', desc: 'Currently enabled subjects', dot: 'bg-emerald-500' },
                { val: 'inactive', label: 'Inactive', desc: 'Disabled subjects', dot: 'bg-amber-400' },
              ].map(c => (
                <button
                  key={c.val}
                  onClick={() => setFilterStatus(c.val)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150 ${
                    filterStatus === c.val
                      ? 'bg-indigo-50 border-indigo-300 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/30'
                  }`}
                >
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    filterStatus === c.val ? 'border-indigo-600' : 'border-gray-300'
                  }`}>
                    {filterStatus === c.val && <div className="h-2 w-2 rounded-full bg-indigo-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {c.dot && <span className={`h-2 w-2 rounded-full ${c.dot} flex-shrink-0`} />}
                      <span className={`text-sm font-semibold ${filterStatus === c.val ? 'text-indigo-700' : 'text-gray-700'}`}>
                        {c.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">{c.desc}</p>
                  </div>
                  {filterStatus === c.val && <CheckCircle className="h-4 w-4 text-indigo-600 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Department */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                {deptLabel}
              </label>
              {filterCategory !== 'all' && (
                <button
                  onClick={() => { setFilterCategory('all'); setFilterSubcategory('all'); }}
                  className="text-[10px] text-indigo-500 hover:text-indigo-700 font-semibold"
                >
                  Clear
                </button>
              )}
            </div>
            <select
              value={filterCategory}
              onChange={e => { setFilterCategory(e.target.value); setFilterSubcategory('all'); }}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            >
              <option value="all">All {deptLabel}s</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Year — only visible once a department is selected */}
          <div className={`transition-all duration-200 ${filterCategory !== 'all' ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                {yearLabel}
              </label>
              {filterSubcategory !== 'all' && (
                <button
                  onClick={() => setFilterSubcategory('all')}
                  className="text-[10px] text-indigo-500 hover:text-indigo-700 font-semibold"
                >
                  Clear
                </button>
              )}
            </div>
            <select
              value={filterSubcategory}
              onChange={e => setFilterSubcategory(e.target.value)}
              disabled={filterCategory === 'all'}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white text-gray-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
            >
              <option value="all">All {yearLabel}s</option>
              {subcategories
                .filter(sub => filterCategory === 'all' || sub.category_id === filterCategory)
                .map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
            </select>
            {filterCategory === 'all' && (
              <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Select a {deptLabel.toLowerCase()} first
              </p>
            )}
          </div>

          {/* Active filter summary chips */}
          {hasActiveFilters && (
            <>
              <div className="border-t border-gray-100" />
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-2">
                  Active Filters
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {filterStatus !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-[11px] font-semibold text-indigo-700">
                      Status: {filterStatus}
                      <button onClick={() => setFilterStatus('all')} className="hover:text-indigo-900">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {filterCategory !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-[11px] font-semibold text-indigo-700">
                      {deptLabel}: {categories.find(c => c.id === filterCategory)?.name}
                      <button onClick={() => { setFilterCategory('all'); setFilterSubcategory('all'); }} className="hover:text-indigo-900">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {filterSubcategory !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-[11px] font-semibold text-indigo-700">
                      {yearLabel}: {subcategories.find(s => s.id === filterSubcategory)?.name}
                      <button onClick={() => setFilterSubcategory('all')} className="hover:text-indigo-900">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Panel Footer */}
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/60 flex items-center gap-3">
          {hasActiveFilters && (
            <button
              onClick={onClear}
              className="flex-1 h-9 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50 transition-all"
            >
              Clear All Filters
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 h-9 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Upload Dialog
// ─────────────────────────────────────────────────────────────────────────────
function SimpleBulkUploadDialog({ open, onOpenChange, onUpload }: any) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) { toast.error('Please select a file'); return; }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        await onUpload(jsonData);
        onOpenChange(false);
        setFile(null);
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white rounded-xl border border-gray-100 shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-gray-900">Bulk Upload Subjects</DialogTitle>
          <DialogDescription className="text-xs text-gray-400">
            Upload an Excel file with subject data
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors">
            <Upload className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-600"
            />
            <p className="text-xs text-gray-400 mt-2">Supported: .xlsx, .xls, .csv</p>
            {file && <p className="text-xs text-indigo-600 font-semibold mt-1">{file.name}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="h-9 text-xs rounded-lg border border-gray-200">
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="h-9 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {uploading ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading…</> : 'Upload'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function SubjectManagementPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [filteredSubjects, setFilteredSubjects] = useState<Subject[]>([]);
  const [groupedSubjects, setGroupedSubjects] = useState<GroupedSubjects>({});
  const [labels, setLabels] = useState<AcademicStructureLabel | null>(null);
  const [categories, setCategories] = useState<AcademicCategory[]>([]);
  const [subcategories, setSubcategories] = useState<AcademicSubcategory[]>([]);
  const [items, setItems] = useState<AcademicItem[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSubcategory, setFilterSubcategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('grouped');

  const [formData, setFormData] = useState<SubjectFormData>({
    categoryId: '',
    subcategoryId: '',
    name: '',
    subjectCode: '',
    description: '',
    status: 'active',
  });

  useEffect(() => { fetchData(); }, [profile?.institution_id]);
  useEffect(() => { applyFilters(); }, [subjects, searchTerm, filterCategory, filterSubcategory, filterStatus]);
  useEffect(() => {
    if (filteredSubjects.length > 0 && viewMode === 'grouped') groupSubjectsByDepartmentAndYear();
  }, [filteredSubjects, viewMode]);

  const fetchData = async () => {
    if (!profile?.institution_id) { setLoading(false); return; }
    try {
      setLoading(true);
      setError(null);
      const [subjectsData, labelsData, categoriesData, subcategoriesData, itemsData, staffData] = await Promise.all([
        getSubjects(profile.institution_id, 1000, 0),
        getAcademicLabels(profile.institution_id),
        getAcademicCategories(profile.institution_id),
        getAllAcademicSubcategories(profile.institution_id),
        getAllAcademicItems(profile.institution_id),
        getStaff(profile.institution_id, 100, 0),
      ]);
      setSubjects(subjectsData || []);
      setFilteredSubjects(subjectsData || []);
      setLabels(labelsData);
      setCategories(categoriesData || []);
      setSubcategories(subcategoriesData || []);
      setItems(itemsData || []);
      setStaff(staffData || []);
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
      setError(error.message || 'Failed to load subjects');
      toast.error('Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  const groupSubjectsByDepartmentAndYear = () => {
    try {
      const grouped: GroupedSubjects = {};
      filteredSubjects.forEach((subject) => {
        const departmentId = subject.category_id || 'uncategorized';
        const departmentName = getCategoryName(subject.category_id);
        const yearId = subject.subcategory_id || 'uncategorized';
        const yearName = getSubcategoryName(subject.subcategory_id);
        if (!grouped[departmentId]) grouped[departmentId] = { departmentName, years: {} };
        if (!grouped[departmentId].years[yearId]) grouped[departmentId].years[yearId] = { yearName, subjects: [] };
        grouped[departmentId].years[yearId].subjects.push(subject);
      });
      setGroupedSubjects(grouped);
    } catch (error) { console.error('Error grouping subjects:', error); }
  };

  const applyFilters = () => {
    try {
      let filtered = [...subjects];
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(s =>
          s.name?.toLowerCase().includes(term) ||
          s.subject_code?.toLowerCase().includes(term) ||
          s.code?.toLowerCase().includes(term)
        );
      }
      if (filterCategory !== 'all') filtered = filtered.filter(s => s.category_id === filterCategory);
      if (filterSubcategory !== 'all') filtered = filtered.filter(s => s.subcategory_id === filterSubcategory);
      if (filterStatus !== 'all') filtered = filtered.filter(s => s.status === filterStatus);
      setFilteredSubjects(filtered);
    } catch (error) { console.error('Error applying filters:', error); }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterCategory('all');
    setFilterSubcategory('all');
    setFilterStatus('all');
  };

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setFormData({
      categoryId: subject.category_id || '',
      subcategoryId: subject.subcategory_id || '',
      name: subject.name,
      subjectCode: subject.subject_code || subject.code || '',
      description: subject.description || '',
      status: subject.status === 'active' ? 'active' : 'inactive',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subject?')) return;
    try {
      await deleteSubject(id);
      toast.success('Subject deleted successfully');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete subject');
    }
  };

  const handleSubmit = async () => {
    if (!profile?.institution_id) { toast.error('No institution found'); return; }
    if (!formData.categoryId) { toast.error(`Please select a ${deptLabel.toLowerCase()}`); return; }
    if (!formData.subcategoryId) { toast.error(`Please select a ${yearLabel.toLowerCase()}`); return; }
    if (!formData.name) { toast.error('Please enter subject name'); return; }
    try {
      setSubmitting(true);
      const subjectData = {
        institution_id: profile.institution_id,
        name: formData.name,
        code: formData.subjectCode || undefined,
        subject_code: formData.subjectCode || undefined,
        description: formData.description || undefined,
        category_id: formData.categoryId,
        subcategory_id: formData.subcategoryId,
        status: formData.status,
      };
      if (editingSubject) {
        await updateSubject(editingSubject.id, subjectData);
        toast.success('Subject updated successfully');
      } else {
        await createSubject(subjectData);
        toast.success('Subject created successfully');
      }
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save subject');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingSubject(null);
    setFormData({ categoryId: '', subcategoryId: '', name: '', subjectCode: '', description: '', status: 'active' });
  };

  const handleExport = () => {
    try {
      const exportData = filteredSubjects.map(s => ({
        'Subject Code': s.subject_code || s.code || '',
        'Subject Name': s.name,
        'Department': getCategoryName(s.category_id),
        'Year': getSubcategoryName(s.subcategory_id),
        'Status': s.status || 'active',
        'Description': s.description || '',
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Subjects');
      XLSX.writeFile(wb, `subjects_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Subjects exported successfully');
    } catch {
      toast.error('Failed to export subjects');
    }
  };

  const handleBulkUpload = async (data: any[]) => {
    if (!profile?.institution_id) return;
    const errors: string[] = [];
    let successCount = 0;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        const category = categories.find(c => c.name === row.Department);
        if (!category) { errors.push(`Row ${i + 2}: Department "${row.Department}" not found`); continue; }
        const subcategory = subcategories.find(s => s.name === row.Year && s.category_id === category.id);
        if (!subcategory) { errors.push(`Row ${i + 2}: Year not found`); continue; }
        await createSubject({
          institution_id: profile.institution_id,
          name: row['Subject Name'],
          code: row['Subject Code'] || undefined,
          subject_code: row['Subject Code'] || undefined,
          description: row.Description || undefined,
          status: row.Status?.toLowerCase() || 'active',
          category_id: category.id,
          subcategory_id: subcategory.id,
        });
        successCount++;
      } catch (error: any) {
        errors.push(`Row ${i + 2}: ${error.message}`);
      }
    }
    if (errors.length > 0) toast.error(`Uploaded ${successCount} with ${errors.length} errors`);
    else toast.success(`Successfully uploaded ${successCount} subjects`);
    fetchData();
  };

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return '-';
    return categories.find(c => c.id === categoryId)?.name || '-';
  };
  const getSubcategoryName = (subcategoryId?: string) => {
    if (!subcategoryId) return '-';
    return subcategories.find(s => s.id === subcategoryId)?.name || '-';
  };
  const getAvailableYears = () => {
    if (!formData.categoryId) return [];
    return subcategories.filter(sub => sub.category_id === formData.categoryId);
  };

  const totalSubjects = subjects.length;
  const activeSubjects = subjects.filter(s => s.status === 'active').length;
  const inactiveSubjects = subjects.filter(s => s.status === 'inactive').length;
  const totalDepartmentsWithSubjects = new Set(subjects.map(s => s.category_id).filter(Boolean)).size;

  const hasActiveFilters = searchTerm !== '' || filterCategory !== 'all' || filterSubcategory !== 'all' || filterStatus !== 'all';
  const activeFilterCount = [
    filterCategory !== 'all',
    filterSubcategory !== 'all',
    filterStatus !== 'all',
  ].filter(Boolean).length;

  const deptLabel = labels?.category_label || 'Department';
  const yearLabel = labels?.subcategory_label || 'Year';

  // ── Grouped View (compact — one table header per dept, year as inline divider) ──
  const renderGroupedView = () => {
    if (Object.keys(groupedSubjects).length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <BookOpen className="h-12 w-12 text-gray-200" />
          <p className="text-sm font-medium text-gray-400">No subjects found</p>
        </div>
      );
    }
    return (
      <div className="divide-y divide-gray-100">
        {Object.entries(groupedSubjects).map(([deptId, deptData]) => (
          <div key={deptId}>
            {/* ── Dept header row ── */}
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50/70">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-indigo-50">
                  <GraduationCap className="h-3.5 w-3.5 text-indigo-600" />
                </div>
                <span className="font-bold text-gray-800 text-sm">{deptData.departmentName}</span>
                <span className="text-[11px] text-gray-400">
                  · {Object.keys(deptData.years).length} {yearLabel}(s) · {filteredSubjects.filter(s => s.category_id === deptId).length} subject(s)
                </span>
              </div>
              <span className="text-[10px] font-medium text-gray-500 bg-white border border-gray-200 px-2.5 py-0.5 rounded-full">
                {Object.keys(deptData.years).length} {yearLabel}s
              </span>
            </div>

            {/* ── Single column header for entire dept ── */}
            <div className="grid grid-cols-[160px_1fr_140px_80px] px-5 py-2 border-b border-gray-100 bg-white">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Code</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Subject Name</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Actions</span>
            </div>

            {/* ── Years with subjects — no repeated headers ── */}
            {Object.entries(deptData.years).map(([yearId, yearData]) => (
              <div key={yearId}>
                {/* Year divider — slim, inline */}
                <div className="flex items-center gap-2 px-5 py-1.5 bg-emerald-50/40 border-b border-emerald-100/60">
                  <Calendar className="h-3 w-3 text-emerald-500" />
                  <span className="text-[11px] font-semibold text-emerald-700">{yearData.yearName}</span>
                  <span className="text-[10px] text-gray-400">— {yearData.subjects.length} subject(s)</span>
                </div>

                {/* Subject rows — plain grid, no Table component overhead */}
                {yearData.subjects.length === 0 ? (
                  <div className="px-5 py-4 text-center text-[12px] text-gray-300">
                    No subjects added yet
                  </div>
                ) : (
                  yearData.subjects.map((subject, idx) => (
                    <div
                      key={subject.id}
                      className={`grid grid-cols-[160px_1fr_140px_80px] items-center px-5 py-3 hover:bg-indigo-50/20 transition-colors ${
                        idx < yearData.subjects.length - 1 ? 'border-b border-gray-50' : ''
                      }`}
                    >
                      <span className="font-mono text-xs text-gray-400">
                        {subject.subject_code || subject.code || '—'}
                      </span>
                      <span className="text-sm font-semibold text-gray-800 truncate pr-4">{subject.name}</span>
                      <span>
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                          subject.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-gray-50 text-gray-500 border-gray-200'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${subject.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                          {subject.status || 'active'}
                        </span>
                      </span>
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => handleEdit(subject)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(subject.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  // ── List View ─────────────────────────────────────────────────────────────
  const renderListView = () => {
    if (filteredSubjects.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <BookOpen className="h-12 w-12 text-gray-200" />
          <p className="text-sm font-medium text-gray-400">No subjects found</p>
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-100 hover:bg-transparent">
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Code</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Subject Name</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{deptLabel}</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{yearLabel}</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</TableHead>
              <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSubjects.map((subject) => (
              <TableRow key={subject.id} className="border-gray-100 hover:bg-indigo-50/20 transition-colors">
                <TableCell className="font-mono text-sm text-gray-400">{subject.subject_code || subject.code || '—'}</TableCell>
                <TableCell className="font-semibold text-gray-800">{subject.name}</TableCell>
                <TableCell className="text-sm text-gray-600">{getCategoryName(subject.category_id)}</TableCell>
                <TableCell className="text-sm text-gray-600">{getSubcategoryName(subject.subcategory_id)}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                    subject.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-gray-50 text-gray-500 border-gray-200'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${subject.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                    {subject.status || 'active'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <button
                      onClick={() => handleEdit(subject)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(subject.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (error) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">Subject Management</h1>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-4" />
            <h2 className="text-base font-bold text-gray-900 mb-2">Error Loading Data</h2>
            <p className="text-sm text-gray-500 mb-4">{error}</p>
            <Button onClick={fetchData} className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs">Retry</Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* ── PAGE HEADER ── */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Back button */}
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all shadow-sm"
              title="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Subject Management</h1>
              <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                Organise by {deptLabel.toLowerCase()} and {yearLabel.toLowerCase()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-xs font-mono text-gray-400">
                {loading ? 'Loading…' : `${subjects.length} subjects total`}
              </p>
            </div>
            <div className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500">
              <Shield className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* ── METRICS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Total Subjects" value={totalSubjects} icon={BookOpen} iconBg="bg-indigo-50" iconColor="text-indigo-600" subtitle="registered" loading={loading} />
          <MetricCard label="Active" value={activeSubjects} icon={CheckCircle} iconBg="bg-emerald-50" iconColor="text-emerald-600" subtitle="enabled" loading={loading} />
          <MetricCard label="Inactive" value={inactiveSubjects} icon={TrendingUp} iconBg="bg-amber-50" iconColor="text-amber-600" subtitle="disabled" loading={loading} />
          <MetricCard label={`${deptLabel}s`} value={totalDepartmentsWithSubjects} icon={GraduationCap} iconBg="bg-violet-50" iconColor="text-violet-600" subtitle="with subjects" loading={loading} />
        </div>

        {/* ── TOP ACTION BAR ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* View mode toggle */}
          <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-100 p-1 shadow-sm">
            <button
              onClick={() => setViewMode('grouped')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                viewMode === 'grouped' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Grouped
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                viewMode === 'list' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              List
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline" size="sm"
              onClick={() => setBulkUploadOpen(true)}
              className="h-9 gap-1.5 border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all rounded-lg text-xs font-semibold"
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Bulk Upload</span>
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={handleExport}
              disabled={filteredSubjects.length === 0}
              className="h-9 gap-1.5 border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all rounded-lg text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={fetchData}
              disabled={loading}
              className="h-9 gap-1.5 border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all rounded-lg text-xs font-semibold"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  onClick={resetForm}
                  className="h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Subject
                </Button>
              </DialogTrigger>

              {/* ── Add / Edit Dialog ── */}
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl border border-gray-100 shadow-lg">
                <DialogHeader className="pb-4 border-b border-gray-100">
                  <DialogTitle className="text-base font-bold text-gray-900">
                    {editingSubject ? 'Edit Subject' : 'Add New Subject'}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-gray-400">
                    Fill in the details. {deptLabel} and {yearLabel} are required.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 pt-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">{deptLabel} *</label>
                    <Select
                      value={formData.categoryId || undefined}
                      onValueChange={(value) => setFormData({ ...formData, categoryId: value, subcategoryId: '' })}
                    >
                      <SelectTrigger className="h-9 text-sm border border-gray-200 rounded-lg focus:border-indigo-400">
                        <SelectValue placeholder={`Select ${deptLabel.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">{yearLabel} *</label>
                    <Select
                      value={formData.subcategoryId || undefined}
                      onValueChange={(value) => setFormData({ ...formData, subcategoryId: value })}
                      disabled={!formData.categoryId}
                    >
                      <SelectTrigger className="h-9 text-sm border border-gray-200 rounded-lg focus:border-indigo-400">
                        <SelectValue placeholder={!formData.categoryId ? `Select ${deptLabel.toLowerCase()} first` : `Select ${yearLabel.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableYears().map(sub => <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">Subject Name *</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter subject name"
                      className="h-9 text-sm border border-gray-200 rounded-lg focus:border-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">Subject Code</label>
                    <Input
                      value={formData.subjectCode}
                      onChange={(e) => setFormData({ ...formData, subjectCode: e.target.value })}
                      placeholder="e.g. CS101"
                      className="h-9 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">Status</label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: 'active' | 'inactive') => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger className="h-9 text-sm border border-gray-200 rounded-lg focus:border-indigo-400">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1.5">Description</label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Enter subject description (optional)"
                      rows={3}
                      className="text-sm border border-gray-200 rounded-lg focus:border-indigo-400 resize-none"
                    />
                  </div>

                  <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
                    <AlertCircle className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-indigo-700 leading-relaxed">
                      Subjects are organised by <strong>{deptLabel.toLowerCase()}</strong> and <strong>{yearLabel.toLowerCase()}</strong>. Both fields are required.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-9 text-xs rounded-lg border border-gray-200">
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="h-9 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                    >
                      {submitting ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />{editingSubject ? 'Updating…' : 'Creating…'}</>
                      ) : (
                        editingSubject ? 'Update Subject' : 'Create Subject'
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* ── SEARCH + FILTER BAR (Progressive Disclosure) ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by subject name or code…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Button — opens progressive panel */}
            <button
              onClick={() => setFilterPanelOpen(true)}
              className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                activeFilterCount > 0
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="h-4 w-4 flex items-center justify-center rounded-full bg-white text-indigo-700 text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Quick clear when filters active */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-rose-600 transition-colors whitespace-nowrap"
              >
                <X className="h-3 w-3" /> Clear all
              </button>
            )}
          </div>

          {/* Active filter chips — shown inline below search bar */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-100 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Active:</span>
              {filterStatus !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[11px] font-semibold text-indigo-700">
                  Status: {filterStatus}
                  <button onClick={() => setFilterStatus('all')} className="hover:text-indigo-900 ml-0.5">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              )}
              {filterCategory !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[11px] font-semibold text-indigo-700">
                  {deptLabel}: {categories.find(c => c.id === filterCategory)?.name}
                  <button onClick={() => { setFilterCategory('all'); setFilterSubcategory('all'); }} className="hover:text-indigo-900 ml-0.5">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              )}
              {filterSubcategory !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[11px] font-semibold text-indigo-700">
                  {yearLabel}: {subcategories.find(s => s.id === filterSubcategory)?.name}
                  <button onClick={() => setFilterSubcategory('all')} className="hover:text-indigo-900 ml-0.5">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Results summary */}
          <div className="flex justify-between items-center px-4 py-2 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Showing <span className="font-bold text-gray-700">{filteredSubjects.length}</span> of <span className="font-bold text-gray-700">{subjects.length}</span> subjects
            </p>
            {viewMode === 'grouped' && Object.keys(groupedSubjects).length > 0 && (
              <p className="text-xs text-gray-400">
                {Object.keys(groupedSubjects).length} {deptLabel}(s) ·{' '}
                {Object.values(groupedSubjects).reduce((acc, dept) => acc + Object.keys(dept.years).length, 0)} {yearLabel}(s)
              </p>
            )}
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20 gap-3">
            <BookOpen className="h-12 w-12 text-gray-200" />
            <p className="text-sm font-medium text-gray-400">
              {hasActiveFilters ? 'No subjects match your filters' : 'No subjects yet — add your first one!'}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-indigo-500 underline underline-offset-2 hover:text-indigo-700 transition-colors">
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {viewMode === 'grouped' ? renderGroupedView() : renderListView()}
          </div>
        )}

        {/* ── FOOTER ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-gray-300" />
            <span>
              Institution ID:{' '}
              <span className="font-semibold text-gray-600">{profile?.institution_id?.slice(0, 8) || '—'}…</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-bold border border-indigo-100 text-[10px] uppercase tracking-wide">
              Curriculum
            </span>
          </div>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" />
            {subjects.length} subjects across {totalDepartmentsWithSubjects} {deptLabel.toLowerCase()}(s)
          </span>
        </div>
      </div>

      {/* ── PROGRESSIVE FILTER PANEL ── */}
      <FilterPanel
        open={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        filterCategory={filterCategory}
        setFilterCategory={setFilterCategory}
        filterSubcategory={filterSubcategory}
        setFilterSubcategory={setFilterSubcategory}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        categories={categories}
        subcategories={subcategories}
        deptLabel={deptLabel}
        yearLabel={yearLabel}
        onClear={clearFilters}
        hasActiveFilters={hasActiveFilters}
        filteredCount={filteredSubjects.length}
        totalCount={subjects.length}
      />

      <SimpleBulkUploadDialog
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
        onUpload={handleBulkUpload}
      />
    </AdminLayout>
  );
}