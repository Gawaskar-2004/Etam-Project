import React from 'react';
import { View, Text, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../config/constants';

export const HEADER_CONFIGS = {
  teacher: { colors: [C.primary, C.primaryDark, '#7C3AED'], icon: '👨‍🏫', label: 'Teacher Portal', title: 'Dashboard' },
  student: { colors: ['#0EA5E9', '#0284C7', '#0369A1'], icon: '🎓', label: 'Student Portal', title: 'Dashboard' },
};

const PremiumHeader = ({ name, role = 'teacher', stats, title, subtitle, icon, label }) => {
  const cfg = HEADER_CONFIGS[role] || HEADER_CONFIGS.teacher;
  const displayTitle = title || cfg.title;
  const displaySubtitle = subtitle || `Welcome, ${name?.split(' ')[0] || 'User'}`;
  const displayIcon = icon || cfg.icon;
  const displayLabel = label || cfg.label;
  return (
    <LinearGradient
      colors={cfg.colors}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ paddingTop: Platform.OS === 'ios' ? 55 : 45, paddingBottom: 24, paddingHorizontal: 20, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', top: -24, right: -24, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)' }} />
      <View style={{ position: 'absolute', bottom: -16, right: 50, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.05)' }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>{displayLabel}</Text>
          <Text style={{ fontSize: 26, fontWeight: '800', color: '#fff' }}>{displayTitle}</Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 3 }}>{displaySubtitle}</Text>
        </View>
        <View style={{ width: 54, height: 54, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' }}>
          <Text style={{ fontSize: 26 }}>{displayIcon}</Text>
        </View>
      </View>
      {stats && stats.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 16 }}>
          {stats.map((stat, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingVertical: 9, paddingHorizontal: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center' }}>
              <Text style={{ fontSize: stats.length > 3 ? 16 : 20, fontWeight: '800', color: '#fff' }}>{stat.value}</Text>
              <Text style={{ fontSize: stats.length > 3 ? 9 : 11, color: 'rgba(255,255,255,0.8)', marginTop: 2, textAlign: 'center' }}>{stat.label}</Text>
            </View>
          ))}
        </View>
      )}
    </LinearGradient>
  );
};

export default PremiumHeader;
