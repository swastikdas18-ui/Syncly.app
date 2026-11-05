'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/lib/context/WorkspaceContext.tsx';
import { useAuth } from '@/lib/context/AuthContext.tsx';
import { Search, Hash, MessageSquare, Calendar, Building2, ExternalLink } from 'lucide-react';

export default function GlobalSearchPage() {
  const router = useRouter();
  const { activeCommunity, joinedCommunities, allCommunities } = useWorkspace();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'workspaces' | 'channels' | 'events'>('all');

  const defaultChannels = [
    { id: 'general', name: 'general', description: 'Company-wide updates and announcements' },
    { id: 'engineering', name: 'engineering', description: 'Tech discussions, architecture and PRs' },
    { id: 'random', name: 'random', description: 'Watercooler discussions, coffee chats and hobbies' },
  ];

  const defaultEvents = [
    { id: 'event-1', title: 'Q1 All-Hands & Product Roadmap', time: 'Tomorrow at 10:00 AM', category: 'All-Hands' },
    { id: 'event-2', title: 'AI Engineering Architecture Sync', time: 'Thursday at 2:00 PM', category: 'Tech Talk' },
    { id: 'event-3', title: 'Intern Cohort Onboarding & Mentorship', time: 'Friday at 11:00 AM', category: 'Workshop' },
  ];

  // Filter workspaces
  const filteredWorkspaces = useMemo(() => {
    const list = allCommunities.length > 0 ? allCommunities : joinedCommunities;
    if (!query.trim()) return list;
    const term = query.toLowerCase().trim();
    return list.filter(
      (w) =>
        w.name.toLowerCase().includes(term) ||
        w.slug.toLowerCase().includes(term) ||
        (w.industry && w.industry.toLowerCase().includes(term))
    );
  }, [allCommunities, joinedCommunities, query]);

  // Filter channels
  const filteredChannels = useMemo(() => {
    if (!query.trim()) return defaultChannels;
    const term = query.toLowerCase().trim();
    return defaultChannels.filter(
      (c) => c.name.toLowerCase().includes(term) || c.description.toLowerCase().includes(term)
    );
  }, [defaultChannels, query]);

  // Filter events
  const filteredEvents = useMemo(() => {
    if (!query.trim()) return defaultEvents;
    const term = query.toLowerCase().trim();
    return defaultEvents.filter(
      (e) => e.title.toLowerCase().includes(term) || e.category.toLowerCase().includes(term)
    );
  }, [defaultEvents, query]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Global Directory &amp; Search</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Search across workspaces, team channels, and upcoming sessions in {activeCommunity?.name || 'Syncly'}
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search workspaces, channels, updates, and events..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Search result tabs: All, Workspaces, Channels, Events */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        {(['all', 'workspaces', 'channels', 'events'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
              activeTab === tab
                ? 'bg-indigo-600 text-white'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Results content */}
      <div className="space-y-6">
        {/* Workspaces Section */}
        {(activeTab === 'all' || activeTab === 'workspaces') && (
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span>Workspaces ({filteredWorkspaces.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredWorkspaces.map((ws) => (
                <div
                  key={ws.id}
                  onClick={() => router.push('/communities/explore')}
                  className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-zinc-100 group-hover:text-indigo-400 transition-colors">
                      {ws.name}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
                  </div>
                  <div className="text-xs text-zinc-500 font-mono mt-1">@{ws.slug}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Channels Section */}
        {(activeTab === 'all' || activeTab === 'channels') && (
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Hash className="w-4 h-4 text-blue-400" />
              <span>Channels ({filteredChannels.length})</span>
            </div>
            <div className="space-y-2">
              {filteredChannels.map((ch) => (
                <div
                  key={ch.id}
                  onClick={() => router.push(`/channels/${ch.id}`)}
                  className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 cursor-pointer flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-zinc-400 group-hover:text-indigo-400" />
                    <div>
                      <span className="text-sm font-semibold text-zinc-100 group-hover:text-indigo-400 transition-colors">
                        {ch.name}
                      </span>
                      <p className="text-xs text-zinc-400 mt-0.5">{ch.description}</p>
                    </div>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono group-hover:text-zinc-300">Open #</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Events Section */}
        {(activeTab === 'all' || activeTab === 'events') && (
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>Upcoming Events ({filteredEvents.length})</span>
            </div>
            <div className="space-y-2">
              {filteredEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => router.push('/events')}
                  className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 cursor-pointer flex items-center justify-between group transition-all"
                >
                  <div>
                    <span className="text-sm font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors">
                      {ev.title}
                    </span>
                    <div className="text-xs text-zinc-400 mt-0.5 flex items-center gap-2">
                      <span>{ev.time}</span>
                      <span>•</span>
                      <span className="text-emerald-400/90 font-mono text-[11px]">{ev.category}</span>
                    </div>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono group-hover:text-zinc-300">View Agenda</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
