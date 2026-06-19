import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import api from '../../api/client';
import { C } from '../../constants/colors';

export default function StudentHolidaysScreen({ navigation }) {
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(null);
  const [holidays, setHolidays]     = useState([]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get('/holidays');
      setHolidays(Array.isArray(res) ? res : (res?.holidays ?? []));
    } catch {
      setError('Failed to load holidays. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerLabel}>Student Portal</Text>
          <Text style={styles.headerTitle}>Holidays</Text>
        </View>
        <View style={styles.headerIcon}><Text style={{ fontSize: 22 }}>🎉</Text></View>
      </View>

      <ScrollView
        style={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Error banner */}
        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
            <TouchableOpacity
              onPress={() => { setLoading(true); loadData(); }}
              style={styles.retryBtn}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 48 }} />
        ) : holidays.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={styles.emptyTitle}>No holidays listed</Text>
            <Text style={styles.emptySubtitle}>Check back later for upcoming holidays</Text>
          </View>
        ) : (
          holidays.map((h, i) => (
            <View key={i} style={styles.holidayCard}>
              <View style={styles.dateBadge}>
                <Text style={styles.dateDay}>
                  {h.date ? new Date(h.date).getDate() : '—'}
                </Text>
                <Text style={styles.dateMonth}>
                  {h.date
                    ? new Date(h.date).toLocaleDateString('en-IN', { month: 'short' })
                    : ''}
                </Text>
              </View>
              <View style={styles.holidayInfo}>
                <Text style={styles.holidayName}>{h.name || h.title || 'Holiday'}</Text>
                <Text style={styles.holidayDate}>{formatDate(h.date)}</Text>
                {h.description ? (
                  <Text style={styles.holidayDesc}>{h.description}</Text>
                ) : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },

  header: {
    backgroundColor: C.primaryDark, paddingTop: 52, paddingBottom: 20,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  backArrow:   { color: C.white, fontSize: 20, lineHeight: 22 },
  headerLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: 1, textTransform: 'uppercase' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: C.white, marginTop: 1 },
  headerIcon:  { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  body: { flex: 1, padding: 16 },

  errorBanner:     { backgroundColor: C.errorLight, borderRadius: 10, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderLeftWidth: 4, borderLeftColor: C.error },
  errorBannerText: { color: C.error, flex: 1, fontSize: 13 },
  retryBtn:        { backgroundColor: C.error, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginLeft: 8 },
  retryText:       { color: C.white, fontSize: 12, fontWeight: '700' },

  holidayCard: { flexDirection: 'row', backgroundColor: C.white, borderRadius: 14, padding: 14, marginBottom: 10, gap: 14, alignItems: 'center' },
  dateBadge:   { width: 52, height: 52, borderRadius: 14, backgroundColor: C.primaryBg, alignItems: 'center', justifyContent: 'center' },
  dateDay:     { fontSize: 20, fontWeight: '800', color: C.primary, lineHeight: 22 },
  dateMonth:   { fontSize: 10, fontWeight: '600', color: C.primaryLight, textTransform: 'uppercase' },
  holidayInfo: { flex: 1 },
  holidayName: { fontSize: 15, fontWeight: '700', color: C.dark },
  holidayDate: { fontSize: 12, color: C.gray, marginTop: 2 },
  holidayDesc: { fontSize: 12, color: C.gray, marginTop: 4 },

  emptyBox:      { alignItems: 'center', paddingTop: 60 },
  emptyIcon:     { fontSize: 48, marginBottom: 12 },
  emptyTitle:    { fontSize: 16, fontWeight: '700', color: C.dark },
  emptySubtitle: { fontSize: 13, color: C.gray, marginTop: 4 },
});
