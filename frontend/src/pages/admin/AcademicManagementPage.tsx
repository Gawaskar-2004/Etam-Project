import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  getAcademicLabels,
  getAcademicCategories,
  getAllAcademicSubcategories,
  getAllAcademicItems,
  createAcademicCategory,
  createAcademicSubcategory,
  createAcademicItem,
  deleteAcademicCategory,
  deleteAcademicSubcategory,
  deleteAcademicItem,
} from '@/db/api';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus, Trash2, Building2, Calendar, Users, Layers,
  X, PlusCircle, CheckCircle, Shield, CalendarDays,
  ArrowLeft, ChevronDown, ChevronRight, Search,
  BookOpen, GraduationCap, Hash,
} from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { toast } from 'sonner';
import type {
  AcademicStructureLabel,
  AcademicCategory,
  AcademicSubcategory,
  AcademicItem,
} from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface ItemFormData {
  name: string;
  status: 'active' | 'inactive';
}

interface CombinedFormData {
  categoryName: string;
  academicYear: string;
  categoryStatus: 'active' | 'inactive';
  subcategoryName: string;
  subcategoryStatus: 'active' | 'inactive';
  items: ItemFormData[];
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
  label: string; value: number | string; icon: any;
  iconBg: string; iconColor: string; subtitle?: string; loading?: boolean;
}) {
  const numVal = typeof value === 'number' ? value : parseInt(value as string) || 0;
  const animated = useCountUp(loading ? 0 : numVal);

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
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{animated}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Badge
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const active = status === 'active';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
      active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
      {status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Beautiful Card-based Academic Structure View
// ─────────────────────────────────────────────────────────────────────────────
function AcademicStructureView({
  categories, subcategories, items,
  deptLabel, yearLabel, sectionLabel,
  onDeleteCategory, onDeleteSubcategory, onDeleteItem,
  loading,
}: {
  categories: AcademicCategory[];
  subcategories: AcademicSubcategory[];
  items: AcademicItem[];
  deptLabel: string; yearLabel: string; sectionLabel: string;
  onDeleteCategory: (id: string, name: string) => void;
  onDeleteSubcategory: (id: string, name: string) => void;
  onDeleteItem: (id: string, name: string) => void;
  loading: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  // Auto-expand first category
  useEffect(() => {
    if (categories.length > 0 && !selectedCatId) {
      setSelectedCatId(categories[0].id);
    }
  }, [categories]);

  const toggleCat = (id: string) =>
    setExpandedCats(p => ({ ...p, [id]: !p[id] }));

  const toggleSub = (id: string) =>
    setExpandedSubs(p => ({ ...p, [id]: !p[id] }));

  const filtered = searchQuery.trim()
    ? categories.filter(cat => {
        const catMatch = cat.name.toLowerCase().includes(searchQuery.toLowerCase());
        const subMatch = subcategories
          .filter(s => s.category_id === cat.id)
          .some(s =>
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            items.filter(i => i.subcategory_id === s.id).some(i =>
              i.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
          );
        return catMatch || subMatch;
      })
    : categories;

  const selectedCat = categories.find(c => c.id === selectedCatId);
  const selectedCatSubs = subcategories.filter(s => s.category_id === selectedCatId);
  const selectedCatItemCount = selectedCatSubs.reduce(
    (acc, sub) => acc + items.filter(i => i.subcategory_id === sub.id).length, 0
  );

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl bg-gray-100" />)}
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl bg-gray-100" />)}
        </div>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100 flex items-center justify-center border border-indigo-100">
          <GraduationCap className="h-8 w-8 text-indigo-300" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-500">No academic structure yet</p>
          <p className="text-xs text-gray-300 mt-1">Use the form above to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Search bar */}
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={`Search ${deptLabel}s, ${yearLabel}s, ${sectionLabel}s…`}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Two-panel layout: sidebar + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] min-h-[400px]">

        {/* LEFT: Department sidebar */}
        <div className="border-r border-gray-100 bg-gray-50/30 p-3 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-2 pb-1">{deptLabel}s</p>
          {filtered.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-6 italic">No results</p>
          )}
          {filtered.map(cat => {
            const catSubs  = subcategories.filter(s => s.category_id === cat.id);
            const catItems = catSubs.reduce((acc, s) => acc + items.filter(i => i.subcategory_id === s.id).length, 0);
            const isActive = selectedCatId === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCatId(isActive ? null : cat.id)}
                className={`w-full text-left rounded-xl px-3 py-3 transition-all duration-150 group border ${
                  isActive
                    ? 'bg-indigo-600 border-indigo-500 shadow-sm'
                    : 'bg-white border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`p-1.5 rounded-lg shrink-0 ${isActive ? 'bg-indigo-500' : 'bg-indigo-50'}`}>
                      <Building2 className={`h-3.5 w-3.5 ${isActive ? 'text-white' : 'text-indigo-500'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-gray-800'}`}>
                        {cat.name}
                      </p>
                      <p className={`text-[10px] mt-0.5 flex items-center gap-1 ${isActive ? 'text-indigo-200' : 'text-gray-400'}`}>
                        <CalendarDays className="h-2.5 w-2.5" />
                        {cat.academic_year}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      isActive ? 'bg-indigo-500 text-indigo-100' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {catSubs.length}Y · {catItems}S
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* RIGHT: Detail panel */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[600px]">
          {!selectedCatId || !selectedCat ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-gray-300">
              <GraduationCap className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">Select a {deptLabel.toLowerCase()} to view details</p>
            </div>
          ) : (
            <>
              {/* Department header card */}
              <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 p-5 text-white relative overflow-hidden">
                {/* Decorative circles */}
                <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/5" />
                <div className="absolute -bottom-4 -right-2 h-16 w-16 rounded-full bg-white/5" />
                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest mb-1">{deptLabel}</p>
                      <h3 className="text-lg font-bold leading-tight">{selectedCat.name}</h3>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="flex items-center gap-1 text-[11px] text-indigo-200">
                          <CalendarDays className="h-3 w-3" /> {selectedCat.academic_year}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-indigo-200">
                          <BookOpen className="h-3 w-3" /> {selectedCatSubs.length} {yearLabel}(s)
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-indigo-200">
                          <Users className="h-3 w-3" /> {selectedCatItemCount} {sectionLabel}(s)
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                        selectedCat.status === 'active'
                          ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                          : 'bg-white/10 border-white/20 text-white/60'
                      }`}>
                        {selectedCat.status || 'active'}
                      </span>
                      <button
                        onClick={() => onDeleteCategory(selectedCat.id, selectedCat.name)}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-rose-500/30 text-white/60 hover:text-white transition-colors"
                        title={`Delete ${selectedCat.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Year/Section grid */}
              {selectedCatSubs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-300 border border-dashed border-gray-200 rounded-xl">
                  <Calendar className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">No {yearLabel.toLowerCase()}s added yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedCatSubs.map((sub, subIdx) => {
                    const subItems = items.filter(i => i.subcategory_id === sub.id);
                    const isExpanded = expandedSubs[sub.id] !== false; // default expanded

                    // Color palette for year cards
                    const palettes = [
                      { header: 'bg-emerald-50 border-emerald-200', icon: 'bg-emerald-100 text-emerald-600', text: 'text-emerald-700', chip: 'bg-emerald-100 border-emerald-200 text-emerald-700', badge: 'bg-emerald-600' },
                      { header: 'bg-violet-50 border-violet-200', icon: 'bg-violet-100 text-violet-600', text: 'text-violet-700', chip: 'bg-violet-100 border-violet-200 text-violet-700', badge: 'bg-violet-600' },
                      { header: 'bg-sky-50 border-sky-200', icon: 'bg-sky-100 text-sky-600', text: 'text-sky-700', chip: 'bg-sky-100 border-sky-200 text-sky-700', badge: 'bg-sky-600' },
                      { header: 'bg-rose-50 border-rose-200', icon: 'bg-rose-100 text-rose-600', text: 'text-rose-700', chip: 'bg-rose-100 border-rose-200 text-rose-700', badge: 'bg-rose-600' },
                      { header: 'bg-amber-50 border-amber-200', icon: 'bg-amber-100 text-amber-600', text: 'text-amber-700', chip: 'bg-amber-100 border-amber-200 text-amber-700', badge: 'bg-amber-600' },
                      { header: 'bg-teal-50 border-teal-200', icon: 'bg-teal-100 text-teal-600', text: 'text-teal-700', chip: 'bg-teal-100 border-teal-200 text-teal-700', badge: 'bg-teal-600' },
                    ];
                    const p = palettes[subIdx % palettes.length];

                    return (
                      <div key={sub.id} className={`rounded-xl border ${p.header} overflow-hidden`}>
                        {/* Year header */}
                        <div className={`flex items-center justify-between px-4 py-3 ${p.header}`}>
                          <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-lg ${p.icon}`}>
                              <Calendar className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-bold ${p.text}`}>{sub.name}</span>
                                <StatusBadge status={sub.status || 'active'} />
                              </div>
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {subItems.length} {sectionLabel.toLowerCase()}(s)
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => toggleSub(sub.id)}
                              className={`p-1.5 rounded-lg bg-white/60 hover:bg-white transition-colors ${p.text}`}
                              title={isExpanded ? 'Collapse' : 'Expand'}
                            >
                              {isExpanded
                                ? <ChevronDown className="h-3.5 w-3.5" />
                                : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              onClick={() => onDeleteSubcategory(sub.id, sub.name)}
                              className="p-1.5 rounded-lg bg-white/60 hover:bg-rose-100 text-gray-400 hover:text-rose-600 transition-colors"
                              title={`Delete ${sub.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Section chips */}
                        {isExpanded && (
                          <div className="px-4 py-3 bg-white/60 border-t border-gray-100">
                            {subItems.length === 0 ? (
                              <p className="text-[11px] text-gray-300 italic">No {sectionLabel.toLowerCase()}s added</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {subItems.map((item, itemIdx) => (
                                  <div
                                    key={item.id}
                                    className={`group inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg border text-xs font-semibold transition-all ${p.chip} hover:shadow-sm`}
                                  >
                                    {/* Section letter/number indicator */}
                                    <span className={`inline-flex items-center justify-center h-4 w-4 rounded text-[10px] font-bold text-white ${p.badge}`}>
                                      {item.name.charAt(0).toUpperCase()}
                                    </span>
                                    <span>{item.name}</span>
                                    <button
                                      onClick={() => onDeleteItem(item.id, item.name)}
                                      className="ml-0.5 text-gray-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function AcademicManagementPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [labels, setLabels] = useState<AcademicStructureLabel | null>(null);
  const [categories, setCategories] = useState<AcademicCategory[]>([]);
  const [subcategories, setSubcategories] = useState<AcademicSubcategory[]>([]);
  const [items, setItems] = useState<AcademicItem[]>([]);

  const form = useForm<CombinedFormData>({
    defaultValues: {
      categoryName: '',
      academicYear: new Date().getFullYear().toString(),
      categoryStatus: 'active',
      subcategoryName: '',
      subcategoryStatus: 'active',
      items: [{ name: '', status: 'active' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });

  useEffect(() => { fetchData(); }, [profile?.institution_id]);

  const fetchData = async () => {
    if (!profile?.institution_id) return;
    try {
      setLoading(true);
      const [labelsData, catsData, subsData, itemsData] = await Promise.all([
        getAcademicLabels(profile.institution_id),
        getAcademicCategories(profile.institution_id),
        getAllAcademicSubcategories(profile.institution_id),
        getAllAcademicItems(profile.institution_id),
      ]);
      setLabels(labelsData);
      setCategories(catsData || []);
      setSubcategories(subsData || []);
      setItems(itemsData || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load academic structure');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: CombinedFormData) => {
    if (!profile?.institution_id) return;
    if (!data.categoryName.trim()) { toast.error('Please enter department name'); return; }
    if (!data.subcategoryName.trim()) { toast.error('Please enter year name'); return; }
    const validItems = data.items.filter(item => item.name.trim());
    if (validItems.length === 0) { toast.error('Please add at least one section'); return; }

    try {
      let categoryId: string;
      const existingCat = categories.find(
        c => c.name.toLowerCase() === data.categoryName.toLowerCase() && c.academic_year === data.academicYear
      );
      if (existingCat) {
        categoryId = existingCat.id;
        toast.info(`Using existing ${deptLabel}: ${data.categoryName}`);
      } else {
        const newCat = await createAcademicCategory({
          institution_id: profile.institution_id,
          name: data.categoryName,
          academic_year: data.academicYear,
          status: data.categoryStatus,
        });
        categoryId = newCat.id;
        toast.success(`${deptLabel} "${data.categoryName}" created!`);
      }

      let subcategoryId: string;
      const existingSub = subcategories.find(
        s => s.category_id === categoryId && s.name.toLowerCase() === data.subcategoryName.toLowerCase()
      );
      if (existingSub) {
        subcategoryId = existingSub.id;
        toast.info(`Using existing ${yearLabel}: ${data.subcategoryName}`);
      } else {
        const newSub = await createAcademicSubcategory({
          category_id: categoryId,
          name: data.subcategoryName,
          status: data.subcategoryStatus,
        });
        subcategoryId = newSub.id;
        toast.success(`${yearLabel} "${data.subcategoryName}" created!`);
      }

      let createdCount = 0;
      for (const item of validItems) {
        const exists = items.find(
          i => i.subcategory_id === subcategoryId && i.name.toLowerCase() === item.name.toLowerCase()
        );
        if (!exists) {
          await createAcademicItem({ subcategory_id: subcategoryId, name: item.name, status: item.status });
          createdCount++;
        }
      }

      toast.success(`✅ Added ${createdCount} ${sectionLabel.toLowerCase()}(s) successfully!`);
      form.reset({
        categoryName: '', academicYear: new Date().getFullYear().toString(),
        categoryStatus: 'active', subcategoryName: '', subcategoryStatus: 'active',
        items: [{ name: '', status: 'active' }],
      });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save. Please try again.');
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This will delete all years and sections under it.`)) return;
    try { await deleteAcademicCategory(id); toast.success('Deleted!'); fetchData(); }
    catch (e: any) { toast.error(e.message || 'Failed to delete'); }
  };
  const handleDeleteSubcategory = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This will delete all sections under it.`)) return;
    try { await deleteAcademicSubcategory(id); toast.success('Deleted!'); fetchData(); }
    catch (e: any) { toast.error(e.message || 'Failed to delete'); }
  };
  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try { await deleteAcademicItem(id); toast.success('Deleted!'); fetchData(); }
    catch (e: any) { toast.error(e.message || 'Failed to delete'); }
  };

  const deptLabel    = labels?.category_label    || 'Department';
  const yearLabel    = labels?.subcategory_label  || 'Year';
  const sectionLabel = labels?.item_label         || 'Section';

  const totalDepts    = categories.length;
  const totalYears    = subcategories.length;
  const totalSections = items.length;
  const activeDepts   = categories.filter(c => c.status === 'active').length;

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* ── PAGE HEADER ── */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center h-9 w-9 rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all shadow-sm"
              title="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Academic Management</h1>
              <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                Manage {deptLabel.toLowerCase()}s, {yearLabel.toLowerCase()}s, and {sectionLabel.toLowerCase()}s
              </p>
            </div>
          </div>
          <div className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500">
            <Shield className="h-4 w-4" />
          </div>
        </div>

        {/* ── METRIC CARDS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label={`Total ${deptLabel}s`}   value={totalDepts}    icon={Building2}   iconBg="bg-indigo-50"  iconColor="text-indigo-600"  loading={loading} />
          <MetricCard label={`Total ${yearLabel}s`}   value={totalYears}    icon={Calendar}    iconBg="bg-emerald-50" iconColor="text-emerald-600" loading={loading} />
          <MetricCard label={`Total ${sectionLabel}s`} value={totalSections} icon={Users}       iconBg="bg-violet-50"  iconColor="text-violet-600"  loading={loading} />
          <MetricCard label={`Active ${deptLabel}s`}  value={activeDepts}   icon={CheckCircle} iconBg="bg-emerald-50" iconColor="text-emerald-600" subtitle={`${activeDepts} of ${totalDepts} active`} loading={loading} />
        </div>

        {/* ── ADD FORM ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <div className="p-2 rounded-lg bg-indigo-50">
              <Plus className="h-3.5 w-3.5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Add New Academic Structure</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Add {deptLabel.toLowerCase()}, {yearLabel.toLowerCase()}, and multiple {sectionLabel.toLowerCase()}s at once
              </p>
            </div>
          </div>

          <div className="p-5">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                {/* Department */}
                <div className="rounded-lg bg-indigo-50/40 border border-indigo-100 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2 bg-indigo-100/50 border-b border-indigo-100">
                    <Building2 className="h-3.5 w-3.5 text-indigo-600" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-700">{deptLabel}</span>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="categoryName" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{deptLabel} Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., Computer Science" className="h-9 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 bg-white" />
                        </FormControl>
                        <FormMessage className="text-xs text-rose-500" />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="academicYear" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Academic Year</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., 2024" className="h-9 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 bg-white" />
                        </FormControl>
                        <FormMessage className="text-xs text-rose-500" />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="categoryStatus" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9 text-sm border border-gray-200 rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active"><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Active</div></SelectItem>
                            <SelectItem value="inactive"><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-gray-400" />Inactive</div></SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-xs text-rose-500" />
                      </FormItem>
                    )} />
                  </div>
                </div>

                {/* Year */}
                <div className="rounded-lg bg-emerald-50/40 border border-emerald-100 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100/50 border-b border-emerald-100">
                    <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">{yearLabel}</span>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="subcategoryName" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{yearLabel} Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g., First Year, Year 1" className="h-9 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 bg-white" />
                        </FormControl>
                        <FormMessage className="text-xs text-rose-500" />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="subcategoryStatus" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9 text-sm border border-gray-200 rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active"><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Active</div></SelectItem>
                            <SelectItem value="inactive"><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-gray-400" />Inactive</div></SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-xs text-rose-500" />
                      </FormItem>
                    )} />
                  </div>
                </div>

                {/* Sections */}
                <div className="rounded-lg bg-violet-50/40 border border-violet-100 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-violet-100/50 border-b border-violet-100">
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-violet-600" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-violet-700">{sectionLabel}s</span>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ name: '', status: 'active' })}
                      className="h-7 text-xs rounded-lg border border-violet-200 hover:border-violet-400 hover:bg-violet-50">
                      <PlusCircle className="h-3 w-3 mr-1" />Add {sectionLabel}
                    </Button>
                  </div>
                  <div className="p-4 space-y-2">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex gap-2 items-start">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <FormField control={form.control} name={`items.${index}.name`} render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input {...field} placeholder={`${sectionLabel} name (e.g., A, B)`} className="h-9 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 bg-white" />
                              </FormControl>
                              <FormMessage className="text-xs text-rose-500" />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`items.${index}.status`} render={({ field }) => (
                            <FormItem>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-9 text-sm border border-gray-200 rounded-lg">
                                    <SelectValue placeholder="Status" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="active"><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Active</div></SelectItem>
                                  <SelectItem value="inactive"><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-gray-400" />Inactive</div></SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage className="text-xs text-rose-500" />
                            </FormItem>
                          )} />
                        </div>
                        {index > 0 && (
                          <Button type="button" variant="ghost" size="sm"
                            className="h-9 w-9 p-0 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                            onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {fields.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-3">
                        No {sectionLabel.toLowerCase()}s added yet.
                      </p>
                    )}
                  </div>
                </div>

                <Button type="submit" className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Save {deptLabel}, {yearLabel} & {sectionLabel}(s)
                </Button>
              </form>
            </Form>
          </div>
        </div>

        {/* ── ACADEMIC STRUCTURE OVERVIEW — New Card View ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-50">
                <Layers className="h-3.5 w-3.5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Academic Structure Overview</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {categories.length} {deptLabel.toLowerCase()}(s) · {subcategories.length} {yearLabel.toLowerCase()}(s) · {items.length} {sectionLabel.toLowerCase()}(s)
                </p>
              </div>
            </div>
            {/* Summary pills */}
            <div className="hidden sm:flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700">
                <Building2 className="h-2.5 w-2.5" /> {categories.length}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700">
                <Calendar className="h-2.5 w-2.5" /> {subcategories.length}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-violet-50 border border-violet-100 text-violet-700">
                <Users className="h-2.5 w-2.5" /> {items.length}
              </span>
            </div>
          </div>

          <AcademicStructureView
            categories={categories}
            subcategories={subcategories}
            items={items}
            deptLabel={deptLabel}
            yearLabel={yearLabel}
            sectionLabel={sectionLabel}
            onDeleteCategory={handleDeleteCategory}
            onDeleteSubcategory={handleDeleteSubcategory}
            onDeleteItem={handleDeleteItem}
            loading={loading}
          />
        </div>

        {/* ── FOOTER ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-gray-300" />
            <span>Institution ID: <span className="font-semibold text-gray-600">{profile?.institution_id?.slice(0, 8) || '—'}…</span></span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold border border-emerald-200 text-[10px] uppercase tracking-wide flex items-center gap-1">
              <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" /> Live
            </span>
          </div>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Changes apply instantly across the system
          </span>
        </div>
      </div>
    </AdminLayout>
  );
}