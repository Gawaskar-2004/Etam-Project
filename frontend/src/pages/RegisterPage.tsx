import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { authApi, setToken } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';
import {
  Loader2, Mail, Building2, Lock, Eye, EyeOff, AtSign,
  GraduationCap, Shield, Sparkles, ArrowRight, CheckCircle,
} from 'lucide-react';

const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+1',  flag: '🇺🇸', name: 'USA/Canada' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: '+60', flag: '🇲🇾', name: 'Malaysia' },
  { code: '+94', flag: '🇱🇰', name: 'Sri Lanka' },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: '+92', flag: '🇵🇰', name: 'Pakistan' },
  { code: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: '+33', flag: '🇫🇷', name: 'France' },
  { code: '+81', flag: '🇯🇵', name: 'Japan' },
  { code: '+86', flag: '🇨🇳', name: 'China' },
  { code: '+55', flag: '🇧🇷', name: 'Brazil' },
];

interface RegistrationForm {
  institutionName: string;
  institutionType: string;
  primaryEmail: string;
  alternateEmail?: string;
  primaryPhone: string;
  alternatePhone?: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [primaryCountryCode, setPrimaryCountryCode] = useState('+91');
  const [alternateCountryCode, setAlternateCountryCode] = useState('+91');

  const form = useForm<RegistrationForm>({
    defaultValues: {
      institutionName: '',
      institutionType: 'school',
      primaryEmail: '',
      alternateEmail: '',
      primaryPhone: '',
      alternatePhone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: RegistrationForm) => {
    if (data.password !== data.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (data.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const result = await authApi.register({
        email: data.primaryEmail,
        password: data.password,
        phone: `${primaryCountryCode}${data.primaryPhone}`,
        alternate_email: data.alternateEmail,
        alternate_phone: data.alternatePhone ? `${alternateCountryCode}${data.alternatePhone}` : '',
        institution_name: data.institutionName,
        institution_type: data.institutionType,
      });

      console.log('Registration result:', result);
      setToken(result.token);
      toast.success('Account created successfully!');

      await authApi.sendOTP({ email: data.primaryEmail });
      toast.info('Verification code sent to your email');

      const setupData = {
        email: data.primaryEmail,
        institutionId: result.institution_id || result.user?.institution_id || result.data?.institution_id,
        userId: result.user?.id || result.data?.user?.id,
        institutionName: data.institutionName,
        primaryPhone: data.primaryPhone,
        alternateEmail: data.alternateEmail,
        alternatePhone: data.alternatePhone,
        fromRegistration: true,
      };
      
      localStorage.setItem('setupData', JSON.stringify(setupData));
      console.log('Saved setup data to localStorage:', setupData);

      navigate('/otp-verification', {
        state: setupData,
        replace: true,
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong';
      console.error('Registration error:', error);

      if (message.toLowerCase().includes('otp') || message.toLowerCase().includes('verification')) {
        toast.error('Account created but failed to send OTP. Please use Resend on the next page.');
        
        const setupData = {
          email: data.primaryEmail,
          fromRegistration: true,
        };
        localStorage.setItem('setupData', JSON.stringify(setupData));
        
        navigate('/otp-verification', {
          state: setupData,
          replace: true,
        });
      } else {
        toast.error(message);
        setLoading(false);
      }
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        .register-root {
          font-family: 'DM Sans', sans-serif;
        }
        .register-root h1, .register-root h2, .register-root h3 {
          font-family: 'Sora', sans-serif;
        }
        .fade-up {
          animation: fadeUp 0.45s ease both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="register-root min-h-screen flex items-center justify-center p-4 md:p-8 bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        <div className="w-full max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            {/* Left Side - Branding & Benefits */}
            <div className="hidden lg:flex flex-col space-y-8 sticky top-8 fade-up" style={{ animationDelay: '0ms' }}>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl">
                  <GraduationCap className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                  ETAM
                </h1>
              </div>
              <div className="space-y-6">
                <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur-xl opacity-30"></div>
                  <div className="relative bg-white/40 backdrop-blur-sm rounded-2xl p-8 border border-white/60">
                    <Sparkles className="h-10 w-10 text-indigo-500 mb-4" strokeWidth={1.5} />
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Get Started with ETAM</h2>
                    <p className="text-slate-600">
                      Join thousands of institutions managing attendance, timetables, and student data seamlessly.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/40 backdrop-blur-sm rounded-xl p-4 border border-white/60">
                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center mb-3">
                      <Shield className="h-5 w-5 text-indigo-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">Secure & Compliant</p>
                    <p className="text-xs text-slate-500">Data encryption at rest</p>
                  </div>
                  <div className="bg-white/40 backdrop-blur-sm rounded-xl p-4 border border-white/60">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                      <CheckCircle className="h-5 w-5 text-emerald-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">Easy Setup</p>
                    <p className="text-xs text-slate-500">Get running in minutes</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Registration Form */}
            <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-sm rounded-2xl overflow-hidden fade-up" style={{ animationDelay: '100ms' }}>
              <CardHeader className="space-y-3 pb-6 pt-8 px-8">
                <div className="flex lg:hidden justify-center mb-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                    <GraduationCap className="w-6 h-6 text-white" />
                  </div>
                </div>
                <CardTitle className="text-3xl font-bold text-slate-800 text-center lg:text-left">
                  Create Account
                </CardTitle>
                <CardDescription className="text-base text-slate-500 text-center lg:text-left">
                  Register your institution and get started
                </CardDescription>
              </CardHeader>

              <CardContent className="px-8 pb-8">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Institution Section */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-indigo-600 uppercase tracking-wide">Institution Details</h3>
                      
                      <FormField
                        control={form.control}
                        name="institutionName"
                        rules={{ required: 'Institution name is required' }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-slate-700">Institution Name</FormLabel>
                            <FormControl>
                              <div className="relative group">
                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                <Input
                                  className="pl-12 h-12 border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl text-base transition-all bg-white/80"
                                  placeholder="Enter institution name"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-rose-600 text-sm" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="institutionType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-slate-700">Institution Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl text-base transition-all bg-white/80">
                                  <SelectValue placeholder="Select institution type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="school">🏫 School</SelectItem>
                                <SelectItem value="college">🎓 College</SelectItem>
                                <SelectItem value="training">📚 Training Institution</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Contact Section */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-indigo-600 uppercase tracking-wide">Contact Information</h3>
                      
                      <FormField
                        control={form.control}
                        name="primaryEmail"
                        rules={{
                          required: 'Primary email is required',
                          pattern: {
                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                            message: 'Invalid email address',
                          },
                        }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-slate-700">Primary Email</FormLabel>
                            <FormControl>
                              <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                <Input
                                  type="email"
                                  className="pl-12 h-12 border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl text-base transition-all bg-white/80"
                                  placeholder="admin@institution.edu"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-rose-600 text-sm" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="alternateEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-slate-700">Alternate Email (Optional)</FormLabel>
                            <FormControl>
                              <div className="relative group">
                                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                <Input
                                  type="email"
                                  className="pl-12 h-12 border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl text-base transition-all bg-white/80"
                                  placeholder="alternate@example.com"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-rose-600 text-sm" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="primaryPhone"
                        rules={{
                          required: 'Primary phone number is required',
                          pattern: { value: /^\d{6,15}$/, message: 'Enter digits only (6-15)' },
                        }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-slate-700">Primary Phone Number</FormLabel>
                            <FormControl>
                              <div className="flex gap-2">
                                <Select value={primaryCountryCode} onValueChange={setPrimaryCountryCode}>
                                  <SelectTrigger className="w-32 h-12 border-slate-200 focus:border-indigo-400 rounded-xl bg-white/80 shrink-0">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-60">
                                    {COUNTRY_CODES.map(c => (
                                      <SelectItem key={c.code} value={c.code}>
                                        {c.flag} {c.code}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="tel"
                                  className="h-12 border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl text-base transition-all bg-white/80"
                                  placeholder="98765 43210"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-rose-600 text-sm" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="alternatePhone"
                        rules={{
                          pattern: { value: /^\d{6,15}$/, message: 'Enter digits only (6-15)' },
                        }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-slate-700">Alternate Phone (Optional)</FormLabel>
                            <FormControl>
                              <div className="flex gap-2">
                                <Select value={alternateCountryCode} onValueChange={setAlternateCountryCode}>
                                  <SelectTrigger className="w-32 h-12 border-slate-200 focus:border-indigo-400 rounded-xl bg-white/80 shrink-0">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-60">
                                    {COUNTRY_CODES.map(c => (
                                      <SelectItem key={c.code} value={c.code}>
                                        {c.flag} {c.code}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="tel"
                                  className="h-12 border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl text-base transition-all bg-white/80"
                                  placeholder="Alternate contact number"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage className="text-rose-600 text-sm" />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Security Section */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-indigo-600 uppercase tracking-wide">Security</h3>
                      
                      <FormField
                        control={form.control}
                        name="password"
                        rules={{
                          required: 'Password is required',
                          minLength: { value: 6, message: 'Password must be at least 6 characters' },
                        }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-slate-700">Password</FormLabel>
                            <FormControl>
                              <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                <Input
                                  type={showPassword ? 'text' : 'password'}
                                  className="pl-12 pr-12 h-12 border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl text-base transition-all bg-white/80"
                                  placeholder="Create a password (min 6 characters)"
                                  {...field}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                                >
                                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage className="text-rose-600 text-sm" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="confirmPassword"
                        rules={{ required: 'Please confirm your password' }}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-semibold text-slate-700">Confirm Password</FormLabel>
                            <FormControl>
                              <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                <Input
                                  type={showConfirmPassword ? 'text' : 'password'}
                                  className="pl-12 pr-12 h-12 border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl text-base transition-all bg-white/80"
                                  placeholder="Confirm your password"
                                  {...field}
                                />
                                <button
                                  type="button"
 onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                                >
                                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                              </div>
                            </FormControl>
                            <FormMessage className="text-rose-600 text-sm" />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 text-base font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 group"
                      disabled={loading}
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Creating account...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          Create Account & Verify Email
                          <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      )}
                    </Button>

                    <div className="text-center text-sm text-slate-500">
                      Already have an account?{' '}
                      <Button
                        variant="link"
                        className="p-0 text-indigo-600 font-semibold hover:text-indigo-700"
                        onClick={() => navigate('/login')}
                      >
                        Login here
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          {/* Mobile Security Badge */}
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400 lg:hidden fade-up" style={{ animationDelay: '200ms' }}>
            <Shield className="w-3.5 h-3.5" />
            <span>Secured with enterprise-grade encryption</span>
          </div>
        </div>
      </div>
    </>
  );
}