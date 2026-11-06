import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { setAuthToken, profileApi } from '../api';
import type { Profile } from '../types';

export interface DemoAccount {
  name: string;
  email: string;
  role: 'Leader / Admin' | 'Roommate';
  userId: string;
  avatarColor: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    name: 'Arjun Sharma',
    email: 'admin@roomiesplit.com',
    role: 'Leader / Admin',
    userId: 'leader-admin-001',
    avatarColor: '#FFE66D',
  },
  {
    name: 'Rohan Verma',
    email: 'rohan@roomiesplit.com',
    role: 'Roommate',
    userId: 'roommate-rohan-002',
    avatarColor: '#B8F2D0',
  },
  {
    name: 'Priya Nair',
    email: 'priya@roomiesplit.com',
    role: 'Roommate',
    userId: 'roommate-priya-003',
    avatarColor: '#FFB8A2',
  },
  {
    name: 'Kabir Mehta',
    email: 'kabir@roomiesplit.com',
    role: 'Roommate',
    userId: 'roommate-kabir-004',
    avatarColor: '#C9D5FF',
  },
];

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  setProfile: (p: Profile | null) => void;
  loginAsDemo: (userId?: string, name?: string, email?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const LOCAL_SESSION_KEY = 'roomiesplit_local_auth_session';

function resolveLocalUserId(email: string): { uid: string; name: string } {
  const norm = email.toLowerCase().trim();
  const found = DEMO_ACCOUNTS.find(a => a.email.toLowerCase() === norm);
  if (found) {
    return { uid: found.userId, name: found.name };
  }
  if (norm.includes('admin') || norm.includes('leader')) {
    return { uid: 'leader-admin-001', name: 'Arjun Sharma (Leader / Admin)' };
  }
  if (norm.includes('rohan')) {
    return { uid: 'roommate-rohan-002', name: 'Rohan Verma' };
  }
  if (norm.includes('priya')) {
    return { uid: 'roommate-priya-003', name: 'Priya Nair' };
  }
  if (norm.includes('kabir')) {
    return { uid: 'roommate-kabir-004', name: 'Kabir Mehta' };
  }
  return { uid: 'user-' + norm.replace(/[^a-zA-Z0-9]/g, '_'), name: email.split('@')[0] };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const fetchProfile = useCallback(async (token: string) => {
    setProfileLoading(true);
    setAuthToken(token);
    try {
      const p = await profileApi.getMe();
      setProfile(p);
      return p;
    } catch {
      setProfile(null);
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const createLocalSession = useCallback(async (userId: string, email: string, displayName?: string) => {
    const token = `demo-token-${userId}`;
    const mockSession: any = {
      access_token: token,
      token_type: 'bearer',
      user: {
        id: userId,
        email: email,
        user_metadata: { full_name: displayName || email.split('@')[0] },
      },
    };

    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(mockSession));
    setSession(mockSession);
    setAuthToken(token);

    // Fetch existing profile or create one
    let p = await fetchProfile(token);
    if (!p && displayName) {
      try {
        p = await profileApi.create({ display_name: displayName });
        setProfile(p);
      } catch {
        // Ignored
      }
    }
  }, [fetchProfile]);

  useEffect(() => {
    // Check local session first
    const saved = localStorage.getItem(LOCAL_SESSION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSession(parsed);
        if (parsed.access_token) {
          fetchProfile(parsed.access_token).finally(() => setLoading(false));
          return;
        }
      } catch {
        localStorage.removeItem(LOCAL_SESSION_KEY);
      }
    }

    // Otherwise check Supabase if configured
    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data }) => {
        setSession(data.session);
        if (data.session?.access_token) {
          fetchProfile(data.session.access_token).finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      }).catch(() => {
        setLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
        setSession(sess);
        if (sess?.access_token) {
          fetchProfile(sess.access_token).finally(() => setLoading(false));
        } else {
          setAuthToken(null);
          setProfile(null);
          setLoading(false);
        }
      });

      return () => subscription.unsubscribe();
    } else {
      setLoading(false);
    }
  }, [fetchProfile]);

  const signUp = async (email: string, password: string, displayName?: string) => {
    if (!isSupabaseConfigured) {
      const { uid, name } = resolveLocalUserId(email);
      await createLocalSession(uid, email, displayName || name);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } }
      });
      if (error) throw error;
    } catch (err: any) {
      if (err?.message?.includes('Failed to fetch') || !isSupabaseConfigured) {
        const { uid, name } = resolveLocalUserId(email);
        await createLocalSession(uid, email, displayName || name);
      } else {
        throw err;
      }
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      const { uid, name } = resolveLocalUserId(email);
      await createLocalSession(uid, email, name);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      if (err?.message?.includes('Failed to fetch') || !isSupabaseConfigured) {
        const { uid, name } = resolveLocalUserId(email);
        await createLocalSession(uid, email, name);
      } else {
        throw err;
      }
    }
  };

  const loginAsDemo = async (
    userId = 'leader-admin-001',
    name = 'Arjun Sharma (Leader / Admin)',
    email = 'admin@roomiesplit.com'
  ) => {
    await createLocalSession(userId, email, name);
  };

  const signOut = async () => {
    localStorage.removeItem(LOCAL_SESSION_KEY);
    localStorage.removeItem('roomiesplit_active_room');
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignored
      }
    }
    setSession(null);
    setProfile(null);
    setAuthToken(null);
  };

  const resetPassword = async (email: string) => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) throw error;
  };

  const refreshProfile = useCallback(async () => {
    if (session?.access_token) {
      await fetchProfile(session.access_token);
    }
  }, [session, fetchProfile]);

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      profile,
      loading,
      profileLoading,
      signUp,
      signIn,
      signOut,
      resetPassword,
      refreshProfile,
      setProfile,
      loginAsDemo,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
