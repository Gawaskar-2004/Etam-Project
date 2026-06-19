import { useState, useEffect, useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import { Camera } from 'expo-camera';

// ==================== CAMERA PERMISSION HOOK ====================
const useCameraPermission = () => {
  const [hasPermission, setHasPermission] = useState(null);

  const requestPermission = useCallback(async () => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      const granted = status === 'granted';
      setHasPermission(granted);
      if (!granted) {
        Alert.alert(
          'Camera Permission Required',
          'This app needs camera access. Please enable it in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
      return granted;
    } catch (e) {
      console.error('Permission error:', e);
      setHasPermission(false);
      return false;
    }
  }, []);

  useEffect(() => {
    Camera.getCameraPermissionsAsync().then(({ status }) => {
      setHasPermission(status === 'granted');
    }).catch(() => setHasPermission(false));
  }, []);

  return { hasPermission, requestPermission };
};

export default useCameraPermission;
