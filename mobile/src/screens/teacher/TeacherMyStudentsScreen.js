import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, ScrollView,
  SafeAreaView, Platform, Animated, TextInput, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { C } from '../../config/constants';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { hasFaceRegistered, buildClassMap } from '../../utils/helpers';
import EmptyState from '../../components/EmptyState';

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
  red:     '#DC2626',
  redLt:   '#FEE2E2',
  slate:   '#64748B',
  slateLt: '#F1F5F9',
  radius:  { sm:8, md:12, lg:16, xl:20, pill:999 },
  shadow:  {
    sm: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:6, elevation:2 },
    md: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:4}, shadowOpacity:0.10, shadowRadius:12, elevation:4 },
    lg: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:8}, shadowOpacity:0.14, shadowRadius:20, elevation:8 },
  },
};

// ─── Avatar gradient palettes (varies by first letter) ───────────────────────
const AVATAR_GRADIENTS = {
  A: ['#6366F1','#8B5CF6'], B: ['#EC4899','#F43F5E'], C: ['#0EA5E9','#6366F1'],
  D: ['#14B8A6','#0EA5E9'], E: ['#F59E0B','#EF4444'], F: ['#8B5CF6','#EC4899'],
  G: ['#10B981','#0EA5E9'], H: ['#F43F5E','#FB923C'], I: ['#6366F1','#06B6D4'],
  J: ['#7C3AED','#4F46E5'], K: ['#059669','#0D9488'], L: ['#D97706','#B45309'],
  M: ['#DC2626','#9F1239'], N: ['#0369A1','#0E7490'], O: ['#7C3AED','#6D28D9'],
  P: ['#B45309','#92400E'], Q: ['#15803D','#166534'], R: ['#4F46E5','#7C3AED'],
  S: ['#0E7490','#0369A1'], T: ['#9333EA','#7E22CE'], U: ['#C026D3','#A21CAF'],
  V: ['#0284C7','#0369A1'], W: ['#16A34A','#15803D'], X: ['#EA580C','#C2410C'],
  Y: ['#CA8A04','#A16207'], Z: ['#7C3AED','#5B21B6'],
};
const getAvatarGradient = (name) => {
  const key = name?.[0]?.toUpperCase();
  return AVATAR_GRADIENTS[key] || [T.indigo, '#7C3AED'];
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const SkeletonBox = ({ width, height, radius = 8, style }) => {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue:1, duration:900, useNativeDriver:true }),
      Animated.timing(anim, { toValue:0.4, duration:900, useNativeDriver:true }),
    ])).start();
  }, []);
  return <Animated.View style={[{ width, height, borderRadius:radius, backgroundColor:'#E2E8F0', opacity:anim }, style]} />;
};

// ─── Face Registration Progress Bar ──────────────────────────────────────────
const FaceProgressBar = ({ faceCount, totalCount }) => {
  const pct = totalCount > 0 ? faceCount / totalCount : 0;
  const widthAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(widthAnim, { toValue: pct, duration: 800, delay: 200, useNativeDriver: false }).start();
  }, [pct]);
  const barColor = pct === 1 ? T.green : pct >= 0.5 ? T.indigo : T.amber;
  return (
    <View style={{ marginTop: 14 }}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:6 }}>
        <Text style={{ fontSize:11, color:'rgba(255,255,255,0.7)', fontWeight:'600' }}>Face Registration Progress</Text>
        <Text style={{ fontSize:11, color:'rgba(255,255,255,0.9)', fontWeight:'800' }}>
          {faceCount}/{totalCount} ({Math.round(pct * 100)}%)
        </Text>
      </View>
      <View style={{ height:6, backgroundColor:'rgba(255,255,255,0.15)', borderRadius:T.radius.pill, overflow:'hidden' }}>
        <Animated.View style={{
          height:'100%',
          borderRadius:T.radius.pill,
          backgroundColor:'#fff',
          width: widthAnim.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] }),
        }} />
      </View>
    </View>
  );
};

