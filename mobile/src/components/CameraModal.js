import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, Modal, Platform,
  StyleSheet, ScrollView, Animated, Alert,
} from 'react-native';
import { Camera } from 'expo-camera';
import { C } from '../config/constants';

// ─────────────────────────────────────────────────────────────────────────────
// CameraModal — simple single-capture modal (used by Face Registration screen)
// ─────────────────────────────────────────────────────────────────────────────
export const CameraModal = ({
  visible,
  onClose,
  onCapture,
  studentName,
  facing,
  onFlip,
  processing,
}) => {
  const cameraRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!visible) setReady(false);
  }, [visible]);

  const handleCapture = async () => {
    if (!cameraRef.current || !ready || processing) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: true,
        exif: false,
      });
      onCapture(photo.base64);
    } catch (e) {
      console.error('Capture error:', e);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          type={facing}
          onCameraReady={() => setReady(true)}
        />

        {/* Header */}
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          paddingTop: Platform.OS === 'ios' ? 56 : 36,
          paddingBottom: 16, paddingHorizontal: 16,
          backgroundColor: 'rgba(0,0,0,0.55)',
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <TouchableOpacity
            onPress={onClose}
            style={{
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>✕ Cancel</Text>
          </TouchableOpacity>

          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
            {studentName ? studentName : 'Take Photo'}
          </Text>

          <TouchableOpacity
            onPress={onFlip}
            style={{
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>🔄 Flip</Text>
          </TouchableOpacity>
        </View>

        {/* Face oval guide */}
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <View style={{
            width: 200, height: 240,
            borderRadius: 120,
            borderWidth: 2.5,
            borderColor: ready ? '#10B981' : 'rgba(255,255,255,0.5)',
            borderStyle: 'dashed',
          }} />
          <Text style={{
            color: 'rgba(255,255,255,0.85)', fontSize: 12,
            marginTop: 16, fontWeight: '600',
            backgroundColor: 'rgba(0,0,0,0.55)',
            paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
          }}>
            {!ready ? 'Camera starting…' : 'Position face inside oval'}
          </Text>
        </View>

        {/* Bottom capture button */}
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          paddingBottom: Platform.OS === 'ios' ? 48 : 28,
          paddingTop: 20, paddingHorizontal: 24,
          backgroundColor: 'rgba(0,0,0,0.6)',
          alignItems: 'center',
        }}>
          <TouchableOpacity
            onPress={handleCapture}
            disabled={processing || !ready}
            style={{
              width: 76, height: 76, borderRadius: 38,
              backgroundColor: processing || !ready
                ? 'rgba(255,255,255,0.3)'
                : '#fff',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 4,
              borderColor: processing || !ready
                ? 'rgba(255,255,255,0.2)'
                : 'rgba(255,255,255,0.6)',
            }}
          >
            {processing ? (
              <ActivityIndicator color="#4F46E5" size="large" />
            ) : (
              <View style={{
                width: 56, height: 56, borderRadius: 28,
                backgroundColor: ready ? '#4F46E5' : '#94A3B8',
              }} />
            )}
          </TouchableOpacity>
          <Text style={{
            color: 'rgba(255,255,255,0.7)', fontSize: 12,
            marginTop: 10, fontWeight: '600',
          }}>
            {processing ? 'Processing…' : !ready ? 'Camera loading…' : 'Tap to capture'}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Corner bracket guide (used inside FaceAttendanceCameraModal)
// ─────────────────────────────────────────────────────────────────────────────
const CornerGuide = ({ size = 200, color = '#10B981', processing }) => {
  const len = 28;
  const thick = 3;
  const borderColor = processing ? '#F59E0B' : color;
  const corner = (top, left, right, bottom) => ({
    position: 'absolute', width: len, height: len,
    borderColor,
    borderTopWidth:    top    ? thick : 0,
    borderLeftWidth:   left   ? thick : 0,
    borderRightWidth:  right  ? thick : 0,
    borderBottomWidth: bottom ? thick : 0,
    borderRadius: 4,
    top:    top    ? 0 : undefined,
    bottom: bottom ? 0 : undefined,
    left:   left   ? 0 : undefined,
    right:  right  ? 0 : undefined,
  });
  return (
    <View style={{ width: size, height: size * 1.2, position: 'relative' }}>
      <View style={corner(true,  true,  false, false)} />
      <View style={corner(true,  false, true,  false)} />
      <View style={corner(false, true,  false, true)}  />
      <View style={corner(false, false, true,  true)}  />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// FaceAttendanceCameraModal — auto-scan modal (used by Face ATTENDANCE screen)
//
// KEY FIX: Added `onCapture` prop support so this modal can ALSO be used for
// registration (single-photo capture mode).
//
// When `onCapture` is provided → show a Capture button (registration mode).
// When `onCapture` is absent  → auto-scan mode (attendance mode, unchanged).
// ─────────────────────────────────────────────────────────────────────────────
export const FaceAttendanceCameraModal = ({
  visible,
  onClose,
  cameraRef,
  facing,
  onFlip,
  isScanning,
  processingFrame,
  detectedName,
  onStartScan,
  onStopScan,
  students = [],
  // ── Registration mode ──────────────────────────────────────────────────────
  // Pass this prop to switch the modal into single-capture mode.
  // When present, no auto-scan starts and a capture button is shown instead.
  onCapture,
}) => {
  const [ready, setReady] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isRegistrationMode = typeof onCapture === 'function';

  useEffect(() => {
    if (!visible) setReady(false);
  }, [visible]);

  // ── Auto-start scanning ONLY in attendance mode ───────────────────────────
  // FIX: The original code always called onStartScan() when ready.
  // In registration mode this was causing the scan loop to start,
  // which then conflicted with the capture flow and caused the screen to exit.
  useEffect(() => {
    if (isRegistrationMode) return; // ← never auto-scan in registration mode
    if (ready && visible && !isScanning && onStartScan) {
      onStartScan();
    }
  }, [ready, visible, isRegistrationMode]);

  // Pulse animation for live dot
  useEffect(() => {
    if (!isScanning || isRegistrationMode) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isScanning, isRegistrationMode]);

  // ── Capture handler (registration mode only) ──────────────────────────────
  const handleCapture = async () => {
    if (!cameraRef?.current || !ready || processingFrame) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: true,
        exif: false,
        skipProcessing: false,
      });
      if (photo?.base64) {
        onCapture(photo.base64); // → triggers handleCameraCapture in registration screen
      }
    } catch (e) {
      console.error('Capture error:', e);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  const presentStudents = students.filter(s => s.present);
  const total           = students.length;
  const presentCount    = presentStudents.length;
  const progressPct     = total > 0 ? (presentCount / total) * 100 : 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      hardwareAccelerated
    >
      <View style={{ flex: 1, backgroundColor: '#000' }}>

        {/* Camera */}
        {visible && (
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            type={facing}
            onCameraReady={() => setReady(true)}
          />
        )}

        {/* ── REGISTRATION MODE: simple header + capture button ── */}
        {isRegistrationMode ? (
          <>
            {/* Header */}
            <View style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              paddingTop: Platform.OS === 'ios' ? 56 : 36,
              paddingBottom: 16, paddingHorizontal: 16,
              backgroundColor: 'rgba(0,0,0,0.55)',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <TouchableOpacity
                onPress={onClose}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>✕ Cancel</Text>
              </TouchableOpacity>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
                Register Face
              </Text>
              <TouchableOpacity
                onPress={onFlip}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>🔄 Flip</Text>
              </TouchableOpacity>
            </View>

            {/* Oval face guide */}
            <View style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <View style={{
                width: 200, height: 240, borderRadius: 120,
                borderWidth: 2.5,
                borderColor: ready ? '#10B981' : 'rgba(255,255,255,0.5)',
                borderStyle: 'dashed',
              }} />
              <Text style={{
                color: 'rgba(255,255,255,0.85)', fontSize: 12,
                marginTop: 16, fontWeight: '600',
                backgroundColor: 'rgba(0,0,0,0.55)',
                paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
              }}>
                {!ready
                  ? 'Camera starting…'
                  : processingFrame
                    ? '🔍 Processing…'
                    : 'Position face inside oval'}
              </Text>
            </View>

            {/* Capture button */}
            <View style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              paddingBottom: Platform.OS === 'ios' ? 48 : 28,
              paddingTop: 20, paddingHorizontal: 24,
              backgroundColor: 'rgba(0,0,0,0.6)',
              alignItems: 'center',
            }}>
              <TouchableOpacity
                onPress={handleCapture}
                disabled={processingFrame || !ready}
                style={{
                  width: 76, height: 76, borderRadius: 38,
                  backgroundColor: processingFrame || !ready
                    ? 'rgba(255,255,255,0.3)'
                    : '#fff',
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 4,
                  borderColor: processingFrame || !ready
                    ? 'rgba(255,255,255,0.2)'
                    : 'rgba(255,255,255,0.6)',
                }}
              >
                {processingFrame ? (
                  <ActivityIndicator color="#4F46E5" size="large" />
                ) : (
                  <View style={{
                    width: 56, height: 56, borderRadius: 28,
                    backgroundColor: ready ? '#4F46E5' : '#94A3B8',
                  }} />
                )}
              </TouchableOpacity>
              <Text style={{
                color: 'rgba(255,255,255,0.7)', fontSize: 12,
                marginTop: 10, fontWeight: '600',
              }}>
                {processingFrame
                  ? 'Processing…'
                  : !ready
                    ? 'Camera loading…'
                    : 'Tap to capture'}
              </Text>
            </View>
          </>
        ) : (
          // ── ATTENDANCE MODE: original UI unchanged ──────────────────────
          <>
            {/* Dark gradient top */}
            <View style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              paddingTop: Platform.OS === 'ios' ? 56 : 36,
              paddingBottom: 20, paddingHorizontal: 16,
              backgroundColor: 'rgba(0,0,0,0.55)',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Animated.View style={{
                    width: 9, height: 9, borderRadius: 5,
                    backgroundColor: isScanning ? '#EF4444' : '#94A3B8',
                    opacity: isScanning ? pulseAnim : 1,
                  }} />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                    {!ready ? 'Starting camera…' : processingFrame ? 'Analyzing…' : isScanning ? 'SCANNING' : 'Ready'}
                  </Text>
                  {processingFrame && <ActivityIndicator size="small" color="#fff" />}
                </View>
                <View style={{
                  backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20,
                  paddingHorizontal: 14, paddingVertical: 5,
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                }}>
                  <Text style={{ color: '#10B981', fontWeight: '900', fontSize: 16 }}>{presentCount}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>/</Text>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{total}</Text>
                </View>
              </View>
              <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginTop: 10 }}>
                <View style={{ height: 3, width: `${progressPct}%`, backgroundColor: '#10B981', borderRadius: 2 }} />
              </View>
            </View>

            {/* Detected name flash */}
            {detectedName ? (
              <View style={{
                position: 'absolute',
                top: Platform.OS === 'ios' ? 140 : 120,
                alignSelf: 'center',
                backgroundColor: '#10B981',
                paddingHorizontal: 20, paddingVertical: 10,
                borderRadius: 30,
                shadowColor: '#10B981', shadowOpacity: 0.6, shadowRadius: 12, elevation: 8,
              }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                  ✓ {detectedName} — Present!
                </Text>
              </View>
            ) : null}

            {/* Face guide */}
            <View style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <CornerGuide
                size={190}
                color={isScanning ? '#10B981' : 'rgba(255,255,255,0.6)'}
                processing={processingFrame}
              />
              <Text style={{
                color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 16, fontWeight: '600',
                backgroundColor: 'rgba(0,0,0,0.55)',
                paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
              }}>
                {processingFrame ? '🔍 Matching face…' : 'Point camera at each student'}
              </Text>
            </View>

            {/* Bottom panel */}
            <View style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              backgroundColor: 'rgba(0,0,0,0.75)',
              paddingBottom: Platform.OS === 'ios' ? 48 : 24,
              paddingTop: 14, paddingHorizontal: 16,
            }}>
              {total > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 14 }}
                  contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
                >
                  {students.map(s => (
                    <View key={s.id} style={{
                      width: 28, height: 28, borderRadius: 14,
                      backgroundColor: s.present ? '#10B981' : 'rgba(255,255,255,0.2)',
                      borderWidth: 1.5,
                      borderColor: s.present ? '#34D399' : 'rgba(255,255,255,0.25)',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      {s.present && <Text style={{ fontSize: 11, color: '#fff' }}>✓</Text>}
                    </View>
                  ))}
                </ScrollView>
              )}

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={onFlip}
                  style={{
                    width: 52, height: 52, borderRadius: 16,
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 22 }}>🔄</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onClose}
                  style={{
                    flex: 1, height: 52, borderRadius: 16,
                    backgroundColor: presentCount > 0 ? '#10B981' : 'rgba(255,255,255,0.2)',
                    borderWidth: 1,
                    borderColor: presentCount > 0 ? '#34D399' : 'rgba(255,255,255,0.25)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                    {presentCount > 0 ? `Done — ${presentCount} Marked ✓` : 'Done'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
};

export default CameraModal;