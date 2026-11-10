'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/lib/context/WorkspaceContext.tsx';
import { useTenant } from '@/lib/context/AuthContext.tsx';

interface Community {
  id: string;
  name: string;
  slug: string;
  description?: string;
  industry?: string;
  members_count: number;
}

export default function ExploreCommunitiesPage() {
  const router = useRouter();
  const { allCommunities, joinedCommunities, activeCommunity, switchCommunity } = useWorkspace();
  const { activeTenant } = useTenant();

  const [searchQuery, setSearchQuery] = useState('');
  const [switchError, setSwitchError] = useState<string | null>(null);

  // Map real database workspaces
  const initialCommunities: Community[] = useMemo(() => {
    return (allCommunities || []).map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.tagline || (t as any).description || 'Corporate Workspace',
      industry: (t as any).industry || 'General',
      members_count: (t as any).memberCount || (t as any).members_count || 1,
    }));
  }, [allCommunities]);

  const activeWorkspaceId = activeTenant?.id || activeCommunity?.id || '';
  const joinedIds = useMemo(() => new Set(joinedCommunities.map(c => c.id)), [joinedCommunities]);

  const handleSelectWorkspace = async (community: Community) => {
    setSwitchError(null);
    const result = await switchCommunity(community.id);
    if (result.success) {
      router.push('/feed');
    } else {
      setSwitchError(result.error || 'Failed to switch workspace. Verified membership required.');
    }
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
      {switchError && (
        <div className="p-3.5 bg-rose-950/20 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center justify-between">
          <span>{switchError}</span>
          <button 
            type="button" 
            onClick={() => setSwitchError(null)} 
            className="text-rose-400 hover:text-rose-200 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

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
          {filteredCommunities.map((community) => {
            const isCurrent = community.id === activeWorkspaceId;
            const isEnrolled = joinedIds.has(community.id);

            return (
              <div
                key={community.id}
                className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-zinc-100 text-base">{community.name}</h3>
                    {community.industry && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-medium">
                        {community.industry}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 line-clamp-2 mb-4 leading-relaxed">
                    {community.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-800/60">
                  <span className="text-xs text-zinc-500 font-medium">
                    {community.members_count} {community.members_count === 1 ? 'member' : 'members'}
                  </span>
                  {isCurrent ? (
                    <span className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      Active Workspace
                    </span>
                  ) : isEnrolled ? (
                    <button
                      onClick={() => handleSelectWorkspace(community)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
                    >
                      Switch to Workspace
                    </button>
                  ) : (
                    <span className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 font-medium">
                      Not Enrolled
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
