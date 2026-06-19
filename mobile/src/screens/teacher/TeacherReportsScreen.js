import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, ScrollView,
  SafeAreaView, Platform, TextInput, Dimensions, Alert, Animated,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { C } from '../../config/constants';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { buildClassMap, hasFaceRegistered } from '../../utils/helpers';
import PremiumToast from '../../components/PremiumToast';

const { width } = Dimensions.get('window');

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  bg:       '#F0F4FF',
  surface:  '#FFFFFF',
  border:   '#E8EEFF',
  textPri:  '#0D1B3E',
  textSec:  '#5A6A8A',
  textMut:  '#96A5C0',
  indigo:   '#4F46E5',
  indigoLt: '#EEF2FF',
  green:    '#059669',
  greenLt:  '#D1FAE5',
  red:      '#DC2626',
  redLt:    '#FEE2E2',
  amber:    '#D97706',
  amberLt:  '#FEF3C7',
  slate:    '#64748B',
  slateLt:  '#F1F5F9',
  radius:   { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 },
  shadow: {
    sm: { shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
    md: { shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 4 },
  },
};

const CLASS_PALETTE = [
  { grad: ['#4F46E5', '#7C3AED'], light: '#EEF2FF', color: '#4F46E5' },
  { grad: ['#0891B2', '#0E7490'], light: '#ECFEFF', color: '#0891B2' },
  { grad: ['#059669', '#047857'], light: '#ECFDF5', color: '#059669' },
  { grad: ['#D97706', '#B45309'], light: '#FFFBEB', color: '#D97706' },
  { grad: ['#DB2777', '#BE185D'], light: '#FDF2F8', color: '#DB2777' },
  { grad: ['#7C3AED', '#6D28D9'], light: '#F5F3FF', color: '#7C3AED' },
];

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pctColor = (p) => p >= 85 ? T.green : p >= 75 ? T.amber : T.red;
const pctBg    = (p) => p >= 85 ? T.greenLt : p >= 75 ? T.amberLt : T.redLt;
const statusLabel = (p) => p >= 85 ? 'Good' : p >= 75 ? 'Average' : 'Low';

function getDateRange(range) {
  const end   = new Date();
  const start = new Date();
  if (range === '30days')   start.setDate(end.getDate() - 30);
  else if (range === 'thismonth') start.setDate(1);
  else if (range === '3months')   start.setMonth(end.getMonth() - 3);
  return {
    start: start.toISOString().split('T')[0],
    end:   end.toISOString().split('T')[0],
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkeletonBox({ width: w, height: h, radius = 8, style }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1,   duration: 900, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.4, duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={[{ width: w, height: h, borderRadius: radius, backgroundColor: '#E2E8F0', opacity: anim }, style]} />;
}

function SectionHeader({ title, subtitle }) {
  return (
    <View style={{ marginBottom: 14, marginTop: 4 }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: T.textPri, letterSpacing: -0.2 }}>{title}</Text>
      {subtitle && <Text style={{ fontSize: 12, color: T.textSec, marginTop: 2, fontWeight: '500' }}>{subtitle}</Text>}
    </View>
  );
}

function ProgressBar({ pct, color, height = 8, animated = true }) {
  const animWidth = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (animated) Animated.timing(animWidth, { toValue: pct, duration: 700, useNativeDriver: false }).start();
  }, [pct]);
  const widthInterp = animated
    ? animWidth.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] })
    : `${pct}%`;
  return (
    <View style={{ height, backgroundColor: '#EEF2FF', borderRadius: T.radius.pill, overflow: 'hidden' }}>
      <Animated.View style={{ height: '100%', width: widthInterp, backgroundColor: color, borderRadius: T.radius.pill }} />
    </View>
  );
}