// ─── Class Chip with optional student count badge ─────────────────────────────
const ClassChip = ({ cls, isActive, onPress, studentCount }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handleIn  = () => Animated.spring(scale, { toValue:0.94, useNativeDriver:true }).start();
  const handleOut = () => Animated.spring(scale, { toValue:1, useNativeDriver:true }).start();
  return (
    <Animated.View style={{ transform:[{scale}] }}>
      <TouchableOpacity
        onPress={onPress} onPressIn={handleIn} onPressOut={handleOut}
        activeOpacity={0.9}
        style={{
          paddingHorizontal: 16, paddingVertical: 10, borderRadius: T.radius.lg,
          backgroundColor: isActive ? T.indigo : T.surface,
          borderWidth: 1, borderColor: isActive ? T.indigo : T.border,
          marginRight: 10, flexDirection:'row', alignItems:'center', gap: 8,
          ...(isActive ? T.shadow.md : T.shadow.sm),
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '700', color: isActive ? '#fff' : T.textPri }}>{cls.name}</Text>
        {studentCount != null && (
          <View style={{
            backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : T.indigoLt,
            paddingHorizontal: 7, paddingVertical: 2,
            borderRadius: T.radius.pill, minWidth: 22, alignItems:'center',
          }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: isActive ? '#fff' : T.indigo }}>{studentCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Filter Pill (All / Face Reg / Pending) ───────────────────────────────────
const FilterPill = ({ label, count, isActive, onPress, color = T.indigo, lightColor = T.indigoLt }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    style={{
      flexDirection:'row', alignItems:'center', gap:6,
      paddingHorizontal:14, paddingVertical:8, borderRadius:T.radius.pill,
      backgroundColor: isActive ? color : T.surface,
      borderWidth:1, borderColor: isActive ? color : T.border,
      marginRight:8,
      ...(isActive ? T.shadow.sm : {}),
    }}
  >
    <Text style={{ fontSize:13, fontWeight:'700', color: isActive ? '#fff' : T.textSec }}>{label}</Text>
    <View style={{
      backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : lightColor,
      paddingHorizontal:6, paddingVertical:1, borderRadius:T.radius.pill,
    }}>
      <Text style={{ fontSize:11, fontWeight:'800', color: isActive ? '#fff' : color }}>{count}</Text>
    </View>
  </TouchableOpacity>
);

// ─── Student Card ─────────────────────────────────────────────────────────────
const StudentCard = ({ student, index, registered }) => {
  const slideAnim = useRef(new Animated.Value(20)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue:1, duration:300, delay:index*50, useNativeDriver:true }),
      Animated.timing(slideAnim, { toValue:0, duration:300, delay:index*50, useNativeDriver:true }),
    ]).start();
  }, []);

  const handlePressIn  = () => Animated.spring(scaleAnim, { toValue:0.97, useNativeDriver:true }).start();
  const handlePressOut = () => Animated.spring(scaleAnim, { toValue:1, useNativeDriver:true }).start();

  const regNo = student.register_number || student.registration_number || student.reg_no || '—';
  const avatarColors = registered ? getAvatarGradient(student.full_name) : ['#94A3B8','#CBD5E1'];

  return (
    <Animated.View style={{ opacity:fadeAnim, transform:[{translateY:slideAnim},{scale:scaleAnim}] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{
          backgroundColor: T.surface, borderRadius: T.radius.lg, marginBottom: 10,
          overflow: 'hidden', borderWidth: 1,
          borderColor: registered ? T.indigo : T.border,
          ...T.shadow.sm,
        }}
      >
        <View style={{ flexDirection: 'row' }}>
          {/* Left accent bar */}
          <View style={{ width: 4, backgroundColor: registered ? T.indigo : '#E2E8F0' }} />
          <View style={{ flex: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {/* Index badge */}
            <View style={{
              width: 28, height: 28, borderRadius: 8,
              backgroundColor: registered ? T.indigoLt : T.slateLt,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: registered ? T.indigo : T.textSec }}>{index + 1}</Text>
            </View>

            {/* Avatar */}
            <LinearGradient
              colors={avatarColors}
              style={{ width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 19, fontWeight: '800', color: '#fff' }}>
                {student.full_name?.[0]?.toUpperCase()}
              </Text>
            </LinearGradient>

            {/* Info */}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: T.textPri }} numberOfLines={1}>
                {student.full_name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <Feather name="hash" size={11} color={T.textMut} />
                <Text style={{ fontSize: 12, color: T.textSec, fontWeight:'500' }}>{regNo}</Text>
              </View>
            </View>

            {/* Badge */}
            {registered ? (
              <View style={{
                backgroundColor: T.indigoLt, paddingHorizontal: 10, paddingVertical: 6,
                borderRadius: T.radius.pill, flexDirection: 'row', alignItems: 'center', gap: 5,
              }}>
                <MaterialCommunityIcons name="face-recognition" size={13} color={T.indigo} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: T.indigo }}>Face</Text>
              </View>
            ) : (
              <View style={{
                backgroundColor: T.amberLt, paddingHorizontal: 10, paddingVertical: 6,
                borderRadius: T.radius.pill, flexDirection:'row', alignItems:'center', gap:5,
              }}>
                <Feather name="alert-circle" size={12} color={T.amber} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: T.amber }}>No Face</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const TeacherMyStudentsScreen = ({ token: propToken, user: propUser, onBack, navigation }) => {
  const { token: ctxToken, user: ctxUser } = useAuth();
  const token = propToken || ctxToken;
  const user  = propUser  || ctxUser;

  const [classes, setClasses]             = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [students, setStudents]           = useState([]);
  const [classCounts, setClassCounts]     = useState({}); // { [classId]: number }
  const [loading, setLoading]             = useState(false);
  const [search, setSearch]               = useState('');
  const [refreshing, setRefreshing]       = useState(false);
  // 'all' | 'face' | 'pending'
  const [activeFilter, setActiveFilter]   = useState('all');

  useEffect(() => { loadClasses(); }, []);

  const loadClasses = async () => {
    try {
      const data = await api.get(`/timetable-assignments?user_id=${user?.id || ''}`, token);
      const list = Array.isArray(data) ? data : (data?.assignments || []);
      const cls  = buildClassMap(list);
      setClasses(cls);
      if (cls.length) setSelectedClass(cls[0]);
    } catch (error) { console.log('Load error:', error); }
  };

  useEffect(() => { if (selectedClass) loadStudents(); }, [selectedClass]);

  const loadStudents = async () => {
    if (!selectedClass) return;
    setLoading(true);
    try {
      const data = await api.get(
        `/students?subcategory_id=${selectedClass.subcategory_id}&item_id=${selectedClass.item_id || ''}`,
        token
      );
      const arr = Array.isArray(data) ? data : [];
      setStudents(arr);
      // cache count for this class
      setClassCounts(prev => ({ ...prev, [selectedClass.id]: arr.length }));
    } catch (error) { console.log('Load error:', error); }
    finally { setLoading(false); setRefreshing(false); }
  };

  // Filter pipeline: search → face/pending filter
  const afterSearch = students.filter(s =>
    !search ||
    s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.roll_number?.toString().includes(search) ||
    (s.register_number || s.registration_number || s.reg_no)?.toString().includes(search)
  );

  const filtered = afterSearch.filter(s => {
    if (activeFilter === 'face')    return hasFaceRegistered(s);
    if (activeFilter === 'pending') return !hasFaceRegistered(s);
    return true;
  });

  const faceCount    = students.filter(s => hasFaceRegistered(s)).length;
  const totalCount   = students.length;
  const pendingCount = totalCount - faceCount;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadStudents(); }}
            tintColor={T.indigo}
          />
        }
      >
        {/* ── Hero Header ── */}
        <LinearGradient
          colors={['#1E1B4B','#3730A3','#4F46E5']}
          start={{x:0,y:0}} end={{x:1,y:1}}
          style={{ paddingTop: Platform.OS==='ios'?55:45, paddingBottom: 28, paddingHorizontal: 20, overflow:'hidden' }}
        >
          {/* Decorative rings */}
          <View style={{ position:'absolute', top:-40, right:-40, width:180, height:180, borderRadius:90, borderWidth:1.5, borderColor:'rgba(255,255,255,0.07)' }} />
          <View style={{ position:'absolute', top:10, right:30, width:90, height:90, borderRadius:45, borderWidth:1, borderColor:'rgba(255,255,255,0.07)' }} />
          <View style={{ position:'absolute', bottom:-30, left:-20, width:120, height:120, borderRadius:60, backgroundColor:'rgba(255,255,255,0.04)' }} />
          <View style={{ position:'absolute', bottom:20, right:60, width:50, height:50, borderRadius:25, backgroundColor:'rgba(255,255,255,0.05)' }} />

          {/* Back button */}
          {(onBack || navigation) && (
            <TouchableOpacity
              onPress={() => onBack ? onBack() : navigation?.goBack()}
              style={{
                flexDirection:'row', alignItems:'center', gap:6,
                alignSelf:'flex-start', marginBottom:18,
                backgroundColor:'rgba(255,255,255,0.12)',
                borderRadius:T.radius.pill, paddingHorizontal:14, paddingVertical:7,
              }}
            >
              <Ionicons name="arrow-back" size={16} color="#fff" />
              <Text style={{ fontSize:13, fontWeight:'700', color:'#fff' }}>Back</Text>
            </TouchableOpacity>
          )}

          {/* Title row */}
          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' }}>
            <View style={{ flex:1 }}>
              <Text style={{ fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:'700', letterSpacing:1.5, textTransform:'uppercase', marginBottom:6 }}>
                Teacher Portal
              </Text>
              <Text style={{ fontSize:30, fontWeight:'900', color:'#fff', letterSpacing:-0.5 }}>
                My Students
              </Text>
              <Text style={{ fontSize:13, color:'rgba(255,255,255,0.7)', marginTop:4, fontWeight:'500' }}>
                {selectedClass ? selectedClass.name : 'Select a class'}
              </Text>
            </View>
            <View style={{
              width:56, height:56, borderRadius:18,
              backgroundColor:'rgba(255,255,255,0.15)',
              alignItems:'center', justifyContent:'center',
            }}>
              <Feather name="users" size={26} color="#fff" />
            </View>
          </View>

          {/* Stats row */}
          {totalCount > 0 && (
            <>
              <View style={{ flexDirection:'row', gap:10, marginTop:18 }}>
                {[
                  { label:'Total',    value: totalCount,   icon:'people-outline' },
                  { label:'Face Reg.',value: faceCount,    icon:'checkmark-circle-outline' },
                  { label:'Pending',  value: pendingCount, icon:'time-outline' },
                ].map((s,i) => (
                  <View key={i} style={{
                    flex:1,
                    backgroundColor:'rgba(255,255,255,0.12)',
                    borderRadius:T.radius.md, padding:10, alignItems:'center',
                    borderWidth:1, borderColor:'rgba(255,255,255,0.1)',
                  }}>
                    <Text style={{ fontSize:20, fontWeight:'900', color:'#fff', letterSpacing:-0.3 }}>{s.value}</Text>
                    <Text style={{ fontSize:9, color:'rgba(255,255,255,0.65)', marginTop:2, fontWeight:'600', textAlign:'center' }}>
                      {s.label}
                    </Text>
                  </View>
                ))}
              </View>

              {/* ── Progress Bar (NEW) ── */}
              <FaceProgressBar faceCount={faceCount} totalCount={totalCount} />
            </>
          )}
        </LinearGradient>

        <View style={{ paddingHorizontal: 16, paddingBottom: 36, paddingTop: 20 }}>

          {/* ── Class Selector ── */}
          {classes.length > 0 && (
            <>
              <Text style={{ fontSize:12, fontWeight:'700', color:T.textSec, letterSpacing:0.8, textTransform:'uppercase', marginBottom:12 }}>
                Select class
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                <View style={{ flexDirection:'row' }}>
                  {classes.map(cls => (
                    <ClassChip
                      key={cls.id}
                      cls={cls}
                      isActive={selectedClass?.id === cls.id}
                      onPress={() => { setSelectedClass(cls); setSearch(''); setActiveFilter('all'); }}
                      studentCount={classCounts[cls.id] ?? null}
                    />
                  ))}
                </View>
              </ScrollView>
            </>
          )}

          {/* ── No classes empty state ── */}
          {classes.length === 0 && !loading && (
            <View style={{
              alignItems:'center', paddingVertical:48,
              backgroundColor:T.surface, borderRadius:T.radius.xl,
              borderWidth:1, borderColor:T.border, borderStyle:'dashed', marginBottom:16,
            }}>
              <View style={{ width:56, height:56, borderRadius:16, backgroundColor:T.indigoLt, alignItems:'center', justifyContent:'center', marginBottom:12 }}>
                <Feather name="calendar" size={24} color={T.indigo} />
              </View>
              <Text style={{ fontSize:15, fontWeight:'700', color:T.textPri }}>No classes assigned</Text>
              <Text style={{ fontSize:13, color:T.textSec, marginTop:4 }}>Contact admin to get classes assigned</Text>
            </View>
          )}

          {/* ── Search Bar ── */}
          {selectedClass && (
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: T.surface, borderRadius: T.radius.lg,
              borderWidth: 1, borderColor: T.border,
              paddingHorizontal: 14, marginBottom: 14,
              ...T.shadow.sm,
            }}>
              <Feather name="search" size={16} color={T.textSec} style={{ marginRight: 10 }} />
              <TextInput
                style={{ flex: 1, paddingVertical: 13, fontSize: 14, color: T.textPri }}
                placeholder="Search by name or roll number…"
                placeholderTextColor={T.textMut}
                value={search}
                onChangeText={setSearch}
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <View style={{ backgroundColor: T.slateLt, borderRadius:99, padding:4 }}>
                    <Feather name="x" size={13} color={T.textSec} />
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {/* ── Filter Pills (NEW) ── */}
          {selectedClass && !loading && totalCount > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection:'row' }}>
                <FilterPill
                  label="All" count={totalCount}
                  isActive={activeFilter === 'all'}
                  onPress={() => setActiveFilter('all')}
                  color={T.indigo} lightColor={T.indigoLt}
                />
                <FilterPill
                  label="Face Reg." count={faceCount}
                  isActive={activeFilter === 'face'}
                  onPress={() => setActiveFilter('face')}
                  color={T.green} lightColor={T.greenLt}
                />
                <FilterPill
                  label="Pending" count={pendingCount}
                  isActive={activeFilter === 'pending'}
                  onPress={() => setActiveFilter('pending')}
                  color={T.amber} lightColor={T.amberLt}
                />
              </View>
            </ScrollView>
          )}

          {/* ── Content ── */}
          {loading ? (
            <View>
              {[0,1,2].map(i => (
                <SkeletonBox key={i} width="100%" height={76} radius={T.radius.lg} style={{ marginBottom: 10 }} />
              ))}
            </View>
          ) : !selectedClass ? (
            <EmptyState icon="👥" title="No class selected" message="Select a class above to view students" />
          ) : filtered.length === 0 ? (
            <View style={{
              alignItems: 'center', paddingVertical: 44,
              backgroundColor: T.surface, borderRadius: T.radius.xl,
              borderWidth: 1, borderColor: T.border, borderStyle: 'dashed',
            }}>
              <View style={{ width:52, height:52, borderRadius:14, backgroundColor:T.indigoLt, alignItems:'center', justifyContent:'center', marginBottom:10 }}>
                <Feather name={search ? 'search' : 'filter'} size={22} color={T.indigo} />
              </View>
              <Text style={{ fontSize:14, fontWeight:'700', color:T.textSec }}>
                {search ? 'No students match' : `No ${activeFilter === 'face' ? 'registered' : 'pending'} students`}
              </Text>
              {activeFilter !== 'all' && (
                <TouchableOpacity onPress={() => setActiveFilter('all')} style={{ marginTop:10 }}>
                  <Text style={{ fontSize:13, color:T.indigo, fontWeight:'600' }}>Clear filter</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              <Text style={{ fontSize: 12, fontWeight: '700', color: T.textSec, letterSpacing: 0.5, marginBottom: 12 }}>
                {filtered.length} student{filtered.length !== 1 ? 's' : ''}{search ? ' found' : activeFilter !== 'all' ? ` (${activeFilter === 'face' ? 'face registered' : 'pending'})` : ''}
              </Text>
              {filtered.map((student, idx) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  index={idx}
                  registered={hasFaceRegistered(student)}
                />
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TeacherMyStudentsScreen;
