'use client';

import React from 'react';
import { EventAgenda } from '@/components/community/EventAgenda.tsx';
import { useTenant } from '@/lib/context/AuthContext.tsx';

export default function EventsDashboardPage() {
  const { activeTenant } = useTenant();

  const tenantModel: any = {
    id: activeTenant?.id || '00000000-0000-0000-0000-000000000001',
    name: activeTenant?.name || 'Acme Corporation',
    slug: activeTenant?.slug || 'acme-corp',
    createdAt: activeTenant?.created_at || new Date().toISOString(),
    tagline: 'Enterprise Workspace',
    memberCount: 1,
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      <EventAgenda currentTenant={tenantModel} />
    </div>
  );
}
