import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Building2, 
  Globe, 
  Lock, 
  Sparkles, 
  Users, 
  Check, 
  Clock, 
  ArrowRight, 
  Send, 
  CheckCircle2, 
  Plus, 
  SlidersHorizontal, 
  Layers, 
  KeyRound, 
  X, 
  Loader2,
  CheckSquare,
  Square
} from 'lucide-react';
import { Tenant, UserSession } from '../types.ts';
import { api } from '../lib/api.ts';

interface SearchCommunitiesViewProps {
  currentSession: UserSession | null;
  activeTenant: Tenant;
  onSelectTenant: (tenant: Tenant) => void;
  onOpenCreateModal: () => void;
  onShowToast: (msg: string) => void;
  onNavigateToFeed?: () => void;
}

type FilterChip = 'all' | 'my' | 'suggested' | 'technology' | 'consulting' | 'public';

const FILTER_CHIPS: Array<{ id: FilterChip; label: string; countHint?: string }> = [
  { id: 'all', label: 'All Communities' },
  { id: 'my', label: 'My Communities' },
  { id: 'suggested', label: 'Suggested (Domain Match)' },
  { id: 'technology', label: 'Technology' },
  { id: 'consulting', label: 'Consulting' },
  { id: 'public', label: 'Public & Open' },
];

