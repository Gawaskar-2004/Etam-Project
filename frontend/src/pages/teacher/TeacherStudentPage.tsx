import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import TeacherLayout from '@/components/layouts/TeacherLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { timetableApi, studentsApi } from '@/lib/api';
import { toast } from 'sonner';
import {
  Search, Users, GraduationCap, Filter, Eye,
  Phone, Mail, Calendar, User, BookOpen, CheckCircle, XCircle, Shield, CalendarDays
} from 'lucide-react';

// ─── Helper ──────────────────────────────────────────────────────
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

// ─── Class Card (dashboard style, no gradients) ─────────────────
function ClassCard({ cls, isSelected, onClick, studentCount }: any) {
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
        <div className="flex items-baseline gap-1">
          <p className="text-2xl font-bold text-gray-800">{studentCount}</p>
          <p className="text-xs text-gray-400">students</p>
        </div>
      </div>
    </button>
  );
}

export default function TeacherStudentsPage() {
  const { user, profile } = useAuth();
  const currentUser = user || profile;

  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterGender, setFilterGender] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [viewOpen, setViewOpen] = useState(false);

  useEffect(() => { 
    if (currentUser?.id) loadClasses(); 
  }, [currentUser?.id]);
  
  useEffect(() => { 
    if (selectedClass) loadStudents(); 
  }, [selectedClass]);

  useEffect(() => {
    let result = students;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.full_name?.toLowerCase().includes(q) ||
        s.register_number?.toString().toLowerCase().includes(q) ||
        s.student_email?.toLowerCase().includes(q) ||
        s.parent_name?.toLowerCase().includes(q)
      );
    }
    if (filterGender !== 'all') result = result.filter(s => s.gender?.toLowerCase() === filterGender);
    if (filterStatus !== 'all') result = result.filter(s => (s.status || 'active') === filterStatus);
    setFiltered(result);
  }, [search, students, filterGender, filterStatus]);

  const loadClasses = async () => {
    try {
      setLoadingClasses(true);
      const data = await timetableApi.getAssignments({ user_id: currentUser!.id });
      const assignments = Array.isArray(data) ? data : (data?.assignments || []);
      
      const map = new Map<string, any>();
      assignments.forEach((item: any) => {
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
      
      const list = await Promise.all(
        Array.from(map.values()).map(async (cls) => {
          try {
            const r = await studentsApi.list({ 
              subcategory_id: cls.subcategory_id,
              item_id: cls.item_id || undefined
            });
            const studentCount = Array.isArray(r) ? r.length : (r?.students || []).length;
            return { ...cls, student_count: studentCount };
          } catch { 
            return { ...cls, student_count: 0 }; 
          }
        })
      );
      setClasses(list);
    } catch (error) {
      console.error('Failed to load classes:', error);
      toast.error('Failed to load classes');
    } finally { 
      setLoadingClasses(false); 
    }
  };

  const loadStudents = async () => {
    try {
      setLoadingStudents(true);
      const selectedClassData = classes.find(c => c.id === selectedClass);
      if (!selectedClassData) return;
      
      const data = await studentsApi.list({ 
        subcategory_id: selectedClassData.subcategory_id,
        item_id: selectedClassData.item_id || undefined
      });
      const list = Array.isArray(data) ? data : (data?.students || []);
      setStudents(list);
      setFiltered(list);
    } catch (error) {
      console.error('Failed to load students:', error);
      toast.error('Failed to load students');
    } finally { 
      setLoadingStudents(false); 
    }
  };

  const selectedClassName = classes.find(c => c.id === selectedClass)?.name || '';
  const selectedItemName = classes.find(c => c.id === selectedClass)?.item_name || '';

  const clearFilters = () => { setSearch(''); setFilterGender('all'); setFilterStatus('all'); };
  const hasFilters = search || filterGender !== 'all' || filterStatus !== 'all';

  const genderCounts = {
    male: students.filter(s => s.gender?.toLowerCase() === 'male').length,
    female: students.filter(s => s.gender?.toLowerCase() === 'female').length,
  };

  const totalStudentsAcrossClasses = classes.reduce((sum, c) => sum + (c.student_count || 0), 0);
  const enrolledStudents = students.length;
  const activeStudents = students.filter(s => (s.status || 'active') === 'active').length;

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* ── PAGE HEADER (dashboard style) ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">My Students</h1>
            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Students in your assigned classes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100">
              <Users className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">{totalStudentsAcrossClasses}</span>
              <span className="text-xs text-gray-400">total</span>
            </div>
            <div className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500">
              <Shield className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* ── METRIC CARDS ── */}
        <div className="grid grid-cols-3 gap-3">
          <MetricCard
            label="Enrolled"
            value={enrolledStudents}
            icon={Users}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-600"
            loading={loadingStudents}
          />
          <MetricCard
            label="Active"
            value={activeStudents}
            icon={CheckCircle}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            loading={loadingStudents}
          />
          <MetricCard
            label="Inactive"
            value={students.length - activeStudents}
            icon={XCircle}
            iconBg="bg-rose-50"
            iconColor="text-rose-600"
            loading={loadingStudents}
          />
        </div>

        {/* ── CLASS SELECTION SECTION ── */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-indigo-500" />
            Select Class
          </h2>
          {loadingClasses ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div>
          ) : classes.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
              <GraduationCap className="h-12 w-12 mx-auto text-gray-200 mb-3" />
              <p className="font-medium text-gray-400">No classes assigned</p>
              <p className="text-xs text-gray-300 mt-1">Ask admin to set up your timetable</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {classes.map((cls) => (
                <ClassCard
                  key={cls.id}
                  cls={cls}
                  isSelected={selectedClass === cls.id}
                  onClick={() => setSelectedClass(cls.id)}
                  studentCount={cls.student_count}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── STUDENT LIST (only when class selected) ── */}
        {selectedClass && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-indigo-500" />
              Students · {selectedClassName}
              {selectedItemName && <span className="text-xs font-normal text-gray-400">(Section {selectedItemName})</span>}
            </h2>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Search + Filters */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                      placeholder="Search by name, register number, email or parent name..."
                      className="pl-9 bg-white border-gray-200 focus:border-indigo-400"
                      value={search} 
                      onChange={e => setSearch(e.target.value)} 
                    />
                  </div>
                  <div className="flex gap-2">
                    <Select value={filterGender} onValueChange={setFilterGender}>
                      <SelectTrigger className="w-32 border-gray-200">
                        <Filter className="h-4 w-4 mr-1 text-gray-500" />
                        <SelectValue placeholder="Gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Gender</SelectItem>
                        <SelectItem value="male">Male ({genderCounts.male})</SelectItem>
                        <SelectItem value="female">Female ({genderCounts.female})</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-32 border-gray-200">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    {hasFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gray-500">
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
                {hasFilters && (
                  <p className="text-xs text-gray-400 mt-2">
                    Showing {filtered.length} of {students.length} students
                  </p>
                )}
              </div>

              {/* Student Table */}
              <div>
                {loadingStudents ? (
                  <div className="p-4 space-y-3">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg bg-gray-100" />)}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-16 text-center">
                    <Search className="h-10 w-10 mx-auto text-gray-200 mb-3" />
                    <p className="text-gray-400">No students found</p>
                    <Button variant="link" onClick={clearFilters} className="text-indigo-600 text-sm">Clear filters</Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50/60 border-b border-gray-100">
                        <tr>
                          <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Student</th>
                          <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Reg No.</th>
                          <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 hidden md:table-cell">Email</th>
                          <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 hidden lg:table-cell">Phone</th>
                          <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Gender</th>
                          <th className="text-left p-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</th>
                          <th className="w-10 p-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filtered.map(student => {
                          const status = student.status || 'active';
                          const isActive = status === 'active';
                          return (
                            <tr
                              key={student.id}
                              className="hover:bg-indigo-50/20 transition-colors cursor-pointer"
                              onClick={() => { setSelectedStudent(student); setViewOpen(true); }}
                            >
                              <td className="p-3">
                                <div className="flex items-center gap-3">
                                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold text-white ${
                                    isActive ? 'bg-indigo-500' : 'bg-gray-400'
                                  }`}>
                                    {initials(student.full_name)}
                                  </div>
                                  <span className="font-medium text-gray-800 text-sm">{student.full_name}</span>
                                </div>
                              </td>
                              <td className="p-3 font-mono text-sm text-gray-400">{student.register_number || '—'}</td>
                              <td className="p-3 text-sm text-gray-500 max-w-[180px] truncate hidden md:table-cell">
                                {student.student_email || student.email || '—'}
                              </td>
                              <td className="p-3 text-sm text-gray-500 hidden lg:table-cell">{student.phone || student.parent_contact || '—'}</td>
                              <td className="p-3 text-sm capitalize text-gray-600">{student.gender || '—'}</td>
                              <td className="p-3">
                                <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  isActive
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-gray-100 text-gray-500 border-gray-200'
                                }`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                  {status}
                                </span>
                              </td>
                              <td className="p-3">
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-indigo-600">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* No class selected placeholder */}
        {!selectedClass && classes.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 py-20 text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
              <GraduationCap className="h-8 w-8 text-gray-300" />
            </div>
            <p className="font-medium text-gray-400">Select a class above</p>
            <p className="text-xs text-gray-300 mt-1">Choose a class to view its students</p>
          </div>
        )}

        {/* Student Detail Dialog */}
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="max-w-md bg-white rounded-xl border border-gray-100">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-gray-900">Student Details</DialogTitle>
            </DialogHeader>
            {selectedStudent && (
              <div className="space-y-5">
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="h-16 w-16 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 text-xl font-bold">
                    {initials(selectedStudent.full_name)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{selectedStudent.full_name}</h3>
                    <p className="text-sm text-gray-500">Reg: {selectedStudent.register_number || '—'}</p>
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border mt-1 ${
                      selectedStudent.status !== 'inactive'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-gray-100 text-gray-500 border-gray-200'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${selectedStudent.status !== 'inactive' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      {selectedStudent.status || 'active'}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { icon: Mail, label: 'Email', value: selectedStudent.student_email || selectedStudent.email },
                    { icon: Phone, label: 'Phone', value: selectedStudent.phone || selectedStudent.parent_contact },
                    { icon: Calendar, label: 'Date of Birth', value: selectedStudent.date_of_birth ? new Date(selectedStudent.date_of_birth).toLocaleDateString('en-IN') : null },
                    { icon: User, label: 'Gender', value: selectedStudent.gender ? selectedStudent.gender.charAt(0).toUpperCase() + selectedStudent.gender.slice(1) : null },
                    { icon: Users, label: 'Parent Name', value: selectedStudent.parent_name },
                    { icon: Phone, label: 'Parent Contact', value: selectedStudent.parent_contact },
                  ].map((item, idx) => (
                    item.value && (
                      <div key={idx} className="flex items-center gap-3 text-sm">
                        <item.icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{item.label}</p>
                          <p className="font-medium text-gray-700 break-all">{item.value}</p>
                        </div>
                      </div>
                    )
                  ))}
                  {selectedStudent.blood_group && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-lg">🩸</span>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Blood Group</p>
                        <p className="font-medium text-gray-700">{selectedStudent.blood_group}</p>
                      </div>
                    </div>
                  )}
                  {selectedStudent.address && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-lg">📍</span>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Address</p>
                        <p className="font-medium text-gray-700 break-all">{selectedStudent.address}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ── FOOTER (dashboard style) ── */}
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