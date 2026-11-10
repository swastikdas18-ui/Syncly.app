'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Tenant } from '@/src/types.ts';
import { api } from '@/src/lib/api.ts';
import { supabase } from '@/lib/supabase.ts';

export interface JoinedCommunity extends Tenant {
  userRole?: string;
  isMember?: boolean;
}

export type WorkspaceFetchStatus = 'idle' | 'loading' | 'success' | 'empty' | 'unauthorized' | 'forbidden' | 'error';

interface WorkspaceContextType {
  joinedCommunities: JoinedCommunity[];
  allCommunities: Tenant[];
  activeCommunity: JoinedCommunity | null;
  membershipStatus: WorkspaceFetchStatus;
  membershipError: string | null;
  switchCommunity: (communityId: string) => Promise<{ success: boolean; error?: string }>;
  joinCommunity: (communityId: string, options?: { message?: string }) => Promise<{ status: string; message: string; tenant?: Tenant }>;
  batchJoin: (communityIds: string[]) => Promise<{ success: boolean; joinedCount: number; message: string }>;
  refreshMemberships: () => Promise<void>;
  isLoading: boolean;
  isMounted: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode; initialCommunityId?: string }> = ({
  children,
}) => {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [allCommunities, setAllCommunities] = useState<Tenant[]>([]);
  const [joinedCommunities, setJoinedCommunities] = useState<JoinedCommunity[]>([]);
  const [activeCommunity, setActiveCommunity] = useState<JoinedCommunity | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [membershipStatus, setMembershipStatus] = useState<WorkspaceFetchStatus>('idle');
  const [membershipError, setMembershipError] = useState<string | null>(null);

  // Keep a ref to the latest active community to support rollback on failure
  const activeCommunityRef = useRef<JoinedCommunity | null>(null);
  activeCommunityRef.current = activeCommunity;

  // Sync cookies & API client tenantId with verified active community
  const syncActiveCommunity = useCallback((comm: JoinedCommunity | null) => {
    setActiveCommunity(comm);
    activeCommunityRef.current = comm;

    if (!comm) {
      api.setTenantId(null);
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('active_tenant_id');
          localStorage.removeItem('active_community_id');
          localStorage.removeItem('x-tenant-id');
          localStorage.removeItem('syncly_workspace');
        } catch {}
        document.cookie = `active_tenant_id=; path=/; max-age=0; SameSite=Lax`;
        document.cookie = `active_community_id=; path=/; max-age=0; SameSite=Lax`;
        document.cookie = `x-tenant-id=; path=/; max-age=0; SameSite=Lax`;
        document.cookie = `syncly_role=; path=/; max-age=0; SameSite=Lax`;
        window.dispatchEvent(new Event('workspace-changed'));
      }
      return;
    }

    api.setTenantId(comm.id);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('active_tenant_id', comm.id);
        localStorage.setItem('active_community_id', comm.id);
        localStorage.setItem('x-tenant-id', comm.id);
        localStorage.setItem(
          'syncly_workspace',
          JSON.stringify({
            id: comm.id,
            name: comm.name,
            slug: comm.slug,
            role: comm.userRole || 'member',
          })
        );
      } catch {}
      document.cookie = `active_tenant_id=${comm.id}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `active_community_id=${comm.id}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `x-tenant-id=${comm.id}; path=/; max-age=86400; SameSite=Lax`;
      if (comm.userRole) {
        document.cookie = `syncly_role=${comm.userRole}; path=/; max-age=86400; SameSite=Lax`;
      }
      window.dispatchEvent(new Event('workspace-changed'));
    }
  }, []);

  const refreshMemberships = useCallback(async () => {
    // Only attempt data fetch if user session actually exists
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setJoinedCommunities([]);
        syncActiveCommunity(null);
        setAllCommunities([]);
        setMembershipStatus('idle');
        setMembershipError(null);
        return;
      }
    } catch {
      setJoinedCommunities([]);
      syncActiveCommunity(null);
      setAllCommunities([]);
      setMembershipStatus('idle');
      setMembershipError(null);
      return;
    }

    setIsLoading(true);
    setMembershipStatus('loading');
    setMembershipError(null);

    try {
      const [tenantsRes, memResult] = await Promise.all([
        api.getTenants(),
        api.getMemberships(),
      ]);

      if (tenantsRes && tenantsRes.length > 0) {
        setAllCommunities(tenantsRes);
      }

      // Handle structured membership result
      if (memResult.status === 'success') {
        const enrichedJoined: JoinedCommunity[] = memResult.data.map((m: any) => ({
          ...(m.community || tenantsRes.find((t: any) => t.id === (m.community_id || m.communityId)) || {
            id: m.community_id || m.communityId,
            name: 'Workspace',
            slug: 'workspace',
          }),
          id: m.community_id || m.communityId,
          userRole: m.role || 'member',
          isMember: true,
        }));
        setJoinedCommunities(enrichedJoined);
        setMembershipStatus('success');

        // Update active community: only select from verified active memberships
        const currentActiveId = activeCommunityRef.current?.id;
        const matchingVerified = currentActiveId 
          ? enrichedJoined.find((c) => c.id === currentActiveId) 
          : null;

        if (matchingVerified) {
          syncActiveCommunity(matchingVerified);
        } else {
          // If no previous active or previous active is no longer a verified membership, select first verified
          syncActiveCommunity(enrichedJoined[0] || null);
        }
      } else if (memResult.status === 'empty') {
        // Authenticated user holds 0 memberships (legitimate empty state)
        setJoinedCommunities([]);
        setMembershipStatus('empty');
        syncActiveCommunity(null);
      } else if (memResult.status === 'unauthorized') {
        setJoinedCommunities([]);
        setMembershipStatus('unauthorized');
        setMembershipError(memResult.error || 'Authentication required.');
        syncActiveCommunity(null);
      } else if (memResult.status === 'forbidden') {
        setJoinedCommunities([]);
        setMembershipStatus('forbidden');
        setMembershipError(memResult.error || 'Access forbidden.');
        syncActiveCommunity(null);
      } else {
        // Error state: server or network failure (DO NOT treat as empty / zero memberships)
        setMembershipStatus('error');
        setMembershipError(memResult.error || 'Failed to load memberships.');
        // Do not overwrite previous active workspace with empty state on temporary error
      }
    } catch (err: any) {
      setMembershipStatus('error');
      setMembershipError(err?.message || 'Unexpected membership error.');
    } finally {
      setIsLoading(false);
    }
  }, [syncActiveCommunity]);

  useEffect(() => {
    setIsMounted(true);
    refreshMemberships();

    // Synchronize workspace memberships with Supabase Auth lifecycle events
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        await refreshMemberships();
      } else if (event === 'SIGNED_OUT') {
        setJoinedCommunities([]);
        setAllCommunities([]);
        setMembershipStatus('idle');
        setMembershipError(null);
        syncActiveCommunity(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [refreshMemberships, syncActiveCommunity]);

  /**
   * switchCommunity
   * 
   * Strict Rules Enforced:
   * 1. Only active verified memberships can become active workspaces.
   * 2. Waits for server confirmation (/api/workspaces/switch).
   * 3. Rolls back to previous workspace if switching fails.
   * 4. Never marks a community as isMember=true without verified membership.
   * 5. Revalidates memberships after switching.
   */
  const switchCommunity = useCallback(async (communityId: string): Promise<{ success: boolean; error?: string }> => {
    // 1. Verify target workspace exists in user's joined (verified) communities
    const verifiedTarget = joinedCommunities.find((c) => c.id === communityId);

    if (!verifiedTarget) {
      console.warn('[WorkspaceContext] Cannot switch to workspace: caller does not hold an active membership in', communityId);
      return {
        success: false,
        error: 'Forbidden. You do not hold an active membership in this workspace.',
      };
    }

    const previousCommunity = activeCommunityRef.current;

    try {
      // 2. Call server to switch active tenant session & set cookies
      const res = await fetch('/api/workspaces/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: communityId }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success) {
        throw new Error(json.error || `Failed to switch workspace (HTTP ${res.status})`);
      }

      // 3. Server confirmed: synchronize active community state
      syncActiveCommunity(verifiedTarget);

      // 4. Revalidate memberships from authoritative source
      await refreshMemberships();

      return { success: true };
    } catch (err: any) {
      console.error('[WorkspaceContext] Workspace switch failed, restoring previous state:', err);
      // 5. Restore previous active workspace
      syncActiveCommunity(previousCommunity);
      return {
        success: false,
        error: err?.message || 'Workspace switch failed.',
      };
    }
  }, [joinedCommunities, syncActiveCommunity, refreshMemberships]);

  const joinCommunity = useCallback(async (communityId: string, options?: { message?: string }) => {
    const res = await api.joinCommunity(communityId, options || {});
    if (res.status === 'joined' && res.tenant) {
      await refreshMemberships();
    }
    return res;
  }, [refreshMemberships]);

  const batchJoin = useCallback(async (communityIds: string[]) => {
    const res = await api.batchJoinCommunities(communityIds);
    await refreshMemberships();
    return res;
  }, [refreshMemberships]);

  return (
    <WorkspaceContext.Provider
      value={{
        joinedCommunities,
        allCommunities,
        activeCommunity,
        membershipStatus,
        membershipError,
        switchCommunity,
        joinCommunity,
        batchJoin,
        refreshMemberships,
        isLoading,
        isMounted,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    return {
      joinedCommunities: [],
      allCommunities: [],
      activeCommunity: null,
      membershipStatus: 'idle' as WorkspaceFetchStatus,
      membershipError: null,
      switchCommunity: async () => ({ success: false, error: 'No workspace context' }),
      joinCommunity: async () => ({ status: 'error', message: 'No workspace context' }),
      batchJoin: async () => ({ success: false, joinedCount: 0, message: 'No workspace context' }),
      refreshMemberships: async () => {},
      isLoading: false,
      isMounted: true,
    };
  }
  return context;
}
