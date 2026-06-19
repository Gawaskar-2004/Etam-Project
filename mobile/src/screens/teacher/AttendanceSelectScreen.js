import React, { useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, SafeAreaView, StatusBar,
  Platform, Animated, ScrollView, InteractionManager,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Design tokens (matches TeacherMarkAttendanceScreen & TeacherTimetableScreen) ──
const T = {
  indigo:  '#4F46E5',
  indigoLt:'#EEF2FF',
  amber:   '#D97706',
  amberLt: '#FFFBEB',
  textPri: '#0D1B3E',
  textSec: '#5A6A8A',
  border:  '#E8EEFF',
  surface: '#FFFFFF',
  radius:  { sm:8, md:12, lg:16, xl:20, pill:999 },
  shadow: {
    sm: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:6,  elevation:2 },
    md: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:4}, shadowOpacity:0.10, shadowRadius:12, elevation:4 },
  },
};

// ─── Animated method card ─────────────────────────────────────────────────────
const MethodCard = ({
  onPress,
  accentColors,
  borderColor,
  iconBg,
  iconColor,
  iconName,
  iconLib = 'mci',
  title,
  subtitle,
  tagLabel,
  tagBg,
  tagColor,
  chevronBg,
  chevronColor,
  delay = 0,
}) => {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const transY  = useRef(new Animated.Value(20)).current;

  // ─── FIX: navLock prevents the same Android spurious-BackHandler race
  // condition that affected TeacherMarkAttendanceScreen. When the user taps
  // a MethodCard, Android can fire a back event during the onPressIn
  // animation frame. We lock for 300ms so the parent's onBack is blocked
  // long enough for the navigation to commit.
  const navLock      = useRef(false);
  const navLockTimer = useRef(null);

  const acquireNavLock = useCallback(() => {
    navLock.current = true;
    if (navLockTimer.current) clearTimeout(navLockTimer.current);
    navLockTimer.current = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        navLock.current = false;
      });
    }, 300);
  }, []);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue:1, duration:350, delay, useNativeDriver:true }),
      Animated.timing(transY,  { toValue:0, duration:350, delay, useNativeDriver:true }),
    ]).start();
    return () => {
      if (navLockTimer.current) clearTimeout(navLockTimer.current);
    };
  }, []);

  const handleIn  = () => Animated.spring(scale, { toValue:0.96, useNativeDriver:true }).start();
  const handleOut = () => Animated.spring(scale, { toValue:1,    useNativeDriver:true }).start();

  const handlePress = useCallback(() => {
    acquireNavLock();
    onPress();
  }, [onPress, acquireNavLock]);

  return (
    <Animated.View style={{ transform:[{scale}], opacity, translateY: transY }}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handleIn}
        onPressOut={handleOut}
        activeOpacity={1}
        style={{
          backgroundColor: T.surface,
          borderRadius: T.radius.xl,
          borderWidth: 0.5,
          borderColor,
          marginBottom: 12,
          overflow: 'hidden',
          ...T.shadow.sm,
        }}
      >
        {/* Colour accent stripe at top */}
        <LinearGradient
          colors={accentColors}
          start={{ x:0, y:0 }} end={{ x:1, y:0 }}
          style={{ height: 4, width: '100%' }}
        />

        <View style={{ flexDirection:'row', alignItems:'center', padding:16 }}>
          {/* Icon box */}
          <View style={{
            width: 54, height: 54, borderRadius: 14,
            backgroundColor: iconBg,
            alignItems: 'center', justifyContent: 'center',
            marginRight: 14,
          }}>
            {iconLib === 'mci'
              ? <MaterialCommunityIcons name={iconName} size={26} color={iconColor} />
              : <Ionicons name={iconName} size={26} color={iconColor} />
            }
          </View>

          {/* Text */}
          <View style={{ flex:1, minWidth:0 }}>
            <Text style={{ fontSize:15, fontWeight:'700', color:T.textPri, marginBottom:3 }}>
              {title}
            </Text>
            <Text style={{ fontSize:12, color:T.textSec, lineHeight:17 }}>
              {subtitle}
            </Text>
            {tagLabel && (
              <View style={{
                alignSelf:'flex-start',
                backgroundColor: tagBg,
                borderRadius: T.radius.sm,
                paddingHorizontal: 8, paddingVertical: 3,
                marginTop: 7,
              }}>
                <Text style={{ fontSize:10, fontWeight:'700', color:tagColor }}>
                  {tagLabel}
                </Text>
              </View>
            )}
          </View>

          {/* Chevron */}
          <View style={{
            width:30, height:30, borderRadius:9,
            backgroundColor: chevronBg,
            alignItems:'center', justifyContent:'center',
            marginLeft:10,
          }}>
            <Ionicons name="chevron-forward" size={14} color={chevronColor} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ==================== MAIN SCREEN ====================
