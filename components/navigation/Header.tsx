'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  ChevronDown, 
  Check, 
  Search, 
  Plus, 
  Bell, 
  ShieldCheck, 
  User as UserIcon,
  Sparkles,
  Command,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react';
import { Tenant, UserSession } from '@/src/types.ts';
import { useWorkspace, JoinedCommunity } from '@/lib/context/WorkspaceContext.tsx';

interface HeaderProps {
  currentSession?: UserSession | null;
  onNavigate?: (view: string) => void;
  onOpenCreateCommunity?: () => void;
  onOpenJoinRequests?: () => void;
  pendingRequestsCount?: number;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export function Header({
  currentSession,
  onNavigate,
  onOpenCreateCommunity,
  onOpenJoinRequests,
  pendingRequestsCount = 0,
  sidebarCollapsed = false,
  onToggleSidebar,
}: HeaderProps) {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const { joinedCommunities, activeCommunity, switchCommunity } = useWorkspace();
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
      <header className="fixed top-0 left-0 right-0 z-30 h-16 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between transition-colors">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              S
            </div>
            <span className="font-bold text-slate-100 tracking-tight text-base">
              Syncly
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 animate-pulse" />
        </div>
      </header>
    );
  }

  return (
    <header className="fixed top-0 right-0 z-30 h-16 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 px-3.5 sm:px-6 flex items-center justify-between transition-all left-0 md:left-64 data-[collapsed=true]:md:left-18" data-collapsed={sidebarCollapsed}>
      <div className="w-full flex items-center justify-between gap-4">
        
        {/* LEFT: WORKSPACE BRAND & SWITCHER */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          {/* Mobile brand (hidden on desktop since sidebar has brand) */}
          <button 
            type="button"
            onClick={() => onNavigate?.('feed')}
            className="md:hidden flex items-center gap-2.5 shrink-0 cursor-pointer group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-xl"
            aria-label="Go to feed dashboard"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              S
            </div>
          </button>

          {/* Desktop Sidebar Toggle in Top Bar */}
          <button
            type="button"
            onClick={onToggleSidebar}
            className="hidden md:flex p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors cursor-pointer"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <PanelLeft className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>

          {/* Workspace Switcher Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-900 text-slate-200 border border-slate-800/90 hover:border-slate-700/80 transition-all text-xs font-semibold max-w-[200px] sm:max-w-xs truncate cursor-pointer group shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-400 min-h-[40px]"
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
              aria-label="Switch active corporate workspace"
            >
              <div className="w-5 h-5 rounded-md bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <Building2 className="w-3 h-3" aria-hidden="true" />
              </div>
              
              <span className="truncate max-w-[120px] sm:max-w-[150px]">
                {activeCommunity?.name || 'Acme Corporation'}
              </span>

              {activeCommunity?.userRole && (
                <span className={`hidden sm:inline-block text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${getRoleBadgeColor(activeCommunity.userRole)}`}>
                  {activeCommunity.userRole}
                </span>
              )}

              <ChevronDown 
                className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
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
                  <div className="px-3.5 py-1.5 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Joined Workspaces</span>
                    <span className="text-slate-400 font-mono">{joinedCommunities.length} active</span>
                  </div>

                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/40 py-1">
                    {joinedCommunities.map((c) => {
                      const isSelected = c.id === activeCommunity?.id;
                      const role = c.userRole || 'member';

                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="menuitem"
                          onClick={async () => {
                            setDropdownOpen(false);
                            const res = await switchCommunity(c.id);
                            if (res.success) {
                              onNavigate?.('feed');
                            }
                          }}
                          className={`w-full text-left px-3.5 py-2.5 flex items-start justify-between hover:bg-slate-800/60 transition-colors cursor-pointer ${
                            isSelected ? 'bg-indigo-600/10' : ''
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="text-xs font-semibold text-slate-100 flex items-center gap-1.5 truncate">
                              <span className="truncate">{c.name}</span>
                              {isSelected && (
                                <span className="text-[10px] text-indigo-400 font-bold shrink-0">· Active</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${getRoleBadgeColor(role)}`}>
                                {role}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate">
                                {c.tagline || 'Corporate Workspace'}
                              </span>
                            </div>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" aria-hidden="true" />
                          )}
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
                        onNavigate?.('communities/explore');
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl flex items-center justify-between transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Search className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" aria-hidden="true" />
                        <span>Explore &amp; Discover Workspaces</span>
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
        </div>

        {/* RIGHT: SEARCH, NOTIFICATIONS, RLS BADGE, PROFILE */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Quick Search Shortcut */}
          <button
            type="button"
            onClick={() => onNavigate?.('search')}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 rounded-xl transition-all border border-slate-800 min-h-[40px] cursor-pointer"
            title="Global search across workspaces, channels, events"
            aria-label="Open search dialog"
          >
            <Search className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden md:inline-flex items-center gap-0.5 text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
              <Command className="w-2.5 h-2.5" />K
            </kbd>
          </button>

          {/* Notifications Link */}
          <button
            type="button"
            onClick={() => onNavigate?.('notifications')}
            className="flex items-center justify-center min-w-[40px] min-h-[40px] rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-slate-100 border border-slate-800 transition-colors cursor-pointer relative"
            title="Workspace Notifications"
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-500" />
          </button>

          {/* Pending Requests Notification Bell */}
          {pendingRequestsCount > 0 && (
            <button
              type="button"
              onClick={onOpenJoinRequests}
              className="flex items-center justify-center min-w-[40px] min-h-[40px] px-2 text-xs font-semibold text-amber-400 bg-amber-950/60 hover:bg-amber-900/60 rounded-xl border border-amber-800/80 transition-colors animate-pulse cursor-pointer"
              title="Review pending membership access requests"
              aria-label={`Review ${pendingRequestsCount} pending join requests`}
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" aria-hidden="true" />
              <span className="ml-1 font-bold text-[11px]">{pendingRequestsCount}</span>
            </button>
          )}

          {/* Live RLS Status badge */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-teal-400 bg-teal-950/40 rounded-full border border-teal-800/60">
            <span className="w-2 h-2 rounded-full bg-teal-400 inline-block animate-pulse" />
            <span>RLS Active</span>
          </div>

          {/* Profile Avatar */}
          {currentSession?.user && (
            <button 
              type="button"
              onClick={() => onNavigate?.('profile')}
              className="flex items-center justify-center min-w-[40px] min-h-[40px] cursor-pointer group rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-400"
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
