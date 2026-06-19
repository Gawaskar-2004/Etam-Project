import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import TeacherLayout from '@/components/layouts/TeacherLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, RefreshCw, Clock, Users, GraduationCap, BookOpen, CalendarDays, Shield } from 'lucide-react';
import { timetableApi } from '@/lib/api';
import { toast } from 'sonner';

const DAYS_DISPLAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_CODE    = ['MON',    'TUE',     'WED',       'THU',      'FRI',    'SAT'];

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

function ClassCard({ cls, rank }: { cls: any; rank: number }) {
  const colors = [
    { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100' },
    { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
    { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
    { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100' },
    { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100' },
    { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-100' },
  ];
  const c = colors[rank % colors.length];
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className={`p-2 rounded-lg ${c.bg}`}>
          <GraduationCap className={`h-4 w-4 ${c.text}`} />
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-gray-800">{cls.count}</p>
          <p className="text-[10px] text-gray-400">periods/week</p>
        </div>
      </div>
      <h3 className="font-semibold text-gray-800 text-sm line-clamp-1">{cls.name}</h3>
      {cls.section && (
        <span className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
          Section {cls.section}
        </span>
      )}
    </div>
  );
}

function SubjectBadge({ name, colorIdx }: { name: string; colorIdx: number }) {
  const palettes = [
    { dot: 'bg-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700' },
    { dot: 'bg-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
    { dot: 'bg-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
    { dot: 'bg-rose-500', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
    { dot: 'bg-purple-500', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
    { dot: 'bg-cyan-500', bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
  ];
  const p = palettes[colorIdx % palettes.length];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${p.bg} ${p.text} ${p.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />
      {name}
    </span>
  );
}

const fmt12 = (t: string | null | undefined): string => {
  if (!t) return '';
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const addMins = (t: string, mins: number): string => {
  const [h, m] = t.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}:00`;
};

const getLocalBreaks = (): Array<{ afterPeriod: number; duration: number; name: string }> => {
  try {
    const raw = localStorage.getItem('timetable_breaks_config');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

// Deduplicate timetable entries by period_number+day
const deduplicateByPeriodDay = (entries: any[]): any[] => {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.period_number}_${entry.day}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Deduplicate time slots — remove duplicate period numbers, keep all breaks
const deduplicateSlots = (slots: any[]): any[] => {
  const seen = new Set<number>();
  return slots.filter((s: any) => {
    if (s.isBreak) return true;
    if (seen.has(s.period)) return false;
    seen.add(s.period);
    return true;
  });
};

export default function TeacherTimetablePage() {
  const { user, profile } = useAuth();
  const currentUser = user || profile;

  const [timetable, setTimetable]             = useState<any[]>([]);
  const [classes, setClasses]                 = useState<any[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [timeSlots, setTimeSlots]             = useState<any[]>([]);
  const [subjectColorMap, setSubjectColorMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (currentUser?.id) load();
  }, [currentUser?.id]);

  const load = async () => {
    try {
      setLoading(true);
      const [data, periodsRaw] = await Promise.all([
        timetableApi.getAssignments({ user_id: currentUser!.id }),
        timetableApi.getPeriods().catch(() => []),
      ]);
      const rawAssignments: any[] = Array.isArray(data) ? data : (data?.assignments || data || []);
      const periods: any[]        = Array.isArray(periodsRaw) ? periodsRaw : [];

      if (!rawAssignments.length) {
        setTimetable([]);
        setClasses([]);
        setTimeSlots([]);
        setLoading(false);
        return;
      }

      const formatted = rawAssignments.map((item: any) => {
        const className = item.full_class_name
          || [item.category_name, item.subcategory_name, item.item_name].filter(Boolean).join(' ')
          || 'Class';
        return {
          id:            item.id,
          period_number: item.period_number,
          day:           (item.day || '').toUpperCase().slice(0, 3),
          subject_name:  item.subject_name || 'Subject',
          class_name:    className.trim(),
          section:       item.item_name || '',
          start_time:    item.start_time || null,
          end_time:      item.end_time   || null,
        };
      });

      // FIX 1: Deduplicate timetable by period+day
      const deduplicated = deduplicateByPeriodDay(formatted);
      setTimetable(deduplicated);

      const maxPeriod  = Math.max(...deduplicated.map((t: any) => t.period_number), 8);
      const totalSlots = Math.max(maxPeriod, 8);
      const localBreaks = getLocalBreaks();

      if (periods.length > 0) {
        // Deduplicate periods from DB first
        const seenPeriodNums = new Set<number>();
        const teachingPeriods = [...periods]
          .filter((p: any) => !p.is_break)
          .sort((a: any, b: any) => a.period_number - b.period_number)
          .filter((p: any) => {
            if (seenPeriodNums.has(p.period_number)) return false;
            seenPeriodNums.add(p.period_number);
            return true;
          });

        const slots: any[] = [];
        const dbHasBreaks = teachingPeriods.some((p: any) => p.break_duration > 0);

        teachingPeriods.forEach((p: any) => {
          slots.push({
            period:    p.period_number,
            time:      (p.start_time && p.end_time)
              ? `${fmt12(p.start_time)} – ${fmt12(p.end_time)}`
              : `Period ${p.period_number}`,
            isBreak:   false,
            breakName: undefined,
          });
          const dbBreakDur = p.break_duration || 0;
          const localBreak = localBreaks.find((b) => b.afterPeriod === p.period_number);
          const breakDur   = dbBreakDur > 0 ? dbBreakDur : (!dbHasBreaks && localBreak ? localBreak.duration : 0);
          const breakName  = localBreak?.name || 'Break';
          if (breakDur > 0 && p.end_time) {
            const breakEnd = addMins(p.end_time, breakDur);
            slots.push({
              period:    -1,
              time:      `${fmt12(p.end_time)} – ${fmt12(breakEnd)}`,
              isBreak:   true,
              breakName,
            });
          }
        });

        const covered = new Set(slots.filter((s: any) => !s.isBreak).map((s: any) => s.period as number));
        for (let i = 1; i <= totalSlots; i++) {
          if (!covered.has(i)) {
            slots.push({ period: i, time: `Period ${i}`, isBreak: false, breakName: undefined });
          }
        }

        // FIX 2: Deduplicate slots before setting
        setTimeSlots(deduplicateSlots(slots));

      } else {
        const periodTimeMap = new Map<number, { start: string | null; end: string | null }>();
        deduplicated.forEach((e: any) => {
          if (!periodTimeMap.has(e.period_number))
            periodTimeMap.set(e.period_number, { start: e.start_time, end: e.end_time });
        });

        const slots: any[] = [];
        for (let i = 1; i <= totalSlots; i++) {
          const t = periodTimeMap.get(i);
          slots.push({
            period:    i,
            time:      (t?.start && t?.end) ? `${fmt12(t.start)} – ${fmt12(t.end)}` : `Period ${i}`,
            isBreak:   false,
            breakName: undefined,
          });
          const localBreak = localBreaks.find((b) => b.afterPeriod === i);
          if (localBreak && t?.end) {
            const breakEnd = addMins(t.end, localBreak.duration);
            slots.push({
              period:    -1,
              time:      `${fmt12(t.end)} – ${fmt12(breakEnd)}`,
              isBreak:   true,
              breakName: localBreak.name,
            });
          }
        }

        // FIX 2: Deduplicate slots before setting
        setTimeSlots(deduplicateSlots(slots));
      }

      const uniqueSubjects = [...new Set(deduplicated.map((e: any) => e.subject_name as string))];
      const colorMap = new Map<string, number>();
      uniqueSubjects.forEach((s, i) => colorMap.set(s, i % 6));
      setSubjectColorMap(colorMap);

      // Build class list from ALL raw assignments for correct period counts
      const classMap = new Map<string, any>();
      formatted.forEach((entry: any) => {
        const key = entry.class_name;
        if (classMap.has(key)) classMap.get(key).count++;
        else classMap.set(key, { name: entry.class_name, count: 1, section: entry.section });
      });
      setClasses(Array.from(classMap.values()).sort((a, b) => a.name.localeCompare(b.name)));

    } catch {
      toast.error('Failed to load timetable');
    } finally {
      setLoading(false);
    }
  };

  const getEntry = (period: number, dayCode: string) =>
    timetable.find(t => t.period_number === period && t.day === dayCode);

  const todayFull = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayIdx  = DAYS_DISPLAY.indexOf(todayFull);
  const totalPeriods       = timetable.length;
  const uniqueSubjectCount = subjectColorMap.size;
  const classesToday       = timetable.filter(t => t.day === DAYS_CODE[new Date().getDay() === 0 ? 0 : new Date().getDay() - 1]).length;
  const activeDays         = new Set(timetable.map(t => t.day)).size;

  return (
    <TeacherLayout>
      <div className="space-y-6">

        {/* PAGE HEADER */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">My Timetable</h1>
            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {currentUser?.full_name?.split(' ')[0]}'s weekly schedule
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-all"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500">
              <Shield className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* METRIC CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Classes Today"  value={classesToday}        icon={Calendar}      iconBg="bg-indigo-50"  iconColor="text-indigo-600"  loading={loading} />
          <MetricCard label="Active Days"    value={activeDays}          icon={Clock}         iconBg="bg-emerald-50" iconColor="text-emerald-600" loading={loading} />
          <MetricCard label="Total / Week"   value={totalPeriods}        icon={BookOpen}      iconBg="bg-amber-50"   iconColor="text-amber-600"   loading={loading} />
          <MetricCard label="Subjects"       value={uniqueSubjectCount}  icon={GraduationCap} iconBg="bg-purple-50"  iconColor="text-purple-600"  loading={loading} />
        </div>

        {/* ASSIGNED CLASSES */}
        {!loading && classes.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-indigo-500" />
              Assigned Classes
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.map((cls, idx) => (
                <ClassCard key={cls.name} cls={cls} rank={idx} />
              ))}
            </div>
          </div>
        )}

        {/* WEEKLY SCHEDULE */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-indigo-500" />
            Weekly Schedule
          </h2>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-5 space-y-3">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg bg-gray-100" />)}
              </div>
            ) : timetable.length === 0 ? (
              <div className="text-center py-16">
                <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-gray-400" />
                </div>
                <p className="font-medium text-gray-400">No timetable assigned yet</p>
                <p className="text-xs text-gray-300 mt-1">Ask your admin to assign classes</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50/60 border-b border-gray-100">
                      <th className="sticky left-0 z-20 bg-gray-50/60 border-r border-gray-100 p-3 min-w-[170px] text-left">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Period / Time
                        </span>
                      </th>
                      {DAYS_DISPLAY.map((d, di) => {
                        const isToday = di === todayIdx;
                        return (
                          <th key={d} className={`border-b border-r border-gray-100 p-3 min-w-[150px] text-center ${isToday ? 'bg-indigo-50/30' : 'bg-gray-50/30'}`}>
                            <div className="flex flex-col items-center gap-0.5">
                              {isToday && <span className="text-[9px] font-bold text-indigo-600">TODAY</span>}
                              <span className={`text-xs font-semibold ${isToday ? 'text-indigo-700' : 'text-gray-700'}`}>{d}</span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots.map((slot: any, idx: number) => {
                      if (slot.isBreak) {
                        return (
                          <tr key={`brk-${idx}`}>
                            <td colSpan={7} className="border-b border-gray-100 bg-amber-50/40 px-4 py-2">
                              <div className="flex items-center justify-center gap-2 text-xs text-amber-700 font-medium">
                                <div className="h-px flex-1 bg-amber-200" />
                                {slot.breakName} · {slot.time}
                                <div className="h-px flex-1 bg-amber-200" />
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={`p-${slot.period}-${idx}`} className="border-b border-gray-100 hover:bg-indigo-50/20 transition-colors">
                          <td className="sticky left-0 z-10 bg-white border-r border-gray-100 p-3">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center">
                                <span className="text-sm font-bold text-gray-700">{slot.period}</span>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-700">Period {slot.period}</p>
                                <p className="text-[10px] text-gray-400">{slot.time}</p>
                              </div>
                            </div>
                          </td>
                          {DAYS_CODE.map((dayCode, di) => {
                            const entry = getEntry(slot.period, dayCode);
                            const isToday = di === todayIdx;
                            if (entry) {
                              const colorIdx = subjectColorMap.get(entry.subject_name) ?? 0;
                              const palettes = [
                                { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-700',  dot: 'bg-indigo-500'  },
                                { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
                                { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
                                { bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-700',    dot: 'bg-rose-500'    },
                                { bg: 'bg-purple-50',  border: 'border-purple-200',  text: 'text-purple-700',  dot: 'bg-purple-500'  },
                                { bg: 'bg-cyan-50',    border: 'border-cyan-200',    text: 'text-cyan-700',    dot: 'bg-cyan-500'    },
                              ];
                              const p = palettes[colorIdx % palettes.length];
                              return (
                                <td key={dayCode} className={`border-r border-gray-100 p-2 ${isToday ? 'bg-indigo-50/10' : ''}`}>
                                  <div className={`rounded-lg p-2 border ${p.border} ${p.bg}`}>
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />
                                      <p className={`text-xs font-bold truncate ${p.text}`}>{entry.subject_name}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Users className="h-3 w-3 text-gray-400" />
                                      <p className="text-[10px] text-gray-600 truncate">{entry.class_name}</p>
                                    </div>
                                    {entry.section && (
                                      <span className={`inline-block mt-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded border ${p.border} ${p.text} ${p.bg}`}>
                                        Sec {entry.section}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            }
                            return (
                              <td key={dayCode} className={`border-r border-gray-100 p-2 text-center ${isToday ? 'bg-indigo-50/10' : ''}`}>
                                <div className="flex items-center justify-center py-2">
                                  <div className="h-1.5 w-1.5 rounded-full bg-gray-200" />
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Subject Legend */}
          {!loading && subjectColorMap.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <div className="flex items-center gap-1.5 mr-1">
                <BookOpen className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-xs font-medium text-gray-500">Subjects:</span>
              </div>
              {Array.from(subjectColorMap.entries()).map(([name, idx]) => (
                <SubjectBadge key={name} name={name} colorIdx={idx} />
              ))}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-gray-300" />
            <span>
              Institution ID:{' '}
              <span className="font-semibold text-gray-600">{currentUser?.institution_id?.slice(0, 8) || '—'}…</span>
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