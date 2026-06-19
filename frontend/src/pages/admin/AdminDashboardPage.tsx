import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { studentsApi, attendanceApi } from '@/lib/api';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, CheckCircle2, XCircle, Clock,
  TrendingUp, CalendarDays, RefreshCw,
  Radio, BarChart3, AlertTriangle, Bell, ChevronRight,
  Activity, Shield, MessageCircle, Smartphone, Zap,
  Plus, CreditCard, Package, TrendingDown,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface DailySummary {
  present: number;
  absent: number;
  late: number;
  percentage?: number;
  total?: number;
}

interface WeekDay {
  day: string;
  students: number;
}

// ── NEW: Subscription / Credits types ────────────────────────────────────────
export interface ChannelCredits {
  channel: 'whatsapp' | 'sms';
  total: number;      // credits purchased
  used: number;       // credits consumed
}

export interface Subscription {
  plan: string;          // e.g. "Starter", "Pro", "Enterprise"
  renewsAt: string;      // ISO date string  e.g. "2025-08-14"
  credits: ChannelCredits[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normaliseSummary(raw: any, forDate?: string): DailySummary {
  if (!raw) return { present: 0, absent: 0, late: 0 };

  if (Array.isArray(raw)) {
    if (raw.length === 0) return { present: 0, absent: 0, late: 0 };

    const first = raw[0];
    const isIndividual =
      ('student_id' in first || 'member_id' in first) &&
      !('present' in first) &&
      !('absent' in first);

    if (isIndividual) {
      const latest = new Map<string, any>();
      for (const r of raw) {
        const id = r.student_id ?? r.id ?? r.member_id;
        if (!id) continue;
        const existing = latest.get(id);
        if (!existing) { latest.set(id, r); continue; }
        const et = new Date(existing.updated_at ?? existing.created_at ?? 0).getTime();
        const rt = new Date(r.updated_at ?? r.created_at ?? 0).getTime();
        if (rt >= et) latest.set(id, r);
      }
      let present = 0, absent = 0, late = 0;
      for (const r of latest.values()) {
        const s = (r.status ?? '').toLowerCase();
        if (s === 'present') present++;
        else if (s === 'absent') absent++;
        else if (s === 'late') late++;
      }
      return { present, absent, late };
    }

    const toYMD = (val: any): string => {
      if (!val) return '';
      if (val instanceof Date) {
        const y = val.getUTCFullYear();
        const m = String(val.getUTCMonth() + 1).padStart(2, '0');
        const d = String(val.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      return String(val).split('T')[0];
    };

    let row: any = null;
    if (forDate) row = raw.find((r: any) => toYMD(r.date) === forDate) ?? null;
    if (!row) row = raw[0];
    if (!row) return { present: 0, absent: 0, late: 0 };

    return {
      present:    Number(row.present    ?? 0),
      absent:     Number(row.absent     ?? 0),
      late:       Number(row.late       ?? 0),
      percentage: row.percentage != null ? Number(row.percentage) : undefined,
      total:      row.total_students != null
                    ? Number(row.total_students)
                    : row.total != null ? Number(row.total) : undefined,
    };
  }

  return {
    present:    Number(raw.present    ?? 0),
    absent:     Number(raw.absent     ?? 0),
    late:       Number(raw.late       ?? 0),
    percentage: raw.percentage != null ? Number(raw.percentage) : undefined,
    total:      raw.total_students != null
                  ? Number(raw.total_students)
                  : raw.total != null ? Number(raw.total) : undefined,
  };
}

function calcPct(summary: DailySummary, totalEnrolled: number): number {
  if (summary.percentage != null && summary.percentage > 0) return Math.round(summary.percentage);
  if (totalEnrolled > 0) return Math.round((summary.present / totalEnrolled) * 100);
  const marked = summary.present + summary.absent + summary.late;
  return marked > 0 ? Math.round((summary.present / marked) * 100) : 0;
}

function getWeekdaysUpToToday(): Date[] {
  const now = new Date();
  const dow = now.getDay();
  if (dow === 0) return [];
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dow - 1));
  monday.setHours(0, 0, 0, 0);
  const count = Math.min(dow, 5);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated count-up
// ─────────────────────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900) {
  const [count, setCount] = useState(0);
  const frame = useRef<number>();
  const start = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    start.current = undefined;
    const tick = (ts: number) => {
      if (!start.current) start.current = ts;
      const p = Math.min((ts - start.current) / duration, 1);
      setCount(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  }, [target, duration]);
  return count;
}

function useRelativeTime(date: Date | null) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!date) return;
    const tick = () => {
      const s = Math.floor((Date.now() - date.getTime()) / 1000);
      if (s < 10)   setLabel('Just now');
      else if (s < 60)   setLabel(`${s}s ago`);
      else if (s < 3600) setLabel(`${Math.floor(s / 60)} min ago`);
      else               setLabel(`${Math.floor(s / 3600)}h ago`);
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [date]);
  return label;
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric Card
// ─────────────────────────────────────────────────────────────────────────────
function MetricCard({ label, value, icon: Icon, iconBg, iconColor, subtitle, loading }: {
  label: string; value: number | string; icon: any;
  iconBg: string; iconColor: string; subtitle?: string; loading?: boolean;
}) {
  const num = typeof value === 'string' ? parseInt(value) || 0 : value;
  const animated = useCountUp(loading ? 0 : num);
  const display = typeof value === 'string' && value.includes('%') ? `${animated}%` : animated;

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <Skeleton className="h-3 w-20 mb-4 bg-gray-100" />
      <Skeleton className="h-7 w-14 mb-2 bg-gray-100" />
      <Skeleton className="h-3 w-16 bg-gray-100" />
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-400">{label}</span>
        <div className={`p-2 rounded-lg ${iconBg}`}>
          <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{display}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert Banner
// ─────────────────────────────────────────────────────────────────────────────
function AlertBanner({ alerts }: { alerts: { type: 'warn' | 'info'; message: string }[] }) {
  if (!alerts.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {alerts.map((a, i) => (
        <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm border ${
          a.type === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-blue-50 text-blue-700 border-blue-100'
        }`}>
          {a.type === 'warn' ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Bell className="h-4 w-4 shrink-0" />}
          <span>{a.message}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Credit Progress Bar
// ─────────────────────────────────────────────────────────────────────────────
function CreditBar({ used, total, color }: { used: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(Math.round((used / total) * 100), 100) : 0;
  const isLow = pct >= 80;
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-400">{used.toLocaleString()} used</span>
        <span className={`text-xs font-semibold ${isLow ? 'text-red-500' : 'text-gray-500'}`}>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: isLow ? '#ef4444' : color }}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-gray-300">0</span>
        <span className="text-[10px] text-gray-400 font-medium">{(total - used).toLocaleString()} remaining</span>
        <span className="text-[10px] text-gray-300">{total.toLocaleString()}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Top-up Modal
// ─────────────────────────────────────────────────────────────────────────────
function TopUpModal({
  channel,
  onClose,
  onConfirm,
}: {
  channel: 'whatsapp' | 'sms';
  onClose: () => void;
  onConfirm: (channel: 'whatsapp' | 'sms', amount: number) => void;
}) {
  const [amount, setAmount] = useState<string>('');
  const presets = [100, 500, 1000, 5000];
  const isWA = channel === 'whatsapp';

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isWA ? 'bg-green-50' : 'bg-sky-50'}`}>
            {isWA
              ? <MessageCircle className="h-5 w-5 text-green-600" />
              : <Smartphone className="h-5 w-5 text-sky-600" />
            }
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Top-up {isWA ? 'WhatsApp' : 'SMS'} Credits</h3>
            <p className="text-xs text-gray-400">Add message credits to your account</p>
          </div>
        </div>

        {/* Quick presets */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Quick amounts</p>
          <div className="grid grid-cols-4 gap-2">
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => setAmount(String(p))}
                className={`py-2 rounded-lg text-xs font-semibold border transition-all ${
                  amount === String(p)
                    ? isWA ? 'bg-green-600 text-white border-green-600' : 'bg-sky-600 text-white border-sky-600'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-indigo-300'
                }`}
              >
                {p.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Custom input */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Custom amount</p>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter credits…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const n = parseInt(amount);
              if (!isNaN(n) && n > 0) { onConfirm(channel, n); onClose(); }
            }}
            disabled={!amount || parseInt(amount) <= 0}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-40 ${
              isWA ? 'bg-green-600 hover:bg-green-700' : 'bg-sky-600 hover:bg-sky-700'
            }`}
          >
            Add Credits
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: Subscription & Credits Section
// ─────────────────────────────────────────────────────────────────────────────
function SubscriptionSection({
  subscription,
  onTopUp,
}: {
  subscription: Subscription;
  onTopUp: (channel: 'whatsapp' | 'sms') => void;
}) {
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(subscription.renewsAt).getTime() - Date.now()) / 86_400_000),
  );
  const isExpiringSoon = daysLeft <= 7;

  const channelConfig = {
    whatsapp: {
      label: 'WhatsApp',
      icon: MessageCircle,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      barColor: '#22c55e',
      badgeBg: 'bg-green-50',
      badgeText: 'text-green-700',
      badgeBorder: 'border-green-100',
    },
    sms: {
      label: 'SMS',
      icon: Smartphone,
      iconBg: 'bg-sky-50',
      iconColor: 'text-sky-600',
      barColor: '#0ea5e9',
      badgeBg: 'bg-sky-50',
      badgeText: 'text-sky-700',
      badgeBorder: 'border-sky-100',
    },
  } as const;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50">
            <CreditCard className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Subscription & Credits</h2>
            <p className="text-xs text-gray-400 mt-0.5">Manage your messaging credits</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
            <Package className="h-3 w-3" />
            {subscription.plan}
          </span>
          <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
            isExpiringSoon
              ? 'bg-red-50 text-red-600 border-red-100'
              : 'bg-gray-50 text-gray-500 border-gray-200'
          }`}>
            {isExpiringSoon && <AlertTriangle className="h-3 w-3" />}
            Renews in {daysLeft}d
          </span>
        </div>
      </div>

      {/* Credit channel cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {subscription.credits.map((c) => {
          const cfg = channelConfig[c.channel];
          const Icon = cfg.icon;
          const remaining = c.total - c.used;
          const isLow = remaining / c.total < 0.2 && c.total > 0;

          return (
            <div key={c.channel} className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 space-y-3">
              {/* Channel header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${cfg.iconBg}`}>
                    <Icon className={`h-3.5 w-3.5 ${cfg.iconColor}`} />
                  </div>
                  <span className="text-sm font-semibold text-gray-800">{cfg.label} Messages</span>
                  {isLow && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-full">
                      <TrendingDown className="h-2.5 w-2.5" /> Low
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onTopUp(c.channel)}
                  className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder} hover:opacity-80`}
                >
                  <Plus className="h-3 w-3" /> Top-up
                </button>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white rounded-lg p-2 border border-gray-100">
                  <p className="text-[10px] text-gray-400 font-medium">Total</p>
                  <p className="text-base font-bold text-gray-800 tabular-nums">{c.total.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-lg p-2 border border-gray-100">
                  <p className="text-[10px] text-gray-400 font-medium">Used</p>
                  <p className="text-base font-bold text-gray-600 tabular-nums">{c.used.toLocaleString()}</p>
                </div>
                <div className={`rounded-lg p-2 border ${isLow ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
                  <p className="text-[10px] text-gray-400 font-medium">Remaining</p>
                  <p className={`text-base font-bold tabular-nums ${isLow ? 'text-red-600' : 'text-gray-800'}`}>
                    {remaining.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <CreditBar used={c.used} total={c.total} color={cfg.barColor} />
            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-indigo-400" />
          Total credits purchased:{' '}
          <span className="font-semibold text-gray-700 ml-0.5">
            {subscription.credits.reduce((a, c) => a + c.total, 0).toLocaleString()}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          Plan renews:{' '}
          <span className="font-semibold text-gray-700 ml-0.5">
            {new Date(subscription.renewsAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const DONUT_COLORS = ['#4f46e5', '#ef4444', '#f59e0b'];

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const currentUser = user || profile;

  const [loading, setLoading]             = useState(true);
  const [weeklyLoading, setWeeklyLoading] = useState(true);
  const [studentCount, setStudentCount]   = useState(0);
  const [present, setPresent]             = useState(0);
  const [absent, setAbsent]               = useState(0);
  const [late, setLate]                   = useState(0);
  const [percentage, setPercentage]       = useState(0);
  const [updatedAt, setUpdatedAt]         = useState<Date | null>(null);
  const [notifOpen, setNotifOpen]         = useState(false);
  const [weeklyData, setWeeklyData]       = useState<WeekDay[]>([]);

  // ── NEW: Subscription state ─────────────────────────────────────────────
  // Replace this default state with your actual API call (e.g. subscriptionApi.get())
  const [subscription, setSubscription] = useState<Subscription>({
    plan: 'Pro',
    renewsAt: new Date(Date.now() + 12 * 86_400_000).toISOString(), // 12 days from now
    credits: [
      { channel: 'whatsapp', total: 1000, used: 430 },
      { channel: 'sms',      total: 2000, used: 1750 },
    ],
  });
  const [topUpChannel, setTopUpChannel] = useState<'whatsapp' | 'sms' | null>(null);

  const handleTopUpConfirm = (channel: 'whatsapp' | 'sms', amount: number) => {
    setSubscription((prev) => ({
      ...prev,
      credits: prev.credits.map((c) =>
        c.channel === channel ? { ...c, total: c.total + amount } : c,
      ),
    }));
    // TODO: call subscriptionApi.topUp(channel, amount) here
  };

  const relativeTime = useRelativeTime(updatedAt);

  // ─────────────────────────────────────────────────────────────────────────
  const loadAll = async () => {
    if (!currentUser) return;
    setLoading(true);
    setWeeklyLoading(true);

    try {
      const _now = new Date();
      const today = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;

      const [studentsRes, dailyRaw] = await Promise.all([
        studentsApi.list({ limit: 1000, offset: 0 }),
        attendanceApi.getDailySummary(today),
      ]);

      const studentList: any[] =
        Array.isArray(studentsRes) ? studentsRes :
        Array.isArray(studentsRes?.students) ? studentsRes.students :
        Array.isArray(studentsRes?.data) ? studentsRes.data : [];

      const totalEnrolled: number =
        studentsRes?.total ?? studentsRes?.count ?? studentList.length;

      setStudentCount(totalEnrolled);

      const summary = normaliseSummary(dailyRaw, today);
      setPresent(summary.present);
      setAbsent(summary.absent);
      setLate(summary.late);
      setPercentage(calcPct(summary, totalEnrolled));
      setUpdatedAt(new Date());
      setLoading(false);

      const weekdays = getWeekdaysUpToToday();
      if (weekdays.length === 0) {
        setWeeklyData([]);
        setWeeklyLoading(false);
        return;
      }

      const weekly: WeekDay[] = await Promise.all(
        weekdays.map(async (date) => {
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          const dateStr  = `${y}-${m}-${d}`;
          const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
          try {
            const raw = await attendanceApi.getDailySummary(dateStr);
            const s = normaliseSummary(raw, dateStr);
            return { day: dayLabel, students: calcPct(s, totalEnrolled) };
          } catch {
            return { day: dayLabel, students: 0 };
          }
        }),
      );

      setWeeklyData(weekly);
    } catch (err) {
      console.error('Dashboard load error:', err);
      setLoading(false);
    } finally {
      setWeeklyLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) { navigate('/login'); return; }
    loadAll();
  }, [currentUser, authLoading]);

  useEffect(() => {
    if (!currentUser) return;
    const id = setInterval(loadAll, 60_000);
    return () => clearInterval(id);
  }, [currentUser]);

  // ── Alerts ──────────────────────────────────────────────────────────────
  const alerts: { type: 'warn' | 'info'; message: string }[] = [];
  if (!loading) {
    if (absent > 0)
      alerts.push({ type: 'warn', message: `${absent} student${absent > 1 ? 's' : ''} marked absent today.` });
    if (percentage < 80 && percentage > 0)
      alerts.push({ type: 'warn', message: `Low attendance: ${percentage}% today (below 80% threshold).` });
    if (late > 0)
      alerts.push({ type: 'info', message: `${late} student${late > 1 ? 's' : ''} arrived late today.` });
    if (percentage === 100 && present > 0)
      alerts.push({ type: 'info', message: 'Perfect attendance today! 🎉' });
    // Credit alerts
    subscription.credits.forEach((c) => {
      const remaining = c.total - c.used;
      const pct = c.total > 0 ? remaining / c.total : 1;
      if (pct < 0.1 && c.total > 0)
        alerts.push({ type: 'warn', message: `${c.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} credits critically low — only ${remaining} remaining!` });
      else if (pct < 0.2 && c.total > 0)
        alerts.push({ type: 'warn', message: `${c.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} credits running low (${remaining} left). Consider topping up.` });
    });
  }

  const donutData = [
    { name: 'Present', value: present },
    { name: 'Absent',  value: absent  },
    { name: 'Late',    value: late    },
  ].filter((d) => d.value > 0);

  const quickActions = [
    { to: '/admin/students',        icon: Users,     color: 'bg-indigo-600', label: 'Students',        description: 'Manage student records',       badge: `${studentCount} enrolled` },
    { to: '/admin/live-attendance', icon: Radio,     color: 'bg-rose-500',   label: 'Live Attendance', description: 'Real-time attendance tracking', live: true },
    { to: '/admin/reports',         icon: BarChart3, color: 'bg-sky-500',    label: 'Reports',         description: 'Export PDF/CSV, view trends',  badge: 'Export' },
  ];

  if (authLoading) return (
    <AdminLayout>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
            <Skeleton className="h-3 w-20 mb-4 bg-gray-100" />
            <Skeleton className="h-7 w-14 bg-gray-100" />
          </div>
        ))}
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* ── HEADER ────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {getGreeting()}, {currentUser?.full_name?.split(' ')[0] || 'Administrator'}
            </h1>
            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setNotifOpen((o) => !o)}
                className="relative h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-all"
              >
                <Bell className="h-4 w-4" />
                {alerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {alerts.length}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-11 w-80 bg-white border border-gray-100 rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-800">Notifications</span>
                    <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">{alerts.length} new</span>
                  </div>
                  {alerts.length === 0
                    ? <div className="px-4 py-6 text-center text-sm text-gray-400">No alerts right now</div>
                    : alerts.map((a, i) => (
                      <div key={i} className={`px-4 py-3 flex gap-3 border-b border-gray-50 last:border-0 ${a.type === 'warn' ? 'bg-amber-50/50' : 'bg-blue-50/30'}`}>
                        {a.type === 'warn'
                          ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          : <Bell className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />}
                        <p className="text-xs text-gray-600 leading-relaxed">{a.message}</p>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>

            <button
              onClick={loadAll}
              disabled={loading || weeklyLoading}
              className="h-9 px-3 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${(loading || weeklyLoading) ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline text-xs font-medium">Refresh</span>
            </button>
          </div>
        </div>

        {/* ── ALERTS ────────────────────────────────────────────────────── */}
        {!loading && <AlertBanner alerts={alerts} />}

        {/* ── METRIC CARDS ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard label="Total Students" value={studentCount}     icon={Users}        iconBg="bg-indigo-50" iconColor="text-indigo-600" subtitle="enrolled"      loading={loading} />
          <MetricCard label="Present"        value={present}          icon={CheckCircle2} iconBg="bg-green-50"  iconColor="text-green-600"  subtitle="today"         loading={loading} />
          <MetricCard label="Absent"         value={absent}           icon={XCircle}      iconBg="bg-red-50"    iconColor="text-red-500"    subtitle="today"         loading={loading} />
          <MetricCard label="Late"           value={late}             icon={Clock}        iconBg="bg-amber-50"  iconColor="text-amber-500"  subtitle="late arrivals" loading={loading} />
          <MetricCard label="Attendance"     value={`${percentage}%`} icon={TrendingUp}   iconBg="bg-sky-50"    iconColor="text-sky-600"    subtitle="today"         loading={loading} />
        </div>

        {/* ── CHARTS ROW ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Weekly Attendance Trend</h2>
                <p className="text-xs text-gray-400 mt-0.5">Student attendance (%) — this week</p>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="h-1.5 w-3 rounded-full bg-indigo-500 inline-block" /> Students
              </span>
            </div>
            {weeklyLoading ? (
              <div className="h-48 flex items-center justify-center text-sm text-gray-400 animate-pulse">Loading…</div>
            ) : weeklyData.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center gap-2">
                <Activity className="h-8 w-8 text-gray-200" />
                <p className="text-sm text-gray-400">No attendance recorded this week yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={192}>
                <LineChart data={weeklyData} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} formatter={(v: any) => [`${v}%`, 'Attendance']} />
                  <Line type="monotone" dataKey="students" stroke="#4f46e5" strokeWidth={2} dot={{ r: 4, fill: '#4f46e5', strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-800">Today at a Glance</h2>
            <p className="text-xs text-gray-400 mt-0.5 mb-4">Student attendance breakdown</p>
            {donutData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={148}>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={40} outerRadius={64} dataKey="value" strokeWidth={0}>
                      {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {donutData.map((d, i) => (
                    <div key={i} className="text-center">
                      <div className="h-1 w-full rounded-full mb-1.5" style={{ background: DONUT_COLORS[i] }} />
                      <p className="text-[10px] text-gray-400 font-medium">{d.name}</p>
                      <p className="text-lg font-bold text-gray-800">{d.value}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-44 text-center">
                <Activity className="h-9 w-9 text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">No data yet</p>
                <p className="text-xs text-gray-300 mt-1">Mark attendance to see chart</p>
              </div>
            )}
          </div>
        </div>

        {/* ── BAR CHART ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Daily Attendance Comparison</h2>
              <p className="text-xs text-gray-400 mt-0.5">Student attendance (%) — this week</p>
            </div>
            <span className="text-xs bg-gray-50 text-gray-500 font-medium px-2.5 py-1 rounded-lg border border-gray-100">This Week</span>
          </div>
          {weeklyLoading ? (
            <div className="h-40 flex items-center justify-center text-sm text-gray-400 animate-pulse">Loading…</div>
          ) : weeklyData.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2">
              <Activity className="h-8 w-8 text-gray-200" />
              <p className="text-sm text-gray-400">No attendance recorded this week yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weeklyData} barGap={4} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} formatter={(v: any) => [`${v}%`, 'Attendance']} />
                <Bar dataKey="students" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Students" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── QUICK ACTIONS ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-800 mb-1">Quick Actions</h2>
          <p className="text-xs text-gray-400 mb-4">Jump directly to any module</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {quickActions.map(({ to, icon: Icon, color, label, description, badge, live }: any) => (
              <Link
                key={to} to={to}
                className="group flex flex-col gap-3 p-4 rounded-xl border border-gray-100 bg-white hover:border-indigo-100 hover:bg-indigo-50/30 hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className={`p-2.5 rounded-lg ${color}`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  {live ? (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                      <span className="h-1.5 w-1.5 bg-red-500 rounded-full animate-pulse" /> LIVE
                    </span>
                  ) : badge ? (
                    <span className="text-[10px] font-medium text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">{badge}</span>
                  ) : null}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors">{label}</h3>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{description}</p>
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-indigo-400 group-hover:text-indigo-600 transition-colors mt-auto">
                  Go to module <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── SUBSCRIPTION & CREDITS ────────────────────────────────────── */}
        <SubscriptionSection
          subscription={subscription}
          onTopUp={(channel) => setTopUpChannel(channel)}
        />

        {/* ── FOOTER ────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-gray-300" />
            <span>Signed in as <span className="font-medium text-gray-600">{currentUser?.full_name || 'Admin'}</span></span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-semibold border border-indigo-100 text-[10px] uppercase tracking-wide">Administrator</span>
          </div>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-green-400 rounded-full animate-pulse" />
            Auto-refreshes every 60s · {relativeTime || '…'}
          </span>
        </div>

      </div>

      {/* ── TOP-UP MODAL ──────────────────────────────────────────────────── */}
      {topUpChannel && (
        <TopUpModal
          channel={topUpChannel}
          onClose={() => setTopUpChannel(null)}
          onConfirm={handleTopUpConfirm}
        />
      )}
    </AdminLayout>
  );
}