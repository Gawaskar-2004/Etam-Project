import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  SafeAreaView, RefreshControl, Animated, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../config/constants';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { buildClassMap } from '../../utils/helpers';

// ─── Design Tokens ───────────────────────────────────────────────────────────
const T = {
  bg:       '#F0F4FF',
  surface:  '#FFFFFF',
  border:   '#E8EEFF',
  textPri:  '#0D1B3E',
  textSec:  '#5A6A8A',
  textMut:  '#96A5C0',
  indigo:   '#4F46E5',
  indigoLt: '#EEF2FF',
  green:    '#059669',
  greenLt:  '#D1FAE5',
  red:      '#DC2626',
  redLt:    '#FEE2E2',
  amber:    '#D97706',
  amberLt:  '#FEF3C7',
  slate:    '#64748B',
  slateLt:  '#F1F5F9',
  radius:   {sm: 8, md: 12, lg: 16, xl: 20, pill: 999},
  shadow:   {
    sm: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:6, elevation:2 },
    md: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:4}, shadowOpacity:0.10, shadowRadius:12, elevation:4 },
    lg: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:8}, shadowOpacity:0.14, shadowRadius:20, elevation:8 },
  },
};

const CLASS_PALETTE = [
  { grad:['#4F46E5','#7C3AED'], chip:'#EEF2FF', chipBorder:'#C7D2FE', accent:'#4338CA' },
  { grad:['#0891B2','#0E7490'], chip:'#ECFEFF', chipBorder:'#A5F3FC', accent:'#0E7490' },
  { grad:['#059669','#047857'], chip:'#ECFDF5', chipBorder:'#6EE7B7', accent:'#065F46' },
  { grad:['#D97706','#B45309'], chip:'#FFFBEB', chipBorder:'#FDE68A', accent:'#92400E' },
  { grad:['#DB2777','#BE185D'], chip:'#FDF2F8', chipBorder:'#F9A8D4', accent:'#9D174D' },
  { grad:['#7C3AED','#6D28D9'], chip:'#F5F3FF', chipBorder:'#DDD6FE', accent:'#6D28D9' },
];

const STATUS = {
  present:    { label:'Present',    bg:'#D1FAE5', border:'#6EE7B7', text:'#065F46', dot:'#059669', icon:'checkmark-circle' },
  absent:     { label:'Absent',     bg:'#FEE2E2', border:'#FCA5A5', text:'#991B1B', dot:'#EF4444', icon:'close-circle' },
  not_marked: { label:'Not Marked', bg:'#F1F5F9', border:'#CBD5E1', text:'#475569', dot:'#94A3B8', icon:'time-outline' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkeletonBox({ width, height, radius = 8, style }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1,   duration: 900, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.4, duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: '#E2E8F0', opacity: anim }, style]} />
  );
}

function StatusPill({ status }) {
  const cfg = STATUS[status] || STATUS.not_marked;
  return (
    <View style={{
      flexDirection:'row', alignItems:'center', gap:5,
      paddingHorizontal:10, paddingVertical:5, borderRadius:T.radius.pill,
      backgroundColor:cfg.bg, borderWidth:1, borderColor:cfg.border,
    }}>
      <View style={{ width:6, height:6, borderRadius:3, backgroundColor:cfg.dot }} />
      <Text style={{ fontSize:11, fontWeight:'700', color:cfg.text, letterSpacing:0.2 }}>{cfg.label}</Text>
    </View>
  );
}

function MetricCard({ emoji, label, value, gradColors }) {
  return (
    <View style={{
      flex:1, borderRadius:T.radius.lg, backgroundColor:T.surface,
      padding:14, borderWidth:1, borderColor:T.border,
      ...T.shadow.sm,
    }}>
      <LinearGradient
        colors={gradColors}
        style={{ width:36, height:36, borderRadius:10, alignItems:'center', justifyContent:'center', marginBottom:8 }}
      >
        <Text style={{ fontSize:16 }}>{emoji}</Text>
      </LinearGradient>
      <Text style={{ fontSize:22, fontWeight:'900', color:T.textPri, letterSpacing:-0.5 }}>{value}</Text>
      <Text style={{ fontSize:11, fontWeight:'600', color:T.textSec, marginTop:2 }}>{label}</Text>
    </View>
  );
}

