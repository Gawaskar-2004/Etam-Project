import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, ScrollView,
  SafeAreaView, Platform, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { C, DAYS } from '../../config/constants';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatTime, getClassName } from '../../utils/helpers';

// ─── Design Tokens ───────────────────────────────────────────────────────────
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkeletonBox({ width, height, radius = 8, style }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue:1,   duration:900, useNativeDriver:true }),
      Animated.timing(anim, { toValue:0.4, duration:900, useNativeDriver:true }),
    ])).start();
  }, []);
  return <Animated.View style={[{ width, height, borderRadius:radius, backgroundColor:'#E2E8F0', opacity:anim }, style]} />;
}

function DayTab({ day, isActive, isToday, count, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const handleIn  = () => Animated.spring(scale, { toValue:0.93, useNativeDriver:true }).start();
  const handleOut = () => Animated.spring(scale, { toValue:1,    useNativeDriver:true }).start();

  return (
    <Animated.View style={{ transform:[{scale}] }}>
      <TouchableOpacity
        onPress={onPress} onPressIn={handleIn} onPressOut={handleOut}
        activeOpacity={0.9}
        style={{
          alignItems:'center', paddingHorizontal:14, paddingVertical:10,
          borderRadius:T.radius.lg, minWidth:58,
          backgroundColor: isActive ? T.indigo : T.surface,
          borderWidth: isToday && !isActive ? 2 : 1,
          borderColor: isActive ? T.indigo : isToday ? T.indigo : T.border,
          ...(isActive ? T.shadow.md : T.shadow.sm),
          shadowColor: T.indigo,
        }}
      >
        <Text style={{ fontSize:12, fontWeight:'800', color:isActive?'#fff':isToday?T.indigo:T.textSec }}>
          {day}
        </Text>
        {count > 0 ? (
          <View style={{
            marginTop:5, width:20, height:20, borderRadius:10,
            backgroundColor: isActive?'rgba(255,255,255,0.25)':T.indigoLt,
            alignItems:'center', justifyContent:'center',
          }}>
            <Text style={{ fontSize:10, fontWeight:'800', color:isActive?'#fff':T.indigo }}>{count}</Text>
          </View>
        ) : (
          <View style={{ width:20, height:20, marginTop:5 }} />
        )}
        {isToday && (
          <View style={{
            width:5, height:5, borderRadius:3,
            backgroundColor: isActive?'rgba(255,255,255,0.8)':T.indigo,
            marginTop:3,
          }} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

function PeriodCard({ item, index, isCurrentPeriod }) {
  const cc = PERIOD_PALETTE[(item.period_number - 1) % PERIOD_PALETTE.length];
  const isBreak = item.is_break;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue:1, duration:350, delay:index*60, useNativeDriver:true }),
      Animated.timing(slideAnim, { toValue:0, duration:350, delay:index*60, useNativeDriver:true }),
    ]).start();
  }, []);

  const getTimeLabel = () => {
    const s = formatTime(item.start_time);
    const e = formatTime(item.end_time);
    if (s && e) return `${s} – ${e}`;
    if (s) return `From ${s}`;
    return 'Time TBD';
  };

  return (
    <Animated.View style={{ opacity:fadeAnim, transform:[{translateY:slideAnim}] }}>
      <View style={{
        backgroundColor:T.surface, borderRadius:T.radius.xl,
        marginBottom:12, overflow:'hidden',
        borderWidth: isCurrentPeriod ? 2 : 1,
        borderColor: isCurrentPeriod ? cc.accent : T.border,
        ...(isCurrentPeriod ? T.shadow.lg : T.shadow.sm),
        shadowColor: cc.accent,
      }}>
        {/* Colored left accent bar */}
        <View style={{ flexDirection:'row' }}>
          <View style={{ width:4, backgroundColor:isBreak ? T.amber : cc.accent }} />

          <View style={{ flex:1, padding:14 }}>
            {/* Current period badge */}
            {isCurrentPeriod && (
              <View style={{
                flexDirection:'row', alignItems:'center', gap:5,
                backgroundColor:cc.bg, borderRadius:T.radius.pill,
                paddingHorizontal:10, paddingVertical:4,
                borderWidth:1, borderColor:cc.border,
                alignSelf:'flex-start', marginBottom:10,
              }}>
                <View style={{ width:5, height:5, borderRadius:3, backgroundColor:cc.accent }} />
                <Text style={{ fontSize:10, fontWeight:'800', color:cc.accent, textTransform:'uppercase', letterSpacing:0.5 }}>
                  Current Period
                </Text>
              </View>
            )}

            {/* Main content row */}
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              {/* Period number badge */}
              <LinearGradient
                colors={isBreak ? ['#D97706','#B45309'] : [cc.gradStart, cc.gradEnd]}
                style={{
                  width:50, height:50, borderRadius:15,
                  alignItems:'center', justifyContent:'center', marginRight:14,
                }}
              >
                {isBreak
                  ? <Ionicons name="cafe" size={22} color="#fff" />
                  : <Text style={{ fontSize:11, fontWeight:'900', color:'#fff', letterSpacing:0.3 }}>P{item.period_number}</Text>
                }
              </LinearGradient>

              <View style={{ flex:1 }}>
                <Text style={{ fontSize:16, fontWeight:'800', color:isBreak?T.amber:T.textPri, letterSpacing:-0.2 }}>
                  {isBreak ? 'Break Time' : (item.subject_name || 'No Subject')}
                </Text>

                {/* Time chip */}
                <View style={{
                  flexDirection:'row', alignItems:'center', gap:5,
                  marginTop:5, alignSelf:'flex-start',
                  backgroundColor:cc.bg, borderRadius:T.radius.pill,
                  paddingHorizontal:9, paddingVertical:4,
                  borderWidth:1, borderColor:cc.border,
                }}>
                  <Ionicons name="time-outline" size={11} color={cc.text} />
                  <Text style={{ fontSize:12, fontWeight:'700', color:cc.text }}>{getTimeLabel()}</Text>
                </View>
              </View>

              {/* Room badge */}
              {item.room_number && (
                <View style={{
                  backgroundColor:T.indigoLt, paddingHorizontal:10, paddingVertical:6,
                  borderRadius:T.radius.md, borderWidth:1, borderColor:'#C7D2FE',
                }}>
                  <Text style={{ fontSize:10, fontWeight:'700', color:T.indigo, textTransform:'uppercase', letterSpacing:0.5 }}>
                    Rm
                  </Text>
                  <Text style={{ fontSize:13, fontWeight:'900', color:T.indigo, textAlign:'center' }}>
                    {item.room_number}
                  </Text>
                </View>
              )}
            </View>

            {/* Footer info row */}
            {!isBreak && (
              <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6, marginTop:12, paddingTop:12, borderTopWidth:1, borderTopColor:T.border }}>
                {/* Class name */}
                <View style={{
                  flexDirection:'row', alignItems:'center', gap:5,
                  backgroundColor:T.slateLt, paddingHorizontal:10, paddingVertical:5,
                  borderRadius:T.radius.pill, borderWidth:1, borderColor:T.border,
                }}>
                  <Ionicons name="people-outline" size={12} color={T.textSec} />
                  <Text style={{ fontSize:12, fontWeight:'600', color:T.textPri }}>{getClassName(item)}</Text>
                </View>

                {/* Staff */}
                {item.staff_name && (
                  <View style={{
                    flexDirection:'row', alignItems:'center', gap:5,
                    backgroundColor:T.indigoLt, paddingHorizontal:10, paddingVertical:5,
                    borderRadius:T.radius.pill, borderWidth:1, borderColor:'#C7D2FE',
                  }}>
                    <Ionicons name="person-outline" size={12} color={T.indigo} />
                    <Text style={{ fontSize:12, fontWeight:'600', color:T.indigo }}>{item.staff_name}</Text>
                  </View>
                )}

                {/* Duration if available */}
                {item.start_time && item.end_time && (
                  <View style={{
                    flexDirection:'row', alignItems:'center', gap:5,
                    backgroundColor:cc.bg, paddingHorizontal:10, paddingVertical:5,
                    borderRadius:T.radius.pill, borderWidth:1, borderColor:cc.border,
                  }}>
                    <Ionicons name="hourglass-outline" size={12} color={cc.text} />
                    <Text style={{ fontSize:12, fontWeight:'600', color:cc.text }}>
                      {(() => {
                        try {
                          const [sh,sm] = item.start_time.split(':').map(Number);
                          const [eh,em] = item.end_time.split(':').map(Number);
                          const diff = (eh*60+em)-(sh*60+sm);
                          if (diff>0) return `${diff} min`;
                        } catch {}
                        return null;
                      })()}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

const TeacherTimetableScreen = ({ token: propToken, user: propUser, onBack, navigation }) => {
  const { token: ctxToken, user: ctxUser } = useAuth();
  const token = propToken || ctxToken;
  const user  = propUser  || ctxUser;

  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selectedDay, setSelectedDay] = useState(
    DAYS[new Date().getDay() === 0 ? 0 : Math.min(new Date().getDay() - 1, 5)]
  );

  const headerFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerFade, { toValue:1, duration:500, useNativeDriver:true }).start();
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await api.get(`/timetable-assignments?user_id=${user?.id || ''}`, token);
      setAssignments(Array.isArray(data) ? data : (data?.assignments || []));
    } catch (error) {
      console.log('Timetable load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (onBack) onBack();
    else if (navigation) navigation.goBack();
  };

  const todayDay   = DAYS[Math.min(new Date().getDay()===0?6:new Date().getDay()-1, 5)];
  const items      = assignments.filter(a => a.day === selectedDay).sort((a,b) => a.period_number - b.period_number);
  const totalToday = assignments.filter(a => a.day === todayDay).length;
  const activeDays = new Set(assignments.map(a => a.day)).size;

  // Detect current period (if viewing today)
  const getCurrentPeriodIndex = () => {
    if (selectedDay !== todayDay) return -1;
    const now = new Date();
    const nowMinutes = now.getHours()*60 + now.getMinutes();
    return items.findIndex(item => {
      if (!item.start_time || !item.end_time) return false;
      try {
        const [sh,sm] = item.start_time.split(':').map(Number);
        const [eh,em] = item.end_time.split(':').map(Number);
        return nowMinutes >= sh*60+sm && nowMinutes <= eh*60+em;
      } catch { return false; }
    });
  };

  const currentPeriodIdx = getCurrentPeriodIndex();

  // Subject count for the week
  const uniqueSubjects = new Set(assignments.filter(a => !a.is_break).map(a => a.subject_name)).size;

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:T.bg }}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Hero Header ── */}
        <LinearGradient
          colors={['#1E1B4B','#3730A3','#4F46E5']}
          start={{x:0,y:0}} end={{x:1,y:1}}
          style={{ paddingTop: Platform.OS==='ios'?55:45, paddingBottom:26, paddingHorizontal:20, overflow:'hidden' }}
        >
          {/* Decorative shapes */}
          <View style={{ position:'absolute', top:-30, right:-30, width:150, height:150, borderRadius:75, borderWidth:1, borderColor:'rgba(255,255,255,0.06)' }} />
          <View style={{ position:'absolute', top:20, right:30, width:80, height:80, borderRadius:40, borderWidth:1, borderColor:'rgba(255,255,255,0.06)' }} />
          <View style={{ position:'absolute', bottom:-20, left:-10, width:100, height:100, borderRadius:50, backgroundColor:'rgba(255,255,255,0.04)' }} />

          {/* Back button */}
          {(onBack || navigation) && (
            <TouchableOpacity
              onPress={handleBack}
              style={{
                flexDirection:'row', alignItems:'center', gap:6,
                alignSelf:'flex-start', marginBottom:16,
                backgroundColor:'rgba(255,255,255,0.12)',
                borderRadius:T.radius.pill, paddingHorizontal:14, paddingVertical:7,
                borderWidth:1, borderColor:'rgba(255,255,255,0.18)',
              }}
            >
              <Ionicons name="arrow-back" size={16} color="#fff" />
              <Text style={{ fontSize:13, fontWeight:'700', color:'#fff' }}>Back</Text>
            </TouchableOpacity>
          )}

          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' }}>
            <View style={{ flex:1 }}>
              <Text style={{ fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:'700', letterSpacing:1.5, textTransform:'uppercase', marginBottom:6 }}>
                Teacher Portal
              </Text>
              <Text style={{ fontSize:28, fontWeight:'900', color:'#fff', letterSpacing:-0.5 }}>
                My Timetable
              </Text>
              <Text style={{ fontSize:13, color:'rgba(255,255,255,0.7)', marginTop:5, fontWeight:'500' }}>
                {user?.full_name ? `${user.full_name.split(' ')[0]}'s weekly schedule` : 'Your weekly schedule'}
              </Text>
            </View>
            <View style={{
              width:56, height:56, borderRadius:18,
              backgroundColor:'rgba(255,255,255,0.15)',
              alignItems:'center', justifyContent:'center',
              borderWidth:1.5, borderColor:'rgba(255,255,255,0.2)',
            }}>
              <Ionicons name="calendar" size={26} color="#fff" />
            </View>
          </View>

          {/* Stats row */}
          <View style={{ flexDirection:'row', gap:10, marginTop:18 }}>
            {[
              { label:'Today', value:totalToday, icon:'today-outline' },
              { label:'Active Days', value:activeDays, icon:'calendar-outline' },
              { label:'Subjects', value:uniqueSubjects, icon:'book-outline' },
              { label:'Total / Week', value:assignments.length, icon:'list-outline' },
            ].map((s,i) => (
              <View key={i} style={{
                flex:1, backgroundColor:'rgba(255,255,255,0.12)',
                borderRadius:T.radius.md, padding:10, alignItems:'center',
                borderWidth:1, borderColor:'rgba(255,255,255,0.1)',
              }}>
                <Text style={{ fontSize:18, fontWeight:'900', color:'#fff', letterSpacing:-0.3 }}>{s.value}</Text>
                <Text style={{ fontSize:9, color:'rgba(255,255,255,0.65)', marginTop:2, fontWeight:'600', textAlign:'center', letterSpacing:0.2 }}>
                  {s.label}
                </Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal:16, paddingBottom:36, paddingTop:20 }}>

          {/* ── Day Selector ── */}
          <View style={{ marginBottom:22 }}>
            <Text style={{ fontSize:12, fontWeight:'700', color:T.textSec, letterSpacing:0.8, textTransform:'uppercase', marginBottom:12 }}>
              Day
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection:'row', gap:8 }}>
                {DAYS.map(day => (
                  <DayTab
                    key={day}
                    day={day}
                    isActive={selectedDay === day}
                    isToday={day === todayDay}
                    count={assignments.filter(a => a.day === day).length}
                    onPress={() => setSelectedDay(day)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>

          {/* ── Day Header ── */}
          {!loading && (
            <View style={{
              flexDirection:'row', alignItems:'center', justifyContent:'space-between',
              marginBottom:16, paddingBottom:14, borderBottomWidth:1, borderBottomColor:T.border,
            }}>
              <View>
                <Text style={{ fontSize:20, fontWeight:'900', color:T.textPri, letterSpacing:-0.3 }}>
                  {selectedDay}
                  {selectedDay === todayDay && (
                    <Text style={{ fontSize:12, fontWeight:'600', color:T.indigo }}> · Today</Text>
                  )}
                </Text>
                <Text style={{ fontSize:12, color:T.textSec, marginTop:2, fontWeight:'500' }}>
                  {items.length} period{items.length!==1?'s':''} scheduled
                </Text>
              </View>
              {currentPeriodIdx >= 0 && (
                <View style={{
                  flexDirection:'row', alignItems:'center', gap:6,
                  backgroundColor:T.indigoLt, paddingHorizontal:12, paddingVertical:6,
                  borderRadius:T.radius.pill, borderWidth:1, borderColor:'#C7D2FE',
                }}>
                  <View style={{ width:6, height:6, borderRadius:3, backgroundColor:T.indigo }} />
                  <Text style={{ fontSize:11, fontWeight:'800', color:T.indigo }}>
                    P{items[currentPeriodIdx]?.period_number} Now
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Period list ── */}
          {loading ? (
            <View>
              {[0,1,2,3].map(i => (
                <View key={i} style={{ backgroundColor:T.surface, borderRadius:T.radius.xl, marginBottom:12, padding:14, borderWidth:1, borderColor:T.border }}>
                  <View style={{ flexDirection:'row', alignItems:'center' }}>
                    <SkeletonBox width={50} height={50} radius={15} style={{ marginRight:14 }} />
                    <View style={{ flex:1, gap:8 }}>
                      <SkeletonBox width="60%" height={16} radius={6} />
                      <SkeletonBox width="40%" height={13} radius={6} />
                    </View>
                  </View>
                  <View style={{ height:1, backgroundColor:T.border, marginVertical:12 }} />
                  <View style={{ flexDirection:'row', gap:8 }}>
                    <SkeletonBox width={90} height={28} radius={T.radius.pill} />
                    <SkeletonBox width={80} height={28} radius={T.radius.pill} />
                  </View>
                </View>
              ))}
            </View>
          ) : items.length === 0 ? (
            <View style={{
              backgroundColor:T.surface, borderRadius:T.radius.xl,
              padding:44, alignItems:'center',
              borderWidth:1.5, borderColor:T.border, borderStyle:'dashed',
            }}>
              <View style={{ width:68, height:68, borderRadius:22, backgroundColor:T.indigoLt, alignItems:'center', justifyContent:'center', marginBottom:14 }}>
                <Ionicons name="calendar-outline" size={32} color={T.indigo} />
              </View>
              <Text style={{ fontSize:17, fontWeight:'800', color:T.textPri }}>No Classes</Text>
              <Text style={{ fontSize:13, color:T.textSec, marginTop:5, textAlign:'center', fontWeight:'500' }}>
                No periods scheduled for {selectedDay}
              </Text>
            </View>
          ) : (
            <View>
              {items.map((item, i) => (
                <PeriodCard
                  key={i}
                  item={item}
                  index={i}
                  isCurrentPeriod={i === currentPeriodIdx}
                />
              ))}
            </View>
          )}

          {/* No assignments at all */}
          {!loading && assignments.length === 0 && (
            <View style={{
              backgroundColor:T.surface, borderRadius:T.radius.xl,
              padding:40, alignItems:'center', marginTop:8,
              borderWidth:1, borderColor:T.border, ...T.shadow.sm,
            }}>
              <View style={{ width:72, height:72, borderRadius:24, backgroundColor:T.indigoLt, alignItems:'center', justifyContent:'center', marginBottom:16 }}>
                <Ionicons name="school-outline" size={34} color={T.indigo} />
              </View>
              <Text style={{ fontSize:17, fontWeight:'800', color:T.textPri }}>No Timetable Found</Text>
              <Text style={{ fontSize:13, color:T.textSec, marginTop:6, textAlign:'center', lineHeight:20, fontWeight:'500' }}>
                Ask your admin to set up your timetable assignments
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TeacherTimetableScreen;