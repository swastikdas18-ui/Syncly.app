'use client';

import React from 'react';
import { EventAgenda } from '@/components/community/EventAgenda.tsx';
import { useTenant } from '@/lib/context/AuthContext.tsx';

export default function EventsDashboardPage() {
  const { activeTenant } = useTenant();

  if (!activeTenant) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-500 text-sm">
        No active workspace selected.
      </div>
    );
  }

  const tenantModel: any = activeTenant ? {
    id: activeTenant.id,
    name: activeTenant.name,
    slug: activeTenant.slug,
    createdAt: activeTenant.created_at,
    tagline: 'Enterprise Workspace',
    memberCount: 1,
  } : null;

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      <EventAgenda currentTenant={tenantModel} />
    </div>
  );
}
