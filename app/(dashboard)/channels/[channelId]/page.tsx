'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ChatWindow } from '@/components/community/ChatWindow.tsx';
import { useTenant } from '@/lib/context/AuthContext.tsx';
import { Channel } from '@/src/types.ts';
import { api } from '@/src/lib/api.ts';
import { DEFAULT_PUBLIC_CHANNELS } from '@/lib/api/channels.ts';

export default function ChannelDashboardPage() {
  const params = useParams();
  const channelId = (params?.channelId as string) || 'general';
  const { activeTenant } = useTenant();

  const [channels, setChannels] = useState<Channel[]>(DEFAULT_PUBLIC_CHANNELS);
  const [activeChannel, setActiveChannel] = useState<string>(channelId);

  useEffect(() => {
    async function loadChannels() {
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
  }, [activeTenant?.id]);

  useEffect(() => {
    if (channelId) {
      setActiveChannel(channelId);
    }
  }, [channelId]);

  const tenantModel: any = {
    id: activeTenant?.id || '00000000-0000-0000-0000-000000000001',
    name: activeTenant?.name || 'Acme Corporation',
    slug: activeTenant?.slug || 'acme-corp',
    createdAt: activeTenant?.created_at || new Date().toISOString(),
    tagline: 'Enterprise Workspace',
    memberCount: 1,
  };

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
