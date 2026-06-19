import React from 'react';
import { View, Text } from 'react-native';
import styles from '../styles/globalStyles';

const Badge = ({ text, style, textStyle }) => (
  <View style={[styles.badge, style]}>
    <Text style={[styles.badgeText, textStyle]}>{text}</Text>
  </View>
);

export default Badge;
