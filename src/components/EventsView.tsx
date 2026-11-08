'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, MapPin, Users, CheckCircle, Plus, 
  Sparkles, Search, Loader2
} from 'lucide-react';
import { EventItem, Tenant } from '../types.ts';

interface EventsViewProps {
  currentTenant: Tenant;
}

export function EventsView({ currentTenant }: EventsViewProps) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCalendarSynced, setIsCalendarSynced] = useState(false);

  useEffect(() => {
    let isSubscribed = true;
    setIsLoading(true);

    fetch('/api/events', {
      headers: {
        'x-tenant-id': currentTenant.id,
      },
    })
      .then((res) => res.json())
      .then((payload) => {
        if (isSubscribed) {
          setEvents(payload.data || []);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isSubscribed) {
          setEvents([]);
          setIsLoading(false);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [currentTenant.id]);

  // Filter events by tenant isolation and search query
  const tenantEvents = events.filter((e) => {
    const tenantMatches = e.tenantId === currentTenant.id;
    const filterMatches = selectedFilter === 'all' || e.category === selectedFilter;
    const queryMatches = !searchQuery.trim() || 
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.hostName.toLowerCase().includes(searchQuery.toLowerCase());
    return tenantMatches && filterMatches && queryMatches;
  });

  const handleToggleRsvp = (eventId: string) => {
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id === eventId) {
          const nextRsvped = !ev.hasRsvped;
          return {
            ...ev,
            hasRsvped: nextRsvped,
            rsvpCount: nextRsvped ? ev.rsvpCount + 1 : Math.max(0, ev.rsvpCount - 1),
          };
        }
        return ev;
      })
    );
  };

  const handleSyncCalendar = () => {
    setIsCalendarSynced(true);
    setTimeout(() => setIsCalendarSynced(false), 3000);
  };

  const getCategoryBadge = (cat: EventItem['category']) => {
    switch (cat) {
      case 'workshop':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">Workshop</span>;
      case 'techtalk':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-blue-500/10 text-indigo-400 border border-blue-500/20">Tech Talk</span>;
      case 'all-hands':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">All-Hands</span>;
      case 'social':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Social</span>;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
            {/* PREVIEW NOTICE BANNER */}
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/30 p-3.5 text-xs text-indigo-300 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span><strong>Feature Preview:</strong> Events and workshop schedules are currently in read-only discovery. Full persistent RSVP and calendar sync will arrive in Syncly v0.2.0.</span>
        </div>
      </div>

      {/* Top Banner */}
      <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-blue-950/40 border border-slate-800 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Workshops, Talks &amp; RSVPs</h2>
            </div>
            <p className="text-xs text-slate-400">
              Company-wide learning sessions, sprint demos, and social hours isolated for <span className="text-slate-200 font-medium">{currentTenant.name}</span>.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button 
              type="button"
              onClick={handleSyncCalendar}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 cursor-pointer ${
                isCalendarSynced 
                  ? 'bg-emerald-900/60 border border-emerald-500/50 text-emerald-300' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{isCalendarSynced ? 'Synced to Calendar' : 'Sync to Calendar'}</span>
            </button>
          </div>
        </div>

        {/* Search & Filter pills */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-64 md:w-80 flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search talks, workshops, hosts..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950/80 border border-slate-800 rounded-xl text-slate-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {['all', 'techtalk', 'workshop', 'all-hands', 'social'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedFilter(cat)}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors capitalize whitespace-nowrap cursor-pointer ${
                  selectedFilter === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-zinc-850'
                }`}
              >
                {cat === 'techtalk' ? 'Tech Talk' : cat === 'all-hands' ? 'All-Hands' : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/60 text-slate-400 flex flex-col items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mb-2" />
            <span className="text-xs">Loading scheduled events...</span>
          </div>
        ) : tenantEvents.length === 0 ? (
          /* Exact required empty state from Step 3 */
          <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/60 text-slate-400">
            <Calendar className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
            <div className="text-sm font-semibold text-slate-300">No upcoming workshops or tech talks scheduled.</div>
            <div className="text-xs text-slate-500 mt-1">Check back soon for new team sessions, tech talks, and roadmaps.</div>
          </div>
        ) : (
          tenantEvents.map((event) => (
            <div
              key={event.id}
              className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-zinc-700/80 transition-all shadow-md group"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {getCategoryBadge(event.category)}
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {event.date} • {event.time}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {event.location}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-slate-100 group-hover:text-indigo-400 transition-colors">
                    {event.title}
                  </h3>

                  <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                    {event.description}
                  </p>

                  <div className="pt-2 flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      Host: <strong className="text-slate-200 font-medium">{event.hostName}</strong> ({event.hostRole})
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      <strong className="text-slate-200">{event.rsvpCount}</strong> attending
                    </span>
                  </div>
                </div>

                {/* RSVP Action */}
                <div className="flex md:flex-col items-center md:items-end justify-between gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => handleToggleRsvp(event.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 shadow-sm ${
                      event.hasRsvped
                        ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600/30'
                        : 'bg-indigo-600 text-white hover:bg-blue-500 shadow-blue-500/20'
                    }`}
                  >
                    {event.hasRsvped ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        RSVP Confirmed
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        RSVP to Attend
                      </>
                    )}
                  </button>

                  <span className="text-[11px] text-slate-500">
                    {event.hasRsvped ? 'Added to your calendar' : 'Free company event'}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default EventsView;
