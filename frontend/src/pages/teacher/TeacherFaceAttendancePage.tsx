import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import TeacherLayout from '@/components/layouts/TeacherLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { timetableApi, studentsApi, attendanceApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  Camera, CameraOff, Save, Users, CheckCircle,
  XCircle, Loader2, ScanFace, GraduationCap, Clock,
  ArrowLeft, ArrowRight, RotateCcw, Zap, RefreshCw, CalendarDays, Shield
} from 'lucide-react';

// ─── Metric Card (same as dashboard) ───────────────────────────────────────
function MetricCard({ label, value, icon: Icon, iconBg, iconColor, loading }: any) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <Skeleton className="h-3 w-20 mb-4 bg-gray-100" />
        <Skeleton className="h-7 w-14 mb-2 bg-gray-100" />
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
    </div>
  );
}

// ─── Helper initials ──────────────────────────────────────────────────────
const initials = (name: string) =>
  name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

// ─── Time helper ──────────────────────────────────────────────────────────
const formatTo12Hour = (time24: string) => {
  if (!time24) return '';
  const [hour, minute] = time24.split(':');
  let h = parseInt(hour, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${minute} ${ampm}`;
};

// ─── Class Card (dashboard style) ─────────────────────────────────────────
function ClassCard({ cls, isSelected, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`group bg-white rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden text-left w-full ${
        isSelected ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-100'
      }`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-lg bg-indigo-50 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm leading-tight">{cls.name}</p>
              {cls.item_name && (
                <p className="text-[10px] text-gray-400 mt-0.5">Section {cls.item_name}</p>
              )}
            </div>
          </div>
          {isSelected && <CheckCircle className="h-5 w-5 text-indigo-600 shrink-0" />}
        </div>
      </div>
    </button>
  );
}

// ─── Period Item (dashboard style) ────────────────────────────────────────
function PeriodItem({ period, isSelected, isSaved, subjectName, onClick }: any) {
  const timeStr = period.start_time && period.end_time
    ? `${formatTo12Hour(period.start_time)} – ${formatTo12Hour(period.end_time)}`
    : null;

  return (
    <button
      onClick={onClick}
      className={`group bg-white rounded-lg border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden text-left w-full ${
        isSelected ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-100'
      } ${isSaved ? 'opacity-70' : ''}`}
    >
      <div className="flex items-center gap-3 p-4">
        <div className="h-12 w-12 rounded-lg bg-gray-50 border border-gray-200 flex flex-col items-center justify-center shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Per</span>
          <span className="text-lg font-bold text-gray-800">{period.period_number}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate leading-tight">{subjectName || period.subject_name || 'Subject'}</p>
          {timeStr && (
            <div className="flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3 text-gray-400" />
              <span className="text-xs font-medium text-gray-500">{timeStr}</span>
            </div>
          )}
        </div>
        {isSaved && (
          <Badge className="bg-emerald-100 text-emerald-700 text-xs gap-1">
            <CheckCircle className="h-3 w-3" /> Saved
          </Badge>
        )}
        {isSelected && <CheckCircle className="h-5 w-5 text-indigo-600 shrink-0" />}
      </div>
    </button>
  );
}

export default function TeacherFaceAttendancePage() {
  const { user, profile } = useAuth();
  const currentUser = user || profile;

  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const intervalRef = useRef<any>(null);
  const faceapiRef  = useRef<any>(null);

  const [step, setStep]                             = useState<1 | 2>(1);
  const [modelsLoaded, setModelsLoaded]             = useState(false);
  const [loadingModels, setLoadingModels]           = useState(true);
  const [classes, setClasses]                       = useState<any[]>([]);
  const [assignments, setAssignments]               = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses]         = useState(true);
  const [selectedClass, setSelectedClass]           = useState<any>(null);
  const [selectedPeriod, setSelectedPeriod]         = useState<number | null>(null);
  const [periodSubject, setPeriodSubject]           = useState('');
  const [savedPeriods, setSavedPeriods]             = useState<number[]>([]);
  const [students, setStudents]                     = useState<any[]>([]);
  const [labeledDescriptors, setLabeledDescriptors] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents]       = useState(false);
  const [cameraOn, setCameraOn]                     = useState(false);
  const [scanning, setScanning]                     = useState(false);
  const [saving, setSaving]                         = useState(false);
  const [detected, setDetected]                     = useState<string | null>(null);
  const [attendanceHistory, setAttendanceHistory]   = useState<any[]>([]);

  const date  = new Date().toISOString().split('T')[0];
  const today = ['SUN','MON','TUE','WED','THU','FRI','SAT'][new Date().getDay()];

  const presentCount = students.filter(s => s.present).length;
  const absentCount  = students.length - presentCount;

  const todayPeriods = selectedClass
    ? assignments
        .filter(a =>
          a.subcategory_id === selectedClass.subcategory_id &&
          a.item_id === selectedClass.item_id &&
          a.day === today
        )
        .sort((a, b) => a.period_number - b.period_number)
    : [];

  const periodsToShow   = todayPeriods.length > 0 ? todayPeriods : null;
  const fallbackPeriods = [1, 2, 3, 4, 5, 6, 7, 8];

  useEffect(() => { loadModels(); return () => stopCamera(); }, []);
  useEffect(() => { if (currentUser?.id) loadClasses(); }, [currentUser?.id]);

  const loadModels = async () => {
    setLoadingModels(true);
    try {
      const faceapi   = await import('face-api.js');
      faceapiRef.current = faceapi;
      const MODEL_URL = `${window.location.origin}/models`;
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
      toast.success('Face recognition models loaded');
    } catch (error) {
      console.error('Failed to load face models:', error);
      toast.error('Failed to load face models');
    } finally {
      setLoadingModels(false);
    }
  };

  const loadClasses = async () => {
    setLoadingClasses(true);
    try {
      const data = await timetableApi.getAssignments({ user_id: currentUser!.id });
      const list = Array.isArray(data) ? data : (data?.assignments || []);
      setAssignments(list);

      const map = new Map<string, any>();
      list.forEach((item: any) => {
        const classKey = `${item.subcategory_id || 'none'}_${item.item_id || 'none'}`;
        if (!map.has(classKey)) {
          let className = '';
          if (item.category_name && item.subcategory_name && item.item_name) {
            className = `${item.category_name} ${item.subcategory_name} ${item.item_name}`;
          } else if (item.subcategory_name && item.item_name) {
            className = `${item.subcategory_name} ${item.item_name}`;
          } else if (item.subcategory_name) {
            className = item.subcategory_name;
          } else if (item.item_name) {
            className = `Section ${item.item_name}`;
          } else {
            className = item.class_name || 'Class';
          }
          map.set(classKey, {
            id: classKey,
            subcategory_id: item.subcategory_id,
            item_id: item.item_id,
            name: className,
            item_name: item.item_name,
          });
        }
      });

      setClasses(Array.from(map.values()));
    } catch (error) {
      console.error('Failed to load classes:', error);
      toast.error('Failed to load classes');
    } finally {
      setLoadingClasses(false);
    }
  };

  const proceedToScan = async () => {
    if (!selectedClass)  { toast.error('Please select a class');  return; }
    if (!selectedPeriod) { toast.error('Please select a period'); return; }
    setLoadingStudents(true);
    try {
      const faceapi = faceapiRef.current;
      const raw     = await studentsApi.list({
        subcategory_id: selectedClass.subcategory_id,
        item_id: selectedClass.item_id || undefined,
      });
      const list       = Array.isArray(raw) ? raw : (raw?.students || raw || []);
      const withStatus = list.map((s: any) => ({ ...s, present: false, detectedAt: null }));
      setStudents(withStatus);
      setAttendanceHistory([]);

      if (faceapi && withStatus.length > 0) {
        const labeled: any[] = [];
        for (const s of withStatus) {
          if (s.face_descriptor) {
            try {
              const descriptor = new Float32Array(JSON.parse(s.face_descriptor));
              labeled.push(new faceapi.LabeledFaceDescriptors(s.id, [descriptor]));
            } catch (err) {
              console.error(`Failed to parse face descriptor for ${s.full_name}:`, err);
            }
          }
        }
        setLabeledDescriptors(labeled);
        if (labeled.length === 0) {
          toast.warning('No face data registered. You can still mark manually.');
        } else {
          toast.success(`${labeled.length} face profiles loaded`);
        }
      } else if (!faceapi) {
        toast.warning('Face recognition not available. Manual marking only.');
      }
      setStep(2);
    } catch (error) {
      console.error('Failed to load students:', error);
      toast.error('Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      toast.success('Camera started');
    } catch (error) {
      console.error('Camera error:', error);
      toast.error('Cannot access camera. Please allow camera permission.');
    }
  };

  const stopCamera = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOn(false);
    setScanning(false);
    setDetected(null);
  };

  const startScan = () => {
    if (!modelsLoaded) { toast.error('Face recognition models not loaded yet'); return; }
    if (labeledDescriptors.length === 0) {
      toast.warning('No face profiles. You can still mark manually from the student list.');
      return;
    }
    setScanning(true);
    intervalRef.current = setInterval(detectFace, 1200);
    toast.success(`Scanning started for Period ${selectedPeriod}${periodSubject ? ` — ${periodSubject}` : ''}`);
  };

  const stopScan = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setScanning(false);
    setDetected(null);
    toast.info('Scanning stopped');
  };

  const detectFace = async () => {
    const faceapi = faceapiRef.current;
    if (!faceapi || !videoRef.current || !canvasRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState !== 4) return;

    const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 };
    faceapi.matchDimensions(canvas, displaySize);

    try {
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      const resized = faceapi.resizeResults(detections, displaySize);
      const ctx     = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resized);
      }
      if (!resized.length) return;

      const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.5);
      for (const detection of resized) {
        const match = faceMatcher.findBestMatch(detection.descriptor);
        if (match.label !== 'unknown') {
          setStudents(prev => {
            const student = prev.find(s => s.id === match.label);
            if (student && !student.present) {
              const now = new Date().toLocaleTimeString();
              setDetected(student.full_name);
              setAttendanceHistory(h => [...h, { name: student.full_name, time: now, period: selectedPeriod }]);
              toast.success(`✓ ${student.full_name} — Present!`);
              setTimeout(() => setDetected(null), 2500);
              return prev.map(s => s.id === match.label ? { ...s, present: true, detectedAt: now } : s);
            }
            return prev;
          });
        }
      }
    } catch (e) {
      console.error('Detection error:', e);
    }
  };

  const saveAttendance = async () => {
    if (!selectedClass || !students.length || !selectedPeriod) return;
    setSaving(true);
    try {
      const session = await attendanceApi.createSession({
        date,
        subcategory_id: selectedClass.subcategory_id,
        category_id:    selectedClass.category_id || null,
        item_id:        selectedClass.item_id || null,
        marked_by:      currentUser?.id,
        period_number:  selectedPeriod,
      });
      if (!session?.id) { toast.error('Failed to create attendance session'); return; }

      await attendanceApi.saveRecords(
        session.id,
        students.map(s => ({ student_id: s.id, status: s.present ? 'present' : 'absent' }))
      );
      setSavedPeriods(prev => [...new Set([...prev, selectedPeriod!])]);
      toast.success(`✅ Period ${selectedPeriod}${periodSubject ? ` (${periodSubject})` : ''} saved — ${presentCount} present, ${absentCount} absent`);
      stopScan();
      stopCamera();
      setStep(1);
      setSelectedPeriod(null);
      setPeriodSubject('');
      setStudents([]);
      setAttendanceHistory([]);
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const goBackToStep1 = () => {
    stopScan();
    stopCamera();
    setStep(1);
    setStudents([]);
    setAttendanceHistory([]);
  };

  const toggleStudent = (id: string) =>
    setStudents(prev => prev.map(s =>
      s.id === id
        ? { ...s, present: !s.present, detectedAt: s.present ? null : new Date().toLocaleTimeString() }
        : s
    ));

  // Step indicator pill component (dashboard style)
  const StepPill = ({ num, label, active, completed }: any) => (
    <div className="flex items-center gap-2">
      <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all ${
        active ? 'bg-indigo-600 text-white shadow-sm' :
        completed ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'
      }`}>
        {completed ? <CheckCircle className="h-4 w-4" /> : num}
      </div>
      <span className={`text-sm font-medium hidden sm:inline ${active ? 'text-gray-800' : 'text-gray-500'}`}>
        {label}
      </span>
    </div>
  );

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* ── PAGE HEADER (dashboard style) ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Face Attendance</h1>
            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Period‑wise automatic attendance using face recognition
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadClasses}
              disabled={loadingClasses}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-all"
            >
              <RefreshCw className={`h-4 w-4 ${loadingClasses ? 'animate-spin' : ''}`} />
            </button>
            <div className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500">
              <Shield className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Model status card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          {loadingModels
            ? <><Loader2 className="h-4 w-4 animate-spin text-indigo-500" /><span className="text-sm text-gray-600">Loading AI models...</span></>
            : modelsLoaded
              ? <><CheckCircle className="h-4 w-4 text-emerald-500" /><span className="text-sm text-gray-600">Face recognition ready</span></>
              : <><XCircle className="h-4 w-4 text-rose-500" /><span className="text-sm text-gray-600">Models failed</span></>}
        </div>

        {/* Step indicator (pills) */}
        <div className="flex items-center gap-6">
          <StepPill num={1} label="Select Class & Period" active={step === 1} completed={step > 1} />
          <div className="h-px w-12 bg-gray-200" />
          <StepPill num={2} label="Scan & Mark" active={step === 2} completed={step > 2} />
        </div>

        {/* Saved periods badges */}
        {savedPeriods.length > 0 && step === 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium">Saved today:</span>
            {savedPeriods.map(p => (
              <Badge key={p} className="bg-emerald-100 text-emerald-700 text-xs gap-1 border-emerald-200">
                <CheckCircle className="h-3 w-3" /> P{p}
              </Badge>
            ))}
          </div>
        )}

        {/* ═════ STEP 1 ═════ */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Select Class */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-indigo-500" />
                Select Class
              </h2>
              {loadingClasses ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
                </div>
              ) : classes.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
                  <GraduationCap className="h-12 w-12 mx-auto text-gray-200 mb-3" />
                  <p className="font-medium text-gray-400">No classes assigned</p>
                  <p className="text-xs text-gray-300 mt-1">Ask admin to set up your timetable</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classes.map((cls) => (
                    <ClassCard
                      key={cls.id}
                      cls={cls}
                      isSelected={selectedClass?.id === cls.id}
                      onClick={() => { setSelectedClass(cls); setSelectedPeriod(null); setPeriodSubject(''); }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Select Period */}
            {selectedClass && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-indigo-500" />
                  Select Period · {today}
                </h2>
                {periodsToShow ? (
                  <div className="grid grid-cols-1 gap-3">
                    {periodsToShow.map((period) => (
                      <PeriodItem
                        key={period.period_number}
                        period={period}
                        subjectName={period.subject_name}
                        isSelected={selectedPeriod === period.period_number}
                        isSaved={savedPeriods.includes(period.period_number)}
                        onClick={() => { setSelectedPeriod(period.period_number); setPeriodSubject(period.subject_name || ''); }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <p className="text-sm text-amber-700 font-medium">No periods today — select manually:</p>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {fallbackPeriods.map(p => {
                        const isSaved = savedPeriods.includes(p);
                        return (
                          <button
                            key={p}
                            onClick={() => { setSelectedPeriod(p); setPeriodSubject(''); }}
                            className={`w-14 h-14 rounded-xl text-sm font-bold border-2 transition-all duration-200 ${
                              selectedPeriod === p
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                : isSaved
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                  : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-400'
                            }`}
                          >
                            P{p}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Proceed banner */}
            {selectedClass && selectedPeriod !== null && (
              <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <ScanFace className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">Ready for Face Scan</p>
                      <p className="text-xs text-gray-500">
                        {selectedClass.name} · P{selectedPeriod}
                        {periodSubject && ` · ${periodSubject}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={proceedToScan}
                    disabled={!modelsLoaded || loadingStudents}
                    className="flex items-center gap-2 bg-indigo-600 text-white font-semibold text-sm px-4 py-2 rounded-lg shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-60"
                  >
                    {loadingStudents
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading...</>
                      : <><Zap className="h-4 w-4" /> Start Scanning <ArrowRight className="h-4 w-4" /></>
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═════ STEP 2 ═════ */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Context bar */}
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <button onClick={goBackToStep1} className="flex items-center gap-1 text-sm text-indigo-600 hover:underline font-medium">
                    <ArrowLeft className="h-4 w-4" /> Change
                  </button>
                  <div className="h-5 w-px bg-gray-200" />
                  <div className="text-sm">
                    <span className="text-gray-500">Class:</span>
                    <span className="font-bold text-gray-800 ml-1">{selectedClass?.name}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">Period:</span>
                    <span className="font-bold text-gray-800 ml-1">P{selectedPeriod}</span>
                    {periodSubject && <span className="text-gray-500 ml-1">({periodSubject})</span>}
                  </div>
                  <div className="text-sm text-gray-500">{date}</div>
                </div>
                {scanning && (
                  <Badge className="bg-rose-100 text-rose-700 animate-pulse gap-1 border-rose-200">
                    <span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1" /> LIVE SCAN — P{selectedPeriod}
                  </Badge>
                )}
              </div>
            </div>

            {/* Stats cards (dashboard style metrics) */}
            <div className="grid grid-cols-3 gap-3">
              <MetricCard
                label="Total Students"
                value={students.length}
                icon={Users}
                iconBg="bg-indigo-50"
                iconColor="text-indigo-600"
              />
              <MetricCard
                label="Present"
                value={presentCount}
                icon={CheckCircle}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
              />
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-400">Attendance %</span>
                </div>
                <p className={`text-2xl font-bold tabular-nums ${presentCount / students.length >= 0.75 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {students.length ? Math.round((presentCount / students.length) * 100) : 0}%
                </p>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${presentCount / students.length >= 0.75 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: students.length ? `${(presentCount / students.length) * 100}%` : 0 }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Camera panel */}
              <div className="space-y-4">
                <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <Camera className="h-4 w-4 text-indigo-600" /> Camera
                    </h2>
                  </div>
                  <div className="p-4">
                    <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                      <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
                      {!cameraOn && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/50">
                          <CameraOff className="h-12 w-12 opacity-40 mb-2" />
                          <p className="text-sm opacity-60">Camera is off</p>
                        </div>
                      )}
                      {detected && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-6 py-2 rounded-full font-semibold text-sm shadow-lg z-10 animate-pulse">
                          ✓ {detected} — Present!
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-4">
                      {!cameraOn ? (
                        <Button className="flex-1" onClick={startCamera} disabled={!modelsLoaded}>
                          <Camera className="h-4 w-4 mr-2" /> Start Camera
                        </Button>
                      ) : (
                        <Button variant="outline" className="flex-1" onClick={stopCamera}>
                          <CameraOff className="h-4 w-4 mr-2" /> Stop Camera
                        </Button>
                      )}
                      {cameraOn && !scanning && (
                        <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={startScan} disabled={labeledDescriptors.length === 0}>
                          <ScanFace className="h-4 w-4 mr-2" /> Start Scan
                        </Button>
                      )}
                      {scanning && (
                        <Button variant="outline" className="flex-1 border-rose-300 text-rose-600 hover:bg-rose-50" onClick={stopScan}>
                          Stop Scan
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {attendanceHistory.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-3 border-b border-gray-100">
                      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5" /> Detection Log
                      </h2>
                    </div>
                    <div className="p-3 max-h-48 overflow-y-auto">
                      <div className="space-y-2">
                        {[...attendanceHistory].reverse().map((h, i) => (
                          <div key={i} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2 last:border-0">
                            <span className="font-medium text-emerald-600 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> {h.name}
                            </span>
                            <span className="text-xs text-gray-500">P{h.period} • {h.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {labeledDescriptors.length === 0 && !loadingStudents && (
                  <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <p className="font-semibold text-amber-800">No face profiles found</p>
                      <p className="text-amber-700 text-xs mt-1">
                        Ask admin to register student faces. You can still mark manually via the student list.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Students list */}
              <div className="space-y-4">
                <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <Users className="h-4 w-4 text-indigo-600" /> Students — P{selectedPeriod}
                      {periodSubject && <span className="text-xs font-normal text-gray-500 ml-1">({periodSubject})</span>}
                    </h2>
                    <button
                      onClick={() => setStudents(prev => prev.map(s => ({ ...s, present: false, detectedAt: null })))}
                      className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                      <RotateCcw className="h-3 w-3" /> Reset All
                    </button>
                  </div>
                  <div>
                    {loadingStudents ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                      </div>
                    ) : students.length === 0 ? (
                      <div className="text-center py-12">
                        <Users className="h-12 w-12 mx-auto text-gray-200 mb-3" />
                        <p className="text-gray-400">No students found in this class</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
                        {students.map(s => (
                          <button
                            key={s.id}
                            onClick={() => toggleStudent(s.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 transition-all hover:bg-gray-50 ${
                              s.present ? 'bg-emerald-50/30' : ''
                            }`}
                          >
                            <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shadow-sm">
                              {initials(s.full_name)}
                            </div>
                            <div className="flex-1 text-left">
                              <p className="font-medium text-sm text-gray-800 truncate">{s.full_name}</p>
                              <p className="text-[11px] text-gray-400">
                                Reg: {s.register_number || '—'}
                                {s.detectedAt && <span className="ml-2 text-emerald-600 font-medium">• Scanned {s.detectedAt}</span>}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {s.face_descriptor && (
                                <Badge className="bg-blue-100 text-blue-700 text-[10px] hidden sm:flex border-blue-200">Face ✓</Badge>
                              )}
                              {s.present ? (
                                <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                                  <CheckCircle className="h-4 w-4" /> Present
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-rose-500 text-xs">
                                  <XCircle className="h-4 w-4" /> Absent
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {students.length > 0 && (
                  <Button
                    onClick={saveAttendance}
                    disabled={saving}
                    className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                  >
                    {saving
                      ? <><Loader2 className="h-5 w-5 animate-spin" /> Saving...</>
                      : <><Save className="h-5 w-5" /> Save P{selectedPeriod}{periodSubject ? ` (${periodSubject})` : ''} — {presentCount} Present</>}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── FOOTER (dashboard style) ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-gray-300" />
            <span>
              Institution ID:{' '}
              <span className="font-semibold text-gray-600">{currentUser?.institution_id?.slice(0, 8) || '—'}…</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-bold border border-indigo-100 text-[10px] uppercase tracking-wide">
              AI Powered
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