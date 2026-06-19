import { useEffect, useRef, useState } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { academicApi, studentsApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  ScanFace, Upload, Camera, CameraOff,
  CheckCircle, XCircle, Loader2, Users, GraduationCap, Trash2
} from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function AdminFaceRegistrationPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceapiRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);

  // Dropdown data
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  // Selections
  const [selectedCat, setSelectedCat] = useState('');
  const [selectedSub, setSelectedSub] = useState('');
  const [selectedSection, setSelectedSection] = useState('');

  // Students
  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  // Camera / upload
  const [cameraOn, setCameraOn] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
    return () => stopCamera();
  }, []);

  const loadModels = async () => {
    setLoadingModels(true);
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
    } catch {
      toast.error('Failed to load face models');
    } finally {
      setLoadingModels(false);
    }
  };

  // Load categories + all subcategories on mount (same as your working code)
  useEffect(() => {
    academicApi.getCategories().then((data: any) =>
      setCategories(Array.isArray(data) ? data : [])
    );
    academicApi.getSubcategories().then((data: any) =>
      setSubcategories(Array.isArray(data) ? data : [])
    );
  }, []);

  // Filter subcategories client-side by selected category (same as your working code)
  const filteredSubs = subcategories.filter(
    (s: any) => !selectedCat || s.category_id === selectedCat || s.category_id === Number(selectedCat)
  );

  // When category changes → reset sub, section, students
  const handleCatChange = (val: string) => {
    setSelectedCat(val);
    setSelectedSub('');
    setSelectedSection('');
    setSections([]);
    setStudents([]);
    setSelectedStudent(null);
    setPreviewUrl(null);
  };

  // When subcategory changes → load sections, reset section + students
  const handleSubChange = (val: string) => {
    setSelectedSub(val);
    setSelectedSection('');
    setStudents([]);
    setSelectedStudent(null);
    setPreviewUrl(null);
    if (!val) { setSections([]); return; }
    loadSections(val);
  };

  // When section changes → load students
  const handleSectionChange = (val: string) => {
    setSelectedSection(val);
    setSelectedStudent(null);
    setPreviewUrl(null);
    if (!val) { setStudents([]); return; }
    loadStudents(val);
  };

  const loadSections = async (subcategoryId: string) => {
    try {
      const data: any = await academicApi.getItems(subcategoryId);
      const list = Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
      setSections(list);
    } catch {
      toast.error('Failed to load items');
      setSections([]);
    }
  };

  const loadStudents = async (sectionId: string) => {
    setLoadingStudents(true);
    try {
      const raw = await studentsApi.list({ section_id: sectionId });
      const list = Array.isArray(raw) ? raw : (raw?.students ?? raw?.data ?? []);
      setStudents(list);
    } catch {
      toast.error('Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      toast.error('Cannot access camera');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOn(false);
    setPreviewUrl(null);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg');
    setPreviewUrl(dataUrl);
    await processImage(dataUrl);
    setCapturing(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setPreviewUrl(dataUrl);
      await processImage(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const processImage = async (dataUrl: string) => {
    const faceapi = faceapiRef.current;
    if (!faceapi || !selectedStudent) { toast.error('Select a student first'); return; }
    setProcessing(true);
    try {
      const img = new Image();
      img.src = dataUrl;
      await new Promise(resolve => { img.onload = resolve; });

      const detection = await faceapi
        .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        toast.error('No face detected! Please use a clear front-facing photo.');
        setPreviewUrl(null);
        return;
      }

      const descriptor = Array.from(detection.descriptor);
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${BASE_URL}/students/${selectedStudent.id}/face-descriptor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          face_descriptor: JSON.stringify(descriptor),
          face_photo: dataUrl,
        }),
      });

      if (!res.ok) throw new Error('Failed to save face data');

      toast.success(`✅ Face registered for ${selectedStudent.full_name}!`);

      const updated = { ...selectedStudent, face_descriptor: JSON.stringify(descriptor), face_photo: dataUrl };
      setStudents(prev => prev.map(s => s.id === selectedStudent.id ? updated : s));
      setSelectedStudent(updated);
      setPreviewUrl(null);

    } catch (e: any) {
      toast.error(e.message || 'Failed to process face');
    } finally {
      setProcessing(false);
    }
  };

  const deleteFace = async (student: any) => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${BASE_URL}/students/${student.id}/face-descriptor`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      toast.success('Face data removed');
      const updated = { ...student, face_descriptor: null, face_photo: null };
      setStudents(prev => prev.map(s => s.id === student.id ? updated : s));
      if (selectedStudent?.id === student.id) {
        setSelectedStudent(updated);
        setPreviewUrl(null);
      }
    } catch {
      toast.error('Failed to delete face data');
    }
  };

  const StudentAvatar = ({ student, size = 'sm' }: { student: any; size?: 'sm' | 'lg' }) => {
    const initials = student.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
    const sizeClass = size === 'lg' ? 'w-14 h-14 text-lg' : 'w-10 h-10 text-sm';
    if (student.face_photo) {
      return (
        <img
          src={student.face_photo}
          className={`${sizeClass} rounded-full object-cover flex-shrink-0 border-2 border-green-400`}
          alt={student.full_name}
        />
      );
    }
    return (
      <div className={`${sizeClass} rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0`}>
        {initials}
      </div>
    );
  };

  const registeredCount = students.filter(s => s.face_descriptor).length;
  const canShowStudents = selectedCat && selectedSub && selectedSection;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <ScanFace className="h-8 w-8 text-primary" /> Face Registration
          </h1>
          <p className="text-muted-foreground">Register student faces for automatic attendance</p>
        </div>

        {/* Models status */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium w-fit ${
          loadingModels ? 'bg-yellow-100 text-yellow-700' :
          modelsLoaded  ? 'bg-green-100 text-green-700'  : 'bg-red-100 text-red-700'
        }`}>
          {loadingModels ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading AI models...</> :
           modelsLoaded  ? <><CheckCircle className="h-4 w-4" /> Face recognition ready</>   :
                           <><XCircle className="h-4 w-4" /> Models failed</>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left panel ── */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <GraduationCap className="h-5 w-5 text-primary" /> Select Class
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">

                {/* Category */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                  <select
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                    value={selectedCat}
                    onChange={e => handleCatChange(e.target.value)}
                  >
                    <option value="">Select category...</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Subcategory — filtered client-side, same as your working code */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Subcategory</label>
                  <select
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                    value={selectedSub}
                    onChange={e => handleSubChange(e.target.value)}
                    disabled={!selectedCat}
                  >
                    <option value="">Select subcategory...</option>
                    {filteredSubs.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Item — loaded via academicApi.getItems when subcategory is selected */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Item</label>
                  <select
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                    value={selectedSection}
                    onChange={e => handleSectionChange(e.target.value)}
                    disabled={!selectedSub}
                  >
                    <option value="">Select item...</option>
                    {sections.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

              </CardContent>
            </Card>

            {/* Student list */}
            {canShowStudents && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" /> Students
                    </span>
                    {students.length > 0 && (
                      <Badge className="bg-green-100 text-green-700">
                        {registeredCount}/{students.length} registered
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingStudents ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                    </div>
                  ) : students.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No students found</p>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                      {students.map(s => (
                        <div
                          key={s.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            selectedStudent?.id === s.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => { setSelectedStudent(s); setPreviewUrl(null); }}
                        >
                          <StudentAvatar student={s} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{s.full_name}</p>
                            <p className="text-xs text-muted-foreground">Roll: {s.roll_number || '—'}</p>
                          </div>
                          {s.face_descriptor
                            ? <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                            : <XCircle    className="h-4 w-4 text-gray-300 flex-shrink-0" />
                          }
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Right panel ── */}
          <div className="lg:col-span-2 space-y-4">
            {!selectedStudent ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-20">
                  <ScanFace className="h-16 w-16 text-muted-foreground opacity-30 mb-4" />
                  <p className="text-muted-foreground text-center">
                    {!selectedCat
                      ? 'Select a Category to get started'
                      : !selectedSub
                      ? 'Now select a Subcategory'
                      : !selectedSection
                      ? 'Now select a Section'
                      : 'Select a student from the list to register their face'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Student info bar */}
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-4">
                      <StudentAvatar student={selectedStudent} size="lg" />
                      <div className="flex-1">
                        <p className="font-semibold text-lg">{selectedStudent.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Roll No: {selectedStudent.roll_number || '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedStudent.face_descriptor
                          ? <Badge className="bg-green-100 text-green-700">Face Registered ✓</Badge>
                          : <Badge className="bg-gray-100 text-gray-600">Not Registered</Badge>
                        }
                        {selectedStudent.face_descriptor && (
                          <Button
                            variant="outline" size="sm"
                            className="text-red-500 border-red-200"
                            onClick={() => deleteFace(selectedStudent)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Camera capture */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Camera className="h-4 w-4 text-primary" /> Capture from Camera
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="relative bg-black rounded-lg overflow-hidden mb-3" style={{ aspectRatio: '4/3' }}>
                        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                        <canvas ref={canvasRef} className="hidden" />
                        {!cameraOn && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                            <CameraOff className="h-8 w-8 opacity-40 mb-2" />
                            <p className="text-xs opacity-60">Camera off</p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {!cameraOn ? (
                          <Button className="flex-1" size="sm" onClick={startCamera} disabled={!modelsLoaded}>
                            <Camera className="h-4 w-4 mr-1" /> Start Camera
                          </Button>
                        ) : (
                          <>
                            <Button className="flex-1" size="sm" onClick={capturePhoto} disabled={capturing || processing}>
                              {capturing || processing
                                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                : <Camera className="h-4 w-4 mr-1" />}
                              {processing ? 'Processing...' : 'Capture'}
                            </Button>
                            <Button variant="outline" size="sm" onClick={stopCamera}>
                              <CameraOff className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Upload photo */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Upload className="h-4 w-4 text-primary" /> Upload Photo
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="relative bg-muted rounded-lg overflow-hidden mb-3" style={{ aspectRatio: '4/3' }}>
                        {previewUrl ? (
                          <>
                            <img src={previewUrl} className="w-full h-full object-cover" alt="preview" />
                            {processing && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <Loader2 className="h-8 w-8 text-white animate-spin" />
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                            <Upload className="h-8 w-8 opacity-40 mb-2" />
                            <p className="text-xs">No photo selected</p>
                          </div>
                        )}
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                      <Button
                        className="w-full" size="sm" variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={processing || !modelsLoaded}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {processing ? 'Processing...' : 'Choose Photo'}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Use a clear front-facing photo
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-4">
                    <p className="text-sm font-semibold text-blue-800 mb-2">📋 Instructions</p>
                    <ul className="text-xs text-blue-700 space-y-1">
                      <li>• Use a clear, front-facing photo with good lighting</li>
                      <li>• Only one face should be visible in the photo</li>
                      <li>• Avoid sunglasses, masks or heavy shadows</li>
                      <li>• The system will automatically detect and register the face</li>
                    </ul>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}