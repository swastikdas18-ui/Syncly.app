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
  setActiveTenant: (tenant: TenantRow | null) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [activeTenant, setActiveTenantState] = useState<TenantRow | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  /**
   * Helper to clear stale workspace preferences from browser cookies and localStorage.
   */
  const clearStaleWorkspaceStorage = useCallback(() => {
    try {
      localStorage.removeItem('active_tenant_id');
      localStorage.removeItem('active_community_id');
      localStorage.removeItem('x-tenant-id');
      localStorage.removeItem('syncly_workspace');
      if (typeof document !== 'undefined') {
        document.cookie = 'active_tenant_id=; path=/; max-age=0; SameSite=Lax';
        document.cookie = 'active_community_id=; path=/; max-age=0; SameSite=Lax';
        document.cookie = 'x-tenant-id=; path=/; max-age=0; SameSite=Lax';
        document.cookie = 'syncly_role=; path=/; max-age=0; SameSite=Lax';
      }
    } catch { }
  }, []);

  /**
   * Authoritative Workspace Resolution:
   * 1. Retrieve the authenticated Supabase user profile.
   * 2. Query user's active memberships from PostgreSQL public.memberships.
   * 3. An active workspace is ONLY resolved if the user holds an active membership.
   * 4. If a preferred tenant ID (from cookie or param) exists, use it ONLY if it is in verified memberships.
   * 5. If user has multiple memberships, fallback to first verified membership.
   * 6. If user has ZERO memberships, activeTenant is NULL and stale storage is cleared.
   * 7. NEVER fall back to profile.tenant_id, user_metadata, or browser cookies without verified membership.
   */
  const fetchProfileAndTenant = useCallback(async (userId: string, preferredTenantId?: string) => {
    try {
      // 1. Fetch live profile from public.profiles
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!profileData) {
        setProfile(null);
        setActiveTenantState(null);
        clearStaleWorkspaceStorage();
        return;
      }

      const typedProfile = profileData as unknown as ProfileRow;
      setProfile(typedProfile);

      // 2. Fetch user's verified active memberships from public.memberships
      const { data: membershipsData } = await supabase
        .from('memberships')
        .select('community_id, role')
        .eq('user_id', userId);

      const memberships = (membershipsData as Array<{ community_id: string; role: string }>) || [];

      // 3. User has ZERO memberships
      if (memberships.length === 0) {
        setActiveTenantState(null);
        clearStaleWorkspaceStorage();
        return;
      }

      // 4. Resolve active tenant strictly from verified memberships
      let selectedCommunityId: string | null = null;

      if (preferredTenantId) {
        const matchingMem = memberships.find(
          (m) => m.community_id.toLowerCase() === preferredTenantId.toLowerCase()
        );
        if (matchingMem) {
          selectedCommunityId = matchingMem.community_id;
        }
      }

      // If preference was invalid, revoked, or not provided, default to first verified membership
      if (!selectedCommunityId) {
        selectedCommunityId = memberships[0].community_id;
      }

      // 5. Fetch verified tenant record
      const { data: tenantData } = await (supabase.from('tenants') as any)
        .select('*')
        .eq('id', selectedCommunityId)
        .maybeSingle();

      if (tenantData) {
        const typedTenant = tenantData as TenantRow;
        setActiveTenantState(typedTenant);
        // Persist valid verified preference
        try {
          if (typeof document !== 'undefined') {
            document.cookie = `active_tenant_id=${typedTenant.id}; path=/; max-age=86400; SameSite=Lax`;
            document.cookie = `active_community_id=${typedTenant.id}; path=/; max-age=86400; SameSite=Lax`;
            document.cookie = `x-tenant-id=${typedTenant.id}; path=/; max-age=86400; SameSite=Lax`;
          }
        } catch { }
      } else {
        setActiveTenantState(null);
        clearStaleWorkspaceStorage();
      }
    } catch (err) {
      console.error('[AuthContext] Error in fetchProfileAndTenant:', err);
      setProfile(null);
      setActiveTenantState(null);
      clearStaleWorkspaceStorage();
    }
  }, [clearStaleWorkspaceStorage]);

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
        const cookieTenant = typeof document !== 'undefined' 
          ? document.cookie.match(/active_tenant_id=([^;]+)/)?.[1] || document.cookie.match(/x-tenant-id=([^;]+)/)?.[1]
          : undefined;

        await fetchProfileAndTenant(user.id, cookieTenant);

        const restoredSession: UserSession = {
          user: {
            id: user.id,
            email: user.email || '',
            fullName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Team Member',
            headline: user.user_metadata?.headline || 'Enterprise Member',
            role: user.user_metadata?.role || 'employee',
            tenantId: activeTenant?.id || '',
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
        clearStaleWorkspaceStorage();
      }
    } catch {
      setSession(null);
      setProfile(null);
      setActiveTenantState(null);
      clearStaleWorkspaceStorage();
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfileAndTenant, activeTenant?.id, clearStaleWorkspaceStorage]);

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
        const cookieTenant = typeof document !== 'undefined' 
          ? document.cookie.match(/active_tenant_id=([^;]+)/)?.[1]
          : undefined;

        await fetchProfileAndTenant(user.id, cookieTenant);

        const formatted: UserSession = {
          user: {
            id: user.id,
            email: user.email || '',
            fullName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Team Member',
            headline: user.user_metadata?.headline || 'Enterprise Member',
            role: user.user_metadata?.role || 'employee',
            tenantId: activeTenant?.id || '',
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
        clearStaleWorkspaceStorage();
      }
      setIsLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [refreshSession, fetchProfileAndTenant, activeTenant?.id, clearStaleWorkspaceStorage]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setActiveTenantState(null);
    clearStaleWorkspaceStorage();
  };

  const setActiveTenant = (tenant: TenantRow | null) => {
    setActiveTenantState(tenant);
    if (!tenant) {
      clearStaleWorkspaceStorage();
      if (session) {
        setSession({
          ...session,
          user: { ...session.user, tenantId: '' },
        });
      }
      return;
    }

    if (session) {
      const updated: UserSession = {
        ...session,
        user: { ...session.user, tenantId: tenant.id },
      };
      setSession(updated);
      try {
        localStorage.setItem('active_tenant_id', tenant.id);
        localStorage.setItem('x-tenant-id', tenant.id);
        if (typeof document !== 'undefined') {
          document.cookie = `active_tenant_id=${tenant.id}; path=/; max-age=2592000; SameSite=Lax`;
          document.cookie = `x-tenant-id=${tenant.id}; path=/; max-age=2592000; SameSite=Lax`;
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
