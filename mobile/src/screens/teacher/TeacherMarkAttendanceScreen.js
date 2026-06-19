import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, SafeAreaView,
  StatusBar, TextInput, FlatList, Platform, Animated, BackHandler,
  InteractionManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { buildClassMap, formatTime } from '../../utils/helpers';
import { getPeriodStatus } from '../teacher/TeacherDashboard';
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
  indigoDk:'#3730A3',
  green:   '#059669',
  greenLt: '#D1FAE5',
  greenBd: '#6EE7B7',
  red:     '#EF4444',
  redLt:   '#FEF2F2',
  redBd:   '#FCA5A5',
  amber:   '#D97706',
  amberLt: '#FEF3C7',
  amberBd: '#FCD34D',
  slate:   '#64748B',
  slateLt: '#F1F5F9',
  radius:  { sm:8, md:12, lg:16, xl:20, pill:999 },
  shadow: {
    sm: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:6,  elevation:2 },
    md: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:4}, shadowOpacity:0.10, shadowRadius:12, elevation:4 },
    lg: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:8}, shadowOpacity:0.14, shadowRadius:20, elevation:8 },
  },
};

const PERIOD_PALETTE = [
  { bg:'#EEF2FF', border:'#C7D2FE', accent:'#4F46E5', text:'#4338CA', gradStart:'#4F46E5', gradEnd:'#7C3AED' },
  { bg:'#ECFDF5', border:'#6EE7B7', accent:'#059669', text:'#065F46', gradStart:'#059669', gradEnd:'#047857' },
  { bg:'#FEF3C7', border:'#FCD34D', accent:'#D97706', text:'#92400E', gradStart:'#D97706', gradEnd:'#B45309' },
  { bg:'#FDF2F8', border:'#F9A8D4', accent:'#DB2777', text:'#9D174D', gradStart:'#DB2777', gradEnd:'#BE185D' },
  { bg:'#FFF7ED', border:'#FDBA74', accent:'#EA580C', text:'#9A3412', gradStart:'#EA580C', gradEnd:'#C2410C' },
  { bg:'#EFF6FF', border:'#BFDBFE', accent:'#2563EB', text:'#1E40AF', gradStart:'#2563EB', gradEnd:'#1D4ED8' },
  { bg:'#F5F3FF', border:'#C4B5FD', accent:'#7C3AED', text:'#5B21B6', gradStart:'#7C3AED', gradEnd:'#6D28D9' },
  { bg:'#ECFEFF', border:'#A5F3FC', accent:'#0891B2', text:'#155E75', gradStart:'#0891B2', gradEnd:'#0E7490' },
];

// ─── Date helpers ─────────────────────────────────────────────────────────────
const dateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};
const todayStr     = () => dateStr(new Date());
const yesterdayStr = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dateStr(d); };
const dayName      = (dateString) => {
  const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  return days[new Date(dateString + 'T00:00:00').getDay()];
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const SkeletonBox = ({ width, height, radius = 8, style }) => {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue:1,   duration:900, useNativeDriver:true }),
      Animated.timing(anim, { toValue:0.4, duration:900, useNativeDriver:true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[{ width, height, borderRadius:radius, backgroundColor:'#E2E8F0', opacity:anim }, style]} />;
};

// ─── Step Progress Bar ────────────────────────────────────────────────────────
const StepProgress = ({ step, dark = false }) => (
  <View style={{ flexDirection:'row', gap:6, paddingBottom:14 }}>
    {[1,2,3].map(s => (
      <View key={s} style={{
        flex:1, height:3, borderRadius:2,
        backgroundColor: s <= step
          ? (dark ? '#fff' : T.indigo)
          : (dark ? 'rgba(255,255,255,0.25)' : '#E2E8F0'),
      }} />
    ))}
  </View>
);

