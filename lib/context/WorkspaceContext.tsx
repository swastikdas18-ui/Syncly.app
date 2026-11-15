'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Tenant, PresenceUser } from '@/src/types.ts';
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
  presenceUsers: PresenceUser[];
  presenceConnectionState: 'connecting' | 'connected' | 'error';
  myPresenceStatus: PresenceUser['status'];
  updateMyPresence: (status: PresenceUser['status'], currentChannelName?: string | null) => void;
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

  // Workspace-wide presence: remains connected while a user browses any dashboard page.
  const [workspaceMembers, setWorkspaceMembers] = useState<PresenceUser[]>([]);
  const [livePresence, setLivePresence] = useState<Record<string, PresenceUser>>({});
  const [presenceConnectionState, setPresenceConnectionState] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [myPresenceStatus, setMyPresenceStatus] = useState<PresenceUser['status']>('online');
  const [myPresenceChannelName, setMyPresenceChannelName] = useState<string | null>(null);
  const [presenceUserId, setPresenceUserId] = useState<string | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const presenceConnectedRef = useRef(false);
  const presenceBaseRef = useRef<{ userId: string; fullName: string; role: string; tenantId: string } | null>(null);

  const updateMyPresence = useCallback((
    status: PresenceUser['status'],
    currentChannelName?: string | null
  ) => {
    setMyPresenceStatus(status);
    setMyPresenceChannelName(currentChannelName || null);
  }, []);

  const presenceUsers: PresenceUser[] = workspaceMembers.map((member) => {
    const live = livePresence[member.id];
    const isSelf = member.id === presenceUserId;
    return {
      ...member,
      fullName: isSelf ? `${member.fullName.replace(/\s*\(You\)$/, '')} (You)` : member.fullName,
      status: live?.status || 'offline',
      currentChannelId: live?.currentChannelId,
      lastSeen: live?.lastSeen || 'offline',
    };
  });

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
        window.dispatchEvent(new CustomEvent('workspace-changed', { detail: { tenantId: null } }));
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
      window.dispatchEvent(new CustomEvent('workspace-changed', { detail: { tenantId: comm.id } }));
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

      // If the server endpoint reports an empty/error result, re-check the caller's own
      // memberships directly through the authenticated browser client. RLS still limits
      // this query to memberships visible to the signed-in user.
      let resolvedMembershipResult = memResult;
      if (memResult.status === 'empty' || memResult.status === 'error') {
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          const currentUserId = currentSession?.user?.id;
          if (currentUserId) {
            const { data: directMemberships, error: directMembershipError } = await supabase
              .from('memberships')
              .select('id, user_id, community_id, role, joined_at')
              .eq('user_id', currentUserId);

            if (!directMembershipError) {
              const verifiedRows = (directMemberships || []) as unknown as any[];
              resolvedMembershipResult = {
                status: verifiedRows.length > 0 ? 'success' : 'empty',
                data: verifiedRows,
                statusCode: 200,
              };
            } else {
              console.warn('[WorkspaceContext] Direct membership fallback failed:', directMembershipError);
            }
          }
        } catch (fallbackError) {
          console.warn('[WorkspaceContext] Direct membership fallback threw:', fallbackError);
        }
      }

      // Handle structured membership result
      if (resolvedMembershipResult.status === 'success') {
        const enrichedJoined: JoinedCommunity[] = resolvedMembershipResult.data.map((m: any) => ({
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
      } else if (resolvedMembershipResult.status === 'empty') {
        // Authenticated user holds 0 memberships (legitimate empty state)
        setJoinedCommunities([]);
        setMembershipStatus('empty');
        syncActiveCommunity(null);
      } else if (resolvedMembershipResult.status === 'unauthorized') {
        setJoinedCommunities([]);
        setMembershipStatus('unauthorized');
        setMembershipError(resolvedMembershipResult.error || 'Authentication required.');
        syncActiveCommunity(null);
      } else if (resolvedMembershipResult.status === 'forbidden') {
        setJoinedCommunities([]);
        setMembershipStatus('forbidden');
        setMembershipError(resolvedMembershipResult.error || 'Access forbidden.');
        syncActiveCommunity(null);
      } else {
        // Error state: server or network failure (DO NOT treat as empty / zero memberships)
        setMembershipStatus('error');
        setMembershipError(resolvedMembershipResult.error || 'Failed to load memberships.');
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

  // Maintain a private Realtime Presence channel for the entire active workspace,
  // not just while the user is viewing the Chat page.
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const startWorkspacePresence = async () => {
      const tenantId = activeCommunity?.id;
      if (!tenantId) {
        setMyPresenceChannelName(null);
        setWorkspaceMembers([]);
        setLivePresence({});
        setPresenceUserId(null);
        setPresenceConnectionState('connecting');
        presenceBaseRef.current = null;
        return;
      }

      setMyPresenceChannelName(null);
      setPresenceConnectionState('connecting');
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!session?.user?.id) {
        setPresenceConnectionState('error');
        return;
      }

      const userId = session.user.id;
      const [rosterResult, profileResult] = await Promise.all([
        api.getWorkspaceMembers(tenantId),
        supabase.from('profiles').select('full_name, role').eq('id', userId).maybeSingle(),
      ]);
      if (cancelled) return;

      if (rosterResult.status === 'success') {
        const roster: PresenceUser[] = rosterResult.data.map((member: any) => {
          const fullName = member.name || 'Team Member';
          return {
            id: member.id,
            tenantId,
            fullName,
            role: member.role || 'member',
            initials: fullName.split(/\s+/).map((part: string) => part[0]).join('').slice(0, 2).toUpperCase() || 'TM',
            status: 'offline' as const,
            lastSeen: 'offline',
          };
        }).filter((member) => Boolean(member.id));
        setWorkspaceMembers(roster);
      } else {
        console.error('[WorkspacePresence] Failed to load tenant member roster:', rosterResult.error);
        setWorkspaceMembers([]);
      }

      const profileRow = profileResult.data as { full_name?: string | null } | null;
      const metadataName = session.user.user_metadata?.full_name;
      const fullName = profileRow?.full_name
        || (typeof metadataName === 'string' ? metadataName : null)
        || session.user.email?.split('@')[0]
        || 'Team Member';

      presenceBaseRef.current = {
        userId,
        fullName,
        role: activeCommunity?.userRole || 'member',
        tenantId,
      };
      setPresenceUserId(userId);

      channel = supabase.channel(`tenant:${tenantId}:presence`, {
        config: {
          presence: {
            key: `${userId}:${window.crypto.randomUUID()}`,
          },
        },
      });
      presenceChannelRef.current = channel;
      presenceConnectedRef.current = false;

      const syncPresence = () => {
        if (!channel) return;
        const state = channel.presenceState<{
          userId: string;
          fullName: string;
          role: string;
          status: PresenceUser['status'];
          currentChannelId: string | null;
          lastSeen: string;
        }>();

        const snapshot: Record<string, PresenceUser> = {};
        Object.values(state).flat().forEach((presence) => {
          if (!presence.userId) return;
          snapshot[presence.userId] = {
            id: presence.userId,
            tenantId,
            fullName: presence.fullName || 'Team Member',
            role: presence.role || 'member',
            initials: (presence.fullName || 'TM').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'TM',
            status: presence.status || 'online',
            currentChannelId: presence.currentChannelId || undefined,
            lastSeen: presence.lastSeen || new Date().toISOString(),
          };
        });
        setLivePresence(snapshot);
      };

      channel
        .on('presence', { event: 'sync' }, syncPresence)
        .on('presence', { event: 'join' }, syncPresence)
        .on('presence', { event: 'leave' }, syncPresence)
        .subscribe((status, error) => {
          if (status === 'SUBSCRIBED') {
            presenceConnectedRef.current = true;
            setPresenceConnectionState('connected');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            presenceConnectedRef.current = false;
            setPresenceConnectionState('error');
            console.error('[WorkspacePresence] Realtime subscription failed:', error);
          }
        });
    };

    void startWorkspacePresence();

    return () => {
      cancelled = true;
      presenceConnectedRef.current = false;
      if (channel && presenceChannelRef.current === channel) {
        presenceChannelRef.current = null;
      }
      if (channel) {
        void channel.untrack().catch(() => {});
        void supabase.removeChannel(channel);
      }
      setLivePresence({});
    };
  }, [activeCommunity?.id, activeCommunity?.userRole]);

  // Publish presence after the subscription is ready, and update it when the
  // user changes their status or moves between chat channels.
  useEffect(() => {
    const channel = presenceChannelRef.current;
    const base = presenceBaseRef.current;
    if (!channel || !base || !presenceConnectedRef.current) return;

    void channel.track({
      ...base,
      status: myPresenceStatus,
      currentChannelId: myPresenceChannelName,
      lastSeen: new Date().toISOString(),
    }).then((trackStatus) => {
      if (trackStatus !== 'ok') {
        console.error('[WorkspacePresence] Presence update failed:', trackStatus);
      }
    });
  }, [myPresenceStatus, myPresenceChannelName, presenceConnectionState]);

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
    // The join API returns tenantId (not a nested tenant object). Refresh for every
    // joined response, including HTTP 409 "already a member", so stale UI state is repaired.
    if (res.status === 'joined') {
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
        presenceUsers,
        presenceConnectionState,
        myPresenceStatus,
        updateMyPresence,
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
      presenceUsers: [],
      presenceConnectionState: 'error' as const,
      myPresenceStatus: 'online' as PresenceUser['status'],
      updateMyPresence: () => {},
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
