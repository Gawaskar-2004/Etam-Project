import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Animated, ScrollView, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { C } from '../../config/constants';
import { api } from '../../api/client';
import styles from '../../styles/globalStyles';
import PremiumHeader from '../../components/PremiumHeader';

// ==================== STUDENT DASHBOARD ====================

// ── Reusable Section Header (matches TeacherDashboard style) ──
const SectionHeader = ({ title, icon, iconColor = C.primary, subtitle }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: iconColor + '18', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={17} color={iconColor} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 }}>{title}</Text>
    </View>
    {subtitle ? <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600' }}>{subtitle}</Text> : null}
  </View>
);

const StudentDashboard = ({ token, user, onNavigate }) => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const loadData = async () => {
    try {
      const email = encodeURIComponent(user?.email || '');
      const data = await api.get(`/students/by-email/${email}/attendance-summary`, token);
      setAttendance(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log('Load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const totalClasses = attendance.reduce((s, a) => s + (a.total_sessions || 0), 0);
  const totalPresent = attendance.reduce((s, a) => s + (a.present_count || 0), 0);
  const totalAbsent = totalClasses - totalPresent;
  const percentage = totalClasses > 0 ? Math.round((totalPresent / totalClasses) * 100) : 0;

  // Animate progress bar when data loads
  useEffect(() => {
    if (!loading) {
      Animated.timing(progressAnim, {
        toValue: percentage / 100,
        duration: 900,
        useNativeDriver: false,
      }).start();
    }
  }, [loading, percentage]);

  const stats = [
    { value: totalClasses, label: 'Total' },
    { value: totalPresent, label: 'Present' },
    { value: `${percentage}%`, label: 'Rate' },
  ];

  // ── Attendance status config ──
  const attStatus =
    percentage >= 85
      ? { label: 'Excellent',        color: '#059669', bg: '#ECFDF5', border: '#6EE7B7', barColor: '#10B981', iconName: 'trophy',     iconColor: '#F59E0B' }
    : percentage >= 75
      ? { label: 'Good Standing',    color: '#2563EB', bg: '#EFF6FF', border: '#93C5FD', barColor: '#3B82F6', iconName: 'thumbs-up',  iconColor: '#3B82F6' }
      : { label: 'Needs Improvement',color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5', barColor: '#EF4444', iconName: 'warning',    iconColor: '#EF4444' };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const greetIcon = hour < 12 ? 'sunny-outline' : hour < 17 ? 'partly-sunny-outline' : 'moon-outline';

  // ── Quick Actions — 3 items including My Leaves ──
  const quickActions = [
    {
      icon: <Ionicons name="bar-chart" size={28} color="#3B82F6" />,
      title: 'My Attendance',
      subtitle: 'Period-wise & Monthly',
      screen: 'myAttendance',
      bg: '#EFF6FF',
      accent: '#3B82F6',
    },
    {
      icon: <Ionicons name="calendar" size={28} color="#6366F1" />,
      title: 'Timetable',
      subtitle: 'Weekly schedule',
      screen: 'studentTimetable',
      bg: '#EEF2FF',
      accent: '#6366F1',
    },
    {
      icon: <MaterialCommunityIcons name="calendar-clock" size={28} color="#059669" />,
      title: 'My Leaves',
      subtitle: 'Apply & track',
      screen: 'studentLeave',
      bg: '#D1FAE5',
      accent: '#059669',
    },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: '#F8FAFC' }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadData(); }}
          tintColor={C.primary}
        />
      }
    >
      <PremiumHeader
        name={user?.full_name}
        role="student"
        stats={stats}
        title="My Dashboard"
        subtitle={`${greeting}, ${user?.full_name?.split(' ')[0] || 'Student'}`}
      />

      <Animated.View style={{ paddingHorizontal: 16, paddingBottom: 36, opacity: fadeAnim }}>

        {/* ── OVERALL ATTENDANCE CARD ── */}
        <SectionHeader title="Overall Attendance" icon="pulse-outline" iconColor={attStatus.color} />

        <View style={{
          backgroundColor: '#fff',
          borderRadius: 24,
          overflow: 'hidden',
          shadowColor: attStatus.color,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 6,
          borderWidth: 1.5,
          borderColor: attStatus.border,
        }}>
          {/* Top accent strip */}
          <View style={{ height: 4, backgroundColor: attStatus.barColor }} />

          <View style={{ padding: 20 }}>
            {/* Percentage + badge row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                {/* Big percentage */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, marginBottom: 6 }}>
                  <Text style={{ fontSize: 56, fontWeight: '900', color: attStatus.color, lineHeight: 60, letterSpacing: -2 }}>
                    {percentage}
                  </Text>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: attStatus.color, marginBottom: 10 }}>%</Text>
                </View>
                {/* Status label */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: attStatus.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={attStatus.iconName} size={13} color={attStatus.iconColor} />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: attStatus.color }}>{attStatus.label}</Text>
                </View>
              </View>

              {/* Trophy / status circle */}
              <View style={{
                width: 80, height: 80, borderRadius: 40,
                backgroundColor: attStatus.bg,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 3, borderColor: attStatus.border,
              }}>
                <Ionicons name={attStatus.iconName} size={36} color={attStatus.iconColor} />
              </View>
            </View>

            {/* Animated Progress bar */}
            <View style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Attendance Rate
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '800', color: attStatus.color }}>{percentage}%</Text>
              </View>
              <View style={{ height: 10, backgroundColor: '#F1F5F9', borderRadius: 6, overflow: 'hidden' }}>
                <Animated.View style={{
                  height: '100%',
                  width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                  backgroundColor: attStatus.barColor,
                  borderRadius: 6,
                }} />
              </View>
              {/* Min threshold marker at 75% */}
              <View style={{ position: 'relative', marginTop: 4 }}>
                <View style={{ position: 'absolute', left: '75%', top: 0 }}>
                  <View style={{ width: 1.5, height: 6, backgroundColor: '#94A3B8' }} />
                  <Text style={{ fontSize: 9, color: '#94A3B8', fontWeight: '700', marginLeft: -8 }}>75%</Text>
                </View>
              </View>
            </View>

            {/* Stat boxes */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* Present */}
              <View style={{ flex: 1, backgroundColor: '#F0FDF4', borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#86EFAC' }}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" style={{ marginBottom: 4 }} />
                <Text style={{ fontSize: 26, fontWeight: '900', color: '#10B981', letterSpacing: -1 }}>{totalPresent}</Text>
                <Text style={{ fontSize: 10, color: '#059669', fontWeight: '800', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Present</Text>
              </View>

              {/* Absent */}
              <View style={{ flex: 1, backgroundColor: '#FEF2F2', borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#FCA5A5' }}>
                <Ionicons name="close-circle" size={20} color="#EF4444" style={{ marginBottom: 4 }} />
                <Text style={{ fontSize: 26, fontWeight: '900', color: '#EF4444', letterSpacing: -1 }}>{totalAbsent}</Text>
                <Text style={{ fontSize: 10, color: '#DC2626', fontWeight: '800', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Absent</Text>
              </View>

              {/* Total */}
              <View style={{ flex: 1, backgroundColor: '#EEF2FF', borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#C7D2FE' }}>
                <Ionicons name="layers" size={20} color="#6366F1" style={{ marginBottom: 4 }} />
                <Text style={{ fontSize: 26, fontWeight: '900', color: '#6366F1', letterSpacing: -1 }}>{totalClasses}</Text>
                <Text style={{ fontSize: 10, color: '#4F46E5', fontWeight: '800', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── SUBJECT-WISE BREAKDOWN ── */}
        {attendance.length > 0 && (
          <>
            <SectionHeader title="Subject-wise" icon="book-outline" iconColor="#F59E0B" subtitle={`${attendance.length} subjects`} />
            {attendance.map((subject, index) => {
              const pct = subject.total_sessions > 0
                ? Math.round((subject.present_count / subject.total_sessions) * 100)
                : 0;
              const subColor = pct >= 85 ? '#10B981' : pct >= 75 ? '#F59E0B' : '#EF4444';
              const subBg    = pct >= 85 ? '#ECFDF5' : pct >= 75 ? '#FFFBEB' : '#FEF2F2';

              return (
                <View key={index} style={{
                  backgroundColor: '#fff',
                  borderRadius: 16,
                  marginBottom: 10,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  shadowColor: '#64748B',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.06,
                  shadowRadius: 8,
                  elevation: 3,
                  borderWidth: 1.5,
                  borderColor: '#F1F5F9',
                }}>
                  {/* Subject icon */}
                  <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: subBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <MaterialCommunityIcons name="book-open-variant" size={22} color={subColor} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', flex: 1 }} numberOfLines={1}>
                        {subject.subject_name || subject.name || `Subject ${index + 1}`}
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: subColor, marginLeft: 8 }}>{pct}%</Text>
                    </View>

                    {/* Mini progress bar */}
                    <View style={{ height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden', marginBottom: 5 }}>
                      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: subColor, borderRadius: 3 }} />
                    </View>

                    {/* Present/Total */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 10, color: '#94A3B8', fontWeight: '600' }}>
                        {subject.present_count || 0} / {subject.total_sessions || 0} classes
                      </Text>
                      {pct < 75 && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FEF2F2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Ionicons name="alert-circle" size={10} color="#EF4444" />
                          <Text style={{ fontSize: 9, color: '#DC2626', fontWeight: '700' }}>LOW</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* ── QUICK ACTIONS — 3 cards in a row ── */}
        <SectionHeader title="Quick Actions" icon="flash-outline" iconColor="#F59E0B" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {quickActions.map(action => (
            <TouchableOpacity
              key={action.screen}
              activeOpacity={0.75}
              style={{
                flex: 1,
                backgroundColor: '#fff',
                borderRadius: 20,
                padding: 14,
                alignItems: 'center',
                shadowColor: action.accent,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 10,
                elevation: 4,
                borderWidth: 1.5,
                borderColor: '#F1F5F9',
              }}
              onPress={() => onNavigate(action.screen)}
            >
              <View style={{
                width: 52, height: 52, borderRadius: 16,
                backgroundColor: action.bg,
                alignItems: 'center', justifyContent: 'center', marginBottom: 10,
              }}>
                {action.icon}
              </View>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginBottom: 3 }}>
                {action.title}
              </Text>
              <Text style={{ fontSize: 10, color: '#94A3B8', textAlign: 'center', fontWeight: '600', lineHeight: 14 }}>
                {action.subtitle}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

      </Animated.View>
    </ScrollView>
  );
};

export default StudentDashboard;                