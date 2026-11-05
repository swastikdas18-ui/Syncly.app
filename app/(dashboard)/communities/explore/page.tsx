'use client';

import React, { useState, useMemo } from 'react';

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
  const [searchQuery, setSearchQuery] = useState('');

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
            <div key={community.id} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
              <h3 className="font-semibold text-zinc-100">{community.name}</h3>
              <p className="text-xs text-zinc-400 mt-1">{community.description}</p>
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
