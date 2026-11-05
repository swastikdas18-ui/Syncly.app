'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace, DEFAULT_WORKSPACE } from '@/lib/context/WorkspaceContext.tsx';
import { useTenant } from '@/lib/context/AuthContext.tsx';

interface Community {
  id: string;
  name: string;
  slug: string;
  description?: string;
  industry?: string;
  members_count: number;
}

const DEFAULT_COMMUNITIES: Community[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Acme Enterprise Tech',
    slug: 'acme-tech',
    description: 'Corporate engineering, platform operations, and enterprise architecture hub.',
    industry: 'Technology',
    members_count: 142,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Globex Digital Services',
    slug: 'globex-digital',
    description: 'Cloud systems consulting, digital innovation, and agile workflow management.',
    industry: 'Consulting',
    members_count: 89,
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Nexus Cloud Infrastructure',
    slug: 'nexus-cloud',
    description: 'Distributed infrastructure, Kubernetes clusters, and multi-cloud systems.',
    industry: 'Infrastructure',
    members_count: 215,
  },
];

export function ExploreCommunitiesView({ initialCommunities = DEFAULT_COMMUNITIES }: { initialCommunities?: Community[] }) {
  const router = useRouter();
  const { activeCommunity, switchCommunity } = useWorkspace();
  const { activeTenant, setActiveTenant } = useTenant();
  const [searchQuery, setSearchQuery] = useState('');

  const activeWorkspaceId = activeTenant?.id || activeCommunity?.id || DEFAULT_WORKSPACE.id;

  const handleSwitchOrJoin = (community: Community) => {
    // 1. Update Contexts
    switchCommunity(community.id);
    setActiveTenant({
      id: community.id,
      name: community.name,
      slug: community.slug,
      created_at: new Date().toISOString(),
    });

    // 2. Set Cookies and LocalStorage
    localStorage.setItem('active_tenant_id', community.id);
    localStorage.setItem('active_community_id', community.id);
    localStorage.setItem('x-tenant-id', community.id);
    localStorage.setItem(
      'syncly_workspace',
      JSON.stringify({
        id: community.id,
        name: community.name,
        slug: community.slug,
        role: 'member',
      })
    );
    document.cookie = `active_tenant_id=${community.id}; path=/; max-age=86400; SameSite=Lax`;
    document.cookie = `active_community_id=${community.id}; path=/; max-age=86400; SameSite=Lax`;
    document.cookie = `x-tenant-id=${community.id}; path=/; max-age=86400; SameSite=Lax`;

    window.dispatchEvent(new Event('workspace-changed'));

    // 3. Route to /feed under chosen workspace
    router.push('/feed');
  };

  const filteredCommunities = useMemo(() => {
    if (!searchQuery.trim()) return initialCommunities;
    const term = searchQuery.toLowerCase().trim();
    return initialCommunities.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.slug.toLowerCase().includes(term) ||
        (c.description && c.description.toLowerCase().includes(term)) ||
        (c.industry && c.industry.toLowerCase().includes(term))
    );
  }, [initialCommunities, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by company name, industry, or domain..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {filteredCommunities.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 text-sm">
          No communities found matching &ldquo;{searchQuery}&rdquo;.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCommunities.map((community) => (
            <div key={community.id} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-zinc-100">{community.name}</h3>
                <p className="text-xs text-zinc-400 mt-1">{community.description}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-xs text-zinc-500 font-mono">@{community.slug}</span>
                {community.id === activeWorkspaceId ? (
                  <span className="px-3 py-1 rounded-lg bg-zinc-800 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                    Current Workspace
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSwitchOrJoin(community)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors cursor-pointer"
                  >
                    Enter Workspace
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ExploreCommunitiesPage() {
  return (
    <div className="w-full max-w-4xl mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Explore Communities</h1>
        <p className="text-sm text-zinc-400 mt-1">Discover and join verified corporate workspaces</p>
      </div>
      <ExploreCommunitiesView />
    </div>
  );
}

