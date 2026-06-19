import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';

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

// ==================== SPLASH SCREEN ====================
const SplashScreen = () => {
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <LinearGradient
      colors={['#1E1B4B', '#3730A3', '#4F46E5']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      <StatusBar barStyle="light-content" />

      {/* Decorative circles (consistent with hero headers) */}
      <View style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: 110, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }} />
      <View style={{ position: 'absolute', bottom: 100, left: -50, width: 180, height: 180, borderRadius: 90, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }} />
      <View style={{ position: 'absolute', top: '35%', left: -30, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.04)' }} />
      <View style={{ position: 'absolute', bottom: '20%', right: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.03)' }} />

      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }], alignItems: 'center' }}>

        {/* Pulsing Logo Box */}
        <Animated.View style={{
          transform: [{ scale: pulseAnim }],
          width: 120, height: 120, borderRadius: 34,
          backgroundColor: 'rgba(255,255,255,0.1)',
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 28, borderWidth: 2,
          borderColor: 'rgba(255,255,255,0.2)',
          ...T.shadow.lg,
          shadowColor: '#000',
          gap: 4,
        }}>
          <FontAwesome5 name="school" size={40} color="rgba(255,255,255,0.95)" />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
            <Ionicons name="clipboard-outline" size={16} color="rgba(255,255,255,0.8)" />
            <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.8)" />
          </View>
        </Animated.View>

        {/* Branding */}
        <Text style={{
          fontSize: 11, color: 'rgba(255,255,255,0.7)',
          fontWeight: '700', letterSpacing: 1.5,
          textTransform: 'uppercase', marginBottom: 8,
        }}>
          Education Time &amp; Attendance
        </Text>
        <Text style={{
          fontSize: 46, fontWeight: '900',
          color: '#fff', letterSpacing: 6, marginBottom: 8,
        }}>
          ETAM
        </Text>
        <Text style={{
          fontSize: 14, color: 'rgba(255,255,255,0.7)',
          letterSpacing: 0.5, marginBottom: 52,
        }}>
          Management System
        </Text>

        {/* Loader */}
        <ActivityIndicator color="rgba(255,255,255,0.8)" size="small" />
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 12, fontWeight: '500' }}>
          Loading...
        </Text>
      </Animated.View>

      {/* Footer */}
      <View style={{
        position: 'absolute', bottom: Platform.OS === 'ios' ? 32 : 24,
        flexDirection: 'row', alignItems: 'center', gap: 6,
      }}>
        <Ionicons name="shield-checkmark-outline" size={12} color="rgba(255,255,255,0.4)" />
        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '600' }}>
          AI-Powered Smart Attendance System v1.0
        </Text>
      </View>
    </LinearGradient>
  );
};

export default SplashScreen;