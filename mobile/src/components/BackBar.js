import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { C } from '../config/constants';

// Reusable back button bar shown at the top of sub-screens
const BackBar = ({ onBack, title, light = false }) => (
  <View style={{
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 54 : 14,
    paddingBottom: 12,
    backgroundColor: light ? 'transparent' : C.white,
    borderBottomWidth: light ? 0 : 1, borderBottomColor: C.border,
  }}>
    <TouchableOpacity onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
      <View style={{ width: 34, height: 34, borderRadius: 10,
        backgroundColor: light ? 'rgba(255,255,255,0.2)' : C.primaryBg,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: light ? 'rgba(255,255,255,0.3)' : '#C7D2FE' }}>
        <Text style={{ fontSize: 18, color: light ? C.white : C.primary, lineHeight: 22 }}>‹</Text>
      </View>
    </TouchableOpacity>
    {title ? <Text style={{ fontSize: 17, fontWeight: '800', color: light ? C.white : C.dark, flex: 1 }} numberOfLines={1}>{title}</Text> : null}
  </View>
);

export default BackBar;
