import { createContext, useEffect, useState, type ReactNode } from 'react';
import { authApi, getToken, setToken, removeToken } from '@/lib/api';

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  phone?: string;
  institution_id?: string;
  is_active?: boolean;
}

export interface AuthContextType {
  user: AuthUser | null;
  profile: AuthUser | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null; user: AuthUser | null }>;
  signUpWithEmail: (email: string, password: string, extraData?: any) => Promise<{ error: Error | null; user: AuthUser | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    try {
      const token = getToken();
      if (!token) { setUser(null); return; }
      const data = await authApi.getMe();
      setUser(data.user || data);
    } catch {
      removeToken();
      setUser(null);
    }
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    authApi.getMe()
      .then(data => { setUser(data.user || data); })
      .catch((err) => {
        const status = (err as any)?.status || (err as any)?.response?.status;
        if (status === 401 || status === 403) {
          console.warn('Token unauthorized, clearing...');
          removeToken();
          setUser(null);
        } else {
          console.warn('Could not validate token (network/server error), keeping token...');
          setUser(null);
        }
      })
      .finally(() => { setLoading(false); });
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const data = await authApi.login(email, password);
      setToken(data.token);
      setUser(data.user);
      return { error: null, user: data.user };
    } catch (error) {
      return { error: error as Error, user: null };
    }
  };

  const signUpWithEmail = async (email: string, password: string, extraData?: any) => {
    try {
      const data = await authApi.register({ email, password, ...extraData });
      setToken(data.token);
      setUser(data.user);
      return { error: null, user: data.user };
    } catch (error) {
      return { error: error as Error, user: null };
    }
  };

  const signOut = async () => {
    removeToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile: user,
      loading,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ✅ Re-export useAuth so ALL existing imports still work
// This means you do NOT need to change any other file
export { useAuth } from './useAuth';