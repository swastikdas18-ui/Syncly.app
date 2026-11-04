import React, { useState } from 'react';
import { 
  Building2, 
  Layers, 
  MessageSquare, 
  FileCode2, 
  FileCode, 
  ShieldCheck, 
  ChevronDown, 
  Check, 
  Copy, 
  Radio, 
  Compass, 
  Plus, 
  Users,
  Search,
  Calendar,
  User as UserIcon,
  Bell
} from 'lucide-react';
import { Tenant, UserSession } from '../types.ts';

export type MainViewType = 'feed' | 'events' | 'chat' | 'profile' | 'explore' | 'search' | 'nextjs' | 'schema' | 'inspector';

interface NavbarProps {
  tenants: Tenant[];
  activeTenant: Tenant | null;
  onSelectTenant: (tenant: Tenant) => void;
  activeView: MainViewType;
  onSelectView: (view: MainViewType) => void;
  isLiveConnected: boolean;
  currentSession?: UserSession | null;
  onOpenLogin?: () => void;
  pendingRequestsCount?: number;
  onOpenJoinRequests?: () => void;
  onOpenCreateCommunity?: () => void;
  joinedCommunities?: Array<Tenant & { userRole?: string; isMember?: boolean }>;
}

export const Navbar: React.FC<NavbarProps> = ({
  tenants,
  activeTenant,
  onSelectTenant,
  activeView,
  onSelectView,
  isLiveConnected,
  currentSession,
  onOpenLogin,
  pendingRequestsCount = 0,
  onOpenJoinRequests,
  onOpenCreateCommunity,
  joinedCommunities,
}) => {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [copiedTenantId, setCopiedTenantId] = React.useState(false);

  const copyTenantId = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeTenant?.id) {
      navigator.clipboard.writeText(activeTenant.id);
      setCopiedTenantId(true);
      setTimeout(() => setCopiedTenantId(false), 2000);
    }
  };

  const getRoleBadgeStyle = (role?: string) => {
    switch (role?.toLowerCase()) {
      case 'owner':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'moderator':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'intern':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const currentRole = (activeTenant as any)?.userRole || (currentSession?.user?.tenantId === activeTenant?.id ? currentSession?.user?.role : undefined);
  const displayWorkspaces = joinedCommunities && joinedCommunities.length > 0 ? joinedCommunities : tenants;

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          
          {/* ZONE 1: BRAND & TENANT SWITCHER */}
          <div className="flex items-center gap-2 sm:gap-6 min-w-0">
            <div 
              onClick={() => onSelectView('feed')}
              className="flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs hover:bg-blue-700 transition-colors">
                S
              </div>
              <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg hidden xs:inline">
                Syncly
              </span>
            </div>

            <div className="h-5 w-px bg-slate-200 hidden sm:block shrink-0" />

            {/* Tenant Selector */}
            <div className="relative min-w-0">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                title="Switch active company tenant to verify isolation"
              >
                <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 shrink-0" />
                <span className="font-semibold text-slate-900 max-w-[105px] xs:max-w-[140px] sm:max-w-none truncate">
                  {activeTenant?.name || 'Select Workspace'}
                </span>
                {currentRole && (
                  <span className={`hidden md:inline-flex text-[10px] font-semibold px-1.5 py-0.2 rounded border uppercase tracking-wider ${getRoleBadgeStyle(currentRole)}`}>
                    {currentRole}
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setDropdownOpen(false)} 
                  />
                  <div className="absolute left-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1.5 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>My Joined Workspaces</span>
                      <span className="text-slate-500 font-mono text-[10px]">{displayWorkspaces.length} active</span>
                    </div>

                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                      {displayWorkspaces.map((t) => {
                        const isSelected = t.id === activeTenant?.id;
                        const role = (t as any).userRole || (t.id === '00000000-0000-0000-0000-000000000001' ? 'owner' : 'member');
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              onSelectTenant(t);
                              setDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2.5 flex items-start justify-between hover:bg-slate-50 transition-colors ${
                              isSelected ? 'bg-blue-50/60' : ''
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="text-sm font-semibold text-slate-900 flex items-center gap-1.5 truncate">
                                <span className="truncate">{t.name}</span>
                                {isSelected && <span className="text-[11px] text-blue-600 font-medium shrink-0">· Active</span>}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border uppercase tracking-wider ${getRoleBadgeStyle(role)}`}>
                                  {role}
                                </span>
                                <span className="text-xs text-slate-500 truncate">{t.tagline}</span>
                              </div>
                              <div className="text-[11px] font-mono text-slate-400 mt-1 truncate">
                                ID: {t.id.slice(0, 8)}...{t.id.slice(-4)}
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />}
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2 mt-1 border-t border-slate-100 px-2 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          onSelectView('search');
                        }}
                        className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <Search className="w-3.5 h-3.5 text-blue-600" />
                          <span>Explore &amp; Join More Communities</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1 py-0.5 rounded">/search</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          onOpenCreateCommunity?.();
                        }}
                        className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Create New Workspace...</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Tenant UUID Chip with copy */}
            {activeTenant && (
              <div 
                onClick={copyTenantId}
                className="hidden lg:flex items-center gap-1.5 text-xs font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-200 cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors"
                title="Click to copy active UUID"
              >
                <span>x-tenant-id: {activeTenant.id.slice(0, 8)}...</span>
                {copiedTenantId ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3 text-slate-400" />
                )}
              </div>
            )}
          </div>

          {/* ZONE 2: PRIMARY NAVIGATION VIEWS (Desktop) */}
          <nav className="hidden md:flex items-center gap-1 p-1 bg-slate-100/80 rounded-lg border border-slate-200/60">
            <button
              type="button"
              onClick={() => onSelectView('feed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'feed'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Feed</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectView('events')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'events'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Events</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectView('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'chat'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectView('search')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'search'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Global Community Search & Multi-Membership"
            >
              <Search className="w-3.5 h-3.5 text-blue-600" />
              <span>Search</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectView('profile')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'profile'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Profile</span>
            </button>

            <div className="h-4 w-px bg-slate-300 mx-1" />

            <button
              type="button"
              onClick={() => onSelectView('nextjs')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'nextjs'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Inspect Next.js App Router Code"
            >
              <FileCode className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden xl:inline">Next.js</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectView('inspector')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'inspector'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Cross-Tenant Leakage Verification"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden xl:inline">Audit</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectView('schema')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'schema'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Postgres Multi-Tenant DDL Schema"
            >
              <FileCode2 className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden xl:inline">SQL</span>
            </button>
          </nav>

          {/* ZONE 3: LIVE STATUS & USER PROFILE */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Mobile Search Button */}
            <button
              type="button"
              onClick={() => onSelectView('search')}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Search communities"
            >
              <Search className="w-4 h-4 text-blue-600" />
            </button>

            <div 
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500"
              title={isLiveConnected ? 'Realtime SSE Stream Active' : 'Connecting Realtime...'}
            >
              <Radio className={`w-3.5 h-3.5 ${isLiveConnected ? 'text-emerald-500 animate-pulse' : 'text-amber-500'}`} />
              <span className="hidden md:inline font-mono text-[11px]">
                {isLiveConnected ? 'Live' : 'Syncing'}
              </span>
            </div>

            {/* Admin Join Requests Pill */}
            {['admin', 'owner'].includes(currentSession?.user?.role || '') && (
              <button
                type="button"
                onClick={onOpenJoinRequests}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  pendingRequestsCount > 0
                    ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
                title="Review pending community join requests"
              >
                <Users className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">Requests</span>
                {pendingRequestsCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] flex items-center justify-center font-bold">
                    {pendingRequestsCount}
                  </span>
                )}
              </button>
            )}

            {currentSession?.user ? (
              <button
                type="button"
                onClick={() => onSelectView('profile')}
                className="flex items-center gap-2 p-1 pl-2 rounded-full hover:bg-slate-100 transition-colors border border-slate-200/80"
                title="View profile & account settings"
              >
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-800 leading-tight">
                    {currentSession.user.fullName}
                  </div>
                  <div className="text-[10px] text-slate-400 capitalize">
                    {currentSession.user.role}
                  </div>
                </div>
                {currentSession.user.avatarUrl ? (
                  <img
                    src={currentSession.user.avatarUrl}
                    alt={currentSession.user.fullName}
                    className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-300"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                    {currentSession.user.fullName.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenLogin}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
              >
                Sign In
              </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};

