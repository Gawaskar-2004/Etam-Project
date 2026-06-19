import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import TeacherLayout from '@/components/layouts/TeacherLayout';
import { staffApi, academicApi, subjectsApi } from '@/lib/api';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import {
  User, Mail, Phone, MapPin, Calendar, BadgeCheck, Briefcase,
  BookOpen, GraduationCap, Layers, School, Users, Star,
  Clock, CheckCircle, ChevronRight, Shield, CalendarDays
} from 'lucide-react';

// ─── Metric Card (exact same style as AdminDashboard) ────────────
function MetricCard({ label, value, icon: Icon, iconBg, iconColor, subtitle, loading }: any) {
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

// ─── Info Row (dashboard style) ────────────────────────────────
function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-indigo-600" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
        <p className="font-medium text-gray-800 text-sm mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ─── Section Header (dashboard style) ───────────────────────────
function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
      <div className="p-2 rounded-lg bg-indigo-50">
        <Icon className="h-4 w-4 text-indigo-600" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Badge Chip (dashboard style) ───────────────────────────────
function Chip({ label, color = 'indigo' }: { label: string; color?: string }) {
  const map: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${map[color] || map.indigo}`}>
      {label}
    </span>
  );
}

interface ClassTeacherEntry {
  category_id: string;
  subcategory_id: string;
  item_id: string;
  staff_id: string;
  category_name?: string;
  subcategory_name?: string;
  item_name?: string;
}

interface TimetableAssignment {
  id: string;
  period_number: number;
  day: string;
  staff_id: string;
  subject_id: string;
  subject_name?: string;
  category_name?: string;
  subcategory_name?: string;
  item_name?: string;
}

export default function TeacherProfilePage() {
  const { profile } = useAuth();
  const [staffDetails, setStaffDetails] = useState<any>(null);
  const [classTeacherOf, setClassTeacherOf] = useState<ClassTeacherEntry[]>([]);
  const [timetableAssignments, setTimetableAssignments] = useState<TimetableAssignment[]>([]);
  const [subjectsTaught, setSubjectsTaught] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}` });

  useEffect(() => {
    if (profile?.id) fetchAll();
  }, [profile?.id]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const staffList = await staffApi.list({ limit: 1000 }).catch(() => []);
      const list = Array.isArray(staffList) ? staffList : [];
      const me = list.find((s: any) => s.user_id === profile?.id || s.email === profile?.email);
      setStaffDetails(me || null);
      const staffId = me?.id;

      if (!staffId) { setLoading(false); return; }

      const ctRes = await fetch(`${API}/class-teachers?staff_id=${staffId}`, { headers: authHeader() }).catch(() => null);
      if (ctRes && ctRes.ok) {
        const ctData = await ctRes.json().catch(() => []);
        const ctList: ClassTeacherEntry[] = Array.isArray(ctData) ? ctData : (ctData?.data || []);
        setClassTeacherOf(ctList.filter((c: ClassTeacherEntry) => c.staff_id === staffId));
      }

      const ttRes = await fetch(`${API}/timetable-assignments?staff_id=${staffId}`, { headers: authHeader() }).catch(() => null);
      if (ttRes && ttRes.ok) {
        const ttData = await ttRes.json().catch(() => []);
        const ttList: TimetableAssignment[] = Array.isArray(ttData) ? ttData : (ttData?.assignments || []);
        const filtered = ttList.filter((a: TimetableAssignment) => a.staff_id === staffId);
        setTimetableAssignments(filtered);

        const seen = new Set<string>();
        const uniqueSubs: { id: string; name: string; code?: string }[] = [];
        filtered.forEach((a: any) => {
          if (a.subject_id && !seen.has(a.subject_id)) {
            seen.add(a.subject_id);
            uniqueSubs.push({ id: a.subject_id, name: a.subject_name || 'Unknown', code: a.subject_code });
          }
        });
        setSubjectsTaught(uniqueSubs);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const groupedClasses = (() => {
    const map: Record<string, { label: string; days: Set<string>; periods: number[] }> = {};
    timetableAssignments.forEach(a => {
      const key = [a.category_name, a.subcategory_name, a.item_name].filter(Boolean).join(' › ') || 'Unknown Class';
      if (!map[key]) map[key] = { label: key, days: new Set(), periods: [] };
      map[key].days.add(a.day);
      map[key].periods.push(a.period_number);
    });
    return Object.values(map);
  })();

  const DAYS_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const totalClasses = groupedClasses.length;
  const totalSubjects = subjectsTaught.length;
  const totalPeriods = timetableAssignments.length;

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* ── PAGE HEADER (dashboard style) ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Profile</h1>
            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Your personal and professional details
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500">
              <Shield className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* ── METRIC CARDS ── */}
        <div className="grid grid-cols-3 gap-3">
          <MetricCard
            label="Classes"
            value={totalClasses}
            icon={School}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-600"
            loading={loading}
          />
          <MetricCard
            label="Subjects"
            value={totalSubjects}
            icon={BookOpen}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            loading={loading}
          />
          <MetricCard
            label="Periods"
            value={totalPeriods}
            icon={Clock}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
            loading={loading}
          />
        </div>

        {/* ── PROFILE HEADER CARD (simple, no gradient) ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-2xl font-bold text-indigo-700">
              {profile?.full_name?.charAt(0).toUpperCase() || 'T'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900">{profile?.full_name || 'Teacher'}</h2>
                <Chip label={profile?.role || 'teacher'} color="indigo" />
                {staffDetails?.status && (
                  <Chip label={staffDetails.status} color={staffDetails.status === 'active' ? 'emerald' : 'amber'} />
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">{profile?.email}</p>
              {staffDetails?.staff_code && (
                <p className="text-xs text-gray-400 mt-1 font-mono">Staff ID: {staffDetails.staff_code}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              {staffDetails?.designation && (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Briefcase className="h-3.5 w-3.5 text-gray-400" />
                  <span>{staffDetails.designation}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── ROW 1: Personal Information ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <SectionHeader icon={User} title="Personal Information" subtitle="Your account and staff details" />
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
              <div>
                <InfoRow icon={User}      label="Full Name"      value={profile?.full_name || staffDetails?.full_name} />
                <InfoRow icon={Mail}      label="Email Address"  value={profile?.email || staffDetails?.email} />
                <InfoRow icon={Phone}     label="Phone Number"   value={staffDetails?.mobile_number || staffDetails?.phone || staffDetails?.contact_number} />
                <InfoRow icon={Calendar}  label="Date of Birth"  value={staffDetails?.date_of_birth ? new Date(staffDetails.date_of_birth).toLocaleDateString('en-IN') : undefined} />
                <InfoRow icon={User}      label="Gender"         value={staffDetails?.gender ? staffDetails.gender.charAt(0).toUpperCase() + staffDetails.gender.slice(1) : undefined} />
              </div>
              <div>
                <InfoRow icon={BadgeCheck} label="Staff ID"        value={staffDetails?.staff_code} />
                <InfoRow icon={Briefcase}  label="Designation"     value={staffDetails?.designation || staffDetails?.role} />
                <InfoRow icon={Calendar}   label="Date of Joining" value={staffDetails?.date_of_joining ? new Date(staffDetails.date_of_joining).toLocaleDateString('en-IN') : undefined} />
                <InfoRow icon={MapPin}     label="Address"         value={staffDetails?.address} />
              </div>
            </div>
            {loading && (
              <div className="space-y-3 mt-3">
                <Skeleton className="h-10 w-full rounded-lg bg-gray-100" />
                <Skeleton className="h-10 w-full rounded-lg bg-gray-100" />
              </div>
            )}
          </div>
        </div>

        {/* ── ROW 2: Class Teacher + Subjects Taught ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Class Teacher Of */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <SectionHeader icon={Star} title="Class Teacher Of" subtitle="Classes where you are the assigned class teacher" />
            <div className="p-5">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg bg-gray-100" />)}
                </div>
              ) : classTeacherOf.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <Star className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm font-medium">Not assigned as class teacher</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {classTeacherOf.map((ct, i) => {
                    const className = [ct.category_name, ct.subcategory_name, ct.item_name ? `Section ${ct.item_name}` : ''].filter(Boolean).join(' › ');
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                        <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <Star className="h-4 w-4 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm truncate">{className || 'Unknown Class'}</p>
                          <p className="text-[10px] text-amber-700 font-semibold uppercase tracking-widest mt-0.5">Class Teacher</p>
                        </div>
                        <CheckCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Subjects Taught */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <SectionHeader icon={BookOpen} title="Subjects Taught" subtitle="All subjects assigned to you in the timetable" />
            <div className="p-5">
              {loading ? (
                <div className="flex flex-wrap gap-2">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-24 rounded-full bg-gray-100" />)}
                </div>
              ) : subjectsTaught.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                  <BookOpen className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm font-medium">No subjects assigned yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {subjectsTaught.map((sub, i) => (
                    <div key={sub.id} className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                      <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold flex-shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm">{sub.name}</p>
                        {sub.code && <p className="text-[10px] font-mono text-emerald-700 mt-0.5">{sub.code}</p>}
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── ROW 3: Assigned Classes (Timetable Summary) ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <SectionHeader icon={GraduationCap} title="Assigned Classes" subtitle="Classes you teach — grouped by class with days and period counts" />
          <div className="p-5">
            {loading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-lg bg-gray-100" />)}
              </div>
            ) : groupedClasses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <GraduationCap className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No timetable assignments found</p>
                <p className="text-xs mt-1">Your class assignments will appear here once added</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {groupedClasses.map((cls, i) => {
                  const orderedDays = DAYS_ORDER.filter(d => cls.days.has(d));
                  const uniquePeriods = [...new Set(cls.periods)].sort((a, b) => a - b);
                  return (
                    <div key={i} className="p-4 rounded-lg border border-indigo-100 bg-indigo-50/30 hover:border-indigo-300 hover:shadow-sm transition-all">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <School className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm leading-tight">{cls.label}</p>
                          <p className="text-[10px] text-indigo-600 font-semibold mt-0.5 uppercase tracking-widest">
                            {uniquePeriods.length} period{uniquePeriods.length !== 1 ? 's' : ''} · {orderedDays.length} day{orderedDays.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      {/* Days */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {DAYS_ORDER.map(d => (
                          <span
                            key={d}
                            className={`inline-flex items-center justify-center text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md border ${
                              cls.days.has(d)
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-white text-gray-300 border-gray-200'
                            }`}
                          >
                            {d.slice(0, 2)}
                          </span>
                        ))}
                      </div>

                      {/* Period numbers */}
                      <div className="flex flex-wrap gap-1">
                        {uniquePeriods.map(p => (
                          <span key={p} className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white border border-indigo-200 text-[10px] font-bold text-indigo-700">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-gray-300" />
            <span>
              Institution ID:{' '}
              <span className="font-semibold text-gray-600">{profile?.institution_id?.slice(0, 8) || '—'}…</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-bold border border-indigo-100 text-[10px] uppercase tracking-wide">
              Faculty
            </span>
          </div>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" />
            ETAM · Education & Attendance Management
          </span>
        </div>
      </div>
    </TeacherLayout>
  );
}