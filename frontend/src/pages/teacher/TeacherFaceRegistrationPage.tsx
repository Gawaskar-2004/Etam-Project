import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import TeacherLayout from '@/components/layouts/TeacherLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { timetableApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  ScanFace, Upload, Camera, CameraOff,
  CheckCircle, XCircle, Loader2, Users, GraduationCap, Trash2,
  RefreshCw, AlertCircle, ImagePlus, UserCheck, UserX, ShieldAlert, Globe, Shield, CalendarDays
} from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const REQUIRED_CAPTURES = 1;
const FACE_MATCH_THRESHOLD = 0.6;

// ─── Helper for initials ─────────────────────────────────────────
const initials = (name: string) =>
  name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

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

// ─── Class Card (dashboard style) ────────────────────────────────
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
              {cls.subcategory_name && (
                <p className="text-[10px] text-gray-400 mt-0.5">{cls.subcategory_name}</p>
              )}
            </div>
          </div>
          {isSelected && <CheckCircle className="h-5 w-5 text-indigo-600 shrink-0" />}
        </div>
      </div>
    </button>
  );
}

// ─── Student Avatar (dashboard style) ────────────────────────────
function StudentAvatar({ student, size = 'sm' }: { student: any; size?: 'sm' | 'lg' }) {
  const initialsLetters = initials(student.full_name);
  const sizeClass = size === 'lg' ? 'w-14 h-14 text-lg' : 'w-10 h-10 text-sm';
  if (student.face_photo) {
    return (
      <img
        src={student.face_photo}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 border-2 border-emerald-400`}
        alt={student.full_name}
      />
    );
  }
  return (
    <div className={`${sizeClass} rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold flex-shrink-0 shadow-sm`}>
      {initialsLetters}
    </div>
  );
}

export default function TeacherFaceRegistrationPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceapiRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detectionIntervalRef = useRef<any>(null);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);

  const [classes, setClasses] = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [selectedClass, setSelectedClass] = useState<any>(null);

  const [students, setStudents] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [loadingAllStudents, setLoadingAllStudents] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [capturedDescriptors, setCapturedDescriptors] = useState<number[][]>([]);
  const [capturedPreviews, setCapturedPreviews] = useState<string[]>([]);
  const [faceDetected, setFaceDetected] = useState(false);
  const [autoCapturing, setAutoCapturing] = useState(false);
  const [duplicateCheckResult, setDuplicateCheckResult] = useState<{ isDuplicate: boolean; studentName?: string; studentClass?: string }>({ isDuplicate: false });

  const { user, profile } = useAuth();
  const currentUser = user || profile;

  useEffect(() => {
    loadModels();
    loadAllStudents();
    return () => {
      stopCamera();
      clearDetectionInterval();
    };
  }, []);

  useEffect(() => {
    if (currentUser?.id) loadClasses();
  }, [currentUser?.id]);

  useEffect(() => {
    if (cameraOn && modelsLoaded) {
      startDetectionLoop();
    } else {
      clearDetectionInterval();
      setFaceDetected(false);
    }
  }, [cameraOn, modelsLoaded]);

  const clearDetectionInterval = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  };

  const startDetectionLoop = () => {
    clearDetectionInterval();
    detectionIntervalRef.current = setInterval(async () => {
      const faceapi = faceapiRef.current;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!faceapi || !video || !canvas || video.readyState < 2) return;

      try {
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
          .withFaceLandmarks();

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const resized = faceapi.resizeResults(detections, { width: canvas.width, height: canvas.height });
          faceapi.draw.drawDetections(canvas, resized);
          faceapi.draw.drawFaceLandmarks(canvas, resized);
        }
        setFaceDetected(detections.length === 1);
      } catch {}
    }, 300);
  };

  const loadModels = async () => {
    setLoadingModels(true);
    setModelError(null);
    try {
      const faceapi = await import('face-api.js');
      faceapiRef.current = faceapi;
      const MODEL_URL = `${window.location.origin}/models`;
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
      toast.success('Face recognition models loaded');
    } catch (error: any) {
      setModelError(error.message);
      toast.error('Failed to load face models. Check /public/models folder.');
    } finally {
      setLoadingModels(false);
    }
  };

  const loadAllStudents = async () => {
    setLoadingAllStudents(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BASE_URL}/students?limit=10000`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch all students');
      const data = await response.json();
      const allStudentsList = Array.isArray(data) ? data : (data?.students || data?.data || []);
      setAllStudents(allStudentsList);
    } catch (error: any) {
      console.error('Failed to load all students:', error);
    } finally {
      setLoadingAllStudents(false);
    }
  };

  const loadClasses = async () => {
    setLoadingClasses(true);
    try {
      const data = await timetableApi.getAssignments({ user_id: currentUser!.id });
      const list = Array.isArray(data) ? data : (data?.assignments || []);

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
          } else {
            className = item.item_name || 'Class';
          }
          map.set(classKey, {
            id: classKey,
            subcategory_id: item.subcategory_id,
            item_id: item.item_id,
            name: className,
            subcategory_name: item.subcategory_name,
            category_name: item.category_name,
          });
        }
      });

      setClasses(Array.from(map.values()));
    } catch (error: any) {
      toast.error('Failed to load classes');
      setClasses([]);
    } finally {
      setLoadingClasses(false);
    }
  };

  const handleClassChange = (cls: any) => {
    setSelectedClass(cls);
    setSelectedStudent(null);
    setPreviewUrl(null);
    resetCaptures();
    setStudents([]);
    stopCamera();
    if (cls) loadStudents(cls);
  };

  const loadStudents = async (cls: any) => {
    setLoadingStudents(true);
    try {
      const token = localStorage.getItem('auth_token');
      let url = `${BASE_URL}/students?`;
      if (cls.subcategory_id) url += `subcategory_id=${cls.subcategory_id}&`;
      if (cls.item_id) url += `item_id=${cls.item_id}&`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch students');
      const data = await response.json();
      const studentsList = Array.isArray(data) ? data : (data?.students || data?.data || []);
      setStudents(studentsList);

      if (studentsList.length === 0) toast.info('No students found in this class');
    } catch (error: any) {
      toast.error('Failed to load students');
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  const startCamera = async () => {
    if (!modelsLoaded) { toast.error('Models not loaded yet'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.style.transform = 'none';
        videoRef.current.style.transform = 'scaleX(1)';
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        toast.error('Camera permission denied');
      } else {
        toast.error('Cannot access camera');
      }
    }
  };

  const stopCamera = () => {
    clearDetectionInterval();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setFaceDetected(false);
    setAutoCapturing(false);
    setDuplicateCheckResult({ isDuplicate: false });
  };

  const resetCaptures = () => {
    setCapturedDescriptors([]);
    setCapturedPreviews([]);
    setPreviewUrl(null);
    setDuplicateCheckResult({ isDuplicate: false });
  };

  const checkFaceDuplicateAcrossInstitution = async (descriptor: number[]): Promise<{ isDuplicate: boolean; studentName?: string; studentId?: string; studentClass?: string }> => {
    const otherStudents = allStudents.filter(s => 
      s.face_descriptor && 
      s.face_descriptor.length > 100 && 
      (!selectedStudent || s.id !== selectedStudent.id)
    );

    if (otherStudents.length === 0) {
      return { isDuplicate: false };
    }

    for (const student of otherStudents) {
      try {
        const storedDescriptor = JSON.parse(student.face_descriptor);
        const distance = euclideanDistance(descriptor, storedDescriptor);
        if (distance < FACE_MATCH_THRESHOLD) {
          return { 
            isDuplicate: true, 
            studentName: student.full_name,
            studentId: student.id,
            studentClass: student.subcategory_name || student.category_name || 'Another Class'
          };
        }
      } catch (e) {
        console.error('Failed to parse descriptor for student', student.id);
      }
    }
    return { isDuplicate: false };
  };

  const euclideanDistance = (arr1: number[], arr2: number[]): number => {
    if (arr1.length !== arr2.length) return 1;
    let sum = 0;
    for (let i = 0; i < arr1.length; i++) {
      sum += Math.pow(arr1[i] - arr2[i], 2);
    }
    return Math.sqrt(sum);
  };

  const captureSingleImage = async (): Promise<{ descriptor: number[]; preview: string } | null> => {
    const faceapi = faceapiRef.current;
    const video = videoRef.current;
    if (!faceapi || !video) return null;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.9);

    const img = new Image();
    img.src = dataUrl;
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

    const detection = await faceapi
      .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return null;

    return {
      descriptor: Array.from(detection.descriptor) as number[],
      preview: dataUrl,
    };
  };

  const handleSingleCapture = async () => {
    if (!selectedStudent) { toast.error('Select a student first'); return; }
    if (selectedStudent.face_descriptor && selectedStudent.face_descriptor.length > 100) {
      toast.error(`❌ ${selectedStudent.full_name} already has a face registered! Please delete existing face first.`);
      return;
    }
    if (!faceDetected) { toast.error('Position face in camera first'); return; }

    setAutoCapturing(true);
    resetCaptures();

    toast.info(`📸 Capturing face for ${selectedStudent.full_name}...`);

    const result = await captureSingleImage();
    
    if (result) {
      const duplicateCheck = await checkFaceDuplicateAcrossInstitution(result.descriptor);
      if (duplicateCheck.isDuplicate) {
        toast.error(`❌ This face already belongs to ${duplicateCheck.studentName} (${duplicateCheck.studentClass})! Cannot register for ${selectedStudent.full_name}.`);
        setDuplicateCheckResult({ 
          isDuplicate: true, 
          studentName: duplicateCheck.studentName,
          studentClass: duplicateCheck.studentClass
        });
        setAutoCapturing(false);
        return;
      }
      setCapturedDescriptors([result.descriptor]);
      setCapturedPreviews([result.preview]);
      setDuplicateCheckResult({ isDuplicate: false });
      toast.success(`✅ Face captured successfully! Click "Register Face" to save.`);
    } else {
      toast.error(`❌ No face detected. Please position face correctly and try again.`);
    }

    setAutoCapturing(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedStudent) { toast.error('Select a student first'); e.target.value = ''; return; }
    if (selectedStudent.face_descriptor && selectedStudent.face_descriptor.length > 100) {
      toast.error(`❌ ${selectedStudent.full_name} already has a face registered! Please delete existing face first.`);
      e.target.value = '';
      return;
    }
    if (!file.type.startsWith('image/')) { toast.error('Upload an image file'); e.target.value = ''; return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image too large (max 5MB)'); e.target.value = ''; return; }

    setProcessing(true);
    resetCaptures();

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setPreviewUrl(dataUrl);

      const faceapi = faceapiRef.current;
      const img = new Image();
      img.src = dataUrl;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

      const detection = await faceapi
        .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        toast.error('No face detected in this image. Use a clear front-facing photo.');
        setPreviewUrl(null);
        setProcessing(false);
        return;
      }

      const descriptor = Array.from(detection.descriptor) as number[];
      const duplicateCheck = await checkFaceDuplicateAcrossInstitution(descriptor);
      if (duplicateCheck.isDuplicate) {
        toast.error(`❌ This face already belongs to ${duplicateCheck.studentName} (${duplicateCheck.studentClass})! Cannot register for ${selectedStudent.full_name}.`);
        setDuplicateCheckResult({ 
          isDuplicate: true, 
          studentName: duplicateCheck.studentName,
          studentClass: duplicateCheck.studentClass
        });
        setPreviewUrl(null);
        setProcessing(false);
        return;
      }
      setCapturedDescriptors([descriptor]);
      setCapturedPreviews([dataUrl]);
      setDuplicateCheckResult({ isDuplicate: false });
      toast.success('Face detected! Click "Register Face" to save.');
      setProcessing(false);
    };
    reader.onerror = () => { toast.error('Failed to read file'); setProcessing(false); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRegister = async () => {
    if (!selectedStudent) { toast.error('No student selected'); return; }
    if (capturedDescriptors.length === 0) { toast.error('No face captured yet'); return; }
    if (selectedStudent.face_descriptor && selectedStudent.face_descriptor.length > 100) {
      toast.error(`❌ ${selectedStudent.full_name} already has a face registered! Please delete the existing face first.`);
      resetCaptures();
      return;
    }

    const duplicateCheck = await checkFaceDuplicateAcrossInstitution(capturedDescriptors[0]);
    if (duplicateCheck.isDuplicate) {
      toast.error(`❌ This face already belongs to ${duplicateCheck.studentName} (${duplicateCheck.studentClass})! Cannot register for ${selectedStudent.full_name}.`);
      resetCaptures();
      return;
    }

    setProcessing(true);
    try {
      const descriptorString = JSON.stringify(capturedDescriptors[0]);
      if (descriptorString.length < 500) {
        toast.error('Face descriptor looks invalid. Please capture again.');
        setProcessing(false);
        return;
      }

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BASE_URL}/students/${selectedStudent.id}/face-descriptor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          face_descriptor: descriptorString,
          face_photo: capturedPreviews[0] || previewUrl,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Failed to save face data');
      }

      toast.success(`✅ Face registered successfully for ${selectedStudent.full_name}!`);

      const updated = {
        ...selectedStudent,
        face_descriptor: descriptorString,
        face_photo: capturedPreviews[0] || previewUrl,
      };
      setStudents(prev => prev.map(s => s.id === selectedStudent.id ? updated : s));
      setSelectedStudent(updated);
      setAllStudents(prev => prev.map(s => s.id === selectedStudent.id ? updated : s));
      resetCaptures();
      stopCamera();
    } catch (error: any) {
      toast.error(error.message || 'Registration failed');
    } finally {
      setProcessing(false);
    }
  };

  const deleteFace = async (student: any) => {
    if (!confirm(`⚠️ WARNING: Remove face data for ${student.full_name}?\n\nThis action cannot be undone and the student will need to register again.`)) return;
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BASE_URL}/students/${student.id}/face-descriptor`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to delete');
      toast.success(`✅ Face data removed for ${student.full_name}`);
      const updated = { ...student, face_descriptor: null, face_photo: null };
      setStudents(prev => prev.map(s => s.id === student.id ? updated : s));
      setAllStudents(prev => prev.map(s => s.id === student.id ? updated : s));
      if (selectedStudent?.id === student.id) {
        setSelectedStudent(updated);
        resetCaptures();
        stopCamera();
      }
    } catch {
      toast.error('Failed to remove face data');
    }
  };

  const institutionRegisteredCount = allStudents.filter(s => s.face_descriptor && s.face_descriptor.length > 100).length;
  const registeredCount = students.filter(s => s.face_descriptor && s.face_descriptor.length > 100).length;
  const canRegister = capturedDescriptors.length > 0 && !processing && !duplicateCheckResult.isDuplicate;
  const isAlreadyRegistered = selectedStudent?.face_descriptor && selectedStudent?.face_descriptor.length > 100;

  if (modelError && !loadingModels) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="bg-white rounded-xl border border-gray-100 max-w-md p-6 text-center shadow-sm">
            <XCircle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-800 mb-2">Face Models Failed to Load</h2>
            <p className="text-gray-500 text-sm mb-2">{modelError}</p>
            <p className="text-xs text-gray-400 mb-4">
              Ensure all 9 model files are in <code className="bg-gray-100 px-1 rounded">public/models/</code>
            </p>
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
          </div>
        </div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* ── PAGE HEADER (dashboard style) ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Face Registration</h1>
            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Register student faces for automatic attendance marking
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
              loadingModels ? 'border-gray-200' : modelsLoaded ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'
            }`}>
              {loadingModels
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" /><span className="text-xs text-gray-600">Loading Models…</span></>
                : modelsLoaded
                  ? <><CheckCircle className="h-3.5 w-3.5 text-emerald-600" /><span className="text-xs text-emerald-700">Models Ready</span></>
                  : <><XCircle className="h-3.5 w-3.5 text-rose-600" /><span className="text-xs text-rose-700">Models Failed</span></>}
            </div>
            <button
              onClick={() => { loadClasses(); loadAllStudents(); }}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-all"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <div className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500">
              <Shield className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* ── METRIC CARDS ── */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Institution Registered"
            value={institutionRegisteredCount}
            icon={Globe}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-600"
            loading={loadingAllStudents}
          />
          <MetricCard
            label="Class Registered"
            value={registeredCount}
            icon={UserCheck}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            subtitle={`out of ${students.length} students`}
            loading={loadingStudents}
          />
        </div>

        {/* ── MAIN GRID ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT PANEL: Classes & Students */}
          <div className="space-y-6">
            {/* Classes Section */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-indigo-500" />
                My Classes
              </h2>
              {loadingClasses ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
                </div>
              ) : classes.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
                  <GraduationCap className="h-10 w-10 mx-auto text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400">No classes assigned</p>
                  <p className="text-xs text-gray-300 mt-1">Ask admin to set up your timetable</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {classes.map((cls) => (
                    <ClassCard
                      key={cls.id}
                      cls={cls}
                      isSelected={selectedClass?.id === cls.id}
                      onClick={() => handleClassChange(cls)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Students Section */}
            {selectedClass && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-indigo-500" />
                  Students
                  <span className="ml-auto text-xs font-normal text-gray-400">
                    {registeredCount}/{students.length} registered
                  </span>
                </h2>
                {loadingStudents ? (
                  <div className="space-y-3">
                    {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
                  </div>
                ) : students.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
                    <Users className="h-10 w-10 mx-auto text-gray-200 mb-2" />
                    <p className="text-sm text-gray-400">No students found</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {students.map(student => {
                      const isRegistered = student.face_descriptor && student.face_descriptor.length > 100;
                      return (
                        <div
                          key={student.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            selectedStudent?.id === student.id
                              ? 'border-indigo-300 bg-indigo-50/50'
                              : isRegistered
                                ? 'border-emerald-200 bg-emerald-50/30 hover:border-emerald-300'
                                : 'border-gray-100 bg-white hover:border-indigo-300'
                          }`}
                          onClick={() => {
                            setSelectedStudent(student);
                            resetCaptures();
                            stopCamera();
                          }}
                        >
                          <StudentAvatar student={student} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{student.full_name}</p>
                            <p className="text-xs text-gray-400">Register No: {student.register_number || student.roll_number || '—'}</p>
                          </div>
                          {isRegistered ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                              <UserCheck className="h-3 w-3" /> Registered
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-400">
                              <UserX className="h-3 w-3" /> Not
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT PANEL: Registration */}
          <div className="lg:col-span-2 space-y-6">
            {!selectedStudent ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
                <ScanFace className="h-16 w-16 mx-auto text-gray-200 mb-4" />
                <p className="text-gray-400">
                  {!selectedClass
                    ? '← Select a class to view students'
                    : '← Select a student to register their face'}
                </p>
              </div>
            ) : (
              <>
                {/* Student Info Card */}
                <div className={`bg-white rounded-xl border p-5 shadow-sm ${isAlreadyRegistered ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100'}`}>
                  <div className="flex items-center gap-4 flex-wrap">
                    <StudentAvatar student={selectedStudent} size="lg" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 text-lg truncate">{selectedStudent.full_name}</p>
                      <p className="text-sm text-gray-500">Register No: {selectedStudent.register_number || selectedStudent.roll_number || 'Not assigned'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Class: {selectedClass?.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAlreadyRegistered ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                          <UserCheck className="h-3 w-3" /> Already Registered
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border border-rose-200 bg-rose-50 text-rose-600">
                          <UserX className="h-3 w-3" /> Not Registered
                        </span>
                      )}
                      {isAlreadyRegistered && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-rose-500 border-rose-200 hover:bg-rose-50"
                          onClick={() => deleteFace(selectedStudent)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {isAlreadyRegistered && (
                    <div className="mt-4 p-3 bg-amber-100 rounded-lg text-xs text-amber-700 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      This student already has a registered face. Delete the existing face first to register a new one.
                    </div>
                  )}
                </div>

                {/* Duplicate Face Warning */}
                {duplicateCheckResult.isDuplicate && !isAlreadyRegistered && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
                    <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-rose-800">⚠️ Face Already Registered</p>
                      <p className="text-xs text-rose-700 mt-1">
                        This face already belongs to <strong>{duplicateCheckResult.studentName}</strong> 
                        {duplicateCheckResult.studentClass && ` (${duplicateCheckResult.studentClass})`}. 
                        Cannot register for {selectedStudent.full_name}.
                      </p>
                    </div>
                  </div>
                )}

                {/* Capture Preview */}
                {capturedDescriptors.length > 0 && !isAlreadyRegistered && !duplicateCheckResult.isDuplicate && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-emerald-800">✅ Face captured successfully!</p>
                      <p className="text-xs text-emerald-700">Click "Register Face" to save.</p>
                    </div>
                    {capturedPreviews[0] && (
                      <img src={capturedPreviews[0]} alt="Captured face" className="w-12 h-12 rounded-lg object-cover border-2 border-emerald-400" />
                    )}
                  </div>
                )}

                {/* Camera & Upload (if not already registered) */}
                {!isAlreadyRegistered ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Camera Card */}
                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100">
                          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                            <Camera className="h-4 w-4 text-indigo-600" /> Camera Capture
                            {cameraOn && (
                              <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                faceDetected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {faceDetected ? '✅ Face Detected' : '⏳ No Face'}
                              </span>
                            )}
                          </h2>
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                            <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
                            {!cameraOn && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
                                <CameraOff className="h-8 w-8 opacity-50 mb-2" />
                                <p className="text-xs">Camera off</p>
                              </div>
                            )}
                          </div>
                          {!cameraOn ? (
                            <Button className="w-full" onClick={startCamera} disabled={!modelsLoaded}>
                              <Camera className="h-4 w-4 mr-2" /> Start Camera
                            </Button>
                          ) : (
                            <div className="flex gap-2">
                              <Button
                                className="flex-1"
                                onClick={handleSingleCapture}
                                disabled={autoCapturing || processing || !faceDetected}
                              >
                                {autoCapturing
                                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Capturing...</>
                                  : <><Camera className="h-4 w-4 mr-2" /> Capture Face</>
                                }
                              </Button>
                              <Button variant="outline" onClick={stopCamera} disabled={autoCapturing}>
                                <CameraOff className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          {cameraOn && !faceDetected && (
                            <p className="text-xs text-amber-600 text-center flex items-center justify-center gap-1">
                              <AlertCircle className="h-3 w-3" /> Position face in camera — look straight ahead
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Upload Card */}
                      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100">
                          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                            <Upload className="h-4 w-4 text-indigo-600" /> Upload Photo
                          </h2>
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
                            {(previewUrl || capturedPreviews[0]) ? (
                              <>
                                <img src={previewUrl || capturedPreviews[0]} className="w-full h-full object-cover" alt="Preview" />
                                {processing && (
                                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                                <ImagePlus className="h-8 w-8 opacity-30 mb-1" />
                                <p className="text-xs">No photo selected</p>
                              </div>
                            )}
                          </div>
                          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                          <Button
                            className="w-full"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={processing || !modelsLoaded}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {processing ? 'Processing...' : 'Choose Photo'}
                          </Button>
                          <p className="text-xs text-gray-500 text-center">
                            Clear front-facing photo, good lighting
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Register Button */}
                    {canRegister && !duplicateCheckResult.isDuplicate && (
                      <Button
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                        onClick={handleRegister}
                        disabled={processing}
                      >
                        {processing ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Registering...</>
                        ) : (
                          <><CheckCircle className="h-4 w-4 mr-2" /> Register Face for {selectedStudent.full_name}</>
                        )}
                      </Button>
                    )}
                  </>
                ) : (
                  <div className="bg-gray-50 rounded-xl border border-gray-100 p-8 text-center">
                    <UserCheck className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                    <p className="text-base font-semibold text-emerald-700">Face Already Registered</p>
                    <p className="text-sm text-gray-500 mt-2">
                      {selectedStudent.full_name} already has a registered face.
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      To register a new face, first delete the existing registration using the delete button above.
                    </p>
                  </div>
                )}

                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-blue-800 mb-2">📋 How to Register</p>
                  <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                    <li>Camera: Start camera → face detected → click "Capture Face" → click Register</li>
                    <li>Upload: Choose a clear front-facing photo → click Register</li>
                    <li>One face per student only — cannot register multiple times</li>
                    <li>Face cannot be used for another student anywhere in the institution</li>
                    <li>Use good lighting and look straight at the camera</li>
                    <li>No glasses, masks, or heavy shadows</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── FOOTER (dashboard style) ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-gray-300" />
            <span>
              Institution ID:{' '}
              <span className="font-semibold text-gray-600">{currentUser?.institution_id?.slice(0, 8) || '—'}…</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-bold border border-indigo-100 text-[10px] uppercase tracking-wide">
              AI Registration
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