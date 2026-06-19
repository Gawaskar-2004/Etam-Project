import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { academicApi, institutionsApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Loader2, CheckCircle, Building2, Sparkles, ArrowRight, Shield, GraduationCap } from 'lucide-react';

interface AcademicForm {
  category: string;
  subcategory: string;
  item: string;
  attendanceMode: string;
}

export default function AcademicSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [institutionType, setInstitutionType] = useState('school');
  const [setupComplete, setSetupComplete] = useState(false);

  const state = location.state as any;
  const institutionId = state?.institutionId;

  useEffect(() => {
    let data = state;
    if (!data?.institutionId) {
      const savedData = localStorage.getItem('setupData');
      if (savedData) {
        data = JSON.parse(savedData);
      }
    }
    
    // ✅ Only check for institutionId — branchId is no longer part of the flow
    if (!data?.institutionId) {
      console.log('No setup data found, redirecting to login');
      toast.error('Session expired. Please login again.');
      navigate('/login');
      return;
    }
    
    institutionsApi.get()
      .then((inst: any) => { 
        if (inst?.type) setInstitutionType(inst.type); 
      })
      .catch(() => {});
  }, [institutionId, navigate, state]);

  const getDefaults = (type = institutionType) => {
    switch (type) {
      case 'school':   
        return { category: 'Class', subcategory: 'Section', item: '', modes: ['daily', 'period'] };
      case 'college':  
        return { category: 'Department', subcategory: 'Year', item: 'Section', modes: ['period'] };
      case 'training': 
        return { category: 'Course', subcategory: 'Batch', item: '', modes: ['session'] };
      default:         
        return { category: '', subcategory: '', item: '', modes: ['daily'] };
    }
  };

  const form = useForm<AcademicForm>({
    defaultValues: {
      category: getDefaults().category,
      subcategory: getDefaults().subcategory,
      item: getDefaults().item,
      attendanceMode: getDefaults().modes[0],
    },
  });

  useEffect(() => {
    const d = getDefaults(institutionType);
    form.setValue('category', d.category);
    form.setValue('subcategory', d.subcategory);
    form.setValue('item', d.item);
    form.setValue('attendanceMode', d.modes[0]);
  }, [institutionType, form]);

  const onSubmit = async (data: AcademicForm) => {
    setLoading(true);
    try {
      await academicApi.upsertLabels({
        category_label: data.category,
        subcategory_label: data.subcategory,
        item_label: data.item || data.subcategory,
      });

      await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/attendance/settings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
          body: JSON.stringify({ attendance_type: data.attendanceMode }),
        }
      );

      await institutionsApi.update({ is_setup_complete: true });
      
      setSetupComplete(true);
      toast.success('Setup completed successfully!');
      
      localStorage.removeItem('setupData');
      
      setTimeout(() => {
        signOut();
        navigate('/login', { replace: true });
      }, 2000);
      
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to complete setup');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'h-12 w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-base placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all duration-200';
  const selectClass = 'h-12 w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-base focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all duration-200';
  const modes = getDefaults().modes;

  if (setupComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 md:p-8 bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        <Card className="w-full max-w-md border-0 shadow-2xl bg-white/90 backdrop-blur-sm rounded-2xl">
          <CardContent className="pt-8 text-center">
            <div className="mx-auto w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-10 w-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-emerald-600 mb-2">Setup Complete!</h2>
            <p className="text-slate-600 mb-4">Your institution has been successfully configured.</p>
            <p className="text-sm text-slate-500">Redirecting to login page...</p>
            <Loader2 className="h-5 w-5 animate-spin mx-auto mt-4 text-indigo-600" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const typeConfig = {
    school: { icon: '🏫', label: 'School', color: 'from-blue-500 to-indigo-600' },
    college: { icon: '🎓', label: 'College', color: 'from-purple-500 to-pink-600' },
    training: { icon: '📚', label: 'Training', color: 'from-emerald-500 to-teal-600' },
  }[institutionType] || { icon: '🏛️', label: 'Institution', color: 'from-slate-500 to-slate-700' };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8 bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="w-full max-w-2xl">
        <div className="hidden sm:flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">ETAM Setup</span>
        </div>

        <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-sm rounded-2xl overflow-hidden">
          <CardHeader className="space-y-4 pb-6 pt-8 px-8">
            <div className="mb-2">
              <Progress value={100} className="h-2 bg-slate-100 [&>div]:bg-gradient-to-r [&>div]:from-indigo-600 [&>div]:to-blue-600" />
              <p className="text-xs text-slate-500 mt-2 text-right">Step 2 of 2: Academic Structure</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100">
                <Building2 className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-slate-800">Academic Structure</CardTitle>
                <CardDescription className="text-base text-slate-500 mt-1">
                  Define the academic hierarchy for your {typeConfig.label}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-8 pb-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                <FormField 
                  control={form.control} 
                  name="category" 
                  rules={{ required: 'Category is required' }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">Category Label</FormLabel>
                      <FormControl>
                        <input {...field} className={inputClass} placeholder={`e.g., ${getDefaults(institutionType).category}`} />
                      </FormControl>
                      <FormDescription className="text-xs text-slate-500">
                        The highest level of academic grouping (e.g., Class, Department, Course)
                      </FormDescription>
                      <FormMessage className="text-rose-600 text-sm" />
                    </FormItem>
                  )}
                />

                <FormField 
                  control={form.control} 
                  name="subcategory" 
                  rules={{ required: 'Subcategory is required' }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">Subcategory Label</FormLabel>
                      <FormControl>
                        <input {...field} className={inputClass} placeholder={`e.g., ${getDefaults(institutionType).subcategory}`} />
                      </FormControl>
                      <FormDescription className="text-xs text-slate-500">
                        Secondary level (e.g., Section, Year, Batch)
                      </FormDescription>
                      <FormMessage className="text-rose-600 text-sm" />
                    </FormItem>
                  )}
                />

                {institutionType === 'college' && (
                  <FormField 
                    control={form.control} 
                    name="item"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-slate-700">Item Label (Optional)</FormLabel>
                        <FormControl>
                          <input {...field} className={inputClass} placeholder="e.g., Section" />
                        </FormControl>
                        <FormDescription className="text-xs text-slate-500">
                          Third level (if applicable)
                        </FormDescription>
                        <FormMessage className="text-rose-600 text-sm" />
                      </FormItem>
                    )}
                  />
                )}

                <FormField 
                  control={form.control} 
                  name="attendanceMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">Attendance Mode</FormLabel>
                      <FormControl>
                        <select {...field} className={selectClass}>
                          {modes.map(mode => (
                            <option key={mode} value={mode}>
                              {mode === 'daily' ? '📅 Daily Attendance' : 
                               mode === 'period' ? '⏰ Period-wise Attendance' : 
                               mode === 'session' ? '📚 Session-based Attendance' : mode}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormDescription className="text-xs text-slate-500">
                        {institutionType === 'school' && 'Choose daily or period-based attendance'}
                        {institutionType === 'college' && 'College attendance is period-wise'}
                        {institutionType === 'training' && 'Training attendance is session-based'}
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <div className="flex gap-4 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => navigate('/setup/location')} 
                    disabled={loading}
                    className="h-12 flex-1 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all"
                  >
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={loading} 
                    className="flex-1 h-12 text-base font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 group"
                  >
                    {loading ? (
                      <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Completing Setup...</>
                    ) : (
                      <div className="flex items-center gap-2">
                        Complete Setup
                        <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                      </div>
                    )}
                  </Button>
                </div>

              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Shield className="w-3.5 h-3.5" />
          <span>Your data is encrypted and secure</span>
        </div>
      </div>
    </div>
  );
}