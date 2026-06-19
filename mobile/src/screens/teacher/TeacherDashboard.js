import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, ScrollView,
  RefreshControl, Animated, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { C } from '../../config/constants';
import { api } from '../../api/client';
import { todayStr, buildClassMap, getClassName, formatTime, hasFaceRegistered } from '../../utils/helpers';
import PremiumToast from '../../components/PremiumToast';

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
  slate:   '#64748B',
  slateLt: '#F1F5F9',
  radius:  { sm:8, md:12, lg:16, xl:20, pill:999 },
  shadow:  {
    sm: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:6, elevation:2 },
    md: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:4}, shadowOpacity:0.10, shadowRadius:12, elevation:4 },
    lg: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:8}, shadowOpacity:0.14, shadowRadius:20, elevation:8 },
  },
};

// ─── Helper Components ────────────────────────────────────────────────────────
export const getPeriodStatus = (startRaw, endRaw) => {
  if (!startRaw) return 'upcoming';
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = String(startRaw).split(':').map(Number);
  const startMins = sh * 60 + (sm || 0);
  let endMins = startMins + 60;
  if (endRaw) { const [eh, em] = String(endRaw).split(':').map(Number); endMins = eh * 60 + (em || 0); }
  if (nowMins < startMins) return 'upcoming';
  if (nowMins <= endMins) return 'ongoing';
  return 'completed';
};

const SectionHeader = ({ title, icon, color = T.indigo, subtitle }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: '800', color: T.textPri, letterSpacing: -0.3 }}>{title}</Text>
    </View>
    {subtitle && <Text style={{ fontSize: 11, color: T.textSec, fontWeight: '600' }}>{subtitle}</Text>}
  </View>
);

const ClassStatCard = ({ cls, isClassTeacher }) => {
  const attendancePct = cls.total > 0 ? Math.round((cls.present / cls.total) * 100) : 0;
  const barColor = attendancePct >= 80 ? T.green : attendancePct >= 60 ? T.amber : '#EF4444';
  return (
    <View style={{
      backgroundColor: T.surface, borderRadius: T.radius.xl, marginBottom: 12, overflow: 'hidden',
      borderWidth: 1, borderColor: T.border, ...T.shadow.sm,
    }}>
      <LinearGradient
        colors={isClassTeacher ? ['#4F46E5', '#7C3AED'] : ['#F59E0B', '#B45309']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="school" size={20} color="#fff" />
          </View>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff', flex: 1 }} numberOfLines={1}>{cls.name}</Text>
        </View>
        {isClassTeacher && (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: T.radius.pill }}>
            <Text style={{ fontSize: 9, color: '#fff', fontWeight: '800', letterSpacing: 0.5 }}>★ HEAD</Text>
          </View>
        )}
      </LinearGradient>

      <View style={{ flexDirection: 'row', paddingVertical: 8 }}>
        {[
          { val: cls.total,   label: 'Total',   color: T.textPri },
          { val: cls.present, label: 'Present', color: T.green },
          { val: cls.absent,  label: 'Absent',  color: '#EF4444' },
        ].map((stat, i) => (
          <React.Fragment key={stat.label}>
            {i > 0 && <View style={{ width: 1, backgroundColor: T.border, marginVertical: 12 }} />}
            <View style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: stat.color, letterSpacing: -1 }}>{stat.val}</Text>
              <Text style={{ fontSize: 10, color: T.textSec, marginTop: 2, fontWeight: '700', textTransform: 'uppercase' }}>{stat.label}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      {cls.total > 0 && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
            <Text style={{ fontSize: 10, fontWeight: '600', color: T.textSec }}>Attendance Rate</Text>
            <Text style={{ fontSize: 10, fontWeight: '800', color: barColor }}>{attendancePct}%</Text>
          </View>
          <View style={{ height: 5, backgroundColor: T.slateLt, borderRadius: 3, overflow: 'hidden' }}>
            <View style={{ width: `${attendancePct}%`, height: '100%', backgroundColor: barColor, borderRadius: 3 }} />
          </View>
        </View>
      )}
    </View>
  );
};

