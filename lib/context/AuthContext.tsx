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
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
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

        // 2. Resolve active tenant from targetTenantId or user's active membership
        let resolvedTenantId = targetTenantId;
        if (!resolvedTenantId) {
          const { data: membershipData } = await supabase
            .from('memberships')
            .select('community_id')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle();

          const memRecord = membershipData as { community_id: string } | null;
          resolvedTenantId = memRecord?.community_id || typedProfile.tenant_id;
        }

        // 3. Fetch tenant record
        if (resolvedTenantId) {
          const { data: tenantData } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', resolvedTenantId)
            .single();

          if (tenantData) {
            setActiveTenantState(tenantData as TenantRow);
          } else {
            setActiveTenantState(null);
          }
        } else {
          setActiveTenantState(null);
        }
      } else {
        setProfile(null);
        setActiveTenantState(null);
      }
    } catch {
      setProfile(null);
      setActiveTenantState(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) {
      await fetchProfileAndTenant(session.user.id, activeTenant?.id);
    }
  }, [session?.user?.id, activeTenant?.id, fetchProfileAndTenant]);

  const refreshSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        const user = data.session.user;
        const cookieTenant = typeof document !== 'undefined' ? document.cookie.match(/x-tenant-id=([^;]+)/)?.[1] : undefined;
        const tenantId = user.user_metadata?.tenant_id || cookieTenant;

        await fetchProfileAndTenant(user.id, tenantId);

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
      } else {
        // Unauthenticated - clean state completely
        setSession(null);
        setProfile(null);
        setActiveTenantState(null);
      }
    } catch {
      setSession(null);
      setProfile(null);
      setActiveTenantState(null);
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfileAndTenant]);

  // Listen to workspace-changed events
  useEffect(() => {
    const handleWorkspaceChanged = () => {
      try {
        const storedWorkspace = localStorage.getItem('syncly_workspace');
        if (storedWorkspace) {
          const parsed = JSON.parse(storedWorkspace);
          if (parsed?.id) {
            setActiveTenantState({
              id: parsed.id,
              name: parsed.name || 'Workspace',
              slug: parsed.slug || 'workspace',
              created_at: new Date().toISOString(),
            });
            if (session) {
              setSession({
                ...session,
                user: {
                  ...session.user,
                  tenantId: parsed.id,
                  role: parsed.role || session.user.role,
                },
              });
            }
          }
        }
      } catch { }
    };

    window.addEventListener('workspace-changed', handleWorkspaceChanged);
    return () => window.removeEventListener('workspace-changed', handleWorkspaceChanged);
  }, [session]);

  useEffect(() => {
    refreshSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession?.user) {
        const user = newSession.user;
        const tenantId = user.user_metadata?.tenant_id;
        await fetchProfileAndTenant(user.id, tenantId);
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
      } else {
        setSession(null);
        setProfile(null);
        setActiveTenantState(null);
      }
      setIsLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [refreshSession, fetchProfileAndTenant]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setActiveTenantState(null);
    try {
      localStorage.removeItem('syncly_session');
      localStorage.removeItem('active_community_id');
      localStorage.removeItem('x-tenant-id');
      localStorage.removeItem('active_tenant_id');
      localStorage.removeItem('syncly_workspace');
      if (typeof document !== 'undefined') {
        document.cookie = 'x-tenant-id=; path=/; max-age=0';
        document.cookie = 'active_tenant_id=; path=/; max-age=0';
        document.cookie = 'syncly_session=; path=/; max-age=0';
        document.cookie = 'syncly_role=; path=/; max-age=0';
      }
    } catch { }
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
        localStorage.setItem('x-tenant-id', tenant.id);
        if (typeof document !== 'undefined') {
          document.cookie = `x-tenant-id=${tenant.id}; path=/; max-age=2592000`;
        }
      } catch { }
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
        refreshProfile,
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
    user: context.session?.user ? { id: context.session.user.id, email: context.session.user.email, role: context.session.user.role } : null,
    profile: context.profile,
    loading: context.isLoading,
    refreshProfile: context.refreshProfile,
    signOut: context.signOut,
  };
}

export function useTenant() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useTenant must be used within an AuthProvider');
  }
  return {
    activeTenant: context.activeTenant,
    setActiveTenant: context.setActiveTenant,
    isLoading: context.isLoading,
  };
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return {
    session: context.session,
    profile: context.profile,
    activeTenant: context.activeTenant,
    user: context.session?.user ? { id: context.session.user.id, email: context.session.user.email, role: context.session.user.role } : null,
    isAuthenticated: context.isAuthenticated,
    loading: context.isLoading,
    signOut: context.signOut,
    refreshSession: context.refreshSession,
    refreshProfile: context.refreshProfile,
    setActiveTenant: context.setActiveTenant,
  };
}

export default AuthContext;
