import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, RefreshControl, Animated, Platform,
  Alert, KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../api/client';

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
  amber:    '#D97706',
  amberLt:  '#FEF3C7',
  red:      '#DC2626',
  redLt:    '#FEE2E2',
  slate:    '#64748B',
  slateLt:  '#F1F5F9',
  radius: { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 },
  shadow: {
    sm: { shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6,  elevation: 2 },
    md: { shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 4 },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const initials = (name) =>
  name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const daysSince = (dateStr) =>
  Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);

const AVATAR_PALETTE = [
  { bg: '#EEF2FF', text: '#4F46E5' },
  { bg: '#F3E8FF', text: '#7C3AED' },
  { bg: '#D1FAE5', text: '#059669' },
  { bg: '#FFE4E6', text: '#E11D48' },
  { bg: '#FEF3C7', text: '#D97706' },
  { bg: '#CFFAFE', text: '#0E7490' },
];

function avatarStyle(name) {
  let h = 0;
  for (let i = 0; i < (name?.length ?? 0); i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

const LEAVE_TYPE_CONFIG = {
  medical:  { label: 'Medical',  color: '#1D4ED8', bg: '#EFF6FF' },
  personal: { label: 'Personal', color: '#6D28D9', bg: '#F3E8FF' },
  family:   { label: 'Family',   color: '#BE185D', bg: '#FCE7F3' },
  other:    { label: 'Other',    color: '#4B5563', bg: '#F3F4F6' },
};

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: '#92400E', bg: '#FEF3C7', dot: '#D97706' },
  approved:  { label: 'Approved',  color: '#065F46', bg: '#D1FAE5', dot: '#059669' },
  rejected:  { label: 'Rejected',  color: '#991B1B', bg: '#FEE2E2', dot: '#DC2626' },
  cancelled: { label: 'Cancelled', color: '#374151', bg: '#F3F4F6', dot: '#9CA3AF' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const MetricCard = ({ label, value, iconName, iconColor, iconBg, subtitle }) => (
  <View style={{
    flex: 1, backgroundColor: T.surface, borderRadius: T.radius.lg,
    borderWidth: 0.5, borderColor: T.border, padding: 12, ...T.shadow.sm,
  }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <Text style={{ fontSize: 10, color: T.textSec, fontWeight: '600' }}>{label}</Text>
      <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={iconName} size={14} color={iconColor} />
      </View>
    </View>
    <Text style={{ fontSize: 22, fontWeight: '700', color: T.textPri }}>{value}</Text>
    {subtitle && <Text style={{ fontSize: 10, color: T.textMut, marginTop: 2 }}>{subtitle}</Text>}
  </View>
);

const LeaveTypeBadge = ({ type }) => {
  const c = LEAVE_TYPE_CONFIG[type] ?? LEAVE_TYPE_CONFIG.other;
  return (
    <View style={{ backgroundColor: c.bg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: T.radius.pill }}>
      <Text style={{ fontSize: 10, fontWeight: '600', color: c.color }}>{c.label}</Text>
    </View>
  );
};

const StatusBadge = ({ status }) => {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: T.radius.pill }}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.dot }} />
      <Text style={{ fontSize: 10, fontWeight: '700', color: c.color }}>{c.label}</Text>
    </View>
  );
};

const UrgencyBadge = ({ appliedAt }) => {
  const days = daysSince(appliedAt);
  if (days < 1) return (
    <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: T.radius.pill }}>
      <Text style={{ fontSize: 9, fontWeight: '800', color: '#1D4ED8' }}>NEW</Text>
    </View>
  );
  if (days >= 2) return (
    <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: T.radius.pill }}>
      <Text style={{ fontSize: 9, fontWeight: '800', color: '#991B1B' }}>{days}d</Text>
    </View>
  );
  return null;
};

const FilterChip = ({ label, active, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      paddingHorizontal: 14, paddingVertical: 7,
      borderRadius: T.radius.pill, marginRight: 6,
      backgroundColor: active ? T.indigo : T.surface,
      borderWidth: 0.5, borderColor: active ? T.indigo : T.border,
    }}
  >
    <Text style={{ fontSize: 11, fontWeight: '600', color: active ? '#fff' : T.textSec }}>
      {label}
    </Text>
  </TouchableOpacity>
);

