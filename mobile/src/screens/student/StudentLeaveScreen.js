import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, RefreshControl, Animated, Platform,
  Alert, KeyboardAvoidingView, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../api/client';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  bg:        '#F0FDF9',
  surface:   '#FFFFFF',
  border:    '#D1FAE5',
  borderGray:'#E5E7EB',
  textPri:   '#0D1B3E',
  textSec:   '#4B5563',
  textMut:   '#9CA3AF',
  green:     '#059669',
  greenLt:   '#D1FAE5',
  greenDark: '#065F46',
  indigo:    '#4F46E5',
  indigoLt:  '#EEF2FF',
  amber:     '#D97706',
  amberLt:   '#FEF3C7',
  red:       '#DC2626',
  redLt:     '#FEE2E2',
  radius: { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 },
  shadow: {
    sm: { shadowColor: '#059669', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const toDateInput = (d) => d.toISOString().split('T')[0];

const calcDays = (from, to) => {
  if (!from || !to) return 0;
  const a = new Date(from);
  const b = new Date(to);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1);
};

const LEAVE_TYPES = [
  { val: 'medical',  label: 'Medical',  icon: 'medkit-outline',     color: '#1D4ED8', bg: '#EFF6FF' },
  { val: 'personal', label: 'Personal', icon: 'person-outline',     color: '#7C3AED', bg: '#F3E8FF' },
  { val: 'family',   label: 'Family',   icon: 'heart-outline',      color: '#BE185D', bg: '#FCE7F3' },
  { val: 'other',    label: 'Other',    icon: 'ellipsis-horizontal', color: '#4B5563', bg: '#F3F4F6' },
];

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: '#92400E', bg: '#FEF3C7', dot: '#D97706' },
  approved:  { label: 'Approved',  color: '#065F46', bg: '#D1FAE5', dot: '#059669' },
  rejected:  { label: 'Rejected',  color: '#991B1B', bg: '#FEE2E2', dot: '#DC2626' },
  cancelled: { label: 'Cancelled', color: '#374151', bg: '#F3F4F6', dot: '#9CA3AF' },
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Simple Date Picker ───────────────────────────────────────────────────────
const SimpleDatePicker = ({ value, onChange, minDate }) => {
  const [show, setShow] = useState(false);
  const d = value ? new Date(value) : new Date();
  const displayVal = value
    ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
    : 'Select date';

  const today = new Date();
  const years = [];
  for (let y = today.getFullYear(); y <= today.getFullYear() + 1; y++) years.push(y);

  const [selYear,  setSelYear]  = useState(d.getFullYear());
  const [selMonth, setSelMonth] = useState(d.getMonth());
  const [selDay,   setSelDay]   = useState(d.getDate());

  const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const applyDate = () => {
    const chosen = new Date(selYear, selMonth, selDay);
    if (minDate && chosen < new Date(minDate)) {
      Alert.alert('Invalid date', 'Date cannot be before start date');
      return;
    }
    onChange(toDateInput(chosen));
    setShow(false);
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => { setSelYear(d.getFullYear()); setSelMonth(d.getMonth()); setSelDay(d.getDate()); setShow(true); }}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: T.bg, borderRadius: T.radius.md,
          borderWidth: 0.5, borderColor: T.border,
          paddingHorizontal: 12, paddingVertical: 10,
        }}
      >
        <Ionicons name="calendar-outline" size={16} color={T.green} />
        <Text style={{ fontSize: 13, color: value ? T.textPri : T.textMut, flex: 1 }}>{displayVal}</Text>
        <Ionicons name="chevron-down" size={14} color={T.textMut} />
      </TouchableOpacity>

      <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: T.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: T.borderGray }}>
              <TouchableOpacity onPress={() => setShow(false)}>
                <Text style={{ fontSize: 14, color: T.textSec }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 15, fontWeight: '600', color: T.textPri }}>Select Date</Text>
              <TouchableOpacity onPress={applyDate}>
                <Text style={{ fontSize: 14, color: T.green, fontWeight: '600' }}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <ScrollView style={{ flex: 1, maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                {days.map(day => (
                  <TouchableOpacity key={day} onPress={() => setSelDay(day)} style={{ paddingVertical: 10, alignItems: 'center', backgroundColor: selDay === day ? T.greenLt : 'transparent' }}>
                    <Text style={{ fontSize: 15, color: selDay === day ? T.greenDark : T.textPri, fontWeight: selDay === day ? '700' : '400' }}>{day}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <ScrollView style={{ flex: 2, maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                {MONTHS.map((m, i) => (
                  <TouchableOpacity key={m} onPress={() => setSelMonth(i)} style={{ paddingVertical: 10, alignItems: 'center', backgroundColor: selMonth === i ? T.greenLt : 'transparent' }}>
                    <Text style={{ fontSize: 15, color: selMonth === i ? T.greenDark : T.textPri, fontWeight: selMonth === i ? '700' : '400' }}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <ScrollView style={{ flex: 1.5, maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                {years.map(y => (
                  <TouchableOpacity key={y} onPress={() => setSelYear(y)} style={{ paddingVertical: 10, alignItems: 'center', backgroundColor: selYear === y ? T.greenLt : 'transparent' }}>
                    <Text style={{ fontSize: 15, color: selYear === y ? T.greenDark : T.textPri, fontWeight: selYear === y ? '700' : '400' }}>{y}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.bg, paddingHorizontal: 9, paddingVertical: 4, borderRadius: T.radius.pill }}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.dot }} />
      <Text style={{ fontSize: 10, fontWeight: '700', color: c.color }}>{c.label}</Text>
    </View>
  );
};

// ─── History Row ──────────────────────────────────────────────────────────────
const HistoryRow = ({ leave, onCancel, cancelling }) => {
  const lt = LEAVE_TYPES.find(l => l.val === leave.leave_type) ?? LEAVE_TYPES[3];
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={{ borderBottomWidth: 0.5, borderBottomColor: T.borderGray }}>
      <TouchableOpacity
        onPress={() => setExpanded(v => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 }}
        activeOpacity={0.7}
      >
        <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: lt.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={lt.icon} size={18} color={lt.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: T.textPri }}>{lt.label} leave</Text>
          <Text style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>
            {formatDate(leave.from_date)}
            {leave.from_date !== leave.to_date ? ` → ${formatDate(leave.to_date)}` : ''}
            {' · '}{leave.no_of_days} day{leave.no_of_days !== 1 ? 's' : ''}
          </Text>
        </View>
        <StatusBadge status={leave.status} />
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={T.textMut} style={{ marginLeft: 4 }} />
      </TouchableOpacity>

      {expanded && (
        <View style={{ marginHorizontal: 14, marginBottom: 12, backgroundColor: T.bg, borderRadius: T.radius.md, borderWidth: 0.5, borderColor: T.border, padding: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: T.textMut, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 }}>Reason</Text>
          <Text style={{ fontSize: 13, color: T.textPri, lineHeight: 19 }}>{leave.reason}</Text>

          {leave.reject_reason ? (
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                <Ionicons name="close-circle" size={14} color={T.red} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#991B1B', textTransform: 'uppercase', letterSpacing: 0.6 }}>Rejection reason</Text>
              </View>
              <Text style={{ fontSize: 12, color: '#B91C1C', lineHeight: 18, backgroundColor: T.redLt, padding: 8, borderRadius: T.radius.sm }}>
                {leave.reject_reason}
              </Text>
            </View>
          ) : null}

          {leave.approved_at && leave.status === 'approved' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
              <Ionicons name="checkmark-circle" size={14} color={T.green} />
              <Text style={{ fontSize: 11, color: T.green }}>Approved on {formatDate(leave.approved_at)}</Text>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
            <Ionicons name="time-outline" size={12} color={T.textMut} />
            <Text style={{ fontSize: 11, color: T.textMut }}>Applied {formatDate(leave.applied_at)}</Text>
          </View>

          {leave.status === 'pending' ? (
            <TouchableOpacity
              onPress={() => {
                Alert.alert('Cancel Leave', 'Are you sure you want to cancel this leave request?', [
                  { text: 'No', style: 'cancel' },
                  { text: 'Yes, cancel', style: 'destructive', onPress: () => onCancel(leave.id) },
                ]);
              }}
              disabled={cancelling === leave.id}
              style={{
                marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 6, paddingVertical: 9, borderRadius: T.radius.md,
                backgroundColor: T.redLt, borderWidth: 0.5, borderColor: '#FECACA',
                opacity: cancelling === leave.id ? 0.6 : 1,
              }}
            >
              {cancelling === leave.id
                ? <ActivityIndicator size="small" color={T.red} />
                : <Ionicons name="close-circle-outline" size={15} color={T.red} />
              }
              <Text style={{ fontSize: 12, fontWeight: '600', color: T.red }}>
                {cancelling === leave.id ? 'Cancelling…' : 'Cancel this request'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );
};

// ─── Apply Form ───────────────────────────────────────────────────────────────
const ApplyForm = ({ onSubmit, submitting }) => {
  const today = toDateInput(new Date());
  const [leaveType, setLeaveType] = useState('medical');
  const [fromDate,  setFromDate]  = useState(today);
  const [toDate,    setToDate]    = useState(today);
  const [reason,    setReason]    = useState('');

  const days = calcDays(fromDate, toDate);

  const handleFromChange = (val) => {
    setFromDate(val);
    if (toDate < val) setToDate(val);
  };

  const handleSubmit = async () => {
    if (!fromDate || !toDate) { Alert.alert('Required', 'Please select both from and to dates.'); return; }
    if (!reason.trim()) { Alert.alert('Required', 'Please enter a reason for your leave.'); return; }
    if (reason.trim().length < 10) { Alert.alert('Too short', 'Please provide a more detailed reason (at least 10 characters).'); return; }
    await onSubmit({ leave_type: leaveType, from_date: fromDate, to_date: toDate, reason: reason.trim() });
  };

  return (
    <View style={{ backgroundColor: T.surface, borderRadius: T.radius.xl, borderWidth: 0.5, borderColor: T.border, padding: 16, marginBottom: 12, ...T.shadow.sm }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: T.textMut, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Leave type</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {LEAVE_TYPES.map(lt => (
          <TouchableOpacity
            key={lt.val}
            onPress={() => setLeaveType(lt.val)}
            style={{
              flex: 1, minWidth: '45%', flexDirection: 'row', alignItems: 'center', gap: 7,
              paddingHorizontal: 12, paddingVertical: 9, borderRadius: T.radius.md,
              backgroundColor: leaveType === lt.val ? lt.bg : T.bg,
              borderWidth: 1, borderColor: leaveType === lt.val ? lt.color : T.borderGray,
            }}
          >
            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: leaveType === lt.val ? lt.color + '22' : T.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={lt.icon} size={15} color={lt.color} />
            </View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: leaveType === lt.val ? lt.color : T.textSec }}>{lt.label}</Text>
            {leaveType === lt.val && <Ionicons name="checkmark-circle" size={14} color={lt.color} style={{ marginLeft: 'auto' }} />}
          </TouchableOpacity>
        ))}
      </View>

      <Text style={{ fontSize: 11, fontWeight: '700', color: T.textMut, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Dates</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: T.textSec, marginBottom: 5 }}>From</Text>
          <SimpleDatePicker value={fromDate} onChange={handleFromChange} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, color: T.textSec, marginBottom: 5 }}>To</Text>
          <SimpleDatePicker value={toDate} onChange={setToDate} minDate={fromDate} />
        </View>
      </View>

      {days > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.indigoLt, borderRadius: T.radius.md, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14, borderWidth: 0.5, borderColor: '#C7D2FE' }}>
          <Ionicons name="time-outline" size={14} color={T.indigo} />
          <Text style={{ fontSize: 12, color: T.indigo, fontWeight: '500' }}>
            Duration: <Text style={{ fontWeight: '700' }}>{days} day{days !== 1 ? 's' : ''}</Text>
            {days > 5 && <Text style={{ fontWeight: '400', color: '#6366F1' }}> · Long leave — expect verification</Text>}
          </Text>
        </View>
      )}

      <Text style={{ fontSize: 11, fontWeight: '700', color: T.textMut, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Reason</Text>
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder="Describe your reason for leave clearly…"
        placeholderTextColor={T.textMut}
        multiline
        numberOfLines={4}
        style={{ backgroundColor: T.bg, borderRadius: T.radius.md, borderWidth: 0.5, borderColor: T.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: T.textPri, minHeight: 80, textAlignVertical: 'top', lineHeight: 20, marginBottom: 14 }}
      />
      <Text style={{ fontSize: 10, color: T.textMut, textAlign: 'right', marginTop: -10, marginBottom: 12 }}>{reason.length} characters</Text>

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={submitting}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: T.radius.lg, backgroundColor: submitting ? '#6EE7B7' : T.green, opacity: submitting ? 0.75 : 1 }}
      >
        {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={17} color="#fff" />}
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>{submitting ? 'Submitting…' : 'Submit Leave Request'}</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── Success Toast ────────────────────────────────────────────────────────────
const SuccessToast = ({ visible, onHide }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(2500),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => onHide());
    }
  }, [visible]);

  if (!visible) return null;
  return (
    <Animated.View style={{
      position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, left: 20, right: 20, opacity,
      backgroundColor: '#065F46', borderRadius: T.radius.lg, padding: 14,
      flexDirection: 'row', alignItems: 'center', gap: 10,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
    }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="checkmark-circle" size={18} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Leave applied successfully!</Text>
        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>Your teacher will be notified.</Text>
      </View>
      <TouchableOpacity onPress={onHide}>
        <Ionicons name="close" size={16} color="rgba(255,255,255,0.6)" />
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Main Student Leave Screen ────────────────────────────────────────────────
const StudentLeaveScreen = ({ token, user, onNavigate, onBack }) => {
  const [leaves,       setLeaves]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [cancelling,   setCancelling]   = useState(null);
  const [showSuccess,  setShowSuccess]  = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadLeaves();
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const loadLeaves = async (silent = false) => {
    try {
      if (!silent) setLoading(true); else setRefreshing(true);
      const data = await api.get('/leave-requests', token);
      setLeaves(Array.isArray(data) ? data : []);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to load leaves');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const stats = {
    total:    leaves.length,
    approved: leaves.filter(l => l.status === 'approved').length,
    pending:  leaves.filter(l => l.status === 'pending').length,
    rejected: leaves.filter(l => l.status === 'rejected').length,
  };

  const filteredLeaves = leaves
    .filter(l => filterStatus === 'all' ? true : l.status === filterStatus)
    .sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime());

  const handleApply = async (payload) => {
    try {
      setSubmitting(true);
      const newLeave = await api.post('/leave-requests', payload, token);
      setLeaves(prev => [newLeave, ...prev]);
      setShowSuccess(true);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    try {
      setCancelling(id);
      await api.delete(`/leave-requests/${id}`, token);
      setLeaves(prev => prev.map(l => l.id === id ? { ...l, status: 'cancelled' } : l));
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to cancel leave');
    } finally {
      setCancelling(null);
    }
  };

  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });

  // Time-based greeting — same pattern as StudentDashboard
  const hour = new Date().getHours();
  const greeting   = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const greetIcon  = hour < 12 ? 'sunny-outline' : hour < 17 ? 'partly-sunny-outline' : 'moon-outline';
  const studentName = user?.full_name?.split(' ')[0] || 'Student';

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>

      {/* ══════════════════════════════════════════════════════════════
          HERO HEADER — Sky blue matching StudentDashboard / Timetable
      ═══════════════════════════════════════════════════════════════ */}
      <View style={{
        backgroundColor: '#0EA5E9',
        paddingTop: Platform.OS === 'ios' ? 52 : 40,
        paddingBottom: 22,
        paddingHorizontal: 20,
        overflow: 'hidden',
        shadowColor: '#0369A1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 14,
        elevation: 8,
      }}>
        {/* Decorative circles */}
        <View style={{ position: 'absolute', right: -24, top: -24, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)' }} />
        <View style={{ position: 'absolute', bottom: -16, right: 50, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.05)' }} />
        <View style={{ position: 'absolute', left: -20, bottom: -20, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.04)' }} />

        {/* Top row: back + title + refresh */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          {/* Back Button */}
          <TouchableOpacity
            onPress={onBack}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center', justifyContent: 'center',
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>

          {/* Title */}
          <View style={{ flex: 1, alignItems: 'center', marginHorizontal: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
              <Ionicons name={greetIcon} size={12} color="rgba(255,255,255,0.75)" />
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: '600', letterSpacing: 0.5 }}>
                {greeting}, {studentName}
              </Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.3 }}>
              My Leaves
            </Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
              {user?.full_name || 'Student'}
              {user?.register_number ? `  ·  ${user.register_number}` : ''}
            </Text>
          </View>

          {/* Refresh Button */}
          <TouchableOpacity
            onPress={() => loadLeaves(true)}
            disabled={refreshing}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center', justifyContent: 'center',
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={18} color="#fff" style={{ opacity: refreshing ? 0.5 : 1 }} />
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            { label: 'Applied',  value: stats.total    },
            { label: 'Approved', value: stats.approved },
            { label: 'Pending',  value: stats.pending  },
            { label: 'Rejected', value: stats.rejected },
          ].map(s => (
            <View key={s.label} style={{
              flex: 1,
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: 12,
              paddingVertical: 10,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
            }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>{s.value}</Text>
              <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontWeight: '600' }}>{s.label}</Text>
            </View>
          ))}
        </View>

        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 10, textAlign: 'right' }}>{todayLabel}</Text>
      </View>

      {/* ══ BODY ══ */}
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadLeaves(true)}
                tintColor="#0EA5E9"
                colors={['#0EA5E9']}
              />
            }
          >
            {/* Apply Form header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: T.greenLt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="add-circle-outline" size={16} color={T.green} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: T.textPri }}>Apply for leave</Text>
            </View>

            <ApplyForm onSubmit={handleApply} submitting={submitting} />

            {/* Tip */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: T.amberLt, borderRadius: T.radius.md, borderWidth: 0.5, borderColor: '#FCD34D', padding: 12, marginBottom: 18 }}>
              <Ionicons name="information-circle-outline" size={16} color={T.amber} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 }}>
                Submit leave requests at least{' '}
                <Text style={{ fontWeight: '700' }}>3 days in advance</Text>{' '}
                for planned leaves. Medical leaves can be applied within 24 hours.
              </Text>
            </View>

            {/* History header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: T.indigoLt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="time-outline" size={16} color={T.indigo} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: T.textPri }}>My leave history</Text>
            </View>

            {/* Filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {[
                { val: 'all',      label: `All (${stats.total})` },
                { val: 'pending',  label: `Pending (${stats.pending})` },
                { val: 'approved', label: `Approved (${stats.approved})` },
                { val: 'rejected', label: `Rejected (${stats.rejected})` },
              ].map(c => (
                <TouchableOpacity
                  key={c.val}
                  onPress={() => setFilterStatus(c.val)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 7,
                    borderRadius: T.radius.pill, marginRight: 6,
                    backgroundColor: filterStatus === c.val ? '#0EA5E9' : T.surface,
                    borderWidth: 0.5,
                    borderColor: filterStatus === c.val ? '#0EA5E9' : T.borderGray,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: filterStatus === c.val ? '#fff' : T.textSec }}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {loading ? (
              <View style={{ backgroundColor: T.surface, borderRadius: T.radius.xl, borderWidth: 0.5, borderColor: T.borderGray, padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#0EA5E9" />
                <Text style={{ fontSize: 13, color: T.textSec, marginTop: 12 }}>Loading your leaves…</Text>
              </View>
            ) : filteredLeaves.length === 0 ? (
              <View style={{ backgroundColor: T.surface, borderRadius: T.radius.xl, borderWidth: 0.5, borderColor: T.borderGray, padding: 48, alignItems: 'center' }}>
                <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Ionicons name="calendar-outline" size={26} color="#0EA5E9" />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: T.textPri }}>
                  {filterStatus === 'all' ? 'No leaves yet' : `No ${filterStatus} leaves`}
                </Text>
                <Text style={{ fontSize: 12, color: T.textMut, marginTop: 5 }}>
                  {filterStatus === 'all' ? 'Apply for a leave above when needed' : 'Tap "All" to see all your leaves'}
                </Text>
              </View>
            ) : (
              <View style={{ backgroundColor: T.surface, borderRadius: T.radius.xl, borderWidth: 0.5, borderColor: T.borderGray, overflow: 'hidden', ...T.shadow.sm }}>
                {filteredLeaves.map(leave => (
                  <HistoryRow key={leave.id} leave={leave} onCancel={handleCancel} cancelling={cancelling} />
                ))}
                <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: T.borderGray, backgroundColor: '#F0F9FF', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {[
                    { dot: T.green, label: `${stats.approved} approved` },
                    { dot: T.amber, label: `${stats.pending} pending`   },
                    { dot: T.red,   label: `${stats.rejected} rejected`  },
                  ].map(s => (
                    <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: s.dot }} />
                      <Text style={{ fontSize: 10, color: T.textMut }}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>

      <SuccessToast visible={showSuccess} onHide={() => setShowSuccess(false)} />
    </View>
  );
};

export default StudentLeaveScreen;