'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChatWindow } from '@/components/community/ChatWindow.tsx';
import { useTenant } from '@/lib/context/AuthContext.tsx';
import { useWorkspace } from '@/lib/context/WorkspaceContext.tsx';
import { Channel } from '@/src/types.ts';
import { api } from '@/src/lib/api.ts';
import { Building2, Compass, PlusCircle, AlertCircle, RefreshCw, MessageSquare, ShieldAlert, Lock, Loader2 } from 'lucide-react';

export default function ChannelDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const channelId = (params?.channelId as string) || '';
  const { activeTenant, membershipStatus: authMemStatus, membershipError: authMemError, retryMembershipFetch } = useTenant();
  const { activeCommunity, isLoading: isWorkspaceLoading, membershipStatus: wsMemStatus, membershipError: wsMemError, refreshMemberships } = useWorkspace();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<string>(channelId);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<{ message: string; statusCode: number } | null>(null);

  const verifiedWorkspace = activeCommunity || activeTenant;
  const hasMembership = Boolean(verifiedWorkspace?.id);

  // Unified Membership Status across Auth & Workspace contexts
  const isMembershipLoading = authMemStatus === 'loading' || wsMemStatus === 'loading' || isWorkspaceLoading;
  const isMembershipError = authMemStatus === 'error' || wsMemStatus === 'error';
  const membershipErrorMessage = authMemError || wsMemError || 'Failed to query workspace memberships.';

  const handleRetryAll = async () => {
    if (retryMembershipFetch) await retryMembershipFetch();
    if (refreshMemberships) await refreshMemberships();
    await loadChannels();
  };

  const loadChannels = async () => {
    if (!verifiedWorkspace?.id) {
      setChannels([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const res = await api.getChannels();
      if (res.status === 'success') {
        setChannels(res.data);
        if (res.data.length > 0 && !activeChannel) {
          setActiveChannel(res.data[0].id);
        }
      } else if (res.status === 'empty') {
        setChannels([]);
      } else if (res.status === 'unauthorized') {
        setLoadError({ message: res.error || 'Authentication required.', statusCode: 401 });
        setChannels([]);
      } else if (res.status === 'forbidden') {
        setLoadError({ message: res.error || 'Access to channels in this workspace is restricted.', statusCode: 403 });
        setChannels([]);
      } else {
        setLoadError({ message: res.error || 'Failed to load channels for this workspace.', statusCode: res.statusCode || 500 });
        setChannels([]);
      }
    } catch (err: any) {
      console.error('[ChannelsPage] Failed to fetch channels:', err);
      setLoadError({ message: err?.message || 'Network connection failed.', statusCode: 0 });
      setChannels([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hasMembership) {
      loadChannels();
    } else {
      setIsLoading(false);
    }
  }, [verifiedWorkspace?.id, hasMembership]);

  useEffect(() => {
    if (channelId) {
      setActiveChannel(channelId);
    }
  }, [channelId]);

  // 1. Loading State (Context or Channel Fetching)
  if (isMembershipLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 space-y-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-xs text-slate-400 font-medium">Verifying workspace membership...</p>
      </div>
    );
  }

  // 2. Membership Query Error State (NEVER falsely state "Zero Memberships")
  if (isMembershipError && !hasMembership) {
    return (
      <div className="max-w-md mx-auto my-14 p-6 rounded-2xl bg-rose-950/20 border border-rose-500/30 text-center space-y-4 animate-in fade-in duration-200">
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-rose-200">Membership Query Error</h3>
          <p className="text-xs text-rose-300/80 leading-relaxed">{membershipErrorMessage}</p>
        </div>
        <button
          type="button"
          onClick={handleRetryAll}
          className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs inline-flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Membership Check</span>
        </button>
      </div>
    );
  }

  // 3. Legitimate Zero-Membership Onboarding View
  if (!hasMembership) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-5 animate-in fade-in duration-200">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto shadow-md">
          <Building2 className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            You are not currently a member of any workspace.
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
            Channel discussions and messages are private to verified organization members. Join a workspace to start chatting.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push('/communities/explore')}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <Compass className="w-4 h-4" />
            <span>Explore Workspaces</span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/communities/new')}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-indigo-400" />
            <span>Create Workspace</span>
          </button>
        </div>
      </div>
    );
  }

  // 4. HTTP 401 Unauthorized State
  if (loadError && loadError.statusCode === 401) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-amber-200">Authentication Required</h3>
          <p className="text-xs text-amber-300/80">{loadError.message}</p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium inline-flex items-center gap-2 transition-colors cursor-pointer"
        >
          <span>Sign In</span>
        </button>
      </div>
    );
  }

  // 5. HTTP 403 Forbidden / Access-Restricted State
  if (loadError && loadError.statusCode === 403) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6 text-amber-400" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-200">Access Restricted</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">{loadError.message}</p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/communities/explore')}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium inline-flex items-center gap-2 transition-colors cursor-pointer"
        >
          <span>Explore Other Workspaces</span>
        </button>
      </div>
    );
  }

  // 6. HTTP 500 / Network Error State with Retry Button
  if (loadError) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-2xl bg-rose-950/20 border border-rose-500/30 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-rose-200">Failed to load channels</h3>
          <p className="text-xs text-rose-300/80">{loadError.message}</p>
        </div>
        <button
          type="button"
          onClick={loadChannels}
          className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium inline-flex items-center gap-2 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  // 7. Empty State when workspace has no channels created yet (HTTP 200 with 0 channels)
  if (!isLoading && channels.length === 0) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 text-center space-y-4 border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
          <MessageSquare className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-200">No Channels Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            This workspace does not have any discussion channels yet. Create the first channel to begin chatting with your team.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            const newChan = await api.createChannel({
              name: 'general',
              description: 'Company-wide updates & watercooler',
              isPrivate: false,
            });
            if (newChan) {
              setChannels([newChan]);
              setActiveChannel(newChan.id);
            }
          }}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium inline-flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create #general Channel</span>
        </button>
      </div>
    );
  }

  const tenantModel: any = verifiedWorkspace ? {
    id: verifiedWorkspace.id,
    name: verifiedWorkspace.name,
    slug: verifiedWorkspace.slug,
    createdAt: (verifiedWorkspace as any).created_at || (verifiedWorkspace as any).createdAt || new Date().toISOString(),
    tagline: (verifiedWorkspace as any).tagline || 'Enterprise Workspace',
    memberCount: (verifiedWorkspace as any).memberCount || 1,
  } : null;

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] md:h-[calc(100vh-5rem)] bg-zinc-950">
      <ChatWindow
        channels={channels}
        activeChannelId={activeChannel}
        onSelectChannel={setActiveChannel}
        onChannelCreated={(newChan) => {
          setChannels((prev) => [...prev, newChan]);
          setActiveChannel(newChan.id);
        }}
        activeTenant={tenantModel}
      />
    </div>
  );
}
