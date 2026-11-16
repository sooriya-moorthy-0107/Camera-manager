'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { UserProfile, UserRole } from '@/types';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  role: UserRole;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, fullName: string, registerNumber: string, role?: UserRole) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchMockRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>('manager');
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
      // Fallback or offline
    }
  };

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          if (session?.user) {
            setUser(session.user);
            await fetchProfile(session.user.id, session.user.email);
          } else {
            // Default mock organizer/manager if unauthenticated for quick start
            setUser(null);
          }
        }
      } catch {
        // Handle init failure gracefully
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
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
    return {};
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    registerNumber: string,
    role: UserRole = 'volunteer'
  ) => {
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

    if (data.user) {
      // Create user profile in public.users
      const { error: profileErr } = await supabase.from('users').upsert({
        auth_id: data.user.id,
        email: data.user.email || email,
        full_name: fullName,
        register_number: registerNumber,
        role,
      });

      if (profileErr) {
        console.error('Failed to create user profile:', profileErr.message);
      }

      setUser(data.user);
      await fetchProfile(data.user.id, data.user.email);
    }

    return {};
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

  const switchMockRole = (role: UserRole) => {
    setActiveRole(role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        role: userProfile?.role || activeRole,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        switchMockRole,
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

