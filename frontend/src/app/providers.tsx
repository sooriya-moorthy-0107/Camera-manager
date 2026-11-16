'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { UserProfile, UserRole, UserStatus } from '@/types';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  role: UserRole;
  status: UserStatus;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string; status?: UserStatus }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    registerNumber: string,
    role?: UserRole
  ) => Promise<{ error?: string; isPending?: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>('organizer');
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (authUserId: string, userEmail?: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(`auth_id.eq.${authUserId}${userEmail ? `,email.eq.${userEmail}` : ''}`)
        .maybeSingle();

      if (data && !error) {
        setUserProfile(data as UserProfile);
        setActiveRole(data.role as UserRole);
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (mounted) {
          if (session?.user) {
            setUser(session.user);
            await fetchProfile(session.user.id, session.user.email);
          } else {
            setUser(null);
          }
        }
      } catch {
        // Fallback
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id, session.user.email);
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: error.message };
    }
    if (data.user) {
      setUser(data.user);
      await fetchProfile(data.user.id, data.user.email);
    }
    return { status: userProfile?.status || 'approved' };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    registerNumber: string,
    role: UserRole = 'volunteer'
  ) => {
    // Attempt Supabase email signup
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          register_number: registerNumber,
          role,
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    // Insert user record with status 'pending'
    const newProfile: Partial<UserProfile> = {
      auth_id: data.user?.id || null,
      email: data.user?.email || email,
      full_name: fullName,
      register_number: registerNumber,
      role,
      status: 'pending',
    };

    await supabase.from('users').upsert(newProfile);

    // Also record transaction into activity_logs
    await supabase.from('activity_logs').insert({
      actor_name: fullName,
      actor_regnum: registerNumber,
      actor_role: role,
      action: 'USER_SIGNUP',
      details: `New user ${fullName} (${registerNumber}) registered with role ${role}. Status is Pending Approval.`,
    });

    if (data.user) {
      setUser(data.user);
      await fetchProfile(data.user.id, data.user.email);
    }

    return { isPending: true };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserProfile(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, user.email);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        role: userProfile?.role || activeRole,
        status: userProfile?.status || 'approved',
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
