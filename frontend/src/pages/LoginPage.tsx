import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, Eye, EyeOff, GraduationCap, Shield, ArrowRight, Sparkles } from 'lucide-react';
import { institutionsApi } from '@/lib/api';

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { signInWithEmail, user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  const form = useForm<LoginForm>({
    defaultValues: { email: '', password: '' },
  });

  const redirectByRole = (role?: string) => {
    if (role === 'admin' || role === 'ADMIN') {
      navigate('/admin');
    } else if (role === 'teacher' || role === 'TEACHER') {
      navigate('/teacher');
    } else {
      navigate('/');
    }
  };

  // ✅ FIX: Pass institutionId from setupData when redirecting to location setup
  const goToLocationSetup = (institutionId?: string, institutionName?: string) => {
    // Try to get institutionId from setupData in localStorage if not passed
    if (!institutionId) {
      const savedRaw = localStorage.getItem('setupData');
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        institutionId = saved?.institutionId;
        institutionName = institutionName || saved?.institutionName;
      }
    }

    navigate('/setup/location', {
      state: { institutionId, institutionName },
    });
  };

  // Auto-redirect if already logged in
  useEffect(() => {
    if (authLoading) return;

    const checkUser = async () => {
      if (!user) {
        setCheckingSetup(false);
        return;
      }

      try {
        const institution = await institutionsApi.get();
        if (institution?.is_setup_complete === 1) {
          redirectByRole(user.role);
        } else {
          // ✅ FIX: Pass institutionId from user object
          goToLocationSetup(user.institution_id);
        }
      } catch (error) {
        console.error('Error checking setup status:', error);
        setCheckingSetup(false);
      }
    };

    checkUser();
  }, [user, authLoading]);

  // Pre-fill email after OTP verification
  useEffect(() => {
    const verifiedEmail = localStorage.getItem('verifiedEmail');
    if (verifiedEmail) {
      form.setValue('email', verifiedEmail);
      localStorage.removeItem('verifiedEmail');
      toast.info('Please login with your credentials');
    }
  }, []);

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const res = await signInWithEmail(data.email, data.password);

      if (res.error) throw res.error;

      const loggedInUser = res.user;
      const role = loggedInUser?.role;

      if (role === 'STUDENT' || role === 'student') {
        toast.error('Students must use the mobile app 📱');
        setLoading(false);
        return;
      }

      toast.success('Login successful!');

      try {
        const institution = await institutionsApi.get();
        if (institution?.is_setup_complete === 1) {
          redirectByRole(role);
        } else {
          toast.info('Please complete the setup process');
          // ✅ FIX: Pass institutionId from the logged-in user
          goToLocationSetup(loggedInUser?.institution_id);
        }
      } catch (error) {
        console.error('Error fetching institution:', error);
        // ✅ FIX: Still try to pass institutionId from user even if institution fetch fails
        goToLocationSetup(loggedInUser?.institution_id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-3xl blur-2xl"></div>
          <Card className="w-full max-w-md border-0 shadow-2xl bg-white/80 backdrop-blur-lg">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
                <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
              </div>
              <p className="text-lg font-medium text-slate-700 mt-6">Loading your workspace...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        .login-root {
          font-family: 'DM Sans', sans-serif;
        }
        .login-root h1, .login-root h2, .login-root h3 {
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

      <div className="login-root min-h-screen flex items-center justify-center p-4 md:p-8 bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        <div className="w-full max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {/* Left Side - Branding & Features */}
            <div className="hidden lg:flex flex-col space-y-8 fade-up" style={{ animationDelay: '0ms' }}>
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
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome Back</h2>
                    <p className="text-slate-600">
                      Sign in to access your personalized dashboard, manage students, track attendance, and more.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/40 backdrop-blur-sm rounded-xl p-4 border border-white/60">
                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center mb-3">
                      <Shield className="h-5 w-5 text-indigo-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">Enterprise Security</p>
                    <p className="text-xs text-slate-500">Bank-grade encryption</p>
                  </div>
                  <div className="bg-white/40 backdrop-blur-sm rounded-xl p-4 border border-white/60">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                      <GraduationCap className="h-5 w-5 text-emerald-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">Smart Analytics</p>
                    <p className="text-xs text-slate-500">Real-time insights</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Login Form */}
            <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-sm rounded-2xl overflow-hidden fade-up" style={{ animationDelay: '100ms' }}>
              <CardHeader className="space-y-3 pb-6 pt-8 px-8">
                <div className="flex lg:hidden justify-center mb-2">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                    <GraduationCap className="w-6 h-6 text-white" />
                  </div>
                </div>
                <CardTitle className="text-3xl font-bold text-slate-800 text-center lg:text-left">
                  Welcome Back
                </CardTitle>
                <CardDescription className="text-base text-slate-500 text-center lg:text-left">
                  Sign in to continue to your dashboard
                </CardDescription>
              </CardHeader>

              <CardContent className="px-8 pb-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    <FormField
                      control={form.control}
                      name="email"
                      rules={{
                        required: 'Email is required',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Invalid email address',
                        },
                      }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-slate-700">
                            Email Address
                          </FormLabel>
                          <FormControl>
                            <div className="relative group">
                              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                              <Input
                                type="email"
                                placeholder="name@institution.edu"
                                className="pl-12 h-12 border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl text-base transition-all bg-white/80"
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
                      name="password"
                      rules={{ required: 'Password is required' }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold text-slate-700">
                            Password
                          </FormLabel>
                          <FormControl>
                            <div className="relative group">
                              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                              <Input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Enter your password"
                                className="pl-12 pr-12 h-12 border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl text-base transition-all bg-white/80"
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                              >
                                {showPassword ? (
                                  <EyeOff className="h-5 w-5" />
                                ) : (
                                  <Eye className="h-5 w-5" />
                                )}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage className="text-rose-600 text-sm" />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full h-12 text-base font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 group mt-2"
                      disabled={loading}
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Signing in...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          Sign In
                          <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      )}
                    </Button>

                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-white/80 text-slate-500">New to ETAM?</span>
                      </div>
                    </div>
                  </form>
                </Form>
              </CardContent>

              <CardFooter className="flex flex-col gap-4 pb-8 px-8">
                <Link
                  to="/register"
                  className="w-full h-12 flex items-center justify-center gap-2 border-2 border-slate-200 hover:border-indigo-500 rounded-xl font-semibold text-slate-700 hover:text-indigo-600 transition-all duration-300 group bg-white/60"
                >
                  Create New Account
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>

                <p className="text-center text-xs text-slate-400 mt-2">
                  © 2025 ETAM. All rights reserved.
                </p>
              </CardFooter>
            </Card>
          </div>

          {/* Footer Security Badge (visible on mobile) */}
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400 lg:hidden fade-up" style={{ animationDelay: '200ms' }}>
            <Shield className="w-3.5 h-3.5" />
            <span>Secured with enterprise-grade encryption</span>
          </div>
        </div>
      </div>
    </>
  );
}