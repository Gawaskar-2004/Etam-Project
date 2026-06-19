/**
 * AppNavigation.jsx — Fixed: no duplicate back buttons
 *
 * Root cause: showSubHeader was true for ALL sub-screens (stack.length > 1),
 * but many screens already render their own back button inside their hero
 * gradient header.
 *
 * Fix: SCREENS_WITH_OWN_BACK — a set of screen names that have a built-in back
 * button in their own UI. For these, the nav-shell back header is suppressed.
 * The onBack prop still fires correctly from the screen's own button.
 */

import React, {
  useState, useCallback, useRef, useEffect,
  createContext, useContext, useMemo,
} from 'react';
import {
  View, Text, TouchableOpacity, SafeAreaView, StatusBar,
  Animated, Platform, BackHandler, Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';

import SplashScreen          from '../screens/SplashScreen';
import LoginScreen           from '../screens/LoginScreen';
import ProfileScreen         from '../screens/ProfileScreen';

import TeacherDashboard              from '../screens/teacher/TeacherDashboard';
import TeacherTimetableScreen        from '../screens/teacher/TeacherTimetableScreen';
import TeacherReportsScreen          from '../screens/teacher/TeacherReportsScreen';
import AttendanceSelectScreen        from '../screens/teacher/AttendanceSelectScreen';
import TeacherFaceAttendanceScreen   from '../screens/teacher/TeacherFaceAttendanceScreen';
import TeacherFaceRegistrationScreen from '../screens/teacher/TeacherFaceRegistrationScreen';
import TeacherMarkAttendanceScreen   from '../screens/teacher/TeacherMarkAttendanceScreen';
import TeacherMyStudentsScreen       from '../screens/teacher/TeacherMyStudentsScreen';
import TeacherLiveAttendanceScreen   from '../screens/teacher/TeacherLiveAttendanceScreen';
import TeacherPerformanceScreen      from '../screens/teacher/TeacherPerformanceScreen';
import TeacherLeaveManagementScreen  from '../screens/teacher/TeacherLeaveManagementScreen';

import StudentDashboard          from '../screens/student/StudentDashboard';
import StudentMyAttendanceScreen from '../screens/student/StudentMyAttendanceScreen';
import StudentTimetableScreen    from '../screens/student/StudentTimetableScreen';
import StudentLeaveScreen        from '../screens/student/StudentLeaveScreen';

// ─── Shared role utility ──────────────────────────────────────────────────────
export const isTeacherRole = (role) =>
  ['teacher', 'staff', 'coordinator'].includes(role);

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
  amber:   '#D97706',
  red:     '#EF4444',
  slateLt: '#F1F5F9',
  radius:  { sm:8, md:12, lg:16, xl:20, pill:999 },
  shadow:  {
    sm: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:6,  elevation:2 },
    md: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:4}, shadowOpacity:0.10, shadowRadius:12, elevation:4 },
    lg: { shadowColor:'#4F46E5', shadowOffset:{width:0,height:8}, shadowOpacity:0.14, shadowRadius:20, elevation:8 },
  },
};

const SCREEN_W        = Dimensions.get('window').width;
const STACK_MAX_DEPTH = 10;
const PUSH_DURATION   = 280;
const POP_DURATION    = 240;
const TAB_DURATION    = 180;

// ─── Tab root screens ─────────────────────────────────────────────────────────
const TAB_SCREENS = new Set([
  'dashboard',
  'attendance',
  'teacherFaceRegistration',
  'profile',
  'myAttendance',
  
]);

// ─── THE KEY FIX ─────────────────────────────────────────────────────────────
// Every screen listed here has its OWN back button rendered inside its UI
// (usually inside a LinearGradient hero header).
// The nav shell will NOT add a second back header for any of these screens.
// They all receive the onBack prop and call it from their own button.
const SCREENS_WITH_OWN_BACK = new Set([
  // ── Teacher screens ──
  'teacherMyStudents',
  'teacherPerformance',
  'teacherMarkAttendance',
  'teacherFaceAttendance',
  'teacherLiveAttendance',
  'teacherReports',
  'teacherTimetable',
  'teacherLeaveManagement',  // ← now has own back button
  // ── Student screens ──
  'studentLeave',            // ← now has own back button
  'myAttendance', 
  'studentTimetable',           // ← StudentMyAttendanceScreen has own back button
]);

