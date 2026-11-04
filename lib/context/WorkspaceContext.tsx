import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Tenant, Community, Membership } from '@/src/types.ts';
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
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode; initialCommunityId?: string }> = ({
  children,
  initialCommunityId,
}) => {
  const [allCommunities, setAllCommunities] = useState<Tenant[]>(INITIAL_TENANTS);
  const [joinedCommunities, setJoinedCommunities] = useState<JoinedCommunity[]>(() => {
    return [
      { ...INITIAL_TENANTS[0], userRole: 'owner', isMember: true },
      { ...INITIAL_TENANTS[1], userRole: 'member', isMember: true },
    ];
  });

  const [activeCommunity, setActiveCommunity] = useState<JoinedCommunity | null>(() => {
    try {
      const stored = localStorage.getItem('active_community_id');
      const candidateId = initialCommunityId || stored || DEFAULT_TENANT_ID;
      const found = INITIAL_TENANTS.find((t) => t.id === candidateId);
      if (found) {
        return { ...found, userRole: 'owner', isMember: true };
      }
    } catch {}
    return { ...INITIAL_TENANTS[0], userRole: 'owner', isMember: true };
  });

  const [isLoading, setIsLoading] = useState(false);

  // Sync cookies & API client tenantId with active community
  const syncActiveCommunity = useCallback((comm: JoinedCommunity) => {
    setActiveCommunity(comm);
    api.setTenantId(comm.id);
    try {
      localStorage.setItem('active_community_id', comm.id);
      localStorage.setItem('x-tenant-id', comm.id);
    } catch {}
    document.cookie = `active_community_id=${comm.id}; path=/; max-age=2592000`;
    document.cookie = `x-tenant-id=${comm.id}; path=/; max-age=2592000`;
    if (comm.userRole) {
      document.cookie = `syncly_role=${comm.userRole}; path=/; max-age=2592000`;
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

  useEffect(() => {
    refreshMemberships();
  }, [refreshMemberships]);

  const switchCommunity = useCallback((communityId: string) => {
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
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
