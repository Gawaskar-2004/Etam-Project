import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  SafeAreaView, ActivityIndicator, Platform, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';

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
  red:     '#DC2626',
  redLt:   '#FEE2E2',
  radius:  { sm:8, md:12, lg:16, xl:20, pill:999 },
  shadow:  {
    sm: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:6,  elevation:2 },
    md: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:4}, shadowOpacity:0.10, shadowRadius:12, elevation:4 },
    lg: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:8}, shadowOpacity:0.14, shadowRadius:20, elevation:8 },
  },
};

// ─── InfoRow ──────────────────────────────────────────────────────────────────
function InfoRow({ iconName, label, value, accentColor, accentBg, index }) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue:1, duration:300, delay:index*50, useNativeDriver:true }),
      Animated.timing(slideAnim, { toValue:0, duration:300, delay:index*50, useNativeDriver:true }),
    ]).start();
  }, []);

  if (!value) return null;
  return (
    <Animated.View style={{ opacity:fadeAnim, transform:[{translateY:slideAnim}] }}>
      <View style={{
        flexDirection:'row', alignItems:'center',
        paddingVertical:14, borderBottomWidth:1, borderBottomColor:T.border,
      }}>
        <View style={{
          width:40, height:40, borderRadius:T.radius.md,
          backgroundColor:accentBg,
          alignItems:'center', justifyContent:'center', marginRight:14,
          borderWidth:1, borderColor:accentColor+'30',
        }}>
          <Ionicons name={iconName} size={18} color={accentColor} />
        </View>
        <View style={{ flex:1 }}>
          <Text style={{ fontSize:11, color:T.textMut, fontWeight:'600', marginBottom:2, letterSpacing:0.3 }}>
            {label}
          </Text>
          <Text style={{ fontSize:14, fontWeight:'700', color:T.textPri, lineHeight:20 }}>
            {value}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={T.textMut} />
      </View>
    </Animated.View>
  );
}

// ─── SectionCard ──────────────────────────────────────────────────────────────
function SectionCard({ title, iconName, accentColor, children }) {
  return (
    <View style={{
      backgroundColor:T.surface, borderRadius:T.radius.xl,
      marginBottom:14, overflow:'hidden',
      borderWidth:1, borderColor:T.border,
      ...T.shadow.sm,
    }}>
      <View style={{ flexDirection:'row' }}>
        <View style={{ width:5, backgroundColor:accentColor }} />
        <View style={{
          flex:1, flexDirection:'row', alignItems:'center', gap:10,
          paddingVertical:14, paddingHorizontal:16,
          backgroundColor:accentColor+'08',
          borderBottomWidth:1, borderBottomColor:T.border,
        }}>
          <View style={{
            width:34, height:34, borderRadius:T.radius.md,
            backgroundColor:accentColor+'18',
            alignItems:'center', justifyContent:'center',
          }}>
            <Ionicons name={iconName} size={16} color={accentColor} />
          </View>
          <Text style={{ fontSize:12, fontWeight:'800', color:accentColor, letterSpacing:0.8, textTransform:'uppercase' }}>
            {title}
          </Text>
        </View>
      </View>
      <View style={{ paddingHorizontal:16, paddingBottom:6 }}>
        {children}
      </View>
    </View>
  );
}

// ─── ClassTeacherRow ──────────────────────────────────────────────────────────
function ClassTeacherRow({ label, index }) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue:1, duration:300, delay:index*60, useNativeDriver:true }),
      Animated.timing(slideAnim, { toValue:0, duration:300, delay:index*60, useNativeDriver:true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity:fadeAnim, transform:[{translateY:slideAnim}] }}>
      <View style={{
        flexDirection:'row', alignItems:'center',
        paddingVertical:12, borderBottomWidth:1, borderBottomColor:T.border,
        gap:12,
      }}>
        <View style={{
          width:38, height:38, borderRadius:T.radius.md,
          backgroundColor:'#FEF3C7',
          alignItems:'center', justifyContent:'center',
          borderWidth:1, borderColor:'#D9770630',
        }}>
          <Ionicons name="star" size={16} color="#D97706" />
        </View>
        <View style={{ flex:1 }}>
          <Text style={{ fontSize:11, color:T.textMut, fontWeight:'600', letterSpacing:0.3, textTransform:'uppercase', marginBottom:2 }}>
            Class Teacher
          </Text>
          <Text style={{ fontSize:14, fontWeight:'700', color:T.textPri }}>
            {label}
          </Text>
        </View>
        <Ionicons name="checkmark-circle" size={18} color="#D97706" />
      </View>
    </Animated.View>
  );
}

