import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Animated, Easing, Alert, Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';

// ─── Design tokens — sky blue matching StudentDashboard ───────────────────────
const SKY = {
  hero:        '#0EA5E9',
  heroShadow:  '#0369A1',
  pill:        'rgba(255,255,255,0.15)',
  pillBorder:  'rgba(255,255,255,0.2)',
  pillText:    '#fff',
  pillLabel:   'rgba(255,255,255,0.8)',
  btnBg:       'rgba(255,255,255,0.2)',
  deco1Bg:     'rgba(255,255,255,0.06)',
  deco2Bg:     'rgba(255,255,255,0.05)',
  deco3Bg:     'rgba(255,255,255,0.04)',
};

// ─── Skeleton shimmer ─────────────────────────────────────────────────────────
const SkeletonBox = ({ width = '100%', height = 16, style = {} }) => {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1,   duration: 750, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(anim, { toValue: 0.3, duration: 750, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[{ width, height, borderRadius: 8, backgroundColor: '#BAE6FD', opacity: anim }, style]} />
  );
};

const ProfileSkeleton = () => (
  <View style={{ paddingTop: 8 }}>
    <View style={[S.card, { alignItems: 'center', paddingVertical: 32, marginBottom: 16 }]}>
      <SkeletonBox width={84} height={84} style={{ borderRadius: 42, marginBottom: 14 }} />
      <SkeletonBox width={140} height={18} style={{ marginBottom: 8 }} />
      <SkeletonBox width={170} height={13} style={{ marginBottom: 12 }} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <SkeletonBox width={80}  height={28} style={{ borderRadius: 14 }} />
        <SkeletonBox width={70}  height={28} style={{ borderRadius: 14 }} />
      </View>
    </View>
    {[1, 2, 3].map(s => (
      <View key={s} style={[S.card, { marginBottom: 12 }]}>
        <SkeletonBox width={110} height={13} style={{ marginBottom: 14, borderRadius: 6 }} />
        {[1, 2, 3].map(f => (
          <View key={f} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 }}>
            <SkeletonBox width={44} height={44} style={{ borderRadius: 12 }} />
            <View style={{ flex: 1, gap: 6 }}>
              <SkeletonBox width="35%" height={10} />
              <SkeletonBox width="65%" height={14} />
            </View>
          </View>
        ))}
      </View>
    ))}
  </View>
);

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader = ({ title, icon, iconColor = '#0EA5E9', subtitle }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: iconColor + '18', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={17} color={iconColor} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 }}>{title}</Text>
    </View>
    {subtitle ? <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600' }}>{subtitle}</Text> : null}
  </View>
);

// ─── Info Row ─────────────────────────────────────────────────────────────────
const InfoRow = ({ label, value, icon, iconColor = '#0EA5E9', isLast, lib = 'ion' }) => {
  if (!value) return null;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13 }}>
        <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: iconColor + '15', alignItems: 'center', justifyContent: 'center' }}>
          {lib === 'mc'
            ? <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
            : <Ionicons name={icon} size={20} color={iconColor} />}
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', lineHeight: 20 }} selectable>{value}</Text>
        </View>
      </View>
      {!isLast && <View style={{ height: 0.5, backgroundColor: '#F1F5F9', marginLeft: 58 }} />}
    </View>
  );
};

