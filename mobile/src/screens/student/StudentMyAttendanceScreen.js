import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, SafeAreaView,
  ScrollView, RefreshControl, Animated, Easing, Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { C, DEFAULT_PERIOD_TIMINGS } from '../../config/constants';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { todayStr, monthStr } from '../../utils/helpers';
import styles from '../../styles/globalStyles';
import EmptyState from '../../components/EmptyState';

// ─── Skeleton loader ──────────────────────────────────────────────────────────
const SkeletonBox = ({ width = '100%', height = 20, style = {} }) => {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1,   duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(anim, { toValue: 0.4, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[{ width, height, borderRadius: 8, backgroundColor: C.border || '#E5E7EB', opacity: anim }, style]} />
  );
};

const TodaySkeleton = () => (
  <View>
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
      {[1, 2, 3].map(i => (
        <View key={i} style={{ flex: 1, backgroundColor: C.lightGray || '#F3F4F6', borderRadius: 12, padding: 14, alignItems: 'center', gap: 6 }}>
          <SkeletonBox width={40} height={24} />
          <SkeletonBox width={50} height={12} />
        </View>
      ))}
    </View>
    {[1, 2, 3].map(i => (
      <View key={i} style={{ backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderLeftWidth: 4, borderLeftColor: C.border || '#E5E7EB' }}>
        <SkeletonBox width={52} height={52} style={{ borderRadius: 10 }} />
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonBox width="70%" height={16} />
          <SkeletonBox width="50%" height={12} />
        </View>
        <SkeletonBox width={80} height={32} style={{ borderRadius: 20 }} />
      </View>
    ))}
  </View>
);

// ─── Animated stat card ───────────────────────────────────────────────────────
const AnimatedStatCard = ({ value, label, color, bg, delay = 0 }) => {
  const scale   = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay, useNativeDriver: true }),
      Animated.spring(scale,   { toValue: 1, delay, useNativeDriver: true, tension: 120, friction: 8 }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[styles.attendanceStat, { backgroundColor: bg, transform: [{ scale }], opacity }]}>
      <Text style={[styles.attendanceStatValue, { color }]}>{value}</Text>
      <Text style={[styles.attendanceStatLabel, { color }]}>{label}</Text>
    </Animated.View>
  );
};

// ─── Period card ──────────────────────────────────────────────────────────────
const PeriodCard = ({ rec, index }) => {
  const translateY = useRef(new Animated.Value(24)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const isPresent  = rec.status === 'present';
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 300, delay: index * 80, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, delay: index * 80, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <View style={[
        styles.periodAttendCard,
        { borderLeftWidth: 4, borderLeftColor: isPresent ? C.success : C.error, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
      ]}>
        <View style={[
          styles.periodBadge,
          { backgroundColor: isPresent ? C.successLight : C.errorLight, minWidth: 52, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 12, alignItems: 'center', gap: 2 },
        ]}>
          <Ionicons name="time-outline" size={13} color={isPresent ? C.success : C.error} />
          <Text style={{ fontSize: 16, fontWeight: '800', color: isPresent ? C.success : C.error }}>{rec.period}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.dark, marginBottom: 4 }} numberOfLines={1}>{rec.subject}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="alarm-outline" size={12} color={C.gray} />
            <Text style={{ fontSize: 12, color: C.gray, fontWeight: '500' }}>{rec.time}</Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: isPresent ? C.success : C.error, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name={isPresent ? 'checkmark' : 'close'} size={12} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{isPresent ? 'Present' : 'Absent'}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

// ─── Animated progress bar ────────────────────────────────────────────────────
const AnimatedProgressBar = ({ pct, color }) => {
  const width = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(width, { toValue: pct, duration: 800, delay: 200, useNativeDriver: false, easing: Easing.out(Easing.cubic) }).start();
  }, [pct]);
  return (
    <View style={[styles.progressBar, { overflow: 'hidden' }]}>
      <Animated.View style={[styles.progressFill, { width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }), backgroundColor: color, borderRadius: 999 }]} />
    </View>
  );
};

