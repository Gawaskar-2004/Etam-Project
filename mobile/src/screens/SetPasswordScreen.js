import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  ScrollView, StatusBar, Alert, Animated, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { C, BASE_URL } from '../config/constants';

// ─── Design Tokens (mirroring TeacherTimetableScreen) ────────────────────────
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
  amber:   '#D97706',
  slate:   '#64748B',
  slateLt: '#F1F5F9',
  radius:  { sm:8, md:12, lg:16, xl:20, pill:999 },
  shadow:  {
    sm: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:6, elevation:2 },
    md: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:4}, shadowOpacity:0.10, shadowRadius:12, elevation:4 },
    lg: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:8}, shadowOpacity:0.14, shadowRadius:20, elevation:8 },
  },
};

// ==================== SET PASSWORD SCREEN ====================
const SetPasswordScreen = ({ onBack }) => {
  const [step, setStep] = useState(1); // 1=email, 2=otp, 3=new password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 50, friction: 7 }),
    ]).start();
  }, [step]);

  const resetAnim = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
  };

  const sendOtp = async () => {
    if (!email.trim()) { Alert.alert('Error', 'Please enter your email address'); return; }
    setLoading(true);
    try {
      await fetch(`${BASE_URL}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || d.message || 'Failed to send OTP');
        return d;
      });
      Alert.alert('OTP Sent', `A verification code has been sent to ${email}`);
      resetAnim();
      setStep(2);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to send OTP. Check your email and try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) { Alert.alert('Error', 'Please enter the OTP'); return; }
    setLoading(true);
    try {
      await fetch(`${BASE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp: otp.trim() }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || d.message || 'Invalid OTP');
        return d;
      });
      resetAnim();
      setStep(3);
    } catch (error) {
      Alert.alert('Invalid OTP', error.message || 'The code you entered is incorrect or has expired.');
    } finally {
      setLoading(false);
    }
  };

  const setPasswordByEmail = async () => {
    if (!newPassword) { Alert.alert('Error', 'Please enter a new password'); return; }
    if (newPassword.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { Alert.alert('Error', 'Passwords do not match'); return; }
    setLoading(true);
    try {
      await fetch(`${BASE_URL}/auth/set-password-by-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), new_password: newPassword }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || d.message || 'Failed to set password');
        return d;
      });
      Alert.alert('Password Set', 'Your password has been set successfully. You can now log in.', [
        { text: 'Login', onPress: onBack },
      ]);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to set password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const stepTitles = ['Enter Your Email', 'Verify OTP', 'Set New Password'];
  const stepSubtitles = [
    "We'll send a verification code to your email",
    `Enter the code sent to ${email}`,
    'Choose a strong password for your account',
  ];

  const StepIcon = () => {
    if (step === 1) return <MaterialIcons name="email" size={36} color="rgba(255,255,255,0.95)" />;
    if (step === 2) return <MaterialIcons name="pin" size={36} color="rgba(255,255,255,0.95)" />;
    return <Ionicons name="lock-closed" size={36} color="rgba(255,255,255,0.95)" />;
  };

  return (
    <LinearGradient
      colors={['#1E1B4B', '#3730A3', '#4F46E5']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <StatusBar barStyle="light-content" />

      {/* Decorative shapes (same as login/timetable) */}
      <View style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: 90, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }} />
      <View style={{ position: 'absolute', top: 80, right: 30, width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }} />
      <View style={{ position: 'absolute', bottom: 60, left: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.04)' }} />
      <View style={{ position: 'absolute', bottom: 120, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.03)' }} />

      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: Platform.OS === 'ios' ? 40 : 30 }}>

        {/* Logo + Title */}
        <View style={{ alignItems: 'center', marginBottom: 28 }}>
          <View style={{
            width: 96, height: 96, borderRadius: 28,
            backgroundColor: 'rgba(255,255,255,0.1)',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 18, borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.2)',
            ...T.shadow.lg,
            shadowColor: '#000',
          }}>
            <StepIcon />
          </View>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
            Smart Attendance
          </Text>
          <Text style={{ fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: 2 }}>ETAM</Text>

          {/* Step indicator (modern pill style) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 8 }}>
            {[1, 2, 3].map((s) => (
              <View key={s} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{
                  width: s === step ? 28 : 20, height: 6, borderRadius: 3,
                  backgroundColor: s <= step ? '#fff' : 'rgba(255,255,255,0.3)',
                }} />
                {s < 3 && (
                  <View style={{
                    width: 12, height: 2,
                    backgroundColor: s < step ? '#fff' : 'rgba(255,255,255,0.3)',
                    marginHorizontal: 2,
                  }} />
                )}
              </View>
            ))}
          </View>
        </View>

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* Card */}
          <View style={{
            backgroundColor: T.surface,
            borderRadius: T.radius.xl,
            padding: 24,
            ...T.shadow.lg,
          }}>
            <Text style={{ fontSize: 11, color: T.textSec, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
              {step === 1 ? 'Step 1 of 3' : step === 2 ? 'Step 2 of 3' : 'Step 3 of 3'}
            </Text>
            <Text style={{ fontSize: 24, fontWeight: '800', color: T.textPri, letterSpacing: -0.5, marginBottom: 4 }}>{stepTitles[step - 1]}</Text>
            <Text style={{ fontSize: 13, color: T.textSec, marginBottom: 28, lineHeight: 18 }}>{stepSubtitles[step - 1]}</Text>

            {/* ── STEP 1: Email ── */}
            {step === 1 && (
              <>
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: T.textSec, marginBottom: 6 }}>Email Address</Text>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: T.slateLt,
                    borderRadius: T.radius.lg,
                    paddingHorizontal: 14,
                    borderWidth: 1, borderColor: T.border,
                  }}>
                    <MaterialIcons name="email" size={20} color={T.textSec} style={{ marginRight: 10 }} />
                    <TextInput
                      style={{ flex: 1, paddingVertical: 14, fontSize: 15, color: T.textPri }}
                      placeholder="Enter your registered email"
                      placeholderTextColor={T.textMut}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={sendOtp}
                  disabled={loading}
                  activeOpacity={0.85}
                  style={{ borderRadius: T.radius.lg, overflow: 'hidden', ...T.shadow.md }}
                >
                  <LinearGradient
                    colors={[T.indigo, '#7C3AED']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <MaterialIcons name="send" size={18} color="#fff" />
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.5 }}>Send OTP</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {/* ── STEP 2: OTP ── */}
            {step === 2 && (
              <>
                <View style={{ marginBottom: 24 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: T.textSec, marginBottom: 6 }}>Verification Code</Text>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: T.slateLt,
                    borderRadius: T.radius.lg,
                    paddingHorizontal: 14,
                    borderWidth: 1, borderColor: T.border,
                  }}>
                    <MaterialIcons name="pin" size={22} color={T.textSec} style={{ marginRight: 10 }} />
                    <TextInput
                      style={{ flex: 1, paddingVertical: 14, fontSize: 18, fontWeight: '800', textAlign: 'center', letterSpacing: 6, color: T.textPri }}
                      placeholder="000000"
                      placeholderTextColor={T.textMut}
                      value={otp}
                      onChangeText={setOtp}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={verifyOtp}
                  disabled={loading}
                  activeOpacity={0.85}
                  style={{ borderRadius: T.radius.lg, overflow: 'hidden', ...T.shadow.md }}
                >
                  <LinearGradient
                    colors={[T.indigo, '#7C3AED']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.5 }}>Verify Code</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={sendOtp}
                  disabled={loading}
                  style={{ alignItems: 'center', marginTop: 20 }}
                >
                  <Text style={{ fontSize: 13, color: T.textSec }}>
                    Didn't receive it?{' '}
                    <Text style={{ color: T.indigo, fontWeight: '700' }}>Resend OTP</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── STEP 3: New Password ── */}
            {step === 3 && (
              <>
                <View style={{ marginBottom: 18 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: T.textSec, marginBottom: 6 }}>New Password</Text>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: T.slateLt,
                    borderRadius: T.radius.lg,
                    paddingHorizontal: 14,
                    borderWidth: 1, borderColor: T.border,
                  }}>
                    <Ionicons name="lock-closed" size={20} color={T.textSec} style={{ marginRight: 10 }} />
                    <TextInput
                      style={{ flex: 1, paddingVertical: 14, fontSize: 15, color: T.textPri }}
                      placeholder="Minimum 6 characters"
                      placeholderTextColor={T.textMut}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showNewPassword}
                    />
                    <TouchableOpacity onPress={() => setShowNewPassword(p => !p)} style={{ padding: 4 }}>
                      <Ionicons name={showNewPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={T.textSec} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ marginBottom: 24 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: T.textSec, marginBottom: 6 }}>Confirm Password</Text>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: T.slateLt,
                    borderRadius: T.radius.lg,
                    paddingHorizontal: 14,
                    borderWidth: 1, borderColor: T.border,
                  }}>
                    <Ionicons name="lock-closed" size={20} color={T.textSec} style={{ marginRight: 10 }} />
                    <TextInput
                      style={{ flex: 1, paddingVertical: 14, fontSize: 15, color: T.textPri }}
                      placeholder="Re-enter new password"
                      placeholderTextColor={T.textMut}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPassword(p => !p)} style={{ padding: 4 }}>
                      <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={T.textSec} />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={setPasswordByEmail}
                  disabled={loading}
                  activeOpacity={0.85}
                  style={{ borderRadius: T.radius.lg, overflow: 'hidden', ...T.shadow.md }}
                >
                  <LinearGradient
                    colors={[T.green, '#047857']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-done-circle-outline" size={22} color="#fff" />
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.5 }}>Set Password</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {/* Back button */}
            <TouchableOpacity
              onPress={step > 1 ? () => { resetAnim(); setStep(step - 1); } : onBack}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20 }}
            >
              <Ionicons name="arrow-back" size={16} color={T.indigo} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: T.indigo }}>
                {step > 1 ? 'Back' : 'Back to Login'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, gap: 6 }}>
            <Ionicons name="shield-checkmark-outline" size={13} color="rgba(255,255,255,0.45)" />
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600' }}>ETAM v1.0 · Secure Login</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
};

export default SetPasswordScreen;