'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Tenant } from '@/src/types.ts';
import { api } from '@/src/lib/api.ts';
import { INITIAL_TENANTS } from '@/src/lib/tenantContext.ts';

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

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode; initialCommunityId?: string }> = ({
  children,
  initialCommunityId,
}) => {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [allCommunities, setAllCommunities] = useState<Tenant[]>(INITIAL_TENANTS);
  const [joinedCommunities, setJoinedCommunities] = useState<JoinedCommunity[]>([]);
  // Anonymous visitors DO NOT default to Acme. activeCommunity is null until resolved from verified session.
  const [activeCommunity, setActiveCommunity] = useState<JoinedCommunity | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sync cookies & API client tenantId with verified active community
  const syncActiveCommunity = useCallback((comm: JoinedCommunity | null) => {
    setActiveCommunity(comm);
    if (!comm) {
      api.setTenantId('');
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
    setIsLoading(true);
    try {
      const [tenantsRes, membershipsRes] = await Promise.all([
        api.getTenants(),
        api.getMemberships(),
      ]);

      if (tenantsRes && tenantsRes.length > 0) {
        setAllCommunities(tenantsRes);
      }

      if (membershipsRes && Array.isArray(membershipsRes) && membershipsRes.length > 0) {
        const enrichedJoined: JoinedCommunity[] = membershipsRes.map((m: any) => ({
          ...(m.community || tenantsRes.find((t: any) => t.id === (m.community_id || m.communityId)) || INITIAL_TENANTS[0]),
          id: m.community_id || m.communityId,
          userRole: m.role || 'member',
          isMember: true,
        }));
        setJoinedCommunities(enrichedJoined);

        // Update active community if needed
        setActiveCommunity((prev) => {
          if (!prev) return enrichedJoined[0] || null;
          const match = enrichedJoined.find((c) => c.id === prev.id);
          return match || enrichedJoined[0] || null;
        });
      } else {
        // Unauthenticated or user holds 0 memberships
        setJoinedCommunities([]);
        setActiveCommunity(null);
      }
    } catch {
      // Unauthenticated visitor
      setJoinedCommunities([]);
      setActiveCommunity(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
    refreshMemberships();
  }, [refreshMemberships]);

  const switchCommunity = useCallback((communityId: string) => {
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
    return {
      joinedCommunities: [],
      allCommunities: INITIAL_TENANTS,
      activeCommunity: null,
      switchCommunity: () => {},
      joinCommunity: async () => ({ status: 'error', message: 'No workspace context' }),
      batchJoin: async () => ({ success: false, joinedCount: 0, message: 'No workspace context' }),
      refreshMemberships: async () => {},
      isLoading: false,
      isMounted: true,
    };
  }
  return context;
}
