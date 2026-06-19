import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getAcademicLabels, createAcademicLabels, updateAcademicLabels, getInstitution } from '@/db/api';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, Save, Info, CheckCircle, Layers, Shield, CalendarDays, ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { AcademicStructureLabel, InstitutionType } from '@/types';

interface LabelFormData {
  categoryLabel: string;
  subcategoryLabel: string;
  itemLabel: string;
  status: 'active' | 'inactive';
}

export default function AcademicSetupPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingLabels, setExistingLabels] = useState<AcademicStructureLabel | null>(null);
  const [institutionType, setInstitutionType] = useState<InstitutionType>('school');

  const form = useForm<LabelFormData>({
    defaultValues: {
      categoryLabel: 'Category',
      subcategoryLabel: 'Subcategory',
      itemLabel: 'Item',
      status: 'active',
    },
  });

  useEffect(() => {
    fetchData();
  }, [profile?.institution_id]);

  const fetchData = async () => {
    if (!profile?.institution_id) return;

    try {
      setLoading(true);
      const [labels, institution] = await Promise.all([
        getAcademicLabels(profile.institution_id),
        getInstitution(profile.institution_id),
      ]);

      if (institution) {
        setInstitutionType(institution.type);
      }

      if (labels) {
        setExistingLabels(labels);
        form.reset({
          categoryLabel: labels.category_label,
          subcategoryLabel: labels.subcategory_label,
          itemLabel: labels.item_label,
          status: labels.status,
        });
      } else {
        const defaults = getDefaultLabels(institution?.type || 'school');
        form.reset(defaults);
      }
    } catch (error) {
      console.error('Failed to fetch labels:', error);
      toast.error('Failed to load academic labels');
    } finally {
      setLoading(false);
    }
  };

  const getDefaultLabels = (type: InstitutionType): LabelFormData => {
    switch (type) {
      case 'school':
        return { categoryLabel: 'Standard', subcategoryLabel: 'Group', itemLabel: 'Section', status: 'active' };
      case 'college':
        return { categoryLabel: 'Department', subcategoryLabel: 'Year', itemLabel: 'Section', status: 'active' };
      case 'training':
        return { categoryLabel: 'Course', subcategoryLabel: 'Batch', itemLabel: 'Module', status: 'active' };
      default:
        return { categoryLabel: 'Category', subcategoryLabel: 'Subcategory', itemLabel: 'Item', status: 'active' };
    }
  };

  const onSubmit = async (data: LabelFormData) => {
    if (!profile?.institution_id) return;

    setSaving(true);

    try {
      if (existingLabels) {
        await updateAcademicLabels(existingLabels.id, {
          category_label: data.categoryLabel,
          subcategory_label: data.subcategoryLabel,
          item_label: data.itemLabel,
          status: data.status,
        });
        toast.success('Academic labels updated successfully!');
      } else {
        await createAcademicLabels({
          institution_id: profile.institution_id,
          category_label: data.categoryLabel,
          subcategory_label: data.subcategoryLabel,
          item_label: data.itemLabel,
        });
        toast.success('Academic labels created successfully!');
      }

      fetchData();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save academic labels');
    } finally {
      setSaving(false);
    }
  };

  const loadPreset = (type: InstitutionType) => {
    const defaults = getDefaultLabels(type);
    form.reset(defaults);
    toast.info(`Loaded ${type} preset`);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* ── PAGE HEADER ── */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {/* Back Button */}
            <button
              onClick={() => navigate(-1)}
              className="mt-0.5 flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 shadow-sm shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4 text-gray-500" />
            </button>

            <div>
              <h1 className="text-xl font-bold text-gray-900">Academic Setup</h1>
              <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                Configure the terminology used in your academic hierarchy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5">
              <Shield className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                {institutionType.charAt(0).toUpperCase() + institutionType.slice(1)}
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <Skeleton className="h-5 w-32 bg-gray-100" />
              <Skeleton className="h-3 w-64 mt-1 bg-gray-100" />
            </div>
            <div className="p-5 space-y-4">
              <Skeleton className="h-10 w-full rounded-lg bg-gray-100" />
              <Skeleton className="h-10 w-full rounded-lg bg-gray-100" />
              <Skeleton className="h-10 w-full rounded-lg bg-gray-100" />
              <Skeleton className="h-10 w-32 rounded-lg bg-gray-100" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Form Card */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                  <div className="p-2 rounded-lg bg-indigo-50">
                    <Settings className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-800">Label Configuration</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Define the terminology used in your academic hierarchy
                    </p>
                  </div>
                </div>

                <div className="p-5">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                      <FormField
                        control={form.control}
                        name="categoryLabel"
                        rules={{ required: 'Category label is required' }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                              Category Label <span className="text-rose-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="e.g., Standard, Department, Course"
                                className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 bg-white"
                              />
                            </FormControl>
                            <FormDescription className="text-[11px] text-gray-400">
                              The top-level classification (e.g., Standard for schools, Department for colleges)
                            </FormDescription>
                            <FormMessage className="text-xs text-rose-500" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="subcategoryLabel"
                        rules={{ required: 'Subcategory label is required' }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                              Subcategory Label <span className="text-rose-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="e.g., Group, Year, Batch"
                                className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 bg-white"
                              />
                            </FormControl>
                            <FormDescription className="text-[11px] text-gray-400">
                              The second-level classification (e.g., Group for schools, Year for colleges)
                            </FormDescription>
                            <FormMessage className="text-xs text-rose-500" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="itemLabel"
                        rules={{ required: 'Item label is required' }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                              Item Label <span className="text-rose-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="e.g., Section, Module"
                                className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400 bg-white"
                              />
                            </FormControl>
                            <FormDescription className="text-[11px] text-gray-400">
                              The lowest-level classification (e.g., Section A, Section B)
                            </FormDescription>
                            <FormMessage className="text-xs text-rose-500" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                              Status
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="active">
                                  <div className="flex items-center gap-2">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    Active
                                  </div>
                                </SelectItem>
                                <SelectItem value="inactive">
                                  <div className="flex items-center gap-2">
                                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                                    Inactive
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription className="text-[11px] text-gray-400">
                              Only one active structure is allowed per institution
                            </FormDescription>
                            <FormMessage className="text-xs text-rose-500" />
                          </FormItem>
                        )}
                      />

                      <div className="flex gap-2 pt-4">
                        <Button
                          type="submit"
                          disabled={saving}
                          className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                        >
                          <Save className="h-3.5 w-3.5 mr-1.5" />
                          {saving ? 'Saving...' : existingLabels ? 'Update Labels' : 'Create Labels'}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </div>
              </div>
            </div>

            {/* Sidebar Cards */}
            <div className="space-y-6">
              {/* Quick Presets */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                  <div className="p-1.5 rounded-lg bg-indigo-50">
                    <Layers className="h-3.5 w-3.5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-gray-800">Quick Presets</h3>
                    <p className="text-[10px] text-gray-400">Load predefined configurations</p>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <button
                    onClick={() => loadPreset('school')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all duration-200 group"
                  >
                    <span className="text-sm font-semibold text-gray-700 group-hover:text-indigo-700">🏫 School</span>
                    <span className="text-[10px] font-mono text-gray-400 group-hover:text-indigo-500">Standard/Group/Section</span>
                  </button>
                  <button
                    onClick={() => loadPreset('college')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all duration-200 group"
                  >
                    <span className="text-sm font-semibold text-gray-700 group-hover:text-indigo-700">🎓 College</span>
                    <span className="text-[10px] font-mono text-gray-400 group-hover:text-indigo-500">Department/Year/Section</span>
                  </button>
                  <button
                    onClick={() => loadPreset('training')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all duration-200 group"
                  >
                    <span className="text-sm font-semibold text-gray-700 group-hover:text-indigo-700">📚 Training</span>
                    <span className="text-[10px] font-mono text-gray-400 group-hover:text-indigo-500">Course/Batch/Module</span>
                  </button>
                </div>
              </div>

              {/* Important Notes */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                  <div className="p-1.5 rounded-lg bg-indigo-50">
                    <Info className="h-3.5 w-3.5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-gray-800">Important Notes</h3>
                    <p className="text-[10px] text-gray-400">Things to keep in mind</p>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-start gap-2 text-xs text-gray-600">
                    <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Only one active structure is allowed per institution</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-gray-600">
                    <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Labels are used throughout the system dynamically</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-gray-600">
                    <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Changes will reflect immediately in all modules</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-gray-600">
                    <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                    <span>Use clear, meaningful names for better understanding</span>
                  </div>
                </div>
              </div>

              {/* Current Configuration (if exists) */}
              {existingLabels && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                    <div className="p-1.5 rounded-lg bg-indigo-50">
                      <CheckCircle className="h-3.5 w-3.5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-gray-800">Current Configuration</h3>
                      <p className="text-[10px] text-gray-400">Active academic structure</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Category:</span>
                      <span className="text-xs font-semibold text-gray-800">{existingLabels.category_label}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Subcategory:</span>
                      <span className="text-xs font-semibold text-gray-800">{existingLabels.subcategory_label}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Item:</span>
                      <span className="text-xs font-semibold text-gray-800">{existingLabels.item_label}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Status:</span>
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                        existingLabels.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${existingLabels.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {existingLabels.status}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
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
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold border border-emerald-200 text-[10px] uppercase tracking-wide flex items-center gap-1">
              <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Configured
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