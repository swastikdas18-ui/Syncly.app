'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase.ts';
import type { ProfileRow, TenantRow } from '@/types/database.ts';
import { UserSession } from '@/src/types.ts';

export type MembershipFetchStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

interface AuthContextType {
  session: UserSession | null;
  profile: ProfileRow | null;
  activeTenant: TenantRow | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  membershipStatus: MembershipFetchStatus;
  membershipError: string | null;
  retryMembershipFetch: () => Promise<void>;
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
  const [membershipStatus, setMembershipStatus] = useState<MembershipFetchStatus>('idle');
  const [membershipError, setMembershipError] = useState<string | null>(null);

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
   * 3. Handle query failures explicitly with status 'error' WITHOUT destroying valid authenticated session.
   * 4. If query succeeds with 0 rows, set status to 'empty' and activeTenant to null.
   * 5. If query succeeds with rows, validate preferredTenantId or default to first verified membership.
   * 6. NEVER fall back to profile.tenant_id, user_metadata, or browser cookies without verified membership.
   */
  const fetchProfileAndTenant = useCallback(async (userId: string, preferredTenantId?: string) => {
    setMembershipStatus('loading');
    setMembershipError(null);

    try {
      // 1. Fetch live profile from public.profiles
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileErr) {
        console.warn('[AuthContext] Failed to load profile:', profileErr);
      }

      const typedProfile = profileData ? (profileData as unknown as ProfileRow) : null;
      setProfile(typedProfile);

      // 2. Fetch user's verified active memberships from public.memberships
      const { data: membershipsData, error: memErr } = await supabase
        .from('memberships')
        .select('community_id, role')
        .eq('user_id', userId);

      // Handle database query error explicitly
      if (memErr) {
        console.error('[AuthContext] Membership query failed:', memErr);
        setMembershipStatus('error');
        setMembershipError(memErr.message || 'Failed to query memberships.');
        // Do not alter activeTenant if it was previously set; fail safe
        setActiveTenantState(null);
        return;
      }

      const memberships = (membershipsData as Array<{ community_id: string; role: string }>) || [];

      // 3. User has ZERO memberships
      if (memberships.length === 0) {
        setMembershipStatus('empty');
        setActiveTenantState(null);
        clearStaleWorkspaceStorage();
        return;
      }

      // 4. Resolve active tenant strictly from verified memberships
      setMembershipStatus('success');
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
    } catch (err: any) {
      console.error('[AuthContext] Error in fetchProfileAndTenant:', err);
      setMembershipStatus('error');
      setMembershipError(err?.message || 'Unexpected membership error.');
      setActiveTenantState(null);
    }
  }, [clearStaleWorkspaceStorage]);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) {
      await fetchProfileAndTenant(session.user.id, activeTenant?.id);
    }
  }, [session?.user?.id, activeTenant?.id, fetchProfileAndTenant]);

  const retryMembershipFetch = useCallback(async () => {
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
        setMembershipStatus('idle');
        clearStaleWorkspaceStorage();
      }
    } catch {
      setSession(null);
      setProfile(null);
      setActiveTenantState(null);
      setMembershipStatus('idle');
      clearStaleWorkspaceStorage();
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfileAndTenant, activeTenant?.id, clearStaleWorkspaceStorage]);

  // Listen to workspace-changed events: REVALIDATE with database memberships rather than blindly adopting localStorage
  useEffect(() => {
    const handleWorkspaceChanged = async (event?: Event) => {
      if (session?.user?.id) {
        // Extract requested tenantId from CustomEvent detail if available, or cookie
        const customDetailId = (event as CustomEvent)?.detail?.tenantId;
        const cookieId = typeof document !== 'undefined'
          ? document.cookie.match(/active_tenant_id=([^;]+)/)?.[1]
          : undefined;
        const preferredTenantId = customDetailId !== undefined ? customDetailId : cookieId;

        // Re-verify against live public.memberships table passing untrusted preference
        await fetchProfileAndTenant(session.user.id, preferredTenantId || undefined);
      }
    };

    window.addEventListener('workspace-changed', handleWorkspaceChanged);
    return () => window.removeEventListener('workspace-changed', handleWorkspaceChanged);
  }, [session?.user?.id, fetchProfileAndTenant]);

  useEffect(() => {
    refreshSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === 'SIGNED_OUT' || !newSession?.user) {
        setSession(null);
        setProfile(null);
        setActiveTenantState(null);
        setMembershipStatus('idle');
        setMembershipError(null);
        clearStaleWorkspaceStorage();
      } else if (newSession?.user) {
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
    setMembershipStatus('idle');
    setMembershipError(null);
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
        membershipStatus,
        membershipError,
        retryMembershipFetch,
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
    membershipStatus: context.membershipStatus,
    membershipError: context.membershipError,
    retryMembershipFetch: context.retryMembershipFetch,
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
    membershipStatus: context.membershipStatus,
    membershipError: context.membershipError,
    retryMembershipFetch: context.retryMembershipFetch,
    signOut: context.signOut,
    refreshSession: context.refreshSession,
    refreshProfile: context.refreshProfile,
    setActiveTenant: context.setActiveTenant,
  };
}

export default AuthContext;
