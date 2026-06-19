// LoginScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  ScrollView, StatusBar, Alert, Animated, Platform, KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';

// ─────────────────────────────────────────────────────────────────────────────
// Theme tokens
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  bg:      '#F0F4FF',
  surface: '#FFFFFF',
  border:  '#E8EEFF',
  textPri: '#0D1B3E',
  textSec: '#5A6A8A',
  textMut: '#96A5C0',
  indigo:  '#4F46E5',
  indigoLt:'#EEF2FF',
  green:   '#059669',
  greenLt: '#D1FAE5',
  red:     '#EF4444',
  redLt:   '#FFF1F1',
  slateLt: '#F1F5F9',
  amber:   '#D97706',
  amberLt: '#FFFBEB',
  radius:  { sm:8, md:12, lg:16, xl:20, pill:999 },
  shadow:  {
    sm: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:2},  shadowOpacity:0.06, shadowRadius:6,  elevation:2 },
    md: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:4},  shadowOpacity:0.10, shadowRadius:12, elevation:4 },
    lg: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:8},  shadowOpacity:0.14, shadowRadius:20, elevation:8 },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Password strength
// ─────────────────────────────────────────────────────────────────────────────
const getStrength = (pw) => [
  pw.length >= 8,
  /[A-Z]/.test(pw),
  /[0-9]/.test(pw),
  /[^A-Za-z0-9]/.test(pw),
].filter(Boolean).length;

const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLOR = ['', '#EF4444', '#F97316', '#EAB308', '#059669'];

// ─────────────────────────────────────────────────────────────────────────────
// sanitizeUser — forces must_change_password=0 so App.js never re-routes
// ─────────────────────────────────────────────────────────────────────────────
const sanitizeUser = (user) => ({
  ...user,
  must_change_password: 0,
  requires_password_change: false,
});

// ─────────────────────────────────────────────────────────────────────────────
// Reusable UI components
// ─────────────────────────────────────────────────────────────────────────────
const Field = ({
  label, icon, value, onChange, placeholder,
  secure, onToggleSecure, showToggle,
  keyboard = 'default', error, editable = true,
}) => (
  <View style={{ marginBottom: 18 }}>
    <Text style={{ fontSize:12, fontWeight:'600', color:T.textSec, marginBottom:6 }}>{label}</Text>
    <View style={{
      flexDirection:'row', alignItems:'center',
      backgroundColor: error ? T.redLt : T.slateLt,
      borderRadius:T.radius.lg, paddingHorizontal:14,
      borderWidth:1, borderColor: error ? T.red : T.border,
      opacity: editable ? 1 : 0.6,
    }}>
      {icon}
      <TextInput
        style={{ flex:1, paddingVertical:14, fontSize:15, color:T.textPri }}
        placeholder={placeholder}
        placeholderTextColor={T.textMut}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        keyboardType={keyboard}
        autoCapitalize="none"
        autoCorrect={false}
        editable={editable}
      />
      {showToggle && (
        <TouchableOpacity onPress={onToggleSecure} style={{ padding:4 }}>
          <Ionicons name={secure ? 'eye-outline' : 'eye-off-outline'} size={20} color={T.textSec} />
        </TouchableOpacity>
      )}
    </View>
    {!!error && <Text style={{ fontSize:11, color:T.red, marginTop:4, marginLeft:2 }}>{error}</Text>}
  </View>
);

const ErrorBanner = ({ message }) => {
  if (!message) return null;
  return (
    <View style={{
      flexDirection:'row', alignItems:'center', gap:8,
      backgroundColor:T.redLt, borderRadius:T.radius.lg,
      padding:12, marginBottom:18,
      borderWidth:1, borderColor:'#FECACA',
    }}>
      <Ionicons name="alert-circle" size={18} color={T.red} />
      <Text style={{ flex:1, fontSize:13, color:T.red, fontWeight:'500' }}>{message}</Text>
    </View>
  );
};

const SuccessBanner = ({ message }) => {
  if (!message) return null;
  return (
    <View style={{
      flexDirection:'row', alignItems:'center', gap:8,
      backgroundColor:T.greenLt, borderRadius:T.radius.lg,
      padding:12, marginBottom:18,
      borderWidth:1, borderColor:'#A7F3D0',
    }}>
      <Ionicons name="checkmark-circle" size={18} color={T.green} />
      <Text style={{ flex:1, fontSize:13, color:T.green, fontWeight:'500' }}>{message}</Text>
    </View>
  );
};

const InfoBanner = ({ message }) => {
  if (!message) return null;
  return (
    <View style={{
      flexDirection:'row', alignItems:'center', gap:8,
      backgroundColor:T.amberLt, borderRadius:T.radius.lg,
      padding:12, marginBottom:18,
      borderWidth:1, borderColor:'#FDE68A',
    }}>
      <Ionicons name="information-circle" size={18} color={T.amber} />
      <Text style={{ flex:1, fontSize:13, color:T.amber, fontWeight:'500' }}>{message}</Text>
    </View>
  );
};

const Decorations = () => (
  <>
    <View style={{ position:'absolute', top:-40,    right:-40, width:180, height:180, borderRadius:90,  borderWidth:1, borderColor:'rgba(255,255,255,0.06)' }} />
    <View style={{ position:'absolute', top:80,     right:30,  width:80,  height:80,  borderRadius:40,  borderWidth:1, borderColor:'rgba(255,255,255,0.06)' }} />
    <View style={{ position:'absolute', bottom:60,  left:-30,  width:140, height:140, borderRadius:70,  backgroundColor:'rgba(255,255,255,0.04)' }} />
    <View style={{ position:'absolute', bottom:120, right:-20, width:100, height:100, borderRadius:50,  backgroundColor:'rgba(255,255,255,0.03)' }} />
  </>
);

const Footer = () => (
  <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', marginTop:24, gap:6 }}>
    <Ionicons name="shield-checkmark-outline" size={13} color="rgba(255,255,255,0.45)" />
    <Text style={{ color:'rgba(255,255,255,0.45)', fontSize:11, fontWeight:'600' }}>ETAM v1.0 · Secure Login</Text>
  </View>
);

