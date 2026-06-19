import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, ScrollView,
  SafeAreaView, Platform, Animated, Alert, Modal, Image, RefreshControl,
  AppState, BackHandler, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { C, BASE_URL } from '../../config/constants';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { hasFaceRegistered, buildClassMap } from '../../utils/helpers';
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
  indigoMd:'#E0E7FF',
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

// ─── SkeletonBox ──────────────────────────────────────────────────────────────
const SkeletonBox = ({ width, height, radius = 8, style }) => {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue:1,   duration:900, useNativeDriver:true }),
      Animated.timing(anim, { toValue:0.4, duration:900, useNativeDriver:true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={[{ width, height, borderRadius:radius, backgroundColor:'#E2E8F0', opacity:anim }, style]} />
  );
};

// ─── ClassCard (IMPROVED) ─────────────────────────────────────────────────────
const ClassCard = ({ cls, isActive, onPress, registeredCount, totalCount }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handleIn  = () => Animated.spring(scale, { toValue:0.96, useNativeDriver:true, speed:30 }).start();
  const handleOut = () => Animated.spring(scale, { toValue:1,    useNativeDriver:true, speed:30 }).start();

  const progress = totalCount > 0 ? registeredCount / totalCount : 0;
  const allDone  = totalCount > 0 && registeredCount === totalCount;

  // Derive a short department label from the class name if possible
  const deptLabel = cls.subject || cls.department || (() => {
    const n = cls.name || '';
    if (n.toLowerCase().includes('cse') || n.toLowerCase().includes('cs')) return 'Computer Science';
    if (n.toLowerCase().includes('ece')) return 'Electronics';
    if (n.toLowerCase().includes('mech')) return 'Mechanical';
    if (n.toLowerCase().includes('civil')) return 'Civil';
    if (n.toLowerCase().includes('it')) return 'Info. Technology';
    return 'Engineering';
  })();

  return (
    <Animated.View style={{ transform:[{ scale }], flex:1, minWidth:140, maxWidth:'48%' }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handleIn}
        onPressOut={handleOut}
        activeOpacity={0.92}
        style={{
          backgroundColor: isActive ? T.indigoMd : T.surface,
          borderRadius: T.radius.xl,
          borderWidth: isActive ? 1.5 : 1,
          borderColor: isActive ? T.indigo : T.border,
          padding: 14,
          ...(isActive ? T.shadow.md : T.shadow.sm),
        }}
      >
        {/* Top row: icon + text */}
        <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:12 }}>
          <View style={{
            width:40, height:40, borderRadius:12,
            backgroundColor: isActive ? T.indigo : T.indigoLt,
            alignItems:'center', justifyContent:'center',
          }}>
            <MaterialCommunityIcons
              name="school-outline"
              size={20}
              color={isActive ? '#fff' : T.indigo}
            />
          </View>
          <View style={{ flex:1 }}>
            <Text
              style={{ fontSize:13, fontWeight:'700', color: isActive ? '#3730A3' : T.textPri, lineHeight:18 }}
              numberOfLines={2}
            >
              {cls.name}
            </Text>
            <Text style={{ fontSize:11, color: isActive ? '#6366F1' : T.textSec, marginTop:1 }}>
              {deptLabel}
            </Text>
          </View>
        </View>

        {/* Progress row */}
        <View>
          {/* Progress bar */}
          <View style={{
            height:4, backgroundColor: isActive ? 'rgba(99,102,241,0.2)' : '#EEF2FF',
            borderRadius:T.radius.pill, overflow:'hidden', marginBottom:6,
          }}>
            <View style={{
              height:4,
              width:`${Math.round(progress * 100)}%`,
              backgroundColor: allDone ? T.green : T.indigo,
              borderRadius:T.radius.pill,
            }} />
          </View>

          {/* Count + status */}
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
            <Text style={{ fontSize:11, color: isActive ? '#4F46E5' : T.textSec }}>
              {totalCount > 0 ? `${registeredCount}/${totalCount} registered` : 'Tap to load'}
            </Text>
            {allDone && (
              <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
                <Feather name="check-circle" size={11} color={T.green} />
                <Text style={{ fontSize:10, fontWeight:'700', color:T.green }}>Done</Text>
              </View>
            )}
            {!allDone && totalCount > 0 && (
              <Text style={{ fontSize:10, fontWeight:'700', color: isActive ? T.indigo : T.textMut }}>
                {Math.round(progress * 100)}%
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── StudentListItem ──────────────────────────────────────────────────────────
const StudentListItem = ({ student, isSelected, isRegistered, onPress, index }) => {
  const slideAnim = useRef(new Animated.Value(20)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue:1, duration:300, delay:index * 40, useNativeDriver:true }),
      Animated.timing(slideAnim, { toValue:0, duration:300, delay:index * 40, useNativeDriver:true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity:fadeAnim, transform:[{ translateY:slideAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={{
          backgroundColor: isSelected ? T.indigoLt : isRegistered ? T.greenLt : T.surface,
          borderRadius: T.radius.lg,
          marginBottom:10, padding:12,
          borderWidth: isSelected ? 2 : 1,
          borderColor: isSelected ? T.indigo : isRegistered ? T.green : T.border,
          ...T.shadow.sm,
        }}
      >
        <View style={{ flexDirection:'row', alignItems:'center' }}>
          <LinearGradient
            colors={isRegistered ? [T.green, '#047857'] : [T.indigo, '#7C3AED']}
            style={{ width:48, height:48, borderRadius:14, alignItems:'center', justifyContent:'center', marginRight:14 }}
          >
            <Text style={{ fontSize:18, fontWeight:'800', color:'#fff' }}>
              {student.full_name?.[0]?.toUpperCase()}
            </Text>
          </LinearGradient>
          <View style={{ flex:1 }}>
            <Text style={{ fontSize:15, fontWeight:'700', color:T.textPri }}>{student.full_name}</Text>
            <Text style={{ fontSize:12, color:T.textSec, marginTop:2 }}>
              {student.register_number || student.registration_number || '—'}
            </Text>
            {isRegistered && (
              <View style={{ flexDirection:'row', alignItems:'center', gap:4, marginTop:3 }}>
                <MaterialCommunityIcons name="face-recognition" size={12} color={T.green} />
                <Text style={{ fontSize:11, fontWeight:'600', color:T.green }}>Face registered</Text>
              </View>
            )}
          </View>
          <View style={{
            backgroundColor: isRegistered ? T.greenLt : T.amberLt,
            paddingHorizontal:10, paddingVertical:4, borderRadius:T.radius.pill,
          }}>
            <Text style={{ fontSize:11, fontWeight:'700', color: isRegistered ? T.green : T.amber }}>
              {isRegistered ? 'Done' : 'Pending'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── PreviewModal ─────────────────────────────────────────────────────────────
const PreviewModal = ({ visible, imageBase64, studentName, processing, onConfirm, onCancel }) => (
  <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
    <View style={{ flex:1, backgroundColor:'rgba(0,0,0,0.88)', alignItems:'center', justifyContent:'center', padding:24 }}>
      <View style={{ backgroundColor:T.surface, borderRadius:T.radius.xl, width:'100%', overflow:'hidden', ...T.shadow.lg }}>
        <View style={{ padding:20, borderBottomWidth:1, borderBottomColor:T.border }}>
          <Text style={{ fontSize:18, fontWeight:'800', color:T.textPri }}>Confirm photo</Text>
          <Text style={{ fontSize:13, color:T.textSec, marginTop:2 }}>Registering for {studentName}</Text>
        </View>
        {imageBase64 && (
          <Image
            source={{ uri:`data:image/jpeg;base64,${imageBase64}` }}
            style={{ width:'100%', height:300 }}
            resizeMode="cover"
          />
        )}
        <View style={{ flexDirection:'row', gap:12, padding:16 }}>
          <TouchableOpacity
            onPress={onCancel}
            style={{
              flex:1, paddingVertical:14, borderRadius:T.radius.lg,
              backgroundColor:'#F1F5F9', alignItems:'center', justifyContent:'center',
              flexDirection:'row', gap:6,
            }}
          >
            <Feather name="x" size={16} color={T.textSec} />
            <Text style={{ fontSize:14, fontWeight:'600', color:T.textSec }}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onConfirm}
            disabled={processing}
            style={{
              flex:1, paddingVertical:14, borderRadius:T.radius.lg,
              backgroundColor:T.green, alignItems:'center', justifyContent:'center',
              flexDirection:'row', gap:6,
            }}
          >
            {processing
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Feather name="check" size={16} color="#fff" />
                  <Text style={{ fontSize:14, fontWeight:'600', color:'#fff' }}>Register</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
const TeacherFaceRegistrationScreen = ({ token: propToken, user: propUser, onBack, navigation }) => {
  const { token: ctxToken, user: ctxUser } = useAuth();
  const token = propToken || ctxToken;
  const user  = propUser  || ctxUser;

  const [classes, setClasses]                 = useState([]);
  const [selectedClass, setSelectedClass]     = useState(null);
  const [students, setStudents]               = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [processing, setProcessing]           = useState(false);
  const [cameraVisible, setCameraVisible]     = useState(false);
  const [cameraFacing, setCameraFacing]       = useState(CameraType.front);
  const [toast, setToast]                     = useState({ visible: false, message: '', type: 'success' });
  const [refreshing, setRefreshing]           = useState(false);
  const [searchQuery, setSearchQuery]         = useState('');        // NEW: search
  const [classStudentCounts, setClassStudentCounts] = useState({}); // NEW: per-class counts

  const [previewVisible, setPreviewVisible]   = useState(false);
  const previewImageRef = useRef(null);
  const [previewImageState, setPreviewImageState] = useState(null);
  const [markedStudentIds]                    = useState(() => new Set());

  const cameraRef = useRef(null);
  const { hasPermission, requestPermission } = useCameraPermission();

  const cameraVisibleRef  = useRef(false);
  const previewVisibleRef = useRef(false);

  // ── Wrapped setters ──────────────────────────────────────────────────────
  const openCamera = useCallback(() => {
    cameraVisibleRef.current = true;
    setCameraVisible(true);
  }, []);

  const closeCamera = useCallback(() => {
    cameraVisibleRef.current = false;
    setCameraVisible(false);
  }, []);

  const openPreview = useCallback((base64) => {
    previewImageRef.current = base64;
    setPreviewImageState(base64);
    previewVisibleRef.current = true;
    setPreviewVisible(true);
  }, []);

  const closePreview = useCallback(() => {
    previewVisibleRef.current = false;
    setPreviewVisible(false);
  }, []);

  const clearPreviewData = useCallback(() => {
    previewImageRef.current = null;
    setPreviewImageState(null);
  }, []);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ visible: true, message: msg, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2500);
  }, []);

  // ── Back action ──────────────────────────────────────────────────────────
  const performBack = useCallback(() => {
    if (cameraVisibleRef.current) { closeCamera(); return; }
    if (previewVisibleRef.current) {
      closePreview();
      clearPreviewData();
      showToast('Cancelled — try again', 'info');
      return;
    }
    if (typeof onBack === 'function') { onBack(); return; }
    if (navigation?.canGoBack?.())   { navigation.goBack(); return; }
    navigation?.navigate?.('Home');
  }, [closeCamera, closePreview, clearPreviewData, showToast, onBack, navigation]);

  // ── Hardware back ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      if (cameraVisibleRef.current) {
        cameraVisibleRef.current = false;
        setCameraVisible(false);
        return true;
      }
      if (previewVisibleRef.current) {
        previewVisibleRef.current = false;
        setPreviewVisible(false);
        previewImageRef.current = null;
        setPreviewImageState(null);
        showToast('Cancelled — try again', 'info');
        return true;
      }
      if (typeof onBack === 'function') { onBack(); return true; }
      if (navigation?.canGoBack?.())   { navigation.goBack(); return true; }
      navigation?.navigate?.('Home');
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', handler);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    loadClasses();
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') closeCamera();
    });
    return () => sub.remove();
  }, []);

  const loadClasses = async () => {
    try {
      const data = await api.get(`/timetable-assignments?user_id=${user?.id || ''}`, token);
      const list = Array.isArray(data) ? data : (data?.assignments || []);
      setClasses(buildClassMap(list));
    } catch {
      showToast('Failed to load classes', 'error');
    }
  };

  const loadStudents = async (cls) => {
    setLoading(true);
    try {
      const data = await api.get(
        `/students?subcategory_id=${cls.subcategory_id}&item_id=${cls.item_id || ''}`, token
      );
      const list = Array.isArray(data) ? data : [];
      setStudents(list);

      // NEW: cache the counts for this class
      const regCount = list.filter(s => hasFaceRegistered(s)).length;
      setClassStudentCounts(prev => ({
        ...prev,
        [cls.id]: { total: list.length, registered: regCount },
      }));
    } catch {
      showToast('Failed to load students', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshStudents = useCallback(async () => {
    if (!selectedClass) return;
    try {
      const data = await api.get(
        `/students?subcategory_id=${selectedClass.subcategory_id}&item_id=${selectedClass.item_id || ''}`,
        token
      );
      const list = Array.isArray(data) ? data : [];
      setStudents(list);
      const regCount = list.filter(s => hasFaceRegistered(s)).length;
      setClassStudentCounts(prev => ({
        ...prev,
        [selectedClass.id]: { total: list.length, registered: regCount },
      }));
      if (selectedStudent) {
        const updated = list.find(s => s.id === selectedStudent.id);
        if (updated) setSelectedStudent(updated);
      }
    } catch (e) { console.warn('Refresh students failed:', e); }
  }, [selectedClass, selectedStudent, token]);

  const selectClass = useCallback((cls) => {
    setSelectedClass(cls);
    setSelectedStudent(null);
    setSearchQuery('');
    loadStudents(cls);
  }, [token]);

  const registerFace = useCallback(async (base64Image) => {
    if (!selectedStudent) {
      showToast('No student selected', 'error');
      return false;
    }
    if (!base64Image) {
      showToast('No image provided', 'error');
      return false;
    }
    if (hasFaceRegistered(selectedStudent)) {
      showToast(`${selectedStudent.full_name} already has a face registered.`, 'error');
      return false;
    }

    setProcessing(true);
    try {
      const HEADERS = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'ngrok-skip-browser-warning': 'true',
      };

      const dupRes = await fetch(`${BASE_URL}/face/check-duplicate`, {
        method:'POST', headers:HEADERS,
        body: JSON.stringify({
          image_base64: base64Image,
          exclude_student_id: selectedStudent?.id || null,
        }),
      });
      if (dupRes.ok) {
        const dupResult = await dupRes.json();
        if (dupResult?.isDuplicate) {
          showToast(`This face already belongs to ${dupResult.studentName}!`, 'error');
          setProcessing(false);
          return false;
        }
      }

      const detectRes = await fetch(`${BASE_URL}/face/detect`, {
        method:'POST', headers:HEADERS,
        body: JSON.stringify({ image_base64: base64Image }),
      });
      if (!detectRes.ok) {
        const e = await detectRes.json().catch(() => ({}));
        throw new Error(e.error || 'Face detection failed');
      }
      const detectResult = await detectRes.json();

      if (!detectResult.descriptor) {
        showToast('No face detected. Use a clear, well-lit photo.', 'error');
        setProcessing(false);
        return false;
      }
      if (detectResult.faceCount !== undefined && detectResult.faceCount > 1) {
        showToast(`${detectResult.faceCount} faces detected. Use one face only.`, 'error');
        setProcessing(false);
        return false;
      }
      if (detectResult.confidence !== undefined && detectResult.confidence < 0.4) {
        showToast('Face confidence too low. Use a clearer photo.', 'warning');
        setProcessing(false);
        return false;
      }

      const res = await fetch(`${BASE_URL}/students/${selectedStudent.id}/face-descriptor`, {
        method:'POST', headers:HEADERS,
        body: JSON.stringify({ face_descriptor: JSON.stringify(detectResult.descriptor) }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${res.status}`);
      }

      markedStudentIds.add(selectedStudent.id);

      const updatedStudent = {
        ...selectedStudent,
        face_photo: null,
        face_descriptor: JSON.stringify(detectResult.descriptor),
      };
      setSelectedStudent(updatedStudent);
      setStudents(prev => {
        const updated = prev.map(s => s.id === selectedStudent.id ? updatedStudent : s);
        // Update class counts optimistically
        const regCount = updated.filter(s => hasFaceRegistered(s)).length;
        setClassStudentCounts(p => ({
          ...p,
          [selectedClass.id]: { total: updated.length, registered: regCount },
        }));
        return updated;
      });

      showToast(`Face registered for ${selectedStudent.full_name}!`, 'success');
      refreshStudents().catch(() => {});
      return true;
    } catch (error) {
      showToast(`Failed: ${error.message}`, 'error');
      return false;
    } finally {
      setProcessing(false);
    }
  }, [selectedStudent, token, showToast, markedStudentIds, refreshStudents, selectedClass]);

  const handleCameraCapture = useCallback(async (base64) => {
    closeCamera();
    openPreview(base64);
  }, [closeCamera, openPreview]);

  const pickImage = useCallback(async () => {
    if (!selectedStudent) { showToast('Select a student first', 'error'); return; }
    if (hasFaceRegistered(selectedStudent)) {
      showToast(`${selectedStudent.full_name} is already registered!`, 'error'); return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { showToast('Gallery permission required', 'error'); return; }
    setProcessing(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect:[1,1], quality:0.95, base64:true, exif:false,
      });
      if (!result.canceled && result.assets?.[0]) {
        setProcessing(false);
        openPreview(result.assets[0].base64);
      } else {
        setProcessing(false);
      }
    } catch {
      showToast('Failed to pick image', 'error');
      setProcessing(false);
    }
  }, [selectedStudent, showToast, openPreview]);

  const confirmPreviewAndRegister = useCallback(async () => {
    const imageToRegister = previewImageRef.current;
    if (!imageToRegister) {
      showToast('No image to register', 'error');
      return;
    }
    closePreview();
    const success = await registerFace(imageToRegister);
    clearPreviewData();
  }, [registerFace, closePreview, clearPreviewData, showToast]);

  const cancelPreview = useCallback(() => {
    closePreview();
    clearPreviewData();
    showToast('Cancelled — try again', 'info');
  }, [closePreview, clearPreviewData, showToast]);

  const deleteFace = useCallback(async (student) => {
    Alert.alert('Remove face data', `Remove face data for ${student.full_name}?`, [
      { text:'Cancel', style:'cancel' },
      {
        text:'Remove', style:'destructive', onPress: async () => {
          setProcessing(true);
          try {
            await fetch(`${BASE_URL}/students/${student.id}/face-descriptor`, {
              method:'DELETE',
              headers: { Authorization:`Bearer ${token}`, 'ngrok-skip-browser-warning':'true' },
            });
            markedStudentIds.delete(student.id);
            const updated = { ...student, face_photo:null, face_descriptor:null };
            setStudents(prev => {
              const next = prev.map(s => s.id === student.id ? updated : s);
              const regCount = next.filter(s => hasFaceRegistered(s)).length;
              setClassStudentCounts(p => ({
                ...p,
                [selectedClass?.id]: { total: next.length, registered: regCount },
              }));
              return next;
            });
            if (selectedStudent?.id === student.id) setSelectedStudent(updated);
            showToast(`Face removed for ${student.full_name}`, 'success');
          } catch {
            showToast('Failed to remove face data', 'error');
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  }, [selectedStudent, selectedClass, token, showToast, markedStudentIds]);

  const deleteAllFaces = useCallback(() => {
    const registeredStudents = students.filter(s => hasFaceRegistered(s));
    if (registeredStudents.length === 0) { showToast('No registered faces to clear', 'info'); return; }
    Alert.alert('Clear all face data', `Remove face data for all ${registeredStudents.length} student(s)?`, [
      { text:'Cancel', style:'cancel' },
      {
        text:`Clear all (${registeredStudents.length})`, style:'destructive', onPress: async () => {
          setProcessing(true);
          let failed = 0;
          await Promise.all(registeredStudents.map(async (student) => {
            try {
              await fetch(`${BASE_URL}/students/${student.id}/face-descriptor`, {
                method:'DELETE',
                headers: { Authorization:`Bearer ${token}`, 'ngrok-skip-browser-warning':'true' },
              });
              markedStudentIds.delete(student.id);
            } catch { failed += 1; }
          }));
          await refreshStudents();
          setSelectedStudent(null);
          setProcessing(false);
          if (failed === 0) showToast(`All ${registeredStudents.length} face(s) cleared.`, 'success');
          else showToast(`Done — ${failed} deletion(s) failed.`, 'warning');
        },
      },
    ]);
  }, [students, token, showToast, markedStudentIds, refreshStudents]);

  const registeredCount = students.filter(s => hasFaceRegistered(s)).length;

  // NEW: filtered students by search
  const filteredStudents = searchQuery.trim()
    ? students.filter(s =>
        s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.register_number || s.registration_number || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : students;

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:T.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { if (selectedClass) { setRefreshing(true); loadStudents(selectedClass); } }}
          />
        }
      >
        {/* ── Hero Header ── */}
        <LinearGradient
          colors={['#1E1B4B','#3730A3','#4F46E5']}
          start={{x:0,y:0}} end={{x:1,y:1}}
          style={{ paddingTop: Platform.OS==='ios' ? 20 : 24, paddingBottom:26, paddingHorizontal:20, overflow:'hidden' }}
        >
          {/* Decorative circles */}
          <View style={{ position:'absolute', top:-30, right:-30, width:150, height:150, borderRadius:75, borderWidth:1, borderColor:'rgba(255,255,255,0.06)' }} />
          <View style={{ position:'absolute', top:20,  right:30,  width:80,  height:80,  borderRadius:40, borderWidth:1, borderColor:'rgba(255,255,255,0.06)' }} />
          <View style={{ position:'absolute', bottom:-20, left:-10, width:100, height:100, borderRadius:50, backgroundColor:'rgba(255,255,255,0.04)' }} />

          <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' }}>
            <View style={{ flex:1 }}>
              <Text style={{ fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:'700', letterSpacing:1.5, textTransform:'uppercase', marginBottom:6 }}>
                Face Registration
              </Text>
              <Text style={{ fontSize:28, fontWeight:'900', color:'#fff', letterSpacing:-0.5 }}>
                Register Faces
              </Text>
              <Text style={{ fontSize:13, color:'rgba(255,255,255,0.7)', marginTop:5, fontWeight:'500' }}>
                {selectedClass ? selectedClass.name : 'Select a class to begin'}
              </Text>
            </View>
            <View style={{ width:56, height:56, borderRadius:18, backgroundColor:'rgba(255,255,255,0.15)', alignItems:'center', justifyContent:'center' }}>
              <MaterialCommunityIcons name="face-recognition" size={26} color="#fff" />
            </View>
          </View>

          {students.length > 0 && (
            <View style={{ flexDirection:'row', gap:10, marginTop:18 }}>
              {[
                { label:'Total',      value:students.length },
                { label:'Registered', value:registeredCount },
                { label:'Pending',    value:students.length - registeredCount },
              ].map((s, i) => (
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
          )}
        </LinearGradient>

        <View style={{ paddingHorizontal:16, paddingBottom:36, paddingTop:20 }}>

          {/* ── Class cards (IMPROVED) ── */}
          {classes.length > 0 && (
            <>
              <Text style={{ fontSize:12, fontWeight:'700', color:T.textSec, letterSpacing:0.8, textTransform:'uppercase', marginBottom:12 }}>
                Select class
              </Text>
              {/* NEW: Wrap cards in a 2-column grid instead of horizontal scroll */}
              <View style={{ flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:20 }}>
                {classes.map(cls => {
                  const counts = classStudentCounts[cls.id] || { total:0, registered:0 };
                  return (
                    <ClassCard
                      key={cls.id}
                      cls={cls}
                      isActive={selectedClass?.id === cls.id}
                      onPress={() => selectClass(cls)}
                      registeredCount={counts.registered}
                      totalCount={counts.total}
                    />
                  );
                })}
              </View>
            </>
          )}

          {/* ── Empty state when no class selected ── */}
          {!selectedClass && classes.length === 0 && (
            <View style={{ alignItems:'center', paddingVertical:48, backgroundColor:T.surface, borderRadius:T.radius.xl, borderWidth:1, borderColor:T.border, marginTop:8 }}>
              <View style={{ width:64, height:64, borderRadius:20, backgroundColor:T.indigoLt, alignItems:'center', justifyContent:'center', marginBottom:14 }}>
                <MaterialCommunityIcons name="school-outline" size={30} color={T.indigo} />
              </View>
              <Text style={{ fontSize:15, fontWeight:'700', color:T.textPri, marginBottom:6 }}>No classes assigned</Text>
              <Text style={{ fontSize:13, color:T.textSec, textAlign:'center', paddingHorizontal:24 }}>
                You don't have any timetable assignments yet. Contact admin to set it up.
              </Text>
            </View>
          )}

          {/* ── Clear all faces ── */}
          {selectedClass && registeredCount > 0 && (
            <TouchableOpacity
              onPress={deleteAllFaces}
              disabled={processing}
              style={{
                flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8,
                backgroundColor:'#FFF5F5', borderRadius:T.radius.lg, paddingVertical:12,
                borderWidth:1, borderColor:'#FECACA', marginBottom:20,
              }}
            >
              <Feather name="trash-2" size={15} color="#EF4444" />
              <Text style={{ fontSize:13, fontWeight:'600', color:'#EF4444' }}>
                Clear all faces ({registeredCount})
              </Text>
            </TouchableOpacity>
          )}

          {/* ── Student list ── */}
          {selectedClass && (
            <>
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <Text style={{ fontSize:14, fontWeight:'700', color:T.textPri }}>Students</Text>
                <Text style={{ fontSize:12, color:T.textSec }}>{registeredCount}/{students.length} registered</Text>
              </View>

              {/* NEW: Search bar */}
              {students.length > 5 && (
                <View style={{
                  flexDirection:'row', alignItems:'center', gap:10,
                  backgroundColor:T.surface, borderRadius:T.radius.lg,
                  borderWidth:1, borderColor:T.border,
                  paddingHorizontal:14, paddingVertical:10,
                  marginBottom:14, ...T.shadow.sm,
                }}>
                  <Feather name="search" size={16} color={T.textMut} />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search by name or reg. number…"
                    placeholderTextColor={T.textMut}
                    style={{ flex:1, fontSize:14, color:T.textPri, padding:0 }}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
                      <Feather name="x" size={15} color={T.textMut} />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {loading ? (
                <View>
                  {[0,1,2].map(i => (
                    <SkeletonBox key={i} width="100%" height={70} radius={T.radius.lg} style={{ marginBottom:10 }} />
                  ))}
                </View>
              ) : filteredStudents.length === 0 ? (
                <View style={{ alignItems:'center', paddingVertical:40, backgroundColor:T.surface, borderRadius:T.radius.xl, borderWidth:1, borderColor:T.border }}>
                  <Ionicons name={searchQuery ? 'search-outline' : 'people-outline'} size={40} color={T.textMut} />
                  <Text style={{ marginTop:10, fontSize:14, fontWeight:'600', color:T.textSec }}>
                    {searchQuery ? `No results for "${searchQuery}"` : 'No students found'}
                  </Text>
                  {searchQuery ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={{ marginTop:8 }}>
                      <Text style={{ fontSize:13, color:T.indigo, fontWeight:'600' }}>Clear search</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                filteredStudents.map((student, idx) => (
                  <StudentListItem
                    key={student.id}
                    student={student}
                    isSelected={selectedStudent?.id === student.id}
                    isRegistered={hasFaceRegistered(student)}
                    onPress={() => setSelectedStudent(student)}
                    index={idx}
                  />
                ))
              )}
            </>
          )}

          {/* ── Selected student action panel ── */}
          {selectedStudent && (
            <View style={{ marginTop:24 }}>
              {hasFaceRegistered(selectedStudent) ? (
                <View style={{ backgroundColor:T.surface, borderRadius:T.radius.xl, overflow:'hidden', borderWidth:1, borderColor:T.green, ...T.shadow.md }}>
                  <LinearGradient colors={[T.green, '#047857']} style={{ height:6 }} />
                  <View style={{ padding:18 }}>
                    <View style={{ flexDirection:'row', alignItems:'center', marginBottom:16 }}>
                      <LinearGradient
                        colors={[T.green, '#047857']}
                        style={{ width:54, height:54, borderRadius:16, alignItems:'center', justifyContent:'center', marginRight:14 }}
                      >
                        <Text style={{ fontSize:22, fontWeight:'800', color:'#fff' }}>
                          {selectedStudent.full_name?.[0]?.toUpperCase()}
                        </Text>
                      </LinearGradient>
                      <View style={{ flex:1 }}>
                        <Text style={{ fontSize:17, fontWeight:'800', color:T.textPri }}>{selectedStudent.full_name}</Text>
                        <Text style={{ fontSize:13, color:T.textSec, marginTop:2 }}>
                          {selectedStudent.register_number || '—'}
                        </Text>
                        <View style={{ flexDirection:'row', alignItems:'center', gap:5, marginTop:6 }}>
                          <Feather name="check-circle" size={14} color={T.green} />
                          <Text style={{ fontSize:13, fontWeight:'600', color:T.green }}>Face registered</Text>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => deleteFace(selectedStudent)}
                      disabled={processing}
                      style={{
                        backgroundColor:'#FFF5F5', borderRadius:T.radius.lg, paddingVertical:14,
                        flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8,
                        borderWidth:1, borderColor:'#FECACA',
                      }}
                    >
                      {processing
                        ? <ActivityIndicator color="#EF4444" />
                        : <>
                            <Feather name="trash-2" size={16} color="#EF4444" />
                            <Text style={{ fontSize:14, fontWeight:'600', color:'#EF4444' }}>Remove face data</Text>
                          </>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={{ backgroundColor:T.surface, borderRadius:T.radius.xl, overflow:'hidden', borderWidth:1, borderColor:T.border, ...T.shadow.md }}>
                  <LinearGradient colors={[T.amber, '#B45309']} style={{ height:6 }} />
                  <View style={{ padding:18 }}>
                    <View style={{ flexDirection:'row', alignItems:'center', marginBottom:18 }}>
                      <LinearGradient
                        colors={[T.indigo, '#7C3AED']}
                        style={{ width:54, height:54, borderRadius:16, alignItems:'center', justifyContent:'center', marginRight:14 }}
                      >
                        <Text style={{ fontSize:22, fontWeight:'800', color:'#fff' }}>
                          {selectedStudent.full_name?.[0]?.toUpperCase()}
                        </Text>
                      </LinearGradient>
                      <View style={{ flex:1 }}>
                        <Text style={{ fontSize:17, fontWeight:'800', color:T.textPri }}>{selectedStudent.full_name}</Text>
                        <Text style={{ fontSize:13, color:T.textSec, marginTop:2 }}>
                          {selectedStudent.register_number || '—'}
                        </Text>
                        <View style={{ flexDirection:'row', alignItems:'center', gap:5, marginTop:6 }}>
                          <Feather name="alert-circle" size={14} color={T.amber} />
                          <Text style={{ fontSize:13, fontWeight:'600', color:T.amber }}>Not registered</Text>
                        </View>
                      </View>
                    </View>

                    {processing ? (
                      <View style={{ alignItems:'center', paddingVertical:20 }}>
                        <ActivityIndicator color={T.indigo} size="large" />
                        <Text style={{ marginTop:12, fontSize:13, color:T.textSec }}>Processing face descriptor…</Text>
                      </View>
                    ) : (
                      <>
                        <View style={{ flexDirection:'row', gap:12, marginBottom:18 }}>
                          <TouchableOpacity
                            onPress={async () => {
                              if (!hasPermission) {
                                const granted = await requestPermission();
                                if (!granted) return;
                              }
                              openCamera();
                            }}
                            style={{
                              flex:1, backgroundColor:T.indigo, borderRadius:T.radius.lg,
                              paddingVertical:16, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8,
                            }}
                          >
                            <Feather name="camera" size={18} color="#fff" />
                            <Text style={{ fontSize:14, fontWeight:'700', color:'#fff' }}>Camera</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={pickImage}
                            style={{
                              flex:1, backgroundColor:'#fff', borderRadius:T.radius.lg,
                              paddingVertical:16, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8,
                              borderWidth:1.5, borderColor:T.indigo,
                            }}
                          >
                            <Feather name="image" size={18} color={T.indigo} />
                            <Text style={{ fontSize:14, fontWeight:'700', color:T.indigo }}>Gallery</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Tips */}
                        <View style={{ backgroundColor:T.slateLt, borderRadius:T.radius.lg, padding:14, borderWidth:1, borderColor:T.border }}>
                          <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginBottom:10 }}>
                            <Ionicons name="information-circle-outline" size={16} color={T.textSec} />
                            <Text style={{ fontSize:13, fontWeight:'700', color:T.textPri }}>Registration tips</Text>
                          </View>
                          {[
                            'Use a clear, front-facing photo with good lighting',
                            'Only one face should be visible in the photo',
                            'Each face can only be registered to one student',
                            'Avoid sunglasses, masks, or heavy shadows',
                            'Minimum 40% face confidence required',
                          ].map((tip, i) => (
                            <View key={i} style={{ flexDirection:'row', gap:8, marginBottom: i < 4 ? 7 : 0 }}>
                              <View style={{ width:4, height:4, borderRadius:2, backgroundColor:T.textMut, marginTop:6 }} />
                              <Text style={{ fontSize:12, color:T.textSec, flex:1, lineHeight:18 }}>{tip}</Text>
                            </View>
                          ))}
                        </View>
                      </>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Toast overlay ── */}
      {toast.visible && (
        <View style={{
          position:'absolute', bottom:40, left:20, right:20,
          backgroundColor: toast.type === 'error' ? '#EF4444' : toast.type === 'warning' ? T.amber : T.green,
          borderRadius:T.radius.lg, padding:14, alignItems:'center', ...T.shadow.lg,
        }}>
          <Text style={{ color:'#fff', fontWeight:'600', fontSize:13 }}>{toast.message}</Text>
        </View>
      )}

      <FaceAttendanceCameraModal
        visible={cameraVisible}
        onClose={closeCamera}
        cameraRef={cameraRef}
        facing={cameraFacing}
        onFlip={() => setCameraFacing(f => f === CameraType.front ? CameraType.back : CameraType.front)}
        isScanning={false}
        processingFrame={processing}
        detectedName={null}
        onStartScan={() => {}}
        onStopScan={() => {}}
        onCapture={handleCameraCapture}
        students={[]}
      />

      <PreviewModal
        visible={previewVisible}
        imageBase64={previewImageState}
        studentName={selectedStudent?.full_name}
        processing={processing}
        onConfirm={confirmPreviewAndRegister}
        onCancel={cancelPreview}
      />
    </SafeAreaView>
  );
};

export default TeacherFaceRegistrationScreen;