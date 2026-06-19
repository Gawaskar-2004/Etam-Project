import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, ScrollView,
  SafeAreaView, Platform, Animated, Vibration, AppState, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { C, BASE_URL } from '../../config/constants';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { todayStr, hasFaceRegistered, buildClassMap, formatTime } from '../../utils/helpers';
import useCameraPermission from '../../hooks/useCameraPermission';
import { FaceAttendanceCameraModal } from '../../components/CameraModal';

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
  redLt:   '#FEF2F2',
  slate:   '#64748B',
  slateLt: '#F1F5F9',
  radius:  { sm:8, md:12, lg:16, xl:20, pill:999 },
  shadow:  {
    sm: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:6, elevation:2 },
    md: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:4}, shadowOpacity:0.10, shadowRadius:12, elevation:4 },
    lg: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:8}, shadowOpacity:0.14, shadowRadius:20, elevation:8 },
  },
};

// ─── Constants ────────────────────────────────────────────────────────────────
// FAST MODE: Single frame match — no liveness, no consecutive wait
const CONSECUTIVE_MATCH_REQUIRED  = 1;   // ✅ Instant mark on 1st confident match
const MIN_CONFIDENCE              = 0.62; // ✅ Relaxed for faster detection
const DUPLICATE_COOLDOWN_MS       = 30000;
const MOTION_CHECK_INTERVAL       = 10;
const SCAN_CHAIN_DELAY_MS         = 100;  // ✅ 100ms instead of 200ms (2x faster)
const DETECTED_NAME_DISPLAY_MS    = 1500;
const NO_MATCH_REMINDER_THRESHOLD = 8;
const NO_MATCH_REPEAT_INTERVAL    = 12;
const TOAST_DURATION_MS           = 2500;
const CAMERA_REQUEST_TIMEOUT_MS   = 6000; // ✅ Tighter timeout
const TOGGLE_DEBOUNCE_MS          = 300;
const MAX_ANIMATION_DELAY_MS      = 300;
const MAX_HISTORY_ITEMS           = 20;
const HISTORY_DISPLAY_COUNT       = 5;

// ─── Helper: Toast Color ──────────────────────────────────────────────────────
const toastColor = (type) => {
  if (type === 'error')   return '#EF4444';
  if (type === 'warning') return T.amber;
  if (type === 'info')    return '#0EA5E9';
  return T.green; // ✅ Green for success (attendance marked feel)
};

// ─── SkeletonBox ──────────────────────────────────────────────────────────────
const SkeletonBox = ({ width, height, radius = 8, style }) => {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue:1, duration:900, useNativeDriver:true }),
      Animated.timing(anim, { toValue:0.4, duration:900, useNativeDriver:true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={[{ width, height, borderRadius:radius, backgroundColor:'#E2E8F0', opacity:anim }, style]}
    />
  );
};

// ─── Fast Mode Banner ─────────────────────────────────────────────────────────
const FastModeBanner = React.memo(() => (
  <View style={{
    backgroundColor: '#F0FDF4', borderRadius: T.radius.lg, padding: 12,
    borderWidth: 1, borderColor: '#86EFAC', marginBottom: 14,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  }}>
    <Ionicons name="flash" size={18} color="#16A34A" style={{ marginTop: 1 }} />
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 12, fontWeight: '800', color: '#15803D', marginBottom: 2 }}>
        Fast Auto-Mark Mode Active
      </Text>
      <Text style={{ fontSize: 11, color: '#16A34A', lineHeight: 16 }}>
        Face detected → instantly marked present · {MIN_CONFIDENCE * 100}% confidence · No confirmation needed
      </Text>
    </View>
  </View>
));

