import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import TeacherLayout from '@/components/layouts/TeacherLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  FileText, CheckCircle, XCircle, Clock, Users,
  Search, RefreshCw, Shield, CalendarDays,
  ChevronRight, Eye, Check, Ban,
  Stethoscope, User, Heart, Star, Bell, AlertCircle,
  ArrowLeft, SlidersHorizontal, X,
  BookOpen, Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ─────────────────────────────────────────────────────────────────────────────
// API base — reads from your .env VITE_API_URL or falls back to localhost
// ─────────────────────────────────────────────────────────────────────────────
const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api';

function getToken(): string {
  return localStorage.getItem('auth_token') || '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type LeaveStatus   = 'pending' | 'approved' | 'rejected' | 'cancelled';
type LeaveType     = 'medical' | 'personal' | 'family' | 'other';
type ResidenceType = 'day_scholar' | 'hostel';

interface LeaveRequest {
  id:                string;
  student_id:        string;
  student_name:      string;
  register_number?:  string;
  student_email?:    string;
  category_name?:    string;
  subcategory_name?: string;
  item_name?:        string;
  residence_type?:   ResidenceType;
  leave_type:        LeaveType;
  from_date:         string;
  to_date:           string;
  no_of_days:        number;
  reason:            string;
  status:            LeaveStatus;
  reject_reason?:    string;
  applied_at:        string;
  approved_at?:      string;
  parent_contact?:   string;
}

// ─────────────────────────────────────────────────────────────────────────────
// REAL API functions — these call your Express backend
// ─────────────────────────────────────────────────────────────────────────────

async function fetchLeaveRequests(): Promise<LeaveRequest[]> {
  const res = await fetch(`${API_BASE}/leave-requests`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch leave requests');
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function approveLeaveRequest(leaveId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/leave-requests/${leaveId}/approve`, {
    method:  'PUT',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to approve leave');
  }
}

async function rejectLeaveRequest(leaveId: string, reason: string): Promise<void> {
  const res = await fetch(`${API_BASE}/leave-requests/${leaveId}/reject`, {
    method:  'PUT',
    headers: {
      Authorization:  `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to reject leave');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const initials = (name: string) =>
  name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const daysSince = (dateStr: string) =>
  Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);

const AVATAR_PALETTE = [
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700' },
];

function avatarStyle(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function MetricCard({ label, value, icon: Icon, iconBg, iconColor, subtitle, loading }: {
  label: string; value: number; icon: any; iconBg: string; iconColor: string;
  subtitle?: string; loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <Skeleton className="h-3 w-20 mb-4 bg-gray-100" />
        <Skeleton className="h-7 w-14 mb-2 bg-gray-100" />
        <Skeleton className="h-3 w-16 bg-gray-100" />
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-400">{label}</span>
        <div className={`p-2 rounded-lg ${iconBg}`}>
          <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function LeaveTypeBadge({ type }: { type: LeaveType }) {
  const map: Record<LeaveType, { label: string; icon: React.ReactNode; cls: string }> = {
    medical:  { label: 'Medical',  icon: <Stethoscope className="w-3 h-3" />, cls: 'bg-blue-50 text-blue-600 border-blue-100'     },
    personal: { label: 'Personal', icon: <User className="w-3 h-3" />,        cls: 'bg-violet-50 text-violet-600 border-violet-100' },
    family:   { label: 'Family',   icon: <Heart className="w-3 h-3" />,       cls: 'bg-rose-50 text-rose-600 border-rose-100'      },
    other:    { label: 'Other',    icon: <Star className="w-3 h-3" />,        cls: 'bg-gray-50 text-gray-500 border-gray-100'      },
  };
  const c = map[type] ?? map['other'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.cls}`}>
      {c.icon} {c.label}
    </span>
  );
}

function StatusBadge({ status }: { status: LeaveStatus }) {
  const map: Record<LeaveStatus, { label: string; cls: string; dot: string }> = {
    pending:   { label: 'Pending',   cls: 'bg-amber-50 text-amber-700 border-amber-100',       dot: 'bg-amber-500'   },
    approved:  { label: 'Approved',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' },
    rejected:  { label: 'Rejected',  cls: 'bg-red-50 text-red-600 border-red-100',             dot: 'bg-red-500'     },
    cancelled: { label: 'Cancelled', cls: 'bg-gray-50 text-gray-500 border-gray-100',          dot: 'bg-gray-400'    },
  };
  const c = map[status] ?? map['pending'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function UrgencyBadge({ appliedAt }: { appliedAt: string }) {
  const days = daysSince(appliedAt);
  if (days < 1) return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
      <Bell className="w-2.5 h-2.5" /> New
    </span>
  );
  if (days >= 2) return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-100">
      <AlertCircle className="w-2.5 h-2.5" /> {days}d
    </span>
  );
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Leave Row
// ─────────────────────────────────────────────────────────────────────────────
function LeaveRow({ leave, onView, onApprove, onReject }: {
  leave:     LeaveRequest;
  onView:    (l: LeaveRequest) => void;
  onApprove: (l: LeaveRequest) => void;
  onReject:  (l: LeaveRequest) => void;
}) {
  const av = avatarStyle(leave.student_name);
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors">
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${av.bg} ${av.text}`}>
        {initials(leave.student_name)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-gray-800 text-sm truncate">{leave.student_name}</p>
          {leave.status === 'pending' && <UrgencyBadge appliedAt={leave.applied_at} />}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {leave.register_number && (
            <span className="text-[11px] text-gray-400 font-mono">{leave.register_number}</span>
          )}
          {leave.item_name && (
            <span className="text-[11px] text-gray-400">{leave.item_name}</span>
          )}
          <LeaveTypeBadge type={leave.leave_type} />
        </div>
      </div>

      {/* Date range */}
      <div className="hidden sm:block text-center shrink-0">
        <p className="text-xs font-medium text-gray-700">{formatDate(leave.from_date)}</p>
        {leave.from_date !== leave.to_date && (
          <p className="text-[11px] text-gray-400">→ {formatDate(leave.to_date)}</p>
        )}
        <p className="text-[10px] font-bold text-indigo-500 mt-0.5">{leave.no_of_days}d</p>
      </div>

      {/* Status */}
      <div className="shrink-0">
        <StatusBadge status={leave.status} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onView(leave)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          title="View details"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
        {leave.status === 'pending' && (
          <>
            <button
              onClick={() => onApprove(leave)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
              title="Approve"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onReject(leave)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Reject"
            >
              <Ban className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail View
// ─────────────────────────────────────────────────────────────────────────────
function LeaveDetailView({ leave, onBack, onApprove, onReject, approving, rejecting }: {
  leave:     LeaveRequest;
  onBack:    () => void;
  onApprove: (id: string) => Promise<void>;
  onReject:  (id: string, reason: string) => Promise<void>;
  approving: boolean;
  rejecting: boolean;
}) {
  const [rejectReason, setRejectReason]   = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const av = avatarStyle(leave.student_name);

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error('Enter a rejection reason'); return; }
    await onReject(leave.id, rejectReason.trim());
  };

  const infoRows = [
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
    <div className="space-y-5">

      {/* Back bar */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center hover:bg-indigo-100 transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-indigo-600" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-800 text-sm truncate">{leave.student_name}</p>
              <LeaveTypeBadge type={leave.leave_type} />
              <StatusBadge status={leave.status} />
            </div>
            <p className="text-xs text-gray-400">
              {leave.register_number && `${leave.register_number} · `}
              {[leave.category_name, leave.item_name].filter(Boolean).join(' ')}
              {' · Applied '}{formatDate(leave.applied_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Student card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${av.bg} ${av.text}`}>
              {initials(leave.student_name)}
            </div>
            <div>
              <p className="font-bold text-gray-800 text-base">{leave.student_name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {[leave.register_number, leave.category_name, leave.item_name].filter(Boolean).join(' · ')}
              </p>
              {leave.parent_contact && (
                <p className="text-xs text-indigo-500 mt-1">Parent: {leave.parent_contact}</p>
              )}
            </div>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-100">
          {infoRows.map(r => (
            <div key={r.label} className="bg-white p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{r.label}</p>
              <p className="text-sm font-medium text-gray-800 capitalize">{r.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Reason */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full bg-indigo-500" />
          <p className="text-sm font-semibold text-gray-800">Reason for Leave</p>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100">
          {leave.reason}
        </p>
      </div>

      {/* Existing rejection reason */}
      {leave.reject_reason && (
        <div className="bg-red-50 rounded-xl border border-red-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <p className="text-sm font-semibold text-red-700">Rejection Reason</p>
          </div>
          <p className="text-sm text-red-700 leading-relaxed">{leave.reject_reason}</p>
        </div>
      )}

      {/* Reject textarea */}
      {showRejectForm && (
        <div className="bg-white rounded-xl border border-red-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <p className="text-sm font-semibold text-red-700">
              Rejection Reason <span className="text-red-500">*</span>
            </p>
          </div>
          <textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="e.g. Insufficient notice period. Please reapply with prior notice."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-red-200 rounded-lg bg-white resize-none outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100 transition-all"
          />
        </div>
      )}

      {/* Action buttons — pending only */}
      {leave.status === 'pending' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-3 flex-wrap">
            {!showRejectForm ? (
              <>
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 bg-red-50 text-red-600 font-semibold text-sm hover:bg-red-100 transition-colors"
                >
                  <Ban className="h-4 w-4" /> Reject Leave
                </button>
                <button
                  onClick={() => onApprove(leave.id)}
                  disabled={approving}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white font-semibold text-sm px-5 py-2.5 rounded-lg shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-60"
                >
                  {approving
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Approving...</>
                    : <><CheckCircle className="h-4 w-4" /> Approve Leave</>
                  }
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setShowRejectForm(false); setRejectReason(''); }}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={rejecting || !rejectReason.trim()}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-600 text-white font-semibold text-sm px-5 py-2.5 rounded-lg shadow-sm hover:bg-red-700 transition-colors disabled:opacity-60"
                >
                  {rejecting
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Rejecting...</>
                    : <><Ban className="h-4 w-4" /> Confirm Rejection</>
                  }
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function TeacherLeaveManagementPage() {
  const { user, profile } = useAuth();
  const currentUser = user || profile;

  const [step, setStep]                     = useState<1 | 2>(1);
  const [selectedLeave, setSelectedLeave]   = useState<LeaveRequest | null>(null);

  const [leaves, setLeaves]                 = useState<LeaveRequest[]>([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [approving, setApproving]           = useState(false);
  const [rejecting, setRejecting]           = useState(false);

  const [search, setSearch]                 = useState('');
  const [filterStatus, setFilterStatus]     = useState<string>('all');
  const [filterType, setFilterType]         = useState<string>('all');
  const [filterClass, setFilterClass]       = useState<string>('all');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate]     = useState('');
  const [showAdvanced, setShowAdvanced]     = useState(false);

  const [sortField, setSortField]           = useState<string>('applied_at');
  const [sortDir, setSortDir]               = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadLeaves();
  }, []);

  const loadLeaves = async (silent = false) => {
    try {
      if (!silent) setLoading(true); else setRefreshing(true);
      const data = await fetchLeaveRequests();
      setLeaves(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load leave requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const stats = useMemo(() => ({
    total:     leaves.length,
    pending:   leaves.filter(l => l.status === 'pending').length,
    approved:  leaves.filter(l => l.status === 'approved').length,
    rejected:  leaves.filter(l => l.status === 'rejected').length,
    cancelled: leaves.filter(l => l.status === 'cancelled').length,
  }), [leaves]);

  const classOptions = useMemo(
    () => Array.from(new Set(leaves.map(l => l.item_name).filter(Boolean))) as string[],
    [leaves]
  );

  const hasActiveFilters =
    filterStatus !== 'all' || filterType !== 'all' || filterClass !== 'all' ||
    !!search || !!filterFromDate || !!filterToDate;

  const filteredLeaves = useMemo(() => {
    let data = [...leaves];
    const q = search.trim().toLowerCase();
    if (q) {
      data = data.filter(l =>
        l.student_name.toLowerCase().includes(q) ||
        l.register_number?.toLowerCase().includes(q) ||
        l.item_name?.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all')  data = data.filter(l => l.status === filterStatus);
    if (filterType !== 'all')    data = data.filter(l => l.leave_type === filterType);
    if (filterClass !== 'all')   data = data.filter(l => l.item_name === filterClass);
    if (filterFromDate)          data = data.filter(l => l.from_date >= filterFromDate);
    if (filterToDate)            data = data.filter(l => l.to_date <= filterToDate);
    data.sort((a, b) => {
      const av = (a as any)[sortField] ?? '';
      const bv = (b as any)[sortField] ?? '';
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return data;
  }, [leaves, search, filterStatus, filterType, filterClass, filterFromDate, filterToDate, sortField, sortDir]);

  const clearFilters = () => {
    setSearch(''); setFilterStatus('all'); setFilterType('all');
    setFilterClass('all'); setFilterFromDate(''); setFilterToDate('');
  };

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleApprove = async (id: string) => {
    try {
      setApproving(true);
      await approveLeaveRequest(id);
      toast.success('Leave approved! Student will be notified.', {
        icon: <CheckCircle className="h-4 w-4 text-emerald-500" />,
      });
      setLeaves(prev =>
        prev.map(l => l.id === id
          ? { ...l, status: 'approved' as LeaveStatus, approved_at: new Date().toISOString() }
          : l
        )
      );
      if (selectedLeave?.id === id) {
        setSelectedLeave(prev =>
          prev ? { ...prev, status: 'approved', approved_at: new Date().toISOString() } : null
        );
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve leave');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (id: string, reason: string) => {
    try {
      setRejecting(true);
      await rejectLeaveRequest(id, reason);
      toast.success('Leave rejected. Student will be notified with the reason.', {
        icon: <XCircle className="h-4 w-4 text-red-500" />,
      });
      setLeaves(prev =>
        prev.map(l => l.id === id
          ? { ...l, status: 'rejected' as LeaveStatus, reject_reason: reason }
          : l
        )
      );
      setStep(1);
      setSelectedLeave(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject leave');
    } finally {
      setRejecting(false);
    }
  };

  const handleViewLeave = (leave: LeaveRequest) => {
    setSelectedLeave(leave);
    setStep(2);
  };

  const handleExport = () => {
    const data = filteredLeaves.map(l => ({
      'Student Name':   l.student_name,
      'Register No':    l.register_number || '',
      'Class':          l.category_name   || '',
      'Section':        l.item_name       || '',
      'Leave Type':     l.leave_type,
      'From Date':      l.from_date,
      'To Date':        l.to_date,
      'No of Days':     l.no_of_days,
      'Reason':         l.reason,
      'Status':         l.status,
      'Reject Reason':  l.reject_reason   || '',
      'Applied On':     l.applied_at,
      'Residence Type': l.residence_type  || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leave Requests');
    XLSX.writeFile(wb, `leave_requests_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Exported successfully');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <TeacherLayout>
      <div className="space-y-6 pb-24">

        {/* ── Page Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Leave Management</h1>
            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-all"
              title="Export to Excel"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={() => loadLeaves(true)}
              disabled={refreshing}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-all"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <div className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500">
              <Shield className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* ── Metric Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard label="Total"    value={stats.total}    icon={FileText}    iconBg="bg-indigo-50"  iconColor="text-indigo-600"  subtitle="all requests"  loading={loading} />
          <MetricCard label="Pending"  value={stats.pending}  icon={Clock}       iconBg="bg-amber-50"   iconColor="text-amber-500"   subtitle="needs review" loading={loading} />
          <MetricCard label="Approved" value={stats.approved} icon={CheckCircle} iconBg="bg-emerald-50" iconColor="text-emerald-600" subtitle="approved"     loading={loading} />
          <MetricCard label="Rejected" value={stats.rejected} icon={XCircle}     iconBg="bg-red-50"     iconColor="text-red-500"     subtitle="declined"     loading={loading} />
          <MetricCard
            label="Students"
            value={new Set(leaves.map(l => l.student_id)).size}
            icon={Users}
            iconBg="bg-violet-50"
            iconColor="text-violet-600"
            subtitle="with requests"
            loading={loading}
          />
        </div>

        {/* ── Step Indicator ── */}
        <div className="flex justify-end items-center gap-2">
          {[
            { num: 1, label: 'Leave Requests' },
            { num: 2, label: 'Request Detail' },
          ].map(({ num, label }, i) => (
            <div key={num} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-300" />}
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  step === num ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                    step === num ? 'bg-indigo-600 text-white' : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {num}
                </span>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* ══ STEP 1 — Leave List ══════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-4">

            {/* Filter bar */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

              {/* Search */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search student name, register number, class…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors placeholder:text-gray-400"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowAdvanced(v => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium border transition-all ${
                    showAdvanced || hasActiveFilters
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filters
                  {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-red-400" />}
                </button>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
                    <X className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>

              {/* Status + Type chips */}
              <div className="flex items-center gap-3 px-4 py-2.5 flex-wrap border-b border-gray-50">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Status</span>
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { val: 'all',      label: `All (${stats.total})` },
                    { val: 'pending',  label: `Pending (${stats.pending})`,   dot: 'bg-amber-500'   },
                    { val: 'approved', label: `Approved (${stats.approved})`, dot: 'bg-emerald-500' },
                    { val: 'rejected', label: `Rejected (${stats.rejected})`, dot: 'bg-red-500'     },
                  ].map(c => (
                    <button
                      key={c.val}
                      onClick={() => setFilterStatus(c.val)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        filterStatus === c.val
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                      }`}
                    >
                      {(c as any).dot && <span className={`w-1.5 h-1.5 rounded-full ${(c as any).dot}`} />}
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="w-px h-4 bg-gray-200 mx-1" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Type</span>
                <div className="flex gap-1.5 flex-wrap">
                  {['all', 'medical', 'personal', 'family', 'other'].map(v => (
                    <button
                      key={v}
                      onClick={() => setFilterType(v)}
                      className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        filterType === v
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                      }`}
                    >
                      {v === 'all' ? 'All' : v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced filters */}
              {showAdvanced && (
                <div className="px-4 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50/50 border-b border-gray-100">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">From Date</label>
                    <input type="date" value={filterFromDate} onChange={e => setFilterFromDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:border-indigo-400 h-9" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">To Date</label>
                    <input type="date" value={filterToDate} onChange={e => setFilterToDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:border-indigo-400 h-9" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">Section</label>
                    <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:border-indigo-400 h-9">
                      <option value="all">All Sections</option>
                      {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 block mb-1.5">Sort By</label>
                    <select
                      value={`${sortField}:${sortDir}`}
                      onChange={e => {
                        const [f, d] = e.target.value.split(':');
                        setSortField(f);
                        setSortDir(d as 'asc' | 'desc');
                      }}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:border-indigo-400 h-9"
                    >
                      <option value="applied_at:desc">Newest First</option>
                      <option value="applied_at:asc">Oldest First</option>
                      <option value="student_name:asc">Student A–Z</option>
                      <option value="from_date:asc">Leave Date ↑</option>
                      <option value="status:asc">Status</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Count row */}
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs text-gray-400 tabular-nums">
                  Showing <span className="font-semibold text-gray-700">{filteredLeaves.length}</span> of{' '}
                  <span className="font-semibold text-gray-700">{leaves.length}</span> requests
                </span>
                {hasActiveFilters && (
                  <span className="text-xs text-indigo-600 font-medium">
                    {leaves.length - filteredLeaves.length} filtered out
                  </span>
                )}
              </div>
            </div>

            {/* Leave list */}
            {loading ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : filteredLeaves.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-20 flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-500">No leave requests found</p>
                <p className="text-xs text-gray-400">
                  {hasActiveFilters ? 'Try adjusting or clearing your filters' : 'No leave requests submitted yet'}
                </p>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="text-xs font-medium text-indigo-500 hover:text-indigo-700 underline underline-offset-2">
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Table header */}
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 w-10 text-center shrink-0">Avtr</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 flex-1">Student</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 hidden sm:block w-28 text-center shrink-0">Dates</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 w-24 text-center shrink-0">Status</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 w-24 text-right shrink-0">Actions</span>
                  </div>
                </div>

                {filteredLeaves.map(leave => (
                  <LeaveRow
                    key={leave.id}
                    leave={leave}
                    onView={handleViewLeave}
                    onApprove={l => handleApprove(l.id)}
                    onReject={handleViewLeave}   // opens detail so teacher can write reason
                  />
                ))}

                {/* Table footer */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/40">
                  <span className="text-xs text-gray-400">
                    {filteredLeaves.length} request{filteredLeaves.length !== 1 ? 's' : ''} shown
                  </span>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pending: {stats.pending}</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Approved: {stats.approved}</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Rejected: {stats.rejected}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ STEP 2 — Detail ════════════════════════════════════════════════ */}
        {step === 2 && selectedLeave && (
          <LeaveDetailView
            leave={selectedLeave}
            onBack={() => { setStep(1); setSelectedLeave(null); }}
            onApprove={handleApprove}
            onReject={handleReject}
            approving={approving}
            rejecting={rejecting}
          />
        )}

        {/* ── Footer ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-gray-300" />
            <span>
              Institution ID:{' '}
              <span className="font-semibold text-gray-600">
                {currentUser?.institution_id?.slice(0, 8) || '—'}…
              </span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-bold border border-indigo-100 text-[10px] uppercase tracking-wide">
              Faculty
            </span>
          </div>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" />
            ETAM · Education &amp; Attendance Management
          </span>
        </div>
      </div>

      {/* ══ Sticky Action Bar — list view, pending exists ══════════════════ */}
      {step === 1 && stats.pending > 0 && (
        <div className="fixed bottom-0 left-0 md:left-64 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-lg px-4 py-3">
          <div className="flex items-center justify-between gap-3 max-w-screen-xl mx-auto">
            <div>
              <p className="text-sm font-medium text-gray-700">
                <span className="text-amber-600 font-bold">{stats.pending} pending</span>
                <span className="text-gray-400 mx-2">·</span>
                <span className="text-emerald-600">{stats.approved} approved</span>
                <span className="text-gray-400 mx-2">·</span>
                <span className="text-red-500">{stats.rejected} rejected</span>
              </p>
              <p className="text-xs text-gray-400">Tap a request to review and take action</p>
            </div>
            <button
              onClick={() => setFilterStatus('pending')}
              className="flex items-center gap-2 bg-amber-500 text-white font-semibold text-sm px-4 py-2 rounded-lg shadow-sm hover:bg-amber-600 transition-colors"
            >
              <Clock className="h-4 w-4" />
              Review Pending
            </button>
          </div>
        </div>
      )}

      {/* ══ Sticky Action Bar — detail view, pending ═══════════════════════ */}
      {step === 2 && selectedLeave?.status === 'pending' && (
        <div className="fixed bottom-0 left-0 md:left-64 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-lg px-4 py-3">
          <div className="flex items-center justify-between gap-3 max-w-screen-xl mx-auto">
            <div>
              <p className="text-sm font-medium text-gray-700">
                {selectedLeave.student_name}
                <span className="text-gray-400 mx-2">·</span>
                {selectedLeave.no_of_days}d {selectedLeave.leave_type} leave
              </p>
              <p className="text-xs text-gray-400">
                {formatDate(selectedLeave.from_date)}
                {selectedLeave.from_date !== selectedLeave.to_date && ` → ${formatDate(selectedLeave.to_date)}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  document.querySelector<HTMLElement>('textarea')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-1.5 border border-red-200 bg-red-50 text-red-600 font-semibold text-sm px-3 py-2 rounded-lg hover:bg-red-100 transition-colors"
              >
                <Ban className="h-4 w-4" /> Reject
              </button>
              <button
                onClick={() => handleApprove(selectedLeave.id)}
                disabled={approving}
                className="flex items-center gap-1.5 bg-emerald-600 text-white font-semibold text-sm px-4 py-2 rounded-lg shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-60"
              >
                {approving
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <CheckCircle className="h-4 w-4" />
                }
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </TeacherLayout>
  );
}