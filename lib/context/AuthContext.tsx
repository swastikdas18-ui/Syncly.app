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
          }
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
        try {
          localStorage.setItem('syncly_session', JSON.stringify(restoredSession));
        } catch { }
      } else {
        // Fallback to local session or syncly_user if valid in client context
        const storedSession = typeof window !== 'undefined' ? localStorage.getItem('syncly_session') : null;
        const storedUser = typeof window !== 'undefined' ? localStorage.getItem('syncly_user') : null;
        const activeTenantId = typeof window !== 'undefined' ? (localStorage.getItem('active_tenant_id') || '00000000-0000-0000-0000-000000000001') : '00000000-0000-0000-0000-000000000001';

        if (storedSession) {
          try {
            const parsed = JSON.parse(storedSession);
            if (parsed?.user?.id && parsed?.user?.email) {
              setSession(parsed);
              const resolvedTenant = parsed.user.tenantId || activeTenantId;
              setProfile({
                id: parsed.user.id,
                tenant_id: resolvedTenant,
                full_name: parsed.user.fullName || 'Demo Member',
                role: parsed.user.role || 'employee',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              } as any);
              setActiveTenantState({
                id: resolvedTenant,
                name: 'Acme Corporation',
                slug: 'acme-corp',
                created_at: new Date().toISOString(),
              });
            } else {
              setSession(null);
            }
          } catch {
            setSession(null);
          }
        } else if (storedUser) {
          try {
            const user = JSON.parse(storedUser);
            if (user?.id && user?.email) {
              const resolvedTenant = user.tenant_id || activeTenantId;
              const demoSession: UserSession = {
                user: {
                  id: user.id,
                  email: user.email,
                  fullName: user.full_name || 'Demo Member',
                  headline: 'Corporate Team Member',
                  role: user.role || 'employee',
                  tenantId: resolvedTenant,
                  hasCompletedOnboarding: true,
                },
                token: 'demo-access-token',
              };
              setSession(demoSession);
              setProfile({
                id: user.id,
                tenant_id: resolvedTenant,
                full_name: user.full_name || 'Demo Member',
                role: user.role || 'employee',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              } as any);
              setActiveTenantState({
                id: resolvedTenant,
                name: 'Acme Corporation',
                slug: 'acme-corp',
                created_at: new Date().toISOString(),
              });
            } else {
              setSession(null);
            }
          } catch {
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
              name: parsed.name || 'Acme Corporation',
              slug: parsed.slug || 'acme-corp',
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
        try {
          localStorage.setItem('syncly_session', JSON.stringify(formatted));
        } catch { }
      } else {
        setSession(null);
        try {
          localStorage.removeItem('syncly_session');
        } catch { }
      }
      setIsLoading(false);
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
        localStorage.setItem('syncly_session', JSON.stringify(updated));
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return {
    user: context.session?.user || null,
    profile: context.profile,
    session: context.session,
    isAuthenticated: context.isAuthenticated,
    isLoading: context.isLoading,
    signOut: context.signOut,
    refreshSession: context.refreshSession,
    setActiveTenant: context.setActiveTenant,
    activeTenant: context.activeTenant,
  };
}