export const SearchCommunitiesView: React.FC<SearchCommunitiesViewProps> = ({
  currentSession,
  activeTenant,
  onSelectTenant,
  onOpenCreateModal,
  onShowToast,
  onNavigateToFeed,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterChip>('all');
  const [communities, setCommunities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [callerDomain, setCallerDomain] = useState('');

  // Multi-selection batch join state
  const [selectedForBatch, setSelectedForBatch] = useState<string[]>([]);
  const [isBatchJoining, setIsBatchJoining] = useState(false);

  // Request Access Modal
  const [requestTarget, setRequestTarget] = useState<any | null>(null);
  const [requestNote, setRequestNote] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const userEmail = currentSession?.user?.email || 'sarah.chen@acmecorp.internal';
  const userName = currentSession?.user?.fullName || 'Team Member';
  const detectedDomain = userEmail.includes('@') ? userEmail.split('@')[1] : '';

  const loadData = async () => {
    setIsLoading(true);
    const res = await api.searchCommunities(searchQuery, activeFilter, userEmail);
    setCommunities(res.data || []);
    setCallerDomain(res.callerDomain || detectedDomain);
    setIsLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, activeFilter, userEmail]);

  // Enter Workspace Action
  const handleEnterWorkspace = (community: any) => {
    onSelectTenant(community);
    onShowToast(`Active workspace switched to ${community.name}`);
    if (onNavigateToFeed) {
      onNavigateToFeed();
    }
  };

  // Instant Join
  const handleInstantJoin = async (community: any) => {
    const res = await api.joinCommunity(community.id, {
      userEmail,
      userName,
    });

    if (res.status === 'joined' && res.tenant) {
      onSelectTenant(res.tenant);
      onShowToast(`🎉 Joined ${res.tenant.name}! Instant corporate domain match verified.`);
      loadData();
    } else if (res.status === 'pending') {
      onShowToast(`Join request submitted to ${community.name} for review.`);
      loadData();
    } else {
      onShowToast(res.message);
    }
  };

  // Submit Join Request with note
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestTarget) return;

    setIsSubmittingRequest(true);
    const res = await api.joinCommunity(requestTarget.id, {
      userEmail,
      userName,
      message: requestNote,
    });
    setIsSubmittingRequest(false);

    if (res.status === 'pending') {
      onShowToast(`Request sent to ${requestTarget.name} administrators.`);
      setRequestTarget(null);
      setRequestNote('');
      loadData();
    } else if (res.status === 'joined' && res.tenant) {
      onSelectTenant(res.tenant);
      onShowToast(`Joined ${res.tenant.name}!`);
      setRequestTarget(null);
      loadData();
    } else {
      onShowToast(res.message);
    }
  };

  // Batch join toggle
  const toggleSelectForBatch = (communityId: string) => {
    setSelectedForBatch((prev) =>
      prev.includes(communityId) ? prev.filter((id) => id !== communityId) : [...prev, communityId]
    );
  };

  // Execute Batch Join
  const handleExecuteBatchJoin = async () => {
    if (selectedForBatch.length === 0) return;
    setIsBatchJoining(true);
    const res = await api.batchJoinCommunities(selectedForBatch);
    setIsBatchJoining(false);

    if (res.success) {
      onShowToast(`🎉 ${res.message}`);
      setSelectedForBatch([]);
      loadData();
    } else {
      onShowToast(res.message || 'Batch join failed.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* SEARCH BANNER & TOP BAR */}
      <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-zinc-900 to-blue-950 text-white p-6 sm:p-8 overflow-hidden shadow-xl border border-zinc-800">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Multi-Membership Community Platform</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Discover &amp; Join Organizations
          </h1>
          <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed max-w-2xl">
            Belong to multiple company workspaces and project hubs at once. Easily search, join, or request access, and switch context seamlessly without cross-tenant bleed.
          </p>

          {/* Active Identity Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-xs text-xs font-mono text-zinc-200 border border-white/10">
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span>Your Identity: </span>
            <span className="font-bold text-white">{userEmail}</span>
            {detectedDomain && (
              <span className="px-1.5 py-0.5 rounded bg-blue-500/30 text-blue-200 text-[11px]">
                @{detectedDomain}
              </span>
            )}
          </div>

          {/* Search Input & Action Button */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search across all organizations, domains (@stripe.com), industries, or keywords..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/10 text-white placeholder-zinc-400 border border-white/15 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white/15 text-xs sm:text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onOpenCreateModal}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create Workspace</span>
            </button>
          </div>
        </div>
      </div>

      {/* FILTER CHIPS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
        <span className="text-slate-400 font-medium shrink-0 flex items-center gap-1">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filters:</span>
        </span>
        {FILTER_CHIPS.map((chip) => {
          const isActive = activeFilter === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setActiveFilter(chip.id)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* COMMUNITY CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {isLoading && communities.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs">Searching multi-membership platform...</span>
          </div>
        ) : communities.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No organizations found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No communities matched your search criteria. Try modifying your filter chips or search keywords, or provision a new corporate community.
            </p>
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Workspace</span>
            </button>
          </div>
        ) : (
          communities.map((c) => {
            const isCurrentActive = c.id === activeTenant.id;
            const isMember = c.isMember;
            const domainMatches = c.matchesUserDomain;
            const requiresApproval = c.requiresApproval;
            const hasPending = c.hasPendingRequest;
            const isBatchSelected = selectedForBatch.includes(c.id);

            // Can this community be batch-joined? (not already member, domain match or public)
            const canBatchJoin = !isMember && (domainMatches || !requiresApproval);

            return (
              <div
                key={c.id}
                className={`relative flex flex-col justify-between rounded-2xl bg-white border p-5 shadow-xs hover:shadow-md transition-all ${
                  isCurrentActive 
                    ? 'border-blue-500 ring-2 ring-blue-500/10' 
                    : isMember 
                    ? 'border-emerald-200 bg-emerald-50/10' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-4">
                  
                  {/* Top Bar: Logo, Identity, Member Badge & Checkbox */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={c.logoUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${c.slug}`}
                        alt={c.name}
                        className="w-12 h-12 rounded-xl object-cover ring-1 ring-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">
                          <span className="truncate">{c.name}</span>
                        </h3>
                        <div className="text-[11px] font-mono text-slate-400 truncate">
                          @{c.slug}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isCurrentActive ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                          <Check className="w-3 h-3 stroke-[3]" /> Active
                        </span>
                      ) : isMember ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Member ({c.userRole || 'joined'})
                        </span>
                      ) : canBatchJoin ? (
                        <button
                          type="button"
                          onClick={() => toggleSelectForBatch(c.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-blue-600 transition-colors"
                          title="Select for batch join"
                        >
                          {isBatchSelected ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Description / Mission */}
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {c.tagline || 'Collaborative workspace, team sync & project updates.'}
                  </p>

                  {/* Tags: Industry, Member Counter & Policy */}
                  <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                      {c.industry || 'Technology'}
                    </span>
                    <span className="flex items-center gap-1 text-[11px]">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{c.memberCount || 1} members</span>
                    </span>
                    {requiresApproval && (
                      <span className="flex items-center gap-1 text-[11px] text-amber-700 font-medium">
                        <Lock className="w-3 h-3" /> Approval Req.
                      </span>
                    )}
                  </div>

                  {/* Allowed Corporate Domains */}
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Allowed Work Domains:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(c.allowedDomains && c.allowedDomains.length > 0 ? c.allowedDomains : ['acme.com']).map((d: string) => {
                        const isMatch = detectedDomain && (d.toLowerCase() === detectedDomain.toLowerCase() || d.toLowerCase() === userEmail.toLowerCase());
                        return (
                          <span
                            key={d}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                              isMatch
                                ? 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            @{d} {isMatch && '✓'}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Smart Domain Match Indicator */}
                  {domainMatches && !isMember && (
                    <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Matches your corporate domain (@{detectedDomain})</span>
                    </div>
                  )}
                </div>

                {/* Bottom Action Button */}
                <div className="pt-4 mt-4 border-t border-slate-100">
                  {isCurrentActive ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2 px-3 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold cursor-default"
                    >
                      Currently Active Workspace
                    </button>
                  ) : isMember ? (
                    <button
                      type="button"
                      onClick={() => handleEnterWorkspace(c)}
                      className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5 text-blue-400" />
                      <span>Enter Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : hasPending ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2 px-3 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-default"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Pending Approval</span>
                    </button>
                  ) : domainMatches && !requiresApproval ? (
                    <button
                      type="button"
                      onClick={() => handleInstantJoin(c)}
                      className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Join Instantly</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRequestTarget(c)}
                      className="w-full py-2 px-3 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5 text-slate-500" />
                      <span>Request Access</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FLOATING BATCH JOIN ACTION BAR */}
      {selectedForBatch.length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-3 duration-200 max-w-lg w-[calc(100%-2rem)]">
          <div className="flex items-center gap-2 flex-1">
            <CheckSquare className="w-5 h-5 text-blue-400 shrink-0" />
            <div className="text-xs">
              <span className="font-bold">{selectedForBatch.length}</span> workspace{selectedForBatch.length > 1 ? 's' : ''} selected
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedForBatch([])}
              className="text-xs text-slate-400 hover:text-white px-2 py-1"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={isBatchJoining}
              onClick={handleExecuteBatchJoin}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              {isBatchJoining ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>Join Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* REQUEST ACCESS NOTE MODAL */}
      {requestTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold text-xs">
                  {requestTarget.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">
                    Request Access to {requestTarget.name}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Workspace Administrators will review your request
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRequestTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="p-5 space-y-4">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800">Applicant Identity:</div>
                <div className="text-[11px] font-mono text-slate-600">{userName} ({userEmail})</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Optional Note for Workspace Admins
                </label>
                <textarea
                  rows={3}
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  placeholder="e.g. Joining for cross-functional project sync with the engineering team..."
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRequestTarget(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingRequest ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Submit Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
