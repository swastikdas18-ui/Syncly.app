'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  ChevronDown, 
  Check, 
  Copy, 
  Search, 
  Plus, 
  Compass, 
  Bell, 
  Radio, 
  ShieldCheck, 
  User as UserIcon,
  Sparkles
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

  // SSR skeleton matching client initial layout
  if (!isMounted) {
    return (
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl pt-[env(safe-area-inset-top,0px)] px-3 sm:px-4 h-14 flex items-center justify-between transition-colors">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
                S
              </div>
              <span className="font-bold text-zinc-100 tracking-tight text-base hidden xs:inline">
                Syncly
              </span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1 text-xs font-medium text-zinc-200 bg-zinc-900 rounded-lg border border-zinc-800">
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-semibold text-zinc-100 truncate max-w-[120px] sm:max-w-xs">
                {activeCommunity?.name || 'Workspace'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 animate-pulse" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl pt-[env(safe-area-inset-top,0px)] px-3 sm:px-4 h-14 flex items-center justify-between transition-colors">
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
        
        {/* LEFT: BRAND & PERSISTENT WORKSPACE SWITCHER */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Logo */}
          <div 
            onClick={() => onNavigate?.('feed')}
            className="flex items-center gap-2 shrink-0 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-xs group-hover:bg-indigo-500 transition-colors">
              S
            </div>
            <span className="font-bold text-zinc-100 tracking-tight text-base hidden xs:inline">
              Syncly
            </span>
          </div>

          <div className="h-5 w-px bg-zinc-800 hidden sm:block shrink-0" />

          {/* Persistent Workspace Switcher Dropdown */}
          <div className="relative min-w-0">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-zinc-200 bg-zinc-900/90 hover:bg-zinc-800 rounded-lg border border-zinc-800 shadow-2xs transition-all hover:border-zinc-700 max-w-[160px] sm:max-w-xs"
              title="Switch active workspace"
            >
              <div className="w-5 h-5 rounded bg-indigo-950 text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                {activeCommunity?.logoUrl ? (
                  <img src={activeCommunity.logoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                )}
              </div>
              <span className="font-semibold text-zinc-100 max-w-[100px] sm:max-w-xs truncate">
                {activeCommunity?.name || 'Select Workspace'}
              </span>
              {activeCommunity?.userRole && (
                <span className={`hidden md:inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider ${getRoleBadgeColor(activeCommunity.userRole)}`}>
                  {activeCommunity.userRole}
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setDropdownOpen(false)} 
                />
                <div className="absolute left-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-zinc-900 rounded-xl shadow-xl border border-zinc-800 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between border-b border-zinc-800">
                    <span>My Joined Workspaces</span>
                    <span className="text-zinc-500 font-mono text-[10px]">{joinedCommunities.length} Active</span>
                  </div>

                  <div className="max-h-64 overflow-y-auto py-1 divide-y divide-zinc-800/60">
                    {joinedCommunities.map((c) => {
                      const isSelected = c.id === activeCommunity?.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            switchCommunity(c.id);
                            setDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-zinc-800/70 transition-colors ${
                            isSelected ? 'bg-indigo-950/40 font-medium' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 overflow-hidden">
                              {c.logoUrl ? (
                                <img src={c.logoUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-zinc-100 truncate flex items-center gap-1.5">
                                <span className="truncate">{c.name}</span>
                                {isSelected && (
                                  <span className="text-[10px] font-medium text-indigo-400 bg-indigo-950 px-1.5 py-0.2 rounded shrink-0 border border-indigo-800">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
                                <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border uppercase tracking-wider ${getRoleBadgeColor(c.userRole)}`}>
                                  {c.userRole || 'member'}
                                </span>
                                <span className="text-zinc-600">·</span>
                                <span className="truncate">@{c.slug}</span>
                              </div>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick Action Links */}
                  <div className="pt-2 mt-1 border-t border-zinc-800 px-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        onNavigate?.('search');
                      }}
                      className="w-full text-left px-2.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 rounded-lg flex items-center justify-between transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <Search className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
                        <span>Explore &amp; Search Communities</span>
                      </div>
                      <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
                        Find more
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenCreateCommunity?.();
                      }}
                      className="w-full text-left px-2.5 py-2 text-xs font-semibold text-indigo-400 hover:bg-indigo-950/50 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Create New Workspace...</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* x-tenant-id chip - completely hidden under 640px / sm */}
          {activeCommunity && (
            <div 
              onClick={copyTenantId}
              className="hidden xl:flex items-center gap-1.5 text-xs font-mono text-zinc-400 bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-800 cursor-pointer hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              title="Click to copy active tenant UUID"
            >
              <span>x-tenant-id: {activeCommunity.id.slice(0, 8)}...</span>
              {copiedTenantId ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 text-zinc-500" />
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
            className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors border border-zinc-800 min-h-[44px] min-w-[44px] sm:min-w-0 sm:min-h-0 justify-center touch-manipulation"
            title="Search workspaces and directory"
          >
            <Search className="w-4 h-4 text-zinc-400" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden md:inline-block text-[10px] font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">
              ⌘K
            </kbd>
          </button>

          {/* Pending Requests / Notification Bell with 44x44 target */}
          {pendingRequestsCount > 0 && (
            <button
              type="button"
              onClick={onOpenJoinRequests}
              className="flex items-center justify-center min-w-[44px] min-h-[44px] text-xs font-semibold text-amber-400 bg-amber-950/60 hover:bg-amber-900/60 rounded-lg border border-amber-800/80 transition-colors animate-pulse touch-manipulation"
              title="Review pending membership access requests"
            >
              <Bell className="w-4 h-4 text-amber-400" />
              <span className="ml-1">{pendingRequestsCount}</span>
            </button>
          )}

          {/* Live Status indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/60 rounded-full border border-emerald-800/80">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            <span>Realtime</span>
          </div>

          {/* Profile Avatar: 44x44 physical touch area with online dot */}
          {currentSession?.user && (
            <div 
              onClick={() => onNavigate?.('profile')}
              className="flex items-center justify-center min-w-[44px] min-h-[44px] cursor-pointer group touch-manipulation"
              title={`Signed in as ${currentSession.user.fullName}`}
            >
              <div className="relative">
                {currentSession.user.avatarUrl ? (
                  <img
                    src={currentSession.user.avatarUrl}
                    alt={currentSession.user.fullName}
                    className="w-8 h-8 rounded-full border border-zinc-700 object-cover group-hover:ring-2 group-hover:ring-indigo-500/50 transition-all"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 text-xs font-bold">
                    {currentSession.user.fullName.charAt(0)}
                  </div>
                )}
                {/* Online status indicator dot */}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-zinc-950" />
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}

export default Header;
