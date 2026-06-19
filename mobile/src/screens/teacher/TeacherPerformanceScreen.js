import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, RefreshControl,
  Animated, Platform, Dimensions, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../../api/client';
import { todayStr } from '../../utils/helpers';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Design Tokens ────────────────────────────────────────────────────────────
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
  amber:   '#D97706',
  amberLt: '#FEF3C7',
  red:     '#EF4444',
  redLt:   '#FEE2E2',
  pink:    '#EC4899',
  pinkLt:  '#FDF2F8',
  blue:    '#3B82F6',
  blueLt:  '#EFF6FF',
  slate:   '#64748B',
  slateLt: '#F1F5F9',
  radius:  { sm:8, md:12, lg:16, xl:20, pill:999 },
  shadow:  {
    sm: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:6,  elevation:2 },
    md: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:4}, shadowOpacity:0.10, shadowRadius:12, elevation:4 },
  },
};

// ─── Constants ────────────────────────────────────────────────────────────────
const DAY_NAMES   = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const WEEK_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MONTH_LABELS = ['W1','W2','W3','W4'];

const SUBJECT_ICON_MAP = {
  math:        { icon:'calculator',         color:'#3B82F6', bg:'#EFF6FF' },
  maths:       { icon:'calculator',         color:'#3B82F6', bg:'#EFF6FF' },
  science:     { icon:'flask',              color:'#059669', bg:'#D1FAE5' },
  physics:     { icon:'atom',               color:'#8B5CF6', bg:'#EDE9FE' },
  chemistry:   { icon:'flask-outline',      color:'#EC4899', bg:'#FDF2F8' },
  biology:     { icon:'leaf',               color:'#059669', bg:'#D1FAE5' },
  english:     { icon:'book-alphabet',      color:'#F97316', bg:'#FFF7ED' },
  history:     { icon:'earth',              color:'#D97706', bg:'#FEF3C7' },
  geography:   { icon:'earth',              color:'#06B6D4', bg:'#CFFAFE' },
  computer:    { icon:'laptop',             color:'#4F46E5', bg:'#EEF2FF' },
  programming: { icon:'code-tags',          color:'#4F46E5', bg:'#EEF2FF' },
  art:         { icon:'palette',            color:'#EC4899', bg:'#FDF2F8' },
  music:       { icon:'music',              color:'#8B5CF6', bg:'#EDE9FE' },
  pe:          { icon:'run',                color:'#059669', bg:'#D1FAE5' },
  default:     { icon:'book-open-variant',  color:'#4F46E5', bg:'#EEF2FF' },
};

const getSubjectIcon = (name = '') => {
  const lower = name.toLowerCase();
  for (const [key, val] of Object.entries(SUBJECT_ICON_MAP)) {
    if (key !== 'default' && lower.includes(key)) return val;
  }
  return SUBJECT_ICON_MAP.default;
};

// ─── Date helpers ─────────────────────────────────────────────────────────────
const startOfWeek = () => {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

const toDateStr = (d) => d.toISOString().split('T')[0];

// ─── Badge ────────────────────────────────────────────────────────────────────
const Badge = ({ label, type = 'green' }) => {
  const cfg = {
    green:  { bg:'#D1FAE5', text:'#065F46' },
    amber:  { bg:'#FEF3C7', text:'#92400E' },
    red:    { bg:'#FEE2E2', text:'#991B1B' },
    blue:   { bg:'#EFF6FF', text:'#1D4ED8' },
    indigo: { bg:'#EEF2FF', text:'#3730A3' },
    pink:   { bg:'#FDF2F8', text:'#9D174D' },
    gray:   { bg:'#F1F5F9', text:'#475569' },
  };
  const c = cfg[type] || cfg.gray;
  return (
    <View style={{ backgroundColor:c.bg, paddingHorizontal:8, paddingVertical:3, borderRadius:T.radius.pill }}>
      <Text style={{ fontSize:10, fontWeight:'700', color:c.text }}>{label}</Text>
    </View>
  );
};

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader = ({ title, icon, color = T.indigo }) => (
  <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginTop:24, marginBottom:12 }}>
    <View style={{ width:32, height:32, borderRadius:10, backgroundColor:color+'22', alignItems:'center', justifyContent:'center' }}>
      <Ionicons name={icon} size={17} color={color} />
    </View>
    <Text style={{ fontSize:17, fontWeight:'800', color:T.textPri, letterSpacing:-0.3 }}>{title}</Text>
  </View>
);

// ─── Progress Bar ─────────────────────────────────────────────────────────────
const ProgressBar = ({ value, max = 100, color, height = 6 }) => {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  const c = color || (pct >= 80 ? T.green : pct >= 60 ? T.amber : pct > 0 ? T.red : T.textMut);
  return (
    <View style={{ height, backgroundColor:T.slateLt, borderRadius:height/2, overflow:'hidden' }}>
      <View style={{ width:`${pct}%`, height:'100%', backgroundColor:c, borderRadius:height/2 }} />
    </View>
  );
};