// ─── Date Mode Toggle ─────────────────────────────────────────────────────────
const DateModeToggle = ({ mode, onChange }) => (
  <View style={{
    flexDirection:'row', gap:6, marginTop:12,
    backgroundColor:'rgba(255,255,255,0.10)',
    borderRadius:T.radius.pill, padding:3, alignSelf:'flex-start',
    borderWidth:1, borderColor:'rgba(255,255,255,0.15)',
  }}>
    {[
      { key:'today',     label:'Today'     },
      { key:'yesterday', label:'Yesterday' },
    ].map(({ key, label }) => (
      <TouchableOpacity
        key={key}
        onPress={() => onChange(key)}
        style={{
          paddingHorizontal:14, paddingVertical:5, borderRadius:T.radius.pill,
          backgroundColor: mode === key ? 'rgba(255,255,255,0.25)' : 'transparent',
          borderWidth: mode === key ? 1 : 0,
          borderColor:'rgba(255,255,255,0.3)',
        }}
      >
        <Text style={{ fontSize:12, fontWeight:'800', color: mode === key ? '#fff' : 'rgba(255,255,255,0.6)' }}>
          {label}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

// ─── Gradient Hero Header ─────────────────────────────────────────────────────
const GradientHeroHeader = ({ step, title, subtitle, icon, onBack, backLabel, extra, dateMode, onDateModeChange }) => (
  <LinearGradient
    colors={['#1E1B4B','#3730A3','#4F46E5']}
    start={{x:0,y:0}} end={{x:1,y:1}}
    style={{ paddingTop: Platform.OS==='ios' ? 14 : 18, paddingBottom:22, paddingHorizontal:20, overflow:'hidden' }}
  >
    <View style={{ position:'absolute', top:-30, right:-30, width:150, height:150, borderRadius:75, borderWidth:1, borderColor:'rgba(255,255,255,0.06)' }} />
    <View style={{ position:'absolute', top:20,  right:30,  width:80,  height:80,  borderRadius:40, borderWidth:1, borderColor:'rgba(255,255,255,0.06)' }} />
    <View style={{ position:'absolute', bottom:-20, left:-20, width:100, height:100, borderRadius:50, borderWidth:1, borderColor:'rgba(255,255,255,0.04)' }} />

    {onBack && (
      <TouchableOpacity
        onPress={onBack}
        style={{
          flexDirection:'row', alignItems:'center', gap:6, alignSelf:'flex-start', marginBottom:16,
          backgroundColor:'rgba(255,255,255,0.12)', borderRadius:T.radius.pill,
          paddingHorizontal:14, paddingVertical:7, borderWidth:1, borderColor:'rgba(255,255,255,0.18)',
        }}
      >
        <Ionicons name="arrow-back" size={16} color="#fff" />
        <Text style={{ fontSize:13, fontWeight:'700', color:'#fff' }}>{backLabel || 'Back'}</Text>
      </TouchableOpacity>
    )}

    <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' }}>
      <View style={{ flex:1, marginRight:12 }}>
        <Text style={{ fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:'700', letterSpacing:1.5, textTransform:'uppercase', marginBottom:6 }}>
          Step {step} of 3
        </Text>
        <Text style={{ fontSize:26, fontWeight:'900', color:'#fff', letterSpacing:-0.5 }}>{title}</Text>
        {subtitle ? (
          <Text style={{ fontSize:13, color:'rgba(255,255,255,0.7)', marginTop:5, fontWeight:'500' }}>{subtitle}</Text>
        ) : null}
        {dateMode !== undefined && onDateModeChange && (
          <DateModeToggle mode={dateMode} onChange={onDateModeChange} />
        )}
        {extra ? extra : null}
      </View>
      <View style={{
        width:52, height:52, borderRadius:16,
        backgroundColor:'rgba(255,255,255,0.15)',
        alignItems:'center', justifyContent:'center',
        borderWidth:1.5, borderColor:'rgba(255,255,255,0.2)',
      }}>
        <Ionicons name={icon} size={26} color="#fff" />
      </View>
    </View>

    <View style={{ marginTop:14 }}>
      <StepProgress step={step} dark />
    </View>
  </LinearGradient>
);

// ─── Class Card ───────────────────────────────────────────────────────────────
const ClassCard = ({ cls, index, onPress }) => {
  const cc = PERIOD_PALETTE[index % PERIOD_PALETTE.length];
  const scale     = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue:1, duration:350, delay:index*60, useNativeDriver:true }),
      Animated.timing(slideAnim, { toValue:0, duration:350, delay:index*60, useNativeDriver:true }),
    ]).start();
  }, []);

  const handleIn  = () => Animated.spring(scale, { toValue:0.97, useNativeDriver:true, speed:50, bounciness:0 }).start();
  const handleOut = () => Animated.spring(scale, { toValue:1,    useNativeDriver:true, speed:50, bounciness:0 }).start();

  return (
    <Animated.View style={{ opacity:fadeAnim, transform:[{translateY:slideAnim},{scale}] }}>
      <TouchableOpacity
        onPress={onPress} onPressIn={handleIn} onPressOut={handleOut} activeOpacity={1}
        style={{
          backgroundColor:T.surface, borderRadius:T.radius.xl, marginBottom:12, overflow:'hidden',
          borderWidth:1, borderColor:T.border, ...T.shadow.sm, shadowColor:cc.accent,
        }}
      >
        <View style={{ flexDirection:'row' }}>
          <View style={{ width:4, backgroundColor:cc.accent }} />
          <View style={{ flex:1, padding:16, flexDirection:'row', alignItems:'center' }}>
            <LinearGradient
              colors={[cc.gradStart, cc.gradEnd]}
              style={{ width:50, height:50, borderRadius:15, alignItems:'center', justifyContent:'center', marginRight:14 }}
            >
              <Ionicons name="book-outline" size={22} color="#fff" />
            </LinearGradient>
            <View style={{ flex:1 }}>
              <Text style={{ fontSize:16, fontWeight:'800', color:T.textPri, letterSpacing:-0.2 }}>{cls.name}</Text>
              <View style={{
                flexDirection:'row', alignItems:'center', gap:5, marginTop:6, alignSelf:'flex-start',
                backgroundColor:cc.bg, borderRadius:T.radius.pill, paddingHorizontal:9, paddingVertical:4,
                borderWidth:1, borderColor:cc.border,
              }}>
                <Ionicons name="people-outline" size={11} color={cc.text} />
                <Text style={{ fontSize:11, fontWeight:'700', color:cc.text }}>Tap to take attendance</Text>
              </View>
            </View>
            <View style={{ width:34, height:34, borderRadius:10, backgroundColor:cc.bg, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:cc.border }}>
              <Ionicons name="chevron-forward" size={16} color={cc.accent} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Period Card ──────────────────────────────────────────────────────────────
const PeriodCard = ({ period, subjectName, startTime, endTime, status, onPress, index, isYesterday, hasSavedRecords }) => {
  const cc        = PERIOD_PALETTE[(period - 1) % PERIOD_PALETTE.length];
  const scale     = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const isOngoing = status === 'ongoing' && !isYesterday;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue:1, duration:350, delay:index*60, useNativeDriver:true }),
      Animated.timing(slideAnim, { toValue:0, duration:350, delay:index*60, useNativeDriver:true }),
    ]).start();
  }, []);

  const handleIn  = () => Animated.spring(scale, { toValue:0.97, useNativeDriver:true, speed:50, bounciness:0 }).start();
  const handleOut = () => Animated.spring(scale, { toValue:1,    useNativeDriver:true, speed:50, bounciness:0 }).start();

  const borderCol = isOngoing ? T.green : hasSavedRecords ? T.amber : T.border;

  return (
    <Animated.View style={{ opacity:fadeAnim, transform:[{translateY:slideAnim},{scale}] }}>
      <TouchableOpacity
        onPress={onPress} onPressIn={handleIn} onPressOut={handleOut} activeOpacity={1}
        style={{
          backgroundColor:T.surface, borderRadius:T.radius.xl, marginBottom:12, overflow:'hidden',
          borderWidth: isOngoing || hasSavedRecords ? 2 : 1, borderColor: borderCol,
          ...(isOngoing ? T.shadow.lg : T.shadow.sm), shadowColor:cc.accent,
        }}
      >
        <View style={{ flexDirection:'row' }}>
          <View style={{ width:4, backgroundColor: isOngoing ? T.green : hasSavedRecords ? T.amber : cc.accent }} />
          <View style={{ flex:1, padding:14 }}>
            {isOngoing && (
              <View style={{
                flexDirection:'row', alignItems:'center', gap:5,
                backgroundColor:T.greenLt, borderRadius:T.radius.pill,
                paddingHorizontal:10, paddingVertical:4, borderWidth:1, borderColor:T.greenBd,
                alignSelf:'flex-start', marginBottom:10,
              }}>
                <View style={{ width:5, height:5, borderRadius:3, backgroundColor:T.green }} />
                <Text style={{ fontSize:10, fontWeight:'800', color:T.green, textTransform:'uppercase', letterSpacing:0.5 }}>Current Period</Text>
              </View>
            )}
            {hasSavedRecords && (
              <View style={{
                flexDirection:'row', alignItems:'center', gap:5,
                backgroundColor:T.amberLt, borderRadius:T.radius.pill,
                paddingHorizontal:10, paddingVertical:4, borderWidth:1, borderColor:T.amberBd,
                alignSelf:'flex-start', marginBottom:10,
              }}>
                <Ionicons name="refresh-outline" size={11} color={T.amber} />
                <Text style={{ fontSize:10, fontWeight:'800', color:T.amber, textTransform:'uppercase', letterSpacing:0.5 }}>
                  Saved — Tap to Update
                </Text>
              </View>
            )}
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <LinearGradient
                colors={isOngoing ? [T.green,'#047857'] : [cc.gradStart, cc.gradEnd]}
                style={{ width:50, height:50, borderRadius:15, alignItems:'center', justifyContent:'center', marginRight:14 }}
              >
                <Text style={{ fontSize:11, fontWeight:'900', color:'#fff', letterSpacing:0.3 }}>P{period}</Text>
              </LinearGradient>
              <View style={{ flex:1 }}>
                <Text style={{ fontSize:16, fontWeight:'800', color:T.textPri, letterSpacing:-0.2 }}>
                  {subjectName || `Period ${period}`}
                </Text>
                <View style={{
                  flexDirection:'row', alignItems:'center', gap:5, marginTop:5, alignSelf:'flex-start',
                  backgroundColor: isOngoing ? T.greenLt : cc.bg,
                  borderRadius:T.radius.pill, paddingHorizontal:9, paddingVertical:4,
                  borderWidth:1, borderColor: isOngoing ? T.greenBd : cc.border,
                }}>
                  <Ionicons name="time-outline" size={11} color={isOngoing ? T.green : cc.text} />
                  <Text style={{ fontSize:12, fontWeight:'700', color: isOngoing ? T.green : cc.text }}>
                    {startTime && endTime ? `${formatTime(startTime)} – ${formatTime(endTime)}` : 'Time TBD'}
                  </Text>
                </View>
              </View>
              <View style={{
                backgroundColor: isOngoing ? T.greenLt : hasSavedRecords ? T.amberLt : cc.bg,
                borderRadius:T.radius.pill, paddingHorizontal:10, paddingVertical:5,
                borderWidth:1, borderColor: isOngoing ? T.greenBd : hasSavedRecords ? T.amberBd : cc.border,
              }}>
                <Text style={{ fontSize:10, fontWeight:'800', color: isOngoing ? T.green : hasSavedRecords ? T.amber : cc.accent, textTransform:'uppercase', letterSpacing:0.4 }}>
                  {isYesterday ? (hasSavedRecords ? 'Update' : 'Mark') : status === 'ongoing' ? 'Ongoing' : status === 'completed' ? 'Done' : 'Up Next'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Student Mark Card ────────────────────────────────────────────────────────
const StudentMarkCard = ({ student, index, isSelected, status, originalStatus, onPress, onStatusChange, onLongPress }) => {
  const scale     = useRef(new Animated.Value(1)).current;
  const handleIn  = () => Animated.spring(scale, { toValue:0.98, useNativeDriver:true, speed:50, bounciness:0 }).start();
  const handleOut = () => Animated.spring(scale, { toValue:1,    useNativeDriver:true, speed:50, bounciness:0 }).start();

  const regNo       = student.register_number || student.registration_number || student.reg_no || '';
  const isChanged   = originalStatus !== null && originalStatus !== undefined && status !== originalStatus;
  const bgColor     = isSelected ? T.indigoLt : status === 'present' ? T.greenLt : status === 'absent' ? T.redLt : T.surface;
  const borderColor = isSelected ? T.indigo   : status === 'present' ? T.greenBd : status === 'absent' ? T.redBd : T.border;
  const accentColor = isSelected ? T.indigo   : status === 'present' ? T.green   : status === 'absent' ? T.red   : '#CBD5E1';

  return (
    <Animated.View style={{ transform:[{scale}] }}>
      <TouchableOpacity
        onPress={onPress} onLongPress={onLongPress}
        onPressIn={handleIn} onPressOut={handleOut} activeOpacity={1}
        style={{
          backgroundColor:bgColor, borderRadius:T.radius.lg, marginBottom:8, overflow:'hidden',
          borderWidth: isSelected || status ? 1.5 : 1, borderColor,
          ...T.shadow.sm,
        }}
      >
        <View style={{ flexDirection:'row' }}>
          <View style={{ width:4, alignSelf:'stretch', backgroundColor:accentColor }} />
          <View style={{ flex:1, padding:12, flexDirection:'row', alignItems:'center' }}>
            <View style={{ width:34, alignItems:'center', justifyContent:'center' }}>
              <View style={{
                width:28, height:28, borderRadius:8,
                backgroundColor: isSelected ? T.indigo : status === 'present' ? T.green : status === 'absent' ? T.red : T.slateLt,
                alignItems:'center', justifyContent:'center',
              }}>
                {isSelected ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : (
                  <Text style={{ fontSize:11, fontWeight:'700', color: status ? '#fff' : T.textMut }}>
                    {index + 1}
                  </Text>
                )}
              </View>
            </View>
            <View style={{ flex:1, marginLeft:10 }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                <Text style={{ fontSize:14, fontWeight:'800', color:T.textPri, letterSpacing:-0.1 }} numberOfLines={1}>
                  {student.full_name}
                </Text>
                {isChanged && (
                  <View style={{
                    backgroundColor:T.amberLt, borderRadius:T.radius.pill,
                    paddingHorizontal:7, paddingVertical:2,
                    borderWidth:1, borderColor:T.amberBd,
                    flexDirection:'row', alignItems:'center', gap:3,
                  }}>
                    <Ionicons name="refresh-outline" size={9} color={T.amber} />
                    <Text style={{ fontSize:9, fontWeight:'800', color:T.amber, textTransform:'uppercase', letterSpacing:0.3 }}>
                      Updated
                    </Text>
                  </View>
                )}
              </View>
              {isChanged && originalStatus && (
                <Text style={{ fontSize:10, color:T.textMut, marginTop:1 }}>
                  Was: <Text style={{ fontWeight:'700', color: originalStatus === 'present' ? T.green : T.red }}>
                    {originalStatus.charAt(0).toUpperCase() + originalStatus.slice(1)}
                  </Text>
                </Text>
              )}
              {!!regNo && (
                <View style={{ flexDirection:'row', alignItems:'center', gap:3, marginTop:2 }}>
                  <Ionicons name="id-card-outline" size={10} color={T.textMut} />
                  <Text style={{ fontSize:11, color:T.textSec }}>{regNo}</Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection:'row', gap:8 }}>
              <TouchableOpacity
                onPress={() => onStatusChange('present')}
                hitSlop={{ top:8, bottom:8, left:4, right:4 }}
                style={{
                  width:44, height:38, borderRadius:10, alignItems:'center', justifyContent:'center',
                  backgroundColor: status === 'present' ? T.green : 'transparent',
                  borderWidth:1.5, borderColor: status === 'present' ? T.green : T.greenBd,
                }}
              >
                <Text style={{ fontSize:14, fontWeight:'900', color: status === 'present' ? '#fff' : T.green }}>P</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onStatusChange('absent')}
                hitSlop={{ top:8, bottom:8, left:4, right:4 }}
                style={{
                  width:44, height:38, borderRadius:10, alignItems:'center', justifyContent:'center',
                  backgroundColor: status === 'absent' ? T.red : 'transparent',
                  borderWidth:1.5, borderColor: status === 'absent' ? T.red : T.redBd,
                }}
              >
                <Text style={{ fontSize:14, fontWeight:'900', color: status === 'absent' ? '#fff' : T.red }}>A</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
const TeacherMarkAttendanceScreen = ({ token: propToken, user: propUser, onBack }) => {
  const { token: ctxToken, user: ctxUser } = useAuth();
  const token = propToken || ctxToken;
  const user  = propUser  || ctxUser;

  // ── date mode ────────────────────────────────────────────────────────────
  const [dateMode, setDateMode]               = useState('today');
  const activeDateStr                         = dateMode === 'yesterday' ? yesterdayStr() : todayStr();
  const activeDay                             = dayName(activeDateStr);

  const [step, setStep]                       = useState(1);
  const stepRef                               = useRef(1);
  const navigating                            = useRef(false);
  const navLockTimer                          = useRef(null);

  const [classes, setClasses]                 = useState([]);
  const [assignments, setAssignments]         = useState([]);
  const [selectedClass, setSelectedClass]     = useState(null);
  const [selectedPeriod, setSelectedPeriod]   = useState(null);

  // ── FIX: store the full period object so subject_id is available at save time
  const [selectedPeriodData, setSelectedPeriodData] = useState(null);

  const [students, setStudents]               = useState([]);
  const [periodSavedMap, setPeriodSavedMap]   = useState({});

  const [classesLoading, setClassesLoading]   = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [saved, setSaved]                     = useState(false);
  const [alreadySaved, setAlreadySaved]       = useState(false);
  const [toast, setToast]                     = useState({ visible:false, message:'', type:'success' });
  const [search, setSearch]                   = useState('');
  const [selected, setSelected]               = useState(new Set());

  const [existingSessionId, setExistingSessionId] = useState(null);

  const showToast = useCallback((msg, type = 'success') => setToast({ visible:true, message:msg, type }), []);
  const setStepSafe = useCallback((s) => { stepRef.current = s; setStep(s); }, []);

  const acquireNavLock = useCallback(() => {
    navigating.current = true;
    if (navLockTimer.current) clearTimeout(navLockTimer.current);
    navLockTimer.current = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => { navigating.current = false; });
    }, 300);
  }, []);

  const safeOnBack = useCallback(() => { if (!navigating.current && onBack) onBack(); }, [onBack]);

  useEffect(() => {
    const handler = () => {
      if (navigating.current) return true;
      const s = stepRef.current;
      if (s === 3) { goToStep2(); return true; }
      if (s === 2) { goToStep1(); return true; }
      safeOnBack(); return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => sub.remove();
  }, [safeOnBack]);

  useEffect(() => {
    loadData();
    return () => { if (navLockTimer.current) clearTimeout(navLockTimer.current); };
  }, []);

  useEffect(() => {
    if (step === 1) setPeriodSavedMap({});
  }, [dateMode, step]);

  const loadData = async () => {
    setClassesLoading(true);
    try {
      const data = await api.get(`/timetable-assignments?user_id=${user?.id || ''}`, token);
      const list = Array.isArray(data) ? data : (data?.assignments || []);
      setAssignments(list);
      setClasses(buildClassMap(list));
    } catch {
      showToast('Failed to load classes', 'error');
    } finally {
      setClassesLoading(false);
    }
  };

  const todayPeriods = selectedClass
    ? assignments
        .filter(a =>
          a.subcategory_id === selectedClass.subcategory_id &&
          (a.item_id === selectedClass.item_id || (!a.item_id && !selectedClass.item_id)) &&
          a.day === activeDay
        )
        .sort((a, b) => a.period_number - b.period_number)
    : [];

  const goToStep1 = useCallback(() => {
    navigating.current = false;
    if (navLockTimer.current) clearTimeout(navLockTimer.current);
    setStepSafe(1);
    setSelectedClass(null);
    setStudents([]);
    setSelectedPeriod(null);
    setSelectedPeriodData(null); // reset period data
    setSearch('');
    setSelected(new Set());
    setPeriodSavedMap({});
  }, [setStepSafe]);

  const goToStep2 = useCallback(() => {
    navigating.current = false;
    if (navLockTimer.current) clearTimeout(navLockTimer.current);
    setStepSafe(2);
    setSelectedPeriod(null);
    setSelectedPeriodData(null); // reset period data
    setStudents([]);
    setSearch('');
    setSelected(new Set());
  }, [setStepSafe]);

  const handleSelectClass = useCallback((cls) => {
    acquireNavLock();
    setStepSafe(2);
    setSelectedClass(cls);
    setSelectedPeriod(null);
    setSelectedPeriodData(null);
    setStudents([]);
    setPeriodSavedMap({});
    preloadPeriodSavedMap(cls);
  }, [setStepSafe, acquireNavLock, activeDateStr]);

  const preloadPeriodSavedMap = async (cls) => {
    try {
      const sessionsRaw = await api.get(
        `/attendance/sessions?date=${activeDateStr}&subcategory_id=${cls.subcategory_id}` +
        `${cls.category_id ? `&category_id=${cls.category_id}` : ''}` +
        `${cls.item_id ? `&item_id=${cls.item_id}` : ''}`, token
      ).catch(() => []);
      const allSessions = sessionsRaw?.sessions || sessionsRaw || [];
      const map = {};
      allSessions.forEach(s => {
        const key = String(s.period_id || s.period_number);
        map[key] = s.id;
      });
      setPeriodSavedMap(map);
    } catch { /* silent */ }
  };

  // ── FIX: accept full period item, store it in selectedPeriodData ──────────
  const handleSelectPeriod = useCallback((periodItem, cls) => {
    acquireNavLock();
    setStepSafe(3);
    setSelectedPeriod(periodItem.period_number);
    setSelectedPeriodData(periodItem); // <-- store the full period object
    InteractionManager.runAfterInteractions(() => {
      loadStudents(cls, periodItem.period_number);
    });
  }, [setStepSafe, acquireNavLock, activeDateStr]);

  const loadStudents = async (cls, periodNumber) => {
    if (!cls) return;
    setStudentsLoading(true);
    setSaved(false);
    setAlreadySaved(false);
    setExistingSessionId(null);
    setSearch('');
    setSelected(new Set());
    try {
      const [studentsData, sessionsRaw] = await Promise.all([
        api.get(`/students?subcategory_id=${cls.subcategory_id}&item_id=${cls.item_id || ''}`, token),
        api.get(
          `/attendance/sessions?date=${activeDateStr}&subcategory_id=${cls.subcategory_id}` +
          `${cls.category_id ? `&category_id=${cls.category_id}` : ''}` +
          `${cls.item_id ? `&item_id=${cls.item_id}` : ''}`, token
        ).catch(() => []),
      ]);

      const studentList    = Array.isArray(studentsData) ? studentsData : [];
      const allSessions    = sessionsRaw?.sessions || sessionsRaw || [];
      const periodSessions = allSessions.filter(s =>
        String(s.period_id) === String(periodNumber) || String(s.period_number) === String(periodNumber)
      );

      const existingMap = {};
      let foundSessionId = null;

      if (periodSessions.length > 0) {
        foundSessionId = periodSessions[0].id;
        const recs = await Promise.all(
          periodSessions.map(s => api.get(`/attendance/sessions/${s.id}/records`, token).catch(() => []))
        );
        recs.forEach(recRaw => {
          const records = Array.isArray(recRaw) ? recRaw : (recRaw?.records || recRaw?.data || []);
          records.forEach(r => { if (r?.student_id) existingMap[r.student_id] = r.status; });
        });
      }

      const hasExisting = Object.keys(existingMap).length > 0;
      setAlreadySaved(hasExisting);
      setExistingSessionId(foundSessionId);

      setStudents(studentList.map(s => ({
        ...s,
        status:         existingMap[s.id] || null,
        originalStatus: existingMap[s.id] || null,
      })));
    } catch {
      showToast('Failed to load students', 'error');
    } finally {
      setStudentsLoading(false);
    }
  };

  const setStatus    = useCallback((id, status) => setStudents(prev => prev.map(s => s.id === id ? { ...s, status } : s)), []);
  const markAll      = useCallback((status) => setStudents(prev => prev.map(s => ({ ...s, status }))), []);
  const toggleSelect = useCallback((id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }), []);
  const markSelected = useCallback((status) => { setStudents(prev => prev.map(s => selected.has(s.id) ? { ...s, status } : s)); setSelected(new Set()); }, [selected]);
  const selectAll    = useCallback(() => setSelected(new Set(students.map(s => s.id))), [students]);
  const clearSelect  = useCallback(() => setSelected(new Set()), []);

  // ── FIX: include subject_id from selectedPeriodData in session creation ───
  const saveAttendance = async () => {
    if (!selectedClass || !selectedPeriod || !students.length) return;
    setSaving(true);
    try {
      const marked = students.filter(s => s.status !== null);
      if (!marked.length) { showToast('Mark at least one student', 'warning'); setSaving(false); return; }

      let sessionId = existingSessionId;

      if (sessionId) {
        // UPDATE existing session records
        await api.put(`/attendance/sessions/${sessionId}/records`, {
          records: marked.map(s => ({ student_id: s.id, status: s.status })),
        }, token).catch(() =>
          api.post(`/attendance/sessions/${sessionId}/records`, {
            records: marked.map(s => ({ student_id: s.id, status: s.status })),
          }, token)
        );
      } else {
        // ── FIX: pass subject_id (matches web version behaviour) ─────────────
        const session = await api.post('/attendance/sessions', {
          date:           activeDateStr,
          subcategory_id: selectedClass.subcategory_id,
          category_id:    selectedClass.category_id    || null,
          item_id:        selectedClass.item_id        || null,
          subject_id:     selectedPeriodData?.subject_id || null,  // <-- THE FIX
          period_id:      selectedPeriod,
          taken_by:       user?.id,
        }, token);

        sessionId = session?.id || session?.session_id;
        if (!sessionId) throw new Error('Failed to create session');

        await api.post(`/attendance/sessions/${sessionId}/records`, {
          records: marked.map(s => ({ student_id: s.id, status: s.status })),
        }, token);
      }

      setSaved(true);
      setStudents(prev => prev.map(s => ({ ...s, originalStatus: s.status })));

      const lp = students.filter(s => s.status === 'present').length;
      const la = students.filter(s => s.status === 'absent').length;
      const isUpdate = !!existingSessionId;
      showToast(
        isUpdate
          ? `Updated! ${lp} present, ${la} absent`
          : `Saved! ${lp} present, ${la} absent`,
        'success'
      );
    } catch (e) {
      showToast(e.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const presentCount   = students.filter(s => s.status === 'present').length;
  const absentCount    = students.filter(s => s.status === 'absent').length;
  const notMarkedCount = students.filter(s => s.status === null).length;
  const updatedCount   = students.filter(s => s.originalStatus !== null && s.status !== s.originalStatus).length;

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1 — Pick a class
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === 1) return (
    <SafeAreaView style={{ flex:1, backgroundColor:T.bg }}>
      <StatusBar barStyle="light-content" backgroundColor="#1E1B4B" />
      <PremiumToast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast(p => ({ ...p, visible:false }))} />

      <GradientHeroHeader
        step={1}
        title="Manual Attendance"
        subtitle="Select the class to take attendance"
        icon="clipboard-outline"
        onBack={onBack ? safeOnBack : null}
        backLabel="Back"
        dateMode={dateMode}
        onDateModeChange={(mode) => setDateMode(mode)}
      />

      <FlatList
        data={classesLoading ? [] : classes}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ paddingHorizontal:16, paddingTop:20, paddingBottom:40 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          classesLoading ? (
            <View style={{ paddingTop:4 }}>
              {[1,2,3].map(i => <SkeletonBox key={i} width="100%" height={86} radius={T.radius.xl} style={{ marginBottom:12 }} />)}
            </View>
          ) : (
            <View style={{ alignItems:'center', paddingTop:60 }}>
              <LinearGradient colors={['#4F46E5','#7C3AED']} style={{ width:72, height:72, borderRadius:22, alignItems:'center', justifyContent:'center', marginBottom:16 }}>
                <Ionicons name="book-outline" size={32} color="#fff" />
              </LinearGradient>
              <Text style={{ fontSize:17, fontWeight:'800', color:T.textPri }}>No Classes Found</Text>
              <Text style={{ fontSize:13, color:T.textSec, textAlign:'center', marginTop:6, paddingHorizontal:32 }}>
                No timetable assignments found for {dateMode === 'yesterday' ? 'yesterday' : 'today'}
              </Text>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <ClassCard cls={item} index={index} onPress={() => handleSelectClass(item)} />
        )}
      />
    </SafeAreaView>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2 — Pick a period
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === 2) return (
    <SafeAreaView style={{ flex:1, backgroundColor:T.bg }}>
      <StatusBar barStyle="light-content" backgroundColor="#1E1B4B" />
      <PremiumToast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast(p => ({ ...p, visible:false }))} />

      <GradientHeroHeader
        step={2}
        title="Select Period"
        subtitle={`${activeDay}  ·  ${selectedClass?.name}${dateMode === 'yesterday' ? '  ·  Yesterday' : ''}`}
        icon="time-outline"
        onBack={goToStep1}
        backLabel="Change class"
      />

      <FlatList
        data={todayPeriods}
        keyExtractor={item => String(item.period_number)}
        contentContainerStyle={{ paddingHorizontal:16, paddingTop:20, paddingBottom:40 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{
            backgroundColor:T.amberLt, borderRadius:T.radius.xl, padding:28, alignItems:'center',
            borderWidth:1, borderColor:T.amberBd, marginTop:8,
          }}>
            <LinearGradient colors={['#D97706','#B45309']} style={{ width:56, height:56, borderRadius:16, alignItems:'center', justifyContent:'center', marginBottom:14 }}>
              <Ionicons name="calendar-outline" size={26} color="#fff" />
            </LinearGradient>
            <Text style={{ fontSize:16, fontWeight:'800', color:'#92400E' }}>No Periods</Text>
            <Text style={{ fontSize:13, color:'#A16207', textAlign:'center', marginTop:6 }}>
              No periods scheduled for {activeDay} in {selectedClass?.name}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const periodKey = String(item.period_number);
          const hasSaved  = !!periodSavedMap[periodKey];
          return (
            <PeriodCard
              period={item.period_number}
              subjectName={item.subject_name}
              startTime={item.start_time}
              endTime={item.end_time}
              status={getPeriodStatus(item.start_time, item.end_time)}
              // ── FIX: pass the full item object, not just the period number ──
              onPress={() => handleSelectPeriod(item, selectedClass)}
              index={index}
              isYesterday={dateMode === 'yesterday'}
              hasSavedRecords={hasSaved}
            />
          );
        }}
      />
    </SafeAreaView>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3 — Mark students
  // ═══════════════════════════════════════════════════════════════════════════
  const selPeriodItem    = todayPeriods.find(p => p.period_number === selectedPeriod);
  const filteredStudents = students.filter(s => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (s.full_name || '').toLowerCase().includes(q) ||
           String(s.roll_number || '').toLowerCase().includes(q) ||
           String(s.registration_number || s.reg_no || '').toLowerCase().includes(q);
  });
  const hasSelection = selected.size > 0;
  const isUpdateMode = !!existingSessionId;

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:T.bg }}>
      <StatusBar barStyle="light-content" backgroundColor="#1E1B4B" />
      <PremiumToast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast(p => ({ ...p, visible:false }))} />

      <GradientHeroHeader
        step={3}
        title={selPeriodItem?.subject_name || `Period ${selectedPeriod}`}
        subtitle={`P${selectedPeriod}  ·  ${selectedClass?.name}  ·  ${dateMode === 'yesterday' ? 'Yesterday' : new Date().toLocaleDateString('en-GB')}`}
        icon="people-outline"
        onBack={goToStep2}
        backLabel="Change period"
        extra={
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6, marginTop:10 }}>
            {isUpdateMode && (
              <View style={{
                flexDirection:'row', alignItems:'center', gap:5,
                backgroundColor:'rgba(217,119,6,0.22)', borderRadius:T.radius.pill,
                paddingHorizontal:12, paddingVertical:5,
                borderWidth:1, borderColor:'rgba(252,211,77,0.35)',
              }}>
                <Ionicons name="refresh-outline" size={12} color={T.amberBd} />
                <Text style={{ fontSize:12, fontWeight:'800', color:T.amberBd }}>Update Mode</Text>
              </View>
            )}
            <View style={{
              flexDirection:'row', alignItems:'center', gap:5,
              backgroundColor:'rgba(5,150,105,0.20)', borderRadius:T.radius.pill,
              paddingHorizontal:12, paddingVertical:5,
              borderWidth:1, borderColor:'rgba(110,231,183,0.35)',
            }}>
              <View style={{ width:6, height:6, borderRadius:3, backgroundColor:'#6EE7B7' }} />
              <Text style={{ fontSize:13, fontWeight:'800', color:'#D1FAE5' }}>{presentCount} Present</Text>
            </View>
            <View style={{
              flexDirection:'row', alignItems:'center', gap:5,
              backgroundColor:'rgba(239,68,68,0.20)', borderRadius:T.radius.pill,
              paddingHorizontal:12, paddingVertical:5,
              borderWidth:1, borderColor:'rgba(252,165,165,0.35)',
            }}>
              <View style={{ width:6, height:6, borderRadius:3, backgroundColor:'#FCA5A5' }} />
              <Text style={{ fontSize:13, fontWeight:'800', color:'#FEE2E2' }}>{absentCount} Absent</Text>
            </View>
            {notMarkedCount > 0 && (
              <View style={{
                flexDirection:'row', alignItems:'center', gap:5,
                backgroundColor:'rgba(255,255,255,0.12)', borderRadius:T.radius.pill,
                paddingHorizontal:12, paddingVertical:5,
                borderWidth:1, borderColor:'rgba(255,255,255,0.18)',
              }}>
                <Text style={{ fontSize:13, fontWeight:'800', color:'rgba(255,255,255,0.7)' }}>{notMarkedCount} Left</Text>
              </View>
            )}
            {updatedCount > 0 && (
              <View style={{
                flexDirection:'row', alignItems:'center', gap:5,
                backgroundColor:'rgba(217,119,6,0.22)', borderRadius:T.radius.pill,
                paddingHorizontal:12, paddingVertical:5,
                borderWidth:1, borderColor:'rgba(252,211,77,0.35)',
              }}>
                <Ionicons name="swap-horizontal-outline" size={12} color={T.amberBd} />
                <Text style={{ fontSize:12, fontWeight:'800', color:T.amberBd }}>{updatedCount} Changed</Text>
              </View>
            )}
          </View>
        }
      />

      {/* ── Toolbar ── */}
      <View style={{ backgroundColor:'#fff', paddingHorizontal:14, paddingTop:12, paddingBottom:0, borderBottomWidth:1, borderBottomColor:T.border }}>
        <View style={{ flexDirection:'row', gap:8, marginBottom:10 }}>
          <TouchableOpacity
            onPress={() => markAll('present')}
            style={{ flex:1, backgroundColor:T.greenLt, borderRadius:10, paddingVertical:10, alignItems:'center', borderWidth:1, borderColor:T.greenBd, flexDirection:'row', justifyContent:'center', gap:6 }}
          >
            <Ionicons name="checkmark-circle-outline" size={15} color={T.green} />
            <Text style={{ color:T.green, fontWeight:'700', fontSize:13 }}>All Present</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => markAll('absent')}
            style={{ flex:1, backgroundColor:T.redLt, borderRadius:10, paddingVertical:10, alignItems:'center', borderWidth:1, borderColor:T.redBd, flexDirection:'row', justifyContent:'center', gap:6 }}
          >
            <Ionicons name="close-circle-outline" size={15} color={T.red} />
            <Text style={{ color:T.red, fontWeight:'700', fontSize:13 }}>All Absent</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection:'row', alignItems:'center', backgroundColor:T.slateLt, borderRadius:10, paddingHorizontal:12, paddingVertical:9 }}>
          <Ionicons name="search-outline" size={15} color={T.textMut} style={{ marginRight:8 }} />
          <TextInput
            style={{ flex:1, fontSize:14, color:T.textPri, padding:0 }}
            placeholder="Search by name or reg. no..."
            placeholderTextColor={T.textMut}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
              <Ionicons name="close" size={15} color={T.textMut} />
            </TouchableOpacity>
          )}
        </View>

        {hasSelection ? (
          <View style={{ flexDirection:'row', alignItems:'center', marginTop:8, marginBottom:8, gap:8 }}>
            <Text style={{ fontSize:12, color:T.textSec, flex:1, fontWeight:'600' }}>{selected.size} selected</Text>
            <TouchableOpacity onPress={() => markSelected('present')} style={{ backgroundColor:T.greenLt, paddingHorizontal:12, paddingVertical:6, borderRadius:8, borderWidth:1, borderColor:T.greenBd }}>
              <Text style={{ fontSize:12, fontWeight:'700', color:T.green }}>Mark Present</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => markSelected('absent')} style={{ backgroundColor:T.redLt, paddingHorizontal:12, paddingVertical:6, borderRadius:8, borderWidth:1, borderColor:T.redBd }}>
              <Text style={{ fontSize:12, fontWeight:'700', color:T.red }}>Mark Absent</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={clearSelect} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
              <Text style={{ fontSize:12, color:T.textMut, fontWeight:'700' }}>Clear</Text>
            </TouchableOpacity>
          </View>
        ) : students.length > 0 ? (
          <TouchableOpacity onPress={selectAll} style={{ marginTop:6, marginBottom:8, alignSelf:'flex-end' }} hitSlop={{ top:8, bottom:8, left:20, right:8 }}>
            <Text style={{ fontSize:11, color:T.indigo, fontWeight:'700' }}>Select all</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ height:8 }} />
        )}
      </View>

      {/* ── Student list ── */}
      {studentsLoading ? (
        <View style={{ flex:1, backgroundColor:T.bg }}>
          <View style={{ paddingHorizontal:14, paddingTop:14 }}>
            {[1,2,3,4,5].map(i => <SkeletonBox key={i} width="100%" height={72} radius={T.radius.lg} style={{ marginBottom:8 }} />)}
          </View>
          <View style={{ alignItems:'center', marginTop:16 }}>
            <ActivityIndicator color={T.indigo} />
            <Text style={{ fontSize:13, color:T.textSec, marginTop:8, fontWeight:'500' }}>Loading students...</Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={s => String(s.id)}
          contentContainerStyle={{ paddingHorizontal:14, paddingTop:10, paddingBottom:110 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ alignItems:'center', paddingVertical:50 }}>
              <LinearGradient colors={['#4F46E5','#7C3AED']} style={{ width:60, height:60, borderRadius:16, alignItems:'center', justifyContent:'center', marginBottom:12 }}>
                <Ionicons name={search ? 'search' : 'people-outline'} size={26} color="#fff" />
              </LinearGradient>
              <Text style={{ fontSize:15, fontWeight:'800', color:T.textPri }}>
                {search ? 'No results found' : 'No students enrolled'}
              </Text>
              <Text style={{ fontSize:13, color:T.textMut, marginTop:4 }}>
                {search ? `No match for "${search}"` : 'No students found for this class'}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <StudentMarkCard
              student={item}
              index={index}
              isSelected={selected.has(item.id)}
              status={item.status}
              originalStatus={item.originalStatus}
              onPress={() => hasSelection ? toggleSelect(item.id) : null}
              onLongPress={() => toggleSelect(item.id)}
              onStatusChange={(s) => setStatus(item.id, s)}
            />
          )}
        />
      )}

      {/* ── Floating save / update button ── */}
      {!saved ? (
        <TouchableOpacity
          onPress={saveAttendance}
          disabled={saving || studentsLoading}
          activeOpacity={0.88}
          style={{ position:'absolute', bottom:20, left:16, right:16, borderRadius:16, overflow:'hidden', ...T.shadow.lg }}
        >
          <LinearGradient
            colors={saving || studentsLoading
              ? ['#A5B4FC','#A5B4FC']
              : isUpdateMode ? ['#D97706','#B45309'] : ['#4F46E5','#3730A3']}
            start={{x:0,y:0}} end={{x:1,y:0}}
            style={{ paddingVertical:16, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8 }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name={isUpdateMode ? 'refresh-outline' : 'save-outline'} size={18} color="#fff" />
                <Text style={{ fontSize:14, fontWeight:'700', color:'#fff' }}>
                  {isUpdateMode ? 'Update' : 'Save'}  ·  {presentCount}P  {absentCount}A
                  {updatedCount > 0 ? `  (${updatedCount} changed)` : ''}
                  {notMarkedCount > 0 ? `  ${notMarkedCount} unmarked` : ''}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <View style={{ position:'absolute', bottom:20, left:16, right:16, borderRadius:16, overflow:'hidden', ...T.shadow.lg }}>
          <LinearGradient
            colors={[T.green,'#047857']}
            start={{x:0,y:0}} end={{x:1,y:0}}
            style={{ paddingVertical:16, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8 }}
          >
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={{ fontSize:14, fontWeight:'700', color:'#fff' }}>
              {isUpdateMode ? 'Attendance Updated!' : 'Attendance Saved!'}
            </Text>
          </LinearGradient>
        </View>
      )}
    </SafeAreaView>
  );
};

export default TeacherMarkAttendanceScreen;