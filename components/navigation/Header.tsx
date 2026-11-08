'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  ChevronDown, 
  Check, 
  Copy, 
  Search, 
  Plus, 
  Bell, 
  ShieldCheck, 
  User as UserIcon,
  Sparkles,
  Command
} from 'lucide-react';
import { Tenant, UserSession } from '@/src/types.ts';
import { useWorkspace, JoinedCommunity } from '@/lib/context/WorkspaceContext.tsx';

interface HeaderProps {
  currentSession?: UserSession | null;
  onNavigate?: (view: string) => void;
  onOpenCreateCommunity?: () => void;
  onOpenJoinRequests?: () => void;
  pendingRequestsCount?: number;
}

export function Header({
  currentSession,
  onNavigate,
  onOpenCreateCommunity,
  onOpenJoinRequests,
  pendingRequestsCount = 0,
}: HeaderProps) {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const { joinedCommunities, activeCommunity, switchCommunity } = useWorkspace();
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [copiedTenantId, setCopiedTenantId] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const copyTenantId = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeCommunity?.id) {
      navigator.clipboard.writeText(activeCommunity.id);
      setCopiedTenantId(true);
      setTimeout(() => setCopiedTenantId(false), 2000);
    }
  };

  const getRoleBadgeColor = (role?: string) => {
    switch (role?.toLowerCase()) {
      case 'owner':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/30';
      case 'admin':
        return 'bg-purple-500/10 text-purple-300 border-purple-500/30';
      case 'manager':
        return 'bg-blue-500/10 text-blue-300 border-blue-500/30';
      case 'moderator':
        return 'bg-teal-500/10 text-teal-300 border-teal-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  // SSR skeleton matching client initial layout
  if (!isMounted) {
    return (
      <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between transition-colors">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                S
              </div>
              <span className="font-bold text-slate-100 tracking-tight text-base">
                Syncly
              </span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 animate-pulse" />
        </div>
      </header>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 px-3.5 sm:px-6 flex items-center justify-between transition-colors">
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
        
        {/* LEFT: BRAND & PERSISTENT WORKSPACE SWITCHER */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          {/* Logo */}
          <button 
            type="button"
            onClick={() => onNavigate?.('feed')}
            className="flex items-center gap-2.5 shrink-0 cursor-pointer group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-xl"
            aria-label="Go to feed dashboard"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-600/20 group-hover:bg-indigo-500 transition-colors">
              S
            </div>
            <span className="font-bold text-slate-100 tracking-tight text-base hidden xs:inline-block">
              Syncly
            </span>
          </button>

          <div className="h-5 w-px bg-slate-800 hidden sm:block shrink-0" aria-hidden="true" />

          {/* Persistent Workspace Switcher Dropdown */}
          <div className="relative min-w-0">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-200 bg-slate-900/90 hover:bg-slate-800 rounded-xl border border-slate-800 shadow-xs transition-all hover:border-slate-700 max-w-[150px] sm:max-w-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-400 min-h-[40px] cursor-pointer"
              title="Switch active workspace"
            >
              <div className="w-5 h-5 rounded-lg bg-indigo-950 text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                {activeCommunity?.logoUrl ? (
                  <img src={activeCommunity.logoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
                )}
              </div>
              <span className="font-semibold text-slate-100 max-w-[85px] sm:max-w-[140px] truncate">
                {activeCommunity?.name || 'Workspace'}
              </span>
              {activeCommunity?.userRole && (
                <span className={`hidden md:inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-md border uppercase tracking-wider ${getRoleBadgeColor(activeCommunity.userRole)}`}>
                  {activeCommunity.userRole}
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {dropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setDropdownOpen(false)} 
                />
                <div 
                  role="menu"
                  className="absolute left-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 py-2.5 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl"
                >
                  <div className="px-3.5 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-800">
                    <span>Joined Workspaces</span>
                    <span className="text-slate-500 font-mono text-[10px]">{joinedCommunities.length} Active</span>
                  </div>

                  <div className="max-h-64 overflow-y-auto py-1 divide-y divide-slate-800/60">
                    {joinedCommunities.map((c) => {
                      const isSelected = c.id === activeCommunity?.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            switchCommunity(c.id);
                            setDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-800/70 transition-colors ${
                            isSelected ? 'bg-indigo-950/40 font-medium' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                              {c.logoUrl ? (
                                <img src={c.logoUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Building2 className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-100 truncate flex items-center gap-1.5">
                                <span className="truncate">{c.name}</span>
                                {isSelected && (
                                  <span className="text-[10px] font-medium text-indigo-400 bg-indigo-950 px-1.5 py-0.5 rounded-md shrink-0 border border-indigo-800/80">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                                <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md border uppercase tracking-wider ${getRoleBadgeColor(c.userRole)}`}>
                                  {c.userRole || 'member'}
                                </span>
                                <span className="text-slate-600">·</span>
                                <span className="truncate">@{c.slug}</span>
                              </div>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-indigo-400 shrink-0" aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick Action Links */}
                  <div className="pt-2 mt-1 border-t border-slate-800 px-2 space-y-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDropdownOpen(false);
                        onNavigate?.('search');
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl flex items-center justify-between transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Search className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" aria-hidden="true" />
                        <span>Explore &amp; Search Communities</span>
                      </div>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                        Directory
                      </span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenCreateCommunity?.();
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-indigo-400 hover:bg-indigo-950/50 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>+ Create New Workspace...</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* x-tenant-id chip - visible on larger viewports */}
          {activeCommunity && (
            <div 
              onClick={copyTenantId}
              className="hidden xl:flex items-center gap-1.5 text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 cursor-pointer hover:bg-slate-800 hover:text-slate-200 transition-colors"
              title="Click to copy active tenant UUID"
            >
              <span>x-tenant-id: {activeCommunity.id.slice(0, 8)}...</span>
              {copiedTenantId ? (
                <Check className="w-3 h-3 text-teal-400" aria-hidden="true" />
              ) : (
                <Copy className="w-3 h-3 text-slate-500" aria-hidden="true" />
              )}
            </div>
          )}
        </div>

        {/* RIGHT: SEARCH SHORTCUT, PENDING REQUESTS & USER PROFILE */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Search Button */}
          <button
            type="button"
            onClick={() => onNavigate?.('search')}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 rounded-xl transition-all border border-slate-800 min-h-[44px] min-w-[44px] sm:min-w-0 sm:min-h-0 justify-center touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-400 cursor-pointer"
            title="Search workspaces and directory"
            aria-label="Open search dialog"
          >
            <Search className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden md:inline-flex items-center gap-0.5 text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
              <Command className="w-2.5 h-2.5" />K
            </kbd>
          </button>

          {/* Pending Requests Notification Bell */}
          {pendingRequestsCount > 0 && (
            <button
              type="button"
              onClick={onOpenJoinRequests}
              className="flex items-center justify-center min-w-[44px] min-h-[44px] text-xs font-semibold text-amber-400 bg-amber-950/60 hover:bg-amber-900/60 rounded-xl border border-amber-800/80 transition-colors animate-pulse touch-manipulation cursor-pointer"
              title="Review pending membership access requests"
              aria-label={`Review ${pendingRequestsCount} pending join requests`}
            >
              <Bell className="w-4 h-4 text-amber-400" aria-hidden="true" />
              <span className="ml-1 font-bold">{pendingRequestsCount}</span>
            </button>
          )}

          {/* Live Status indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold text-teal-400 bg-teal-950/40 rounded-full border border-teal-800/60">
            <span className="w-2 h-2 rounded-full bg-teal-400 inline-block animate-pulse" />
            <span>RLS Active</span>
          </div>

          {/* Profile Avatar: 44x44 physical touch area */}
          {currentSession?.user && (
            <button 
              type="button"
              onClick={() => onNavigate?.('profile')}
              className="flex items-center justify-center min-w-[44px] min-h-[44px] cursor-pointer group touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-full"
              title={`Signed in as ${currentSession.user.fullName}`}
              aria-label={`View profile for ${currentSession.user.fullName}`}
            >
              <div className="relative">
                {currentSession.user.avatarUrl ? (
                  <img
                    src={currentSession.user.avatarUrl}
                    alt={currentSession.user.fullName}
                    className="w-8 h-8 rounded-full border border-slate-700 object-cover group-hover:ring-2 group-hover:ring-indigo-500/50 transition-all"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 text-xs font-bold">
                    {currentSession.user.fullName.charAt(0)}
                  </div>
                )}
                {/* Online status indicator dot */}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-teal-400 ring-2 ring-slate-950" />
              </div>
            </button>
          )}
        </div>

      </div>
    </header>
  );
}

export default Header;