// ─── Class Card ───────────────────────────────────────────────────────────────
const ClassCard = React.memo(({ cls, isSelected, onPress, count }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handleIn  = useCallback(() => Animated.spring(scale, { toValue:0.96, useNativeDriver:true }).start(), []);
  const handleOut = useCallback(() => Animated.spring(scale, { toValue:1,    useNativeDriver:true }).start(), []);
  return (
    <Animated.View style={{ transform:[{scale}] }}>
      <TouchableOpacity
        onPress={onPress} onPressIn={handleIn} onPressOut={handleOut}
        activeOpacity={0.9}
        style={{
          backgroundColor: isSelected ? T.indigo : T.surface,
          borderRadius: T.radius.lg,
          paddingHorizontal:16, paddingVertical:12,
          marginRight:12,
          borderWidth:1,
          borderColor: isSelected ? T.indigo : T.border,
          ...(isSelected ? T.shadow.md : T.shadow.sm),
          minWidth:100,
          alignItems:'center',
        }}
      >
        <Text style={{ fontSize:14, fontWeight:'700', color: isSelected ? '#fff' : T.textPri }}>{cls.name}</Text>
        <Text style={{ fontSize:11, color: isSelected ? 'rgba(255,255,255,0.7)' : T.textSec, marginTop:3 }}>
          {count} period{count !== 1 ? 's' : ''}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Period Select Card ───────────────────────────────────────────────────────
const PeriodSelectCard = React.memo(({ period, isSaved, isSelected, onPress, subjectName, startTime, endTime }) => {
  const slideAnim = useRef(new Animated.Value(20)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(fadeAnim,  { toValue:1, duration:300, useNativeDriver:true }),
      Animated.timing(slideAnim, { toValue:0, duration:300, useNativeDriver:true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.View style={{ opacity:fadeAnim, transform:[{translateY:slideAnim}] }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={{
          backgroundColor: isSaved ? T.greenLt : (isSelected ? T.indigoLt : T.surface),
          borderRadius: T.radius.xl,
          marginBottom:10,
          padding:14,
          borderWidth: isSelected ? 2 : 1,
          borderColor: isSaved ? T.green : (isSelected ? T.indigo : T.border),
          ...T.shadow.sm,
        }}
      >
        <View style={{ flexDirection:'row', alignItems:'center' }}>
          <LinearGradient
            colors={isSaved ? [T.green,'#047857'] : (isSelected ? [T.indigo,'#7C3AED'] : ['#E2E8F0','#CBD5E1'])}
            style={{ width:48, height:48, borderRadius:15, alignItems:'center', justifyContent:'center', marginRight:14 }}
          >
            <Text style={{ fontSize:12, fontWeight:'900', color:'#fff' }}>P{period}</Text>
          </LinearGradient>
          <View style={{ flex:1 }}>
            <Text style={{ fontSize:16, fontWeight:'800', color: isSaved ? T.green : T.textPri }}>
              {subjectName || `Period ${period}`}
            </Text>
            <View style={{ flexDirection:'row', alignItems:'center', gap:5, marginTop:4 }}>
              <Ionicons name="time-outline" size={12} color={T.textSec} />
              <Text style={{ fontSize:12, fontWeight:'600', color:T.textSec }}>
                {startTime && endTime ? `${formatTime(startTime)} – ${formatTime(endTime)}` : 'Time TBD'}
              </Text>
            </View>
          </View>
          {isSaved ? (
            <View style={{ backgroundColor:T.green, borderRadius:T.radius.pill, paddingHorizontal:10, paddingVertical:4 }}>
              <Text style={{ fontSize:11, fontWeight:'700', color:'#fff' }}>Saved</Text>
            </View>
          ) : isSelected ? (
            <Ionicons name="checkmark-circle" size={24} color={T.indigo} />
          ) : (
            <Ionicons name="chevron-forward" size={20} color={T.textMut} />
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Student Attendance Card ──────────────────────────────────────────────────
const StudentAttendanceCard = React.memo(({ student, index, onToggle, hasFace }) => {
  const delay         = Math.min(index * 40, MAX_ANIMATION_DELAY_MS);
  const slideAnim     = useRef(new Animated.Value(20)).current;
  const fadeAnim      = useRef(new Animated.Value(0)).current;
  const lastToggleRef = useRef(0);

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(fadeAnim,  { toValue:1, duration:300, delay, useNativeDriver:true }),
      Animated.timing(slideAnim, { toValue:0, duration:300, delay, useNativeDriver:true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, []);

  const handleToggle = useCallback(() => {
    const now = Date.now();
    if (now - lastToggleRef.current < TOGGLE_DEBOUNCE_MS) return;
    lastToggleRef.current = now;
    onToggle(student.id);
  }, [onToggle, student.id]);

  const isPresent = student.present;
  return (
    <Animated.View style={{ opacity:fadeAnim, transform:[{translateY:slideAnim}] }}>
      <TouchableOpacity
        onPress={handleToggle}
        activeOpacity={0.8}
        style={{
          backgroundColor: isPresent ? T.greenLt : T.surface,
          borderRadius: T.radius.lg,
          marginBottom:10,
          padding:12,
          borderWidth:1,
          borderColor: isPresent ? T.green : T.border,
          ...T.shadow.sm,
        }}
      >
        <View style={{ flexDirection:'row', alignItems:'center' }}>
          <View style={{
            width:22, height:22, borderRadius:6, marginRight:12,
            backgroundColor: isPresent ? T.green : 'transparent',
            borderWidth: isPresent ? 0 : 1.5, borderColor:'#CBD5E1',
            alignItems:'center', justifyContent:'center',
          }}>
            {isPresent && <Feather name="check" size={14} color="#fff" />}
          </View>
          <LinearGradient
            colors={hasFace ? [T.indigo,'#7C3AED'] : ['#D97706','#B45309']}
            style={{ width:44, height:44, borderRadius:14, alignItems:'center', justifyContent:'center', marginRight:14 }}
          >
            <Text style={{ fontSize:16, fontWeight:'800', color:'#fff' }}>
              {student.full_name?.[0]?.toUpperCase()}
            </Text>
          </LinearGradient>
          <View style={{ flex:1 }}>
            <Text style={{ fontSize:15, fontWeight:'700', color:T.textPri }}>{student.full_name}</Text>
            <Text style={{ fontSize:12, color:T.textSec, marginTop:2 }}>
              {student.register_number || student.registration_number || '—'}
            </Text>
            {student.detectedAt && (
              <View style={{ flexDirection:'row', alignItems:'center', gap:4, marginTop:2 }}>
                <Ionicons name="flash" size={12} color={T.green} />
                <Text style={{ fontSize:11, fontWeight:'600', color:T.green }}>
                  Auto-detected · {student.detectedAt}
                </Text>
              </View>
            )}
            {student.markedManually && !student.detectedAt && (
              <View style={{ flexDirection:'row', alignItems:'center', gap:4, marginTop:2 }}>
                <Ionicons name="hand-left-outline" size={12} color={T.amber} />
                <Text style={{ fontSize:11, fontWeight:'600', color:T.amber }}>Marked manually</Text>
              </View>
            )}
          </View>
          <View style={{
            backgroundColor: hasFace ? T.indigoLt : T.amberLt,
            paddingHorizontal:8, paddingVertical:4, borderRadius:T.radius.pill,
          }}>
            <Text style={{ fontSize:10, fontWeight:'700', color: hasFace ? T.indigo : T.amber }}>
              {hasFace ? 'Face ✓' : 'No face'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
const TeacherFaceAttendanceScreen = ({ token: propToken, user: propUser, onBack, navigation }) => {
  const { token: ctxToken, user: ctxUser } = useAuth();
  const token = propToken || ctxToken;
  const user  = propUser  || ctxUser;

  const date  = useMemo(() => todayStr(), []);
  const today = useMemo(() => ['SUN','MON','TUE','WED','THU','FRI','SAT'][new Date().getDay()], []);

  const [step, setStep]                           = useState(1);
  const [assignments, setAssignments]             = useState([]);
  const [classes, setClasses]                     = useState([]);
  const [selectedClass, setSelectedClass]         = useState(null);
  const [selectedPeriod, setSelectedPeriod]       = useState(null);
  const [students, setStudents]                   = useState([]);
  const [loading, setLoading]                     = useState(false);
  const [cameraVisible, setCameraVisible]         = useState(false);
  const [isScanning, setIsScanning]               = useState(false);
  const [saving, setSaving]                       = useState(false);
  const [detectedName, setDetectedName]           = useState(null);
  const [savedPeriods, setSavedPeriods]           = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [toast, setToast]                         = useState({ visible:false, message:'', type:'success' });
  const [processingFrame, setProcessingFrame]     = useState(false);
  const [noMatchCount, setNoMatchCount]           = useState(0);
  const [cameraFacing, setCameraFacing]           = useState('front');

  // ✅ REMOVED all liveness/proxy state — replaced with simple scan counter
  const [scanCount, setScanCount]                 = useState(0);

  // Refs
  const lastDetectedTimeRef     = useRef({});
  const frameCountRef           = useRef(0);
  const prevFrameHashRef        = useRef(null);
  const cameraRef               = useRef(null);
  const scanningRef             = useRef(false);
  const processingRef           = useRef(false);
  const scanChainTimeoutRef     = useRef(null);
  const studentsRef             = useRef([]);
  const selectedClassRef        = useRef(null);
  const toastTimeoutRef         = useRef(null);
  const detectedNameTimeoutRef  = useRef(null);
  const detectFaceRef           = useRef(null);

  const { hasPermission, requestPermission } = useCameraPermission();

  useEffect(() => { studentsRef.current = students; }, [students]);
  useEffect(() => { selectedClassRef.current = selectedClass; }, [selectedClass]);

  // ── showToast ─────────────────────────────────────────────────────────────
  const showToast = useCallback((msg, type = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ visible:true, message:msg, type });
    toastTimeoutRef.current = setTimeout(
      () => setToast(prev => ({ ...prev, visible:false })),
      TOAST_DURATION_MS
    );
  }, []);

  // ── stopScanChain ─────────────────────────────────────────────────────────
  const stopScanChain = useCallback(() => {
    if (scanChainTimeoutRef.current) {
      clearTimeout(scanChainTimeoutRef.current);
      scanChainTimeoutRef.current = null;
    }
    scanningRef.current   = false;
    processingRef.current = false;
  }, []);

  // ── resetSession ──────────────────────────────────────────────────────────
  const resetSession = useCallback(() => {
    stopScanChain();
    setCameraVisible(false);
    setIsScanning(false);
    setDetectedName(null);
    setProcessingFrame(false);
    setNoMatchCount(0);
    setScanCount(0);
    lastDetectedTimeRef.current  = {};
    prevFrameHashRef.current     = null;
    frameCountRef.current        = 0;
    scanningRef.current          = false;
    processingRef.current        = false;
  }, [stopScanChain]);

  // ── AppState ──────────────────────────────────────────────────────────────
  useEffect(() => {
    loadData();
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') resetSession();
    });
    return () => {
      sub.remove();
      resetSession();
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (detectedNameTimeoutRef.current) clearTimeout(detectedNameTimeoutRef.current);
    };
  }, []);

  const loadData = useCallback(async () => {
    try {
      const data = await api.get(`/timetable-assignments?user_id=${user?.id || ''}`, token);
      const list = Array.isArray(data) ? data : (data?.assignments || []);
      setAssignments(list);
      setClasses(buildClassMap(list));
    } catch {
      showToast('Failed to load classes', 'error');
    }
  }, [token, user?.id, showToast]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const todayPeriods = useMemo(() => {
    if (!selectedClass) return [];
    return assignments
      .filter(a =>
        a.subcategory_id === selectedClass.subcategory_id &&
        a.item_id        === selectedClass.item_id &&
        a.day            === today
      )
      .sort((a, b) => a.period_number - b.period_number);
  }, [assignments, selectedClass, today]);

  const faceMap = useMemo(() => {
    const map = {};
    students.forEach(s => { map[s.id] = hasFaceRegistered(s); });
    return map;
  }, [students]);

  const presentCount      = useMemo(() => students.filter(s => s.present).length, [students]);
  const faceDetectedCount = useMemo(() => students.filter(s => s.present && s.detectedAt).length, [students]);
  const totalStudents     = students.length;

  const recentHistory = useMemo(
    () => attendanceHistory.slice(0, HISTORY_DISPLAY_COUNT),
    [attendanceHistory]
  );

  const activeDaysCount   = useMemo(() => new Set(assignments.map(a => a.day)).size, [assignments]);
  const totalClassesToday = useMemo(() => assignments.filter(a => a.day === today).length, [assignments, today]);

  const step1Stats = useMemo(() => [
    { label:'Classes',         value: classes.length    },
    { label:'Active Days',     value: activeDaysCount   },
    { label:"Today's Periods", value: totalClassesToday },
  ], [classes.length, activeDaysCount, totalClassesToday]);

  const step2Stats = useMemo(() => [
    { label:'Total',   value: totalStudents                },
    { label:'Present', value: presentCount                 },
    { label:'Absent',  value: totalStudents - presentCount },
  ], [totalStudents, presentCount]);

  const headerStats = step === 1 ? step1Stats : step2Stats;

  // ── computeFrameHash ──────────────────────────────────────────────────────
  const computeFrameHash = useCallback((base64) => {
    let hash = 0;
    for (let i = 0; i < base64.length; i += 500) {
      hash = ((hash << 5) - hash) + base64.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }, []);

  const isFrameStatic = useCallback((base64) => {
    const hash     = computeFrameHash(base64);
    const isStatic = prevFrameHashRef.current !== null && prevFrameHashRef.current === hash;
    prevFrameHashRef.current = hash;
    return isStatic;
  }, [computeFrameHash]);

  // ── scheduleNextScan ──────────────────────────────────────────────────────
  const scheduleNextScan = useCallback(() => {
    if (!scanningRef.current) return;
    scanChainTimeoutRef.current = setTimeout(async () => {
      if (scanningRef.current && detectFaceRef.current) {
        await detectFaceRef.current();
      }
      if (scanningRef.current) {
        scheduleNextScan();
      }
    }, SCAN_CHAIN_DELAY_MS);
  }, []);

  // ── detectFace — FAST AUTO-MARK (no liveness, no consecutive wait) ────────
  useEffect(() => {
    detectFaceRef.current = async () => {
      if (!scanningRef.current || processingRef.current) return;
      if (!cameraRef.current) return;

      const cls = selectedClassRef.current;
      if (!cls) return;

      processingRef.current = true;
      setProcessingFrame(true);

      let tid;
      try {
        // ✅ Low res + low quality for speed
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.15,
          base64: true,
          exif: false,
          skipProcessing: true,
          width: 320,
          height: 240,
        });
        if (!photo?.base64) return;

        frameCountRef.current += 1;
        setScanCount(c => c + 1);

        // Skip truly static frames (frozen camera etc.) but don't block on motion
        if (isFrameStatic(photo.base64)) {
          if (frameCountRef.current % MOTION_CHECK_INTERVAL === 0) {
            showToast('Camera appears frozen — please move', 'warning');
          }
          return;
        }

        const controller = new AbortController();
        tid = setTimeout(() => controller.abort(), CAMERA_REQUEST_TIMEOUT_MS);

        const response = await fetch(`${BASE_URL}/attendance/face-recognize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify({
            image:          photo.base64,
            subcategory_id: cls.subcategory_id,
            item_id:        cls.item_id || null,
            return_confidence: true,
          }),
          signal: controller.signal,
        });
        clearTimeout(tid);
        tid = null;

        if (!response.ok) return;
        const result = await response.json();

        if (result.matched && result.student_id) {
          const confidence = result.confidence ?? 1.0;

          // ✅ Confidence check only — no liveness, no consecutive frames
          if (confidence < MIN_CONFIDENCE) {
            setNoMatchCount(prev => prev + 1);
            return;
          }

          const student = studentsRef.current.find(s => s.id === result.student_id);
          if (!student) return;

          // Skip already-present students (cooldown guard)
          if (student.present) {
            const lastTime = lastDetectedTimeRef.current[result.student_id] || 0;
            if (Date.now() - lastTime < DUPLICATE_COOLDOWN_MS) return;
          }

          // ✅ INSTANT MARK — no waiting, no challenge
          const now = new Date().toLocaleTimeString();
          const updatedStudents = studentsRef.current.map(s =>
            s.id === result.student_id
              ? { ...s, present:true, detectedAt:now, markedManually:false }
              : s
          );
          studentsRef.current = updatedStudents;
          setStudents(updatedStudents);

          setDetectedName(student.full_name);
          setAttendanceHistory(prevH => [
            { name:student.full_name, time:now, period:selectedPeriod, confidence:Math.round(confidence * 100) },
            ...prevH.slice(0, MAX_HISTORY_ITEMS - 1),
          ]);
          lastDetectedTimeRef.current[result.student_id] = Date.now();
          setNoMatchCount(0);

          // ✅ Vibrate + toast immediately
          Vibration.vibrate([0, 60, 40, 60]);
          showToast(`✓ ${student.full_name} marked present (${Math.round(confidence * 100)}%)`, 'success');

          if (detectedNameTimeoutRef.current) clearTimeout(detectedNameTimeoutRef.current);
          detectedNameTimeoutRef.current = setTimeout(
            () => setDetectedName(null),
            DETECTED_NAME_DISPLAY_MS
          );

        } else {
          // No face matched
          setNoMatchCount(prev => {
            const n = prev + 1;
            if (n === NO_MATCH_REMINDER_THRESHOLD || (n > NO_MATCH_REMINDER_THRESHOLD && n % NO_MATCH_REPEAT_INTERVAL === 0)) {
              showToast('No face matched — ensure good lighting & face is visible', 'info');
            }
            return n;
          });
        }
      } catch (error) {
        if (error?.name !== 'AbortError') console.error('[FaceAttendance] Detection error:', error);
      } finally {
        if (tid) clearTimeout(tid);
        processingRef.current = false;
        setProcessingFrame(false);
      }
    };
  }); // intentionally no dep array — always fresh

  // ── proceedToScan ─────────────────────────────────────────────────────────
  const proceedToScan = async () => {
    if (!selectedClass)  { showToast('Select a class', 'error');  return; }
    if (!selectedPeriod) { showToast('Select a period', 'error'); return; }
    if (savedPeriods.map(String).includes(String(selectedPeriod))) {
      showToast(`Period ${selectedPeriod} attendance already saved`, 'error');
      return;
    }
    setLoading(true);
    try {
      const data = await api.get(
        `/students?subcategory_id=${selectedClass.subcategory_id}&item_id=${selectedClass.item_id || ''}`,
        token
      );
      const list = Array.isArray(data) ? data : [];

      if (!selectedClass.subcategory_id) {
        showToast('Invalid class data. Please reload.', 'error');
        return;
      }

      const enriched = list.map(s => ({ ...s, present:false, detectedAt:null, markedManually:false }));
      setStudents(enriched);
      studentsRef.current         = enriched;
      lastDetectedTimeRef.current = {};
      frameCountRef.current       = 0;
      prevFrameHashRef.current    = null;
      setScanCount(0);
      setStep(2);

      const faceCount = list.filter(s => hasFaceRegistered(s)).length;
      if (faceCount === 0) {
        showToast('No face data registered. Use manual marking below.', 'warning');
      } else {
        showToast(`${faceCount} face profile(s) ready — fast scan active`, 'success');
      }
    } catch {
      showToast('Failed to load students', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── openCamera ────────────────────────────────────────────────────────────
  const openCamera = async () => {
    if (cameraVisible) return;
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please enable camera access in your device Settings to use face scanning.',
          [{ text: 'OK' }]
        );
        return;
      }
    }
    setCameraVisible(true);
    setNoMatchCount(0);
    prevFrameHashRef.current = null;
    frameCountRef.current    = 0;
  };

  const closeCamera = useCallback(() => {
    resetSession();
    setDetectedName(null);
    if (detectedNameTimeoutRef.current) clearTimeout(detectedNameTimeoutRef.current);
  }, [resetSession]);

  // ── startScan — begins fast chain ─────────────────────────────────────────
  const startScan = useCallback(() => {
    const hasFaceData = studentsRef.current.some(s => hasFaceRegistered(s));
    if (!hasFaceData) {
      showToast('No face profiles found. Use manual marking only.', 'warning');
      return;
    }
    if (scanningRef.current) return;
    stopScanChain();
    scanningRef.current = true;
    setIsScanning(true);
    setNoMatchCount(0);
    setScanCount(0);
    showToast(`Fast scan started · P${selectedPeriod}`, 'success');
    scheduleNextScan();
  }, [showToast, selectedPeriod, stopScanChain, scheduleNextScan]);

  // ── stopScan ──────────────────────────────────────────────────────────────
  const stopScan = useCallback(() => {
    stopScanChain();
    setIsScanning(false);
    setDetectedName(null);
    setProcessingFrame(false);
    setNoMatchCount(0);
    showToast('Scanning stopped', 'info');
  }, [stopScanChain, showToast]);

  // ── toggleStudent ─────────────────────────────────────────────────────────
  const toggleStudent = useCallback((id) => {
    setStudents(prev => {
      const updated = prev.map(s =>
        s.id === id
          ? { ...s, present:!s.present, detectedAt:null, markedManually:!s.present }
          : s
      );
      studentsRef.current = updated;
      return updated;
    });
  }, []);

  // ── markAll ───────────────────────────────────────────────────────────────
  const markAll = useCallback((present) => {
    setStudents(prev => {
      const updated = prev.map(s => ({
        ...s, present,
        detectedAt:     present ? s.detectedAt : null,
        markedManually: present ? !s.detectedAt : false,
      }));
      studentsRef.current = updated;
      return updated;
    });
  }, []);

  // ── saveAttendance ────────────────────────────────────────────────────────
  const saveAttendance = async () => {
    if (!selectedClass || !students.length || !selectedPeriod) return;
    if (savedPeriods.map(String).includes(String(selectedPeriod))) {
      showToast(`Period ${selectedPeriod} already saved`, 'error');
      return;
    }
    const presCount = students.filter(s => s.present).length;
    if (presCount === 0) {
      Alert.alert(
        'No Students Present',
        'You are about to save attendance with 0 students present. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save Anyway', style: 'destructive', onPress: () => doSave() },
        ]
      );
      return;
    }
    doSave();
  };

  const doSave = async () => {
    setSaving(true);
    try {
      const session = await api.post('/attendance/sessions', {
        date,
        subcategory_id: selectedClass.subcategory_id,
        category_id:    selectedClass.category_id || null,
        item_id:        selectedClass.item_id || null,
        subject_id:     null,
        period_id:      selectedPeriod,
        taken_by:       user?.id,
        method:         'face_recognition',
        scan_info: {
          mode:            'fast_auto_mark',
          min_confidence:  MIN_CONFIDENCE,
          total_scans:     scanCount,
        },
      }, token);

      await api.post(`/attendance/sessions/${session.id}/records`, {
        records: students.map(s => ({
          student_id:    s.id,
          status:        s.present ? 'present' : 'absent',
          marked_by:     s.detectedAt ? 'face' : 'manual',
          detected_time: s.detectedAt || null,
        })),
      }, token);

      const faceCount    = students.filter(s => s.present && s.detectedAt).length;
      const manualCount  = students.filter(s => s.present && !s.detectedAt).length;
      const totalPresent = students.filter(s => s.present).length;

      setSavedPeriods(prev => [...new Set([...prev.map(String), String(selectedPeriod)])]);
      showToast(
        `P${selectedPeriod} saved · ${totalPresent} present (${faceCount} face, ${manualCount} manual)`,
        'success'
      );

      resetSession();
      setStep(1);
      setSelectedPeriod(null);
      setStudents([]);
      studentsRef.current = [];
      setAttendanceHistory([]);
      setNoMatchCount(0);
      setScanCount(0);
      lastDetectedTimeRef.current = {};
    } catch (err) {
      const isConflict =
        err?.response?.status === 409 ||
        err?.status === 409 ||
        err?.message?.toLowerCase().includes('conflict') ||
        err?.message?.toLowerCase().includes('already');

      if (isConflict) {
        showToast('Session already exists for this period', 'error');
        setSavedPeriods(prev => [...new Set([...prev.map(String), String(selectedPeriod)])]);
      } else {
        showToast('Failed to save attendance', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  // ── goBackToStep1 ─────────────────────────────────────────────────────────
  const goBackToStep1 = useCallback(() => {
    resetSession();
    setStep(1);
    setStudents([]);
    studentsRef.current = [];
    setAttendanceHistory([]);
    setNoMatchCount(0);
    lastDetectedTimeRef.current = {};
    setScanCount(0);
  }, [resetSession]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex:1, backgroundColor:T.bg }}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero Header */}
        <LinearGradient
          colors={['#1E1B4B','#3730A3','#4F46E5']}
          start={{x:0,y:0}} end={{x:1,y:1}}
          style={{ paddingTop:Platform.OS==='ios'?55:45, paddingBottom:26, paddingHorizontal:20, overflow:'hidden' }}
        >
          <View style={{ position:'absolute', top:-30, right:-30, width:150, height:150, borderRadius:75, borderWidth:1, borderColor:'rgba(255,255,255,0.06)' }} />
          <View style={{ position:'absolute', top:20, right:30, width:80, height:80, borderRadius:40, borderWidth:1, borderColor:'rgba(255,255,255,0.06)' }} />
          <View style={{ position:'absolute', bottom:-20, left:-10, width:100, height:100, borderRadius:50, backgroundColor:'rgba(255,255,255,0.04)' }} />

          {(onBack || navigation) && (
            <TouchableOpacity
              onPress={() => onBack ? onBack() : navigation?.goBack()}
              style={{
                flexDirection:'row', alignItems:'center', gap:6,
                alignSelf:'flex-start', marginBottom:16,
                backgroundColor:'rgba(255,255,255,0.12)',
                borderRadius:T.radius.pill, paddingHorizontal:14, paddingVertical:7,
              }}
            >
              <Ionicons name="arrow-back" size={16} color="#fff" />
              <Text style={{ fontSize:13, fontWeight:'700', color:'#fff' }}>Back</Text>
            </TouchableOpacity>
          )}

          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' }}>
            <View style={{ flex:1 }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginBottom:6 }}>
                <Text style={{ fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:'700', letterSpacing:1.5, textTransform:'uppercase' }}>
                  Face Attendance
                </Text>
                {/* ✅ Fast mode badge in header */}
                <View style={{ backgroundColor:'#22C55E', borderRadius:T.radius.pill, paddingHorizontal:8, paddingVertical:2 }}>
                  <Text style={{ fontSize:9, fontWeight:'800', color:'#fff', letterSpacing:0.5 }}>⚡ FAST</Text>
                </View>
              </View>
              <Text style={{ fontSize:28, fontWeight:'900', color:'#fff', letterSpacing:-0.5 }}>
                {step === 1 ? 'Mark Attendance' : 'Live Scanning'}
              </Text>
              <Text style={{ fontSize:13, color:'rgba(255,255,255,0.7)', marginTop:5, fontWeight:'500' }}>
                {step === 1 ? 'Select class & period' : `${selectedClass?.name} · P${selectedPeriod}`}
              </Text>
            </View>
            <View style={{ alignItems:'center', gap:4 }}>
              <View style={{ width:56, height:56, borderRadius:18, backgroundColor:'rgba(255,255,255,0.15)', alignItems:'center', justifyContent:'center' }}>
                <MaterialCommunityIcons name="face-recognition" size={26} color="#fff" />
              </View>
              {/* ✅ Show scan count in header during step 2 */}
              {step === 2 && scanCount > 0 && (
                <View style={{ backgroundColor:'rgba(255,255,255,0.2)', borderRadius:T.radius.pill, paddingHorizontal:6, paddingVertical:2 }}>
                  <Text style={{ fontSize:9, fontWeight:'800', color:'#fff' }}>{scanCount} scans</Text>
                </View>
              )}
            </View>
          </View>

          <View style={{ flexDirection:'row', gap:10, marginTop:18 }}>
            {headerStats.map((s, i) => (
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

        <View style={{ paddingHorizontal:16, paddingBottom:36, paddingTop:20 }}>

          {/* Step Indicator */}
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', marginBottom:24, gap:12 }}>
            {[1,2].map(s => (
              <View key={s} style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                <View style={{
                  width:28, height:28, borderRadius:14,
                  backgroundColor: step >= s ? T.indigo : '#E2E8F0',
                  alignItems:'center', justifyContent:'center',
                }}>
                  {step > s
                    ? <Ionicons name="checkmark" size={16} color="#fff" />
                    : <Text style={{ fontSize:12, fontWeight:'800', color: step>=s ? '#fff' : '#94A3B8' }}>{s}</Text>
                  }
                </View>
                <Text style={{ fontSize:12, fontWeight:'600', color: step>=s ? T.indigo : '#94A3B8' }}>
                  {s===1 ? 'Select' : 'Scan'}
                </Text>
              </View>
            ))}
          </View>

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <>
              {classes.length === 0 && loading ? (
                <SkeletonBox width="100%" height={80} radius={T.radius.lg} style={{ marginBottom:16 }} />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:20 }}>
                  <View style={{ flexDirection:'row' }}>
                    {classes.map(cls => (
                      <ClassCard
                        key={cls.id}
                        cls={cls}
                        isSelected={selectedClass?.id === cls.id}
                        onPress={() => {
                          setSelectedClass(cls);
                          setSelectedPeriod(null);
                        }}
                        count={assignments.filter(a =>
                          a.subcategory_id === cls.subcategory_id &&
                          a.item_id === cls.item_id &&
                          a.day === today
                        ).length}
                      />
                    ))}
                  </View>
                </ScrollView>
              )}

              {selectedClass && (
                <>
                  <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <Text style={{ fontSize:13, fontWeight:'700', color:T.textSec, letterSpacing:0.5, textTransform:'uppercase' }}>
                      {today} · Periods
                    </Text>
                    <Text style={{ fontSize:12, color:T.textMut }}>{todayPeriods.length} scheduled</Text>
                  </View>
                  {todayPeriods.length === 0 ? (
                    <View style={{ backgroundColor:T.amberLt, borderRadius:T.radius.xl, padding:20, alignItems:'center', borderWidth:1, borderColor:T.amber }}>
                      <Ionicons name="alert-circle-outline" size={28} color={T.amber} />
                      <Text style={{ fontSize:14, fontWeight:'600', color:T.amber, marginTop:8 }}>No periods today</Text>
                    </View>
                  ) : (
                    todayPeriods.map(item => (
                      <PeriodSelectCard
                        key={item.period_number}
                        period={item.period_number}
                        isSaved={savedPeriods.map(String).includes(String(item.period_number))}
                        isSelected={selectedPeriod === item.period_number}
                        onPress={() => {
                          if (!savedPeriods.map(String).includes(String(item.period_number))) {
                            setSelectedPeriod(item.period_number);
                          } else {
                            showToast(`Period ${item.period_number} already saved`, 'info');
                          }
                        }}
                        subjectName={item.subject_name}
                        startTime={item.start_time}
                        endTime={item.end_time}
                      />
                    ))
                  )}
                </>
              )}

              {selectedClass && selectedPeriod && (
                <TouchableOpacity
                  style={{
                    backgroundColor:T.indigo, borderRadius:T.radius.xl, paddingVertical:16,
                    flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8,
                    marginTop:20, ...T.shadow.md,
                  }}
                  onPress={proceedToScan}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Ionicons name="flash" size={20} color="#fff" />
                      <Text style={{ fontSize:16, fontWeight:'700', color:'#fff' }}>Start Fast Scan</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <>
              {/* ✅ Fast mode banner instead of anti-proxy banner */}
              <FastModeBanner />

              {/* ✅ Live scan progress bar */}
              {isScanning && (
                <View style={{
                  backgroundColor: T.surface, borderRadius: T.radius.lg, padding: 12,
                  marginBottom: 14, borderWidth: 1, borderColor: T.border, ...T.shadow.sm,
                }}>
                  <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:6 }}>
                    <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                      <View style={{ width:8, height:8, borderRadius:4, backgroundColor:T.green }} />
                      <Text style={{ fontSize:12, fontWeight:'700', color:T.green }}>Scanning live…</Text>
                    </View>
                    <Text style={{ fontSize:12, fontWeight:'700', color:T.textSec }}>{scanCount} frames</Text>
                  </View>
                  <View style={{ flexDirection:'row', gap:8 }}>
                    <View style={{ flex:1, backgroundColor:T.greenLt, borderRadius:T.radius.sm, padding:8, alignItems:'center' }}>
                      <Text style={{ fontSize:16, fontWeight:'900', color:T.green }}>{presentCount}</Text>
                      <Text style={{ fontSize:10, color:T.green, fontWeight:'600' }}>Marked</Text>
                    </View>
                    <View style={{ flex:1, backgroundColor:T.slateLt, borderRadius:T.radius.sm, padding:8, alignItems:'center' }}>
                      <Text style={{ fontSize:16, fontWeight:'900', color:T.textPri }}>{totalStudents - presentCount}</Text>
                      <Text style={{ fontSize:10, color:T.textSec, fontWeight:'600' }}>Remaining</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Camera Button */}
              <View style={{ marginBottom:20 }}>
                <TouchableOpacity
                  style={{
                    backgroundColor: cameraVisible ? T.slate : T.indigo,
                    borderRadius:T.radius.xl, paddingVertical:14,
                    flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8,
                    ...T.shadow.md,
                    opacity: cameraVisible ? 0.7 : 1,
                  }}
                  onPress={openCamera}
                  disabled={cameraVisible}
                >
                  <Feather name="camera" size={20} color="#fff" />
                  <Text style={{ fontSize:15, fontWeight:'700', color:'#fff' }}>
                    {cameraVisible ? `Scanning… ${presentCount}/${totalStudents} marked` : 'Open Camera to Scan'}
                  </Text>
                </TouchableOpacity>

                {cameraVisible && (
                  <View style={{ flexDirection:'row', justifyContent:'center', alignItems:'center', marginTop:8, gap:6 }}>
                    <Ionicons
                      name={cameraFacing === 'front' ? 'person-outline' : 'camera-outline'}
                      size={14}
                      color={T.textSec}
                    />
                    <Text style={{ fontSize:11, color:T.textSec, fontWeight:'600' }}>
                      {cameraFacing === 'front' ? 'Front camera active' : 'Back camera active'}
                    </Text>
                  </View>
                )}

                {cameraVisible && isScanning && (
                  <TouchableOpacity
                    onPress={stopScan}
                    style={{ marginTop:10, alignSelf:'center', backgroundColor:'#EF4444', paddingHorizontal:16, paddingVertical:6, borderRadius:T.radius.pill }}
                  >
                    <Text style={{ color:'#fff', fontWeight:'700', fontSize:12 }}>Stop Scanning</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Recent detections */}
              {recentHistory.length > 0 && (
                <View style={{ backgroundColor:T.surface, borderRadius:T.radius.xl, padding:14, marginBottom:16, ...T.shadow.sm }}>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginBottom:10 }}>
                    <Ionicons name="flash" size={14} color={T.green} />
                    <Text style={{ fontSize:13, fontWeight:'700', color:T.textSec }}>
                      Auto-detected this session
                    </Text>
                  </View>
                  {recentHistory.map((h, i) => (
                    <View key={i} style={{
                      flexDirection:'row', justifyContent:'space-between', marginBottom:8,
                      paddingBottom: i < recentHistory.length - 1 ? 8 : 0,
                      borderBottomWidth: i < recentHistory.length - 1 ? 1 : 0,
                      borderBottomColor: T.border,
                    }}>
                      <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                        <MaterialCommunityIcons name="face-recognition" size={13} color={T.indigo} />
                        <Text style={{ fontSize:13, fontWeight:'600', color:T.indigo }}>{h.name}</Text>
                      </View>
                      <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                        {h.confidence && (
                          <View style={{ backgroundColor:T.greenLt, paddingHorizontal:6, paddingVertical:2, borderRadius:T.radius.pill }}>
                            <Text style={{ fontSize:9, fontWeight:'700', color:T.green }}>{h.confidence}%</Text>
                          </View>
                        )}
                        <Text style={{ fontSize:11, color:T.textMut }}>P{h.period} · {h.time}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Attendance summary */}
              {presentCount > 0 && (
                <View style={{
                  backgroundColor:T.surface, borderRadius:T.radius.lg, padding:12,
                  flexDirection:'row', gap:12, marginBottom:16, borderWidth:1, borderColor:T.border,
                }}>
                  <View style={{ flex:1, alignItems:'center' }}>
                    <Ionicons name="flash" size={18} color={T.green} />
                    <Text style={{ fontSize:16, fontWeight:'900', color:T.green, marginTop:4 }}>{faceDetectedCount}</Text>
                    <Text style={{ fontSize:10, color:T.textSec, fontWeight:'600' }}>Auto Face</Text>
                  </View>
                  <View style={{ width:1, backgroundColor:T.border }} />
                  <View style={{ flex:1, alignItems:'center' }}>
                    <Ionicons name="hand-left-outline" size={18} color={T.amber} />
                    <Text style={{ fontSize:16, fontWeight:'900', color:T.amber, marginTop:4 }}>{presentCount - faceDetectedCount}</Text>
                    <Text style={{ fontSize:10, color:T.textSec, fontWeight:'600' }}>Manual</Text>
                  </View>
                  <View style={{ width:1, backgroundColor:T.border }} />
                  <View style={{ flex:1, alignItems:'center' }}>
                    <Ionicons name="people-outline" size={18} color={T.textSec} />
                    <Text style={{ fontSize:16, fontWeight:'900', color:T.textPri, marginTop:4 }}>{totalStudents - presentCount}</Text>
                    <Text style={{ fontSize:10, color:T.textSec, fontWeight:'600' }}>Absent</Text>
                  </View>
                </View>
              )}

              {/* Manual marking */}
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <Text style={{ fontSize:13, fontWeight:'700', color:T.textSec }}>Manual Marking</Text>
                <View style={{ flexDirection:'row', gap:8 }}>
                  <TouchableOpacity
                    onPress={() => markAll(true)}
                    style={{ backgroundColor:T.greenLt, paddingHorizontal:12, paddingVertical:6, borderRadius:T.radius.pill }}
                  >
                    <Text style={{ fontSize:12, fontWeight:'700', color:T.green }}>All Present</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => markAll(false)}
                    style={{ backgroundColor:'#FFF5F5', paddingHorizontal:12, paddingVertical:6, borderRadius:T.radius.pill }}
                  >
                    <Text style={{ fontSize:12, fontWeight:'700', color:'#EF4444' }}>All Absent</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {students.map((student, idx) => (
                <StudentAttendanceCard
                  key={student.id}
                  student={student}
                  index={idx}
                  onToggle={toggleStudent}
                  hasFace={faceMap[student.id] ?? false}
                />
              ))}

              {students.length > 0 && (
                <TouchableOpacity
                  style={{
                    backgroundColor:T.green, borderRadius:T.radius.xl, paddingVertical:16,
                    flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8,
                    marginTop:20, ...T.shadow.md,
                  }}
                  onPress={saveAttendance}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Feather name="save" size={18} color="#fff" />
                      <Text style={{ fontSize:16, fontWeight:'700', color:'#fff' }}>
                        Save P{selectedPeriod} · {presentCount}/{totalStudents} present
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={goBackToStep1} style={{ alignSelf:'center', marginTop:20 }}>
                <Text style={{ fontSize:13, fontWeight:'600', color:T.indigo }}>← Change class / period</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      {/* Toast */}
      {toast.visible && (
        <View style={{
          position:'absolute', bottom:40, left:20, right:20,
          backgroundColor: toastColor(toast.type),
          borderRadius:T.radius.lg, padding:14, alignItems:'center', ...T.shadow.lg,
        }}>
          <Text style={{ color:'#fff', fontWeight:'700', fontSize:13 }}>{toast.message}</Text>
        </View>
      )}

      {/* Camera Modal */}
      <FaceAttendanceCameraModal
        visible={cameraVisible}
        onClose={closeCamera}
        cameraRef={cameraRef}
        facing={cameraFacing}
        onFlip={() => setCameraFacing(f => f === 'front' ? 'back' : 'front')}
        isScanning={isScanning}
        processingFrame={processingFrame}
        detectedName={detectedName}
        onStartScan={startScan}
        onStopScan={stopScan}
        students={students}
      />
    </SafeAreaView>
  );
};

export default TeacherFaceAttendanceScreen;