// ─── Titles for plain screens that use the nav-shell back header ──────────────
// Only screens NOT in TAB_SCREENS and NOT in SCREENS_WITH_OWN_BACK will get
// this header automatically. Add entries here for any future plain screens
// that don't have a built-in back button.
const SCREEN_TITLES = {
  // all current sub-screens now have their own back buttons,
  // so this map is empty — keep it here for future plain screens.
};

// ─── Initial stacks ───────────────────────────────────────────────────────────
const INITIAL_STACKS = {
  dashboard:               [{ screen:'dashboard',               params:{} }],
  attendance:              [{ screen:'attendance',              params:{} }],
  teacherFaceRegistration: [{ screen:'teacherFaceRegistration', params:{} }],
  profile:                 [{ screen:'profile',                 params:{} }],
  myAttendance:            [{ screen:'myAttendance',            params:{} }],
  studentTimetable:        [{ screen:'studentTimetable',        params:{} }],
};

// ─── Contexts ─────────────────────────────────────────────────────────────────
const NavParamsContext   = createContext({});
export const useNavParams = () => useContext(NavParamsContext);
export const navigationRef = { navigate: null, goBack: null };

const ScrollToTopContext = createContext({ register: () => {}, scrollToTop: () => {} });
export const useScrollToTop = (scrollRef) => {
  const { register } = useContext(ScrollToTopContext);
  useEffect(() => {
    register(scrollRef);
    return () => register(null);
  }, []);
};

