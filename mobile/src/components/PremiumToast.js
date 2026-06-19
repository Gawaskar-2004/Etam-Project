import React, { useEffect } from 'react';
import { Animated, Text } from 'react-native';
import styles from '../styles/globalStyles';

// ==================== SHARED COMPONENTS ====================
const PremiumToast = ({ visible, message, type, onHide }) => {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onHide, 3500);
      return () => clearTimeout(timer);
    }
  }, [visible, onHide]);
  if (!visible) return null;
  const bgStyle =
    type === 'success' ? styles.toastSuccess :
    type === 'error'   ? styles.toastError :
    type === 'warning' ? styles.toastWarning :
    styles.toastInfo;
  return (
    <Animated.View style={[styles.toast, bgStyle]}>
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
};

export default PremiumToast;
