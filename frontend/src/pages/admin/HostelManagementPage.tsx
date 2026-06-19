import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Plus, Edit, Trash2, Download, Search,
  Building2, BedDouble, Users, CalendarCheck, LogOut,
  AlertCircle, Wrench, ChevronRight, Sparkles, Shield,
  Clock, CheckCircle, X, Filter, SlidersHorizontal, Radio, CalendarDays
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

// ────────────────────────────────────────────────────────────────────────────
// Animated Count-Up Hook (same as dashboard)
// ────────────────────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 900) {
  const [count, setCount] = useState(0);
  const frameRef = useRef<number>();
  const startRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    startRef.current = undefined;
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration]);

  return count;
}

// ─── Metric Card (exact same style as AdminDashboard) ───────────────────────
function MetricCard({
  label, value, icon: Icon, iconBg, iconColor, subtitle, loading,
}: {
  label: string;
  value: number | string;
  icon: any;
  iconBg: string;
  iconColor: string;
  subtitle?: string;
  loading?: boolean;
}) {
  const numVal = typeof value === 'number' ? value : parseInt(value as string) || 0;
  const animated = useCountUp(loading ? 0 : numVal);
  const display = typeof value === 'string' && value.includes('%') ? `${animated}%` : animated;

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
      <p className="text-2xl font-bold text-gray-900 tabular-nums">{display}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Types & API Functions (unchanged)
// ────────────────────────────────────────────────────────────────────────────
type BlockGender = 'boys' | 'girls' | 'mixed';
type RoomType = 'single' | 'double' | 'triple' | 'dormitory';
type AllocationStatus = 'active' | 'vacated' | 'transferred';
type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'returned';
type ComplaintStatus = 'open' | 'in_progress' | 'resolved';
type AttendanceStatus = 'present' | 'absent' | 'on_leave';

interface HostelBlock {
  id: string;
  institution_id: string;
  name: string;
  gender: BlockGender;
  warden_name: string;
  warden_contact: string;
  total_rooms: number;
  created_at?: string;
}

interface HostelRoom {
  id: string;
  block_id: string;
  block_name?: string;
  room_number: string;
  floor: number;
  room_type: RoomType;
  capacity: number;
  occupied: number;
  created_at?: string;
}

interface HostelAllocation {
  id: string;
  institution_id?: string;
  student_id: string;
  student_name?: string;
  student_photo?: string;
  register_number?: string;
  room_id: string;
  room_number?: string;
  block_name?: string;
  allocated_date: string;
  vacated_date?: string;
  status: AllocationStatus;
}

interface LeaveRequest {
  id: string;
  institution_id?: string;
  student_id: string;
  student_name?: string;
  register_number?: string;
  leave_from: string;
  leave_to: string;
  reason: string;
  status: LeaveStatus;
  applied_at?: string;
  parent_notified?: boolean;
}

interface Complaint {
  id: string;
  institution_id?: string;
  student_id: string;
  student_name?: string;
  room_number?: string;
  complaint_type: string;
  description: string;
  status: ComplaintStatus;
  raised_at?: string;
  resolved_at?: string;
}

interface HostelAttendance {
  id: string;
  student_id: string;
  student_name?: string;
  room_number?: string;
  date: string;
  morning_status: AttendanceStatus;
  night_status: AttendanceStatus;
}

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api';

const getHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

async function fetchBlocks(institutionId: string): Promise<HostelBlock[]> {
  const res = await fetch(`${API_BASE}/hostel/blocks?institution_id=${institutionId}`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch blocks');
  return res.json();
}

async function createBlock(block: Omit<HostelBlock, 'id' | 'created_at'>): Promise<HostelBlock> {
  const res = await fetch(`${API_BASE}/hostel/blocks`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(block) });
  if (!res.ok) throw new Error('Failed to create block');
  return res.json();
}

async function updateBlock(id: string, block: Partial<HostelBlock>): Promise<HostelBlock> {
  const res = await fetch(`${API_BASE}/hostel/blocks/${id}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(block) });
  if (!res.ok) throw new Error('Failed to update block');
  return res.json();
}

async function deleteBlock(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/hostel/blocks/${id}`, { method: 'DELETE', headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to delete block');
}

async function fetchRooms(institutionId: string): Promise<HostelRoom[]> {
  const res = await fetch(`${API_BASE}/hostel/rooms?institution_id=${institutionId}`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch rooms');
  return res.json();
}

async function createRoom(room: Omit<HostelRoom, 'id' | 'occupied' | 'created_at'>): Promise<HostelRoom> {
  const res = await fetch(`${API_BASE}/hostel/rooms`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(room) });
  if (!res.ok) throw new Error('Failed to create room');
  return res.json();
}

async function updateRoom(id: string, room: Partial<HostelRoom>): Promise<HostelRoom> {
  const res = await fetch(`${API_BASE}/hostel/rooms/${id}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(room) });
  if (!res.ok) throw new Error('Failed to update room');
  return res.json();
}

async function deleteRoom(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/hostel/rooms/${id}`, { method: 'DELETE', headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to delete room');
}

async function fetchAllocations(institutionId: string): Promise<HostelAllocation[]> {
  const res = await fetch(`${API_BASE}/hostel/allocations?institution_id=${institutionId}`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch allocations');
  return res.json();
}

async function createAllocation(allocation: Omit<HostelAllocation, 'id'>): Promise<HostelAllocation> {
  const res = await fetch(`${API_BASE}/hostel/allocations`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(allocation) });
  if (!res.ok) throw new Error('Failed to create allocation');
  return res.json();
}

async function updateAllocation(id: string, allocation: Partial<HostelAllocation>): Promise<HostelAllocation> {
  const res = await fetch(`${API_BASE}/hostel/allocations/${id}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(allocation) });
  if (!res.ok) throw new Error('Failed to update allocation');
  return res.json();
}

async function fetchLeaves(institutionId: string): Promise<LeaveRequest[]> {
  const res = await fetch(`${API_BASE}/hostel/leaves?institution_id=${institutionId}`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch leaves');
  return res.json();
}

async function createLeave(leave: Omit<LeaveRequest, 'id'>): Promise<LeaveRequest> {
  const res = await fetch(`${API_BASE}/hostel/leaves`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(leave) });
  if (!res.ok) throw new Error('Failed to create leave request');
  return res.json();
}

async function updateLeave(id: string, leave: Partial<LeaveRequest>): Promise<LeaveRequest> {
  const res = await fetch(`${API_BASE}/hostel/leaves/${id}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(leave) });
  if (!res.ok) throw new Error('Failed to update leave');
  return res.json();
}

async function fetchComplaints(institutionId: string): Promise<Complaint[]> {
  const res = await fetch(`${API_BASE}/hostel/complaints?institution_id=${institutionId}`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch complaints');
  return res.json();
}

async function createComplaint(complaint: Omit<Complaint, 'id'>): Promise<Complaint> {
  const res = await fetch(`${API_BASE}/hostel/complaints`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(complaint) });
  if (!res.ok) throw new Error('Failed to create complaint');
  return res.json();
}

async function updateComplaint(id: string, complaint: Partial<Complaint>): Promise<Complaint> {
  const res = await fetch(`${API_BASE}/hostel/complaints/${id}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(complaint) });
  if (!res.ok) throw new Error('Failed to update complaint');
  return res.json();
}

async function fetchAttendance(institutionId: string, date?: string): Promise<HostelAttendance[]> {
  let url = `${API_BASE}/hostel/attendance?institution_id=${institutionId}`;
  if (date) url += `&date=${date}`;
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch attendance');
  return res.json();
}

async function updateAttendance(id: string, attendance: Partial<HostelAttendance>): Promise<HostelAttendance> {
  const res = await fetch(`${API_BASE}/hostel/attendance/${id}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(attendance) });
  if (!res.ok) throw new Error('Failed to update attendance');
  return res.json();
}

async function fetchHostelStudents(institutionId: string): Promise<{ id: string; full_name: string; register_number: string; room_number?: string; block_name?: string }[]> {
  const res = await fetch(`${API_BASE}/hostel/students`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch hostel students');
  return res.json();
}

// ────────────────────────────────────────────────────────────────────────────
// Blocks Tab (dashboard style)
// ────────────────────────────────────────────────────────────────────────────
function BlocksTab({ institutionId }: { institutionId: string }) {
  const [blocks, setBlocks] = useState<HostelBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HostelBlock | null>(null);
  const form = useForm<Omit<HostelBlock, 'id' | 'institution_id'>>({
    defaultValues: { name: '', gender: 'boys', warden_name: '', warden_contact: '', total_rooms: 0 },
  });

  const loadBlocks = async () => {
    try {
      setLoading(true);
      const data = await fetchBlocks(institutionId);
      setBlocks(data);
    } catch (error) {
      toast.error('Failed to load blocks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBlocks();
  }, [institutionId]);

  const onSubmit = async (data: any) => {
    try {
      if (editing) {
        await updateBlock(editing.id, { ...data, institution_id: institutionId });
        toast.success('Block updated');
      } else {
        await createBlock({ ...data, institution_id: institutionId });
        toast.success('Block created');
      }
      setDialogOpen(false);
      form.reset();
      setEditing(null);
      loadBlocks();
    } catch (error) {
      toast.error('Operation failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this block? All associated rooms will be affected.')) return;
    try {
      await deleteBlock(id);
      toast.success('Block deleted');
      loadBlocks();
    } catch (error) {
      toast.error('Failed to delete block');
    }
  };

  if (loading) return <Skeleton className="h-64 w-full rounded-xl bg-gray-100" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-500">{blocks.length} hostel blocks configured</p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Block
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg bg-white rounded-2xl border border-gray-100">
            <DialogHeader className="pb-2 border-b border-gray-100">
              <DialogTitle className="text-base font-bold text-gray-900">{editing ? 'Edit Block' : 'Add Hostel Block'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                <FormField control={form.control} name="name" rules={{ required: 'Block name is required' }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Block Name *</FormLabel>
                      <FormControl><Input {...field} placeholder="e.g. Block A - Brahmaputra" className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400" /></FormControl>
                      <FormMessage className="text-xs text-rose-500" />
                    </FormItem>
                  )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-500">For Gender</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="boys">Boys</SelectItem>
                            <SelectItem value="girls">Girls</SelectItem>
                            <SelectItem value="mixed">Mixed</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  <FormField control={form.control} name="total_rooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Total Rooms</FormLabel>
                        <FormControl><Input {...field} type="number" onChange={e => field.onChange(Number(e.target.value))} className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400" /></FormControl>
                      </FormItem>
                    )} />
                  <FormField control={form.control} name="warden_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Warden Name</FormLabel>
                        <FormControl><Input {...field} placeholder="Warden full name" className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400" /></FormControl>
                      </FormItem>
                    )} />
                  <FormField control={form.control} name="warden_contact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Warden Contact</FormLabel>
                        <FormControl><Input {...field} placeholder="Phone number" className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400" /></FormControl>
                      </FormItem>
                    )} />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)} className="h-9 text-xs rounded-lg border border-gray-200">Cancel</Button>
                  <Button type="submit" size="sm" className="h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">{editing ? 'Update' : 'Create'} Block</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {blocks.map((block) => (
          <div key={block.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300">
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-50">
                    <Building2 className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{block.name}</h3>
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border mt-1 ${
                      block.gender === 'boys' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      block.gender === 'girls' ? 'bg-pink-50 text-pink-700 border-pink-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                    }`}>
                      {block.gender === 'boys' ? '♂ Boys' : block.gender === 'girls' ? '♀ Girls' : '⚥ Mixed'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditing(block); form.reset({ name: block.name, gender: block.gender, warden_name: block.warden_name, warden_contact: block.warden_contact, total_rooms: block.total_rooms }); setDialogOpen(true); }} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"><Edit className="h-4 w-4" /></button>
                  <button onClick={() => handleDelete(block.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Total Rooms</p>
                  <p className="font-bold text-xl text-gray-800">{block.total_rooms}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Warden</p>
                  <p className="font-semibold text-sm text-gray-700 truncate">{block.warden_name || '—'}</p>
                </div>
              </div>
              {block.warden_contact && (
                <p className="text-[11px] text-gray-500 mt-3 flex items-center gap-1">📞 {block.warden_contact}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Rooms Tab (dashboard style)
// ────────────────────────────────────────────────────────────────────────────
function RoomsTab({ institutionId, blocks }: { institutionId: string; blocks: HostelBlock[] }) {
  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HostelRoom | null>(null);
  const [filterBlock, setFilterBlock] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const form = useForm<Omit<HostelRoom, 'id' | 'occupied'>>({
    defaultValues: { block_id: '', room_number: '', floor: 1, room_type: 'double', capacity: 2 },
  });

  const loadRooms = async () => {
    try {
      setLoading(true);
      const data = await fetchRooms(institutionId);
      const enriched = data.map(room => ({
        ...room,
        block_name: blocks.find(b => b.id === room.block_id)?.name,
      }));
      setRooms(enriched);
    } catch (error) {
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, [institutionId, blocks]);

  const filtered = rooms.filter(r => {
    const matchBlock = filterBlock === 'all' || r.block_id === filterBlock;
    const matchType = filterType === 'all' || r.room_type === filterType;
    const matchSearch = !searchTerm || r.room_number.toLowerCase().includes(searchTerm.toLowerCase());
    return matchBlock && matchType && matchSearch;
  });

  const onSubmit = async (data: any) => {
    try {
      if (editing) {
        await updateRoom(editing.id, { ...data, institution_id: institutionId });
        toast.success('Room updated');
      } else {
        await createRoom({ ...data, institution_id: institutionId });
        toast.success('Room created');
      }
      setDialogOpen(false);
      form.reset();
      setEditing(null);
      loadRooms();
    } catch (error) {
      toast.error('Operation failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this room?')) return;
    try {
      await deleteRoom(id);
      toast.success('Room deleted');
      loadRooms();
    } catch (error) {
      toast.error('Failed to delete room');
    }
  };

  const occupancyColor = (room: HostelRoom) => {
    const pct = room.capacity > 0 ? room.occupied / room.capacity : 0;
    if (pct === 0) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (pct < 1) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-rose-100 text-rose-700 border-rose-200';
  };

  if (loading) return <Skeleton className="h-64 w-full rounded-xl bg-gray-100" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input placeholder="Search room..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 w-44 h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400" />
          </div>
          <Select value={filterBlock} onValueChange={setFilterBlock}>
            <SelectTrigger className="w-44 h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400"><SelectValue placeholder="All Blocks" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Blocks</SelectItem>
              {blocks.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-36 h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400"><SelectValue placeholder="Room Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="single">Single</SelectItem>
              <SelectItem value="double">Double</SelectItem>
              <SelectItem value="triple">Triple</SelectItem>
              <SelectItem value="dormitory">Dormitory</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-10 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm" onClick={() => { setEditing(null); form.reset(); }}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Room
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg bg-white rounded-2xl border border-gray-100">
            <DialogHeader className="pb-2 border-b border-gray-100">
              <DialogTitle className="text-base font-bold text-gray-900">{editing ? 'Edit Room' : 'Add Room'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="block_id" rules={{ required: true }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Block *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400"><SelectValue placeholder="Select block" /></SelectTrigger></FormControl>
                          <SelectContent>{blocks.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  <FormField control={form.control} name="room_number" rules={{ required: true }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Room Number *</FormLabel>
                        <FormControl><Input {...field} placeholder="e.g. A-101" className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400" /></FormControl>
                      </FormItem>
                    )} />
                  <FormField control={form.control} name="floor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Floor</FormLabel>
                        <FormControl><Input {...field} type="number" onChange={e => field.onChange(Number(e.target.value))} className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400" /></FormControl>
                      </FormItem>
                    )} />
                  <FormField control={form.control} name="room_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Room Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="single">Single</SelectItem>
                            <SelectItem value="double">Double</SelectItem>
                            <SelectItem value="triple">Triple</SelectItem>
                            <SelectItem value="dormitory">Dormitory</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  <FormField control={form.control} name="capacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Capacity</FormLabel>
                        <FormControl><Input {...field} type="number" onChange={e => field.onChange(Number(e.target.value))} className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400" /></FormControl>
                      </FormItem>
                    )} />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)} className="h-9 text-xs rounded-lg border border-gray-200">Cancel</Button>
                  <Button type="submit" size="sm" className="h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">{editing ? 'Update' : 'Create'} Room</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Room List</h3>
              <p className="text-xs text-gray-400 mt-0.5">Showing {filtered.length} of {rooms.length} rooms</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-100 hover:bg-transparent bg-gray-50/60">
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pl-5">Room No.</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Block</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Floor</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Type</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Capacity</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Occupancy</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 pr-5">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(room => (
                <TableRow key={room.id} className="border-gray-100 hover:bg-indigo-50/20 transition-colors">
                  <TableCell className="font-bold text-gray-900 pl-5">{room.room_number}</TableCell>
                  <TableCell className="text-gray-600">{room.block_name}</TableCell>
                  <TableCell className="text-gray-600">Floor {room.floor}</TableCell>
                  <TableCell className="capitalize text-gray-600">{room.room_type}</TableCell>
                  <TableCell className="text-gray-600">{room.capacity}</TableCell>
                  <TableCell><div className="flex items-center gap-2"><div className="w-20 bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${room.capacity > 0 ? (room.occupied / room.capacity) * 100 : 0}%` }} /></div><span className="text-xs text-gray-500">{room.occupied}/{room.capacity}</span></div></TableCell>
                  <TableCell><span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${occupancyColor(room)}`}>{room.occupied === 0 ? 'Vacant' : room.occupied < room.capacity ? 'Partial' : 'Full'}</span></TableCell>
                  <TableCell className="text-right pr-5"><div className="flex gap-1 justify-end"><button onClick={() => { setEditing(room); form.reset({ block_id: room.block_id, room_number: room.room_number, floor: room.floor, room_type: room.room_type, capacity: room.capacity }); setDialogOpen(true); }} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"><Edit className="h-3.5 w-3.5" /></button><button onClick={() => handleDelete(room.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button></div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Allocation Tab (dashboard style)
// ────────────────────────────────────────────────────────────────────────────
function AllocationTab({ institutionId, rooms }: { institutionId: string; rooms: HostelRoom[] }) {
  const [allocations, setAllocations] = useState<HostelAllocation[]>([]);
  const [students, setStudents] = useState<{ id: string; full_name: string; register_number: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');

  const form = useForm({
    defaultValues: { student_id: '', room_id: '', allocated_date: new Date().toISOString().split('T')[0] },
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [allocs, hostelStudentsData] = await Promise.all([
        fetchAllocations(institutionId),
        fetchHostelStudents(institutionId),
      ]);
      setAllocations(allocs);
      setStudents(hostelStudentsData);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [institutionId]);

  const filtered = allocations.filter(a =>
    !search || a.student_name?.toLowerCase().includes(search.toLowerCase()) || a.register_number?.toLowerCase().includes(search.toLowerCase())
  );

  const onSubmit = async (data: any) => {
    try {
      const student = students.find(s => s.id === data.student_id);
      const room = rooms.find(r => r.id === data.room_id);
      const newAlloc: Omit<HostelAllocation, 'id'> = {
        student_id: data.student_id,
        student_name: student?.full_name,
        register_number: student?.register_number,
        room_id: data.room_id,
        room_number: room?.room_number,
        block_name: room?.block_name,
        allocated_date: data.allocated_date,
        status: 'active',
        institution_id: institutionId,
      };
      await createAllocation(newAlloc);
      toast.success('Student allocated to room');
      setDialogOpen(false);
      form.reset();
      loadData();
    } catch (error) {
      toast.error('Allocation failed');
    }
  };

  const handleVacate = async (id: string) => {
    if (!confirm('Mark this student as vacated?')) return;
    try {
      await updateAllocation(id, { status: 'vacated', vacated_date: new Date().toISOString().split('T')[0] });
      toast.success('Student marked as vacated');
      loadData();
    } catch (error) {
      toast.error('Failed to vacate');
    }
  };

  const statusBadge = (status: AllocationStatus) => {
    const map: Record<AllocationStatus, { bg: string; text: string }> = { 
      active: { bg: 'bg-emerald-100', text: 'text-emerald-700' }, 
      vacated: { bg: 'bg-gray-100', text: 'text-gray-700' }, 
      transferred: { bg: 'bg-blue-100', text: 'text-blue-700' } 
    };
    return <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${map[status].bg} ${map[status].text} border-${status === 'active' ? 'emerald-200' : status === 'vacated' ? 'gray-200' : 'blue-200'}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
  };

  if (loading) return <Skeleton className="h-64 w-full rounded-xl bg-gray-100" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input placeholder="Search student..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-64 h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400" />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-10 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm"><Plus className="h-3.5 w-3.5 mr-1.5" /> Allocate Room</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg bg-white rounded-2xl border border-gray-100">
            <DialogHeader className="pb-2 border-b border-gray-100">
              <DialogTitle className="text-base font-bold text-gray-900">Allocate Room to Student</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                <FormField control={form.control} name="student_id" rules={{ required: true }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Student *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400"><SelectValue placeholder="Select student" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name} ({s.register_number})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                <FormField control={form.control} name="room_id" rules={{ required: true }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Assign Room *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400"><SelectValue placeholder="Select room" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {rooms.filter(r => r.occupied < r.capacity).map(r => (
                            <SelectItem key={r.id} value={r.id}>{r.room_number} — {r.block_name} ({r.occupied}/{r.capacity} occupied)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                <FormField control={form.control} name="allocated_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Allocation Date</FormLabel>
                      <FormControl><Input {...field} type="date" className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400" /></FormControl>
                    </FormItem>
                  )} />
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)} className="h-9 text-xs rounded-lg border border-gray-200">Cancel</Button>
                  <Button type="submit" size="sm" className="h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">Allocate Room</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Room Allocations</h3>
              <p className="text-xs text-gray-400 mt-0.5">{allocations.filter(a => a.status === 'active').length} active allocations</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-100 hover:bg-transparent bg-gray-50/60">
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pl-5">Student</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Reg No.</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Room</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Block</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">From Date</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Vacated</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 pr-5">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(a => (
                <TableRow key={a.id} className="border-gray-100 hover:bg-indigo-50/20 transition-colors">
                  <TableCell className="pl-5"><div className="flex items-center gap-2"><div className="h-8 w-8 rounded-lg bg-indigo-100 flex items-center justify-center"><span className="text-xs font-bold text-indigo-600">{a.student_name?.charAt(0)}</span></div><span className="font-bold text-gray-900">{a.student_name}</span></div></TableCell>
                  <TableCell className="text-gray-600 text-sm font-mono">{a.register_number || '—'}</TableCell>
                  <TableCell className="font-semibold text-gray-700">{a.room_number}</TableCell>
                  <TableCell className="text-gray-600">{a.block_name}</TableCell>
                  <TableCell className="text-gray-600">{a.allocated_date}</TableCell>
                  <TableCell className="text-gray-500">{a.vacated_date || '—'}</TableCell>
                  <TableCell>{statusBadge(a.status)}</TableCell>
                  <TableCell className="text-right pr-5">{a.status === 'active' && <Button variant="ghost" size="sm" onClick={() => handleVacate(a.id)} className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg"><LogOut className="h-3 w-3 mr-1" /> Vacate</Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Leave Tab (dashboard style)
// ────────────────────────────────────────────────────────────────────────────
function LeaveTab({ institutionId }: { institutionId: string }) {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [students, setStudents] = useState<{ id: string; full_name: string; register_number: string }[]>([]);

  const form = useForm({
    defaultValues: { student_id: '', leave_from: '', leave_to: '', reason: '' },
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [leavesData, studentsData] = await Promise.all([
        fetchLeaves(institutionId),
        fetchHostelStudents(institutionId),
      ]);
      setLeaves(leavesData);
      setStudents(studentsData);
    } catch (error) {
      toast.error('Failed to load leaves');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [institutionId]);

  const filtered = leaves.filter(l => filterStatus === 'all' || l.status === filterStatus);

  const onSubmit = async (data: any) => {
    try {
      const student = students.find(s => s.id === data.student_id);
      const newLeave: Omit<LeaveRequest, 'id'> = {
        student_id: data.student_id,
        student_name: student?.full_name,
        register_number: student?.register_number,
        leave_from: data.leave_from,
        leave_to: data.leave_to,
        reason: data.reason,
        status: 'pending',
        applied_at: new Date().toISOString().split('T')[0],
        parent_notified: false,
        institution_id: institutionId,
      };
      await createLeave(newLeave);
      toast.success('Leave request submitted');
      setDialogOpen(false);
      form.reset();
      loadData();
    } catch (error) {
      toast.error('Failed to submit leave');
    }
  };

  const updateStatus = async (id: string, status: LeaveStatus) => {
    try {
      await updateLeave(id, { status });
      toast.success(`Leave ${status}`);
      loadData();
    } catch (error) {
      toast.error('Update failed');
    }
  };

  const statusBadge = (status: LeaveStatus) => {
    const map: Record<LeaveStatus, string> = { pending: 'bg-amber-100 text-amber-700 border-amber-200', approved: 'bg-emerald-100 text-emerald-700 border-emerald-200', rejected: 'bg-rose-100 text-rose-700 border-rose-200', returned: 'bg-blue-100 text-blue-700 border-blue-200' };
    return <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${map[status]}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
  };

  if (loading) return <Skeleton className="h-64 w-full rounded-xl bg-gray-100" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Requests</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-10 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm"><Plus className="h-3.5 w-3.5 mr-1.5" /> New Leave Request</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg bg-white rounded-2xl border border-gray-100">
            <DialogHeader className="pb-2 border-b border-gray-100">
              <DialogTitle className="text-base font-bold text-gray-900">New Leave / Outpass Request</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                <FormField control={form.control} name="student_id" rules={{ required: true }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Student *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400"><SelectValue placeholder="Select student" /></SelectTrigger></FormControl>
                        <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name} ({s.register_number})</SelectItem>)}</SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="leave_from" rules={{ required: true }}
                    render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-500">From Date *</FormLabel><FormControl><Input {...field} type="date" className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400" /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="leave_to" rules={{ required: true }}
                    render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-500">To Date *</FormLabel><FormControl><Input {...field} type="date" className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400" /></FormControl></FormItem>)} />
                </div>
                <FormField control={form.control} name="reason" rules={{ required: true }}
                  render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Reason *</FormLabel><FormControl><Textarea {...field} rows={3} placeholder="Reason for leave..." className="text-sm border border-gray-200 rounded-lg focus:border-indigo-400" /></FormControl></FormItem>)} />
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)} className="h-9 text-xs rounded-lg border border-gray-200">Cancel</Button>
                  <Button type="submit" size="sm" className="h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">Submit Request</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Leave / Outpass Requests</h3>
              <p className="text-xs text-gray-400 mt-0.5">{leaves.filter(l => l.status === 'pending').length} pending approvals</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-100 hover:bg-transparent bg-gray-50/60">
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pl-5">Student</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Reg No.</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">From</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">To</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Reason</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Parent Notified</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 pr-5">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(l => (
                <TableRow key={l.id} className="border-gray-100 hover:bg-indigo-50/20 transition-colors">
                  <TableCell className="font-bold text-gray-900 pl-5">{l.student_name}</TableCell>
                  <TableCell className="text-gray-600 text-sm font-mono">{l.register_number || '—'}</TableCell>
                  <TableCell className="text-gray-600">{l.leave_from}</TableCell>
                  <TableCell className="text-gray-600">{l.leave_to}</TableCell>
                  <TableCell className="max-w-[150px] truncate text-gray-500 text-sm">{l.reason}</TableCell>
                  <TableCell><span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${l.parent_notified ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{l.parent_notified ? '✓ Yes' : 'No'}</span></TableCell>
                  <TableCell>{statusBadge(l.status)}</TableCell>
                  <TableCell className="text-right pr-5">
                    {l.status === 'pending' && (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => updateStatus(l.id, 'approved')} className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200">Approve</button>
                        <button onClick={() => updateStatus(l.id, 'rejected')} className="px-2 py-1 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-700 hover:bg-rose-200">Reject</button>
                      </div>
                    )}
                    {l.status === 'approved' && <button onClick={() => updateStatus(l.id, 'returned')} className="px-2 py-1 rounded-lg text-[10px] font-bold bg-blue-100 text-blue-700 hover:bg-blue-200">Mark Returned</button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Attendance Tab (dashboard style)
// ────────────────────────────────────────────────────────────────────────────
function AttendanceTab({ institutionId }: { institutionId: string }) {
  const [attendance, setAttendance] = useState<HostelAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const loadAttendance = async () => {
    try {
      setLoading(true);
      const data = await fetchAttendance(institutionId, selectedDate);
      setAttendance(data);
    } catch (error) {
      toast.error('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, [institutionId, selectedDate]);

  const updateAttendanceField = async (id: string, field: 'morning_status' | 'night_status', value: AttendanceStatus) => {
    try {
      await updateAttendance(id, { [field]: value });
      setAttendance(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
      toast.success('Attendance updated');
    } catch (error) {
      toast.error('Update failed');
    }
  };

  const statusSelect = (id: string, field: 'morning_status' | 'night_status', value: AttendanceStatus) => (
    <Select value={value} onValueChange={(v) => updateAttendanceField(id, field, v as AttendanceStatus)}>
      <SelectTrigger className="w-28 h-8 text-xs border border-gray-200 rounded-lg focus:border-indigo-400"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="present">Present</SelectItem>
        <SelectItem value="absent">Absent</SelectItem>
        <SelectItem value="on_leave">On Leave</SelectItem>
      </SelectContent>
    </Select>
  );

  const morningPresent = attendance.filter(a => a.morning_status === 'present').length;
  const morningAbsent = attendance.filter(a => a.morning_status === 'absent').length;
  const onLeave = attendance.filter(a => a.morning_status === 'on_leave').length;

  if (loading) return <Skeleton className="h-64 w-full rounded-xl bg-gray-100" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Date</label>
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-44 h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400" />
        </div>
        <Button onClick={loadAttendance} size="sm" className="h-10 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm"><CalendarCheck className="h-3.5 w-3.5 mr-1.5" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm"><p className="text-3xl font-bold text-emerald-600">{morningPresent}</p><p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1">Morning Present</p></div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm"><p className="text-3xl font-bold text-rose-600">{morningAbsent}</p><p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1">Morning Absent</p></div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm"><p className="text-3xl font-bold text-amber-600">{onLeave}</p><p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1">On Leave</p></div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-sm font-semibold text-gray-800">Hostel Roll Call — {selectedDate}</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-100 hover:bg-transparent bg-gray-50/60">
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pl-5">Student</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Room</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Morning Roll Call</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pr-5">Night Roll Call</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendance.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-gray-500 py-8">No attendance records for this date.</TableCell></TableRow>
              ) : (
                attendance.map(a => (
                  <TableRow key={a.id} className="border-gray-100 hover:bg-indigo-50/20 transition-colors">
                    <TableCell className="font-bold text-gray-900 pl-5">{a.student_name}</TableCell>
                    <TableCell className="text-gray-600">{a.room_number}</TableCell>
                    <TableCell>{statusSelect(a.id, 'morning_status', a.morning_status)}</TableCell>
                    <TableCell className="pr-5">{statusSelect(a.id, 'night_status', a.night_status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Complaints Tab (dashboard style)
// ────────────────────────────────────────────────────────────────────────────
function ComplaintsTab({ institutionId }: { institutionId: string }) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [students, setStudents] = useState<{ id: string; full_name: string; room_number?: string }[]>([]);

  const form = useForm({
    defaultValues: { student_id: '', complaint_type: '', description: '' },
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [complaintsData, studentsData] = await Promise.all([
        fetchComplaints(institutionId),
        fetchHostelStudents(institutionId),
      ]);
      setComplaints(complaintsData);
      setStudents(studentsData);
    } catch (error) {
      toast.error('Failed to load complaints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [institutionId]);

  const filtered = complaints.filter(c => filterStatus === 'all' || c.status === filterStatus);

  const onSubmit = async (data: any) => {
    try {
      const student = students.find(s => s.id === data.student_id);
      const newComplaint: Omit<Complaint, 'id'> = {
        student_id: data.student_id,
        student_name: student?.full_name,
        room_number: student?.room_number,
        complaint_type: data.complaint_type,
        description: data.description,
        status: 'open',
        raised_at: new Date().toISOString().split('T')[0],
        institution_id: institutionId,
      };
      await createComplaint(newComplaint);
      toast.success('Complaint raised');
      setDialogOpen(false);
      form.reset();
      loadData();
    } catch (error) {
      toast.error('Failed to raise complaint');
    }
  };

  const updateStatus = async (id: string, status: ComplaintStatus) => {
    try {
      await updateComplaint(id, { status, resolved_at: status === 'resolved' ? new Date().toISOString().split('T')[0] : undefined });
      toast.success(`Complaint marked as ${status.replace('_', ' ')}`);
      loadData();
    } catch (error) {
      toast.error('Update failed');
    }
  };

  const statusBadge = (status: ComplaintStatus) => {
    const map: Record<ComplaintStatus, string> = { open: 'bg-rose-100 text-rose-700 border-rose-200', in_progress: 'bg-amber-100 text-amber-700 border-amber-200', resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    return <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${map[status]}`}>{status.replace('_', ' ')}</span>;
  };

  if (loading) return <Skeleton className="h-64 w-full rounded-xl bg-gray-100" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400"><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Complaints</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-10 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm"><Plus className="h-3.5 w-3.5 mr-1.5" /> Raise Complaint</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg bg-white rounded-2xl border border-gray-100">
            <DialogHeader className="pb-2 border-b border-gray-100">
              <DialogTitle className="text-base font-bold text-gray-900">Raise New Complaint</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                <FormField control={form.control} name="student_id" rules={{ required: true }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Student *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400"><SelectValue placeholder="Select student" /></SelectTrigger></FormControl>
                        <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                <FormField control={form.control} name="complaint_type" rules={{ required: true }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Complaint Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger className="h-10 text-sm border border-gray-200 rounded-lg focus:border-indigo-400"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="Maintenance">Maintenance</SelectItem>
                          <SelectItem value="Cleanliness">Cleanliness</SelectItem>
                          <SelectItem value="Electrical">Electrical</SelectItem>
                          <SelectItem value="Plumbing">Plumbing</SelectItem>
                          <SelectItem value="Security">Security</SelectItem>
                          <SelectItem value="Food/Mess">Food/Mess</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                <FormField control={form.control} name="description" rules={{ required: true }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Description *</FormLabel>
                      <FormControl><Textarea {...field} rows={3} placeholder="Describe the issue..." className="text-sm border border-gray-200 rounded-lg focus:border-indigo-400" /></FormControl>
                    </FormItem>
                  )} />
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)} className="h-9 text-xs rounded-lg border border-gray-200">Cancel</Button>
                  <Button type="submit" size="sm" className="h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">Submit Complaint</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Complaints & Maintenance</h3>
              <p className="text-xs text-gray-400 mt-0.5">{complaints.filter(c => c.status === 'open').length} open · {complaints.filter(c => c.status === 'in_progress').length} in progress</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-100 hover:bg-transparent bg-gray-50/60">
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400 pl-5">Student</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Room</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Type</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Description</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Raised On</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 pr-5">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id} className="border-gray-100 hover:bg-indigo-50/20 transition-colors">
                  <TableCell className="font-bold text-gray-900 pl-5">{c.student_name}</TableCell>
                  <TableCell className="text-gray-600">{c.room_number || '—'}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] font-bold bg-gray-100">{c.complaint_type}</Badge></TableCell>
                  <TableCell className="max-w-[180px] truncate text-gray-500 text-sm">{c.description}</TableCell>
                  <TableCell className="text-gray-600">{c.raised_at}</TableCell>
                  <TableCell>{statusBadge(c.status)}</TableCell>
                  <TableCell className="text-right pr-5">
                    <div className="flex gap-1 justify-end">
                      {c.status === 'open' && <button onClick={() => updateStatus(c.id, 'in_progress')} className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-700 hover:bg-amber-200">Start</button>}
                      {c.status === 'in_progress' && <button onClick={() => updateStatus(c.id, 'resolved')} className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200">Resolve</button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main Page Component (dashboard style)
// ────────────────────────────────────────────────────────────────────────────
export default function HostelManagementPage() {
  const { profile } = useAuth();
  const [blocks, setBlocks] = useState<HostelBlock[]>([]);
  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  const institutionId = profile?.institution_id || '';

  const loadOverviewData = async () => {
    if (!institutionId) return;
    try {
      setLoading(true);
      const [blocksData, roomsData] = await Promise.all([
        fetchBlocks(institutionId),
        fetchRooms(institutionId),
      ]);
      setBlocks(blocksData);
      setRooms(roomsData);
    } catch (error) {
      toast.error('Failed to load overview data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverviewData();
  }, [institutionId]);

  const totalBeds = rooms.reduce((s, r) => s + r.capacity, 0);
  const occupiedBeds = rooms.reduce((s, r) => s + r.occupied, 0);
  const vacantBeds = totalBeds - occupiedBeds;

  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [openComplaints, setOpenComplaints] = useState(0);

  useEffect(() => {
    if (!institutionId) return;
    const fetchStats = async () => {
      const leaves = await fetchLeaves(institutionId);
      const complaints = await fetchComplaints(institutionId);
      setPendingLeaves(leaves.filter(l => l.status === 'pending').length);
      setOpenComplaints(complaints.filter(c => c.status !== 'resolved').length);
    };
    fetchStats();
  }, [institutionId]);

  if (loading) return <AdminLayout><div className="space-y-6 p-4"><Skeleton className="h-64 w-full rounded-xl bg-gray-100" /></div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* ── PAGE HEADER (dashboard style) ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Hostel Management
            </h1>
            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Manage blocks, rooms, allocations, attendance and more
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={async () => {
                const allocs = await fetchAllocations(institutionId);
                const data = allocs.map(a => ({ 'Student Name': a.student_name, 'Reg No.': a.register_number, 'Room': a.room_number, 'Block': a.block_name, 'From': a.allocated_date, 'Status': a.status }));
                const ws = XLSX.utils.json_to_sheet(data);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Hostel Allocations');
                XLSX.writeFile(wb, `hostel_${new Date().toISOString().split('T')[0]}.xlsx`);
                toast.success('Hostel data exported');
              }}
              variant="outline"
              size="sm"
              className="h-9 px-3 flex items-center gap-1.5 rounded-lg border-gray-200 bg-white text-gray-500 hover:border-indigo-300 hover:text-indigo-600"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs font-medium">Export</span>
            </Button>
          </div>
        </div>

        {/* ── METRIC CARDS (dashboard style) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <MetricCard label="Total Blocks" value={blocks.length} icon={Building2} iconBg="bg-indigo-50" iconColor="text-indigo-600" loading={loading} />
          <MetricCard label="Total Beds" value={totalBeds} icon={BedDouble} iconBg="bg-indigo-50" iconColor="text-indigo-600" subtitle={`${vacantBeds} vacant`} loading={loading} />
          <MetricCard label="Occupied Beds" value={occupiedBeds} icon={Users} iconBg="bg-emerald-50" iconColor="text-emerald-600" subtitle={`${totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0}% occupancy`} loading={loading} />
          <MetricCard label="Pending Leaves" value={pendingLeaves} icon={LogOut} iconBg="bg-amber-50" iconColor="text-amber-600" loading={loading} />
          <MetricCard label="Open Complaints" value={openComplaints} icon={AlertCircle} iconBg="bg-rose-50" iconColor="text-rose-600" loading={loading} />
        </div>

        {/* ── TABS (dashboard style pill toggle) ── */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1 w-fit">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'blocks', label: 'Blocks' },
            { id: 'rooms', label: 'Rooms' },
            { id: 'allocation', label: 'Allocation' },
            { id: 'leave', label: 'Leave' },
            { id: 'attendance', label: 'Attendance' },
            { id: 'complaints', label: 'Complaints' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">Block Summary</h3>
                <Button variant="ghost" size="sm" className="text-xs text-indigo-600" onClick={() => setActiveTab('blocks')}>View All <ChevronRight className="h-3 w-3 ml-1" /></Button>
              </div>
              <div className="p-5 space-y-3">
                {blocks.map(block => {
                  const blockRooms = rooms.filter(r => r.block_id === block.id);
                  const blockCap = blockRooms.reduce((s, r) => s + r.capacity, 0);
                  const blockOcc = blockRooms.reduce((s, r) => s + r.occupied, 0);
                  const pct = blockCap > 0 ? Math.round((blockOcc / blockCap) * 100) : 0;
                  return (
                    <div key={block.id} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1"><span className="font-semibold text-gray-700">{block.name}</span><span className="text-gray-500 text-xs">{blockOcc}/{blockCap}</span></div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${pct}%` }} /></div>
                      </div>
                      <span className="text-sm font-bold text-gray-700 w-10 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-800">Quick Actions</h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Users, label: 'Allocate Room', tab: 'allocation', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
                    { icon: LogOut, label: 'Leave Request', tab: 'leave', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
                    { icon: CalendarCheck, label: 'Take Attendance', tab: 'attendance', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
                    { icon: Wrench, label: 'Add Complaint', tab: 'complaints', color: 'bg-rose-50 text-rose-700 hover:bg-rose-100' },
                  ].map(action => (
                    <button key={action.label} onClick={() => setActiveTab(action.tab)} className={`flex items-center gap-2 p-3 rounded-lg text-sm font-semibold transition-colors text-left ${action.color}`}>
                      <action.icon className="h-4 w-4" /> {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'blocks' && <BlocksTab institutionId={institutionId} />}
        {activeTab === 'rooms' && <RoomsTab institutionId={institutionId} blocks={blocks} />}
        {activeTab === 'allocation' && <AllocationTab institutionId={institutionId} rooms={rooms} />}
        {activeTab === 'leave' && <LeaveTab institutionId={institutionId} />}
        {activeTab === 'attendance' && <AttendanceTab institutionId={institutionId} />}
        {activeTab === 'complaints' && <ComplaintsTab institutionId={institutionId} />}

        {/* ── FOOTER (dashboard style) ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-gray-300" />
            <span>
              Institution ID:{' '}
              <span className="font-semibold text-gray-600">{profile?.institution_id?.slice(0, 8) || '—'}…</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold border border-emerald-200 text-[10px] uppercase tracking-wide flex items-center gap-1">
              <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Active
            </span>
          </div>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" />
            Real-time data
          </span>
        </div>

      </div>
    </AdminLayout>
  );
}