// ─── Class Hierarchy Card ─────────────────────────────────────────────────────
const ClassHierarchyCard = ({ category, subcategory, item }) => {
  const levels = [
    { label: 'Category', value: category,    icon: 'layers-outline',  color: '#3B82F6', bg: '#EFF6FF' },
    { label: 'Class',    value: subcategory, icon: 'school-outline',   color: '#7C3AED', bg: '#EDE9FE' },
    { label: 'Section',  value: item,        icon: 'people-outline',   color: '#059669', bg: '#ECFDF5' },
  ].filter(l => l.value);

  if (!levels.length) return null;

  return (
    <View style={S.card}>
      {/* Card header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3F0FF' }}>
        <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="school" size={15} color="#7C3AED" />
        </View>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#3B0764' }}>Class Details</Text>
      </View>

      {levels.map((level, i) => (
        <View key={level.label} style={{ flexDirection: 'row', alignItems: 'stretch', marginBottom: i < levels.length - 1 ? 8 : 0, minHeight: 52 }}>
          {/* Connector line + dot */}
          <View style={{ width: 20, alignItems: 'center', marginRight: 10 }}>
            {i > 0 && <View style={{ flex: 1, width: 2, backgroundColor: '#DDD6FE', marginBottom: 0 }} />}
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: level.color, borderWidth: 2, borderColor: '#fff', marginVertical: 2, zIndex: 1 }} />
            {i < levels.length - 1 && <View style={{ flex: 1, width: 2, backgroundColor: '#DDD6FE', marginTop: 0 }} />}
          </View>

          {/* Content */}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: level.bg }}>
            <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: level.color + '20', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={level.icon} size={15} color={level.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{level.label}</Text>
              <Text style={{ fontSize: 14, fontWeight: '800', color: level.color, letterSpacing: -0.2 }}>{level.value}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

// ─── Status pill ──────────────────────────────────────────────────────────────
const StatusPill = ({ status }) => {
  const map = {
    active:   { label: 'Active',   color: '#065F46', bg: '#D1FAE5', dot: '#10B981' },
    inactive: { label: 'Inactive', color: '#92400E', bg: '#FEF3C7', dot: '#D97706' },
    relieved: { label: 'Relieved', color: '#991B1B', bg: '#FEE2E2', dot: '#EF4444' },
  };
  const c = map[status] ?? map.inactive;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: c.bg }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.dot }} />
      <Text style={{ fontSize: 11, fontWeight: '700', color: c.color }}>{c.label}</Text>
    </View>
  );
};

// ─── Attendance type pill ─────────────────────────────────────────────────────
const AttendancePill = ({ type }) => {
  const map = {
    face:   { label: 'Face ID', color: '#4338CA', bg: '#EEF2FF', icon: 'scan-outline'  },
    groupi: { label: 'Groupi',  color: '#7C3AED', bg: '#EDE9FE', icon: 'people-outline' },
    manual: { label: 'Manual',  color: '#475569', bg: '#F1F5F9', icon: 'create-outline' },
  };
  const c = map[type] ?? map.manual;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: c.bg }}>
      <Ionicons name={c.icon} size={12} color={c.color} />
      <Text style={{ fontSize: 11, fontWeight: '700', color: c.color }}>{c.label}</Text>
    </View>
  );
};

// ─── Temp-password banner ─────────────────────────────────────────────────────
const TempPasswordBanner = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF7ED', borderRadius: 12, borderWidth: 1, borderColor: '#FED7AA', padding: 12, marginBottom: 14 }}>
    <Ionicons name="time-outline" size={16} color="#D97706" />
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: '#92400E' }}>Awaiting First Login</Text>
      <Text style={{ fontSize: 11, color: '#B45309', marginTop: 1 }}>Change your temporary password to activate your account.</Text>
    </View>
  </View>
);