const AttendanceSelectScreen = ({
  token,
  user,
  onNavigate,
  onBack,        // ← FIX: accept onBack from AppNavigation (was previously ignored)
  navigation,
}) => {

  // ─── FIX: navigate() now uses onNavigate only for forward navigation.
  // The old code called onNavigate('back') which pushed the literal string
  // 'back' onto navStack, causing AppNavigation to render the default/fallback
  // dashboard. Now forward navigation and back navigation are separate concerns.
  const navigate = useCallback((screen) => {
    if (onNavigate) {
      onNavigate(screen);
      return;
    }
    // Fallback for react-navigation stack usage
    const screenMap = {
      teacherFaceAttendance: 'TeacherFaceAttendance',
      teacherMarkAttendance: 'TeacherMarkAttendance',
    };
    navigation?.navigate(screenMap[screen] || screen);
  }, [onNavigate, navigation]);

  // ─── FIX: handleBack now uses the onBack prop (AppNavigation.navigateBack)
  // instead of calling onNavigate('back'). This correctly pops the screen
  // off navStack rather than pushing 'back' as a new screen name.
  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    // Fallback for react-navigation stack usage
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation?.navigate?.('Home');
    }
  }, [onBack, navigation]);

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:'#F0F4FF' }}>
      <StatusBar barStyle="light-content" backgroundColor="#1E1B4B" />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Hero Header ── */}
        <LinearGradient
          colors={['#1E1B4B', '#3730A3', '#4F46E5']}
          start={{ x:0, y:0 }} end={{ x:1, y:1 }}
          style={{
            paddingTop: Platform.OS === 'ios' ? 55 : 45,
            paddingBottom: 28,
            paddingHorizontal: 20,
            overflow: 'hidden',
          }}
        >
          {/* Decorative rings */}
          <View style={{ position:'absolute', top:-40, right:-40, width:160, height:160, borderRadius:80, borderWidth:1, borderColor:'rgba(255,255,255,0.06)' }} />
          <View style={{ position:'absolute', top:16, right:24, width:90, height:90, borderRadius:45, borderWidth:1, borderColor:'rgba(255,255,255,0.06)' }} />
          <View style={{ position:'absolute', bottom:-30, left:-16, width:110, height:110, borderRadius:55, backgroundColor:'rgba(255,255,255,0.04)' }} />

          {/* Icon in top-right */}
          <View style={{
            position:'absolute',
            top: Platform.OS === 'ios' ? 55 : 45,
            right: 20,
            width:56, height:56, borderRadius:16,
            backgroundColor:'rgba(255,255,255,0.14)',
            alignItems:'center', justifyContent:'center',
          }}>
            <MaterialCommunityIcons name="clipboard-check-outline" size={26} color="#fff" />
          </View>

          {/* ─── FIX: Back button now calls handleBack (uses onBack prop) ─── */}
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.75}
            style={{
              flexDirection:'row', alignItems:'center', gap:6,
              alignSelf:'flex-start', marginBottom:20,
              backgroundColor:'rgba(255,255,255,0.12)',
              borderRadius:T.radius.pill, paddingHorizontal:14, paddingVertical:7,
              borderWidth:1, borderColor:'rgba(255,255,255,0.18)',
            }}
          >
            <Ionicons name="arrow-back" size={16} color="#fff" />
            <Text style={{ fontSize:13, fontWeight:'700', color:'#fff' }}>Back</Text>
          </TouchableOpacity>

          <Text style={{
            fontSize:11, color:'rgba(255,255,255,0.6)',
            fontWeight:'700', letterSpacing:1.5, textTransform:'uppercase', marginBottom:6,
          }}>
            Attendance
          </Text>
          <Text style={{ fontSize:28, fontWeight:'900', color:'#fff', letterSpacing:-0.4, lineHeight:34 }}>
            Choose method
          </Text>
        </LinearGradient>

        {/* ── Body ── */}
        <View style={{ paddingHorizontal:16, paddingTop:20, paddingBottom:36 }}>

          <Text style={{
            fontSize:11, fontWeight:'700', color:T.textSec,
            letterSpacing:0.8, textTransform:'uppercase', marginBottom:14,
          }}>
            Available methods
          </Text>

          {/* Face Attendance */}
          <MethodCard
            onPress={() => navigate('teacherFaceAttendance')}
            accentColors={[T.indigo, '#7C3AED']}
            borderColor="#C7D2FE"
            iconBg={T.indigoLt}
            iconColor={T.indigo}
            iconName="face-recognition"
            iconLib="mci"
            title="Face attendance"
            subtitle="Scan faces with camera · Fast & contactless"
            tagLabel="Recommended"
            tagBg={T.indigoLt}
            tagColor="#4338CA"
            chevronBg={T.indigoLt}
            chevronColor={T.indigo}
            delay={0}
          />

          {/* Manual Attendance */}
          <MethodCard
            onPress={() => navigate('teacherMarkAttendance')}
            accentColors={[T.amber, '#F59E0B']}
            borderColor="#FDE68A"
            iconBg={T.amberLt}
            iconColor={T.amber}
            iconName="clipboard-list-outline"
            iconLib="mci"
            title="Manual attendance"
            subtitle="Mark from student list · Period-wise"
            tagLabel="Step-by-step"
            tagBg="#FEF3C7"
            tagColor="#92400E"
            chevronBg="#FEF3C7"
            chevronColor={T.amber}
            delay={80}
          />

        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AttendanceSelectScreen;