'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { EventAgenda } from '@/components/community/EventAgenda.tsx';
import { useTenant } from '@/lib/context/AuthContext.tsx';
import { useWorkspace } from '@/lib/context/WorkspaceContext.tsx';
import { Building2, Compass, PlusCircle } from 'lucide-react';

export default function EventsDashboardPage() {
  const router = useRouter();
  const { activeTenant } = useTenant();
  const { activeCommunity, isLoading: isWorkspaceLoading } = useWorkspace();

  const verifiedWorkspace = activeCommunity || activeTenant;
  const hasMembership = Boolean(verifiedWorkspace?.id);

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
            Events, all-hands, and meetings are hosted within workspaces. Join a workspace to view its schedule.
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
    <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      <EventAgenda currentTenant={tenantModel} />
    </div>
  );
}