// ─── Mini Stat Card ───────────────────────────────────────────────────────────
const MiniStatCard = ({ label, value, sub, subType = 'green', icon, iconBg }) => (
  <View style={{ flex:1, backgroundColor:T.surface, borderRadius:T.radius.lg, padding:12, borderWidth:1, borderColor:T.border, ...T.shadow.sm }}>
    {icon && (
      <View style={{ width:32, height:32, borderRadius:9, backgroundColor:iconBg, alignItems:'center', justifyContent:'center', marginBottom:8 }}>
        {icon}
      </View>
    )}
    <Text style={{ fontSize:11, color:T.textSec, marginBottom:4, fontWeight:'600' }}>{label}</Text>
    <Text style={{ fontSize:22, fontWeight:'900', color:T.textPri, letterSpacing:-0.5 }}>{value}</Text>
    {sub && <Badge label={sub} type={subType} />}
  </View>
);

// ─── Subject Row ──────────────────────────────────────────────────────────────
const SubjectRow = ({ name, sessionCount, avg, iconName, iconColor, iconBg, hasData }) => {
  const badgeType  = !hasData ? 'gray'  : avg >= 80 ? 'green' : avg >= 65 ? 'amber' : 'red';
  const badgeLabel = !hasData ? 'No sessions' : `${avg}%`;
  return (
    <View style={{ paddingVertical:12, borderBottomWidth:1, borderBottomColor:T.border }}>
      <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
        <View style={{ width:40, height:40, borderRadius:12, backgroundColor:iconBg || T.indigoLt, alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <MaterialCommunityIcons name={iconName || 'book-outline'} size={20} color={iconColor || T.indigo} />
        </View>
        <View style={{ flex:1 }}>
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
            <Text style={{ fontSize:14, fontWeight:'800', color:T.textPri }}>{name}</Text>
            <Badge label={badgeLabel} type={badgeType} />
          </View>
          <Text style={{ fontSize:11, color:T.textSec, marginBottom: hasData ? 6 : 0 }}>
            {hasData
              ? `${sessionCount} session${sessionCount !== 1 ? 's' : ''} recorded`
              : 'No attendance recorded yet'}
          </Text>
          {hasData && <ProgressBar value={avg} />}
        </View>
      </View>
      {hasData && avg < 65 && (
        <View style={{ flexDirection:'row', alignItems:'center', gap:5, marginTop:8, backgroundColor:'#FEF2F2', padding:7, borderRadius:8 }}>
          <Ionicons name="warning-outline" size={13} color={T.red} />
          <Text style={{ fontSize:11, color:'#991B1B', fontWeight:'600' }}>Below 65% threshold — needs improvement</Text>
        </View>
      )}
    </View>
  );
};

// ─── Class Row ────────────────────────────────────────────────────────────────
const ClassRow = ({ rank, name, students, sessionCount, avg, hasData }) => {
  const badgeType = !hasData ? 'gray' : avg >= 80 ? 'green' : avg >= 65 ? 'amber' : 'red';
  const dotColor  = !hasData ? T.textMut : badgeType === 'green' ? T.green : badgeType === 'amber' ? T.amber : T.red;
  return (
    <View style={{ flexDirection:'row', alignItems:'center', gap:10, paddingVertical:11, borderBottomWidth:1, borderBottomColor:T.border }}>
      <Text style={{ fontSize:13, fontWeight:'900', color:T.textMut, width:18, textAlign:'center' }}>{rank}</Text>
      <View style={{ width:8, height:8, borderRadius:4, backgroundColor:dotColor }} />
      <View style={{ flex:1 }}>
        <Text style={{ fontSize:13, fontWeight:'800', color:T.textPri }}>{name}</Text>
        <Text style={{ fontSize:10, color:T.textSec }}>
          {students} student{students !== 1 ? 's' : ''} · {sessionCount} session{sessionCount !== 1 ? 's' : ''}
        </Text>
      </View>
      <Badge label={hasData ? `${avg}%` : 'No data'} type={badgeType} />
    </View>
  );
};

// ─── Filter Chip ──────────────────────────────────────────────────────────────
const FilterChip = ({ label, active, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      paddingHorizontal:13, paddingVertical:6, borderRadius:T.radius.pill,
      backgroundColor:active ? T.indigo : T.surface,
      borderWidth:1, borderColor:active ? T.indigo : T.border,
      marginRight:6,
    }}
  >
    <Text style={{ fontSize:11, fontWeight:'700', color:active ? '#fff' : T.textSec }}>{label}</Text>
  </TouchableOpacity>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const TeacherPerformanceScreen = ({ token, user, onBack }) => {
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [activeFilter, setActiveFilter] = useState('This Week');
  const [perf, setPerf]                 = useState(null);
  const [error, setError]               = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchPerformanceData = useCallback(async () => {
    setError(null);
    try {
      // ── 1. Timetable assignments ──────────────────────────────────────────
      const ttRaw = await api.get(`/timetable-assignments?user_id=${user?.id || ''}`, token).catch(() => []);
      const allAssignments = Array.isArray(ttRaw) ? ttRaw : (ttRaw?.assignments || []);

      // ── 2. Date range ─────────────────────────────────────────────────────
      let rangeStart, rangeEnd;
      if (activeFilter === 'Today') {
        rangeStart = rangeEnd = todayStr();
      } else if (activeFilter === 'This Week') {
        rangeStart = toDateStr(startOfWeek());
        rangeEnd   = todayStr();
      } else if (activeFilter === 'This Month') {
        rangeStart = toDateStr(startOfMonth());
        rangeEnd   = todayStr();
      } else {
        const d = new Date();
        d.setMonth(d.getMonth() - 4);
        rangeStart = toDateStr(d);
        rangeEnd   = todayStr();
      }

      // ── 3. Days that fall in range ────────────────────────────────────────
      const daysInRange = new Set();
      const cur = new Date(rangeStart);
      const endDate = new Date(rangeEnd);
      while (cur <= endDate) {
        daysInRange.add(DAY_NAMES[cur.getDay()]);
        cur.setDate(cur.getDate() + 1);
      }
      const scheduledInRange = allAssignments.filter(a => daysInRange.has(a.day));

      // ── 4. Date list ──────────────────────────────────────────────────────
      const dateList = [];
      const d2 = new Date(rangeStart);
      while (d2 <= endDate) { dateList.push(toDateStr(d2)); d2.setDate(d2.getDate() + 1); }

      // ── 5. Fetch sessions — batched ───────────────────────────────────────
      const mySubcatIds = [...new Set(allAssignments.map(a => a.subcategory_id).filter(Boolean))];
      const BATCH = 20;
      const sessionTasks = [];
      for (const date of dateList) for (const scId of mySubcatIds) sessionTasks.push({ date, scId });

      const allSessions = [];
      for (let i = 0; i < sessionTasks.length; i += BATCH) {
        const chunk = sessionTasks.slice(i, i + BATCH);
        const results = await Promise.all(
          chunk.map(({ date, scId }) =>
            api.get(`/attendance/sessions?date=${date}&subcategory_id=${scId}`, token)
              .then(d => {
                const list = Array.isArray(d) ? d : (d?.sessions || d?.data || []);
                return list.map(s => ({ ...s, _date: date }));
              })
              .catch(() => [])
          )
        );
        allSessions.push(...results.flat());
      }

      // ── 6. Fetch records — batched ────────────────────────────────────────
      const recordsBySessId = {};
      for (let i = 0; i < allSessions.length; i += BATCH) {
        const chunk = allSessions.slice(i, i + BATCH);
        const results = await Promise.all(
          chunk.map(sess =>
            api.get(`/attendance/sessions/${sess.id}/records`, token)
              .then(d => ({ sessId: sess.id, records: Array.isArray(d) ? d : (d?.records || d?.data || []) }))
              .catch(() => ({ sessId: sess.id, records: [] }))
          )
        );
        results.forEach(r => { recordsBySessId[r.sessId] = r.records; });
      }

      // ── 7. Today's stats ──────────────────────────────────────────────────
      const todayDayName   = DAY_NAMES[new Date().getDay()];
      const todayScheduled = allAssignments.filter(a => a.day === todayDayName);
      const todaySessions  = allSessions.filter(s => s._date === todayStr());
      const completedToday = todaySessions.length;
      const remainingToday = Math.max(0, todayScheduled.length - completedToday);

      // ── 8. Subject-wise performance ───────────────────────────────────────
      const subjectMap = {};
      allAssignments.forEach(a => {
        if (!a.subject_id) return;
        if (!subjectMap[a.subject_id]) {
          subjectMap[a.subject_id] = { name: a.subject_name || `Subject ${a.subject_id}`, sessionCount:0, totalPct:0 };
        }
      });

      allSessions.forEach(sess => {
        const records = recordsBySessId[sess.id] || [];
        const present = records.filter(r => r.status === 'present').length;
        const total   = records.length;
        if (total === 0) return;
        const pct = Math.round((present / total) * 100);
        const match = allAssignments.find(a =>
          String(a.subcategory_id) === String(sess.subcategory_id) &&
          (a.period_id ? String(a.period_id) === String(sess.period_id) : true)
        );
        const subjectId = match?.subject_id;
        if (subjectId && subjectMap[subjectId]) {
          subjectMap[subjectId].sessionCount++;
          subjectMap[subjectId].totalPct += pct;
        }
      });

      const subjects = Object.values(subjectMap).map(s => {
        const { icon, color, bg } = getSubjectIcon(s.name);
        const hasData = s.sessionCount > 0;
        return { name:s.name, sessionCount:s.sessionCount, avg: hasData ? Math.round(s.totalPct / s.sessionCount) : 0, hasData, iconName:icon, iconColor:color, iconBg:bg };
      });

      // ── 9. Class-wise engagement ──────────────────────────────────────────
      const classKeyMap = {};
      allAssignments.forEach(a => {
        const k = `${a.subcategory_id}_${a.item_id || 'none'}`;
        if (!classKeyMap[k]) {
          const nameParts = [a.category_name, a.subcategory_name, a.item_name].filter(Boolean);
          classKeyMap[k] = {
            name: nameParts.length > 0 ? nameParts.join(' ') : (a.class_name || `Class ${a.subcategory_id}`),
            subcategory_id: a.subcategory_id, item_id: a.item_id || null,
            totalPct:0, students:0, sessionCount:0,
          };
        }
      });

      allSessions.forEach(sess => {
        const k = `${sess.subcategory_id}_${sess.item_id || 'none'}`;
        if (!classKeyMap[k]) return;
        const records = recordsBySessId[sess.id] || [];
        const present = records.filter(r => r.status === 'present').length;
        const total   = records.length;
        classKeyMap[k].sessionCount++;
        if (total > 0) classKeyMap[k].totalPct += Math.round((present / total) * 100);
      });

      const classEntries = Object.entries(classKeyMap);
      for (let i = 0; i < classEntries.length; i += BATCH) {
        const chunk = classEntries.slice(i, i + BATCH);
        await Promise.all(chunk.map(async ([k, cls]) => {
          try {
            const url = `/students?subcategory_id=${cls.subcategory_id}${cls.item_id ? `&item_id=${cls.item_id}` : ''}`;
            const sData = await api.get(url, token).catch(() => []);
            const sList = Array.isArray(sData) ? sData : (sData?.students || sData?.data || []);
            classKeyMap[k].students = sList.length;
          } catch { classKeyMap[k].students = 0; }
        }));
      }

      const classes = Object.values(classKeyMap).map(c => {
        const hasData = c.sessionCount > 0;
        return { name:c.name, students:c.students, sessionCount:c.sessionCount, avg: hasData ? Math.round(c.totalPct / c.sessionCount) : 0, hasData };
      }).sort((a, b) => {
        if (a.hasData && !b.hasData) return -1;
        if (!a.hasData && b.hasData) return 1;
        return b.avg - a.avg;
      });

      // ── 10. Overall stats ─────────────────────────────────────────────────
      let totalPresent = 0, totalStudentsInRecords = 0;
      allSessions.forEach(sess => {
        const records = recordsBySessId[sess.id] || [];
        totalPresent           += records.filter(r => r.status === 'present').length;
        totalStudentsInRecords += records.length;
      });
      const avgAttendance = totalStudentsInRecords > 0
        ? Math.round((totalPresent / totalStudentsInRecords) * 100) : 0;

      const markedPct = scheduledInRange.length > 0
        ? Math.min(100, Math.round((allSessions.length / scheduledInRange.length) * 100)) : 0;

      const pendingSessions    = Math.max(0, scheduledInRange.length - allSessions.length);
      const totalStudentsCount = Object.values(classKeyMap).reduce((s, c) => s + c.students, 0);

      // ── 11. Period completion rate ────────────────────────────────────────
      const periodCompletionRate = scheduledInRange.length > 0
        ? Math.min(100, Math.round((allSessions.length / scheduledInRange.length) * 100)) : 0;

      // ── 12. Score ─────────────────────────────────────────────────────────
      const hasAnyData = allSessions.length > 0;
      const score = hasAnyData
        ? Math.round((markedPct * 0.4) + (avgAttendance * 0.4) + (periodCompletionRate * 0.2))
        : 0;
      const scoreLabel = !hasAnyData ? 'No data yet'
        : score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 55 ? 'Average' : 'Needs Improvement';

      // ── 13. Alerts ────────────────────────────────────────────────────────
      const alerts = [];

      if (!hasAnyData && scheduledInRange.length === 0) {
        alerts.push({
          title: 'No timetable assigned',
          desc:  'Contact your admin to get classes assigned to you.',
          type:  'blue',
        });
      } else if (!hasAnyData && scheduledInRange.length > 0) {
        alerts.push({
          title: 'No sessions recorded yet',
          desc:  'Start marking attendance to see your performance stats.',
          type:  'blue',
        });
      } else {
        if (pendingSessions > 0) {
          alerts.push({
            title: `${pendingSessions} session${pendingSessions !== 1 ? 's' : ''} not marked`,
            desc:  'Mark attendance for past classes to maintain accuracy.',
            type:  'amber',
          });
        }
        if (avgAttendance > 0 && avgAttendance < 65) {
          alerts.push({
            title: 'Low average attendance',
            desc:  'Overall student attendance is below 65%. Consider follow-up.',
            type:  'red',
          });
        } else if (avgAttendance >= 80) {
          alerts.push({
            title: 'Great attendance rates!',
            desc:  'Your classes maintain strong attendance — keep it up.',
            type:  'green',
          });
        }
      }

      // ── 14. Efficiency breakdown ──────────────────────────────────────────
      const efficiencyBreakdown = [
        { label:'Sessions Marked',  value: markedPct,            color: T.indigo },
        { label:'Avg Attendance',   value: avgAttendance,        color: T.green  },
        { label:'Completion Rate',  value: periodCompletionRate, color: T.amber  },
      ];

      const classesWithData = classes.filter(c => c.hasData);
      const overallAvg = classesWithData.length > 0
        ? Math.round(classesWithData.reduce((s, c) => s + c.avg, 0) / classesWithData.length) : 0;

      const bestClass  = classesWithData[0] || null;
      const worstClass = classesWithData.length > 1 ? classesWithData[classesWithData.length - 1] : null;

      setPerf({
        score, scoreLabel,
        scoreRank: hasAnyData ? `Score: ${score}/100` : 'Mark sessions to get your score',
        classesTaken:     allSessions.length,
        markedPct,
        avgAttendance,
        pendingSessions,
        totalStudents:    totalStudentsCount,
        scheduledToday:   todayScheduled.length,
        completedToday,
        remainingToday,
        subjects,
        classes,
        bestClass,
        worstClass,
        alerts,
        efficiencyBreakdown,
        overallTrend:     overallAvg >= 75 ? '▲ On Track' : overallAvg > 0 ? '▼ Needs Focus' : '— No data',
        overallTrendType: overallAvg >= 75 ? 'green' : overallAvg > 0 ? 'red' : 'gray',
        hasAnyData,
      });

      Animated.timing(fadeAnim, { toValue:1, duration:500, useNativeDriver:true }).start();
    } catch (err) {
      console.error('TeacherPerformanceScreen fetch error:', err);
      setError(err?.message || 'Failed to load performance data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter, user?.id]);

  useEffect(() => {
    setPerf(null);
    fadeAnim.setValue(0);
    setLoading(true);
    fetchPerformanceData();
  }, [fetchPerformanceData]);

  const onRefresh = () => { setRefreshing(true); fetchPerformanceData(); };
  const onFilterChange = (f) => setActiveFilter(f);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex:1, backgroundColor:T.bg }}>
        <LinearGradient
          colors={['#1E1B4B','#3730A3','#4F46E5']}
          start={{x:0,y:0}} end={{x:1,y:1}}
          style={{ paddingTop:Platform.OS==='ios'?55:45, paddingBottom:26, paddingHorizontal:20 }}
        >
          {onBack && (
            <TouchableOpacity onPress={onBack} style={{ width:36, height:36, borderRadius:11, backgroundColor:'rgba(255,255,255,0.15)', alignItems:'center', justifyContent:'center', marginBottom:12 }}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
          )}
          <Text style={{ fontSize:24, fontWeight:'900', color:'#fff' }}>Performance</Text>
          <Text style={{ fontSize:13, color:'rgba(255,255,255,0.7)', marginTop:5 }}>Loading your stats…</Text>
        </LinearGradient>
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator size="large" color={T.indigo} />
          <Text style={{ marginTop:16, color:T.textSec, fontWeight:'600' }}>Calculating performance…</Text>
        </View>
      </View>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={{ flex:1, backgroundColor:T.bg }}>
        <LinearGradient
          colors={['#1E1B4B','#3730A3','#4F46E5']}
          start={{x:0,y:0}} end={{x:1,y:1}}
          style={{ paddingTop:Platform.OS==='ios'?55:45, paddingBottom:26, paddingHorizontal:20 }}
        >
          {onBack && (
            <TouchableOpacity onPress={onBack} style={{ width:36, height:36, borderRadius:11, backgroundColor:'rgba(255,255,255,0.15)', alignItems:'center', justifyContent:'center', marginBottom:12 }}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
          )}
          <Text style={{ fontSize:24, fontWeight:'900', color:'#fff' }}>Performance</Text>
        </LinearGradient>
        <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:20 }}>
          <Ionicons name="alert-circle-outline" size={48} color={T.red} />
          <Text style={{ marginTop:16, color:T.textPri, fontSize:16, fontWeight:'600', textAlign:'center' }}>Could not load data</Text>
          <Text style={{ marginTop:8, color:T.textSec, textAlign:'center' }}>{error}</Text>
          <TouchableOpacity
            onPress={() => { setLoading(true); fetchPerformanceData(); }}
            style={{ marginTop:20, backgroundColor:T.indigo, paddingHorizontal:20, paddingVertical:10, borderRadius:T.radius.md }}
          >
            <Text style={{ color:'#fff', fontWeight:'600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const filters = ['Today','This Week','This Month','This Semester'];

  return (
    <ScrollView
      style={{ flex:1, backgroundColor:T.bg }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.indigo} />}
    >
      {/* ── Hero Header ── */}
      <LinearGradient
        colors={['#1E1B4B','#3730A3','#4F46E5']}
        start={{x:0,y:0}} end={{x:1,y:1}}
        style={{ paddingTop:Platform.OS==='ios'?55:45, paddingBottom:26, paddingHorizontal:20, overflow:'hidden' }}
      >
        <View style={{ position:'absolute', top:-30, right:-30, width:150, height:150, borderRadius:75, borderWidth:1, borderColor:'rgba(255,255,255,0.06)' }} />
        <View style={{ position:'absolute', top:20, right:30, width:80, height:80, borderRadius:40, borderWidth:1, borderColor:'rgba(255,255,255,0.06)' }} />
        <View style={{ position:'absolute', bottom:-20, left:-10, width:100, height:100, borderRadius:50, backgroundColor:'rgba(255,255,255,0.04)' }} />

        {/* Extra back button REMOVED — navigation uses the app-level back button only */}
        <View style={{ flexDirection:'row', alignItems:'center', marginBottom:16 }}>
          <View style={{ flex:1 }}>
            <Text style={{ fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:'700', letterSpacing:1.5, textTransform:'uppercase', marginBottom:6 }}>Teacher Portal</Text>
            <Text style={{ fontSize:28, fontWeight:'900', color:'#fff', letterSpacing:-0.5 }}>Performance</Text>
          </View>
          <Ionicons name="trophy" size={26} color="rgba(255,255,255,0.8)" />
        </View>

        {/* Score card */}
        <View style={{ flexDirection:'row', alignItems:'center', gap:14 }}>
          <View style={{ backgroundColor:'rgba(255,255,255,0.12)', borderRadius:T.radius.xl, padding:14, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.15)' }}>
            <Text style={{ fontSize:32, fontWeight:'900', color:'#fff' }}>
              {perf?.hasAnyData ? (perf?.score ?? 0) : '—'}
            </Text>
            <Text style={{ fontSize:11, color:'rgba(255,255,255,0.7)', fontWeight:'600' }}>/100</Text>
            <Text style={{ fontSize:9, color:'rgba(255,255,255,0.5)', marginTop:2 }}>Score</Text>
          </View>
          <View style={{ flex:1, gap:6 }}>
            <Text style={{ fontSize:15, fontWeight:'800', color:'#fff' }}>{perf?.scoreLabel}</Text>
            <Text style={{ fontSize:12, color:'rgba(255,255,255,0.7)' }}>{perf?.scoreRank}</Text>
          </View>
        </View>

        {/* Mini stats row */}
        <View style={{ flexDirection:'row', gap:8, marginTop:16 }}>
          {[
            { label:'Sessions', value: perf?.classesTaken ?? 0 },
            { label:'Marked %', value: perf?.hasAnyData ? `${perf?.markedPct ?? 0}%` : '—' },
            { label:'Students', value: perf?.totalStudents ?? 0 },
            { label:'Pending',  value: perf?.pendingSessions ?? 0 },
          ].map((s, i) => (
            <View key={i} style={{ flex:1, backgroundColor:'rgba(255,255,255,0.12)', borderRadius:T.radius.md, padding:10, alignItems:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.1)' }}>
              <Text style={{ fontSize:16, fontWeight:'900', color:'#fff', letterSpacing:-0.3 }}>{s.value}</Text>
              <Text style={{ fontSize:8, color:'rgba(255,255,255,0.65)', marginTop:2, fontWeight:'600', textAlign:'center' }}>{s.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <Animated.View style={{ paddingHorizontal:16, paddingBottom:40, paddingTop:20, opacity:fadeAnim }}>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:4 }}>
          {filters.map(f => (
            <FilterChip key={f} label={f} active={activeFilter === f} onPress={() => onFilterChange(f)} />
          ))}
        </ScrollView>

        {/* ── Performance Overview ── */}
        <SectionHeader title="Performance Overview" icon="speedometer-outline" color={T.indigo} />
        <View style={{ flexDirection:'row', gap:10, marginBottom:10 }}>
          <MiniStatCard
            label="Sessions Taken"
            value={perf?.classesTaken ?? 0}
            sub={perf?.hasAnyData ? 'Recorded' : 'None yet'}
            subType={perf?.hasAnyData ? 'green' : 'gray'}
            icon={<Ionicons name="school-outline" size={16} color={T.indigo} />}
            iconBg={T.indigoLt}
          />
          <MiniStatCard
            label="Marked on Time"
            value={perf?.hasAnyData ? `${perf?.markedPct ?? 0}%` : '—'}
            sub={perf?.hasAnyData ? 'On time' : 'No sessions'}
            subType={perf?.hasAnyData ? 'green' : 'gray'}
            icon={<Ionicons name="checkmark-circle-outline" size={16} color={T.green} />}
            iconBg={T.greenLt}
          />
        </View>
        <View style={{ flexDirection:'row', gap:10, marginBottom:10 }}>
          <MiniStatCard
            label="Avg Attendance"
            value={perf?.hasAnyData ? (perf?.avgAttendance ? `${perf.avgAttendance}%` : '0%') : '—'}
            sub={
              !perf?.hasAnyData ? 'No data yet'
              : perf?.avgAttendance >= 75 ? 'Good'
              : perf?.avgAttendance > 0   ? 'Needs Attention'
              : 'No records'
            }
            subType={
              !perf?.hasAnyData ? 'gray'
              : perf?.avgAttendance >= 75 ? 'green'
              : perf?.avgAttendance > 0   ? 'amber'
              : 'gray'
            }
            icon={<Ionicons name="people-outline" size={16} color={T.amber} />}
            iconBg={T.amberLt}
          />
          <MiniStatCard
            label="Pending Sessions"
            value={perf?.pendingSessions ?? 0}
            sub={perf?.pendingSessions > 0 ? 'Needs action' : 'All clear'}
            subType={perf?.pendingSessions > 0 ? 'red' : 'green'}
            icon={<Ionicons name="alert-circle-outline" size={16} color={T.red} />}
            iconBg={T.redLt}
          />
        </View>

        {/* ── Today's Summary ── */}
        <SectionHeader title="Today's Summary" icon="today-outline" color="#0EA5E9" />
        <View style={{ backgroundColor:T.surface, borderRadius:T.radius.xl, padding:16, borderWidth:1, borderColor:T.border, ...T.shadow.sm }}>
          <View style={{ flexDirection:'row', marginBottom:14 }}>
            {[
              { val: perf?.scheduledToday ?? 0, label:'Scheduled', color:T.indigo },
              { val: perf?.completedToday ?? 0, label:'Completed',  color:T.green  },
              { val: perf?.remainingToday ?? 0, label:'Remaining',  color:T.red    },
            ].map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <View style={{ width:1, backgroundColor:T.border, marginVertical:4 }} />}
                <View style={{ flex:1, alignItems:'center', paddingVertical:8 }}>
                  <Text style={{ fontSize:28, fontWeight:'900', color:s.color, letterSpacing:-1 }}>{s.val}</Text>
                  <Text style={{ fontSize:10, color:T.textSec, marginTop:2, fontWeight:'700' }}>{s.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
          <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:5 }}>
            <Text style={{ fontSize:11, color:T.textSec, fontWeight:'600' }}>Today's Progress</Text>
            <Text style={{ fontSize:11, color:T.indigo, fontWeight:'800' }}>
              {perf?.scheduledToday
                ? Math.round(((perf.completedToday ?? 0) / perf.scheduledToday) * 100)
                : 0}%
            </Text>
          </View>
          <ProgressBar value={perf?.completedToday ?? 0} max={Math.max(perf?.scheduledToday ?? 1, 1)} color={T.indigo} height={7} />
          {(perf?.scheduledToday ?? 0) === 0 && (
            <Text style={{ fontSize:12, color:T.textMut, textAlign:'center', marginTop:10, fontStyle:'italic' }}>
              No sessions scheduled for today
            </Text>
          )}
        </View>

        {/* ── Attendance Trend REMOVED ── */}

        {/* ── Subject-wise Performance ── */}
        {perf?.subjects?.length > 0 && (
          <>
            <SectionHeader title="Subject-wise Performance" icon="book-outline" color={T.green} />
            <View style={{ backgroundColor:T.surface, borderRadius:T.radius.xl, paddingHorizontal:16, borderWidth:1, borderColor:T.border, ...T.shadow.sm }}>
              {perf.subjects.map((s, i) => <SubjectRow key={i} {...s} />)}
            </View>
          </>
        )}

        {/* ── Class Engagement ── */}
        {perf?.classes?.length > 0 && (
          <>
            <SectionHeader title="Class Engagement" icon="people-outline" color="#7C3AED" />
            {perf.bestClass && perf.worstClass && perf.bestClass.name !== perf.worstClass.name && (
              <View style={{ flexDirection:'row', gap:10, marginBottom:12 }}>
                <View style={{ flex:1, backgroundColor:'#F0FDF4', borderRadius:T.radius.lg, padding:12, borderWidth:1, borderColor:'#BBF7D0' }}>
                  <Text style={{ fontSize:10, color:T.green, fontWeight:'700', marginBottom:4 }}>★ Best Class</Text>
                  <Text style={{ fontSize:14, fontWeight:'800', color:'#065F46' }} numberOfLines={1}>{perf.bestClass.name}</Text>
                  <Text style={{ fontSize:12, color:T.green, marginTop:2 }}>{perf.bestClass.avg}% avg</Text>
                </View>
                <View style={{ flex:1, backgroundColor:'#FEF2F2', borderRadius:T.radius.lg, padding:12, borderWidth:1, borderColor:'#FECACA' }}>
                  <Text style={{ fontSize:10, color:T.red, fontWeight:'700', marginBottom:4 }}>⚠ Needs Attention</Text>
                  <Text style={{ fontSize:14, fontWeight:'800', color:'#991B1B' }} numberOfLines={1}>{perf.worstClass.name}</Text>
                  <Text style={{ fontSize:12, color:T.red, marginTop:2 }}>{perf.worstClass.avg}% avg</Text>
                </View>
              </View>
            )}
            <View style={{ backgroundColor:T.surface, borderRadius:T.radius.xl, paddingHorizontal:16, borderWidth:1, borderColor:T.border, ...T.shadow.sm }}>
              {perf.classes.map((c, i) => <ClassRow key={i} rank={i+1} {...c} />)}
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:12 }}>
                <Text style={{ fontSize:11, color:T.textSec }}>Overall trend</Text>
                <Badge label={perf.overallTrend} type={perf.overallTrendType} />
              </View>
            </View>
          </>
        )}

        {/* ── Alerts & Insights ── */}
        {perf?.alerts?.length > 0 && (
          <>
            <SectionHeader title="Alerts & Insights" icon="notifications-outline" color={T.red} />
            {perf.alerts.map((a, i) => {
              const cfg = {
                red:   { bg:'#FEF2F2', iconBg:'#FEE2E2', icon:'warning-outline',            iconColor:T.red,   titleColor:'#991B1B' },
                amber: { bg:'#FFFBEB', iconBg:'#FEF3C7', icon:'time-outline',               iconColor:T.amber, titleColor:'#92400E' },
                green: { bg:'#F0FDF4', iconBg:'#D1FAE5', icon:'trending-up-outline',        iconColor:T.green, titleColor:'#065F46' },
                blue:  { bg:'#EFF6FF', iconBg:'#DBEAFE', icon:'information-circle-outline', iconColor:T.blue,  titleColor:'#1D4ED8' },
              };
              const c = cfg[a.type] || cfg.amber;
              return (
                <View key={i} style={{ flexDirection:'row', alignItems:'flex-start', gap:10, padding:11, backgroundColor:c.bg, borderRadius:T.radius.md, marginBottom:8 }}>
                  <View style={{ width:34, height:34, borderRadius:10, backgroundColor:c.iconBg, alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <Ionicons name={c.icon} size={17} color={c.iconColor} />
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={{ fontSize:13, fontWeight:'800', color:c.titleColor }}>{a.title}</Text>
                    <Text style={{ fontSize:11, color:T.textSec, marginTop:2 }}>{a.desc}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* ── Efficiency Score ── */}
        {perf?.hasAnyData && perf?.efficiencyBreakdown && (
          <>
            <SectionHeader title="Efficiency Score" icon="trophy-outline" color={T.amber} />
            <View style={{ backgroundColor:T.surface, borderRadius:T.radius.xl, padding:16, borderWidth:1, borderColor:T.border, ...T.shadow.sm }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:16, marginBottom:20 }}>
                <View style={{ width:80, height:80, borderRadius:40, backgroundColor:T.indigoLt, alignItems:'center', justifyContent:'center' }}>
                  <Text style={{ fontSize:28, fontWeight:'900', color:T.indigo }}>{perf.score}</Text>
                  <Text style={{ fontSize:10, color:T.textSec }}>/100</Text>
                </View>
                <View style={{ flex:1 }}>
                  <Text style={{ fontSize:18, fontWeight:'900', color:T.textPri }}>{perf.scoreLabel}</Text>
                  <Text style={{ fontSize:12, color:T.textSec, marginTop:2 }}>{perf.scoreRank}</Text>
                </View>
              </View>
              {perf.efficiencyBreakdown.map((e, i) => (
                <View key={i} style={{ marginBottom:12 }}>
                  <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:5 }}>
                    <Text style={{ fontSize:12, color:T.textSec, fontWeight:'600' }}>{e.label}</Text>
                    <Text style={{ fontSize:12, fontWeight:'800', color:e.color }}>{e.value}%</Text>
                  </View>
                  <ProgressBar value={e.value} color={e.color} height={6} />
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Empty state ── */}
        {!perf?.hasAnyData && (
          <View style={{ backgroundColor:T.surface, borderRadius:T.radius.xl, padding:40, alignItems:'center', borderWidth:1, borderColor:T.border, borderStyle:'dashed', marginTop:8 }}>
            <View style={{ width:64, height:64, borderRadius:20, backgroundColor:T.indigoLt, alignItems:'center', justifyContent:'center', marginBottom:12 }}>
              <Ionicons name="bar-chart-outline" size={34} color={T.indigo} />
            </View>
            <Text style={{ fontSize:16, fontWeight:'800', color:T.textPri }}>No Sessions Recorded</Text>
            <Text style={{ fontSize:13, color:T.textSec, marginTop:4, textAlign:'center' }}>
              Take attendance to start seeing performance stats here.
            </Text>
          </View>
        )}

      </Animated.View>
    </ScrollView>
  );
};

export default TeacherPerformanceScreen;