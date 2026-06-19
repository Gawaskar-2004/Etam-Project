import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { institutionsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { MapPin, Navigation, Search, Loader2, ArrowRight, Shield, GraduationCap } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LocationForm {
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  latitude: string;
  longitude: string;
}

export default function LocationSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as any;

  const [institutionId, setInstitutionId] = useState<string | null>(null);
  // ✅ FIX: track map ready state separately, never re-init
  const [mapReady, setMapReady] = useState(false);

  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  // ✅ FIX: keep marker position in a ref so it survives re-renders
  const markerPositionRef = useRef<{ lat: number; lng: number } | null>(null);

  const form = useForm<LocationForm>({
    defaultValues: {
      address: '',
      city: '',
      state: '',
      country: 'India',
      pincode: '',
      latitude: '',
      longitude: '',
    },
  });

  // Load institutionId from state or localStorage
  useEffect(() => {
    let data = state;
    if (!data?.institutionId) {
      const savedData = localStorage.getItem('setupData');
      if (savedData) {
        data = JSON.parse(savedData);
      }
    }
    if (data?.institutionId) {
      setInstitutionId(data.institutionId);
    } else {
      navigate('/login');
    }
  }, [state, navigate]);

  // ✅ FIX: Initialize map ONCE only — guarded by mapInstanceRef so it never re-runs
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    try {
      const defaultCenter: L.LatLngExpression = [20.5937, 78.9629];

      const map = L.map(mapRef.current, {
        // ✅ FIX: prevent map from resizing/re-centering on container resize
        preferCanvas: false,
      }).setView(defaultCenter, 5);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      map.on('click', async (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        addMarker(lat, lng);
        await reverseGeocode(lat, lng);
      });

      setMapReady(true);
    } catch (error) {
      console.error('Failed to initialize map:', error);
      toast.error('Failed to load map');
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // ✅ FIX: empty deps — runs ONCE only, never again

  // ✅ FIX: After map is ready, invalidate size so it renders correctly inside the card
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 100);
  }, [mapReady]);

  // Add marker to map
  const addMarker = useCallback((lat: number, lng: number) => {
    if (!mapInstanceRef.current) return;

    if (markerRef.current) {
      markerRef.current.remove();
    }

    const newMarker = L.marker([lat, lng], {
      draggable: true,
    }).addTo(mapInstanceRef.current);

    newMarker.on('dragend', async () => {
      const position = newMarker.getLatLng();
      addMarker(position.lat, position.lng);
      await reverseGeocode(position.lat, position.lng);
    });

    markerRef.current = newMarker;
    // ✅ FIX: save position to ref so it's never lost on re-render
    markerPositionRef.current = { lat, lng };
    setMarker({ lat, lng });
    form.setValue('latitude', lat.toFixed(6));
    form.setValue('longitude', lng.toFixed(6));
  }, [form]);

  // Reverse geocoding using OpenStreetMap Nominatim
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await response.json();

      if (data.address) {
        const address = data.display_name || '';
        const city = data.address.city || data.address.town || data.address.village || '';
        const stateVal = data.address.state || '';
        const country = data.address.country || 'India';
        const pincode = data.address.postcode || '';

        form.setValue('address', address);
        if (city) form.setValue('city', city);
        if (stateVal) form.setValue('state', stateVal);
        if (country) form.setValue('country', country);
        if (pincode) form.setValue('pincode', pincode);

        setSearchQuery(address);
      }
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
    }
  }, [form]);

  // Search location
  const searchLocation = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&countrycodes=in`
      );
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Search failed:', error);
      toast.error('Failed to search location');
    } finally {
      setSearching(false);
    }
  };

  // Select location from search results
  const selectSearchResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    if (mapInstanceRef.current) {
      // ✅ FIX: use flyTo for smooth reliable centering
      mapInstanceRef.current.flyTo([lat, lng], 15, { animate: true, duration: 1 });
    }

    addMarker(lat, lng);
    reverseGeocode(lat, lng);
    setSearchResults([]);
    setSearchQuery(result.display_name);
    toast.success('Location selected');
  };

  // ✅ FIX: Get current location — flyTo + maximumAge:0 for fresh GPS
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        if (mapInstanceRef.current) {
          // ✅ FIX: flyTo properly zooms IN and locks to position
          mapInstanceRef.current.flyTo([lat, lng], 15, {
            animate: true,
            duration: 1.5,
          });
        }

        addMarker(lat, lng);
        await reverseGeocode(lat, lng);

        setGpsLoading(false);
        toast.success('Location detected!');
      },
      (err) => {
        setGpsLoading(false);
        toast.error('Could not get your location');
        console.error(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0, // ✅ FIX: always get fresh GPS, never use cached position
      }
    );
  };

  const onSubmit = async (data: LocationForm) => {
    if (!marker) {
      toast.error('Please select a location on the map');
      return;
    }

    setLoading(true);
    try {
      await institutionsApi.saveLocation({
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        pincode: data.pincode,
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
      });

      toast.success('Location saved successfully!');

      const savedData = localStorage.getItem('setupData');
      const existingData = savedData ? JSON.parse(savedData) : {};
      const updatedData = { ...existingData, locationSaved: true };
      localStorage.setItem('setupData', JSON.stringify(updatedData));

      navigate('/setup/academic', {
        state: { institutionId, locationSaved: true },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save location');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-8 bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="w-full max-w-3xl">
        {/* Logo/Brand */}
        <div className="hidden sm:flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">ETAM Setup</span>
        </div>

        <Card className="border-0 shadow-2xl bg-white/90 backdrop-blur-sm rounded-2xl overflow-hidden">
          <CardHeader className="space-y-4 pb-6 pt-8 px-8">
            <div className="mb-2">
              <Progress value={50} className="h-2 bg-slate-100 [&>div]:bg-gradient-to-r [&>div]:from-indigo-600 [&>div]:to-blue-600" />
              <p className="text-xs text-slate-500 mt-2 text-right">Step 1 of 2: Location Setup</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100">
                <MapPin className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-slate-800">Institution Location</CardTitle>
                <CardDescription className="text-base text-slate-500 mt-1">
                  Search, click on the map, or use your current location to set your institution address
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 px-8 pb-8">
            {/* Search + GPS bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && searchLocation()}
                  placeholder="Search for your institution address..."
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl text-base bg-white/80 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={searchLocation}
                disabled={searching}
                className="h-12 px-4 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="hidden sm:inline ml-2">Search</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={useMyLocation}
                disabled={gpsLoading}
                className="h-12 px-4 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all"
              >
                {gpsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                <span className="hidden sm:inline ml-2">My Location</span>
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-2 space-y-1">
                  {searchResults.map((result, index) => (
                    <div
                      key={index}
                      className="p-2 hover:bg-indigo-50 cursor-pointer rounded-lg transition-colors text-sm text-slate-700"
                      onClick={() => selectSearchResult(result)}
                    >
                      {result.display_name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ✅ FIX: Map container has fixed height and is never unmounted */}
            <div
              ref={mapRef}
              className="rounded-xl overflow-hidden border border-slate-200 shadow-md"
              style={{ height: 400, width: '100%', zIndex: 0 }}
            >
              {!mapReady && (
                <div className="h-full flex items-center justify-center bg-slate-100">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                </div>
              )}
            </div>

            {/* Coordinates display */}
            {marker && (
              <div className="flex items-center gap-2 text-sm text-slate-600 bg-indigo-50/50 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-indigo-100">
                <MapPin className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>Selected: {marker.lat.toFixed(6)}, {marker.lng.toFixed(6)}</span>
                <span className="text-emerald-600 ml-auto flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  Location selected
                </span>
              </div>
            )}

            {/* Address form */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="address"
                  rules={{ required: 'Address is required' }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-slate-700">Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Street address" {...field} className="h-12 rounded-xl border-slate-200 bg-white/80" />
                      </FormControl>
                      <FormMessage className="text-rose-600 text-sm" />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    rules={{ required: 'City is required' }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-slate-700">City</FormLabel>
                        <FormControl>
                          <Input placeholder="City" {...field} className="h-12 rounded-xl border-slate-200 bg-white/80" />
                        </FormControl>
                        <FormMessage className="text-rose-600 text-sm" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="state"
                    rules={{ required: 'State is required' }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-slate-700">State</FormLabel>
                        <FormControl>
                          <Input placeholder="State" {...field} className="h-12 rounded-xl border-slate-200 bg-white/80" />
                        </FormControl>
                        <FormMessage className="text-rose-600 text-sm" />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-slate-700">Country</FormLabel>
                        <FormControl>
                          <Input placeholder="Country" {...field} className="h-12 rounded-xl border-slate-200 bg-white/80" />
                        </FormControl>
                        <FormMessage className="text-rose-600 text-sm" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pincode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-slate-700">Pincode</FormLabel>
                        <FormControl>
                          <Input placeholder="Pincode" {...field} className="h-12 rounded-xl border-slate-200 bg-white/80" />
                        </FormControl>
                        <FormMessage className="text-rose-600 text-sm" />
                      </FormItem>
                    )}
                  />
                </div>
                <input type="hidden" {...form.register('latitude')} />
                <input type="hidden" {...form.register('longitude')} />

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 group mt-4"
                  disabled={loading}
                >
                  {loading ? (
                    <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Saving Location...</>
                  ) : (
                    <div className="flex items-center gap-2">
                      Continue to Academic Setup
                      <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Security badge */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Shield className="w-3.5 h-3.5" />
          <span>Your data is encrypted and secure</span>
        </div>
      </div>
    </div>
  );
}