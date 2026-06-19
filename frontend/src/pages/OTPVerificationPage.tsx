import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  Loader2, Mail, ArrowLeft, CheckCircle2, AlertCircle, Timer,
  RefreshCw, InboxIcon, Shield
} from 'lucide-react';

interface LocationState {
  email?: string;
  institutionId?: string;
  userId?: string;
  institutionName?: string;
  adminName?: string;
  phone?: string;
  fromRegistration?: boolean;
}

export default function OTPVerificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;

  // ============================================
  // STATE MANAGEMENT
  // ============================================
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [email, setEmail] = useState('');
  const [setupData, setSetupData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes
  const [canResend, setCanResend] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ============================================
  // EFFECT 1: Load email from state or localStorage
  // ============================================
  useEffect(() => {
    let data = state;

    if (!data?.email) {
      const savedData = localStorage.getItem('setupData');
      if (savedData) {
        data = JSON.parse(savedData);
        console.log('✅ Loaded from localStorage:', data);
      }
    }

    if (data?.email) {
      setEmail(data.email);
      setSetupData(data);
      console.log('✅ Setup data ready:', data);
    } else {
      toast.error('Email not found. Please register again.');
      navigate('/register');
    }
  }, [state, navigate]);

  // ============================================
  // EFFECT 2: Timer countdown
  // ============================================
  useEffect(() => {
    if (timeLeft > 0 && !canResend && verificationStatus !== 'success') {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !canResend && verificationStatus !== 'success') {
      setCanResend(true);
    }
  }, [timeLeft, canResend, verificationStatus]);

  // ============================================
  // EFFECT 3: Auto-send OTP when email is loaded
  // ============================================
  useEffect(() => {
    let isMounted = true;
    if (email && verificationStatus === 'idle' && !loading && !resendLoading && !otpSent) {
      const timer = setTimeout(() => {
        if (isMounted) sendOTP();
      }, 500);
      return () => clearTimeout(timer);
    }
    return () => { isMounted = false; };
  }, [email]);

  // ============================================
  // UTILITY: Format time (MM:SS)
  // ============================================
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ============================================
  // MAIN FUNCTION: Send OTP via Email
  // ============================================
  const sendOTP = async () => {
    if (!email) return;
    setLoading(true);
    try {
      await authApi.sendOTP({ email });
      setTimeLeft(1800);
      setCanResend(false);
      setErrorMessage('');
      setOtpSent(true);
      toast.success('✅ Verification code sent to your email!');
      console.log(`📧 OTP sent to: ${email}`);
    } catch (error) {
      console.error('❌ Send OTP error:', error);
      setErrorMessage('Failed to send verification code. Please check your email settings.');
      toast.error('Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // OTP Input Handler
  // ============================================
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').trim();
    if (/^\d{6}$/.test(pastedData)) {
      const otpArray = pastedData.split('');
      setOtp(otpArray);
      inputRefs.current[5]?.focus();
      toast.info('✅ OTP pasted successfully');
    } else {
      toast.error('❌ Please paste a valid 6-digit OTP');
    }
  };

  // ============================================
  // MAIN FUNCTION: Verify OTP
  // ============================================
  const verifyOTP = async () => {
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      toast.error('Please enter the complete 6-digit OTP');
      return;
    }

    setVerificationStatus('verifying');
    setLoading(true);
    setErrorMessage('');

    try {
      await authApi.verifyOTP({ email, otp: otpValue });
      setVerificationStatus('success');
      toast.success('✅ Email verified successfully!');

      // ✅ FIX: Clear setup data and mark as verified
      localStorage.setItem('verifiedEmail', email);
      localStorage.removeItem('setupData'); // clean up after successful verification

      console.log('🎉 Email verified, redirecting to login...');

      // ✅ FIX: Navigate to /login but pass a flag so RouteGuard
      //    knows NOT to redirect the user away immediately.
      //    We use `replace: true` so back-button can't return to OTP page.
      setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: { fromOTPVerification: true, verifiedEmail: email },
        });
      }, 1500);

    } catch (error) {
      setVerificationStatus('error');
      let errorMsg = 'Invalid OTP. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('expired')) errorMsg = 'OTP has expired. Please request a new one.';
        else if (error.message.includes('Invalid')) errorMsg = 'Invalid OTP. Please check and try again.';
        else errorMsg = error.message;
      }
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const resendOTP = async () => {
    if (!canResend) return;
    setResendLoading(true);
    setErrorMessage('');
    try {
      await authApi.resendOTP({ email });
      toast.success('✅ OTP resent successfully!');
      setTimeLeft(1800);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      setVerificationStatus('idle');
      setErrorMessage('');
      inputRefs.current[0]?.focus();
      console.log(`📧 New OTP sent to: ${email}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to resend OTP';
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
    } finally {
      setResendLoading(false);
    }
  };

  const goBack = () => {
    localStorage.removeItem('setupData');
    navigate('/register');
  };

  const isOtpComplete = otp.every(digit => digit !== '');

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8 bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="hidden sm:flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">Email Verification</span>
        </div>

        <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-sm rounded-2xl overflow-hidden">
          {/* Header */}
          <CardHeader className="space-y-3 pb-6 pt-8 px-8 text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <InboxIcon className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-800">Verify Your Email</CardTitle>
            <CardDescription className="text-base text-slate-500">
              We've sent a 6-digit code to
              <br />
              <span className="font-semibold text-indigo-600">{email}</span>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 px-8 pb-6">
            {/* OTP Input Fields */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-slate-700 text-center block">
                Enter Verification Code
              </Label>
              <div className="flex justify-center gap-2 sm:gap-3">
                {otp.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={index === 0 ? handlePaste : undefined}
                    className={`w-12 h-12 text-center text-xl font-bold rounded-xl border-2 transition-all duration-200 focus:ring-2 focus:ring-indigo-200
                      ${verificationStatus === 'error' ? 'border-rose-400 bg-rose-50 focus:ring-rose-200' : ''}
                      ${verificationStatus === 'success' ? 'border-emerald-400 bg-emerald-50 focus:ring-emerald-200' : 'border-slate-200 focus:border-indigo-400 bg-white/80'}
                    `}
                    autoFocus={index === 0}
                    disabled={loading || verificationStatus === 'success'}
                  />
                ))}
              </div>
              <p className="text-xs text-center text-slate-500">
                Enter the 6-digit code sent to your email. You can also paste it.
              </p>
            </div>

            {/* Timer & Resend */}
            <div className="flex justify-center items-center gap-2 text-sm bg-slate-50/80 backdrop-blur-sm p-3 rounded-xl border border-slate-100">
              <Timer className="h-4 w-4 text-indigo-500" />
              <span>
                {canResend ? (
                  <button
                    onClick={resendOTP}
                    disabled={resendLoading}
                    className="text-indigo-600 hover:text-indigo-700 font-semibold disabled:opacity-50 transition-colors flex items-center gap-1"
                  >
                    {resendLoading ? (
                      <><Loader2 className="h-3 w-3 animate-spin" /> Sending...</>
                    ) : (
                      <><RefreshCw className="h-3 w-3" /> Resend Code</>
                    )}
                  </button>
                ) : (
                  <span className="font-medium text-slate-700">
                    Code expires in <span className="text-indigo-600 font-bold">{formatTime(timeLeft)}</span>
                  </span>
                )}
              </span>
            </div>

            {/* Success Message */}
            {verificationStatus === 'success' && (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200 animate-in fade-in slide-in-from-bottom-4">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-700">Email verified successfully!</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Redirecting to login in a moment...</p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {verificationStatus === 'error' && errorMessage && (
              <div className="flex items-center gap-3 p-4 bg-rose-50 rounded-xl border border-rose-200 animate-in fade-in slide-in-from-bottom-4">
                <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-rose-700">Verification Failed</p>
                  <p className="text-xs text-rose-600 mt-0.5">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* OTP Not Sent Warning */}
            {!otpSent && !loading && (
              <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <p className="text-xs text-amber-700">
                  📧 Check your email (including spam folder) for the verification code
                </p>
              </div>
            )}

            {/* Verify Button */}
            <Button
              onClick={verifyOTP}
              disabled={loading || verificationStatus === 'success' || !isOtpComplete}
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Verifying...
                </div>
              ) : verificationStatus === 'success' ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Verified! Redirecting...
                </div>
              ) : (
                'Verify & Login'
              )}
            </Button>

            {/* Help Text */}
            <div className="text-center">
              <p className="text-xs text-slate-500 leading-relaxed">
                Didn't receive the code?{' '}
                {canResend ? (
                  <button
                    onClick={resendOTP}
                    disabled={resendLoading}
                    className="text-indigo-600 hover:text-indigo-700 font-semibold hover:underline"
                  >
                    Click here to resend
                  </button>
                ) : (
                  <span className="text-slate-400">
                    Wait {formatTime(timeLeft)} to resend or check your spam folder
                  </span>
                )}
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex justify-center pt-0 pb-8 px-8">
            <button
              onClick={goBack}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition-colors font-medium"
              disabled={loading}
            >
              <ArrowLeft className="h-4 w-4" /> Back to Registration
            </button>
          </CardFooter>
        </Card>

        {/* Security Badge */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Shield className="w-3.5 h-3.5" />
          <span>Secured with end-to-end encryption</span>
        </div>
      </div>
    </div>
  );
}