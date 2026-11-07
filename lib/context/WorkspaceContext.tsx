'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Tenant } from '@/src/types.ts';
import { api } from '@/src/lib/api.ts';
import { DEFAULT_TENANT_ID, INITIAL_TENANTS } from '@/src/lib/tenantContext.ts';

export interface JoinedCommunity extends Tenant {
  userRole?: string;
  isMember?: boolean;
}

interface WorkspaceContextType {
  joinedCommunities: JoinedCommunity[];
  allCommunities: Tenant[];
  activeCommunity: JoinedCommunity | null;
  switchCommunity: (communityId: string) => void;
  joinCommunity: (communityId: string, options?: { message?: string }) => Promise<{ status: string; message: string; tenant?: Tenant }>;
  batchJoin: (communityIds: string[]) => Promise<{ success: boolean; joinedCount: number; message: string }>;
  refreshMemberships: () => Promise<void>;
  isLoading: boolean;
  isMounted: boolean;
}

export const DEFAULT_WORKSPACE = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Acme Corporation',
  slug: 'acme-corp',
  role: 'owner',
};

const DEFAULT_WORKSPACE_STATE: JoinedCommunity = {
  ...INITIAL_TENANTS[0],
  id: DEFAULT_WORKSPACE.id,
  name: DEFAULT_WORKSPACE.name,
  slug: DEFAULT_WORKSPACE.slug,
  userRole: DEFAULT_WORKSPACE.role,
  isMember: true,
};

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode; initialCommunityId?: string }> = ({
  children,
  initialCommunityId,
}) => {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [allCommunities, setAllCommunities] = useState<Tenant[]>(INITIAL_TENANTS);
  const [joinedCommunities, setJoinedCommunities] = useState<JoinedCommunity[]>([
    { ...INITIAL_TENANTS[0], userRole: 'owner', isMember: true },
    { ...INITIAL_TENANTS[1], userRole: 'member', isMember: true },
  ]);

  // Synchronous initial state is deterministic between server and client first frame
  const [activeCommunity, setActiveCommunity] = useState<JoinedCommunity | null>(() => {
    const candidateId = initialCommunityId || DEFAULT_TENANT_ID;
    const found = INITIAL_TENANTS.find((t) => t.id === candidateId);
    return found ? { ...found, userRole: 'owner', isMember: true } : DEFAULT_WORKSPACE_STATE;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sync cookies & API client tenantId with active community
  const syncActiveCommunity = useCallback((comm: JoinedCommunity) => {
    setActiveCommunity(comm);
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
    setIsLoading(true);
    try {
      const [tenantsRes, membershipsRes] = await Promise.all([
        api.getTenants(),
        api.getMemberships(),
      ]);

      if (tenantsRes && tenantsRes.length > 0) {
        setAllCommunities(tenantsRes);
      }

      if (membershipsRes && membershipsRes.length > 0) {
        const enrichedJoined: JoinedCommunity[] = membershipsRes.map((m: any) => ({
          ...(m.community || tenantsRes.find((t: any) => t.id === m.communityId) || INITIAL_TENANTS[0]),
          id: m.communityId,
          userRole: m.role || 'member',
          isMember: true,
        }));
        setJoinedCommunities(enrichedJoined);

        // Update active community if needed
        setActiveCommunity((prev) => {
          if (!prev) return enrichedJoined[0] || null;
          const match = enrichedJoined.find((c) => c.id === prev.id);
          return match || enrichedJoined[0] || prev;
        });
      }
    } catch (e) {
      console.warn('WorkspaceContext refreshMemberships fallback:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Post-mount client effect: restore active workspace from localStorage/cookies without hydration mismatch
  useEffect(() => {
    setIsMounted(true);
    try {
      const storedWorkspace = localStorage.getItem('syncly_workspace');
      const storedTenantId = localStorage.getItem('active_tenant_id') || localStorage.getItem('active_community_id') || localStorage.getItem('x-tenant-id');

      if (storedWorkspace) {
        const parsed = JSON.parse(storedWorkspace);
        if (parsed?.id && parsed.id !== 'default') {
          const match = INITIAL_TENANTS.find((t) => t.id === parsed.id);
          setActiveCommunity({
            ...(match || DEFAULT_WORKSPACE_STATE),
            id: parsed.id,
            name: parsed.name || match?.name || DEFAULT_WORKSPACE.name,
            slug: parsed.slug || match?.slug || DEFAULT_WORKSPACE.slug,
            userRole: parsed.role || 'owner',
            isMember: true,
          });
          api.setTenantId(parsed.id);
        }
      } else if (storedTenantId && storedTenantId !== 'default') {
        const found = INITIAL_TENANTS.find((t) => t.id === storedTenantId);
        if (found) {
          setActiveCommunity({ ...found, userRole: 'owner', isMember: true });
          api.setTenantId(found.id);
        } else {
          setActiveCommunity(DEFAULT_WORKSPACE_STATE);
          api.setTenantId(DEFAULT_WORKSPACE.id);
        }
      } else {
        setActiveCommunity(DEFAULT_WORKSPACE_STATE);
        api.setTenantId(DEFAULT_WORKSPACE.id);
      }
    } catch {
      setActiveCommunity(DEFAULT_WORKSPACE_STATE);
      api.setTenantId(DEFAULT_WORKSPACE.id);
    }
    refreshMemberships();
  }, [refreshMemberships]);

  const switchCommunity = useCallback((communityId: string) => {
    // Notify server to validate membership and issue verified session token
    fetch('/api/workspaces/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: communityId }),
    }).catch(() => {});

    const target = joinedCommunities.find((c) => c.id === communityId) 
      || allCommunities.find((c) => c.id === communityId);

    if (target) {
      const isAlreadyJoined = joinedCommunities.find((c) => c.id === communityId);
      const role = isAlreadyJoined?.userRole || (target as any).userRole || 'member';
      const joinedTarget: JoinedCommunity = {
        ...target,
        userRole: role,
        isMember: true,
      };
      syncActiveCommunity(joinedTarget);
    }
  }, [joinedCommunities, allCommunities, syncActiveCommunity]);

  const joinCommunity = useCallback(async (communityId: string, options?: { message?: string }) => {
    const res = await api.joinCommunity(communityId, options || {});
    if (res.status === 'joined' && res.tenant) {
      const newJoined: JoinedCommunity = {
        ...res.tenant,
        userRole: 'member',
        isMember: true,
      };
      setJoinedCommunities((prev) => {
        if (prev.some((c) => c.id === communityId)) return prev;
        return [...prev, newJoined];
      });
      syncActiveCommunity(newJoined);
    }
    await refreshMemberships();
    return res;
  }, [refreshMemberships, syncActiveCommunity]);

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
    // Return safe fallback instead of throwing uncaught errors
    return {
      joinedCommunities: [{ ...INITIAL_TENANTS[0], userRole: 'owner', isMember: true }],
      allCommunities: INITIAL_TENANTS,
      activeCommunity: DEFAULT_WORKSPACE_STATE,
      switchCommunity: () => {},
      joinCommunity: async () => ({ status: 'success', message: 'OK' }),
      batchJoin: async () => ({ success: true, joinedCount: 0, message: 'OK' }),
      refreshMemberships: async () => {},
      isLoading: false,
      isMounted: true,
    };
  }
  return context;
}
