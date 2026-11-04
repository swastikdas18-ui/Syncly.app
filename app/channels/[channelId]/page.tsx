'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { ChannelChat } from '@/src/components/ChannelChat.tsx';
import { INITIAL_TENANTS } from '@/src/lib/tenantContext.ts';
import { Channel } from '@/src/types.ts';

const SAMPLE_CHANNELS: Channel[] = [
  { id: 'general', tenantId: INITIAL_TENANTS[0].id, name: 'general', description: 'Company-wide updates & general watercooler', isPrivate: false, createdAt: '2026-01-15' },
  { id: 'engineering', tenantId: INITIAL_TENANTS[0].id, name: 'engineering', description: 'Sprint reviews, architectural RFCs & deployments', isPrivate: false, createdAt: '2026-01-15' },
  { id: 'announcements', tenantId: INITIAL_TENANTS[0].id, name: 'announcements', description: 'Executive broadcasts and corporate notices', isPrivate: true, createdAt: '2026-01-15' },
];

/**
 * Next.js App Router Dynamic Channel Route: /channels/[channelId]
 */
export default function ChannelPage() {
  const params = useParams();
  const channelId = typeof params?.channelId === 'string' ? params.channelId : 'general';

  return (
    <div className="h-screen bg-slate-950 p-4">
      <ChannelChat
        activeTenant={INITIAL_TENANTS[0]}
        channels={SAMPLE_CHANNELS}
        activeChannelId={channelId}
        onSelectChannel={() => {}}
        onChannelCreated={() => {}}
      />
    </div>
  );
}
