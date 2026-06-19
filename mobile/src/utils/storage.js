import AsyncStorage from '@react-native-async-storage/async-storage';

// ==================== AUTH STORAGE ====================
export const saveSession = async (token, user) => {
  try {
    await AsyncStorage.multiSet([['etam_token', token], ['etam_user', JSON.stringify(user)]]);
  } catch (error) {
    console.error('Failed to save session:', error);
    throw new Error('Failed to save login session');
  }
};

export const loadSession = async () => {
  try {
    const [[, token], [, userStr]] = await AsyncStorage.multiGet(['etam_token', 'etam_user']);
    if (token && userStr) return { token, user: JSON.parse(userStr) };
    return null;
  } catch (error) {
    console.error('Failed to load session:', error);
    return null;
  }
};

export const clearSession = async () => {
  try {
    await AsyncStorage.multiRemove(['etam_token', 'etam_user']);
  } catch (error) {
    console.error('Failed to clear session:', error);
  }
};