const ScheduleCard = ({ item, attData, periodStatus }) => {
  const startTime = formatTime(item.start_time);
  const endTime = formatTime(item.end_time);
  const statusCfg = {
    upcoming:  { label: 'Yet to Start', stripe: '#3B82F6', badge: '#EFF6FF', badgeText: '#1D4ED8', dot: '#3B82F6' },
    ongoing:   { label: 'Ongoing',      stripe: '#F59E0B', badge: '#FEF3C7', badgeText: '#92400E', dot: '#F59E0B' },
    completed: { label: 'Completed',    stripe: T.green,   badge: T.greenLt, badgeText: '#065F46', dot: T.green },
    not_taken: { label: 'Not Taken',    stripe: '#EF4444', badge: '#FEE2E2', badgeText: '#991B1B', dot: '#EF4444' },
  };
  const sc = statusCfg[periodStatus];
  const hasTaken = !!attData;

  return (
    <View style={{
      backgroundColor: T.surface, borderRadius: T.radius.xl, marginBottom: 10, overflow: 'hidden',
      borderWidth: 1, borderColor: sc.stripe + '40', ...T.shadow.sm,
    }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 5, backgroundColor: sc.stripe }} />
        <View style={{ flex: 1, padding: 14, paddingLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <LinearGradient
              colors={periodStatus === 'ongoing' ? [T.amber, '#B45309'] : [T.indigo, '#7C3AED']}
              style={{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
            >
              <Text style={{ fontSize: 11, fontWeight: '900', color: '#fff' }}>P{item.period_number}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: T.textPri, flex: 1 }} numberOfLines={1}>
                  {item.subject_name || 'Subject'}
                </Text>
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: sc.badge, paddingHorizontal: 8, paddingVertical: 3, borderRadius: T.radius.pill, marginLeft: 8,
                }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: sc.dot }} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: sc.badgeText }}>{sc.label}</Text>
                </View>
              </View>
              {startTime && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Ionicons name="time-outline" size={12} color={T.textSec} />
                  <Text style={{ fontSize: 12, color: T.textSec }}>{startTime} – {endTime}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: T.indigoLt, paddingHorizontal: 8, paddingVertical: 4, borderRadius: T.radius.pill }}>
              <MaterialCommunityIcons name="school" size={12} color={T.indigo} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: T.indigo }} numberOfLines={1}>{getClassName(item)}</Text>
            </View>
            {hasTaken && (
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                {[
                  { val: attData.total,   label: 'Total',   color: T.textPri },
                  { val: attData.present, label: 'Present', color: T.green },
                  { val: attData.absent,  label: 'Absent',  color: '#EF4444' },
                ].map((s, i) => (
                  <React.Fragment key={s.label}>
                    {i > 0 && <View style={{ width: 1, height: 20, backgroundColor: T.border }} />}
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ fontSize: 14, fontWeight: '900', color: s.color }}>{s.val}</Text>
                      <Text style={{ fontSize: 9, color: T.textSec, fontWeight: '700' }}>{s.label}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

// ─── QuickActionButton ────────────────────────────────────────────────────────
const QuickActionButton = ({ icon, title, subtitle, screen, bg, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handleIn  = () => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true }).start();
  const handleOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], flex: 1 }}>
      <TouchableOpacity
        onPress={() => onPress(screen)}
        onPressIn={handleIn}
        onPressOut={handleOut}
        activeOpacity={0.9}
        style={{
          backgroundColor: T.surface,
          borderRadius: T.radius.lg,
          paddingVertical: 14,
          paddingHorizontal: 8,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: T.border,
          ...T.shadow.sm,
        }}
      >
        <View style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}>
          {icon}
        </View>
        <Text style={{
          fontSize: 12,
          fontWeight: '800',
          color: T.textPri,
          textAlign: 'center',
          lineHeight: 16,
        }}>
          {title}
        </Text>
        <Text style={{
          fontSize: 10,
          color: T.textSec,
          textAlign: 'center',
          marginTop: 2,
          fontWeight: '600',
        }}>
          {subtitle}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const TeacherDashboard = ({ token, user, onNavigate }) => {
  const [todaySessions, setTodaySessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myClasses, setMyClasses] = useState([]);
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [todayAttMap, setTodayAttMap] = useState({});
  const [subjectCount, setSubjectCount] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const fetchClassStats = async (cls) => {
    try {
      const sData = await api.get(
        `/students?subcategory_id=${cls.subcategory_id}${cls.item_id ? `&item_id=${cls.item_id}` : ''}`, token
      ).catch(() => []);
      const sList = Array.isArray(sData) ? sData : (sData?.students || sData?.data || []);
      const total = sList.length;
      const studentIds = new Set(sList.map(s => s.id));
      const itemFilter = cls.item_id ? `&item_id=${cls.item_id}` : '';
      const sessData = await api.get(
        `/attendance/sessions?date=${todayStr()}&subcategory_id=${cls.subcategory_id}${itemFilter}`, token
      ).catch(() => []);
      const allSessions = Array.isArray(sessData) ? sessData : (sessData?.sessions || sessData?.data || []);
      const sessions = allSessions.filter(sess => {
        const sameSubcat = String(sess.subcategory_id) === String(cls.subcategory_id);
        const sameItem = cls.item_id
          ? String(sess.item_id) === String(cls.item_id)
          : !sess.item_id || sess.item_id === null || sess.item_id === '';
        return sameSubcat && sameItem;
      });
      const firstSession = sessions.sort((a, b) => (a.period_number ?? 99) - (b.period_number ?? 99))[0];
      let present = new Set(), absent = new Set();
      if (firstSession) {
        const recs = await api.get(`/attendance/sessions/${firstSession.id}/records`, token).catch(() => []);
        const recList = Array.isArray(recs) ? recs : (recs?.records || recs?.data || []);
        recList.forEach(r => {
          if (!studentIds.has(r.student_id)) return;
          if (r.status === 'present') present.add(r.student_id);
          else if (r.status === 'absent') absent.add(r.student_id);
        });
      }
      return { total, present: present.size, absent: absent.size };
    } catch {
      return { total: 0, present: 0, absent: 0 };
    }
  };

  const loadData = async () => {
    try {
      const todayKey = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date().getDay()];
      const [ttData, ctData] = await Promise.all([
        api.get(`/timetable-assignments?user_id=${user?.id || ''}`, token).catch(() => []),
        api.get('/class-teachers', token).catch(() => []),
      ]);
      const list = Array.isArray(ttData) ? ttData : (ttData?.assignments || []);
      const ctList = Array.isArray(ctData) ? ctData : [];
      const todayList = list.filter(item => item.day === todayKey).sort((a, b) => a.period_number - b.period_number);
      setTodaySessions(todayList);

      const todayClassKeys = new Map();
      todayList.forEach(item => {
        const k = `${item.subcategory_id}_${item.item_id || ''}`;
        if (!todayClassKeys.has(k)) todayClassKeys.set(k, { subcategory_id: item.subcategory_id, item_id: item.item_id });
      });
      const todaySessFetches = [...todayClassKeys.values()].map(cls =>
        api.get(`/attendance/sessions?date=${todayStr()}&subcategory_id=${cls.subcategory_id}`, token)
          .then(d => (Array.isArray(d) ? d : (d?.sessions || d?.data || []))
            .filter(s => {
              const sameSubcat = String(s.subcategory_id) === String(cls.subcategory_id);
              const sameItem = cls.item_id
                ? String(s.item_id) === String(cls.item_id)
                : !s.item_id || s.item_id === null || s.item_id === '';
              return sameSubcat && sameItem;
            })
          ).catch(() => [])
      );
      const allTodaySessList = (await Promise.all(todaySessFetches)).flat();
      const allRecordsFetches = allTodaySessList.map(sess =>
        api.get(`/attendance/sessions/${sess.id}/records`, token)
          .then(d => ({ sessId: sess.id, records: Array.isArray(d) ? d : (d?.records || d?.data || []) }))
          .catch(() => ({ sessId: sess.id, records: [] }))
      );
      const allRecordsResult = await Promise.all(allRecordsFetches);
      const attMap = {};
      allTodaySessList.forEach(sess => {
        const recResult = allRecordsResult.find(r => r.sessId === sess.id);
        const records = recResult?.records || [];
        let present = 0, absent = 0;
        records.forEach(r => {
          if (r.status === 'present') present++;
          else if (r.status === 'absent') absent++;
        });
        const key = `${sess.subcategory_id}_${sess.item_id || ''}_${sess.period_id || ''}`;
        attMap[key] = { present, absent, total: present + absent };
      });
      setTodayAttMap(attMap);

      let myStaffId = null;
      if (user?.email) {
        try {
          const staffData = await api.get(`/staff/by-email/${encodeURIComponent(user.email)}`, token);
          myStaffId = staffData?.id || null;
        } catch { }
      }
      if (!myStaffId && list.length > 0) {
        const ids = [...new Set(list.map(a => a.staff_id).filter(Boolean))];
        if (ids.length === 1) myStaffId = ids[0];
      }
      if (!myStaffId && user?.full_name && ctList.length > 0) {
        const nameMatch = ctList.find(ct =>
          ct.staff_name?.trim().toLowerCase() === user.full_name.trim().toLowerCase()
        );
        if (nameMatch) myStaffId = nameMatch.staff_id;
      }

      const myCtEntries = myStaffId
        ? ctList.filter(ct => String(ct.staff_id) === String(myStaffId))
        : [];
      const normItem = v => (v === null || v === undefined || v === '') ? '' : String(v);
      const ctClasses = myCtEntries.map(ct => ({
        id: `ct_${ct.subcategory_id}_${ct.item_id || ''}`,
        name: [ct.category_name, ct.subcategory_name, ct.item_name].filter(Boolean).join(' '),
        subcategory_id: ct.subcategory_id,
        item_id: ct.item_id,
        category_id: ct.category_id,
      }));
      const timetableClasses = buildClassMap(list);
      const deduped_stClasses = timetableClasses.filter(tc =>
        !ctClasses.some(cc => {
          if (String(cc.subcategory_id) !== String(tc.subcategory_id)) return false;
          const ccItem = normItem(cc.item_id);
          const tcItem = normItem(tc.item_id);
          return ccItem === tcItem || tcItem === '';
        })
      );
      const uniqueSubjects = new Set(list.filter(a => a.subject_id).map(a => a.subject_id));
      const [ctStats, stStats] = await Promise.all([
        Promise.all(ctClasses.map(cls => fetchClassStats(cls).then(s => ({ ...cls, ...s })))),
        Promise.all(deduped_stClasses.map(cls => fetchClassStats(cls).then(s => ({ ...cls, ...s })))),
      ]);
      setMyClasses(ctStats);
      setAssignedClasses(stStats);
      setSubjectCount(uniqueSubjects.size);
    } catch (error) {
      console.log('TeacherDashboard load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const todayDisplay = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const greetIcon = hour < 12 ? 'sunny-outline' : hour < 17 ? 'partly-sunny-outline' : 'moon-outline';
  const totalStudents = myClasses.reduce((s, c) => s + c.total, 0);

  // ── Quick Actions — 6 items (Leave Management replaces Face Registration) ──
  const quickActions = [
    { icon: <Ionicons name="trophy" size={26} color="#7C3AED" />,                              title: 'Performance',  subtitle: 'My Stats',    screen: 'teacherPerformance',         bg: '#EDE9FE'   },
    { icon: <MaterialCommunityIcons name="calendar-clock" size={26} color={T.amber} />,        title: 'Leave Mgmt',   subtitle: 'Approve/Reject', screen: 'teacherLeaveManagement',   bg: T.amberLt   },
    { icon: <Ionicons name="people" size={26} color="#3B82F6" />,                              title: 'Students',     subtitle: 'View all',    screen: 'teacherMyStudents',          bg: '#EFF6FF'   },
    { icon: <Ionicons name="bar-chart" size={26} color="#EC4899" />,                           title: 'Reports',      subtitle: 'Analytics',   screen: 'teacherReports',             bg: '#FDF2F8'   },
    { icon: <Ionicons name="calendar" size={26} color="#0EA5E9" />,                            title: 'Timetable',    subtitle: 'Schedule',    screen: 'teacherTimetable',           bg: '#F0F9FF'   },
    { icon: <MaterialCommunityIcons name="access-point" size={26} color={T.green} />,          title: 'Live View',    subtitle: 'Real-time',   screen: 'teacherLiveAttendance',      bg: T.greenLt   },
  ];

  // Split into rows of 3
  const actionRows = [];
  for (let i = 0; i < quickActions.length; i += 3) {
    actionRows.push(quickActions.slice(i, i + 3));
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <LinearGradient colors={['#1E1B4B','#3730A3','#4F46E5']} style={{ paddingTop: Platform.OS==='ios'?55:45, paddingBottom: 26, paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff' }}>Dashboard</Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 5 }}>Loading your data...</Text>
        </LinearGradient>
        <View style={{ padding: 20 }}>
          {[1,2,3].map(i => <View key={i} style={{ height: 100, backgroundColor: '#E2E8F0', borderRadius: T.radius.xl, marginBottom: 12 }} />)}
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.bg }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.indigo} />}
    >
      {/* ── Hero Header ── */}
      <LinearGradient
        colors={['#1E1B4B','#3730A3','#4F46E5']}
        start={{x:0,y:0}} end={{x:1,y:1}}
        style={{ paddingTop: Platform.OS==='ios'?55:45, paddingBottom: 26, paddingHorizontal: 20, overflow: 'hidden' }}
      >
        <View style={{ position:'absolute', top:-30, right:-30, width:150, height:150, borderRadius:75, borderWidth:1, borderColor:'rgba(255,255,255,0.06)' }} />
        <View style={{ position:'absolute', top:20, right:30, width:80, height:80, borderRadius:40, borderWidth:1, borderColor:'rgba(255,255,255,0.06)' }} />
        <View style={{ position:'absolute', bottom:-20, left:-10, width:100, height:100, borderRadius:50, backgroundColor:'rgba(255,255,255,0.04)' }} />

        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' }}>
          <View style={{ flex:1 }}>
            <Text style={{ fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:'700', letterSpacing:1.5, textTransform:'uppercase', marginBottom:6 }}>
              Teacher Portal
            </Text>
            <Text style={{ fontSize:28, fontWeight:'900', color:'#fff', letterSpacing:-0.5 }}>
              {greeting}
            </Text>
            <Text style={{ fontSize:13, color:'rgba(255,255,255,0.7)', marginTop:5, fontWeight:'500' }}>
              {user?.full_name?.split(' ')[0] || 'Teacher'}
            </Text>
          </View>
          <View style={{ width:56, height:56, borderRadius:18, backgroundColor:'rgba(255,255,255,0.15)', alignItems:'center', justifyContent:'center' }}>
            <Ionicons name={greetIcon} size={26} color="#fff" />
          </View>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection:'row', gap:10, marginTop:18 }}>
          {[
            { label:'My Classes',    value: myClasses.length + assignedClasses.length, icon:'school-outline'   },
            { label:'Today Classes', value: todaySessions.length,                       icon:'calendar-outline' },
            { label:'My Students',   value: totalStudents,                              icon:'people-outline'   },
            { label:'Subjects',      value: subjectCount,                              icon:'book-outline'     },
          ].map((s,i) => (
            <View key={i} style={{
              flex:1, backgroundColor:'rgba(255,255,255,0.12)',
              borderRadius:T.radius.md, padding:10, alignItems:'center',
              borderWidth:1, borderColor:'rgba(255,255,255,0.1)',
            }}>
              <Text style={{ fontSize:18, fontWeight:'900', color:'#fff', letterSpacing:-0.3 }}>{s.value}</Text>
              <Text style={{ fontSize:9, color:'rgba(255,255,255,0.65)', marginTop:2, fontWeight:'600', textAlign:'center' }}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <Animated.View style={{ paddingHorizontal: 16, paddingBottom: 36, paddingTop: 20, opacity: fadeAnim }}>

        {/* My Classes */}
        {myClasses.length > 0 && (
          <>
            <SectionHeader title="My Class" icon="school-outline" color={T.indigo} />
            {myClasses.map((cls, i) => <ClassStatCard key={cls.id || i} cls={cls} isClassTeacher={true} />)}
          </>
        )}

        {/* Assigned Classes */}
        {assignedClasses.length > 0 && (
          <>
            <SectionHeader title="Assigned Classes" icon="layers-outline" color={T.amber} />
            {assignedClasses.map((cls, i) => <ClassStatCard key={cls.id || i} cls={cls} isClassTeacher={false} />)}
          </>
        )}

        {/* No classes message */}
        {myClasses.length === 0 && assignedClasses.length === 0 && (
          <View style={{ backgroundColor: T.surface, borderRadius: T.radius.xl, padding: 40, alignItems: 'center', borderWidth: 1, borderColor: T.border, borderStyle: 'dashed', marginTop: 8 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: T.indigoLt, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <MaterialCommunityIcons name="book-open-variant" size={34} color={T.indigo} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: T.textPri }}>No Classes Assigned</Text>
            <Text style={{ fontSize: 13, color: T.textSec, marginTop: 4, textAlign: 'center' }}>Contact admin to assign classes</Text>
          </View>
        )}

        {/* Today's Schedule */}
        <SectionHeader title="Today's Schedule" icon="calendar-outline" color="#0EA5E9" subtitle={todayDisplay} />

        {todaySessions.length > 0 ? (
          todaySessions.map((item, idx) => {
            const rawStatus = getPeriodStatus(item.start_time, item.end_time);
            const attKey = `${item.subcategory_id}_${item.item_id || ''}_${item.period_number}`;
            const attData = todayAttMap[attKey];
            let periodStatus;
            if (rawStatus === 'upcoming') periodStatus = 'upcoming';
            else if (rawStatus === 'ongoing') periodStatus = 'ongoing';
            else periodStatus = attData ? 'completed' : 'not_taken';
            return (
              <ScheduleCard
                key={idx}
                item={item}
                attData={attData}
                periodStatus={periodStatus}
              />
            );
          })
        ) : (
          <View style={{ backgroundColor: T.surface, borderRadius: T.radius.xl, padding: 40, alignItems: 'center', borderWidth: 1, borderColor: T.border, borderStyle: 'dashed' }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: T.indigoLt, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Ionicons name="calendar-outline" size={34} color={T.indigo} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: T.textPri }}>No Classes Today</Text>
            <Text style={{ fontSize: 13, color: T.textSec, marginTop: 4 }}>{todayDisplay}</Text>
          </View>
        )}

        {/* ── Quick Actions — 3-column Grid ── */}
        <SectionHeader title="Quick Actions" icon="flash-outline" color={T.amber} />

        <View style={{ gap: 10 }}>
          {actionRows.map((row, rowIdx) => (
            <View key={rowIdx} style={{ flexDirection: 'row', gap: 10 }}>
              {row.map((action) => (
                <QuickActionButton
                  key={action.screen}
                  icon={action.icon}
                  title={action.title}
                  subtitle={action.subtitle}
                  screen={action.screen}
                  bg={action.bg}
                  onPress={onNavigate}
                />
              ))}
              {/* Fill empty slots in the last row */}
              {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, i) => (
                <View key={`empty-${i}`} style={{ flex: 1 }} />
              ))}
            </View>
          ))}
        </View>

      </Animated.View>
    </ScrollView>
  );
};

export default TeacherDashboard;