const OtpInput = ({ value, onChange }) => {
  const digits = (value + '      ').slice(0, 6).split('');
  return (
    <View style={{ flexDirection:'row', gap:10, justifyContent:'center', marginBottom:24 }}>
      {digits.map((d, i) => (
        <View key={i} style={{
          width:44, height:54, borderRadius:T.radius.lg,
          backgroundColor: T.slateLt,
          borderWidth: 2,
          borderColor: d.trim() ? T.indigo : T.border,
          alignItems:'center', justifyContent:'center',
        }}>
          <Text style={{ fontSize:22, fontWeight:'800', color:T.textPri }}>{d.trim()}</Text>
        </View>
      ))}
      <TextInput
        style={{ position:'absolute', top:0, left:0, right:0, bottom:0, opacity:0 }}
        value={value}
        onChangeText={t => onChange(t.replace(/[^0-9]/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
      />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
const LoginScreen = ({ onLogin }) => {
  // screen values: 'login' | 'setPassword' | 'success' |
  //                'forgotEmail' | 'forgotOtp' | 'forgotNewPass' | 'forgotSuccess'
  const [screen, setScreen] = useState('login');

  // ── Login ──
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError,   setLoginError]   = useState('');

  // ── Set-password (first login) ──
  const [newPass,        setNewPass]        = useState('');
  const [confirmPass,    setConfirmPass]    = useState('');
  const [showNew,        setShowNew]        = useState(false);
  const [showConfirm,    setShowConfirm]    = useState(false);
  const [setPassLoading, setSetPassLoading] = useState(false);
  const [setPassError,   setSetPassError]   = useState('');
  const [newPassError,   setNewPassError]   = useState('');
  const [confirmError,   setConfirmError]   = useState('');

  // ── Forgot password ──
  const [forgotEmail,        setForgotEmail]        = useState('');
  const [forgotEmailError,   setForgotEmailError]   = useState('');
  const [forgotEmailLoading, setForgotEmailLoading] = useState(false);
  const [emailSentSuccess,   setEmailSentSuccess]   = useState(false);

  const [otp,           setOtp]           = useState('');
  const [otpError,      setOtpError]      = useState('');
  const [otpLoading,    setOtpLoading]    = useState(false);
  const [resendCool,    setResendCool]    = useState(0);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const [resetPass,         setResetPass]         = useState('');
  const [resetConfirm,      setResetConfirm]      = useState('');
  const [showResetPass,     setShowResetPass]     = useState(false);
  const [showResetConfirm,  setShowResetConfirm]  = useState(false);
  const [resetPassError,    setResetPassError]    = useState('');
  const [resetConfirmError, setResetConfirmError] = useState('');
  const [resetLoading,      setResetLoading]      = useState(false);
  const [resetError,        setResetError]        = useState('');

  // ── Refs ──
  const resetTokenRef  = useRef(null);
  const resendTimer    = useRef(null);
  const pendingUser    = useRef(null);
  const pendingToken   = useRef(null);

  // ── Animations ──
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(28);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue:1, duration:480, useNativeDriver:true }),
      Animated.spring(slideAnim, { toValue:0, tension:55, friction:8, useNativeDriver:true }),
    ]).start();
  }, [screen]);

  useEffect(() => {
    if (resendCool > 0) {
      resendTimer.current = setTimeout(() => setResendCool(c => c - 1), 1000);
    }
    return () => clearTimeout(resendTimer.current);
  }, [resendCool]);

  // ─────────────────────────────────────────────────────────────
  // STEP 1: Login
  // ─────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setLoginError('');
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) { setLoginError('Please enter your email address.'); return; }
    if (!password)     { setLoginError('Please enter your password.'); return; }

    setLoginLoading(true);
    try {
      const data = await api.post('/auth/login', {
        email:    trimmedEmail,
        password: password,
      });

      if (data.user?.role === 'admin') {
        setLoginLoading(false);
        Alert.alert('Admin Access', 'Please use the web portal to manage the system.', [{ text: 'OK' }]);
        return;
      }

      const serverWantsChange = data.requires_password_change === true;
      const userNeedsChange   = Number(data.user?.must_change_password) === 1;

      console.log('[Login] requires_password_change:', serverWantsChange, '| must_change_password:', userNeedsChange);

      if (serverWantsChange || userNeedsChange) {
        const alreadySet = await AsyncStorage.getItem(`pwd_set_${trimmedEmail}`).catch(() => null);
        if (alreadySet === '1') {
          console.log('[Login] pwd_set flag found — skipping set-password screen');
          setLoginLoading(false);
          onLogin(data.token, sanitizeUser(data.user));
          return;
        }
        pendingUser.current  = data.user;
        pendingToken.current = data.token;
        setLoginLoading(false);
        setScreen('setPassword');
        return;
      }

      setLoginLoading(false);
      onLogin(data.token, sanitizeUser(data.user));

    } catch (error) {
      const msg = error.message || '';
      if (
        msg.toLowerCase().includes('no password') ||
        msg.toLowerCase().includes('not set') ||
        msg.toLowerCase().includes('account not activated')
      ) {
        setLoginLoading(false);
        setScreen('setPassword');
        return;
      }
      setLoginError(
        msg.includes('credentials') || msg.includes('password') || msg.includes('Invalid')
          ? 'Incorrect email or password. Please try again.'
          : msg || 'Login failed. Please try again.'
      );
      setLoginLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // STEP 2: Set new password (first login)
  // ─────────────────────────────────────────────────────────────
  const handleSetPassword = async () => {
    setNewPassError('');
    setConfirmError('');
    setSetPassError('');

    let valid = true;
    if (!newPass) {
      setNewPassError('Please enter a new password.'); valid = false;
    } else if (newPass.length < 8) {
      setNewPassError('Password must be at least 8 characters.'); valid = false;
    }
    if (!confirmPass) {
      setConfirmError('Please confirm your password.'); valid = false;
    } else if (newPass !== confirmPass) {
      setConfirmError('Passwords do not match.'); valid = false;
    }
    if (!valid) return;

    const trimmedEmail = email.trim().toLowerCase();
    const userId       = pendingUser.current?.id;

    setSetPassLoading(true);

    try {
      const payload = { email: trimmedEmail, new_password: newPass };
      if (userId) payload.user_id = userId;

      await api.post('/auth/set-password-by-email', payload);

      let savedToken = pendingToken.current;
      let savedUser  = sanitizeUser(pendingUser.current || { email: trimmedEmail });

      if (!savedToken) {
        console.log('[SetPassword] No pending token — doing fresh login after set-password');
        try {
          const loginData = await api.post('/auth/login', {
            email:    trimmedEmail,
            password: newPass,
          });
          savedToken = loginData.token;
          savedUser  = sanitizeUser(loginData.user);
        } catch (loginErr) {
          console.error('[SetPassword] Fresh login failed:', loginErr.message);
          setSetPassError('Password set! Please log in with your new password.');
          setSetPassLoading(false);
          setTimeout(() => {
            setScreen('login');
            setPassword('');
          }, 2000);
          return;
        }
      }

      pendingUser.current  = null;
      pendingToken.current = null;

      await AsyncStorage.setItem(`pwd_set_${trimmedEmail}`, '1').catch(() => {});
      console.log('[SetPassword] pwd_set flag saved for', trimmedEmail);

      setSetPassLoading(false);
      setScreen('success');

      setTimeout(() => {
        onLogin(savedToken, savedUser);
      }, 1800);

    } catch (error) {
      setSetPassLoading(false);
      const msg = error.message || '';
      setSetPassError(msg || 'Failed to set password. Please try again.');
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Forgot Step 1 — Send OTP email
  // ─────────────────────────────────────────────────────────────
  const handleForgotSubmitEmail = async () => {
    setForgotEmailError('');
    const trimmed = forgotEmail.trim().toLowerCase();

    if (!trimmed) {
      setForgotEmailError('Please enter your email address.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(trimmed)) {
      setForgotEmailError('Please enter a valid email address.');
      return;
    }

    setForgotEmailLoading(true);
    setEmailSentSuccess(false);

    try {
      await api.post('/auth/forgot-password', { email: trimmed });

      setForgotEmailLoading(false);
      setOtp('');
      setOtpError('');
      setResendCool(60);
      setResendSuccess(false);
      setEmailSentSuccess(true);
      setScreen('forgotOtp');

    } catch (err) {
      setForgotEmailLoading(false);
      const msg = (err.message || '').toLowerCase();

      if (msg.includes('smtp') || msg.includes('email') || msg.includes('send')) {
        setForgotEmailError(
          'Could not send the reset email. This is a server issue — please try again in a moment or contact your admin.'
        );
      } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('connect') || msg.includes('timeout')) {
        setForgotEmailError('Unable to connect. Please check your internet connection and try again.');
      } else {
        setForgotEmailError(err.message || 'Something went wrong. Please try again.');
      }
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Forgot Step 2 — Verify OTP
  // FIX: Changed endpoint from /auth/verify-otp → /auth/verify-reset-otp
  //      to avoid conflict with the registration email-verification route.
  // ─────────────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    setOtpError('');
    if (otp.length < 6) {
      setOtpError('Please enter the complete 6-digit code.');
      return;
    }

    setOtpLoading(true);
    try {
      const trimmedEmail = forgotEmail.trim().toLowerCase();
      console.log('[VerifyOTP] Sending OTP verify for email:', trimmedEmail, 'otp:', otp);

      // FIX: Use /auth/verify-reset-otp (not /auth/verify-otp which is for registration)
      const data = await api.post('/auth/verify-reset-otp', {
        email: trimmedEmail,
        otp:   otp,
      });

      if (!data.reset_token) {
        console.warn('[VerifyOTP] No reset_token in response:', data);
        setOtpError('Verification failed. Please request a new code.');
        setOtpLoading(false);
        return;
      }

      resetTokenRef.current = data.reset_token;
      setOtpLoading(false);
      setResetPass('');
      setResetConfirm('');
      setResetPassError('');
      setResetConfirmError('');
      setResetError('');
      setScreen('forgotNewPass');

    } catch (err) {
      setOtpLoading(false);
      const msg = (err.message || '').toLowerCase();
      console.error('[VerifyOTP] Error:', err.message);

      if (msg.includes('expired')) {
        setOtpError('This code has expired. Please tap "Resend" to get a new one.');
      } else if (msg.includes('invalid') || msg.includes('incorrect') || msg.includes('wrong')) {
        setOtpError('Incorrect code. Please check and try again, or request a new code.');
      } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) {
        setOtpError('Network error. Please check your connection and try again.');
      } else {
        setOtpError(err.message || 'Incorrect or expired code. Please try again.');
      }
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Forgot — Resend OTP
  // FIX: Uses /auth/forgot-password — now properly registered on the server.
  // ─────────────────────────────────────────────────────────────
  const handleResendOtp = async () => {
    if (resendCool > 0 || resendLoading) return;
    setOtpError('');
    setResendSuccess(false);
    setResendLoading(true);

    const trimmed = forgotEmail.trim().toLowerCase();
    try {
      // This now works because /auth/forgot-password is registered in routes/index.js
      await api.post('/auth/forgot-password', { email: trimmed });
      setResendSuccess(true);
      setOtp('');
      console.log('[ResendOTP] ✅ Resent OTP to:', trimmed);
    } catch (err) {
      const msg = (err.message || '').toLowerCase();
      console.error('[ResendOTP] Error:', err.message);

      if (msg.includes('smtp') || msg.includes('email') || msg.includes('send')) {
        setOtpError('Failed to send the code — server email issue. Please try again or contact your admin.');
      } else {
        setOtpError('Failed to resend the code. Please check your connection and try again.');
      }
    } finally {
      setResendLoading(false);
      setResendCool(60);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Forgot: Step 3 — set new password
  // ─────────────────────────────────────────────────────────────
  const handleResetPassword = async () => {
    setResetPassError('');
    setResetConfirmError('');
    setResetError('');

    let valid = true;
    if (!resetPass) {
      setResetPassError('Please enter a new password.'); valid = false;
    } else if (resetPass.length < 8) {
      setResetPassError('Password must be at least 8 characters.'); valid = false;
    }
    if (!resetConfirm) {
      setResetConfirmError('Please confirm your password.'); valid = false;
    } else if (resetPass !== resetConfirm) {
      setResetConfirmError('Passwords do not match.'); valid = false;
    }
    if (!valid) return;

    if (!resetTokenRef.current) {
      setResetError('Reset session expired. Please start the forgot password flow again.');
      return;
    }

    setResetLoading(true);
    try {
      await api.post('/auth/reset-password', {
        reset_token:  resetTokenRef.current,
        new_password: resetPass,
      });
      setResetLoading(false);
      const trimmed = forgotEmail.trim().toLowerCase();
      if (trimmed) {
        await AsyncStorage.setItem(`pwd_set_${trimmed}`, '1').catch(() => {});
      }
      setScreen('forgotSuccess');
    } catch (err) {
      setResetLoading(false);
      const msg = (err.message || '').toLowerCase();
      if (msg.includes('expired') || msg.includes('invalid token')) {
        setResetError('Your reset session has expired. Please request a new reset code.');
      } else {
        setResetError(err.message || 'Failed to reset password. Please try again.');
      }
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────
  const goBackToLogin = () => {
    setScreen('login');
    setForgotEmail(''); setForgotEmailError('');
    setOtp(''); setOtpError('');
    setResetPass(''); setResetConfirm('');
    setResetError('');
    setEmailSentSuccess(false);
    setResendSuccess(false);
    resetTokenRef.current = null;
  };

  const strength       = getStrength(newPass);
  const passwordsMatch = newPass.length > 0 && confirmPass.length > 0 && newPass === confirmPass;
  const resetStrength  = getStrength(resetPass);
  const resetMatch     = resetPass.length > 0 && resetConfirm.length > 0 && resetPass === resetConfirm;

  // ─────────────────────────────────────────────────────────────
  // SUCCESS SCREEN
  // ─────────────────────────────────────────────────────────────
  if (screen === 'success') {
    const displayName = email.split('@')[0] || 'there';
    return (
      <LinearGradient colors={['#1E1B4B','#3730A3','#4F46E5']} start={{x:0,y:0}} end={{x:1,y:1}} style={{ flex:1 }}>
        <StatusBar barStyle="light-content" />
        <Decorations />
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:32 }}>
          <Animated.View style={{ opacity:fadeAnim, transform:[{ translateY:slideAnim }], alignItems:'center' }}>
            <View style={{
              width:100, height:100, borderRadius:50,
              backgroundColor:'rgba(5,150,105,0.18)',
              borderWidth:2, borderColor:T.green,
              alignItems:'center', justifyContent:'center', marginBottom:24,
            }}>
              <Ionicons name="checkmark" size={52} color={T.green} />
            </View>
            <Text style={{ fontSize:28, fontWeight:'900', color:'#fff', marginBottom:10, textAlign:'center' }}>
              Password Created!
            </Text>
            <Text style={{ fontSize:14, color:'rgba(255,255,255,0.7)', textAlign:'center', lineHeight:22 }}>
              Welcome, {displayName}!{'\n'}
              Taking you to your dashboard…
            </Text>
            <ActivityIndicator color="rgba(255,255,255,0.55)" size="large" style={{ marginTop:32 }} />
          </Animated.View>
        </View>
      </LinearGradient>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // FORGOT SUCCESS SCREEN
  // ─────────────────────────────────────────────────────────────
  if (screen === 'forgotSuccess') {
    return (
      <LinearGradient colors={['#1E1B4B','#3730A3','#4F46E5']} start={{x:0,y:0}} end={{x:1,y:1}} style={{ flex:1 }}>
        <StatusBar barStyle="light-content" />
        <Decorations />
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:32 }}>
          <Animated.View style={{ opacity:fadeAnim, transform:[{ translateY:slideAnim }], alignItems:'center' }}>
            <View style={{
              width:100, height:100, borderRadius:50,
              backgroundColor:'rgba(5,150,105,0.18)',
              borderWidth:2, borderColor:T.green,
              alignItems:'center', justifyContent:'center', marginBottom:24,
            }}>
              <Ionicons name="lock-open" size={46} color={T.green} />
            </View>
            <Text style={{ fontSize:28, fontWeight:'900', color:'#fff', marginBottom:10, textAlign:'center' }}>
              Password Reset!
            </Text>
            <Text style={{ fontSize:14, color:'rgba(255,255,255,0.7)', textAlign:'center', lineHeight:22, marginBottom:32 }}>
              Your password has been updated.{'\n'}
              Please sign in with your new password.
            </Text>
            <TouchableOpacity
              onPress={goBackToLogin}
              style={{
                backgroundColor:'rgba(255,255,255,0.15)',
                borderRadius:T.radius.pill,
                paddingHorizontal:32, paddingVertical:14,
                borderWidth:1, borderColor:'rgba(255,255,255,0.25)',
              }}
            >
              <Text style={{ color:'#fff', fontWeight:'800', fontSize:15 }}>Back to Sign In</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </LinearGradient>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // SET PASSWORD SCREEN (first login)
  // ─────────────────────────────────────────────────────────────
  if (screen === 'setPassword') {
    const displayEmail = pendingUser.current?.email || email;
    return (
      <LinearGradient colors={['#1E1B4B','#3730A3','#4F46E5']} start={{x:0,y:0}} end={{x:1,y:1}} style={{ flex:1 }}>
        <StatusBar barStyle="light-content" />
        <Decorations />
        <KeyboardAvoidingView behavior={Platform.OS==='ios' ? 'padding' : undefined} style={{ flex:1 }}>
          <ScrollView
            contentContainerStyle={{ flexGrow:1, justifyContent:'center', paddingHorizontal:20, paddingVertical: Platform.OS==='ios' ? 50 : 36 }}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={{ opacity:fadeAnim, transform:[{ translateY:slideAnim }] }}>

              <TouchableOpacity
                onPress={() => {
                  setScreen('login');
                  setNewPass(''); setConfirmPass('');
                  setNewPassError(''); setConfirmError(''); setSetPassError('');
                  pendingUser.current  = null;
                  pendingToken.current = null;
                }}
                style={{
                  flexDirection:'row', alignItems:'center', gap:6,
                  alignSelf:'flex-start', marginBottom:24,
                  backgroundColor:'rgba(255,255,255,0.12)',
                  borderRadius:T.radius.pill, paddingHorizontal:14, paddingVertical:7,
                }}
              >
                <Ionicons name="arrow-back" size={16} color="#fff" />
                <Text style={{ fontSize:13, fontWeight:'700', color:'#fff' }}>Back to Login</Text>
              </TouchableOpacity>

              <View style={{ alignItems:'center', marginBottom:28 }}>
                <View style={{
                  width:72, height:72, borderRadius:22,
                  backgroundColor:'rgba(255,255,255,0.12)',
                  alignItems:'center', justifyContent:'center',
                  marginBottom:16, borderWidth:1.5, borderColor:'rgba(255,255,255,0.2)',
                }}>
                  <Ionicons name="lock-open-outline" size={32} color="#fff" />
                </View>
                <Text style={{ fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:'700', letterSpacing:1.5, textTransform:'uppercase', marginBottom:6 }}>
                  First Time Login
                </Text>
                <Text style={{ fontSize:28, fontWeight:'900', color:'#fff', letterSpacing:-0.5, textAlign:'center' }}>
                  Create Your Password
                </Text>
                <Text style={{ fontSize:13, color:'rgba(255,255,255,0.65)', marginTop:8, textAlign:'center', lineHeight:20 }}>
                  Set a secure password for your account.{'\n'}You'll use this every time you sign in.
                </Text>
              </View>

              <View style={{ backgroundColor:T.surface, borderRadius:T.radius.xl, padding:24, ...T.shadow.lg }}>

                <View style={{
                  flexDirection:'row', alignItems:'center', gap:10,
                  backgroundColor:T.greenLt, borderRadius:T.radius.lg,
                  padding:12, marginBottom:22,
                  borderWidth:1, borderColor:'#A7F3D0',
                }}>
                  <Ionicons name="shield-checkmark" size={18} color={T.green} />
                  <View style={{ flex:1 }}>
                    <Text style={{ fontSize:11, fontWeight:'700', color:T.green }}>Account Found</Text>
                    <Text style={{ fontSize:12, color:T.textSec, marginTop:1 }}>{displayEmail}</Text>
                  </View>
                </View>

                <ErrorBanner message={setPassError} />

                <Field
                  label="New Password"
                  icon={<Ionicons name="lock-closed-outline" size={20} color={T.textSec} style={{ marginRight:10 }} />}
                  value={newPass}
                  onChange={t => { setNewPass(t); setNewPassError(''); setSetPassError(''); }}
                  placeholder="Create a strong password"
                  secure={!showNew}
                  showToggle
                  onToggleSecure={() => setShowNew(p => !p)}
                  error={newPassError}
                />

                {newPass.length > 0 && (
                  <View style={{ marginTop:-10, marginBottom:18 }}>
                    <View style={{ flexDirection:'row', gap:5, marginBottom:6 }}>
                      {[1,2,3,4].map(i => (
                        <View key={i} style={{
                          flex:1, height:4, borderRadius:2,
                          backgroundColor: i <= strength ? STRENGTH_COLOR[strength] : T.border,
                        }} />
                      ))}
                    </View>
                    <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                      <View style={{ flexDirection:'row', gap:10, flexWrap:'wrap' }}>
                        {[
                          { label:'8+ chars',  ok: newPass.length >= 8 },
                          { label:'Uppercase', ok: /[A-Z]/.test(newPass) },
                          { label:'Number',    ok: /[0-9]/.test(newPass) },
                          { label:'Symbol',    ok: /[^A-Za-z0-9]/.test(newPass) },
                        ].map((c, i) => (
                          <View key={i} style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
                            <Ionicons
                              name={c.ok ? 'checkmark-circle' : 'ellipse-outline'}
                              size={12}
                              color={c.ok ? T.green : T.textMut}
                            />
                            <Text style={{ fontSize:10, fontWeight:'600', color: c.ok ? T.green : T.textMut }}>
                              {c.label}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <Text style={{ fontSize:11, fontWeight:'700', color: STRENGTH_COLOR[strength] }}>
                        {STRENGTH_LABEL[strength]}
                      </Text>
                    </View>
                  </View>
                )}

                <Field
                  label="Confirm Password"
                  icon={<Ionicons name="lock-closed" size={20} color={T.textSec} style={{ marginRight:10 }} />}
                  value={confirmPass}
                  onChange={t => { setConfirmPass(t); setConfirmError(''); setSetPassError(''); }}
                  placeholder="Re-enter your password"
                  secure={!showConfirm}
                  showToggle
                  onToggleSecure={() => setShowConfirm(p => !p)}
                  error={confirmError}
                />

                {confirmPass.length > 0 && (
                  <View style={{ flexDirection:'row', alignItems:'center', gap:5, marginTop:-10, marginBottom:18 }}>
                    <Ionicons
                      name={passwordsMatch ? 'checkmark-circle' : 'close-circle'}
                      size={14}
                      color={passwordsMatch ? T.green : T.red}
                    />
                    <Text style={{ fontSize:11, fontWeight:'600', color: passwordsMatch ? T.green : T.red }}>
                      {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleSetPassword}
                  disabled={setPassLoading}
                  activeOpacity={0.85}
                  style={{ borderRadius:T.radius.lg, overflow:'hidden', ...T.shadow.md }}
                >
                  <LinearGradient
                    colors={[T.green,'#047857']}
                    start={{x:0,y:0}} end={{x:1,y:0}}
                    style={{ paddingVertical:16, alignItems:'center', flexDirection:'row', justifyContent:'center', gap:8 }}
                  >
                    {setPassLoading
                      ? <ActivityIndicator color="#fff" />
                      : <>
                          <Ionicons name="rocket-outline" size={20} color="#fff" />
                          <Text style={{ fontSize:16, fontWeight:'800', color:'#fff', letterSpacing:0.5 }}>
                            Set Password & Sign In
                          </Text>
                        </>
                    }
                  </LinearGradient>
                </TouchableOpacity>

              </View>
              <Footer />
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // FORGOT — Step 1: Enter email
  // ─────────────────────────────────────────────────────────────
  if (screen === 'forgotEmail') {
    return (
      <LinearGradient colors={['#1E1B4B','#3730A3','#4F46E5']} start={{x:0,y:0}} end={{x:1,y:1}} style={{ flex:1 }}>
        <StatusBar barStyle="light-content" />
        <Decorations />
        <KeyboardAvoidingView behavior={Platform.OS==='ios' ? 'padding' : undefined} style={{ flex:1 }}>
          <ScrollView
            contentContainerStyle={{ flexGrow:1, justifyContent:'center', paddingHorizontal:20, paddingVertical: Platform.OS==='ios' ? 50 : 36 }}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={{ opacity:fadeAnim, transform:[{ translateY:slideAnim }] }}>

              <TouchableOpacity
                onPress={goBackToLogin}
                style={{
                  flexDirection:'row', alignItems:'center', gap:6,
                  alignSelf:'flex-start', marginBottom:24,
                  backgroundColor:'rgba(255,255,255,0.12)',
                  borderRadius:T.radius.pill, paddingHorizontal:14, paddingVertical:7,
                }}
              >
                <Ionicons name="arrow-back" size={16} color="#fff" />
                <Text style={{ fontSize:13, fontWeight:'700', color:'#fff' }}>Back to Login</Text>
              </TouchableOpacity>

              <View style={{ alignItems:'center', marginBottom:28 }}>
                <View style={{
                  width:72, height:72, borderRadius:22,
                  backgroundColor:'rgba(255,255,255,0.12)',
                  alignItems:'center', justifyContent:'center',
                  marginBottom:16, borderWidth:1.5, borderColor:'rgba(255,255,255,0.2)',
                }}>
                  <Ionicons name="key-outline" size={32} color="#fff" />
                </View>
                <Text style={{ fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:'700', letterSpacing:1.5, textTransform:'uppercase', marginBottom:6 }}>
                  Account Recovery
                </Text>
                <Text style={{ fontSize:28, fontWeight:'900', color:'#fff', letterSpacing:-0.5, textAlign:'center' }}>
                  Forgot Password?
                </Text>
                <Text style={{ fontSize:13, color:'rgba(255,255,255,0.65)', marginTop:8, textAlign:'center', lineHeight:20 }}>
                  Enter your email and we'll send{'\n'}a 6-digit reset code.
                </Text>
              </View>

              <View style={{ backgroundColor:T.surface, borderRadius:T.radius.xl, padding:24, ...T.shadow.lg }}>
                <ErrorBanner message={forgotEmailError} />
                <Field
                  label="Email Address"
                  icon={<MaterialIcons name="email" size={20} color={T.textSec} style={{ marginRight:10 }} />}
                  value={forgotEmail}
                  onChange={t => { setForgotEmail(t); setForgotEmailError(''); }}
                  placeholder="Enter your account email"
                  keyboard="email-address"
                />

                <View style={{
                  flexDirection:'row', alignItems:'flex-start', gap:8,
                  backgroundColor:T.indigoLt, borderRadius:T.radius.lg,
                  padding:12, marginBottom:18,
                  borderWidth:1, borderColor:'#C7D2FE',
                }}>
                  <Ionicons name="mail-outline" size={16} color={T.indigo} style={{ marginTop:1 }} />
                  <Text style={{ flex:1, fontSize:12, color:T.indigo, lineHeight:18 }}>
                    The code will be sent to your registered email. Check your <Text style={{ fontWeight:'700' }}>spam/junk folder</Text> if you don't see it in your inbox.
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleForgotSubmitEmail}
                  disabled={forgotEmailLoading}
                  activeOpacity={0.85}
                  style={{ borderRadius:T.radius.lg, overflow:'hidden', marginTop:4, ...T.shadow.md }}
                >
                  <LinearGradient
                    colors={forgotEmailLoading ? ['#9CA3AF','#9CA3AF'] : [T.indigo,'#7C3AED']}
                    start={{x:0,y:0}} end={{x:1,y:0}}
                    style={{ paddingVertical:16, alignItems:'center', flexDirection:'row', justifyContent:'center', gap:8 }}
                  >
                    {forgotEmailLoading
                      ? <ActivityIndicator color="#fff" />
                      : <>
                          <Ionicons name="send-outline" size={20} color="#fff" />
                          <Text style={{ fontSize:16, fontWeight:'800', color:'#fff', letterSpacing:0.5 }}>
                            Send Reset Code
                          </Text>
                        </>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              <Footer />
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // FORGOT — Step 2: Enter OTP
  // ─────────────────────────────────────────────────────────────
  if (screen === 'forgotOtp') {
    return (
      <LinearGradient colors={['#1E1B4B','#3730A3','#4F46E5']} start={{x:0,y:0}} end={{x:1,y:1}} style={{ flex:1 }}>
        <StatusBar barStyle="light-content" />
        <Decorations />
        <KeyboardAvoidingView behavior={Platform.OS==='ios' ? 'padding' : undefined} style={{ flex:1 }}>
          <ScrollView
            contentContainerStyle={{ flexGrow:1, justifyContent:'center', paddingHorizontal:20, paddingVertical: Platform.OS==='ios' ? 50 : 36 }}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={{ opacity:fadeAnim, transform:[{ translateY:slideAnim }] }}>

              <TouchableOpacity
                onPress={() => { setScreen('forgotEmail'); setOtp(''); setOtpError(''); setResendSuccess(false); }}
                style={{
                  flexDirection:'row', alignItems:'center', gap:6,
                  alignSelf:'flex-start', marginBottom:24,
                  backgroundColor:'rgba(255,255,255,0.12)',
                  borderRadius:T.radius.pill, paddingHorizontal:14, paddingVertical:7,
                }}
              >
                <Ionicons name="arrow-back" size={16} color="#fff" />
                <Text style={{ fontSize:13, fontWeight:'700', color:'#fff' }}>Change Email</Text>
              </TouchableOpacity>

              <View style={{ alignItems:'center', marginBottom:28 }}>
                <View style={{
                  width:72, height:72, borderRadius:22,
                  backgroundColor:'rgba(255,255,255,0.12)',
                  alignItems:'center', justifyContent:'center',
                  marginBottom:16, borderWidth:1.5, borderColor:'rgba(255,255,255,0.2)',
                }}>
                  <MaterialIcons name="mark-email-read" size={32} color="#fff" />
                </View>
                <Text style={{ fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:'700', letterSpacing:1.5, textTransform:'uppercase', marginBottom:6 }}>
                  Check Your Email
                </Text>
                <Text style={{ fontSize:28, fontWeight:'900', color:'#fff', letterSpacing:-0.5, textAlign:'center' }}>
                  Enter Reset Code
                </Text>
                <Text style={{ fontSize:13, color:'rgba(255,255,255,0.65)', marginTop:8, textAlign:'center', lineHeight:20 }}>
                  We sent a 6-digit code to{'\n'}
                  <Text style={{ fontWeight:'700', color:'#fff' }}>{forgotEmail.trim().toLowerCase()}</Text>
                </Text>
              </View>

              <View style={{ backgroundColor:T.surface, borderRadius:T.radius.xl, padding:24, ...T.shadow.lg }}>

                {emailSentSuccess && !resendSuccess && (
                  <SuccessBanner message="Code sent! Check your inbox and spam/junk folder." />
                )}
                {!emailSentSuccess && (
                  <InfoBanner message="If you don't receive the code, check your spam/junk folder or tap Resend below." />
                )}
                {resendSuccess && (
                  <SuccessBanner message="A new code has been sent to your email." />
                )}

                <Text style={{ fontSize:12, fontWeight:'600', color:T.textSec, marginBottom:14, textAlign:'center' }}>
                  Enter 6-digit code
                </Text>
                <OtpInput value={otp} onChange={v => { setOtp(v); setOtpError(''); }} />

                {!!otpError && (
                  <View style={{ marginTop:-8 }}>
                    <ErrorBanner message={otpError} />
                  </View>
                )}

                <View style={{
                  flexDirection:'row', alignItems:'flex-start', gap:8,
                  backgroundColor:T.indigoLt, borderRadius:T.radius.lg,
                  padding:10, marginBottom:16,
                  borderWidth:1, borderColor:'#C7D2FE',
                }}>
                  <Ionicons name="information-circle-outline" size={15} color={T.indigo} style={{ marginTop:1 }} />
                  <Text style={{ flex:1, fontSize:11, color:T.indigo, lineHeight:17 }}>
                    Can't find the email? Check your <Text style={{ fontWeight:'700' }}>spam or junk folder</Text>. The code expires in 15 minutes.
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleVerifyOtp}
                  disabled={otpLoading || otp.length < 6}
                  activeOpacity={0.85}
                  style={{ borderRadius:T.radius.lg, overflow:'hidden', marginTop:4, ...T.shadow.md }}
                >
                  <LinearGradient
                    colors={otp.length < 6 ? ['#9CA3AF','#9CA3AF'] : [T.indigo,'#7C3AED']}
                    start={{x:0,y:0}} end={{x:1,y:0}}
                    style={{ paddingVertical:16, alignItems:'center', flexDirection:'row', justifyContent:'center', gap:8 }}
                  >
                    {otpLoading
                      ? <ActivityIndicator color="#fff" />
                      : <>
                          <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                          <Text style={{ fontSize:16, fontWeight:'800', color:'#fff', letterSpacing:0.5 }}>
                            Verify Code
                          </Text>
                        </>
                    }
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleResendOtp}
                  disabled={resendCool > 0 || resendLoading}
                  style={{ alignItems:'center', marginTop:16, paddingVertical:8 }}
                >
                  {resendLoading
                    ? <ActivityIndicator color={T.indigo} size="small" />
                    : <Text style={{ fontSize:13, fontWeight:'600', color: resendCool > 0 ? T.textMut : T.indigo }}>
                        {resendCool > 0
                          ? `Resend code in ${resendCool}s`
                          : "Didn't receive the code? Resend"}
                      </Text>
                  }
                </TouchableOpacity>
              </View>
              <Footer />
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // FORGOT — Step 3: New password
  // ─────────────────────────────────────────────────────────────
  if (screen === 'forgotNewPass') {
    return (
      <LinearGradient colors={['#1E1B4B','#3730A3','#4F46E5']} start={{x:0,y:0}} end={{x:1,y:1}} style={{ flex:1 }}>
        <StatusBar barStyle="light-content" />
        <Decorations />
        <KeyboardAvoidingView behavior={Platform.OS==='ios' ? 'padding' : undefined} style={{ flex:1 }}>
          <ScrollView
            contentContainerStyle={{ flexGrow:1, justifyContent:'center', paddingHorizontal:20, paddingVertical: Platform.OS==='ios' ? 50 : 36 }}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={{ opacity:fadeAnim, transform:[{ translateY:slideAnim }] }}>

              <View style={{ alignItems:'center', marginBottom:28 }}>
                <View style={{
                  width:72, height:72, borderRadius:22,
                  backgroundColor:'rgba(255,255,255,0.12)',
                  alignItems:'center', justifyContent:'center',
                  marginBottom:16, borderWidth:1.5, borderColor:'rgba(255,255,255,0.2)',
                }}>
                  <Ionicons name="lock-open-outline" size={32} color="#fff" />
                </View>
                <Text style={{ fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:'700', letterSpacing:1.5, textTransform:'uppercase', marginBottom:6 }}>
                  Almost There
                </Text>
                <Text style={{ fontSize:28, fontWeight:'900', color:'#fff', letterSpacing:-0.5, textAlign:'center' }}>
                  Set New Password
                </Text>
                <Text style={{ fontSize:13, color:'rgba(255,255,255,0.65)', marginTop:8, textAlign:'center', lineHeight:20 }}>
                  Choose a strong password you'll remember.
                </Text>
              </View>

              <View style={{ backgroundColor:T.surface, borderRadius:T.radius.xl, padding:24, ...T.shadow.lg }}>
                <ErrorBanner message={resetError} />
                <Field
                  label="New Password"
                  icon={<Ionicons name="lock-closed-outline" size={20} color={T.textSec} style={{ marginRight:10 }} />}
                  value={resetPass}
                  onChange={t => { setResetPass(t); setResetPassError(''); setResetError(''); }}
                  placeholder="Create a strong password"
                  secure={!showResetPass}
                  showToggle
                  onToggleSecure={() => setShowResetPass(p => !p)}
                  error={resetPassError}
                />
                {resetPass.length > 0 && (
                  <View style={{ marginTop:-10, marginBottom:18 }}>
                    <View style={{ flexDirection:'row', gap:5, marginBottom:6 }}>
                      {[1,2,3,4].map(i => (
                        <View key={i} style={{
                          flex:1, height:4, borderRadius:2,
                          backgroundColor: i <= resetStrength ? STRENGTH_COLOR[resetStrength] : T.border,
                        }} />
                      ))}
                    </View>
                    <View style={{ flexDirection:'row', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
                      <View style={{ flexDirection:'row', gap:10, flexWrap:'wrap' }}>
                        {[
                          { label:'8+ chars',  ok: resetPass.length >= 8 },
                          { label:'Uppercase', ok: /[A-Z]/.test(resetPass) },
                          { label:'Number',    ok: /[0-9]/.test(resetPass) },
                          { label:'Symbol',    ok: /[^A-Za-z0-9]/.test(resetPass) },
                        ].map((c, i) => (
                          <View key={i} style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
                            <Ionicons name={c.ok ? 'checkmark-circle' : 'ellipse-outline'} size={12} color={c.ok ? T.green : T.textMut} />
                            <Text style={{ fontSize:10, fontWeight:'600', color: c.ok ? T.green : T.textMut }}>{c.label}</Text>
                          </View>
                        ))}
                      </View>
                      <Text style={{ fontSize:11, fontWeight:'700', color: STRENGTH_COLOR[resetStrength] }}>
                        {STRENGTH_LABEL[resetStrength]}
                      </Text>
                    </View>
                  </View>
                )}
                <Field
                  label="Confirm Password"
                  icon={<Ionicons name="lock-closed" size={20} color={T.textSec} style={{ marginRight:10 }} />}
                  value={resetConfirm}
                  onChange={t => { setResetConfirm(t); setResetConfirmError(''); setResetError(''); }}
                  placeholder="Re-enter your password"
                  secure={!showResetConfirm}
                  showToggle
                  onToggleSecure={() => setShowResetConfirm(p => !p)}
                  error={resetConfirmError}
                />
                {resetConfirm.length > 0 && (
                  <View style={{ flexDirection:'row', alignItems:'center', gap:5, marginTop:-10, marginBottom:18 }}>
                    <Ionicons
                      name={resetMatch ? 'checkmark-circle' : 'close-circle'}
                      size={14}
                      color={resetMatch ? T.green : T.red}
                    />
                    <Text style={{ fontSize:11, fontWeight:'600', color: resetMatch ? T.green : T.red }}>
                      {resetMatch ? 'Passwords match' : 'Passwords do not match'}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  onPress={handleResetPassword}
                  disabled={resetLoading}
                  activeOpacity={0.85}
                  style={{ borderRadius:T.radius.lg, overflow:'hidden', ...T.shadow.md }}
                >
                  <LinearGradient
                    colors={[T.green,'#047857']}
                    start={{x:0,y:0}} end={{x:1,y:0}}
                    style={{ paddingVertical:16, alignItems:'center', flexDirection:'row', justifyContent:'center', gap:8 }}
                  >
                    {resetLoading
                      ? <ActivityIndicator color="#fff" />
                      : <>
                          <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
                          <Text style={{ fontSize:16, fontWeight:'800', color:'#fff', letterSpacing:0.5 }}>
                            Reset Password
                          </Text>
                        </>
                    }
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              <Footer />
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // LOGIN SCREEN (default)
  // ─────────────────────────────────────────────────────────────
  return (
    <LinearGradient colors={['#1E1B4B','#3730A3','#4F46E5']} start={{x:0,y:0}} end={{x:1,y:1}} style={{ flex:1 }}>
      <StatusBar barStyle="light-content" />
      <Decorations />

      <KeyboardAvoidingView behavior={Platform.OS==='ios' ? 'padding' : undefined} style={{ flex:1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow:1, justifyContent:'center', paddingHorizontal:20, paddingVertical: Platform.OS==='ios' ? 40 : 30 }}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity:fadeAnim, transform:[{ translateY:slideAnim }] }}>

            <View style={{ alignItems:'center', marginBottom:32 }}>
              <View style={{
                width:96, height:96, borderRadius:28,
                backgroundColor:'rgba(255,255,255,0.1)',
                alignItems:'center', justifyContent:'center',
                marginBottom:18, borderWidth:1.5,
                borderColor:'rgba(255,255,255,0.2)',
                ...T.shadow.lg, shadowColor:'#000',
              }}>
                <FontAwesome5 name="school" size={36} color="rgba(255,255,255,0.95)" />
                <View style={{ flexDirection:'row', gap:10, marginTop:4 }}>
                  <Ionicons name="clipboard-outline" size={16} color="rgba(255,255,255,0.8)" />
                  <Ionicons name="time-outline"      size={16} color="rgba(255,255,255,0.8)" />
                </View>
              </View>
              <Text style={{ fontSize:11, color:'rgba(255,255,255,0.7)', fontWeight:'700', letterSpacing:1.5, textTransform:'uppercase', marginBottom:6 }}>
                Education Time &amp; Attendance
              </Text>
              <Text style={{ fontSize:36, fontWeight:'900', color:'#fff', letterSpacing:2 }}>ETAM</Text>
              <Text style={{ fontSize:13, color:'rgba(255,255,255,0.7)', marginTop:6, fontWeight:'500' }}>
                Management System
              </Text>
            </View>

            <View style={{ backgroundColor:T.surface, borderRadius:T.radius.xl, padding:24, ...T.shadow.lg }}>
              <Text style={{ fontSize:11, color:T.textSec, fontWeight:'700', letterSpacing:1, textTransform:'uppercase', marginBottom:6 }}>
                Teacher / Student
              </Text>
              <Text style={{ fontSize:24, fontWeight:'800', color:T.textPri, letterSpacing:-0.5, marginBottom:4 }}>
                Welcome Back
              </Text>
              <Text style={{ fontSize:13, color:T.textSec, marginBottom:24 }}>
                Sign in with your email and password
              </Text>

              <ErrorBanner message={loginError} />

              <Field
                label="Email Address"
                icon={<MaterialIcons name="email" size={20} color={T.textSec} style={{ marginRight:10 }} />}
                value={email}
                onChange={t => { setEmail(t); setLoginError(''); }}
                placeholder="Enter your email"
                keyboard="email-address"
              />

              <Field
                label="Password"
                icon={<Ionicons name="lock-closed" size={20} color={T.textSec} style={{ marginRight:10 }} />}
                value={password}
                onChange={t => { setPassword(t); setLoginError(''); }}
                placeholder="Enter your password"
                secure={!showPassword}
                showToggle
                onToggleSecure={() => setShowPassword(p => !p)}
              />

              <TouchableOpacity
                onPress={() => {
                  setForgotEmail(email);
                  setForgotEmailError('');
                  setEmailSentSuccess(false);
                  setResendSuccess(false);
                  setScreen('forgotEmail');
                }}
                style={{ alignSelf:'flex-end', marginTop:-8, marginBottom:20, paddingVertical:4 }}
              >
                <Text style={{ fontSize:13, fontWeight:'600', color:T.indigo }}>Forgot password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleLogin}
                disabled={loginLoading}
                activeOpacity={0.85}
                style={{ borderRadius:T.radius.lg, overflow:'hidden', ...T.shadow.md }}
              >
                <LinearGradient
                  colors={loginLoading ? ['#9CA3AF','#9CA3AF'] : [T.indigo,'#7C3AED']}
                  start={{x:0,y:0}} end={{x:1,y:0}}
                  style={{ paddingVertical:16, alignItems:'center', flexDirection:'row', justifyContent:'center', gap:8 }}
                >
                  {loginLoading
                    ? <ActivityIndicator color="#fff" />
                    : <>
                        <Ionicons name="rocket-outline" size={20} color="#fff" />
                        <Text style={{ fontSize:16, fontWeight:'800', color:'#fff', letterSpacing:0.5 }}>Sign In</Text>
                      </>
                  }
                </LinearGradient>
              </TouchableOpacity>

              <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginTop:16, justifyContent:'center' }}>
                <Ionicons name="information-circle-outline" size={14} color={T.textMut} />
                <Text style={{ fontSize:11, color:T.textMut, textAlign:'center' }}>
                  First time? Use the temporary password sent to your email.
                </Text>
              </View>
            </View>
            <Footer />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

export default LoginScreen;