'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase.ts';
import type { ProfileRow, TenantRow } from '@/types/database.ts';
import { UserSession } from '@/src/types.ts';

interface AuthContextType {
  session: UserSession | null;
  profile: ProfileRow | null;
  activeTenant: TenantRow | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  setActiveTenant: (tenant: TenantRow) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Deterministic initial state for SSR / CSR first frame
  const [session, setSession] = useState<UserSession | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [activeTenant, setActiveTenantState] = useState<TenantRow | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfileAndTenant = useCallback(async (userId: string, targetTenantId?: string) => {
    try {
      // 1. Fetch live profile from public.profiles
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileData) {
        const typedProfile = profileData as unknown as ProfileRow;
        setProfile(typedProfile);
        const resolvedTenantId = targetTenantId || typedProfile.tenant_id;

        // 2. Fetch tenant record
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', resolvedTenantId)
          .single();

        if (tenantData) {
          setActiveTenantState(tenantData as TenantRow);
        }
      }
    } catch {
      // Handled silently
    }
  }, []);

  const refreshSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        const user = data.session.user;
        const tenantId = user.user_metadata?.tenant_id || (typeof document !== 'undefined' ? document.cookie.match(/x-tenant-id=([^;]+)/)?.[1] : undefined);

        if (tenantId) {
          await fetchProfileAndTenant(user.id, tenantId);
        }

        const restoredSession: UserSession = {
          user: {
            id: user.id,
            email: user.email || '',
            fullName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Team Member',
            headline: user.user_metadata?.headline || 'Enterprise Member',
            role: user.user_metadata?.role || 'employee',
            tenantId: tenantId || '',
            avatarUrl: user.user_metadata?.avatar_url,
            hasCompletedOnboarding: !!user.user_metadata?.has_completed_onboarding,
          },
          token: data.session.access_token,
        };

        setSession(restoredSession);
        try {
          localStorage.setItem('syncly_session', JSON.stringify(restoredSession));
        } catch {}
      } else {
        // Fallback to local session if valid in client context
        const stored = typeof window !== 'undefined' ? localStorage.getItem('syncly_session') : null;
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.user?.id && parsed?.user?.email) {
            setSession(parsed);
          } else {
            setSession(null);
          }
        } else {
          setSession(null);
        }
      }
    } catch {
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfileAndTenant]);

  useEffect(() => {
    refreshSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession?.user) {
        const user = newSession.user;
        const tenantId = user.user_metadata?.tenant_id;
        const formatted: UserSession = {
          user: {
            id: user.id,
            email: user.email || '',
            fullName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Team Member',
            headline: user.user_metadata?.headline || 'Enterprise Member',
            role: user.user_metadata?.role || 'employee',
            tenantId: tenantId || '',
            avatarUrl: user.user_metadata?.avatar_url,
            hasCompletedOnboarding: !!user.user_metadata?.has_completed_onboarding,
          },
          token: newSession.access_token,
        };
        setSession(formatted);
        try {
          localStorage.setItem('syncly_session', JSON.stringify(formatted));
        } catch {}
      } else {
        setSession(null);
        try {
          localStorage.removeItem('syncly_session');
        } catch {}
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [refreshSession]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setActiveTenantState(null);
    try {
      localStorage.removeItem('syncly_session');
      localStorage.removeItem('active_community_id');
      localStorage.removeItem('x-tenant-id');
      if (typeof document !== 'undefined') {
        document.cookie = 'x-tenant-id=; path=/; max-age=0';
        document.cookie = 'syncly_session=; path=/; max-age=0';
        document.cookie = 'syncly_role=; path=/; max-age=0';
      }
    } catch {}
  };

  const setActiveTenant = (tenant: TenantRow) => {
    setActiveTenantState(tenant);
    if (session) {
      const updated: UserSession = {
        ...session,
        user: { ...session.user, tenantId: tenant.id },
      };
      setSession(updated);
      try {
        localStorage.setItem('syncly_session', JSON.stringify(updated));
        localStorage.setItem('x-tenant-id', tenant.id);
        if (typeof document !== 'undefined') {
          document.cookie = `x-tenant-id=${tenant.id}; path=/; max-age=2592000`;
        }
      } catch {}
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        activeTenant,
        isAuthenticated: !!session?.user?.id,
        isLoading,
        signOut,
        refreshSession,
        setActiveTenant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useUser() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useUser must be used within an AuthProvider');
  }
  return {
    user: context.session?.user || null,
    profile: context.profile,
    isAuthenticated: context.isAuthenticated,
    isLoading: context.isLoading,
    loading: context.isLoading,
    signOut: context.signOut,
    refreshSession: context.refreshSession,
    refreshProfile: context.refreshSession,
  };
}

export function useTenant() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useTenant must be used within an AuthProvider');
  }
  return {
    activeTenant: context.activeTenant,
    tenantId: context.session?.user?.tenantId || null,
    setActiveTenant: context.setActiveTenant,
  };
}