function ClassCard({ cls, idx, isSelected, onPress }) {
  const cc = CLASS_PALETTE[idx % CLASS_PALETTE.length];
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn  = () => Animated.spring(scale, { toValue:0.96, useNativeDriver:true }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue:1,    useNativeDriver:true }).start();

  return (
    <Animated.View style={{ transform:[{scale}], flex:1 }}>
      <TouchableOpacity
        onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}
        activeOpacity={0.9}
        style={{
          borderRadius:T.radius.xl, overflow:'hidden',
          borderWidth:isSelected ? 2 : 1.5,
          borderColor:isSelected ? cc.grad[0] : T.border,
          backgroundColor:isSelected ? cc.chip : T.surface,
          ...(isSelected ? T.shadow.md : T.shadow.sm),
        }}
      >
        {/* Accent strip */}
        {isSelected && (
          <LinearGradient colors={cc.grad} style={{ height:3 }} />
        )}
        <View style={{ padding:14 }}>
          <LinearGradient
            colors={cc.grad}
            style={{ width:44, height:44, borderRadius:14, alignItems:'center', justifyContent:'center', marginBottom:10 }}
          >
            <Ionicons name="school" size={22} color="#fff" />
          </LinearGradient>
          <Text style={{ fontWeight:'800', color:isSelected ? cc.accent : T.textPri, fontSize:13, lineHeight:18 }} numberOfLines={2}>
            {cls.name}
          </Text>
          {isSelected && (
            <View style={{ flexDirection:'row', alignItems:'center', gap:4, marginTop:8 }}>
              <View style={{ width:6, height:6, borderRadius:3, backgroundColor:T.green }} />
              <Text style={{ color:cc.accent, fontSize:11, fontWeight:'700' }}>Active</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function StudentRow({ student, status, index }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue:1, duration:300, delay:index * 30, useNativeDriver:true }),
      Animated.timing(slideAnim, { toValue:0, duration:300, delay:index * 30, useNativeDriver:true }),
    ]).start();
  }, []);

  const initials = (name) => (name || '?').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
  const isPresent = status === 'present';
  const isAbsent  = status === 'absent';

  const avatarBg  = isPresent ? T.greenLt  : isAbsent ? T.redLt  : T.slateLt;
  const avatarBdr = isPresent ? '#6EE7B7'  : isAbsent ? '#FCA5A5' : '#CBD5E1';
  const avatarTxt = isPresent ? T.green    : isAbsent ? T.red     : T.slate;
  const rowBg     = isPresent ? '#F0FDF8'  : isAbsent ? '#FFF5F5' : T.surface;

  return (
    <Animated.View style={{ opacity:fadeAnim, transform:[{translateY:slideAnim}] }}>
      <View style={{
        flexDirection:'row', alignItems:'center',
        paddingVertical:10, paddingHorizontal:12,
        borderRadius:T.radius.md, backgroundColor:rowBg,
        marginBottom:4, borderWidth:1,
        borderColor: isPresent ? '#A7F3D0' : isAbsent ? '#FECACA' : T.border,
      }}>
        <View style={{
          width:40, height:40, borderRadius:12,
          backgroundColor:avatarBg, alignItems:'center', justifyContent:'center',
          marginRight:12, borderWidth:1.5, borderColor:avatarBdr,
        }}>
          <Text style={{ fontSize:13, fontWeight:'900', color:avatarTxt }}>{initials(student.full_name)}</Text>
        </View>
        <View style={{ flex:1 }}>
          <Text style={{ fontWeight:'700', color:T.textPri, fontSize:13 }} numberOfLines={1}>
            {student.full_name}
          </Text>
          <Text style={{ color:T.textMut, fontSize:11, marginTop:1, fontWeight:'500' }}>
            {student.register_number || '—'}
          </Text>
        </View>
        <StatusPill status={status} />
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TeacherLiveAttendanceScreen({ token: propToken, user: propUser, onBack }) {
  const { token: ctxToken, user: ctxUser } = useAuth();
  const token = propToken || ctxToken;
  const user  = propUser  || ctxUser;

  const [classes, setClasses]             = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [students, setStudents]           = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [loading, setLoading]             = useState(false);
  const [classesLoading, setClassesLoading] = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [autoRefresh, setAutoRefresh]     = useState(true);
  const [lastRefresh, setLastRefresh]     = useState(new Date());
  const [search, setSearch]               = useState('');
  const [filterStatus, setFilterStatus]   = useState('all'); // all | present | absent | not_marked

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const date = new Date().toISOString().split('T')[0];

  useEffect(() => {
    Animated.timing(headerAnim, { toValue:1, duration:500, useNativeDriver:true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue:0.2, duration:900, useNativeDriver:true }),
      Animated.timing(pulseAnim, { toValue:1,   duration:900, useNativeDriver:true }),
    ])).start();
  }, []);

  useEffect(() => { loadClasses(); }, [user?.id]);

  useEffect(() => {
    if (!selectedClass || !autoRefresh) return;
    const interval = setInterval(() => {
      fetchAttendance(selectedClass);
      setLastRefresh(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedClass, autoRefresh]);

  const loadClasses = async () => {
    setClassesLoading(true);
    try {
      const data = await api.get(`/timetable-assignments?user_id=${user?.id || ''}`, token);
      const list = Array.isArray(data) ? data : (data?.assignments || []);
      setClasses(buildClassMap(list));
    } catch (e) { console.log('loadClasses error:', e); }
    finally { setClassesLoading(false); }
  };

  const fetchAttendance = useCallback(async (cls) => {
    try {
      let url = `/attendance/sessions?date=${date}&subcategory_id=${cls.subcategory_id}&category_id=${cls.category_id || ''}`;
      if (cls.item_id) url += `&item_id=${cls.item_id}`;
      const sessRaw = await api.get(url, token);
      const sessions = sessRaw?.sessions || sessRaw || [];
      if (!sessions.length) { setAttendanceMap({}); return; }
      const map = {};
      await Promise.all(sessions.map(async (sess) => {
        try {
          const recRaw = await api.get(`/attendance/sessions/${sess.id}/records`, token);
          const records = Array.isArray(recRaw) ? recRaw : (recRaw?.records || recRaw?.data || []);
          records.forEach(r => { map[r.student_id] = r.status; });
        } catch {}
      }));
      setAttendanceMap(map);
    } catch (e) { console.log('fetchAttendance error:', e); }
  }, [date, token]);

  const selectClass = async (cls) => {
    setSelectedClass(cls);
    setSearch('');
    setFilterStatus('all');
    setLoading(true);
    setAttendanceMap({});
    try {
      let url = `/students?subcategory_id=${cls.subcategory_id}`;
      if (cls.item_id) url += `&item_id=${cls.item_id}`;
      const raw = await api.get(url, token);
      setStudents(Array.isArray(raw) ? raw : (raw?.students || []));
      await fetchAttendance(cls);
      setLastRefresh(new Date());
    } catch (e) { console.log('selectClass error:', e); }
    finally { setLoading(false); }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (selectedClass) {
      await fetchAttendance(selectedClass);
      setLastRefresh(new Date());
    } else {
      await loadClasses();
    }
    setRefreshing(false);
  }, [selectedClass, fetchAttendance]);

  const total     = students.length;
  const present   = students.filter(s => attendanceMap[s.id] === 'present').length;
  const absent    = students.filter(s => attendanceMap[s.id] === 'absent').length;
  const notMarked = total - present - absent;
  const pct       = total > 0 ? (present / total) * 100 : 0;
  const pctStr    = pct.toFixed(1);
  const progressColor = pct >= 75 ? T.green : pct >= 50 ? T.amber : T.red;

  const filteredStudents = students.filter(s => {
    const matchSearch = !search || s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.register_number?.toLowerCase().includes(search.toLowerCase());
    const status = attendanceMap[s.id] || 'not_marked';
    const matchFilter = filterStatus === 'all' || status === filterStatus;
    return matchSearch && matchFilter;
  });

  const filterTabs = [
    { key:'all',        label:'All',        count:total     },
    { key:'present',    label:'Present',    count:present   },
    { key:'absent',     label:'Absent',     count:absent    },
    { key:'not_marked', label:'Unmarked',   count:notMarked },
  ];

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:T.bg }}>

      {/* ── Header ── */}
      <LinearGradient
        colors={['#312E81','#4F46E5','#7C3AED']}
        start={{ x:0, y:0 }} end={{ x:1, y:1 }}
        style={{ paddingTop:16, paddingBottom:22, paddingHorizontal:18 }}
      >
        {/* Top row */}
        <View style={{ flexDirection:'row', alignItems:'center', marginBottom:16 }}>
          <TouchableOpacity
            onPress={onBack}
            style={{
              width:40, height:40, borderRadius:T.radius.pill,
              backgroundColor:'rgba(255,255,255,0.15)',
              alignItems:'center', justifyContent:'center',
              marginRight:14, borderWidth:1, borderColor:'rgba(255,255,255,0.2)',
            }}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex:1 }}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginBottom:3 }}>
              <Animated.View style={{
                width:8, height:8, borderRadius:4,
                backgroundColor:'#86EFAC', opacity:pulseAnim,
              }} />
              <Text style={{ color:'rgba(255,255,255,0.75)', fontSize:11, fontWeight:'600', letterSpacing:1, textTransform:'uppercase' }}>
                Live · Updates every 30s
              </Text>
            </View>
            <Text style={{ color:'#fff', fontSize:22, fontWeight:'900', letterSpacing:-0.3 }}>
              Live Attendance
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setAutoRefresh(v => !v)}
            style={{
              paddingHorizontal:12, paddingVertical:7, borderRadius:T.radius.pill,
              backgroundColor: autoRefresh ? 'rgba(134,239,172,0.2)' : 'rgba(255,255,255,0.1)',
              borderWidth:1, borderColor: autoRefresh ? 'rgba(134,239,172,0.5)' : 'rgba(255,255,255,0.2)',
              flexDirection:'row', alignItems:'center', gap:5,
            }}
          >
            <Ionicons name={autoRefresh ? 'pause' : 'play'} size={12} color={autoRefresh ? '#86EFAC' : 'rgba(255,255,255,0.7)'} />
            <Text style={{ color:autoRefresh ? '#86EFAC' : 'rgba(255,255,255,0.7)', fontSize:11, fontWeight:'700' }}>
              {autoRefresh ? 'LIVE' : 'PAUSED'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats strip (only when class selected) */}
        {selectedClass && total > 0 && (
          <View style={{
            backgroundColor:'rgba(255,255,255,0.12)',
            borderRadius:T.radius.lg, padding:14,
            borderWidth:1, borderColor:'rgba(255,255,255,0.15)',
          }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <Text style={{ color:'rgba(255,255,255,0.9)', fontSize:13, fontWeight:'700' }}>
                {selectedClass.name}
              </Text>
              <Text style={{ color:'#fff', fontSize:18, fontWeight:'900' }}>{pctStr}%</Text>
            </View>
            {/* Progress bar */}
            <View style={{ height:6, backgroundColor:'rgba(255,255,255,0.2)', borderRadius:T.radius.pill, overflow:'hidden' }}>
              <Animated.View style={{ height:'100%', width:`${pct}%`, backgroundColor:'#86EFAC', borderRadius:T.radius.pill }} />
            </View>
            <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:8 }}>
              {[
                { label:'Present', value:present, color:'#86EFAC' },
                { label:'Absent',  value:absent,  color:'#FCA5A5' },
                { label:'Unknown', value:notMarked, color:'rgba(255,255,255,0.5)' },
                { label:'Total',   value:total,   color:'rgba(255,255,255,0.8)' },
              ].map(s => (
                <View key={s.label} style={{ alignItems:'center' }}>
                  <Text style={{ color:s.color, fontSize:16, fontWeight:'900' }}>{s.value}</Text>
                  <Text style={{ color:'rgba(255,255,255,0.6)', fontSize:10, fontWeight:'600', marginTop:1 }}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Last refreshed */}
        <View style={{ flexDirection:'row', justifyContent:'flex-end', marginTop:10 }}>
          <TouchableOpacity onPress={handleRefresh} disabled={!selectedClass} style={{ flexDirection:'row', alignItems:'center', gap:4, opacity:selectedClass ? 1 : 0.4 }}>
            <Ionicons name="refresh-outline" size={12} color="rgba(255,255,255,0.6)" />
            <Text style={{ color:'rgba(255,255,255,0.6)', fontSize:11 }}>
              {lastRefresh.toLocaleTimeString()}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex:1 }}
        contentContainerStyle={{ padding:16, paddingBottom:36 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={T.indigo} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Class Selector ── */}
        <View style={{ marginBottom:22 }}>
          <Text style={{ fontSize:12, fontWeight:'700', color:T.textSec, letterSpacing:0.8, textTransform:'uppercase', marginBottom:12 }}>
            Select Class
          </Text>

          {classesLoading ? (
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:10 }}>
              {[0,1,2,3].map(i => (
                <View key={i} style={{ width:'47%', borderRadius:T.radius.xl, backgroundColor:T.surface, padding:14, borderWidth:1, borderColor:T.border }}>
                  <SkeletonBox width={44} height={44} radius={14} style={{ marginBottom:10 }} />
                  <SkeletonBox width="80%" height={14} radius={6} style={{ marginBottom:6 }} />
                  <SkeletonBox width="50%" height={11} radius={6} />
                </View>
              ))}
            </View>
          ) : classes.length === 0 ? (
            <View style={{ borderRadius:T.radius.xl, padding:36, alignItems:'center', backgroundColor:T.surface, borderWidth:1.5, borderColor:T.border, borderStyle:'dashed' }}>
              <View style={{ width:60, height:60, borderRadius:20, backgroundColor:T.indigoLt, alignItems:'center', justifyContent:'center', marginBottom:12 }}>
                <Ionicons name="school-outline" size={28} color={T.indigo} />
              </View>
              <Text style={{ color:T.textPri, fontWeight:'700', fontSize:15 }}>No Classes Assigned</Text>
              <Text style={{ color:T.textSec, fontSize:13, marginTop:4, textAlign:'center' }}>Contact your admin to set up your timetable</Text>
            </View>
          ) : (
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:10 }}>
              {classes.map((cls, idx) => (
                <View key={cls.id} style={{ width:'47%' }}>
                  <ClassCard cls={cls} idx={idx} isSelected={selectedClass?.id === cls.id} onPress={() => selectClass(cls)} />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Student List ── */}
        {selectedClass && (
          <View style={{ borderRadius:T.radius.xl, backgroundColor:T.surface, borderWidth:1, borderColor:T.border, overflow:'hidden', ...T.shadow.sm }}>

            {/* Header */}
            <View style={{ padding:16, borderBottomWidth:1, borderBottomColor:T.border }}>
              <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                  <LinearGradient colors={['#4F46E5','#7C3AED']} style={{ width:38, height:38, borderRadius:12, alignItems:'center', justifyContent:'center' }}>
                    <Ionicons name="people" size={18} color="#fff" />
                  </LinearGradient>
                  <View>
                    <Text style={{ fontWeight:'800', color:T.textPri, fontSize:14 }}>{selectedClass.name}</Text>
                    <Text style={{ color:T.textSec, fontSize:11, marginTop:1 }}>{date} · {students.length} students</Text>
                  </View>
                </View>
                <View style={{ flexDirection:'row', gap:6 }}>
                  <View style={{ backgroundColor:T.greenLt, borderRadius:T.radius.pill, paddingHorizontal:9, paddingVertical:4, borderWidth:1, borderColor:'#6EE7B7' }}>
                    <Text style={{ color:T.green, fontSize:11, fontWeight:'800' }}>✓ {present}</Text>
                  </View>
                  <View style={{ backgroundColor:T.redLt, borderRadius:T.radius.pill, paddingHorizontal:9, paddingVertical:4, borderWidth:1, borderColor:'#FCA5A5' }}>
                    <Text style={{ color:T.red, fontSize:11, fontWeight:'800' }}>✕ {absent}</Text>
                  </View>
                </View>
              </View>

              {/* Search bar */}
              {!loading && students.length > 0 && (
                <>
                  <View style={{
                    flexDirection:'row', alignItems:'center', gap:10,
                    backgroundColor:T.bg, borderRadius:T.radius.md,
                    paddingHorizontal:12, paddingVertical:9,
                    borderWidth:1, borderColor:T.border, marginBottom:10,
                  }}>
                    <Ionicons name="search-outline" size={16} color={T.textSec} />
                    <TextInput
                      style={{ flex:1, fontSize:13, color:T.textPri, padding:0 }}
                      placeholder="Search by name or ID…"
                      placeholderTextColor={T.textMut}
                      value={search}
                      onChangeText={setSearch}
                    />
                    {search.length > 0 && (
                      <TouchableOpacity onPress={() => setSearch('')}>
                        <Ionicons name="close-circle" size={16} color={T.textMut} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Filter tabs */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection:'row', gap:6 }}>
                      {filterTabs.map(tab => (
                        <TouchableOpacity
                          key={tab.key}
                          onPress={() => setFilterStatus(tab.key)}
                          style={{
                            flexDirection:'row', alignItems:'center', gap:5,
                            paddingHorizontal:12, paddingVertical:6,
                            borderRadius:T.radius.pill,
                            backgroundColor: filterStatus === tab.key ? T.indigo : T.bg,
                            borderWidth:1,
                            borderColor: filterStatus === tab.key ? T.indigo : T.border,
                          }}
                        >
                          <Text style={{ fontSize:12, fontWeight:'700', color: filterStatus === tab.key ? '#fff' : T.textSec }}>
                            {tab.label}
                          </Text>
                          <View style={{
                            minWidth:18, height:18, borderRadius:9, paddingHorizontal:4,
                            backgroundColor: filterStatus === tab.key ? 'rgba(255,255,255,0.25)' : T.border,
                            alignItems:'center', justifyContent:'center',
                          }}>
                            <Text style={{ fontSize:10, fontWeight:'800', color: filterStatus === tab.key ? '#fff' : T.textSec }}>
                              {tab.count}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}
            </View>

            {/* Student rows */}
            <View style={{ padding:10 }}>
              {loading ? (
                <View style={{ paddingVertical:28, alignItems:'center' }}>
                  <ActivityIndicator color={T.indigo} size="large" />
                  <Text style={{ marginTop:12, color:T.textSec, fontSize:13, fontWeight:'500' }}>Loading students…</Text>
                </View>
              ) : filteredStudents.length === 0 ? (
                <View style={{ paddingVertical:28, alignItems:'center' }}>
                  <View style={{ width:52, height:52, borderRadius:16, backgroundColor:T.indigoLt, alignItems:'center', justifyContent:'center', marginBottom:10 }}>
                    <Ionicons name="search-outline" size={24} color={T.indigo} />
                  </View>
                  <Text style={{ color:T.textPri, fontWeight:'700', fontSize:14 }}>No students found</Text>
                  <Text style={{ color:T.textSec, fontSize:12, marginTop:4 }}>Try changing your search or filter</Text>
                </View>
              ) : (
                filteredStudents.map((student, index) => (
                  <StudentRow
                    key={student.id}
                    student={student}
                    status={attendanceMap[student.id] || 'not_marked'}
                    index={index}
                  />
                ))
              )}
            </View>
          </View>
        )}

        {/* Empty state – no class selected */}
        {!selectedClass && !classesLoading && classes.length > 0 && (
          <View style={{
            borderRadius:T.radius.xl, padding:44, alignItems:'center',
            backgroundColor:T.surface, borderWidth:1.5, borderColor:T.border, borderStyle:'dashed',
          }}>
            <View style={{ width:68, height:68, borderRadius:22, backgroundColor:T.indigoLt, alignItems:'center', justifyContent:'center', marginBottom:14 }}>
              <Ionicons name="radio-outline" size={32} color={T.indigo} />
            </View>
            <Text style={{ color:T.textPri, fontWeight:'800', fontSize:16 }}>Select a Class</Text>
            <Text style={{ color:T.textSec, fontSize:13, marginTop:5, textAlign:'center' }}>
              Pick a class above to start monitoring live attendance
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}