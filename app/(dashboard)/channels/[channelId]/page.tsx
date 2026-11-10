'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChatWindow } from '@/components/community/ChatWindow.tsx';
import { useTenant } from '@/lib/context/AuthContext.tsx';
import { useWorkspace } from '@/lib/context/WorkspaceContext.tsx';
import { Channel } from '@/src/types.ts';
import { api } from '@/src/lib/api.ts';
import { DEFAULT_PUBLIC_CHANNELS } from '@/lib/api/channels.ts';
import { Building2, Compass, PlusCircle } from 'lucide-react';

export default function ChannelDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const channelId = (params?.channelId as string) || 'general';
  const { activeTenant } = useTenant();
  const { activeCommunity, isLoading: isWorkspaceLoading } = useWorkspace();

  const [channels, setChannels] = useState<Channel[]>(DEFAULT_PUBLIC_CHANNELS);
  const [activeChannel, setActiveChannel] = useState<string>(channelId);

  const verifiedWorkspace = activeCommunity || activeTenant;
  const hasMembership = Boolean(verifiedWorkspace?.id);

  useEffect(() => {
    async function loadChannels() {
      if (!verifiedWorkspace?.id) {
        setChannels([]);
        return;
      }

      try {
        const data = await api.getChannels();
        if (data && data.length > 0) {
          setChannels(data);
        } else {
          setChannels(DEFAULT_PUBLIC_CHANNELS);
        }
      } catch {
        setChannels(DEFAULT_PUBLIC_CHANNELS);
      }
    }
    loadChannels();
  }, [verifiedWorkspace?.id]);

  useEffect(() => {
    if (channelId) {
      setActiveChannel(channelId);
    }
  }, [channelId]);

  if (!hasMembership && !isWorkspaceLoading) {
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
        onChannelCreated={(newChan) => setChannels((prev) => [...prev, newChan])}
        activeTenant={tenantModel}
      />
    </div>
  );
}