// ─── Subject card ─────────────────────────────────────────────────────────────
const SubjectCard = ({ item, index }) => {
  const [expanded, setExpanded] = useState(false);
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  const pct      = item.total_sessions > 0 ? Math.round((item.present_count / item.total_sessions) * 100) : 0;
  const canMiss  = pct >= 75 ? Math.floor((item.present_count - 0.75 * item.total_sessions) / 0.75) : 0;
  const needMore = pct < 75 && item.total_sessions > 0
    ? Math.max(0, Math.ceil((0.75 * item.total_sessions - item.present_count) / 0.25))
    : 0;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,   { toValue: 1, duration: 350, delay: index * 100, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: index * 100, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
    ]).start();
  }, []);

  const pctColor = pct >= 85 ? C.success : pct >= 75 ? C.warning : C.error;

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY }] }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setExpanded(p => !p)}
        style={[styles.premiumCard, { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 }]}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontWeight: '700', fontSize: 16, color: C.dark }}>{item.subject_name}</Text>
            <Text style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{item.present_count} / {item.total_sessions} attended</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: pctColor }}>{pct}%</Text>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={C.gray} />
          </View>
        </View>
        <AnimatedProgressBar pct={pct} color={pctColor} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {[
            { v: item.present_count,                       l: 'Present', bg: C.successLight,           c: C.success },
            { v: item.total_sessions - item.present_count, l: 'Absent',  bg: C.errorLight,             c: C.error   },
            { v: item.total_sessions,                      l: 'Total',   bg: C.lightGray || '#F3F4F6', c: C.dark    },
          ].map(s => (
            <View key={s.l} style={{ flex: 1, backgroundColor: s.bg, borderRadius: 10, padding: 8, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: s.c }}>{s.v}</Text>
              <Text style={{ fontSize: 10, color: s.c, fontWeight: '600' }}>{s.l}</Text>
            </View>
          ))}
        </View>
        {expanded && (
          <View style={{ marginTop: 12, gap: 8 }}>
            {needMore > 0 && (
              <View style={{ backgroundColor: C.warningLight, borderRadius: 10, padding: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="warning" size={14} color={C.warning} />
                  <Text style={{ fontSize: 12, color: C.warning, fontWeight: '600', flex: 1 }}>
                    Attend {needMore} more class{needMore > 1 ? 'es' : ''} to reach 75%
                  </Text>
                </View>
              </View>
            )}
            {pct >= 75 && canMiss > 0 && (
              <View style={{ backgroundColor: C.successLight, borderRadius: 10, padding: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="checkmark-circle" size={14} color={C.success} />
                  <Text style={{ fontSize: 12, color: C.success, fontWeight: '600', flex: 1 }}>
                    You can miss {canMiss} more class{canMiss !== 1 ? 'es' : ''} and stay ≥ 75%
                  </Text>
                </View>
              </View>
            )}
            {pct >= 75 && canMiss === 0 && (
              <View style={{ backgroundColor: C.infoLight || '#EFF6FF', borderRadius: 10, padding: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="information-circle" size={14} color={C.info || '#3B82F6'} />
                  <Text style={{ fontSize: 12, color: C.info || '#3B82F6', fontWeight: '600', flex: 1 }}>
                    You're right at 75% — don't miss any more classes!
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ==================== MAIN SCREEN ====================
const StudentMyAttendanceScreen = ({ token: propToken, user: propUser, onBack, navigation }) => {
  const { token: ctxToken, user: ctxUser } = useAuth();
  const token = propToken || ctxToken;
  const user  = propUser  || ctxUser;

  const [viewMode, setViewMode]             = useState('today');
  const [todayRecords, setTodayRecords]     = useState([]);
  const [monthlyData, setMonthlyData]       = useState({});
  const [subjectSummary, setSubjectSummary] = useState([]);
  const [selectedMonth, setSelectedMonth]   = useState(monthStr());
  const [loading, setLoading]               = useState(true);
  const [tabLoading, setTabLoading]         = useState(false);
  const [refreshing, setRefreshing]         = useState(false);
  const [studentInfo, setStudentInfo]       = useState(null);

  const timetableRef = useRef([]);

  // ── Computed values for header stats ──────────────────────────────────────
  const totalClasses = subjectSummary.reduce((s, a) => s + (a.total_sessions || 0), 0);
  const totalPresent = subjectSummary.reduce((s, a) => s + (a.present_count  || 0), 0);
  const overallPct   = totalClasses > 0 ? Math.round((totalPresent / totalClasses) * 100) : 0;

  // ── Back handler ──────────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (typeof onBack === 'function') {
      onBack();
      return;
    }
    if (navigation) {
      try {
        if (typeof navigation.canGoBack === 'function' && navigation.canGoBack()) {
          navigation.goBack();
        } else if (typeof navigation.navigate === 'function') {
          navigation.navigate('StudentDashboard');
        } else {
          navigation.goBack();
        }
      } catch (e) {
        console.warn('AttendanceScreen back error:', e);
      }
    }
  }, [onBack, navigation]);

  const getTodayCode = () => {
    const dayIndex = new Date().getDay();
    return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][dayIndex];
  };

  const normaliseDayCode = (raw) => {
    if (!raw) return '';
    const s = raw.trim().toUpperCase();
    const FULL = { SUNDAY: 'SUN', MONDAY: 'MON', TUESDAY: 'TUE', WEDNESDAY: 'WED', THURSDAY: 'THU', FRIDAY: 'FRI', SATURDAY: 'SAT' };
    if (FULL[s]) return FULL[s];
    if (s.length >= 3) return s.slice(0, 3);
    return s;
  };

  const TODAY_CODE = getTodayCode();

  const switchTab = (key) => setViewMode(key);

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    const reloadMonth = async () => {
      setTabLoading(true);
      try {
        const info = studentInfo || await loadStudentInfo();
        await loadMonthlyData(info);
      } finally {
        setTabLoading(false);
      }
    };
    reloadMonth();
  }, [selectedMonth]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const info = await loadStudentInfo();
      await loadTimetable(info);
      await Promise.all([loadTodayRecords(info), loadMonthlyData(info), loadSubjectSummary()]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadStudentInfo = async () => {
    try {
      const data = await api.get(`/students?search=${encodeURIComponent(user?.email || '')}`, token);
      const list = Array.isArray(data) ? data : (data?.students ?? data?.data ?? []);
      const me   = list.find(s => (s.student_email || '').toLowerCase() === (user?.email || '').toLowerCase()) ?? null;
      setStudentInfo(me);
      return me;
    } catch (e) {
      console.log('[Attendance] loadStudentInfo error:', e.message);
      return null;
    }
  };

  const loadTimetable = async (info) => {
    try {
      const student = info || studentInfo;
      if (!student?.subcategory_id) return;
      let url = `/timetable-assignments?subcategory_id=${student.subcategory_id}`;
      if (student.item_id) url += `&item_id=${student.item_id}`;
      const res  = await api.get(url, token);
      const list = Array.isArray(res) ? res : (res?.assignments ?? res?.data ?? []);
      timetableRef.current = list.map(item => ({
        id:            item.id,
        period_number: item.period_number != null ? String(item.period_number) : null,
        period_id:     item.period_id ?? null,
        day:           normaliseDayCode(item.day || ''),
        subject_name:  item.subject_name || '',
        start_time:    item.start_time   ?? null,
        end_time:      item.end_time     ?? null,
      }));
      console.log('[Attendance] Timetable loaded:', timetableRef.current.length, 'entries');
      console.log('[Attendance] Today timetable:', timetableRef.current.filter(e => e.day === TODAY_CODE));
    } catch (e) {
      console.log('[Attendance] loadTimetable error:', e.message);
    }
  };

  const fmt12 = (raw) => {
    if (!raw) return '';
    if (/[APap][Mm]/.test(raw)) return raw.trim();
    const m = raw.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return raw;
    let h = parseInt(m[1], 10);
    const min  = m[2];
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${min} ${ampm}`;
  };

  // ── FIXED: findTTEntryForSession
  // Uses the session's own period_number/period_id to find the EXACT timetable entry for today.
  // No longer falls back to allEntries (which caused duplicates mapping to same timetable row).
  // ─────────────────────────────────────────────────────────────────────────
  const findTTEntryForSession = (sess) => {
    // Only look at today's timetable entries
    const todayEntries = timetableRef.current.filter(e => e.day === TODAY_CODE);

    // 1. Match by period_number (most reliable)
    if (sess.period_number != null && String(sess.period_number).trim() !== '') {
      const hit = todayEntries.find(e =>
        e.period_number != null &&
        String(e.period_number).trim() === String(sess.period_number).trim()
      );
      if (hit) return hit;
    }

    // 2. Match by period_id
    if (sess.period_id != null) {
      const hit = todayEntries.find(e =>
        (e.period_id != null && String(e.period_id) === String(sess.period_id)) ||
        String(e.id) === String(sess.period_id)
      );
      if (hit) return hit;
    }

    // 3. Match by session id against timetable id
    if (sess.id != null) {
      const hit = todayEntries.find(e => String(e.id) === String(sess.id));
      if (hit) return hit;
    }

    // 4. Match by subject name only within today's entries (NOT all entries)
    const sName = (sess.subject_name || sess.subject || '').trim().toLowerCase();
    if (sName) {
      let hit = todayEntries.find(e => (e.subject_name || '').trim().toLowerCase() === sName);
      if (hit) return hit;
    }

    // 5. No match found — do NOT fall back to all entries to avoid cross-day duplicates
    return null;
  };

  const resolvePeriodNum = (sess, ttEntry) => {
    // Priority: session's own period_number → timetable entry's period_number → session period_id
    if (sess.period_number != null && String(sess.period_number).trim() !== '') {
      return String(sess.period_number).trim();
    }
    if (ttEntry?.period_number != null && String(ttEntry.period_number).trim() !== '') {
      return String(ttEntry.period_number).trim();
    }
    if (sess.period_id != null) {
      return String(sess.period_id);
    }
    return '?';
  };

  const resolveTime = (sess, ttEntry) => {
    // Priority: session times → timetable entry times → DEFAULT_PERIOD_TIMINGS
    if (sess.start_time && sess.end_time) return `${fmt12(sess.start_time)} – ${fmt12(sess.end_time)}`;
    if (sess.start_time) return fmt12(sess.start_time);
    if (ttEntry?.start_time && ttEntry?.end_time) return `${fmt12(ttEntry.start_time)} – ${fmt12(ttEntry.end_time)}`;
    if (ttEntry?.start_time) return fmt12(ttEntry.start_time);
    const slot = Number(resolvePeriodNum(sess, ttEntry));
    if (slot && DEFAULT_PERIOD_TIMINGS?.[slot]) {
      const t = DEFAULT_PERIOD_TIMINGS[slot];
      return `${t.start} – ${t.end}`;
    }
    const periodLabel = resolvePeriodNum(sess, ttEntry);
    return periodLabel !== '?' ? `Period ${periodLabel}` : 'Schedule unavailable';
  };

  const resolveSubject = (sess, ttEntry) => {
    // Priority: timetable entry subject → session subject
    const name = ttEntry?.subject_name?.trim() || sess.subject_name?.trim() || sess.subject?.trim() || '';
    if (name) return name;
    const p = resolvePeriodNum(sess, ttEntry);
    return p !== '?' ? `Period ${p}` : 'Unknown Subject';
  };

  // ── FIXED: loadTodayRecords
  // Key fix: deduplicate records by period_number so the same period never
  // appears twice even if the API returns multiple sessions for it.
  // ─────────────────────────────────────────────────────────────────────────
  const loadTodayRecords = async (info) => {
    try {
      const student = info || studentInfo;
      if (!student) {
        console.log('[Attendance] loadTodayRecords: no student info');
        return;
      }

      const today = todayStr();

      let url = `/attendance/sessions?date=${today}`;
      if (student.subcategory_id) url += `&subcategory_id=${student.subcategory_id}`;
      if (student.item_id)        url += `&item_id=${student.item_id}`;

      const sessData = await api.get(url, token).catch(() => []);
      const sessions = Array.isArray(sessData)
        ? sessData
        : (sessData?.sessions ?? sessData?.data ?? []);

      if (!sessions.length) {
        console.log('[Attendance] No sessions found for today:', today);
        setTodayRecords([]);
        return;
      }

      console.log('[Attendance] Sessions fetched for today:', sessions.length);

      // Map to collect records, keyed by period_number to avoid duplicates
      // If two sessions share the same period_number, keep the first one found.
      const periodMap = new Map(); // key: periodNum string → record object

      for (const sess of sessions) {
        try {
          const ttEntry = findTTEntryForSession(sess);
          const periodNum = resolvePeriodNum(sess, ttEntry);

          // Skip if we already have a record for this period number
          if (periodNum !== '?' && periodMap.has(periodNum)) {
            console.log(`[Attendance] Skipping duplicate session for period ${periodNum} (session ${sess.id})`);
            continue;
          }

          const recRaw = await api.get(
            `/attendance/sessions/${sess.id}/records`,
            token
          ).catch(() => []);

          const rList = Array.isArray(recRaw)
            ? recRaw
            : (recRaw?.records ?? recRaw?.data ?? []);

          // Match student record
          const myRecord = rList.find(r =>
            String(r.student_id) === String(student.id) ||
            (r.student_email && r.student_email.toLowerCase() === (user?.email || '').toLowerCase())
          );

          if (!myRecord) {
            console.log(`[Attendance] No record for student in session ${sess.id}`);
            continue;
          }

          const record = {
            period:    periodNum,
            subject:   resolveSubject(sess, ttEntry),
            status:    myRecord.status,
            time:      resolveTime(sess, ttEntry),
            date:      sess.date || today,
            sessionId: sess.id,
          };

          // Store in map — if period is '?', use session id as key to still include it
          const mapKey = periodNum !== '?' ? periodNum : `sess_${sess.id}`;
          periodMap.set(mapKey, record);

          console.log(`[Attendance] Added period ${periodNum} → ${record.subject} @ ${record.time} [${myRecord.status}]`);
        } catch (e) {
          console.warn('[Attendance] session processing failed:', sess.id, e.message);
        }
      }

      // Convert map values to array and sort by period number ascending
      const periodRecords = Array.from(periodMap.values()).sort((a, b) => {
        const aNum = parseInt(a.period, 10);
        const bNum = parseInt(b.period, 10);
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        return String(a.period).localeCompare(String(b.period));
      });

      console.log(`[Attendance] Today records loaded: ${periodRecords.length}`);
      setTodayRecords(periodRecords);
    } catch (e) {
      console.log('[Attendance] loadTodayRecords error:', e);
      setTodayRecords([]);
    }
  };

  const loadMonthlyData = async (info) => {
    try {
      const student = info || studentInfo;
      if (!student) return;
      const [year, month] = selectedMonth.split('-');
      const startDate = `${selectedMonth}-01`;
      const lastDay   = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate   = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

      let url = `/attendance/sessions?startDate=${startDate}&endDate=${endDate}`;
      if (student.subcategory_id) url += `&subcategory_id=${student.subcategory_id}`;
      if (student.item_id)        url += `&item_id=${student.item_id}`;
      url += `&limit=5000`;

      const sessData = await api.get(url, token).catch(() => []);
      const sessions = Array.isArray(sessData) ? sessData : (sessData?.sessions ?? sessData?.data ?? []);

      const dayMap = {};
      await Promise.all(sessions.map(async (sess) => {
        try {
          const day = (sess.date || '').split('T')[0] || '';
          if (!day || !day.startsWith(selectedMonth)) return;
          const recRaw   = await api.get(`/attendance/sessions/${sess.id}/records`, token).catch(() => []);
          const rList    = Array.isArray(recRaw) ? recRaw : (recRaw?.records ?? recRaw?.data ?? []);
          const myRecord = rList.find(r =>
            String(r.student_id) === String(student.id) ||
            (r.student_email && r.student_email.toLowerCase() === (user?.email || '').toLowerCase())
          );
          if (!myRecord) return;
          if (!dayMap[day]) dayMap[day] = { present: 0, absent: 0, total: 0, periods: [] };
          dayMap[day].total += 1;
          if (myRecord.status === 'present') dayMap[day].present += 1;
          else dayMap[day].absent += 1;
          dayMap[day].periods.push({ period: sess.period_number, status: myRecord.status });
        } catch {}
      }));
      setMonthlyData(dayMap);
    } catch (e) {
      console.log('[Attendance] loadMonthlyData error:', e);
    }
  };

  const loadSubjectSummary = async () => {
    try {
      const email = encodeURIComponent(user?.email || '');
      const data  = await api.get(`/students/by-email/${email}/attendance-summary`, token);
      const raw   = Array.isArray(data) ? data : (data?.summary ?? data?.data ?? []);
      setSubjectSummary(
        raw.filter(item => {
          const name = (item.subject_name || '').trim().toLowerCase();
          return name && !['general', '—', '-', 'unknown'].includes(name);
        })
      );
    } catch (e) {
      console.log('[Attendance] loadSubjectSummary error:', e);
    }
  };

  const todayPresent = todayRecords.filter(r => r.status === 'present').length;
  const todayAbsent  = todayRecords.filter(r => r.status !== 'present').length;

  const monthDays           = Object.values(monthlyData);
  const monthDaysPresent    = monthDays.filter(d => d.present > 0 && d.absent === 0).length;
  const monthDaysAbsent     = monthDays.filter(d => d.absent  > 0 && d.present === 0).length;
  const monthTotalPeriods   = monthDays.reduce((s, d) => s + d.total,   0);
  const monthPresentPeriods = monthDays.reduce((s, d) => s + d.present, 0);
  const monthPct = monthTotalPeriods > 0 ? Math.round((monthPresentPeriods / monthTotalPeriods) * 100) : 0;

  // ─── Calendar ─────────────────────────────────────────────────────────────
  const renderMonthCalendar = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const firstDay    = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const cells = [];

    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((d, i) => {
      cells.push(
        <View key={`hdr-${i}`} style={[styles.calendarDay, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: C.gray }}>{d}</Text>
        </View>
      );
    });
    for (let i = 0; i < firstDay; i++) {
      cells.push(<View key={`blank-${i}`} style={styles.calendarDay} />);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dayKey   = `${selectedMonth}-${String(d).padStart(2, '0')}`;
      const rec      = monthlyData[dayKey];
      const isToday  = dayKey === todayStr();
      const isFuture = new Date(dayKey) > new Date();
      let bg = 'transparent', textColor = C.dark;
      if (!isFuture && rec) {
        if      (rec.present > 0 && rec.absent === 0) { bg = C.success; textColor = '#fff'; }
        else if (rec.present > 0)                     { bg = C.warning; textColor = '#fff'; }
        else if (rec.total   > 0)                     { bg = C.error;   textColor = '#fff'; }
      }
      if (isToday && !rec) { bg = '#E0F2FE'; textColor = '#0284C7'; }
      cells.push(
        <View key={`d-${d}`} style={[
          styles.calendarDay,
          { backgroundColor: bg, borderWidth: isToday ? 2 : 0, borderColor: '#0284C7', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
        ]}>
          <Text style={[styles.calendarDayText, { color: isFuture ? C.border : textColor }]}>{d}</Text>
          {rec && rec.present > 0 && rec.absent > 0 && (
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: textColor, opacity: 0.7, marginTop: 2 }} />
          )}
        </View>
      );
    }
    return <View style={styles.calendarGrid}>{cells}</View>;
  };

  const changeMonth = (dir) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nd = new Date(y, m - 1 + dir, 1);
    setSelectedMonth(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}`);
  };

  const monthName = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const TAB_ITEMS = [
    {
      key:   'today',
      label: 'Today',
      icon:  (active) => <Ionicons name={active ? 'today' : 'today-outline'} size={15} color={active ? '#0284C7' : C.gray} />,
    },
    {
      key:   'monthly',
      label: 'Monthly',
      icon:  (active) => <Ionicons name={active ? 'calendar' : 'calendar-outline'} size={15} color={active ? '#0284C7' : C.gray} />,
    },
    {
      key:   'subject',
      label: 'Subject',
      icon:  (active) => <MaterialCommunityIcons name="book-open-variant" size={15} color={active ? '#0284C7' : C.gray} />,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadAll(); }}
            tintColor="#0EA5E9"
            colors={['#0EA5E9']}
          />
        }
      >
        {/* ══════════════════════════════════════════════════════════════
            HEADER — Sky blue matching StudentDashboard / StudentTimetable
        ═══════════════════════════════════════════════════════════════ */}
        <View style={{
          backgroundColor: '#0EA5E9',
          paddingTop: Platform.OS === 'ios' ? 10 : 18,
          paddingBottom: 22,
          paddingHorizontal: 20,
          overflow: 'hidden',
          shadowColor: '#0369A1',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.22,
          shadowRadius: 14,
          elevation: 8,
        }}>
          {/* Decorative circles — matching StudentTimetable hero */}
          <View style={{ position: 'absolute', right: -24, top: -24, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)' }} />
          <View style={{ position: 'absolute', bottom: -16, right: 50, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.05)' }} />
          <View style={{ position: 'absolute', left: -20, bottom: -20, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.04)' }} />

          {/* Top row: back + title + refresh */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            {/* Back Button */}
            <TouchableOpacity
              onPress={handleBack}
              style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.2)',
                alignItems: 'center', justifyContent: 'center',
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>

            {/* Title */}
            <View style={{ flex: 1, alignItems: 'center', marginHorizontal: 10 }}>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 }}>
                Student Portal
              </Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.3 }}>
                My Attendance
              </Text>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                {user?.name || user?.full_name || 'Student'}
              </Text>
            </View>

            {/* Refresh Button */}
            <TouchableOpacity
              onPress={() => { setRefreshing(true); loadAll(); }}
              disabled={refreshing || loading}
              style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.2)',
                alignItems: 'center', justifyContent: 'center',
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={18} color="#fff" style={{ opacity: (refreshing || loading) ? 0.5 : 1 }} />
            </TouchableOpacity>
          </View>

          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { value: `${overallPct}%`, label: 'Overall' },
              { value: totalPresent,      label: 'Present'  },
              { value: totalClasses - totalPresent, label: 'Absent' },
            ].map(s => (
              <View
                key={s.label}
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  borderRadius: 12,
                  paddingVertical: 10,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.2)',
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>{s.value}</Text>
                <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontWeight: '600' }}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingBottom: 30 }}>

          {/* ── TAB TOGGLE ── */}
          <View style={[styles.tabToggle, { marginTop: 14 }]}>
            {TAB_ITEMS.map((tab) => {
              const isActive = viewMode === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.tabToggleBtn,
                    isActive && [styles.tabToggleBtnActive, { backgroundColor: '#E0F2FE', borderColor: '#0284C7', borderWidth: 1 }],
                  ]}
                  onPress={() => switchTab(tab.key)}
                  activeOpacity={0.75}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    {tab.icon(isActive)}
                    <Text style={[
                      styles.tabToggleText,
                      isActive && [styles.tabToggleTextActive, { color: '#0284C7' }],
                    ]}>
                      {tab.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── CONTENT AREA ── */}
          {loading ? (
            <TodaySkeleton />
          ) : (
            <>
              {/* ══════════ TODAY TAB ══════════ */}
              {viewMode === 'today' && (
                <View>
                  <Text style={[styles.sectionTitle, { marginBottom: 12, marginTop: 16 }]}>
                    Today —{' '}
                    {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                    {[
                      { v: todayPresent,       l: 'Present', bg: C.successLight, c: C.success,  delay: 0   },
                      { v: todayAbsent,         l: 'Absent',  bg: C.errorLight,   c: C.error,    delay: 60  },
                      { v: todayRecords.length, l: 'Periods', bg: '#E0F2FE',      c: '#0284C7',  delay: 120 },
                    ].map(s => (
                      <AnimatedStatCard key={s.l} value={s.v} label={s.l} color={s.c} bg={s.bg} delay={s.delay} />
                    ))}
                  </View>
                  {todayRecords.length === 0 ? (
                    <EmptyState
                      icon={<Ionicons name="calendar-outline" size={48} color={C.gray} />}
                      title="No Data Today"
                      message="No attendance records found for today. Check back after class."
                    />
                  ) : (
                    todayRecords.map((rec, i) => (
                      <PeriodCard key={`${rec.period}-${rec.sessionId || i}`} rec={rec} index={i} />
                    ))
                  )}
                </View>
              )}

              {/* ══════════ MONTHLY TAB ══════════ */}
              {viewMode === 'monthly' && (
                <View style={{ marginTop: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <TouchableOpacity
                      onPress={() => changeMonth(-1)}
                      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Ionicons name="chevron-back" size={20} color="#0284C7" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: C.dark }}>{monthName()}</Text>
                    <TouchableOpacity
                      onPress={() => changeMonth(1)}
                      disabled={selectedMonth >= monthStr()}
                      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: selectedMonth >= monthStr() ? (C.lightGray || '#F3F4F6') : C.white, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Ionicons name="chevron-forward" size={20} color={selectedMonth >= monthStr() ? C.gray : '#0284C7'} />
                    </TouchableOpacity>
                  </View>

                  {tabLoading ? (
                    <TodaySkeleton />
                  ) : (
                    <>
                      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                        {[
                          { v: monthDaysPresent, l: 'Days Present', bg: C.successLight, c: C.success,  delay: 0   },
                          { v: monthDaysAbsent,  l: 'Days Absent',  bg: C.errorLight,   c: C.error,    delay: 60  },
                          { v: `${monthPct}%`,   l: 'Month %',      bg: '#E0F2FE',      c: '#0284C7',  delay: 120 },
                        ].map(s => (
                          <AnimatedStatCard key={s.l} value={s.v} label={s.l} color={s.c} bg={s.bg} delay={s.delay} />
                        ))}
                      </View>

                      <View style={[styles.progressCard, { marginBottom: 16 }]}>
                        <View style={styles.progressHeader}>
                          <Text style={styles.progressLabel}>{monthName()} Attendance</Text>
                          <Text style={[styles.progressPercentage, { color: monthPct >= 75 ? C.success : C.error }]}>{monthPct}%</Text>
                        </View>
                        <AnimatedProgressBar pct={monthPct} color={monthPct >= 75 ? C.success : C.error} />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                          {monthPct >= 85
                            ? <Ionicons name="trophy" size={14} color="#F59E0B" />
                            : monthPct >= 75
                              ? <Ionicons name="warning" size={14} color={C.warning} />
                              : <Ionicons name="alert-circle" size={14} color={C.error} />}
                          <Text style={styles.progressMessage}>
                            {monthPct >= 85 ? 'Excellent this month!' : monthPct >= 75 ? "Keep it up — you're on track!" : 'Attendance needs improvement'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.premiumCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                          <Ionicons name="calendar" size={16} color="#0284C7" />
                          <Text style={{ fontSize: 15, fontWeight: '700', color: C.dark }}>Calendar View</Text>
                        </View>
                        {renderMonthCalendar()}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16, justifyContent: 'center' }}>
                          {[
                            { color: C.success, label: 'All Present' },
                            { color: C.warning, label: 'Partial'     },
                            { color: C.error,   label: 'Absent'      },
                            { color: '#E0F2FE', label: 'Today', border: true },
                          ].map(l => (
                            <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                              <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: l.color, borderWidth: l.border ? 1.5 : 0, borderColor: '#0284C7' }} />
                              <Text style={{ fontSize: 11, color: C.gray, fontWeight: '500' }}>{l.label}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    </>
                  )}
                </View>
              )}

              {/* ══════════ SUBJECT TAB ══════════ */}
              {viewMode === 'subject' && (
                <View style={{ gap: 0, marginTop: 16 }}>
                  {subjectSummary.length === 0 ? (
                    <EmptyState
                      icon={<MaterialCommunityIcons name="book-open-variant" size={48} color={C.gray} />}
                      title="No Subject Data"
                      message="No subject-wise attendance records found"
                    />
                  ) : (
                    subjectSummary.map((item, i) => (
                      <SubjectCard key={`${item.subject_name}-${i}`} item={item} index={i} />
                    ))
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default StudentMyAttendanceScreen;