// ─── SubjectRow ───────────────────────────────────────────────────────────────
function SubjectRow({ name, code, index }) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue:1, duration:300, delay:index*60, useNativeDriver:true }),
      Animated.timing(slideAnim, { toValue:0, duration:300, delay:index*60, useNativeDriver:true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity:fadeAnim, transform:[{translateY:slideAnim}] }}>
      <View style={{
        flexDirection:'row', alignItems:'center',
        paddingVertical:12, borderBottomWidth:1, borderBottomColor:T.border,
        gap:12,
      }}>
        <View style={{
          width:38, height:38, borderRadius:T.radius.md,
          backgroundColor:T.greenLt,
          alignItems:'center', justifyContent:'center',
          borderWidth:1, borderColor:T.green+'30',
        }}>
          <Text style={{ fontSize:13, fontWeight:'900', color:T.green }}>{index + 1}</Text>
        </View>
        <View style={{ flex:1 }}>
          <Text style={{ fontSize:14, fontWeight:'700', color:T.textPri }}>{name}</Text>
          {!!code && (
            <Text style={{ fontSize:11, color:T.green, fontFamily:'monospace', marginTop:2 }}>{code}</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={14} color={T.textMut} />
      </View>
    </Animated.View>
  );
}

// ─── AssignedClassCard ────────────────────────────────────────────────────────
const DAYS_ORDER = ['MON','TUE','WED','THU','FRI','SAT'];

