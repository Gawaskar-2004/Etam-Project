import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Animated, Easing,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { C } from '../../constants/colors';
import { scheduleDailyTimetableReminder } from '../../services/notificationService';

const DAYS_DISPLAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_CODE    = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// ─── Design tokens — sky blue palette matching StudentDashboard PremiumHeader ─
const T = {
  // Sky blue gradient colours (same as HEADER_CONFIGS.student)
  heroBg:        '#0EA5E9',   // primary sky blue
  heroMid:       '#0284C7',   // mid
  heroDeep:      '#0369A1',   // darkest ring / shadow

  pageBg:        '#F8FAFC',
  primary:       '#0EA5E9',
  primaryBg:     '#F0F9FF',   // sky-50
  primaryBorder: '#BAE6FD',   // sky-200
  nowColor:      '#059669',

  pill: {
    bg:    'rgba(255,255,255,0.15)',
    text:  '#fff',
    label: 'rgba(255,255,255,0.75)',
  },

  tabActive:    '#0284C7',
  tabActiveBg:  '#E0F2FE',   // sky-100
  tabActiveBdr: '#BAE6FD',   // sky-200
  tabToday:     '#0EA5E9',
};

const SUBJECT_COLORS = [
  { bg: '#F0F9FF', border: '#BAE6FD', text: '#0C4A6E', dot: '#0EA5E9' },
  { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', dot: '#3B82F6' },
  { bg: '#ECFDF5', border: '#6EE7B7', text: '#065F46', dot: '#10B981' },
  { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', dot: '#F59E0B' },
  { bg: '#FFF1F2', border: '#FECDD3', text: '#9F1239', dot: '#F43F5E' },
  { bg: '#ECFEFF', border: '#A5F3FC', text: '#0E7490', dot: '#06B6D4' },
  { bg: '#FDF4FF', border: '#E9D5FF', text: '#7E22CE', dot: '#A855F7' },
  { bg: '#FFF7ED', border: '#FED7AA', text: '#C2410C', dot: '#F97316' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt12 = (t) => {
  if (!t) return '';
  const [hStr, mStr] = t.split(':');
  const h    = parseInt(hStr, 10);
  const m    = parseInt(mStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const toMinutes = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const isCurrentPeriod = (entry) => {
  if (!entry?.start_time || !entry?.end_time) return false;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  return nowMin >= toMinutes(entry.start_time) && nowMin < toMinutes(entry.end_time);
};

const minutesUntil = (entry) => {
  if (!entry?.start_time) return null;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  return toMinutes(entry.start_time) - nowMin;
};

// ─── Skeleton shimmer ─────────────────────────────────────────────────────────
const SkeletonBox = ({ width = '100%', height = 20, style = {} }) => {
  const anim = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1,    duration: 750, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(anim, { toValue: 0.35, duration: 750, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[{ width, height, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.25)', opacity: anim }, style]} />
  );
};

const PeriodRowSkeleton = ({ delay = 0 }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 300, delay, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[styles.periodRow, { opacity: anim }]}>
      <View style={styles.periodBadgeWrap}>
        <View style={{ width: 50, height: 50, borderRadius: 13, backgroundColor: '#E2E8F0' }} />
        <View style={{ width: 44, height: 10, borderRadius: 5, backgroundColor: '#E2E8F0', marginTop: 6 }} />
      </View>
      <View style={{ flex: 1, height: 62, borderRadius: 14, backgroundColor: '#F1F5F9' }} />
    </Animated.View>
  );
};

// ─── Animated count-up ────────────────────────────────────────────────────────
const CountUp = ({ target, style }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (target === 0) { setDisplay(0); return; }
    let current = 0;
    const step  = Math.ceil(target / 20);
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      setDisplay(current);
      if (current >= target) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [target]);
  return <Text style={style}>{display}</Text>;
};

// ─── Period card ──────────────────────────────────────────────────────────────
const PeriodRow = ({ period, entry, palette, isNow, index }) => {
  const translateY = useRef(new Animated.Value(20)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 300, delay: index * 60, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, delay: index * 60, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!isNow) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isNow]);

  return (
    <Animated.View style={[styles.periodRow, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.periodBadgeWrap}>
        <View style={[
          styles.periodBadge,
          !!entry && styles.periodBadgeActive,
          isNow  && styles.periodBadgeNow,
        ]}>
          {isNow ? (
            <Animated.View style={[styles.nowDot, { transform: [{ scale: pulseAnim }] }]} />
          ) : (
            <Ionicons name="time-outline" size={12} color={entry ? '#fff' : '#94A3B8'} />
          )}
          <Text style={[styles.periodBadgeText, !!entry && styles.periodBadgeTextActive]}>
            {period}
          </Text>
        </View>
        {entry?.start_time && (
          <Text style={styles.periodTime}>{fmt12(entry.start_time)}</Text>
        )}
      </View>

      {entry && palette ? (
        <View style={[
          styles.classCard,
          { backgroundColor: palette.bg, borderColor: isNow ? palette.dot : palette.border },
          isNow && {
            borderWidth: 2,
            shadowColor: palette.dot,
            shadowOpacity: 0.22,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 3 },
            elevation: 5,
          },
        ]}>
          <View style={styles.classCardTop}>
            <View style={[styles.subjectDot, { backgroundColor: palette.dot }]} />
            <Text style={[styles.subjectName, { color: palette.text }]} numberOfLines={1}>
              {entry.subject_name}
            </Text>
            {isNow && (
              <View style={[styles.nowBadge, { backgroundColor: palette.dot }]}>
                <Text style={styles.nowBadgeText}>NOW</Text>
              </View>
            )}
          </View>
          {entry.start_time && entry.end_time && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
              <Ionicons name="alarm-outline" size={11} color={palette.text + '99'} />
              <Text style={[styles.timeRange, { color: palette.text + '99' }]}>
                {fmt12(entry.start_time)} – {fmt12(entry.end_time)}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.freePeriod}>
          <Text style={styles.freePeriodText}>Free Period</Text>
        </View>
      )}
    </Animated.View>
  );
};

// ─── Next class banner ────────────────────────────────────────────────────────
const NextClassBanner = ({ entry, palette }) => {
  if (!entry?.start_time) return null;
  const mins = minutesUntil(entry);
  if (mins === null || mins < 0 || mins > 180) return null;
  const text =
    mins === 0 ? 'Starting now'
    : mins < 60 ? `In ${mins} min`
    : `In ${Math.floor(mins / 60)}h ${mins % 60}m`;
  return (
    <View style={[
      styles.nextBanner,
      { backgroundColor: palette?.bg ?? T.primaryBg, borderColor: palette?.dot ?? T.primary },
    ]}>
      <Ionicons name="chevron-forward-circle" size={16} color={palette?.dot ?? T.primary} />
      <Text style={[styles.nextBannerText, { color: palette?.text ?? T.heroDeep }]} numberOfLines={1}>
        Next: <Text style={{ fontWeight: '700' }}>{entry.subject_name}</Text> · {text}
      </Text>
    </View>
  );
};

// ─── Section Header — matches StudentDashboard SectionHeader exactly ──────────
const SectionHeader = ({ title, icon, iconColor = T.primary, subtitle }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 10 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: iconColor + '18', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={17} color={iconColor} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 }}>{title}</Text>
    </View>
    {subtitle ? <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600' }}>{subtitle}</Text> : null}
  </View>
);

// ==================== MAIN SCREEN ====================
export default function StudentTimetableScreen({ navigation, route, onBack, token: propToken, user: propUser }) {
  const { user: ctxUser, token: ctxToken } = useAuth();
  const user  = propUser  || ctxUser;
  const token = propToken || ctxToken;
  const propStudentInfo = route?.params?.studentInfo ?? null;

  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [error, setError]             = useState(null);
  const [timetable, setTimetable]     = useState([]);
  const [colorMap, setColorMap]       = useState({});
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date().getDay();
    return d === 0 ? 0 : Math.min(d - 1, 5);
  });
  const [now, setNow] = useState(new Date());

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const handleBack = useCallback(() => {
    if (typeof onBack === 'function') { onBack(); return; }
    if (navigation) {
      try {
        if (typeof navigation.canGoBack === 'function' && navigation.canGoBack()) navigation.goBack();
        else if (typeof navigation.navigate === 'function') navigation.navigate('StudentDashboard');
        else navigation.goBack();
      } catch (e) { console.warn('TimetableScreen back error:', e); }
    }
  }, [onBack, navigation]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      let studentRecord = propStudentInfo;
      if (!studentRecord) {
        const sData = await api.get(`/students?search=${encodeURIComponent(user.email || '')}`, token);
        const sList = Array.isArray(sData) ? sData : (sData?.students ?? sData?.data ?? []);
        studentRecord = sList.find(
          s => (s.student_email || '').toLowerCase() === (user.email || '').toLowerCase()
        ) ?? null;
      }
      const subcategoryId = studentRecord?.subcategory_id;
      const itemId        = studentRecord?.item_id;
      if (!subcategoryId) { setError('Class not assigned. Contact admin.'); return; }

      const itemParam   = itemId ? `&item_id=${itemId}` : '';
      const res         = await api.get(`/timetable-assignments?subcategory_id=${subcategoryId}${itemParam}`, token);
      const assignments = Array.isArray(res) ? res : (res?.assignments ?? res?.data ?? []);

      const formatted = assignments.map(item => ({
        id:            item.id,
        period_number: item.period_number,
        day:           (item.day || '').toUpperCase().slice(0, 3),
        subject_name:  item.subject_name || 'Subject',
        start_time:    item.start_time ?? null,
        end_time:      item.end_time   ?? null,
      }));
      setTimetable(formatted);

      const todayCode  = DAYS_CODE[new Date().getDay() === 0 ? 0 : Math.min(new Date().getDay() - 1, 5)];
      const todaySlots = formatted
        .filter(e => e.day === todayCode)
        .sort((a, b) => (a.period_number ?? 0) - (b.period_number ?? 0));
      scheduleDailyTimetableReminder(
        todaySlots[0]
          ? { subject_name: todaySlots[0].subject_name, start_time: todaySlots[0].start_time ?? `Period ${todaySlots[0].period_number}` }
          : null
      ).catch(() => {});

      const subjects = [...new Set(formatted.map(e => e.subject_name))];
      const cm = {};
      subjects.forEach((s, i) => { cm[s] = i % SUBJECT_COLORS.length; });
      setColorMap(cm);
    } catch {
      setError('Failed to load timetable. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, token, propStudentInfo]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const todayCode = DAYS_CODE[selectedDay];

  const isToday = useMemo(() => {
    const d   = new Date().getDay();
    const idx = d === 0 ? 0 : Math.min(d - 1, 5);
    return idx === selectedDay;
  }, [selectedDay]);

  const daySlots = useMemo(
    () => timetable.filter(t => t.day === todayCode).sort((a, b) => (a.period_number ?? 0) - (b.period_number ?? 0)),
    [timetable, todayCode]
  );

  const maxPeriod = useMemo(
    () => timetable.length ? Math.max(...timetable.map(e => e.period_number ?? 0), 8) : 8,
    [timetable]
  );

  const periods = useMemo(() => Array.from({ length: maxPeriod }, (_, i) => i + 1), [maxPeriod]);

  const getEntry = useCallback(
    (period) => timetable.find(t => t.period_number === period && t.day === todayCode),
    [timetable, todayCode]
  );

  const activeDayIndices = useMemo(() => {
    const indices = new Set();
    timetable.forEach(e => { const i = DAYS_CODE.indexOf(e.day); if (i >= 0) indices.add(i); });
    return [0, 1, 2, 3, 4, ...(indices.has(5) ? [5] : [])];
  }, [timetable]);

  const nextClass = useMemo(() => {
    if (!isToday) return null;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return daySlots
      .filter(e => e.start_time && toMinutes(e.start_time) > nowMin)
      .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time))[0] ?? null;
  }, [daySlots, isToday, now]);

  const nextClassPalette = nextClass ? SUBJECT_COLORS[colorMap[nextClass.subject_name] ?? 0] : null;

  const actualTodayIndex = useMemo(() => {
    const d = new Date().getDay();
    return d === 0 ? 0 : Math.min(d - 1, 5);
  }, []);

  const hour        = new Date().getHours();
  const greeting    = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const greetIcon   = hour < 12 ? 'sunny-outline' : hour < 17 ? 'partly-sunny-outline' : 'moon-outline';
  const studentName = user?.full_name?.split(' ')[0] || 'Student';

  return (
    <View style={styles.container}>

      {/* ══ HERO HEADER — sky blue matching StudentDashboard PremiumHeader ══ */}
      <View style={styles.hero}>
        {/* Decorative circles */}
        <View style={styles.deco1} />
        <View style={styles.deco2} />
        <View style={styles.deco3} />

        {/* Back + Title row */}
        <View style={styles.heroTop}>
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.75}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Ionicons name={greetIcon} size={13} color="rgba(255,255,255,0.7)" />
              <Text style={styles.heroGreeting}>{greeting}, {studentName}</Text>
            </View>
            <Text style={styles.heroTitle}>My Timetable</Text>
          </View>

          <View style={styles.heroIcon}>
            <Ionicons name="calendar" size={24} color="#fff" />
          </View>
        </View>

        {/* Stat pills */}
        <View style={styles.pills}>
          {loading ? (
            [1, 2, 3].map(i => (
              <View key={i} style={styles.pill}>
                <SkeletonBox width={28} height={20} style={{ borderRadius: 6 }} />
                <SkeletonBox width={44} height={10} style={{ borderRadius: 4, marginTop: 4 }} />
              </View>
            ))
          ) : (
            [
              { label: 'Today',    value: daySlots.length              },
              { label: 'Weekly',   value: timetable.length             },
              { label: 'Subjects', value: Object.keys(colorMap).length },
            ].map(s => (
              <View key={s.label} style={styles.pill}>
                <CountUp target={s.value} style={styles.pillValue} />
                <Text style={styles.pillLabel}>{s.label}</Text>
              </View>
            ))
          )}
        </View>
      </View>

      {/* ══ DAY TAB BAR ══ */}
      <View style={styles.dayTabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayTabs}
        >
          {activeDayIndices.map(i => {
            const isSelected    = i === selectedDay;
            const isActualToday = i === actualTodayIndex;
            const count         = timetable.filter(t => t.day === DAYS_CODE[i]).length;
            return (
              <TouchableOpacity
                key={DAYS_DISPLAY[i]}
                style={[
                  styles.dayTab,
                  isSelected    && styles.dayTabActive,
                  isActualToday && !isSelected && styles.dayTabToday,
                ]}
                onPress={() => setSelectedDay(i)}
                activeOpacity={0.75}
              >
                <Text style={[
                  styles.dayTabText,
                  isSelected    && styles.dayTabTextActive,
                  isActualToday && !isSelected && { color: T.tabActive },
                ]}>
                  {DAYS_DISPLAY[i].slice(0, 3)}
                </Text>
                <View style={[
                  styles.dayBadge,
                  isSelected && styles.dayBadgeActive,
                  count === 0 && styles.dayBadgeEmpty,
                ]}>
                  <Text style={[styles.dayBadgeText, isSelected && styles.dayBadgeTextActive]}>
                    {count > 0 ? count : '–'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ══ BODY ══ */}
      <ScrollView
        style={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={T.primary}
            colors={[T.primary]}
          />
        }
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>

          {!!error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color="#EF4444" style={{ marginRight: 6 }} />
              <Text style={styles.errorBannerText}>{error}</Text>
              <TouchableOpacity onPress={() => { setLoading(true); loadData(); }} style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && isToday && nextClass && (
            <NextClassBanner entry={nextClass} palette={nextClassPalette} />
          )}

          {!loading && timetable.length > 0 && (
            <SectionHeader
              title={isToday ? "Today's Schedule" : `${DAYS_DISPLAY[selectedDay]}'s Schedule`}
              icon="time-outline"
              iconColor={T.primary}
              subtitle={`${daySlots.length} period${daySlots.length !== 1 ? 's' : ''}`}
            />
          )}

          {loading ? (
            Array.from({ length: 6 }, (_, i) => <PeriodRowSkeleton key={i} delay={i * 60} />)
          ) : timetable.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="calendar-outline" size={40} color={T.primary} />
              </View>
              <Text style={styles.emptyTitle}>No timetable assigned yet</Text>
              <Text style={styles.emptySubtitle}>Contact your admin to set up your schedule</Text>
            </View>
          ) : (
            periods.map((period, idx) => {
              const entry   = getEntry(period);
              const palette = entry ? SUBJECT_COLORS[colorMap[entry.subject_name] ?? 0] : null;
              const isNow   = isToday && !!entry && isCurrentPeriod(entry);
              return (
                <PeriodRow
                  key={`${todayCode}-${period}`}
                  period={period}
                  entry={entry}
                  palette={palette}
                  isNow={isNow}
                  index={idx}
                />
              );
            })
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  // ── Hero — sky blue matching StudentDashboard PremiumHeader ───────────────
  hero: {
    backgroundColor: '#0EA5E9',   // sky-500 — matches HEADER_CONFIGS.student primary
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 24,
    overflow: 'hidden',
    shadowColor: '#0369A1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 8,
  },

  // Decorative circles — same positions as StudentDashboard PremiumHeader
  deco1: {
    position: 'absolute', right: -24, top: -24,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  deco2: {
    position: 'absolute', bottom: -16, right: 50,
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  deco3: {
    position: 'absolute', left: -20, bottom: -20,
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },

  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  heroGreeting: {
    fontSize: 11, color: 'rgba(255,255,255,0.75)',
    fontWeight: '600', letterSpacing: 0.5,
  },

  heroTitle: {
    fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: -0.5,
  },

  heroIcon: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
  },

  pills: { flexDirection: 'row', gap: 6 },
  pill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  pillLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2, textAlign: 'center' },

  // ── Day tab bar ───────────────────────────────────────────────────────────
  dayTabsWrapper: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  dayTabs: { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  dayTab: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 22, backgroundColor: '#F1F5F9',
    alignItems: 'center', minWidth: 62,
  },
  dayTabActive:     { backgroundColor: '#0EA5E9' },
  dayTabToday:      { borderWidth: 1.5, borderColor: '#0EA5E9' },
  dayTabText:       { fontSize: 13, fontWeight: '600', color: '#64748B' },
  dayTabTextActive: { color: '#fff' },
  dayBadge: {
    marginTop: 3, backgroundColor: '#E2E8F0',
    borderRadius: 8, paddingHorizontal: 6,
    paddingVertical: 1, minWidth: 20, alignItems: 'center',
  },
  dayBadgeActive:     { backgroundColor: 'rgba(255,255,255,0.28)' },
  dayBadgeEmpty:      { backgroundColor: 'transparent' },
  dayBadgeText:       { fontSize: 10, fontWeight: '700', color: '#475569' },
  dayBadgeTextActive: { color: '#fff' },

  // ── Body ──────────────────────────────────────────────────────────────────
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },

  errorBanner: {
    backgroundColor: '#FEF2F2', borderRadius: 14, padding: 12, marginTop: 14,
    flexDirection: 'row', alignItems: 'center',
    borderLeftWidth: 4, borderLeftColor: '#EF4444',
  },
  errorBannerText: { color: '#EF4444', flex: 1, fontSize: 13 },
  retryBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, marginLeft: 8,
  },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  nextBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1.5,
    paddingVertical: 10, paddingHorizontal: 14,
    marginTop: 14, marginBottom: 4,
  },
  nextBannerText: { fontSize: 13, flex: 1 },

  periodRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  periodBadgeWrap: { width: 70, alignItems: 'center' },
  periodBadge: {
    width: 50, height: 50, borderRadius: 14,
    backgroundColor: '#E2E8F0',
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  periodBadgeActive:     { backgroundColor: '#0EA5E9' },  // sky blue active
  periodBadgeNow:        { backgroundColor: '#059669' },
  periodBadgeText:       { fontSize: 14, fontWeight: '800', color: '#64748B' },
  periodBadgeTextActive: { color: '#fff' },
  periodTime: {
    fontSize: 10, color: '#94A3B8',
    marginTop: 5, textAlign: 'center', fontWeight: '500',
  },

  nowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', marginBottom: 1 },

  classCard: {
    flex: 1, borderRadius: 14, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  classCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subjectDot:   { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  subjectName:  { fontSize: 14, fontWeight: '700', flex: 1 },
  timeRange:    { fontSize: 11, fontWeight: '500' },
  nowBadge:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  nowBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  freePeriod: {
    flex: 1, borderRadius: 14,
    borderWidth: 1, borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
    opacity: 0.6,
  },
  freePeriodText: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },

  emptyBox: { alignItems: 'center', paddingTop: 64 },
  emptyIconWrap: {
    width: 90, height: 90, borderRadius: 28,
    backgroundColor: '#F0F9FF',   // sky-50
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle:    { fontSize: 17, fontWeight: '700', color: '#1E293B', marginTop: 4 },
  emptySubtitle: { fontSize: 13, color: '#64748B', marginTop: 6, textAlign: 'center', lineHeight: 20 },
});