import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Search, 
  Plus, 
  Users, 
  Check, 
  Clock, 
  ArrowRight, 
  Globe, 
  Lock, 
  Sparkles, 
  ShieldCheck, 
  KeyRound, 
  X, 
  Send,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { Tenant, UserSession } from '../types.ts';
import { api } from '../lib/api.ts';

interface ExploreCommunitiesViewProps {
  currentSession: UserSession | null;
  activeTenant: Tenant;
  onSelectTenant: (tenant: Tenant) => void;
  onOpenCreateModal: () => void;
  onShowToast: (msg: string) => void;
}

export const ExploreCommunitiesView: React.FC<ExploreCommunitiesViewProps> = ({
  currentSession,
  activeTenant,
  onSelectTenant,
  onOpenCreateModal,
  onShowToast,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('All');
  const [communities, setCommunities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [callerDomain, setCallerDomain] = useState('');

  // Request Access Modal
  const [requestTarget, setRequestTarget] = useState<any | null>(null);
  const [requestNote, setRequestNote] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // Invite Token Entry Modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);

  const userEmail = currentSession?.user?.email || 'sarah.chen@acmecorp.internal';
  const userName = currentSession?.user?.fullName || 'Team Member';
  const detectedDomain = userEmail.includes('@') ? userEmail.split('@')[1] : '';

  const loadCommunities = async () => {
    setIsLoading(true);
    const res = await api.exploreCommunities(searchTerm, userEmail);
    setCommunities(res.data);
    setCallerDomain(res.callerDomain || detectedDomain);
    setIsLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCommunities();
    }, 200);
    return () => clearTimeout(timer);
  }, [searchTerm, userEmail]);

  // Handle Instant Join
  const handleInstantJoin = async (community: any) => {
    const res = await api.joinCommunity(community.id, {
      userEmail,
      userName,
    });

    if (res.status === 'joined' && res.tenant) {
      onSelectTenant(res.tenant);
      onShowToast(`🎉 Joined ${res.tenant.name}! Your verified corporate email granted instant access.`);
      loadCommunities();
    } else if (res.status === 'pending') {
      onShowToast(`Join request submitted to ${community.name} for admin approval.`);
      loadCommunities();
    } else {
      onShowToast(res.message);
    }
  };

  // Submit Join Request
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
      onShowToast(`Access request sent to ${requestTarget.name} administrators.`);
      setRequestTarget(null);
      setRequestNote('');
      loadCommunities();
    } else if (res.status === 'joined' && res.tenant) {
      onSelectTenant(res.tenant);
      onShowToast(`Joined ${res.tenant.name}!`);
      setRequestTarget(null);
      loadCommunities();
    } else {
      onShowToast(res.message);
    }
  };

  // Invite Token Join
  const handleInviteJoin = () => {
    setInviteError(null);
    const token = inviteToken.trim().toLowerCase();
    if (!token) {
      setInviteError('Please enter a valid invite code or workspace slug.');
      return;
    }

    const match = communities.find(
      (c) => c.slug.toLowerCase() === token || c.id.toLowerCase() === token
    );

    if (match) {
      handleInstantJoin(match);
      setShowInviteModal(false);
      setInviteToken('');
    } else {
      setInviteError(`No workspace found matching token "${token}". Check spelling or request a new link.`);
    }
  };

  const industries = ['All', ...Array.from(new Set(communities.map((c) => c.industry).filter(Boolean)))];

  const filteredCommunities = communities.filter((c) => {
    if (selectedIndustry !== 'All' && c.industry !== selectedIndustry) {
      return false;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* HERO BANNER & SEARCH */}
      <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white p-6 sm:p-8 overflow-hidden shadow-xl border border-slate-700/60">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/400/20 text-blue-300 border border-blue-400/30 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Multi-Tenant Discovery Hub</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Explore Corporate Workspaces &amp; Communities
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-2xl">
            Find and join engineering organizations, cross-company alliances, and corporate workspaces. 
            Colleagues matching corporate domains receive instant auto-admission.
          </p>

          {/* User Email Domain Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/10 backdrop-blur-xs text-xs font-mono text-slate-200 border border-white/10">
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span>Active identity: </span>
            <span className="font-bold text-white">{userEmail}</span>
            {detectedDomain && (
              <span className="px-1.5 py-0.5 rounded bg-indigo-950/400/30 text-blue-200 text-[11px]">
                @{detectedDomain}
              </span>
            )}
          </div>

          {/* Search Bar & Actions */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by company name, slug, domain (e.g. stripe.com), or tech..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/10 text-white placeholder-slate-400 border border-white/15 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-slate-900/15 text-xs sm:text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="px-4 py-2.5 rounded-xl bg-slate-900/10 hover:bg-slate-900/20 text-white text-xs font-semibold border border-white/15 transition-all flex items-center justify-center gap-1.5 shrink-0"
                title="Join directly via invite link or token"
              >
                <KeyRound className="w-4 h-4" />
                <span>Invite Code</span>
              </button>

              <button
                type="button"
                onClick={onOpenCreateModal}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Create Workspace</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* INDUSTRY FILTER CHIPS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
        <span className="text-slate-400 font-medium shrink-0">Filter:</span>
        {industries.map((ind) => (
          <button
            key={ind}
            type="button"
            onClick={() => setSelectedIndustry(ind)}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors shrink-0 ${
              selectedIndustry === ind
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            {ind}
          </button>
        ))}
      </div>

      {/* COMMUNITIES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {isLoading && communities.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            <span className="text-xs">Searching corporate directory...</span>
          </div>
        ) : filteredCommunities.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-slate-900 rounded-2xl border border-slate-800 p-8 space-y-3">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-100">No matching workspaces found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              We couldn't find any discoverable workspaces matching "{searchTerm}". You can create a new corporate community or check your search keywords.
            </p>
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Workspace</span>
            </button>
          </div>
        ) : (
          filteredCommunities.map((c) => {
            const isCurrent = c.id === activeTenant.id;
            const hasPending = c.hasPendingRequest;
            const domainMatches = c.matchesUserDomain;
            const requiresApproval = c.requiresApproval;

            return (
              <div
                key={c.id}
                className={`relative flex flex-col justify-between rounded-2xl bg-slate-900 border p-5 shadow-xs hover:shadow-md transition-all ${
                  isCurrent ? 'border-indigo-500/80 ring-2 ring-indigo-500/10' : 'border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="space-y-4">
                  
                  {/* Top Bar: Logo & Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={c.logoUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${c.slug}`}
                        alt={c.name}
                        className="w-12 h-12 rounded-xl object-cover ring-1 ring-slate-800 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-slate-100 truncate">
                            {c.name}
                          </h3>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 truncate">
                          syncly.io/{c.slug}
                        </div>
                      </div>
                    </div>

                    {isCurrent ? (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-950/40 text-indigo-300 border border-indigo-800 shrink-0 flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[3]" /> Active
                      </span>
                    ) : hasPending ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    ) : null}
                  </div>

                  {/* Tagline / Description */}
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {c.tagline || 'Corporate collaborative workspace and knowledge exchange.'}
                  </p>

                  {/* Metadata Tags: Industry & Members */}
                  <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 font-medium text-[11px]">
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
                                : 'bg-slate-800 text-slate-300 border border-slate-800'
                            }`}
                          >
                            @{d} {isMatch && '✓'}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Smart Domain Match Indicator */}
                  {domainMatches && !isCurrent && (
                    <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Matches your corporate domain (@{detectedDomain})</span>
                    </div>
                  )}
                </div>

                {/* Bottom Action Button */}
                <div className="pt-4 mt-4 border-t border-slate-800">
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2 px-3 rounded-lg bg-slate-800 text-slate-400 text-xs font-semibold cursor-default"
                    >
                      Currently Active Workspace
                    </button>
                  ) : hasPending ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2 px-3 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-default"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Request Awaiting Review</span>
                    </button>
                  ) : domainMatches && !requiresApproval ? (
                    <button
                      type="button"
                      onClick={() => handleInstantJoin(c)}
                      className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs hover:shadow transition-all flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Join Instantly</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRequestTarget(c)}
                      className="w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-300 hover:border-slate-400 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5 text-slate-400" />
                      <span>Request to Join</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* REQUEST ACCESS NOTE MODAL */}
      {requestTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/10 text-indigo-400 flex items-center justify-center font-bold text-xs">
                  {requestTarget.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 leading-tight">
                    Request Access to {requestTarget.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Workspace Administrators will review your request
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRequestTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="p-5 space-y-4">
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 space-y-1">
                <div className="font-semibold text-slate-100">Applicant Identity:</div>
                <div className="text-[11px] font-mono text-slate-300">{userName} ({userEmail})</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Optional Note for Workspace Admins
                </label>
                <textarea
                  rows={3}
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  placeholder="e.g. Joining for cross-functional project sync with the engineering team..."
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRequestTarget(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-xs flex items-center gap-1.5"
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

      {/* INVITE CODE ENTRY MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100 leading-tight">
                    Join with Invite Code or Token
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Direct access via private community token or slug
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {inviteError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {inviteError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1">
                  Invite Token or Community Slug
                </label>
                <input
                  type="text"
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleInviteJoin();
                  }}
                  placeholder="e.g. stripe-eng or acme-corp"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleInviteJoin}
                  className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-xs"
                >
                  Join Workspace
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
