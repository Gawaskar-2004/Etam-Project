import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getInstitution } from '@/db/api';
import AdminLayout from '@/components/layouts/AdminLayout';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Layers,
  FolderTree,
  BookOpen,
  Calendar,
  ChevronRight,
  Settings as SettingsIcon,
  Shield,
  CalendarDays,
  Globe,
} from 'lucide-react';
import type { Institution } from '@/types';

export default function SettingsPage() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!profile?.institution_id) {
      setDataLoading(false);
      return;
    }
    fetchData();
  }, [profile?.institution_id, authLoading]);

  const fetchData = async () => {
    try {
      setDataLoading(true);
      // ✅ Only fetch institution — branches table is removed
      const institutionData = await getInstitution(profile!.institution_id);
      setInstitution(institutionData || null);
    } catch (error) {
      console.error('Failed to fetch institution:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const academicConfigItems = [
    {
      icon: Layers,
      title: 'Academic Setup',
      description: 'Configure academic structure, categories, and subcategories',
      path: '/admin/academic-setup',
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
    },
    {
      icon: FolderTree,
      title: 'Academic Management',
      description: 'Manage academic categories, departments, and sections',
      path: '/admin/academic-management',
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      icon: BookOpen,
      title: 'Subject Management',
      description: 'Add, edit, and organize subjects and courses',
      path: '/admin/subjects',
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
    {
      icon: Calendar,
      title: 'Timetable Management',
      description: 'Create and manage class schedules and timetables',
      path: '/admin/timetable',
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
  ];

  const isLoading = authLoading || dataLoading;

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* PAGE HEADER */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Manage institution, academic structure, and system preferences
            </p>
          </div>
          <div className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500">
            <Shield className="h-4 w-4" />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <Skeleton className="h-5 w-32 bg-gray-100 rounded" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-16 w-full bg-gray-100 rounded-lg" />
                <Skeleton className="h-16 w-full bg-gray-100 rounded-lg" />
                <Skeleton className="h-16 w-full bg-gray-100 rounded-lg" />
                <Skeleton className="h-16 w-full bg-gray-100 rounded-lg" />
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
              <Skeleton className="h-5 w-40 bg-gray-100 rounded" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-28 w-full bg-gray-100 rounded-lg" />
                <Skeleton className="h-28 w-full bg-gray-100 rounded-lg" />
                <Skeleton className="h-28 w-full bg-gray-100 rounded-lg" />
                <Skeleton className="h-28 w-full bg-gray-100 rounded-lg" />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Academic Configuration */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                <div className="p-2 rounded-lg bg-indigo-50">
                  <SettingsIcon className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">Academic Configuration</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Configure academic structure, subjects, and timetables
                  </p>
                </div>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {academicConfigItems.map((item) => (
                    <div
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className="group relative overflow-hidden rounded-xl border border-gray-100 bg-white p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-indigo-200"
                    >
                      <div className="relative flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${item.iconBg} group-hover:scale-110 transition-transform duration-200`}>
                          <item.icon className={`h-4 w-4 ${item.iconColor}`} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors text-sm">
                            {item.title}
                          </h3>
                          <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Institution Information */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                <div className="p-2 rounded-lg bg-indigo-50">
                  <Building2 className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">Institution Information</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Details about your organization</p>
                </div>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      Institution Name
                    </label>
                    <p className="text-base font-bold text-gray-900">{institution?.name || '—'}</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      Institution Type
                    </label>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      <Building2 className="h-3 w-3" />
                      {institution?.type || '—'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1">
                      <Mail className="h-3 w-3" /> Admin Email
                    </label>
                    <p className="text-sm text-gray-600 font-mono">{institution?.admin_email || '—'}</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Phone
                    </label>
                    <p className="text-sm text-gray-600">{institution?.phone || '—'}</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      Setup Status
                    </label>
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                      institution?.is_setup_complete
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${institution?.is_setup_complete ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {institution?.is_setup_complete ? 'Complete' : 'Incomplete'}
                    </span>
                  </div>

                </div>
              </div>
            </div>

            {/* Location Information — from institutions table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                <div className="p-2 rounded-lg bg-indigo-50">
                  <MapPin className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">Location</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Physical address and coordinates
                  </p>
                </div>
              </div>
              <div className="p-5">
                {!institution?.address && !institution?.city ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center">
                      <MapPin className="h-6 w-6 text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-400">No location configured</p>
                    <p className="text-xs text-gray-300">Location details will appear here once set up</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                    {institution?.address && (
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> Address
                        </label>
                        <p className="text-sm text-gray-600 leading-relaxed">{institution.address}</p>
                      </div>
                    )}

                    {institution?.city && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">City</label>
                        <p className="text-sm text-gray-600">{institution.city}</p>
                      </div>
                    )}

                    {institution?.state && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">State</label>
                        <p className="text-sm text-gray-600">{institution.state}</p>
                      </div>
                    )}

                    {institution?.pincode && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Pincode</label>
                        <p className="text-sm text-gray-600 font-mono">{institution.pincode}</p>
                      </div>
                    )}

                    {institution?.country && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1">
                          <Globe className="h-3 w-3" /> Country
                        </label>
                        <p className="text-sm text-gray-600">{institution.country}</p>
                      </div>
                    )}

                    {institution?.latitude && institution?.longitude && (
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          GPS Coordinates
                        </label>
                        <p className="text-sm text-gray-600 font-mono">
                          📍 {institution.latitude}, {institution.longitude}
                        </p>
                      </div>
                    )}

                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* FOOTER */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-gray-300" />
            <span>
              Institution ID:{' '}
              <span className="font-semibold text-gray-600">
                {profile?.institution_id?.slice(0, 8) || '—'}…
              </span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold border border-emerald-200 text-[10px] uppercase tracking-wide flex items-center gap-1">
              <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Configured
            </span>
          </div>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse" />
            System ready
          </span>
        </div>

      </div>
    </AdminLayout>
  );
}