// ─── Leave Row ────────────────────────────────────────────────────────────────
const LeaveRow = ({ leave, onView, onApprove, onReject }) => {
  const av = avatarStyle(leave.student_name);
  return (
    <TouchableOpacity
      onPress={() => onView(leave)}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 14, paddingVertical: 12,
        borderBottomWidth: 0.5, borderBottomColor: T.border,
      }}
      activeOpacity={0.7}
    >
      <View style={{
        width: 40, height: 40, borderRadius: 11,
        backgroundColor: av.bg, alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: av.text }}>
          {initials(leave.student_name)}
        </Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: T.textPri }} numberOfLines={1}>
            {leave.student_name}
          </Text>
          {leave.status === 'pending' && <UrgencyBadge appliedAt={leave.applied_at} />}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
          {leave.register_number && (
            <Text style={{ fontSize: 10, color: T.textMut, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
              {leave.register_number}
            </Text>
          )}
          {leave.item_name && <Text style={{ fontSize: 10, color: T.textMut }}>{leave.item_name}</Text>}
          <LeaveTypeBadge type={leave.leave_type} />
        </View>
      </View>

      <View style={{ alignItems: 'flex-end', marginRight: 6 }}>
        <Text style={{ fontSize: 11, color: T.textSec }}>{formatDate(leave.from_date)}</Text>
        {leave.from_date !== leave.to_date && (
          <Text style={{ fontSize: 10, color: T.textMut }}>→ {formatDate(leave.to_date)}</Text>
        )}
        <Text style={{ fontSize: 10, fontWeight: '700', color: T.indigo, marginTop: 2 }}>
          {leave.no_of_days}d
        </Text>
      </View>

      <StatusBadge status={leave.status} />

      {leave.status === 'pending' && (
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <TouchableOpacity
            onPress={() => onApprove(leave)}
            style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: T.greenLt, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="checkmark" size={16} color={T.green} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onReject(leave)}
            style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: T.redLt, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={16} color={T.red} />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ─── Detail View ──────────────────────────────────────────────────────────────
const LeaveDetailView = ({ leave, onBack, onApprove, onReject, approving, rejecting }) => {
  const [rejectReason,   setRejectReason]   = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const av = avatarStyle(leave.student_name);

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      Alert.alert('Required', 'Please enter a rejection reason.');
      return;
    }
    await onReject(leave.id, rejectReason.trim());
  };

  const infoItems = [
    { label: 'Class',          value: [leave.category_name, leave.item_name].filter(Boolean).join(' · ') || '—' },
    { label: 'Department',     value: leave.subcategory_name || '—' },
    { label: 'Residence',      value: leave.residence_type?.replace('_', ' ') || '—' },
    { label: 'From',           value: formatDate(leave.from_date) },
    { label: 'To',             value: formatDate(leave.to_date) },
    { label: 'Duration',       value: `${leave.no_of_days} day${leave.no_of_days !== 1 ? 's' : ''}` },
    { label: 'Applied On',     value: formatDate(leave.applied_at) },
    { label: 'Parent Contact', value: leave.parent_contact || '—' },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: T.bg }}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      >
        {/* Back bar */}
        <TouchableOpacity
          onPress={onBack}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: T.surface, borderRadius: T.radius.lg,
            borderWidth: 0.5, borderColor: T.border, padding: 12,
            marginBottom: 14, ...T.shadow.sm,
          }}
        >
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: T.indigoLt, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-back" size={18} color={T.indigo} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: T.textPri }}>{leave.student_name}</Text>
              <LeaveTypeBadge type={leave.leave_type} />
              <StatusBadge status={leave.status} />
            </View>
            <Text style={{ fontSize: 11, color: T.textMut, marginTop: 2 }}>
              {leave.register_number ? `${leave.register_number} · ` : ''}Applied {formatDate(leave.applied_at)}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Student card */}
        <View style={{
          backgroundColor: T.surface, borderRadius: T.radius.xl,
          borderWidth: 0.5, borderColor: T.border,
          overflow: 'hidden', marginBottom: 12, ...T.shadow.sm,
        }}>
          <LinearGradient
            colors={[T.indigo, '#7C3AED']}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}
          >
            <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#fff' }}>{initials(leave.student_name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>{leave.student_name}</Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                {[leave.register_number, leave.category_name, leave.item_name].filter(Boolean).join(' · ')}
              </Text>
              {leave.parent_contact ? (
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                  📞 {leave.parent_contact}
                </Text>
              ) : null}
            </View>
          </LinearGradient>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {infoItems.map((item, i) => (
              <View
                key={item.label}
                style={{
                  width: '50%', padding: 12,
                  borderRightWidth: i % 2 === 0 ? 0.5 : 0,
                  borderBottomWidth: i < infoItems.length - 2 ? 0.5 : 0,
                  borderColor: T.border,
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: '700', color: T.textMut, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>
                  {item.label}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '500', color: T.textPri, textTransform: 'capitalize' }}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Reason */}
        <View style={{
          backgroundColor: T.surface, borderRadius: T.radius.xl,
          borderWidth: 0.5, borderColor: T.border, padding: 16,
          marginBottom: 12, ...T.shadow.sm,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <View style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: T.indigo }} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: T.textPri }}>Reason for Leave</Text>
          </View>
          <View style={{ backgroundColor: T.bg, borderRadius: T.radius.md, padding: 12, borderWidth: 0.5, borderColor: T.border }}>
            <Text style={{ fontSize: 13, color: T.textPri, lineHeight: 20 }}>{leave.reason}</Text>
          </View>
        </View>

        {/* Existing reject reason */}
        {leave.reject_reason ? (
          <View style={{
            backgroundColor: T.redLt, borderRadius: T.radius.xl,
            borderWidth: 0.5, borderColor: '#FECACA', padding: 14, marginBottom: 12,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name="close-circle" size={16} color={T.red} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#991B1B' }}>Rejection Reason</Text>
            </View>
            <Text style={{ fontSize: 13, color: '#991B1B', lineHeight: 20 }}>{leave.reject_reason}</Text>
          </View>
        ) : null}

        {/* Reject form */}
        {showRejectForm ? (
          <View style={{
            backgroundColor: T.surface, borderRadius: T.radius.xl,
            borderWidth: 0.5, borderColor: '#FECACA', padding: 14,
            marginBottom: 12, ...T.shadow.sm,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Ionicons name="alert-circle" size={16} color={T.red} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#991B1B' }}>Rejection Reason *</Text>
            </View>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Enter reason for rejection..."
              placeholderTextColor={T.textMut}
              multiline
              numberOfLines={4}
              style={{
                backgroundColor: T.bg, borderRadius: T.radius.md,
                borderWidth: 0.5, borderColor: '#FECACA',
                padding: 10, fontSize: 13, color: T.textPri,
                minHeight: 80, textAlignVertical: 'top',
              }}
            />
          </View>
        ) : null}

        {/* Action buttons */}
        {leave.status === 'pending' ? (
          <View style={{
            backgroundColor: T.surface, borderRadius: T.radius.xl,
            borderWidth: 0.5, borderColor: T.border, padding: 14, ...T.shadow.sm,
          }}>
            {!showRejectForm ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setShowRejectForm(true)}
                  style={{
                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 6, paddingVertical: 12, borderRadius: T.radius.md,
                    backgroundColor: T.redLt, borderWidth: 0.5, borderColor: '#FECACA',
                  }}
                >
                  <Ionicons name="ban" size={16} color={T.red} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: T.red }}>Reject Leave</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onApprove(leave.id)}
                  disabled={approving}
                  style={{
                    flex: 1.2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 6, paddingVertical: 12, borderRadius: T.radius.md,
                    backgroundColor: approving ? '#6EE7B7' : T.green,
                    opacity: approving ? 0.7 : 1,
                  }}
                >
                  {approving
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  }
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>
                    {approving ? 'Approving…' : 'Approve Leave'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => { setShowRejectForm(false); setRejectReason(''); }}
                  style={{
                    flex: 1, alignItems: 'center', justifyContent: 'center',
                    paddingVertical: 12, borderRadius: T.radius.md,
                    backgroundColor: T.bg, borderWidth: 0.5, borderColor: T.border,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '500', color: T.textSec }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleReject}
                  disabled={rejecting || !rejectReason.trim()}
                  style={{
                    flex: 1.2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 6, paddingVertical: 12, borderRadius: T.radius.md,
                    backgroundColor: rejecting ? '#F87171' : T.red,
                    opacity: rejecting || !rejectReason.trim() ? 0.6 : 1,
                  }}
                >
                  {rejecting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="ban" size={16} color="#fff" />
                  }
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>
                    {rejecting ? 'Rejecting…' : 'Confirm Rejection'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const TeacherLeaveManagementScreen = ({ token, user, onNavigate, onBack, navigation }) => {
  const [step,          setStep]          = useState('list');
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [leaves,        setLeaves]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [approving,     setApproving]     = useState(false);
  const [rejecting,     setRejecting]     = useState(false);
  const [search,        setSearch]        = useState('');
  const [filterStatus,  setFilterStatus]  = useState('all');
  const [filterType,    setFilterType]    = useState('all');
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
      Alert.alert('Error', err.message || 'Failed to load leave requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const stats = useMemo(() => ({
    total:    leaves.length,
    pending:  leaves.filter(l => l.status === 'pending').length,
    approved: leaves.filter(l => l.status === 'approved').length,
    rejected: leaves.filter(l => l.status === 'rejected').length,
    students: new Set(leaves.map(l => l.student_id)).size,
  }), [leaves]);

  const filteredLeaves = useMemo(() => {
    let data = [...leaves];
    const q = search.trim().toLowerCase();
    if (q) {
      data = data.filter(l =>
        l.student_name?.toLowerCase().includes(q) ||
        l.register_number?.toLowerCase().includes(q) ||
        l.item_name?.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') data = data.filter(l => l.status === filterStatus);
    if (filterType !== 'all')   data = data.filter(l => l.leave_type === filterType);
    return data.sort((a, b) =>
      new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime()
    );
  }, [leaves, search, filterStatus, filterType]);

  const handleApprove = async (id) => {
    try {
      setApproving(true);
      await api.put(`/leave-requests/${id}/approve`, {}, token);
      setLeaves(prev => prev.map(l =>
        l.id === id ? { ...l, status: 'approved', approved_at: new Date().toISOString() } : l
      ));
      if (selectedLeave?.id === id) {
        setSelectedLeave(prev => prev ? { ...prev, status: 'approved' } : null);
      }
      Alert.alert('✅ Approved', 'Leave approved! Student will be notified.');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to approve leave');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (id, reason) => {
    try {
      setRejecting(true);
      await api.put(`/leave-requests/${id}/reject`, { reason }, token);
      setLeaves(prev => prev.map(l =>
        l.id === id ? { ...l, status: 'rejected', reject_reason: reason } : l
      ));
      setStep('list');
      setSelectedLeave(null);
      Alert.alert('Rejected', 'Leave rejected. Student will be notified.');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to reject leave');
    } finally {
      setRejecting(false);
    }
  };

  const handleViewLeave   = (leave) => { setSelectedLeave(leave); setStep('detail'); };
  const handleQuickReject = (leave) => { setSelectedLeave(leave); setStep('detail'); };
  const handleBack        = () => { setStep('list'); setSelectedLeave(null); };

  // ── Unified back: goes to list if in detail, else exits the screen ─────────
  const handleScreenBack = () => {
    if (typeof onBack === 'function') { onBack(); return; }
    if (navigation?.canGoBack?.())   { navigation.goBack(); return; }
    navigation?.navigate?.('Home');
  };

  // ── Detail view ────────────────────────────────────────────────────────────
  if (step === 'detail' && selectedLeave) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <LinearGradient
          colors={['#1E1B4B', '#3730A3', '#4F46E5']}
          style={{ paddingTop: Platform.OS === 'ios' ? 55 : 40, paddingBottom: 16, paddingHorizontal: 20 }}
        >
          {/* Back button row */}
          <TouchableOpacity
            onPress={handleBack}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              alignSelf: 'flex-start', marginBottom: 12,
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: T.radius.pill, paddingHorizontal: 12, paddingVertical: 6,
            }}
          >
            <Ionicons name="arrow-back" size={15} color="#fff" />
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Leave Requests</Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>Leave Detail</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 3 }}>Review and take action</Text>
        </LinearGradient>

        <LeaveDetailView
          leave={selectedLeave}
          onBack={handleBack}
          onApprove={handleApprove}
          onReject={handleReject}
          approving={approving}
          rejecting={rejecting}
        />

        {selectedLeave.status === 'pending' ? (
          <View style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            backgroundColor: 'rgba(255,255,255,0.97)',
            borderTopWidth: 0.5, borderTopColor: T.border,
            paddingHorizontal: 16, paddingVertical: 12,
            paddingBottom: Platform.OS === 'ios' ? 28 : 12,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: T.textPri }} numberOfLines={1}>
                {selectedLeave.student_name}
              </Text>
              <Text style={{ fontSize: 10, color: T.textSec }}>
                {selectedLeave.no_of_days}d {selectedLeave.leave_type} · {formatDate(selectedLeave.from_date)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleApprove(selectedLeave.id)}
              disabled={approving}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: T.green, paddingHorizontal: 16, paddingVertical: 10,
                borderRadius: T.radius.md, opacity: approving ? 0.6 : 1,
              }}
            >
              {approving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="checkmark-circle" size={16} color="#fff" />
              }
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Approve</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {/* Hero Header */}
      <LinearGradient
        colors={['#1E1B4B', '#3730A3', '#4F46E5']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ paddingTop: Platform.OS === 'ios' ? 55 : 40, paddingBottom: 20, paddingHorizontal: 20 }}
      >
        {/* ── Back button ── */}
        <TouchableOpacity
          onPress={handleScreenBack}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            alignSelf: 'flex-start', marginBottom: 14,
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: T.radius.pill, paddingHorizontal: 12, paddingVertical: 6,
          }}
        >
          <Ionicons name="arrow-back" size={15} color="#fff" />
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>Back</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>
              Teacher Portal
            </Text>
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#fff', letterSpacing: -0.5 }}>
              Leave Management
            </Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>{todayStr}</Text>
          </View>
          <TouchableOpacity
            onPress={() => loadLeaves(true)}
            disabled={refreshing}
            style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="refresh" size={18} color="#fff" style={{ opacity: refreshing ? 0.5 : 1 }} />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          {[
            { label: 'Total',    value: stats.total },
            { label: 'Pending',  value: stats.pending },
            { label: 'Approved', value: stats.approved },
            { label: 'Rejected', value: stats.rejected },
          ].map(s => (
            <View key={s.label} style={{
              flex: 1, backgroundColor: 'rgba(255,255,255,0.12)',
              borderRadius: T.radius.md, padding: 10, alignItems: 'center',
              borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
            }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>{s.value}</Text>
              <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', marginTop: 2, fontWeight: '600' }}>{s.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 14, paddingBottom: stats.pending > 0 ? 90 : 30 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadLeaves(true)} tintColor={T.indigo} />}
        >
          {/* Metric cards */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            <MetricCard label="Total students" value={stats.students} iconName="people-outline" iconColor="#7C3AED" iconBg="#F3E8FF" subtitle="with requests" />
            <MetricCard label="Pending review" value={stats.pending} iconName="time-outline" iconColor={T.amber} iconBg={T.amberLt} subtitle="need action" />
          </View>

          {/* Search */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: T.surface, borderRadius: T.radius.lg,
            borderWidth: 0.5, borderColor: T.border,
            paddingHorizontal: 12, paddingVertical: 8,
            marginBottom: 10, ...T.shadow.sm,
          }}>
            <Ionicons name="search-outline" size={16} color={T.textMut} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search name, register no, class…"
              placeholderTextColor={T.textMut}
              style={{ flex: 1, fontSize: 13, color: T.textPri }}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={T.textMut} />
              </TouchableOpacity>
            )}
          </View>

          {/* Status filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {[
              { val: 'all',      label: `All (${stats.total})` },
              { val: 'pending',  label: `Pending (${stats.pending})` },
              { val: 'approved', label: `Approved (${stats.approved})` },
              { val: 'rejected', label: `Rejected (${stats.rejected})` },
            ].map(c => (
              <FilterChip key={c.val} label={c.label} active={filterStatus === c.val} onPress={() => setFilterStatus(c.val)} />
            ))}
          </ScrollView>

          {/* Type filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {['all', 'medical', 'personal', 'family', 'other'].map(v => (
              <FilterChip
                key={v}
                label={v === 'all' ? 'All types' : v.charAt(0).toUpperCase() + v.slice(1)}
                active={filterType === v}
                onPress={() => setFilterType(v)}
              />
            ))}
          </ScrollView>

          <Text style={{ fontSize: 11, color: T.textMut, marginBottom: 8 }}>
            Showing <Text style={{ fontWeight: '600', color: T.textSec }}>{filteredLeaves.length}</Text> of{' '}
            <Text style={{ fontWeight: '600', color: T.textSec }}>{leaves.length}</Text> requests
          </Text>

          {/* List */}
          {loading ? (
            <View style={{ backgroundColor: T.surface, borderRadius: T.radius.xl, borderWidth: 0.5, borderColor: T.border, padding: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={T.indigo} />
              <Text style={{ fontSize: 13, color: T.textSec, marginTop: 12 }}>Loading leave requests…</Text>
            </View>
          ) : filteredLeaves.length === 0 ? (
            <View style={{ backgroundColor: T.surface, borderRadius: T.radius.xl, borderWidth: 0.5, borderColor: T.border, padding: 48, alignItems: 'center' }}>
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: T.indigoLt, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Ionicons name="document-text-outline" size={26} color={T.indigo} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: '600', color: T.textPri }}>No requests found</Text>
              <Text style={{ fontSize: 12, color: T.textMut, marginTop: 5, textAlign: 'center' }}>
                {search || filterStatus !== 'all' || filterType !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No leave requests submitted yet'}
              </Text>
            </View>
          ) : (
            <View style={{ backgroundColor: T.surface, borderRadius: T.radius.xl, borderWidth: 0.5, borderColor: T.border, overflow: 'hidden', ...T.shadow.sm }}>
              <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: T.border, backgroundColor: T.bg }}>
                <Text style={{ flex: 1, fontSize: 9, fontWeight: '700', color: T.textMut, textTransform: 'uppercase', letterSpacing: 0.8 }}>Student</Text>
                <Text style={{ fontSize: 9, fontWeight: '700', color: T.textMut, textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 60 }}>Status</Text>
              </View>

              {filteredLeaves.map(leave => (
                <LeaveRow
                  key={leave.id}
                  leave={leave}
                  onView={handleViewLeave}
                  onApprove={l => handleApprove(l.id)}
                  onReject={handleQuickReject}
                />
              ))}

              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 14, paddingVertical: 10,
                borderTopWidth: 0.5, borderTopColor: T.border, backgroundColor: T.bg,
              }}>
                <Text style={{ fontSize: 11, color: T.textMut }}>
                  {filteredLeaves.length} request{filteredLeaves.length !== 1 ? 's' : ''}
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {[
                    { dot: T.amber, label: `${stats.pending} pending` },
                    { dot: T.green, label: `${stats.approved} approved` },
                    { dot: T.red,   label: `${stats.rejected} rejected` },
                  ].map(s => (
                    <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: s.dot }} />
                      <Text style={{ fontSize: 10, color: T.textMut }}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* Sticky bottom bar */}
      {stats.pending > 0 && (
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: 'rgba(255,255,255,0.97)',
          borderTopWidth: 0.5, borderTopColor: T.border,
          paddingHorizontal: 16, paddingVertical: 12,
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <View>
            <Text style={{ fontSize: 13, fontWeight: '500', color: T.textPri }}>
              <Text style={{ color: T.amber, fontWeight: '700' }}>{stats.pending} pending</Text>
              {'  ·  '}
              <Text style={{ color: T.green }}>{stats.approved} approved</Text>
            </Text>
            <Text style={{ fontSize: 10, color: T.textMut, marginTop: 2 }}>Tap a request to review and act</Text>
          </View>
          <TouchableOpacity
            onPress={() => setFilterStatus('pending')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.amber, paddingHorizontal: 14, paddingVertical: 10, borderRadius: T.radius.md }}
          >
            <Ionicons name="time" size={15} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>Review Pending</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default TeacherLeaveManagementScreen;