// ─── Tab Bar Item ─────────────────────────────────────────────────────────────
const TabBarItem = ({ tab, isActive, onPress }) => {
  const scaleAnim   = useRef(new Animated.Value(1)).current;
  const pillScale   = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  const pillOpacity = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(pillScale,   { toValue: isActive ? 1 : 0, useNativeDriver:true, tension:200, friction:14 }),
      Animated.timing(pillOpacity, { toValue: isActive ? 1 : 0, duration:160, useNativeDriver:true }),
    ]).start();
  }, [isActive]);

  const handlePressIn  = () => Animated.spring(scaleAnim, { toValue:0.88, useNativeDriver:true, tension:300, friction:10 }).start();
  const handlePressOut = () => Animated.spring(scaleAnim, { toValue:1,    useNativeDriver:true, tension:300, friction:10 }).start();

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={{ flex:1, alignItems:'center', justifyContent:'center', paddingVertical:6 }}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={tab.label}
    >
      <Animated.View style={{ transform:[{ scale:scaleAnim }], alignItems:'center' }}>
        <View style={{ position:'relative', alignItems:'center', justifyContent:'center', height:34 }}>
          <Animated.View style={{
            position:'absolute',
            width:64, height:30, borderRadius:15,
            backgroundColor:T.indigoLt,
            opacity:pillOpacity,
            transform:[{ scaleX:pillScale }],
          }} />
          <View style={{ zIndex:1 }}>{tab.icon(isActive)}</View>
          {tab.badge != null && (
            <View style={{
              position:'absolute', top:0, right: tab.badge === true ? 4 : 0,
              minWidth: tab.badge === true ? 8 : 16,
              height: tab.badge === true ? 8 : 16,
              borderRadius:8, backgroundColor:T.red,
              alignItems:'center', justifyContent:'center',
              borderWidth:1.5, borderColor:T.surface,
            }}>
              {tab.badge !== true && (
                <Text style={{ fontSize:9, color:'#fff', fontWeight:'800', paddingHorizontal:2 }}>
                  {tab.badge > 99 ? '99+' : tab.badge}
                </Text>
              )}
            </View>
          )}
        </View>
        <Text style={{
          fontSize:10, fontWeight: isActive ? '700' : '500',
          color: isActive ? T.indigo : T.textMut,
          marginTop:1, letterSpacing:0.2,
        }}>
          {tab.label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─── Animated Screen ──────────────────────────────────────────────────────────
const AnimatedScreen = ({ children, animType }) => {
  const { translateX, opacity } = useMemo(() => ({
    translateX: new Animated.Value(
      animType === 'push' ? SCREEN_W : animType === 'pop' ? -SCREEN_W * 0.3 : 0
    ),
    opacity: new Animated.Value(animType === 'tab' ? 0 : 1),
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (animType === 'push' || animType === 'pop') {
      Animated.spring(translateX, { toValue:0, useNativeDriver:true, tension:180, friction:20 }).start();
    } else if (animType === 'tab') {
      Animated.timing(opacity, { toValue:1, duration:TAB_DURATION, useNativeDriver:true }).start();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={{ flex:1, transform:[{ translateX }], opacity }}>
      {children}
    </Animated.View>
  );
};

// ─── Inner Navigator ──────────────────────────────────────────────────────────
function AppNavigationInner() {
  const { user, token, loading, loginWithToken, logout } = useAuth();
  const insets = useSafeAreaInsets();

  const [tabStacks, setTabStacks] = useState(INITIAL_STACKS);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [animType,  setAnimType]  = useState('tab');

  const tabStacksRef = useRef(INITIAL_STACKS);
  const activeTabRef = useRef('dashboard');
  const isNavigating    = useRef(false);
  const activeScrollRef = useRef(null);
  const backHandlerRef  = useRef(null);

  useEffect(() => { tabStacksRef.current = tabStacks; }, [tabStacks]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  // ── Current screen ────────────────────────────────────────────────────────
  const currentStack  = tabStacks[activeTab] ?? INITIAL_STACKS.dashboard;
  const currentEntry  = currentStack[currentStack.length - 1] ?? { screen:'dashboard', params:{} };
  const currentScreen = currentEntry.screen;
  const currentParams = currentEntry.params ?? {};
  const screenKey     = `${activeTab}::${currentScreen}`;

  // ── Back header decision ──────────────────────────────────────────────────
  // Nav-shell back header only shows if:
  //   1. We are on a sub-screen (stack depth > 1), AND
  //   2. The current screen does NOT have its own back button
  const isSubScreen       = currentStack.length > 1;
  const hasOwnBack        = SCREENS_WITH_OWN_BACK.has(currentScreen);
  const showNavBackHeader = isSubScreen && !hasOwnBack;

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    setActiveTab('dashboard');
    activeTabRef.current = 'dashboard';
    await logout();
    setTabStacks(INITIAL_STACKS);
    tabStacksRef.current = INITIAL_STACKS;
  }, [logout]);

  // ── Navigate ──────────────────────────────────────────────────────────────
  const navigateTo = useCallback((screen, params = {}) => {
    if (isNavigating.current) return;
    const tab = activeTabRef.current;
    setTabStacks(prev => {
      const stack = prev[tab] ?? [];
      const last  = stack[stack.length - 1];
      if (last?.screen === screen) return prev;
      const trimmed = stack.length >= STACK_MAX_DEPTH
        ? stack.slice(stack.length - STACK_MAX_DEPTH + 1) : stack;
      return { ...prev, [tab]: [...trimmed, { screen, params }] };
    });
    setAnimType('push');
    isNavigating.current = true;
    setTimeout(() => { isNavigating.current = false; }, PUSH_DURATION + 120);
  }, []);

  // ── Back ──────────────────────────────────────────────────────────────────
  const navigateBack = useCallback(() => {
    if (isNavigating.current) return;
    const tab   = activeTabRef.current;
    const stack = tabStacksRef.current[tab] ?? [];
    if (stack.length <= 1) return;
    setTabStacks(prev => {
      const s = prev[tab] ?? [];
      if (s.length <= 1) return prev;
      return { ...prev, [tab]: s.slice(0, -1) };
    });
    setAnimType('pop');
    isNavigating.current = true;
    setTimeout(() => { isNavigating.current = false; }, POP_DURATION + 120);
  }, []);

  // ── Tab switch ────────────────────────────────────────────────────────────
  const navigateToTab = useCallback((tabId) => {
    if (tabId === activeTabRef.current) {
      try {
        if (activeScrollRef.current?.scrollTo)
          activeScrollRef.current.scrollTo({ y:0, animated:true });
        else if (activeScrollRef.current?.scrollToOffset)
          activeScrollRef.current.scrollToOffset({ offset:0, animated:true });
      } catch (_) {}
      return;
    }
    setActiveTab(tabId);
    activeTabRef.current = tabId;
    setAnimType('tab');
  }, []);

  // ── Global nav ref ────────────────────────────────────────────────────────
  useEffect(() => {
    navigationRef.navigate = navigateTo;
    navigationRef.goBack   = navigateBack;
  }, [navigateTo, navigateBack]);

  // ── Android back handler ──────────────────────────────────────────────────
  useEffect(() => {
    backHandlerRef.current = () => {
      if (isNavigating.current) return true;
      const stack = tabStacksRef.current[activeTabRef.current] ?? [];
      if (stack.length > 1) { navigateBack(); return true; }
      return false;
    };
  });

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () =>
      backHandlerRef.current?.() ?? false
    );
    return () => sub.remove();
  }, []);

  // ── Scroll-to-top ─────────────────────────────────────────────────────────
  const scrollToTopValue = useMemo(() => ({
    register:    (ref) => { activeScrollRef.current = ref; },
    scrollToTop: () => {
      try {
        if (activeScrollRef.current?.scrollTo)
          activeScrollRef.current.scrollTo({ y:0, animated:true });
        else if (activeScrollRef.current?.scrollToOffset)
          activeScrollRef.current.scrollToOffset({ offset:0, animated:true });
      } catch (_) {}
    },
  }), []);

  // ── Auth guard ────────────────────────────────────────────────────────────
  if (loading || (token && !user)) return <SplashScreen />;
  if (!token) return <LoginScreen onLogin={loginWithToken} />;

  const isTeacher = isTeacherRole(user?.role);

  // ── Screen renderer ───────────────────────────────────────────────────────
  const renderScreen = () => {
    const p = { token, user, onNavigate: navigateTo, onBack: navigateBack };
    switch (currentScreen) {
      case 'profile':                  return <ProfileScreen                {...p} onLogout={handleLogout} />;
      case 'dashboard':                return isTeacher ? <TeacherDashboard {...p} /> : <StudentDashboard {...p} />;
      case 'attendance':               return <AttendanceSelectScreen        {...p} />;
      case 'teacherFaceAttendance':    return <TeacherFaceAttendanceScreen   {...p} />;
      case 'teacherFaceRegistration':  return <TeacherFaceRegistrationScreen {...p} />;
      case 'teacherMarkAttendance':    return <TeacherMarkAttendanceScreen   {...p} />;
      case 'teacherMyStudents':        return <TeacherMyStudentsScreen       {...p} />;
      case 'teacherReports':           return <TeacherReportsScreen          {...p} />;
      case 'teacherTimetable':         return <TeacherTimetableScreen        {...p} />;
      case 'teacherLiveAttendance':    return <TeacherLiveAttendanceScreen   {...p} />;
      case 'teacherPerformance':       return <TeacherPerformanceScreen      {...p} />;
      case 'teacherLeaveManagement':   return <TeacherLeaveManagementScreen  {...p} />;
      case 'myAttendance':             return <StudentMyAttendanceScreen     {...p} />;
      case 'studentTimetable':         return <StudentTimetableScreen        {...p} />;
      case 'studentLeave':             return <StudentLeaveScreen            {...p} />;
      default: return isTeacher ? <TeacherDashboard {...p} /> : <StudentDashboard {...p} />;
    }
  };

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const teacherTabs = [
    { id:'dashboard',               label:'Home',       badge:null, icon:(a) => <Ionicons name={a?'home':'home-outline'} size={22} color={a?T.indigo:T.textMut} /> },
    { id:'attendance',              label:'Attendance', badge:null, icon:(a) => <Ionicons name={a?'checkmark-circle':'checkmark-circle-outline'} size={22} color={a?T.indigo:T.textMut} /> },
    { id:'teacherFaceRegistration', label:'Register',   badge:null, icon:(a) => <MaterialCommunityIcons name="face-recognition" size={22} color={a?T.indigo:T.textMut} /> },
    { id:'profile',                 label:'Profile',    badge:null, icon:(a) => <Ionicons name={a?'person':'person-outline'} size={22} color={a?T.indigo:T.textMut} /> },
  ];

  const studentTabs = [
    { id:'dashboard',        label:'Home',     badge:null, icon:(a) => <Ionicons name={a?'home':'home-outline'} size={22} color={a?T.indigo:T.textMut} /> },
    { id:'myAttendance',     label:'Stats',    badge:null, icon:(a) => <Ionicons name={a?'bar-chart':'bar-chart-outline'} size={22} color={a?T.indigo:T.textMut} /> },
    { id:'studentTimetable', label:'Schedule', badge:null, icon:(a) => <Ionicons name={a?'calendar':'calendar-outline'} size={22} color={a?T.indigo:T.textMut} /> },
    { id:'profile',          label:'Profile',  badge:null, icon:(a) => <Ionicons name={a?'person':'person-outline'} size={22} color={a?T.indigo:T.textMut} /> },
  ];

  const tabs = isTeacher ? teacherTabs : studentTabs;
  const tabBarBottom = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'ios' ? 16 : 8);

  return (
    <ScrollToTopContext.Provider value={scrollToTopValue}>
      <NavParamsContext.Provider value={currentParams}>
        <SafeAreaView style={{ flex:1, backgroundColor:T.bg }} edges={['top','left','right']}>
          <StatusBar barStyle="dark-content" backgroundColor={T.bg} />

          <KeyboardAvoidingView
            style={{ flex:1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
            {/*
              Nav-shell back header — ONLY renders for plain screens
              that don't have a built-in back button in their own UI.
              All current sub-screens are in SCREENS_WITH_OWN_BACK,
              so this header is suppressed for all of them.
              Keep this block for any future plain screens added to SCREEN_TITLES.
            */}
            {showNavBackHeader && (
              <View style={{
                flexDirection:'row', alignItems:'center',
                paddingHorizontal:16, paddingVertical:10,
                backgroundColor:T.surface,
                borderBottomWidth:0.5, borderBottomColor:T.border,
                ...T.shadow.sm,
              }}>
                <TouchableOpacity
                  onPress={navigateBack}
                  hitSlop={{ top:12, bottom:12, left:12, right:12 }}
                  style={{
                    width:36, height:36, borderRadius:11,
                    backgroundColor:T.indigoLt,
                    alignItems:'center', justifyContent:'center', marginRight:12,
                  }}
                >
                  <Ionicons name="arrow-back" size={20} color={T.indigo} />
                </TouchableOpacity>
                <Text style={{ fontSize:17, fontWeight:'800', color:T.textPri, letterSpacing:-0.3 }}>
                  {SCREEN_TITLES[currentScreen] ?? 'Back'}
                </Text>
              </View>
            )}

            <View style={{ flex:1, overflow:'hidden' }}>
              <AnimatedScreen key={screenKey} animType={animType}>
                {renderScreen()}
              </AnimatedScreen>
            </View>
          </KeyboardAvoidingView>

          {/* Tab bar — always visible, outside KeyboardAvoidingView */}
          <View style={{
            backgroundColor:T.surface,
            borderTopWidth:0.5, borderTopColor:T.border,
            paddingBottom:tabBarBottom, paddingTop:6,
            flexDirection:'row',
            shadowColor:'#1E1B4B',
            shadowOffset:{ width:0, height:-3 },
            shadowOpacity:0.07, shadowRadius:12, elevation:12,
          }}>
            {tabs.map((tab) => (
              <TabBarItem
                key={tab.id}
                tab={tab}
                isActive={activeTab === tab.id}
                onPress={() => navigateToTab(tab.id)}
              />
            ))}
          </View>
        </SafeAreaView>
      </NavParamsContext.Provider>
    </ScrollToTopContext.Provider>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────
export default function AppNavigation() {
  return (
    <SafeAreaProvider>
      <AppNavigationInner />
    </SafeAreaProvider>
  );
}

/**
 * ─── ADDING NEW SCREENS ───────────────────────────────────────────────────────
 *
 * Screen WITH its own back button (hero header etc.):
 *   1. Add to SCREENS_WITH_OWN_BACK set
 *   2. Wire your back button: onPress={() => onBack()}
 *   → Nav shell adds nothing extra
 *
 * Plain screen with NO built-in back button:
 *   1. Add title to SCREEN_TITLES map
 *   2. Add to renderScreen() switch
 *   → Nav shell auto-adds the back header
 *
 * Navigate from any screen:
 *   onNavigate('teacherLeaveManagement')   ← teacher leave
 *   onNavigate('studentLeave')             ← student leave
 *
 * Read params inside a screen:
 *   import { useNavParams } from '../navigation/AppNavigation';
 *   const { param } = useNavParams();
 */