function AssignedClassCard({ label, days, periods, index }) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue:1, duration:300, delay:index*70, useNativeDriver:true }),
      Animated.timing(slideAnim, { toValue:0, duration:300, delay:index*70, useNativeDriver:true }),
    ]).start();
  }, []);

  const orderedDays   = DAYS_ORDER.filter(d => days.has(d));
  const uniquePeriods = [...new Set(periods)].sort((a, b) => a - b);

  return (
    <Animated.View style={{ opacity:fadeAnim, transform:[{translateY:slideAnim}] }}>
      <View style={{
        borderRadius:T.radius.lg,
        backgroundColor:T.indigoLt,
        borderWidth:1, borderColor:T.border,
        padding:14, marginBottom:10,
      }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:10 }}>
          <View style={{
            width:36, height:36, borderRadius:T.radius.md,
            backgroundColor:T.indigo,
            alignItems:'center', justifyContent:'center',
          }}>
            <Ionicons name="school-outline" size={16} color="#fff" />
          </View>
          <View style={{ flex:1 }}>
            <Text style={{ fontSize:13, fontWeight:'700', color:T.textPri, lineHeight:18 }}>{label}</Text>
            <Text style={{ fontSize:10, color:T.indigo, fontWeight:'600', textTransform:'uppercase', letterSpacing:0.5, marginTop:2 }}>
              {uniquePeriods.length} period{uniquePeriods.length !== 1 ? 's' : ''} · {orderedDays.length} day{orderedDays.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:5, marginBottom:8 }}>
          {DAYS_ORDER.map(d => (
            <View key={d} style={{
              paddingHorizontal:7, paddingVertical:3,
              borderRadius:T.radius.sm,
              backgroundColor: days.has(d) ? T.indigo : T.surface,
              borderWidth:1,
              borderColor: days.has(d) ? T.indigo : T.border,
            }}>
              <Text style={{
                fontSize:9, fontWeight:'900', textTransform:'uppercase', letterSpacing:0.5,
                color: days.has(d) ? '#fff' : T.textMut,
              }}>
                {d.slice(0,2)}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:5 }}>
          {uniquePeriods.map(p => (
            <View key={p} style={{
              width:24, height:24, borderRadius:T.radius.sm,
              backgroundColor:T.surface,
              borderWidth:1, borderColor:T.indigoLt,
              alignItems:'center', justifyContent:'center',
            }}>
              <Text style={{ fontSize:10, fontWeight:'700', color:T.indigo }}>{p}</Text>
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
function EmptyState({ iconName, message }) {
  return (
    <View style={{ alignItems:'center', paddingVertical:28 }}>
      <Ionicons name={iconName} size={32} color={T.textMut} style={{ opacity:0.3, marginBottom:8 }} />
      <Text style={{ fontSize:13, color:T.textMut, fontWeight:'500' }}>{message}</Text>
    </View>
  );
}

// ─── Main ProfileScreen ───────────────────────────────────────────────────────
const ProfileScreen = ({ user, token, onLogout }) => {
  const isStudent = user?.role === 'student';

  const [extra, setExtra]                               = useState(null);
  const [classTeacherOf, setClassTeacherOf]             = useState([]);
  const [timetableAssignments, setTimetableAssignments] = useState([]);
  const [subjectsTaught, setSubjectsTaught]             = useState([]);
  const [loading, setLoading]                           = useState(true);

  const headerAnim  = useRef(new Animated.Value(0)).current;
  const logoutScale = useRef(new Animated.Value(1)).current;

  const roleGrad    = isStudent
    ? ['#059669','#047857','#065F46']
    : ['#312E81','#4F46E5','#7C3AED'];
  const accentColor = isStudent ? T.green : T.indigo;
  const accentBg    = isStudent ? T.greenLt : T.indigoLt;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue:1, duration:600, useNativeDriver:true }).start();
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      if (isStudent) {
        // ── Student: fetch student record ──────────────────────────────
        const data = await api.get(`/students?user_id=${user?.id}`, token).catch(() => null);
        const list = Array.isArray(data) ? data : [];
        const me   = list.find(s => s.user_id === user?.id || s.email === user?.email) || list[0] || null;
        setExtra(me);
      } else {
        // ── Staff: fetch staff details ─────────────────────────────────
        // Try by-email endpoint first, then fall back to list search
        let me = await api.get(`/staff/by-email/${encodeURIComponent(user?.email || '')}`, token).catch(() => null);

        if (!me) {
          const staffList = await api.get('/staff?limit=1000', token).catch(() => []);
          const list = Array.isArray(staffList) ? staffList : [];
          me = list.find(s => s.user_id === user?.id || s.email === user?.email) || null;
        }

        setExtra(me);
        const staffId = me?.id;

        if (staffId) {
          // ── Class Teacher Assignments ─────────────────────────────────
          // Use api.get() so the correct base URL + auth header from your
          // api client is used (same as web version does via fetch + authHeader)
          const ctData = await api.get(`/class-teachers?staff_id=${staffId}`, token).catch(() => []);
          const ctList = Array.isArray(ctData) ? ctData : (ctData?.data || []);
          // Filter to only entries where this staff is the class teacher
          setClassTeacherOf(ctList.filter(c => String(c.staff_id) === String(staffId)));

          // ── Timetable Assignments ─────────────────────────────────────
          const ttData = await api.get(`/timetable-assignments?staff_id=${staffId}`, token).catch(() => []);
          const ttList = Array.isArray(ttData) ? ttData : (ttData?.assignments || []);
          const filtered = ttList.filter(a => String(a.staff_id) === String(staffId));
          setTimetableAssignments(filtered);

          // ── Unique Subjects from timetable ────────────────────────────
          const seen = new Set();
          const uniqueSubs = [];
          filtered.forEach(a => {
            if (a.subject_id && !seen.has(a.subject_id)) {
              seen.add(a.subject_id);
              uniqueSubs.push({ id: a.subject_id, name: a.subject_name || 'Unknown', code: a.subject_code });
            }
          });
          setSubjectsTaught(uniqueSubs);
        }
      }
    } catch (err) {
      console.error('ProfileScreen fetchAll error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Group timetable by class
  const groupedClasses = (() => {
    const map = {};
    timetableAssignments.forEach(a => {
      const key = [a.category_name, a.subcategory_name, a.item_name].filter(Boolean).join(' › ') || 'Unknown Class';
      if (!map[key]) map[key] = { label: key, days: new Set(), periods: [] };
      map[key].days.add(a.day);
      map[key].periods.push(a.period_number);
    });
    return Object.values(map);
  })();

  const initials = (user?.full_name || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const handleLogoutPressIn  = () => Animated.spring(logoutScale, { toValue:0.97, useNativeDriver:true }).start();
  const handleLogoutPressOut = () => Animated.spring(logoutScale, { toValue:1,    useNativeDriver:true }).start();

  const joinedDate = extra?.joined_date || extra?.created_at || extra?.date_of_joining;
  const joinedFormatted = joinedDate
    ? new Date(joinedDate).toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' })
    : null;

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:T.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom:40 }}>

        {/* ── Hero Header ── */}
        <LinearGradient
          colors={roleGrad}
          start={{x:0,y:0}} end={{x:1,y:1}}
          style={{ paddingTop:Platform.OS==='ios'?55:45, paddingBottom:60, paddingHorizontal:20, overflow:'hidden' }}
        >
          <View style={{ position:'absolute', top:-30, right:-30, width:150, height:150, borderRadius:75, borderWidth:1, borderColor:'rgba(255,255,255,0.06)' }} />
          <View style={{ position:'absolute', top:20,  right:30,  width:80,  height:80,  borderRadius:40, borderWidth:1, borderColor:'rgba(255,255,255,0.06)' }} />
          <View style={{ position:'absolute', bottom:-20, left:-10, width:100, height:100, borderRadius:50, backgroundColor:'rgba(255,255,255,0.04)' }} />

          <Animated.View style={{ opacity:headerAnim }}>
            <Text style={{ fontSize:11, color:'rgba(255,255,255,0.65)', fontWeight:'700', letterSpacing:1.5, textTransform:'uppercase', marginBottom:18 }}>
              {isStudent ? 'Student Profile' : 'Teacher Profile'}
            </Text>

            <View style={{ flexDirection:'row', alignItems:'center', gap:18 }}>
              <View style={{ position:'relative' }}>
                <View style={{
                  width:80, height:80, borderRadius:26,
                  backgroundColor:'rgba(255,255,255,0.15)',
                  alignItems:'center', justifyContent:'center',
                  borderWidth:2, borderColor:'rgba(255,255,255,0.3)',
                }}>
                  <Text style={{ fontSize:34, fontWeight:'900', color:'#fff', letterSpacing:-1 }}>
                    {initials}
                  </Text>
                </View>
                {user?.is_active && (
                  <View style={{
                    position:'absolute', bottom:2, right:2,
                    width:16, height:16, borderRadius:8,
                    backgroundColor:T.green, borderWidth:2, borderColor:'#fff',
                  }} />
                )}
              </View>

              <View style={{ flex:1 }}>
                <Text style={{ fontSize:22, fontWeight:'900', color:'#fff', letterSpacing:-0.3, marginBottom:4 }} numberOfLines={2}>
                  {user?.full_name}
                </Text>
                <View style={{ flexDirection:'row', alignItems:'center', gap:5, marginBottom:8 }}>
                  <Ionicons name="mail-outline" size={12} color="rgba(255,255,255,0.65)" />
                  <Text style={{ fontSize:12, color:'rgba(255,255,255,0.75)', fontWeight:'500', flex:1 }} numberOfLines={1}>
                    {user?.email}
                  </Text>
                </View>
                <View style={{ flexDirection:'row', gap:6, flexWrap:'wrap' }}>
                  <View style={{
                    backgroundColor:'rgba(255,255,255,0.15)',
                    paddingHorizontal:10, paddingVertical:4, borderRadius:T.radius.pill,
                    flexDirection:'row', alignItems:'center', gap:5,
                    borderWidth:1, borderColor:'rgba(255,255,255,0.2)',
                  }}>
                    <Ionicons name={isStudent?'school-outline':'person-outline'} size={11} color='rgba(255,255,255,0.9)' />
                    <Text style={{ fontSize:11, color:'#fff', fontWeight:'800', letterSpacing:0.5 }}>
                      {user?.role?.toUpperCase()}
                    </Text>
                  </View>
                  {user?.is_active && (
                    <View style={{
                      backgroundColor:'rgba(110,231,183,0.25)',
                      paddingHorizontal:10, paddingVertical:4, borderRadius:T.radius.pill,
                      flexDirection:'row', alignItems:'center', gap:5,
                      borderWidth:1, borderColor:'rgba(110,231,183,0.4)',
                    }}>
                      <View style={{ width:5, height:5, borderRadius:3, backgroundColor:T.green }} />
                      <Text style={{ fontSize:11, color:'#6EE7B7', fontWeight:'800' }}>Active</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </Animated.View>
        </LinearGradient>

        {/* ── Content Cards ── */}
        <View style={{ marginTop:-28, paddingHorizontal:16 }}>

          {loading ? (
            <View style={{
              backgroundColor:T.surface, borderRadius:T.radius.xl,
              padding:40, alignItems:'center', marginBottom:14,
              borderWidth:1, borderColor:T.border, ...T.shadow.sm,
            }}>
              <ActivityIndicator color={accentColor} size="large" />
              <Text style={{ color:T.textSec, marginTop:12, fontSize:13, fontWeight:'500' }}>
                Loading profile…
              </Text>
            </View>
          ) : isStudent ? (
            // ─── STUDENT SECTIONS ──────────────────────────────────────────
            <>
              <SectionCard title="Personal Info" iconName="person-circle-outline" accentColor={accentColor}>
                <InfoRow index={0} iconName="person-outline" label="Full Name"    value={user?.full_name}                                         accentColor={accentColor} accentBg={accentBg} />
                <InfoRow index={1} iconName="mail-outline"   label="Email Address" value={user?.email}                                            accentColor={accentColor} accentBg={accentBg} />
                <InfoRow index={2} iconName="call-outline"   label="Phone Number"  value={user?.phone || extra?.mobile_number || extra?.phone}    accentColor={accentColor} accentBg={accentBg} />
              </SectionCard>

              <SectionCard title="Academic Info" iconName="school-outline" accentColor="#0891B2">
                <InfoRow index={0} iconName="id-card-outline"  label="Registration No." value={extra?.register_number || extra?.registration_number || extra?.reg_no} accentColor="#0891B2" accentBg="#ECFEFF" />
                <InfoRow index={1} iconName="business-outline" label="Class"            value={extra?.class_name || extra?.full_class_name}                           accentColor="#0891B2" accentBg="#ECFEFF" />
                <InfoRow index={2} iconName="calendar-outline" label="Admission Year"   value={extra?.admission_year ? String(extra.admission_year) : null}           accentColor="#0891B2" accentBg="#ECFEFF" />
                <InfoRow index={3} iconName="pricetag-outline" label="Category"         value={extra?.category_name}                                                  accentColor="#0891B2" accentBg="#ECFEFF" />
              </SectionCard>
            </>
          ) : (
            // ─── TEACHER SECTIONS ──────────────────────────────────────────
            <>
              {/* Personal Info */}
              <SectionCard title="Personal Info" iconName="person-circle-outline" accentColor={accentColor}>
                <InfoRow index={0} iconName="person-outline" label="Full Name"    value={user?.full_name}                                      accentColor={accentColor} accentBg={accentBg} />
                <InfoRow index={1} iconName="mail-outline"   label="Email Address" value={user?.email}                                         accentColor={accentColor} accentBg={accentBg} />
                <InfoRow index={2} iconName="call-outline"   label="Phone Number"  value={user?.phone || extra?.mobile_number || extra?.phone} accentColor={accentColor} accentBg={accentBg} />
              </SectionCard>

              {/* Professional Info */}
              <SectionCard title="Professional Info" iconName="briefcase-outline" accentColor="#0891B2">
                <InfoRow index={0} iconName="card-outline"             label="Staff Code"  value={extra?.staff_code}                  accentColor="#0891B2" accentBg="#ECFEFF" />
                <InfoRow index={1} iconName="ribbon-outline"           label="Designation" value={extra?.designation}                 accentColor="#0891B2" accentBg="#ECFEFF" />
                <InfoRow index={2} iconName="git-branch-outline"       label="Department"  value={extra?.department}                  accentColor="#0891B2" accentBg="#ECFEFF" />
                <InfoRow index={3} iconName="shield-checkmark-outline" label="Role"        value={user?.role?.toUpperCase()}          accentColor="#0891B2" accentBg="#ECFEFF" />
                <InfoRow index={4} iconName="calendar-number-outline"  label="Joined"      value={joinedFormatted}                    accentColor="#0891B2" accentBg="#ECFEFF" />
              </SectionCard>

              {/* Class Teacher Of */}
              <SectionCard title="Class Teacher Of" iconName="star-outline" accentColor="#D97706">
                {classTeacherOf.length === 0 ? (
                  <EmptyState iconName="star-outline" message="Not assigned as class teacher" />
                ) : (
                  classTeacherOf.map((ct, i) => {
                    const label = [
                      ct.category_name,
                      ct.subcategory_name,
                      ct.item_name ? `Section ${ct.item_name}` : '',
                    ].filter(Boolean).join(' › ') || 'Unknown Class';
                    return <ClassTeacherRow key={i} label={label} index={i} />;
                  })
                )}
              </SectionCard>

              {/* Subjects Taught */}
              <SectionCard title="Subjects Taught" iconName="book-outline" accentColor={T.green}>
                {subjectsTaught.length === 0 ? (
                  <EmptyState iconName="book-outline" message="No subjects assigned yet" />
                ) : (
                  subjectsTaught.map((sub, i) => (
                    <SubjectRow key={sub.id} name={sub.name} code={sub.code} index={i} />
                  ))
                )}
              </SectionCard>

              {/* Assigned Classes */}
              <SectionCard title="Assigned Classes" iconName="school-outline" accentColor={T.indigo}>
                {groupedClasses.length === 0 ? (
                  <EmptyState iconName="school-outline" message="No timetable assignments found" />
                ) : (
                  <View style={{ paddingTop:10 }}>
                    {groupedClasses.map((cls, i) => (
                      <AssignedClassCard
                        key={i}
                        label={cls.label}
                        days={cls.days}
                        periods={cls.periods}
                        index={i}
                      />
                    ))}
                  </View>
                )}
              </SectionCard>
            </>
          )}

          {/* ── Sign Out Button ── */}
          <Animated.View style={{ transform:[{scale:logoutScale}], marginTop:4 }}>
            <TouchableOpacity
              onPress={onLogout}
              onPressIn={handleLogoutPressIn}
              onPressOut={handleLogoutPressOut}
              activeOpacity={0.9}
              style={{ borderRadius:T.radius.lg, overflow:'hidden', ...T.shadow.md, shadowColor:'#DC2626' }}
            >
              <LinearGradient
                colors={['#EF4444','#DC2626','#B91C1C']}
                start={{x:0,y:0}} end={{x:1,y:0}}
                style={{ paddingVertical:16, alignItems:'center', flexDirection:'row', justifyContent:'center', gap:10 }}
              >
                <View style={{ width:36, height:36, borderRadius:T.radius.md, backgroundColor:'rgba(255,255,255,0.2)', alignItems:'center', justifyContent:'center' }}>
                  <Ionicons name="log-out-outline" size={20} color="#fff" />
                </View>
                <Text style={{ fontSize:16, fontWeight:'900', color:'#fff', letterSpacing:0.5 }}>Sign Out</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Text style={{ textAlign:'center', color:T.textMut, fontSize:11, marginTop:18, fontWeight:'500' }}>
            ETAM v1.0 · Secure Session
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;