// ==================== MAIN SCREEN ====================
export default function StudentProfileScreen({ navigation, route, onBack, token: propToken, user: propUser }) {
  const { user: ctxUser, token: ctxToken, signOut } = useAuth();
  const user  = propUser  || ctxUser;
  const token = propToken || ctxToken;

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);
  const [profile,    setProfile]    = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const handleBack = useCallback(() => {
    if (typeof onBack === 'function') { onBack(); return; }
    if (navigation) {
      try {
        navigation.canGoBack?.() ? navigation.goBack() : navigation.navigate('StudentDashboard');
      } catch (e) { console.warn(e); }
    }
  }, [onBack, navigation]);

  const loadProfile = useCallback(async () => {
    try {
      setError(null);
      const res  = await api.get(`/students?user_id=${user.id}`, token);
      const list = Array.isArray(res) ? res : (res?.students ?? []);
      const found = list.length > 0 ? list[0] : null;
      setProfile(found);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    } catch (err) {
      setError('Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, token]);

  useEffect(() => { loadProfile(); }, []);

  const onRefresh = () => { setRefreshing(true); loadProfile(); };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: () => {
          if (signOut) signOut();
          else if (navigation) navigation.replace('Login');
        },
      },
    ]);
  };

  // ── Derived display values ────────────────────────────────────────────────
  const displayName  = profile?.full_name  || user?.full_name  || 'Student';
  const displayEmail = profile?.student_email || profile?.email || user?.email || '';

  const initials = displayName
    .split(' ').slice(0, 2).map(n => n[0] ?? '').join('').toUpperCase() || '?';

  const isActive      = profile?.student_status === 'active';
  const isTempPassword = profile?.is_temp_password === true;

  // Class hierarchy
  const categoryName    = profile?.category_name    || null;
  const subcategoryName = profile?.subcategory_name || null;
  const itemName        = profile?.item_name        || null;

  // Flat breadcrumb label for pill
  const classLabel = [categoryName, subcategoryName, itemName].filter(Boolean).join(' › ') || null;

  // Time-based greeting
  const hour        = new Date().getHours();
  const greeting    = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const greetIcon   = hour < 12 ? 'sunny-outline' : hour < 17 ? 'partly-sunny-outline' : 'moon-outline';
  const firstName   = displayName.split(' ')[0] || 'Student';

  // Stat pills for header
  const headerStats = [
    { label: 'Status',    value: profile?.student_status ? (profile.student_status.charAt(0).toUpperCase() + profile.student_status.slice(1)) : '—' },
    { label: 'Shift',     value: profile?.shift_time     ? (profile.shift_time.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())) : '—' },
    { label: 'Residence', value: profile?.residence_type ? (profile.residence_type === 'day_scholar' ? 'Day Scholar' : 'Hostel') : '—' },
  ];

  // ── Field definitions (only render if value exists) ──────────────────────

  const personalFields = [
    { label: 'Full Name',      value: displayName,                                                           icon: 'person-outline',         iconColor: '#6366F1' },
    { label: 'Email',          value: displayEmail,                                                           icon: 'mail-outline',           iconColor: '#0EA5E9' },
    { label: 'Student Mobile', value: profile?.student_mobile,                                                icon: 'phone-portrait-outline', iconColor: '#10B981' },
    { label: 'Date of Birth',  value: profile?.date_of_birth ? formatDate(profile.date_of_birth) : null,     icon: 'calendar-outline',       iconColor: '#F59E0B' },
    { label: 'Gender',         value: profile?.gender ? capitalise(profile.gender) : null,                   icon: 'person-circle-outline',  iconColor: '#8B5CF6' },
    { label: 'Blood Group',    value: profile?.blood_group,                                                   icon: 'water-outline',          iconColor: '#EF4444' },
    { label: 'Address',        value: profile?.address,                                                       icon: 'location-outline',       iconColor: '#F97316' },
  ].filter(f => f.value);

  const familyFields = [
    { label: 'Parent / Guardian', value: profile?.parent_name,    icon: 'people-outline',   iconColor: '#BE185D' },
    { label: 'Parent Contact',    value: profile?.parent_contact, icon: 'call-outline',     iconColor: '#10B981' },
  ].filter(f => f.value);

  const academicFields = [
    { label: 'Register Number', value: profile?.register_number || profile?.registration_number || profile?.reg_no || profile?.roll_number, icon: 'ribbon-outline',          iconColor: '#8B5CF6' },
    { label: 'Admission Year',  value: profile?.admission_year ? String(profile.admission_year) : null,                                     icon: 'calendar-number-outline', iconColor: '#6366F1' },
    { label: 'Batch',           value: profile?.batch || profile?.batch_name,                                                               icon: 'people-outline',          iconColor: '#F97316' },
    { label: 'Institution',     value: profile?.institution_name || profile?.school_name || user?.institution_name,                         icon: 'business-outline',        iconColor: '#0891B2' },
  ].filter(f => f.value);

  const settingsFields = [
    { label: 'Residence Type',  value: profile?.residence_type  ? (profile.residence_type === 'day_scholar' ? 'Day Scholar' : 'Hostel') : null,        icon: 'home-outline',    iconColor: '#0EA5E9' },
    { label: 'Shift Time',      value: profile?.shift_time      ? profile.shift_time.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : null,  icon: 'time-outline',    iconColor: '#F59E0B' },
    { label: 'Attendance Type', value: profile?.attendance_type ? capitalise(profile.attendance_type) : null,                                          icon: 'finger-print-outline', iconColor: '#7C3AED' },
    { label: 'Student Status',  value: profile?.student_status  ? capitalise(profile.student_status) : null,                                           icon: 'checkmark-circle-outline', iconColor: '#10B981' },
  ].filter(f => f.value);

  return (
    <View style={S.container}>

      {/* ══════════════════════════════════════════════════════════════
          HERO HEADER — Sky blue matching StudentDashboard
      ═══════════════════════════════════════════════════════════════ */}
      <View style={S.hero}>
        {/* Decorative circles */}
        <View style={S.deco1} />
        <View style={S.deco2} />
        <View style={S.deco3} />

        {/* Top row */}
        <View style={S.heroTop}>
          <TouchableOpacity onPress={handleBack} style={S.heroBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center', marginHorizontal: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
              <Ionicons name={greetIcon} size={12} color="rgba(255,255,255,0.75)" />
              <Text style={S.heroGreeting}>{greeting}, {firstName}</Text>
            </View>
            <Text style={S.heroTitle}>My Profile</Text>
            <Text style={S.heroSub}>{displayEmail || 'Student Portal'}</Text>
          </View>

          <TouchableOpacity
            onPress={onRefresh}
            disabled={refreshing}
            style={S.heroBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={18} color="#fff" style={{ opacity: refreshing ? 0.5 : 1 }} />
          </TouchableOpacity>
        </View>

        {/* Stat pills */}
        <View style={S.pills}>
          {headerStats.map(s => (
            <View key={s.label} style={S.pill}>
              <Text style={S.pillValue} numberOfLines={1}>{s.value}</Text>
              <Text style={S.pillLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ══ BODY ══ */}
      <ScrollView
        style={S.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" colors={['#0EA5E9']} />}
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {!!error && (
          <View style={S.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color="#EF4444" style={{ marginRight: 6 }} />
            <Text style={{ color: '#EF4444', flex: 1, fontSize: 13 }}>{error}</Text>
            <TouchableOpacity onPress={() => { setLoading(true); loadProfile(); }} style={S.retryBtn}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? <ProfileSkeleton /> : !profile ? (
          <View style={S.emptyBox}>
            <View style={S.emptyIconWrap}>
              <Ionicons name="person-circle-outline" size={48} color="#0EA5E9" />
            </View>
            <Text style={S.emptyTitle}>Profile not found</Text>
            <Text style={S.emptySubtitle}>Contact your admin to set up your student record</Text>
          </View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim }}>

            {/* ── TEMP PASSWORD WARNING ── */}
            {isTempPassword && <TempPasswordBanner />}

            {/* ── AVATAR CARD ── */}
            <SectionHeader title="Student Profile" icon="person-outline" iconColor="#0EA5E9" />

            <View style={[S.card, { alignItems: 'center', paddingVertical: 28, borderWidth: 1.5, borderColor: '#BAE6FD', overflow: 'hidden' }]}>
              {/* Top accent strip — sky blue */}
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: '#0EA5E9' }} />

              {/* Avatar */}
              <View style={S.avatarRing}>
                <View style={S.avatar}>
                  <Text style={S.avatarText}>{initials}</Text>
                </View>
              </View>

              <Text style={S.profileName}>{displayName}</Text>
              <Text style={S.profileEmail} numberOfLines={1}>{displayEmail}</Text>

              {/* Register number */}
              {(profile?.register_number || profile?.reg_no) && (
                <View style={[S.infoPill, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD', marginTop: 6 }]}>
                  <Ionicons name="ribbon-outline" size={12} color="#0284C7" />
                  <Text style={[S.infoPillText, { color: '#0369A1' }]}>
                    {profile.register_number || profile.reg_no}
                  </Text>
                </View>
              )}

              {/* Institution */}
              {(profile?.institution_name || profile?.school_name) && (
                <View style={[S.infoPill, { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD', marginTop: 6 }]}>
                  <Ionicons name="business-outline" size={12} color="#0891B2" />
                  <Text style={[S.infoPillText, { color: '#0369A1' }]} numberOfLines={1}>
                    {profile.institution_name || profile.school_name}
                  </Text>
                </View>
              )}

              {/* Class breadcrumb */}
              {!!classLabel && (
                <View style={[S.infoPill, { backgroundColor: '#EDE9FE', borderColor: '#C4B5FD', marginTop: 6 }]}>
                  <Ionicons name="school-outline" size={12} color="#7C3AED" />
                  <Text style={[S.infoPillText, { color: '#5B21B6' }]} numberOfLines={2}>{classLabel}</Text>
                </View>
              )}

              {/* Badges row */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
                <View style={S.roleBadge}>
                  <Text style={S.roleBadgeText}>STUDENT</Text>
                </View>
                <StatusPill status={profile?.student_status} />
                {profile?.attendance_type && <AttendancePill type={profile.attendance_type} />}
              </View>

              {/* Lock hint */}
              <View style={S.lockHint}>
                <Ionicons name="lock-closed-outline" size={11} color="#64748B" />
                <Text style={S.lockHintText}>Contact admin to update your details</Text>
              </View>
            </View>

            {/* ── CLASS HIERARCHY ── */}
            {(categoryName || subcategoryName || itemName) && (
              <>
                <SectionHeader title="Class Details" icon="school-outline" iconColor="#7C3AED" />
                <ClassHierarchyCard category={categoryName} subcategory={subcategoryName} item={itemName} />
              </>
            )}

            {/* ── PERSONAL INFO ── */}
            {personalFields.length > 0 && (
              <>
                <SectionHeader title="Personal Info" icon="person-outline" iconColor="#6366F1" />
                <View style={S.card}>
                  {personalFields.map((f, i) => (
                    <InfoRow key={f.label} {...f} isLast={i === personalFields.length - 1} />
                  ))}
                </View>
              </>
            )}

            {/* ── FAMILY / GUARDIAN ── */}
            {familyFields.length > 0 && (
              <>
                <SectionHeader title="Family Info" icon="heart-outline" iconColor="#BE185D" />
                <View style={S.card}>
                  {familyFields.map((f, i) => (
                    <InfoRow key={f.label} {...f} isLast={i === familyFields.length - 1} />
                  ))}
                </View>
              </>
            )}

            {/* ── ACADEMIC INFO ── */}
            {academicFields.length > 0 && (
              <>
                <SectionHeader title="Academic Info" icon="ribbon-outline" iconColor="#3B82F6" />
                <View style={S.card}>
                  {academicFields.map((f, i) => (
                    <InfoRow key={f.label} {...f} isLast={i === academicFields.length - 1} />
                  ))}
                </View>
              </>
            )}

            {/* ── SETTINGS / ACCOUNT ── */}
            {settingsFields.length > 0 && (
              <>
                <SectionHeader title="Account Settings" icon="settings-outline" iconColor="#0EA5E9" />
                <View style={S.card}>
                  {settingsFields.map((f, i) => (
                    <InfoRow key={f.label} {...f} isLast={i === settingsFields.length - 1} />
                  ))}
                </View>
              </>
            )}

            {/* ── SIGN OUT ── */}
            <SectionHeader title="Account" icon="log-out-outline" iconColor="#EF4444" />
            <View style={[S.card, { padding: 0, overflow: 'hidden' }]}>
              <TouchableOpacity style={S.signOutRow} onPress={handleSignOut} activeOpacity={0.75}>
                <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 }}>Tap to logout</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#EF4444' }}>Sign Out</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>

            <Text style={S.versionText}>Version 1.0.0 · Student Portal</Text>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const capitalise = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

const formatDate = (raw) => {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ==================== STYLES ====================
const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  body:      { flex: 1, paddingHorizontal: 16 },

  // ── Hero header — sky blue ─────────────────────────────────────────────────
  hero: {
    backgroundColor: '#0EA5E9',
    paddingTop: Platform.OS === 'ios' ? 52 : 40,
    paddingBottom: 22,
    paddingHorizontal: 20,
    overflow: 'hidden',
    shadowColor: '#0369A1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 8,
  },

  // Decorative circles
  deco1: { position: 'absolute', right: -24, top: -24, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)' },
  deco2: { position: 'absolute', bottom: -16, right: 50, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.05)' },
  deco3: { position: 'absolute', left: -20, bottom: -20, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.04)' },

  heroTop:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  heroBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroGreeting:{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: '600', letterSpacing: 0.5 },
  heroTitle:   { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  heroSub:     { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  pills:      { flexDirection: 'row', gap: 6 },
  pill:       { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingVertical: 9, paddingHorizontal: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  pillValue:  { fontSize: 13, fontWeight: '800', color: '#fff', textAlign: 'center' },
  pillLabel:  { fontSize: 9,  color: 'rgba(255,255,255,0.8)', marginTop: 2, textAlign: 'center', fontWeight: '600' },

  // ── Cards ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
    marginBottom: 6,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  // ── Avatar ─────────────────────────────────────────────────────────────────
  avatarRing: { width: 92, height: 92, borderRadius: 46, borderWidth: 3, borderColor: '#BAE6FD', alignItems: 'center', justifyContent: 'center', marginBottom: 14, marginTop: 10 },
  avatar:     { width: 82, height: 82, borderRadius: 41, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 30, fontWeight: '800', color: '#0284C7' },

  profileName:  { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  profileEmail: { fontSize: 13, color: '#64748B', marginTop: 3, maxWidth: '85%', textAlign: 'center' },

  infoPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, maxWidth: '88%' },
  infoPillText: { fontSize: 12, fontWeight: '700' },

  roleBadge:     { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: '#E0F2FE', borderWidth: 1, borderColor: '#0EA5E9' },
  roleBadgeText: { fontSize: 11, fontWeight: '800', color: '#0369A1', letterSpacing: 0.5 },

  lockHint:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 14, backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  lockHintText: { fontSize: 11, color: '#64748B' },

  signOutRow: { flexDirection: 'row', alignItems: 'center', padding: 18 },

  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: '#EF4444', marginTop: 16 },
  retryBtn:    { backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginLeft: 8 },

  emptyBox:      { alignItems: 'center', paddingTop: 64 },
  emptyIconWrap: { width: 90, height: 90, borderRadius: 28, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle:    { fontSize: 17, fontWeight: '700', color: '#1E293B', marginTop: 4 },
  emptySubtitle: { fontSize: 13, color: '#64748B', marginTop: 6, textAlign: 'center', lineHeight: 20 },

  versionText: { textAlign: 'center', fontSize: 11, color: '#CBD5E1', marginTop: 18, marginBottom: 4 },
});