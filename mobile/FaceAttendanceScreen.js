import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, ScrollView, Animated
} from 'react-native';
import { Camera } from 'expo-camera';
import * as FaceDetector from 'expo-face-detector';

const BASE_URL = 'https://trustless-presbyterial-landen.ngrok-free.dev/api';

const C = {
  primary: '#4f46e5', primaryLight: '#ede9fe',
  bg: '#f0f4ff', card: '#ffffff', border: '#e8edf5',
  text: '#0f172a', textSub: '#64748b', textMuted: '#94a3b8',
  green: '#16a34a', greenBg: '#f0fdf4',
  red: '#dc2626', redBg: '#fef2f2',
  orange: '#ea580c',
};

const Avatar = ({ name, size = 38 }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontWeight: '700', color: C.primary, fontSize: size * 0.36 }}>
      {name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
    </Text>
  </View>
);

// Cooldown in ms between auto-scans
const SCAN_COOLDOWN = 3500;

export default function FaceAttendanceScreen({ token, user }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [toast, setToast] = useState(null); // { message, type: 'success'|'error'|'info' }

  const cameraRef = useRef(null);
  const processingRef = useRef(false);   // sync ref to avoid stale closure
  const lastScanRef = useRef(0);         // timestamp of last scan
  const toastTimer = useRef(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const date = new Date().toISOString().split('T')[0];

  const headers = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => { loadClasses(); }, []);

  // Cleanup timers
  useEffect(() => () => { clearTimeout(toastTimer.current); }, []);

  const showToast = useCallback((message, type = 'info') => {
    clearTimeout(toastTimer.current);
    setToast({ message, type });
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [toastAnim]);

  const loadClasses = async () => {
    try {
      const data = await fetch(`${BASE_URL}/timetable-assignments?user_id=${user?.id}`, { headers }).then(r => r.json());
      const list = Array.isArray(data) ? data : (data?.assignments || []);
      const map = new Map();
      list.forEach(item => {
        if (item.subcategory_id && !map.has(item.subcategory_id))
          map.set(item.subcategory_id, { id: item.subcategory_id, name: item.subcategory_name || 'Class', category_id: item.category_id });
      });
      setClasses(Array.from(map.values()));
    } catch (e) { console.log('loadClasses error:', e); }
  };

  const loadStudents = async (cls) => {
    setLoading(true);
    try {
      const raw = await fetch(`${BASE_URL}/students?subcategory_id=${cls.id}`, { headers }).then(r => r.json());
      const list = Array.isArray(raw) ? raw : (raw?.students || []);
      setStudents(list.map(s => ({ ...s, present: false })));
    } catch (e) { console.log('loadStudents error:', e); }
    finally { setLoading(false); }
  };

  const startCamera = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status === 'granted') {
      setHasPermission(true);
      setCameraOn(true);
    } else {
      Alert.alert('Permission Required', 'Please allow camera access.');
    }
  };

  // Auto-scan: fires whenever expo-face-detector sees a face
  const handleFacesDetected = useCallback(async ({ faces }) => {
    const hasFace = faces.length > 0;
    setFaceDetected(hasFace);

    if (!hasFace) return;
    if (processingRef.current) return;
    if (!selectedClass) return;

    const now = Date.now();
    if (now - lastScanRef.current < SCAN_COOLDOWN) return;

    // Trigger auto-scan
    lastScanRef.current = now;
    processingRef.current = true;
    setProcessing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3,
        base64: true,
        exif: false,
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`${BASE_URL}/attendance/face-recognize`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          image: `data:image/jpeg;base64,${photo.base64}`,
          subcategory_id: selectedClass.id,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const result = await res.json();

      if (result.matched && result.student_id) {
        setStudents(prev => {
          const student = prev.find(s => s.id === result.student_id);
          if (!student) return prev;
          if (student.present) {
            showToast(`${student.full_name} already marked ✓`, 'info');
            return prev;
          }
          showToast(`✓ ${result.student_name || student.full_name} Present!`, 'success');
          return prev.map(s => s.id === result.student_id ? { ...s, present: true } : s);
        });
      } else {
        showToast(result.message || 'Face not recognized', 'error');
      }
    } catch (e) {
      if (e.name !== 'AbortError') showToast('Scan failed, try again', 'error');
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, [selectedClass, headers, showToast]);

  const saveAttendance = async () => {
    if (!selectedClass || !students.length) return;
    setSaving(true);
    try {
      const session = await fetch(`${BASE_URL}/attendance/sessions`, {
        method: 'POST', headers,
        body: JSON.stringify({ date, subcategory_id: selectedClass.id, category_id: selectedClass.category_id, marked_by: user?.id }),
      }).then(r => r.json());
      await fetch(`${BASE_URL}/attendance/sessions/${session.id}/records`, {
        method: 'POST', headers,
        body: JSON.stringify({ records: students.map(s => ({ student_id: s.id, status: s.present ? 'present' : 'absent' })) }),
      });
      Alert.alert('✅ Success', 'Attendance saved!');
      setCameraOn(false);
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const present = students.filter(s => s.present).length;
  const absent = students.length - present;

  const toastBg = toast?.type === 'success' ? C.green : toast?.type === 'error' ? C.red : C.orange;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 28, backgroundColor: C.primary }}>
        <Text style={{ fontSize: 26, fontWeight: 'bold', color: '#fff' }}>🤳 Face Attendance</Text>
        <Text style={{ fontSize: 14, color: '#c7d2fe', marginTop: 4 }}>Point camera at student — auto marks attendance</Text>
      </View>

      {/* Toast notification */}
      {toast && (
        <Animated.View style={{
          position: 'absolute', top: 90, left: 20, right: 20, zIndex: 99,
          backgroundColor: toastBg, borderRadius: 14, padding: 14,
          alignItems: 'center', elevation: 10,
          opacity: toastAnim,
          transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
        }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{toast.message}</Text>
        </Animated.View>
      )}

      <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
        {/* Class selector */}
        <View style={ss.section}>
          <Text style={ss.sectionTitle}>Select Class</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {classes.map(cls => (
                <TouchableOpacity key={cls.id}
                  style={[ss.chip, selectedClass?.id === cls.id && ss.chipOn]}
                  onPress={() => { setSelectedClass(cls); loadStudents(cls); setCameraOn(false); }}>
                  <Text style={[ss.chipTxt, selectedClass?.id === cls.id && { color: '#fff' }]}>{cls.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Stats */}
        {selectedClass && students.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            <View style={[ss.statCard, { borderTopColor: C.primary }]}><Text style={ss.statVal}>{students.length}</Text><Text style={ss.statLbl}>Total</Text></View>
            <View style={[ss.statCard, { borderTopColor: C.green }]}><Text style={[ss.statVal, { color: C.green }]}>{present}</Text><Text style={ss.statLbl}>Present</Text></View>
            <View style={[ss.statCard, { borderTopColor: C.red }]}><Text style={[ss.statVal, { color: C.red }]}>{absent}</Text><Text style={ss.statLbl}>Absent</Text></View>
          </View>
        )}

        {/* Camera */}
        {selectedClass && (
          <View style={ss.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={ss.sectionTitle}>📷 Camera</Text>
              {cameraOn && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: faceDetected ? '#dcfce7' : '#f1f5f9', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: faceDetected ? C.green : '#94a3b8' }} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: faceDetected ? C.green : C.textSub }}>
                    {processing ? 'Scanning...' : faceDetected ? 'Face Detected' : 'No Face'}
                  </Text>
                </View>
              )}
            </View>

            {cameraOn && hasPermission ? (
              <View>
                <View style={{ height: 300, borderRadius: 16, overflow: 'hidden', marginBottom: 12, backgroundColor: '#000' }}>
                  <Camera
                    ref={cameraRef}
                    style={{ flex: 1 }}
                    type={Camera.Constants.Type.front}
                    onFacesDetected={handleFacesDetected}
                    faceDetectorSettings={{
                      mode: FaceDetector.FaceDetectorMode.fast,
                      detectLandmarks: FaceDetector.FaceDetectorLandmarks.none,
                      runClassifications: FaceDetector.FaceDetectorClassifications.none,
                      minDetectionInterval: 300,
                      tracking: true,
                    }}
                  >
                    {/* Face outline box */}
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <View style={{
                        width: 180, height: 220, borderRadius: 100,
                        borderWidth: 2.5,
                        borderColor: processing ? '#facc15' : faceDetected ? C.green : 'rgba(255,255,255,0.4)',
                        borderStyle: 'dashed',
                      }} />
                    </View>

                    {/* Scanning label */}
                    <View style={{ position: 'absolute', bottom: 14, left: 0, right: 0, alignItems: 'center' }}>
                      {processing ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
                          backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 30 }}>
                          <ActivityIndicator color="#facc15" size="small" />
                          <Text style={{ color: '#facc15', fontWeight: '700', fontSize: 13 }}>Recognizing...</Text>
                        </View>
                      ) : faceDetected ? (
                        <View style={{ backgroundColor: 'rgba(22,163,74,0.85)', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 30 }}>
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>😊 Hold still...</Text>
                        </View>
                      ) : (
                        <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 30 }}>
                          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>Position face inside the oval</Text>
                        </View>
                      )}
                    </View>
                  </Camera>
                </View>

                <TouchableOpacity
                  style={[ss.btn, { backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: C.border }]}
                  onPress={() => { setCameraOn(false); setFaceDetected(false); }}>
                  <Text style={[ss.btnTxt, { color: C.text }]}>⏹ Stop Camera</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={[ss.btn, { backgroundColor: C.primary }]} onPress={startCamera}>
                <Text style={ss.btnTxt}>📷 Start Camera</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Students list */}
        {selectedClass && students.length > 0 && (
          <View style={ss.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={ss.sectionTitle}>Students ({students.length})</Text>
              <TouchableOpacity
                style={[ss.btn, { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: C.primary }]}
                onPress={saveAttendance}
                disabled={saving}>
                <Text style={[ss.btnTxt, { fontSize: 13 }]}>{saving ? 'Saving...' : '💾 Save'}</Text>
              </TouchableOpacity>
            </View>
            {loading ? <ActivityIndicator color={C.primary} /> :
              students.map(s => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setStudents(prev => prev.map(p => p.id === s.id ? { ...p, present: !p.present } : p))}
                  style={[{
                    flexDirection: 'row', alignItems: 'center', padding: 12,
                    borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: '#f1f5f9'
                  }, s.present && { backgroundColor: C.greenBg, borderColor: '#bbf7d0' }]}>
                  <Avatar name={s.full_name} size={38} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: C.text }}>{s.full_name}</Text>
                    <Text style={{ fontSize: 12, color: C.textSub }}>Roll: {s.roll_number || '—'}</Text>
                  </View>
                  <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
                    backgroundColor: s.present ? '#dcfce7' : '#fee2e2' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: s.present ? C.green : C.red }}>
                      {s.present ? 'Present ✓' : 'Absent'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            }
          </View>
        )}

        {!selectedClass && (
          <View style={[ss.section, { alignItems: 'center', paddingVertical: 32 }]}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🤳</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: C.text, marginBottom: 6 }}>Face Recognition Ready</Text>
            <Text style={{ fontSize: 13, color: C.textSub, textAlign: 'center', lineHeight: 20 }}>
              Select a class above to start face attendance
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const ss = StyleSheet.create({
  section: { backgroundColor: '#fff', borderRadius: 18, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#e8edf5', elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 0 },
  chip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, borderWidth: 1.5, borderColor: '#e8edf5', backgroundColor: '#fff' },
  chipOn: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  chipTxt: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', borderTopWidth: 3, borderWidth: 1, borderColor: '#e8edf5', elevation: 2 },
  statVal: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  statLbl: { fontSize: 10, color: '#64748b', marginTop: 3 },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', elevation: 2 },
  btnTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
