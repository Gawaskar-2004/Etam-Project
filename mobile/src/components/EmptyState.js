import React from 'react';
import { View, Text } from 'react-native';
import styles from '../styles/globalStyles';

const EmptyState = ({ icon, title, message }) => (
  <View style={styles.emptyState}>
    <Text style={styles.emptyIcon}>{icon}</Text>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyMessage}>{message}</Text>
  </View>
);

export default EmptyState;