function StatCard({ emoji, label, value, bg, border, textColor }) {
  return (
    <View style={{
      width: (width - 52) / 2, backgroundColor: bg, borderRadius: T.radius.xl,
      padding: 16, borderWidth: 1.5, borderColor: border, ...T.shadow.sm,
    }}>
      <Text style={{ fontSize: 24, marginBottom: 8 }}>{emoji}</Text>
      <Text style={{ fontSize: 28, fontWeight: '900', color: textColor, letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ fontSize: 12, color: T.textSec, marginTop: 3, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function MiniBar({ value }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ flex: 1, height: 6, backgroundColor: '#EEF2FF', borderRadius: T.radius.pill, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${Math.min(100, value)}%`, backgroundColor: pctColor(value), borderRadius: T.radius.pill }} />
      </View>
      <Text style={{ fontSize: 11, fontWeight: '800', color: pctColor(value), minWidth: 38, textAlign: 'right' }}>
        {typeof value === 'number' ? value.toFixed(1) : value}%
      </Text>
    </View>
  );
}

function StatusBadge({ pct }) {
  const c = pctColor(pct);
  const b = pctBg(pct);
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: T.radius.pill, backgroundColor: b }}>
      <Text style={{ fontSize: 10, fontWeight: '800', color: c }}>{statusLabel(pct)}</Text>
    </View>
  );
}

function Legend() {
  return (
    <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 4, paddingVertical: 8 }}>
      {[
        { color: T.green, label: 'Good ≥85%' },
        { color: T.amber, label: 'Average 75–84%' },
        { color: T.red,   label: 'Low <75%' },
      ].map(l => (
        <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: l.color }} />
          <Text style={{ fontSize: 10, color: T.textSec, fontWeight: '600' }}>{l.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Tab: Attendance Table ─────────────────────────────────────────────────────
function AttendanceTab({ data, loading, hasGenerated, selectedClass, startDate, endDate, sortAsc, setSortAsc }) {
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const sorted = useMemo(() =>
    [...data].sort((a, b) => sortAsc ? a.percentage - b.percentage : b.percentage - a.percentage),
    [data, sortAsc]);

  const totalPages    = Math.ceil(sorted.length / pageSize);
  const paginatedData = sorted.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [sorted.length]);

  if (loading) return <LoadingSpinner />;
  if (!hasGenerated) return <EmptyState />;
  if (sorted.length === 0) return <EmptyState msg="No records found for this period" />;

  return (
    <View>
      {/* Sort + page size controls */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <TouchableOpacity
          onPress={() => setSortAsc(!sortAsc)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: T.surface, borderRadius: T.radius.md, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: T.border }}
        >
          <Ionicons name="swap-vertical-outline" size={14} color={T.indigo} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: T.indigo }}>{sortAsc ? 'Low → High' : 'High → Low'}</Text>
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[10, 25, 50].map(ps => (
              <TouchableOpacity
                key={ps}
                onPress={() => { setPageSize(ps); setPage(1); }}
                style={{
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: T.radius.md,
                  backgroundColor: pageSize === ps ? T.indigo : T.surface,
                  borderWidth: 1, borderColor: pageSize === ps ? T.indigo : T.border,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: pageSize === ps ? '#fff' : T.textSec }}>{ps}/page</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Table header */}
      <View style={{ backgroundColor: T.slateLt, borderRadius: T.radius.md, padding: 10, flexDirection: 'row', marginBottom: 6 }}>
        <Text style={{ width: 28, fontSize: 10, fontWeight: '800', color: T.textSec }}>#</Text>
        <Text style={{ flex: 1, fontSize: 10, fontWeight: '800', color: T.textSec }}>STUDENT</Text>
        <Text style={{ width: 38, fontSize: 10, fontWeight: '800', color: T.textSec, textAlign: 'center' }}>P</Text>
        <Text style={{ width: 38, fontSize: 10, fontWeight: '800', color: T.textSec, textAlign: 'center' }}>A</Text>
        <Text style={{ width: 38, fontSize: 10, fontWeight: '800', color: T.textSec, textAlign: 'center' }}>L</Text>
        <Text style={{ width: 38, fontSize: 10, fontWeight: '800', color: T.textSec, textAlign: 'center' }}>TOT</Text>
        <Text style={{ width: 70, fontSize: 10, fontWeight: '800', color: T.textSec, textAlign: 'right' }}>ATT%</Text>
      </View>

      {paginatedData.map((row, i) => {
        const c = pctColor(row.percentage);
        const b = pctBg(row.percentage);
        return (
          <View key={row.studentId || row.id} style={{
            backgroundColor: T.surface, borderRadius: T.radius.md, padding: 10,
            marginBottom: 6, borderWidth: 1, borderColor: T.border,
            borderLeftWidth: 3, borderLeftColor: c,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ width: 28, fontSize: 12, color: T.textMut, fontWeight: '600' }}>{(page - 1) * pageSize + i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: T.textPri }} numberOfLines={1}>{row.studentName || row.name}</Text>
                <Text style={{ fontSize: 11, color: T.textSec, marginTop: 1 }}>{row.registerNumber || row.roll}</Text>
              </View>
              <Text style={{ width: 38, fontSize: 12, fontWeight: '700', color: T.green, textAlign: 'center' }}>{row.present}</Text>
              <Text style={{ width: 38, fontSize: 12, fontWeight: '700', color: T.red,   textAlign: 'center' }}>{row.absent}</Text>
              <Text style={{ width: 38, fontSize: 12, fontWeight: '700', color: T.amber, textAlign: 'center' }}>{row.late}</Text>
              <Text style={{ width: 38, fontSize: 12, fontWeight: '600', color: T.slate, textAlign: 'center' }}>{row.total}</Text>
              <View style={{ width: 70, alignItems: 'flex-end' }}>
                <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: T.radius.pill, backgroundColor: b }}>
                  <Text style={{ fontSize: 12, fontWeight: '900', color: c }}>{row.percentage}%</Text>
                </View>
              </View>
            </View>
            <View style={{ marginTop: 8 }}>
              <ProgressBar pct={row.percentage} color={c} height={4} />
            </View>
          </View>
        );
      })}

      {/* Pagination */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, padding: 12, backgroundColor: T.surface, borderRadius: T.radius.xl, borderWidth: 1, borderColor: T.border }}>
        <TouchableOpacity
          onPress={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: page === 1 ? 0.4 : 1 }}
        >
          <Ionicons name="chevron-back" size={16} color={T.indigo} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: T.indigo }}>Prev</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 13, color: T.textSec, fontWeight: '600' }}>Page {page} of {totalPages || 1}</Text>
        <TouchableOpacity
          onPress={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: (page === totalPages || totalPages === 0) ? 0.4 : 1 }}
        >
          <Text style={{ fontSize: 13, fontWeight: '700', color: T.indigo }}>Next</Text>
          <Ionicons name="chevron-forward" size={16} color={T.indigo} />
        </TouchableOpacity>
      </View>

      <Legend />
    </View>
  );
}

// ─── Tab: Low Attendance Alerts ───────────────────────────────────────────────
function AlertsTab({ data, loading, hasGenerated }) {
  const [threshold, setThreshold] = useState(75);

  const below = useMemo(() =>
    [...data].filter(r => r.percentage < threshold).sort((a, b) => a.percentage - b.percentage),
    [data, threshold]);

  if (loading) return <LoadingSpinner />;
  if (!hasGenerated) return <EmptyState />;

  return (
    <View>
      {/* Threshold control */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: T.amberLt, borderRadius: T.radius.lg,
        padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FCD34D',
      }}>
        <Ionicons name="warning-outline" size={18} color={T.amber} />
        <Text style={{ fontSize: 13, fontWeight: '700', color: T.amber }}>Alert threshold:</Text>
        <TextInput
          value={String(threshold)}
          onChangeText={(v) => setThreshold(Number(v) || 0)}
          keyboardType="numeric"
          style={{
            width: 60, borderWidth: 1.5, borderColor: T.amber, borderRadius: T.radius.md,
            paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, fontWeight: '800',
            color: T.amber, textAlign: 'center', backgroundColor: '#fff',
          }}
        />
        <Text style={{ fontSize: 13, fontWeight: '600', color: T.amber }}>%</Text>
      </View>

      {below.length === 0 ? (
        <View style={{ backgroundColor: T.greenLt, borderRadius: T.radius.xl, padding: 36, alignItems: 'center', borderWidth: 1.5, borderColor: '#6EE7B7' }}>
          <Text style={{ fontSize: 48, marginBottom: 10 }}>🎉</Text>
          <Text style={{ fontSize: 18, fontWeight: '900', color: T.green }}>All Students Passing!</Text>
          <Text style={{ fontSize: 13, color: '#059669', marginTop: 4, textAlign: 'center' }}>Every student is above {threshold}% threshold</Text>
        </View>
      ) : (
        <>
          <View style={{ backgroundColor: T.redLt, borderRadius: T.radius.lg, padding: 12, marginBottom: 16, borderWidth: 1.5, borderColor: '#FCA5A5', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="warning" size={20} color={T.red} />
            <View>
              <Text style={{ fontSize: 14, fontWeight: '800', color: T.red }}>{below.length} student{below.length !== 1 ? 's' : ''} below {threshold}%</Text>
              <Text style={{ fontSize: 12, color: '#B91C1C', fontWeight: '500' }}>Immediate attention required</Text>
            </View>
          </View>

          {below.map(item => {
            const needed   = Math.max(0, Math.ceil((threshold / 100 * item.total - item.present) / (1 - threshold / 100)));
            const shortfall = (threshold - item.percentage).toFixed(1);
            const initials  = (name) => (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            return (
              <View key={item.studentId || item.id} style={{
                backgroundColor: T.surface, borderRadius: T.radius.xl, marginBottom: 12,
                borderWidth: 1.5, borderColor: '#FCA5A5', overflow: 'hidden', ...T.shadow.sm,
              }}>
                <View style={{ height: 4, backgroundColor: T.red }} />
                <View style={{ padding: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: T.redLt, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1.5, borderColor: '#FCA5A5' }}>
                      <Text style={{ fontSize: 14, fontWeight: '900', color: T.red }}>{initials(item.studentName || item.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '800', color: T.textPri, fontSize: 14 }}>{item.studentName || item.name}</Text>
                      <Text style={{ color: T.textSec, fontSize: 12, marginTop: 1 }}>Reg: {item.registerNumber || item.roll}</Text>
                    </View>
                    <View style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: T.radius.pill, backgroundColor: T.redLt, borderWidth: 1.5, borderColor: '#FCA5A5' }}>
                      <Text style={{ fontSize: 17, fontWeight: '900', color: T.red }}>{item.percentage}%</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    {[
                      { v: `-${shortfall}%`, l: 'Shortfall',      bg: T.redLt,   c: T.red   },
                      { v: needed,           l: 'Classes Needed', bg: T.amberLt, c: T.amber },
                      { v: `${item.present}/${item.total}`, l: 'P/Total', bg: T.slateLt, c: T.slate },
                    ].map(s => (
                      <View key={s.l} style={{ flex: 1, backgroundColor: s.bg, borderRadius: T.radius.md, paddingVertical: 9, alignItems: 'center' }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: s.c }}>{s.v}</Text>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: s.c, marginTop: 2 }}>{s.l}</Text>
                      </View>
                    ))}
                  </View>
                  <ProgressBar pct={item.percentage} color={T.red} height={7} />
                </View>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

// ─── Tab: Subject-wise ────────────────────────────────────────────────────────
function SubjectTab({ subjectData, loading, hasGenerated, selectedClass }) {
  if (loading) return <LoadingSpinner />;
  if (!hasGenerated) return <EmptyState />;
  if (subjectData.length === 0) return <EmptyState msg="No subject-level data available" />;

  return (
    <View>
      {/* Subject cards */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
        {subjectData.map((s, i) => {
          const c = pctColor(s.percentage);
          const b = pctBg(s.percentage);
          return (
            <View key={s.subjectId || s.name} style={{
              width: (width - 52) / 2, backgroundColor: T.surface, borderRadius: T.radius.xl,
              padding: 14, borderWidth: 1.5, borderColor: T.border, borderLeftWidth: 4, borderLeftColor: c,
              ...T.shadow.sm,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                <Ionicons name="trending-up-outline" size={13} color={T.textSec} />
                <Text style={{ fontSize: 12, fontWeight: '800', color: T.textPri, flex: 1 }} numberOfLines={2}>{s.subjectName || s.name}</Text>
              </View>
              <Text style={{ fontSize: 26, fontWeight: '900', color: c, letterSpacing: -0.5 }}>{s.percentage}%</Text>
              <Text style={{ fontSize: 11, color: T.textSec, marginTop: 3 }}>{s.studentCount} students · {s.totalClasses} classes</Text>
              <View style={{ marginTop: 8 }}>
                <ProgressBar pct={s.percentage} color={c} height={5} />
              </View>
            </View>
          );
        })}
      </View>

      {/* Subject table */}
      <View style={{ backgroundColor: T.surface, borderRadius: T.radius.xl, borderWidth: 1, borderColor: T.border, overflow: 'hidden' }}>
        <View style={{ backgroundColor: T.slateLt, padding: 10, flexDirection: 'row' }}>
          <Text style={{ flex: 1, fontSize: 10, fontWeight: '800', color: T.textSec }}>SUBJECT</Text>
          <Text style={{ width: 44, fontSize: 10, fontWeight: '800', color: T.textSec, textAlign: 'center' }}>CLASSES</Text>
          <Text style={{ width: 44, fontSize: 10, fontWeight: '800', color: T.textSec, textAlign: 'center' }}>PRES</Text>
          <Text style={{ width: 44, fontSize: 10, fontWeight: '800', color: T.textSec, textAlign: 'center' }}>ABS</Text>
          <Text style={{ width: 60, fontSize: 10, fontWeight: '800', color: T.textSec, textAlign: 'right' }}>ATT%</Text>
        </View>
        {subjectData.map((s, i) => {
          const c = pctColor(s.percentage);
          return (
            <View key={s.subjectId || s.name} style={{
              padding: 12, flexDirection: 'row', alignItems: 'center',
              borderTopWidth: i === 0 ? 0 : 1, borderColor: T.border,
              backgroundColor: i % 2 === 0 ? '#fff' : T.bg,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: T.textPri }} numberOfLines={1}>{s.subjectName || s.name}</Text>
                <StatusBadge pct={s.percentage} />
              </View>
              <Text style={{ width: 44, fontSize: 12, textAlign: 'center', color: T.slate }}>{s.totalClasses}</Text>
              <Text style={{ width: 44, fontSize: 12, textAlign: 'center', color: T.green, fontWeight: '700' }}>{s.totalPresent}</Text>
              <Text style={{ width: 44, fontSize: 12, textAlign: 'center', color: T.red, fontWeight: '700' }}>{s.totalAbsent}</Text>
              <View style={{ width: 60, alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 14, fontWeight: '900', color: c }}>{s.percentage}%</Text>
              </View>
            </View>
          );
        })}
      </View>
      <Legend />
    </View>
  );
}

// ─── Tab: Student × Subject Matrix ───────────────────────────────────────────
function MatrixTab({ studentSubjData, subjectData, reportData, loading, hasGenerated }) {
  if (loading) return <LoadingSpinner />;
  if (!hasGenerated) return <EmptyState />;
  if (studentSubjData.length === 0) return <EmptyState msg="No subject-level data for this class" />;

  return (
    <View>
      <Text style={{ fontSize: 12, color: T.textSec, marginBottom: 12, fontWeight: '500' }}>
        Each student's attendance % per subject
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          {/* Header */}
          <View style={{ flexDirection: 'row', backgroundColor: T.slateLt, borderRadius: T.radius.md, padding: 8, marginBottom: 4 }}>
            <Text style={{ width: 28, fontSize: 10, fontWeight: '800', color: T.textSec }}>#</Text>
            <Text style={{ width: 120, fontSize: 10, fontWeight: '800', color: T.textSec }}>STUDENT</Text>
            <Text style={{ width: 90, fontSize: 10, fontWeight: '800', color: T.textSec }}>REG NO</Text>
            {subjectData.map(s => (
              <Text key={s.subjectId || s.name} style={{ width: 80, fontSize: 10, fontWeight: '800', color: T.textSec, textAlign: 'center' }} numberOfLines={2}>
                {(s.subjectName || s.name).slice(0, 12)}
              </Text>
            ))}
            <Text style={{ width: 80, fontSize: 10, fontWeight: '800', color: T.textSec, textAlign: 'center' }}>OVERALL</Text>
          </View>

          {studentSubjData.map((row, i) => {
            const overall = reportData.find(r => r.studentId === row.studentId)?.percentage ?? 0;
            return (
              <View key={row.studentId} style={{
                flexDirection: 'row', alignItems: 'center', padding: 8,
                backgroundColor: i % 2 === 0 ? '#fff' : T.bg,
                borderRadius: T.radius.md, marginBottom: 2,
                borderWidth: 1, borderColor: T.border,
              }}>
                <Text style={{ width: 28, fontSize: 11, color: T.textMut, fontWeight: '600' }}>{i + 1}</Text>
                <Text style={{ width: 120, fontSize: 12, fontWeight: '700', color: T.textPri }} numberOfLines={1}>{row.studentName}</Text>
                <Text style={{ width: 90, fontSize: 11, color: T.textSec }} numberOfLines={1}>{row.registerNumber}</Text>
                {subjectData.map(s => {
                  const sub = row.subjects?.[s.subjectId];
                  const pct = sub?.percentage ?? 0;
                  return (
                    <View key={s.subjectId || s.name} style={{ width: 80, alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: pctColor(pct) }}>{pct}%</Text>
                      <Text style={{ fontSize: 10, color: T.textMut }}>{sub ? `${sub.present}/${sub.total}` : '0/0'}</Text>
                    </View>
                  );
                })}
                <View style={{ width: 80, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: pctColor(overall) }}>{overall}%</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <Legend />
    </View>
  );
}

// ─── Tab: Monthly Trend ───────────────────────────────────────────────────────
function TrendTab({ monthlyData, loading, hasGenerated, selectedClass }) {
  if (loading) return <LoadingSpinner />;
  if (!hasGenerated) return <EmptyState />;
  if (monthlyData.length === 0) return <EmptyState msg="No monthly data for this range" />;

  const maxVal = Math.max(...monthlyData.map(m => m.percentage), 1);

  return (
    <View>
      {/* Bar chart */}
      <View style={{ backgroundColor: T.surface, borderRadius: T.radius.xl, padding: 16, marginBottom: 18, borderWidth: 1, borderColor: T.border }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: T.textPri, marginBottom: 16 }}>Monthly Attendance Trend</Text>

        {/* Grid lines */}
        {[100, 75, 50, 25].map(v => (
          <View key={v} style={{
            position: 'absolute', left: 16, right: 16,
            bottom: 56 + (v / 100) * 120,
            borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#E2E8F0',
          }}>
            <Text style={{ position: 'absolute', left: 0, top: -14, fontSize: 9, color: T.textMut }}>{v}%</Text>
          </View>
        ))}

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 160, paddingLeft: 28, paddingBottom: 36, borderBottomWidth: 1, borderColor: '#E2E8F0' }}>
          {monthlyData.map((m, i) => {
            const barH = Math.max((m.percentage / 100) * 120, 4);
            const c    = pctColor(m.percentage);
            return (
              <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: c, marginBottom: 3 }}>{m.percentage}%</Text>
                <View style={{ width: '70%', height: barH, backgroundColor: c, borderTopLeftRadius: 4, borderTopRightRadius: 4, opacity: 0.85 }} />
              </View>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', paddingLeft: 28, marginTop: 6 }}>
          {monthlyData.map((m, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 9, color: T.textSec, textAlign: 'center' }}>{m.month}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Monthly table */}
      <View style={{ backgroundColor: T.surface, borderRadius: T.radius.xl, borderWidth: 1, borderColor: T.border, overflow: 'hidden' }}>
        <View style={{ backgroundColor: T.slateLt, padding: 10, flexDirection: 'row' }}>
          <Text style={{ flex: 1, fontSize: 10, fontWeight: '800', color: T.textSec }}>MONTH</Text>
          <Text style={{ width: 44, fontSize: 10, fontWeight: '800', color: T.textSec, textAlign: 'center' }}>PRES</Text>
          <Text style={{ width: 44, fontSize: 10, fontWeight: '800', color: T.textSec, textAlign: 'center' }}>ABS</Text>
          <Text style={{ width: 44, fontSize: 10, fontWeight: '800', color: T.textSec, textAlign: 'center' }}>TOTAL</Text>
          <Text style={{ width: 70, fontSize: 10, fontWeight: '800', color: T.textSec, textAlign: 'right' }}>ATT%</Text>
          <Text style={{ width: 60, fontSize: 10, fontWeight: '800', color: T.textSec, textAlign: 'right' }}>vs PREV</Text>
        </View>
        {monthlyData.map((m, i) => {
          const prev = i > 0 ? monthlyData[i - 1].percentage : null;
          const diff = prev !== null ? m.percentage - prev : null;
          const c = pctColor(m.percentage);
          return (
            <View key={i} style={{ padding: 12, flexDirection: 'row', alignItems: 'center', borderTopWidth: i === 0 ? 0 : 1, borderColor: T.border, backgroundColor: i % 2 === 0 ? '#fff' : T.bg }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: T.textPri }}>{m.month}</Text>
                <StatusBadge pct={m.percentage} />
              </View>
              <Text style={{ width: 44, fontSize: 12, textAlign: 'center', color: T.green, fontWeight: '700' }}>{m.present}</Text>
              <Text style={{ width: 44, fontSize: 12, textAlign: 'center', color: T.red,   fontWeight: '700' }}>{m.absent}</Text>
              <Text style={{ width: 44, fontSize: 12, textAlign: 'center', color: T.slate }}>{m.total}</Text>
              <Text style={{ width: 70, fontSize: 14, fontWeight: '900', color: c, textAlign: 'right' }}>{m.percentage}%</Text>
              <Text style={{ width: 60, fontSize: 11, fontWeight: '700', textAlign: 'right',
                color: diff === null ? T.textMut : diff > 0 ? T.green : diff < 0 ? T.red : T.slate }}>
                {diff === null ? '—' : diff > 0 ? `↑+${diff.toFixed(1)}%` : diff < 0 ? `↓${diff.toFixed(1)}%` : '→'}
              </Text>
            </View>
          );
        })}
      </View>
      <Legend />
    </View>
  );
}

function LoadingSpinner({ msg = '' }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
      <ActivityIndicator color={T.indigo} size="large" />
      {!!msg && <Text style={{ fontSize: 13, color: T.textSec }}>{msg}</Text>}
    </View>
  );
}

function EmptyState({ msg = 'Select a class and date range, then tap Generate Report' }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
      <Ionicons name="document-text-outline" size={48} color={T.textMut} style={{ opacity: 0.4 }} />
      <Text style={{ fontSize: 13, color: T.textSec, textAlign: 'center' }}>{msg}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
const TeacherReportsScreen = ({ token: propToken, user: propUser, onBack, navigation }) => {
  const { token: ctxToken, user: ctxUser } = useAuth();
  const token = propToken || ctxToken;
  const user  = propUser  || ctxUser;

  const [classes,        setClasses]        = useState([]);
  const [selectedClass,  setSelectedClass]  = useState(null);
  const [reportData,     setReportData]     = useState([]);
  const [monthlyData,    setMonthlyData]    = useState([]);
  const [subjectData,    setSubjectData]    = useState([]);
  const [studentSubjData,setStudentSubjData]= useState([]);
  const [loading,        setLoading]        = useState(false);
  const [loadMessage,    setLoadMessage]    = useState('');
  const [hasGenerated,   setHasGenerated]   = useState(false);
  const [activeTab,      setActiveTab]      = useState('attendance');
  const [startDate,      setStartDate]      = useState('');
  const [endDate,        setEndDate]        = useState('');
  const [toast,          setToast]          = useState({ visible: false, message: '', type: 'success' });
  const [exporting,      setExporting]      = useState(false);
  const [sortAsc,        setSortAsc]        = useState(false);

  const showToast = useCallback((msg, type = 'success') => setToast({ visible: true, message: msg, type }), []);

  useEffect(() => {
    const r = getDateRange('30days');
    setStartDate(r.start);
    setEndDate(r.end);
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      const data = await api.get(`/timetable-assignments?user_id=${user?.id || ''}`, token);
      const list = Array.isArray(data) ? data : (data?.assignments || []);
      setClasses(buildClassMap(list));
    } catch (error) { console.log('Load error:', error); }
  };

  const generateReport = async (cls) => {
    if (!cls) return;
    setLoading(true); setReportData([]); setMonthlyData([]); setSubjectData([]); setStudentSubjData([]);
    setHasGenerated(false); setLoadMessage('Loading students...');
    try {
      const studentsData = await api.get(`/students?subcategory_id=${cls.subcategory_id}&item_id=${cls.item_id || ''}`, token);
      const studentList  = Array.isArray(studentsData) ? studentsData : [];
      if (studentList.length === 0) { showToast('No students found for this class', 'warning'); setLoading(false); return; }

      const studentIdSet = new Set(studentList.map(s => s.id));

      setLoadMessage('Fetching sessions...');
      let sessionsUrl = `/attendance/sessions?subcategory_id=${cls.subcategory_id}`;
      if (cls.item_id)  sessionsUrl += `&item_id=${cls.item_id}`;
      if (startDate)    sessionsUrl += `&startDate=${startDate}`;
      if (endDate)      sessionsUrl += `&endDate=${endDate}`;
      sessionsUrl += `&limit=5000`;

      const sessRes     = await api.get(sessionsUrl, token).catch(() => []);
      let   sessionList = Array.isArray(sessRes) ? sessRes : (sessRes?.data || []);

      // Client-side date filter
      const startMs = new Date(startDate).getTime();
      const endMs   = new Date(endDate + 'T23:59:59').getTime();
      sessionList = sessionList.filter(s => {
        const rawDate = s.date || s.session_date || s.created_at || '';
        if (!rawDate) return true;
        const d = new Date(rawDate).getTime();
        return d >= startMs && d <= endMs;
      });

      if (sessionList.length === 0) {
        showToast('No attendance records found for this period', 'warning');
        const zeroReport = studentList.map(student => ({
          studentId: student.id, studentName: student.full_name || 'Unknown',
          registerNumber: student.roll_number || '-',
          present: 0, absent: 0, late: 0, total: 0, percentage: 0,
          hasFace: hasFaceRegistered(student),
        }));
        setReportData(zeroReport); setHasGenerated(true); setLoading(false); return;
      }

      setLoadMessage(`Processing ${sessionList.length} sessions...`);
      const allRecords = await Promise.all(
        sessionList.map(s => api.get(`/attendance/sessions/${s.id}/records`, token).catch(() => []))
      );

      const statsMap        = new Map();
      const monthMap        = new Map();
      const subjectStatsMap = new Map();
      const studentSubjectMap = new Map();

      studentList.forEach(s => statsMap.set(s.id, { present: 0, absent: 0, late: 0, total: 0 }));

      allRecords.forEach((records, idx) => {
        const session     = sessionList[idx];
        const subjectId   = session?.subject_id;
        const subjectName = session?.subject_name || 'Unknown Subject';
        const sessionDateStr = session?.date || session?.session_date || session?.created_at || '';
        const list = Array.isArray(records) ? records : (records?.data || []);

        list.forEach(rec => {
          if (!rec.student_id || !studentIdSet.has(rec.student_id)) return;
          const cur = statsMap.get(rec.student_id) || { present: 0, absent: 0, late: 0, total: 0 };
          cur.total += 1;
          if      (rec.status === 'present') cur.present += 1;
          else if (rec.status === 'absent')  cur.absent  += 1;
          else if (rec.status === 'late')    cur.late    += 1;
          statsMap.set(rec.student_id, cur);

          // Monthly map
          if (sessionDateStr) {
            const d   = new Date(sessionDateStr);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const mc  = monthMap.get(key) || { present: 0, absent: 0, total: 0 };
            mc.total += 1;
            if (rec.status === 'present') mc.present += 1;
            else                          mc.absent  += 1;
            monthMap.set(key, mc);
          }

          // Subject map
          if (subjectId) {
            if (!subjectStatsMap.has(subjectId)) {
              subjectStatsMap.set(subjectId, { name: subjectName, totalClasses: 0, totalPresent: 0, totalAbsent: 0, studentSet: new Set() });
            }
            const ss = subjectStatsMap.get(subjectId);
            ss.totalClasses += 1;
            ss.studentSet.add(rec.student_id);
            if (rec.status === 'present') ss.totalPresent += 1;
            else                          ss.totalAbsent  += 1;

            if (!studentSubjectMap.has(rec.student_id)) studentSubjectMap.set(rec.student_id, new Map());
            const ssub     = studentSubjectMap.get(rec.student_id);
            const existing = ssub.get(subjectId) || { present: 0, absent: 0, total: 0 };
            existing.total += 1;
            if (rec.status === 'present') existing.present += 1;
            else                          existing.absent  += 1;
            ssub.set(subjectId, existing);
          }
        });
      });

      // Build report
      const report = studentList.map(student => {
        const stats = statsMap.get(student.id) || { present: 0, absent: 0, late: 0, total: 0 };
        const pct   = stats.total > 0 ? parseFloat(((stats.present / stats.total) * 100).toFixed(1)) : 0;
        return {
          studentId: student.id, studentName: student.full_name || 'Unknown',
          registerNumber: student.roll_number || student.register_number || '-',
          hasFace: hasFaceRegistered(student),
          ...stats, percentage: pct,
        };
      });
      setReportData(report);

      // Monthly trend
      const monthly = Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => {
          const [yr, mo] = key.split('-');
          return {
            month: `${MONTH_NAMES[parseInt(mo) - 1]} ${yr}`,
            present: val.present, absent: val.absent, total: val.total,
            percentage: val.total > 0 ? parseFloat(((val.present / val.total) * 100).toFixed(1)) : 0,
          };
        });
      setMonthlyData(monthly);

      // Subject data
      const subjRows = Array.from(subjectStatsMap.entries()).map(([subjectId, ss]) => ({
        subjectId, subjectName: ss.name, totalClasses: ss.totalClasses,
        totalPresent: ss.totalPresent, totalAbsent: ss.totalAbsent,
        percentage: ss.totalClasses > 0 ? parseFloat(((ss.totalPresent / ss.totalClasses) * 100).toFixed(1)) : 0,
        studentCount: ss.studentSet.size,
      }));
      setSubjectData(subjRows);

      // Student × subject matrix
      const matrixRows = studentList.map(student => {
        const subjects = {};
        subjRows.forEach(sub => {
          subjects[sub.subjectId] = { present: 0, absent: 0, total: 0, percentage: 0 };
        });
        const existing = studentSubjectMap.get(student.id);
        if (existing) {
          existing.forEach((val, subId) => {
            const pct = val.total > 0 ? parseFloat(((val.present / val.total) * 100).toFixed(1)) : 0;
            subjects[subId] = { ...val, percentage: pct };
          });
        }
        return {
          studentId: student.id, studentName: student.full_name || 'Unknown',
          registerNumber: student.roll_number || student.register_number || '-', subjects,
        };
      });
      setStudentSubjData(matrixRows);

      setHasGenerated(true);
      showToast(`Report generated — ${report.length} students · ${sessionList.length} sessions`, 'success');
    } catch (error) { showToast('Failed to generate report', 'error'); console.error(error); }
    finally { setLoading(false); setLoadMessage(''); }
  };

  // Computed stats
  const totalStudents = reportData.length;
  const above75  = reportData.filter(r => r.percentage >= 75).length;
  const below75  = reportData.filter(r => r.percentage < 75).length;
  const classAvg = totalStudents > 0
    ? parseFloat((reportData.reduce((s, r) => s + r.percentage, 0) / totalStudents).toFixed(1))
    : 0;
  const avgColor = pctColor(classAvg);

  const exportReport = async () => {
    if (reportData.length === 0) { showToast('No data to export', 'warning'); return; }
    setExporting(true);
    try {
      const tableRows = reportData.map((s, i) => `
        <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#ffffff'}">
          <td>${i + 1}</td>
          <td style="text-align:left;font-weight:600">${s.studentName}</td>
          <td>${s.registerNumber || '—'}</td>
          <td style="color:#059669;font-weight:700">${s.present}</td>
          <td style="color:#DC2626;font-weight:700">${s.absent}</td>
          <td style="color:#D97706;font-weight:700">${s.late}</td>
          <td style="font-weight:600">${s.total}</td>
          <td style="font-weight:800;color:${s.percentage >= 75 ? '#059669' : '#DC2626'}">${s.percentage}%</td>
        </tr>`).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <style>
        body{font-family:system-ui,sans-serif;margin:0;padding:28px;color:#0d1b3e;background:#f0f4ff}
        .card{background:#fff;border-radius:16px;padding:20px;margin-bottom:20px;box-shadow:0 2px 12px rgba(79,70,229,.08)}
        h1{font-size:24px;font-weight:900;color:#4F46E5;margin:0 0 4px}
        .subtitle{font-size:13px;color:#5a6a8a;margin-bottom:20px}
        .info-row{display:flex;gap:12px;flex-wrap:wrap}
        .info-box{background:#eef2ff;border-radius:10px;padding:10px 16px;flex:1;min-width:100px}
        .info-label{font-size:10px;color:#4F46E5;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
        .info-value{font-size:14px;font-weight:800;color:#0d1b3e;margin-top:3px}
        .summary{display:flex;gap:12px;flex-wrap:wrap}
        .sum-card{flex:1;min-width:100px;border-radius:12px;padding:16px;text-align:center}
        .sum-val{font-size:28px;font-weight:900}
        .sum-lbl{font-size:11px;font-weight:600;margin-top:4px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th{background:#4F46E5;color:#fff;padding:11px 10px;text-align:center;font-size:11px;font-weight:700;letter-spacing:.3px}
        td{padding:10px;text-align:center;border-bottom:1px solid #e8eeff}
        .footer{margin-top:24px;text-align:center;font-size:11px;color:#96a5c0}
      </style></head><body>
      <div class="card">
        <h1>📊 Attendance Report</h1>
        <div class="subtitle">Generated on ${new Date().toLocaleDateString()}</div>
        <div class="info-row">
          <div class="info-box"><div class="info-label">Class</div><div class="info-value">${selectedClass?.name || 'All'}</div></div>
          <div class="info-box"><div class="info-label">From</div><div class="info-value">${startDate}</div></div>
          <div class="info-box"><div class="info-label">To</div><div class="info-value">${endDate}</div></div>
        </div>
      </div>
      <div class="card">
        <div class="summary">
          <div class="sum-card" style="background:#eef2ff"><div class="sum-val" style="color:#4F46E5">${totalStudents}</div><div class="sum-lbl" style="color:#6366F1">Total Students</div></div>
          <div class="sum-card" style="background:#d1fae5"><div class="sum-val" style="color:#059669">${above75}</div><div class="sum-lbl" style="color:#059669">Above 75%</div></div>
          <div class="sum-card" style="background:#fee2e2"><div class="sum-val" style="color:#dc2626">${below75}</div><div class="sum-lbl" style="color:#dc2626">Below 75%</div></div>
          <div class="sum-card" style="background:#fef3c7"><div class="sum-val" style="color:#d97706">${classAvg}%</div><div class="sum-lbl" style="color:#d97706">Class Avg</div></div>
        </div>
      </div>
      <div class="card">
        <table>
          <thead><tr><th>#</th><th style="text-align:left">Student Name</th><th>Register No</th><th>Present</th><th>Absent</th><th>Late</th><th>Total</th><th>%</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <div class="footer">Attendance Report · ${new Date().toLocaleString()}</div>
      </body></html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Report - ${selectedClass?.name || 'Class'}`, UTI: 'com.adobe.pdf' });
      } else {
        Alert.alert('PDF Saved', `Report saved to:\n${uri}`);
      }
      showToast('PDF exported successfully!', 'success');
    } catch (error) { showToast('Failed to export PDF', 'error'); }
    finally { setExporting(false); }
  };

  // Tab definitions
  const TABS = [
    { key: 'attendance', label: 'Attendance', icon: 'document-text-outline' },
    { key: 'alerts',     label: `Alerts${below75 > 0 ? ` (${below75})` : ''}`, icon: 'warning-outline' },
    ...(subjectData.length > 0 ? [{ key: 'subjects', label: 'Subjects', icon: 'book-outline' }] : []),
    ...(studentSubjData.length > 0 ? [{ key: 'matrix', label: 'Matrix', icon: 'grid-outline' }] : []),
    { key: 'trend', label: 'Trend', icon: 'bar-chart-outline' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg }}>
      <PremiumToast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast(p => ({ ...p, visible: false }))} />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Hero Header ── */}
        <LinearGradient
          colors={['#0f172a', '#1e3a5f', '#1e40af']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingTop: Platform.OS === 'ios' ? 55 : 45, paddingBottom: 28, paddingHorizontal: 20, overflow: 'hidden' }}
        >
          <View style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(96,165,250,0.08)' }} />
          <View style={{ position: 'absolute', bottom: -30, left: -20, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(129,140,248,0.08)' }} />

          {onBack && (
            <TouchableOpacity
              onPress={onBack}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: T.radius.pill, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
            >
              <Ionicons name="arrow-back" size={16} color="#fff" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Back</Text>
            </TouchableOpacity>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <View style={{ height: 6, width: 32, borderRadius: T.radius.pill, backgroundColor: '#60a5fa' }} />
                <Text style={{ fontSize: 10, color: '#93c5fd', fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' }}>Teacher Portal</Text>
              </View>
              <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5 }}>My Class Reports</Text>
              <Text style={{ fontSize: 13, color: '#93c5fd', marginTop: 5, fontWeight: '500' }}>
                {selectedClass ? selectedClass.name : 'Select a class below'}
              </Text>
            </View>
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
              <Ionicons name="bar-chart" size={24} color="#fff" />
            </View>
          </View>

          {/* Summary chips */}
          {reportData.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
              {[
                { label: 'Students', value: totalStudents, bg: 'rgba(255,255,255,0.15)' },
                { label: 'Average',  value: `${classAvg}%`, bg: classAvg >= 75 ? 'rgba(16,185,129,0.3)' : 'rgba(220,38,38,0.3)' },
                { label: 'Good',     value: above75, bg: 'rgba(16,185,129,0.2)' },
                { label: 'Alert',    value: below75, bg: 'rgba(220,38,38,0.2)' },
              ].map((s, i) => (
                <View key={i} style={{ flex: 1, backgroundColor: s.bg, borderRadius: T.radius.lg, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', minWidth: 60 }}>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff' }}>{s.value}</Text>
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 2, fontWeight: '600' }}>{s.label}</Text>
                </View>
              ))}
            </View>
          )}
        </LinearGradient>

        <View style={{ paddingHorizontal: 16, paddingBottom: 36 }}>

          {/* ── Class Selector ── */}
          <View style={{ marginTop: 20, marginBottom: 20 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: T.textSec, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>Select Class</Text>
            {classes.length === 0 ? (
              <View style={{ borderRadius: T.radius.xl, padding: 28, alignItems: 'center', backgroundColor: T.surface, borderWidth: 1, borderColor: T.border }}>
                <Ionicons name="school-outline" size={28} color={T.indigo} style={{ marginBottom: 8 }} />
                <Text style={{ color: T.textPri, fontWeight: '700' }}>No classes found</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 4 }}>
                  {classes.map((cls, idx) => {
                    const cc       = CLASS_PALETTE[idx % CLASS_PALETTE.length];
                    const isActive = selectedClass?.id === cls.id;
                    return (
                      <TouchableOpacity
                        key={cls.id}
                        onPress={() => { setSelectedClass(cls); generateReport(cls); }}
                        activeOpacity={0.85}
                        style={{ width: 130, borderRadius: T.radius.xl, backgroundColor: isActive ? cc.color : T.surface, borderWidth: isActive ? 0 : 1.5, borderColor: cc.color, padding: 16, alignItems: 'center', ...(isActive ? T.shadow.md : T.shadow.sm), shadowColor: cc.color }}
                      >
                        <LinearGradient
                          colors={isActive ? ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)'] : cc.grad}
                          style={{ width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}
                        >
                          <Ionicons name="school" size={22} color="#fff" />
                        </LinearGradient>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: isActive ? '#fff' : T.textPri, textAlign: 'center' }} numberOfLines={2}>{cls.name}</Text>
                        {isActive && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.8)' }} />
                            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '700' }}>Selected</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>

          {/* ── Date Range Filters ── */}
          <View style={{ backgroundColor: T.surface, borderRadius: T.radius.xl, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: T.border, ...T.shadow.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: T.indigoLt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="calendar-outline" size={16} color={T.indigo} />
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '800', color: T.textPri }}>Date Range</Text>
                <Text style={{ fontSize: 11, color: T.textSec, fontWeight: '500' }}>Filter attendance period</Text>
              </View>
            </View>

            {/* Quick presets */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  { label: 'Last 30d',    range: '30days'    },
                  { label: 'This month',  range: 'thismonth' },
                  { label: 'Last 3m',     range: '3months'   },
                ].map(p => (
                  <TouchableOpacity
                    key={p.range}
                    onPress={() => { const r = getDateRange(p.range); setStartDate(r.start); setEndDate(r.end); }}
                    style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: T.radius.pill, backgroundColor: T.indigoLt, borderWidth: 1, borderColor: '#C7D2FE' }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: T.indigo }}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[
                { label: 'From', value: startDate, onChange: setStartDate },
                { label: 'To',   value: endDate,   onChange: setEndDate   },
              ].map(f => (
                <View key={f.label} style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: T.textSec, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.label}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: T.bg, borderRadius: T.radius.md, borderWidth: 1.5, borderColor: T.border, paddingHorizontal: 11 }}>
                    <Ionicons name="calendar-outline" size={14} color={T.textSec} style={{ marginRight: 7 }} />
                    <TextInput
                      style={{ flex: 1, paddingVertical: 10, fontSize: 13, color: T.textPri, fontWeight: '500' }}
                      value={f.value} onChangeText={f.onChange}
                      placeholder="YYYY-MM-DD" placeholderTextColor={T.textMut}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* ── Action Buttons ── */}
          {selectedClass && (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              <TouchableOpacity
                style={{ flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: T.indigo, borderRadius: T.radius.lg, paddingVertical: 14, ...T.shadow.md, shadowColor: T.indigo }}
                onPress={() => generateReport(selectedClass)} disabled={loading}
              >
                {loading
                  ? <><ActivityIndicator color="#fff" size="small" /><Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>{loadMessage || 'Loading...'}</Text></>
                  : <><Ionicons name="bar-chart" size={18} color="#fff" /><Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>Generate Report</Text></>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: reportData.length > 0 ? T.green : T.slateLt, borderRadius: T.radius.lg, paddingVertical: 14, ...(reportData.length > 0 ? { ...T.shadow.md, shadowColor: T.green } : {}) }}
                onPress={exportReport} disabled={exporting || reportData.length === 0}
              >
                {exporting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><Ionicons name="document-text-outline" size={16} color={reportData.length > 0 ? '#fff' : T.slate} /><Text style={{ color: reportData.length > 0 ? '#fff' : T.slate, fontSize: 13, fontWeight: '800' }}>PDF</Text></>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* ── Loading Skeleton ── */}
          {loading && (
            <View style={{ backgroundColor: T.surface, borderRadius: T.radius.xl, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: T.border }}>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                {[0, 1, 2, 3].map(i => <SkeletonBox key={i} width={(width - 92) / 4} height={80} radius={16} />)}
              </View>
              {[0, 1, 2, 3].map(i => <View key={i} style={{ marginBottom: 12 }}><SkeletonBox width="100%" height={70} radius={14} /></View>)}
            </View>
          )}

          {/* ── Report Data ── */}
          {!loading && hasGenerated && reportData.length > 0 && (
            <>
              {/* Stat cards */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                <StatCard emoji="👥" label="Total Students" value={totalStudents} bg={T.indigoLt}                            border="#C7D2FE" textColor={T.indigo} />
                <StatCard emoji="📈" label="Class Average"  value={`${classAvg}%`} bg={classAvg >= 75 ? T.greenLt : T.redLt} border={classAvg >= 75 ? '#6EE7B7' : '#FCA5A5'} textColor={avgColor} />
                <StatCard emoji="✅" label="Above 75%"      value={above75}         bg={T.greenLt}                            border="#6EE7B7" textColor={T.green} />
                <StatCard emoji="⚠️" label="Below 75%"      value={below75}         bg={T.redLt}                              border="#FCA5A5" textColor={T.red} />
              </View>

              {/* Class average bar */}
              <View style={{ backgroundColor: T.surface, borderRadius: T.radius.xl, padding: 18, marginBottom: 18, borderWidth: 1, borderColor: T.border, ...T.shadow.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <View>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: T.textSec, textTransform: 'uppercase', letterSpacing: 0.5 }}>Class Average</Text>
                    <Text style={{ fontSize: 13, color: T.textPri, fontWeight: '600', marginTop: 2 }}>{selectedClass?.name}</Text>
                  </View>
                  <Text style={{ fontSize: 38, fontWeight: '900', color: avgColor, letterSpacing: -1 }}>{classAvg}%</Text>
                </View>
                <ProgressBar pct={Math.min(classAvg, 100)} color={avgColor} height={10} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: T.textSec, fontWeight: '600' }}>
                    {classAvg >= 85 ? '🎉 Excellent performance!'
                      : classAvg >= 75 ? '👍 Good standing'
                      : '🚨 Needs improvement'}
                  </Text>
                  <Text style={{ fontSize: 11, color: T.textMut }}>{startDate} – {endDate}</Text>
                </View>
              </View>

              {/* Tab bar */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
                <View style={{ flexDirection: 'row', gap: 6, backgroundColor: T.slateLt, borderRadius: T.radius.xl, padding: 4 }}>
                  {TABS.map(tab => (
                    <TouchableOpacity
                      key={tab.key}
                      onPress={() => setActiveTab(tab.key)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 5,
                        paddingHorizontal: 14, paddingVertical: 9, borderRadius: T.radius.lg,
                        backgroundColor: activeTab === tab.key ? T.surface : 'transparent',
                        ...(activeTab === tab.key ? T.shadow.sm : {}),
                      }}
                    >
                      <Ionicons name={tab.icon} size={13} color={activeTab === tab.key ? T.indigo : T.textSec} />
                      <Text style={{ fontSize: 12, fontWeight: '800', color: activeTab === tab.key ? T.indigo : T.textSec, whiteSpace: 'nowrap' }}>
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Tab content */}
              {activeTab === 'attendance' && (
                <AttendanceTab
                  data={reportData} loading={loading} hasGenerated={hasGenerated}
                  selectedClass={selectedClass} startDate={startDate} endDate={endDate}
                  sortAsc={sortAsc} setSortAsc={setSortAsc}
                />
              )}
              {activeTab === 'alerts' && (
                <AlertsTab data={reportData} loading={loading} hasGenerated={hasGenerated} />
              )}
              {activeTab === 'subjects' && (
                <SubjectTab subjectData={subjectData} loading={loading} hasGenerated={hasGenerated} selectedClass={selectedClass} />
              )}
              {activeTab === 'matrix' && (
                <MatrixTab studentSubjData={studentSubjData} subjectData={subjectData} reportData={reportData} loading={loading} hasGenerated={hasGenerated} />
              )}
              {activeTab === 'trend' && (
                <TrendTab monthlyData={monthlyData} loading={loading} hasGenerated={hasGenerated} selectedClass={selectedClass} />
              )}
            </>
          )}

          {/* Empty states */}
          {!loading && hasGenerated && reportData.length === 0 && selectedClass && (
            <View style={{ backgroundColor: T.surface, borderRadius: T.radius.xl, padding: 36, alignItems: 'center', borderWidth: 1, borderColor: T.border }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: T.indigoLt, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <Ionicons name="clipboard-outline" size={30} color={T.indigo} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '800', color: T.textPri }}>No Report Data</Text>
              <Text style={{ fontSize: 13, color: T.textSec, marginTop: 5, textAlign: 'center' }}>No attendance records found for this period</Text>
            </View>
          )}
          {!loading && !selectedClass && (
            <View style={{ backgroundColor: T.surface, borderRadius: T.radius.xl, padding: 40, alignItems: 'center', borderWidth: 1.5, borderColor: T.border, borderStyle: 'dashed' }}>
              <View style={{ width: 68, height: 68, borderRadius: 22, backgroundColor: T.indigoLt, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <Ionicons name="school-outline" size={32} color={T.indigo} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '800', color: T.textPri }}>Select a Class</Text>
              <Text style={{ fontSize: 13, color: T.textSec, marginTop: 5, textAlign: 'center' }}>Choose a class above to generate attendance report</Text>
            </View>
          )}

          {/* Footer */}
          <View style={{ marginTop: 24, alignItems: 'center' }}>
            <Text style={{ fontSize: 11, color: T.textMut, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' }}>
              ETAM · Education &amp; Attendance Management
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TeacherReportsScreen;