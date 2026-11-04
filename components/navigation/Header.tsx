'use client';

import React, { useState } from 'react';
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
  const { joinedCommunities, activeCommunity, switchCommunity } = useWorkspace();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copiedTenantId, setCopiedTenantId] = useState(false);

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

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* LEFT: BRAND & PERSISTENT WORKSPACE SWITCHER */}
          <div className="flex items-center gap-3 sm:gap-5 min-w-0">
            {/* Logo */}
            <div 
              onClick={() => onNavigate?.('feed')}
              className="flex items-center gap-2 shrink-0 cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs group-hover:bg-blue-700 transition-colors">
                S
              </div>
              <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg hidden xs:inline">
                Syncly
              </span>
            </div>

            <div className="h-5 w-px bg-slate-200 hidden sm:block shrink-0" />

            {/* Persistent Workspace Switcher Dropdown */}
            <div className="relative min-w-0">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200/90 shadow-2xs transition-all hover:border-slate-300"
                title="Switch active workspace"
              >
                <div className="w-5 h-5 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                  {activeCommunity?.logoUrl ? (
                    <img src={activeCommunity.logoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  )}
                </div>
                <span className="font-semibold text-slate-900 max-w-[120px] sm:max-w-[180px] truncate">
                  {activeCommunity?.name || 'Select Workspace'}
                </span>
                {activeCommunity?.userRole && (
                  <span className={`hidden md:inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider ${getRoleBadgeColor(activeCommunity.userRole)}`}>
                    {activeCommunity.userRole}
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setDropdownOpen(false)} 
                  />
                  <div className="absolute left-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100">
                      <span>My Joined Workspaces</span>
                      <span className="text-slate-500 font-mono text-[10px]">{joinedCommunities.length} Active</span>
                    </div>

                    <div className="max-h-64 overflow-y-auto py-1 divide-y divide-slate-50">
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
                            className={`w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                              isSelected ? 'bg-blue-50/60 font-medium' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                                {c.logoUrl ? (
                                  <img src={c.logoUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Building2 className="w-3.5 h-3.5 text-slate-600" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900 truncate flex items-center gap-1.5">
                                  <span className="truncate">{c.name}</span>
                                  {isSelected && (
                                    <span className="text-[10px] font-medium text-blue-600 bg-blue-100/70 px-1.5 py-0.2 rounded shrink-0">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border uppercase tracking-wider ${getRoleBadgeColor(c.userRole)}`}>
                                    {c.userRole || 'member'}
                                  </span>
                                  <span className="text-slate-400">·</span>
                                  <span className="truncate">@{c.slug}</span>
                                </div>
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Quick Action Links */}
                    <div className="pt-2 mt-1 border-t border-slate-100 px-2 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          onNavigate?.('search');
                        }}
                        className="w-full text-left px-2.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg flex items-center justify-between transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <Search className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform" />
                          <span>Explore &amp; Search Communities</span>
                        </div>
                        <span className="text-[10px] bg-slate-200/80 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                          Find more
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          onOpenCreateCommunity?.();
                        }}
                        className="w-full text-left px-2.5 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-2 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Create New Workspace...</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* x-tenant-id chip */}
            {activeCommunity && (
              <div 
                onClick={copyTenantId}
                className="hidden xl:flex items-center gap-1.5 text-xs font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors"
                title="Click to copy active tenant UUID"
              >
                <span>x-tenant-id: {activeCommunity.id.slice(0, 8)}...</span>
                {copiedTenantId ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3 text-slate-400" />
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
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors border border-slate-200/60"
              title="Search workspaces and directory"
            >
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Search Workspaces</span>
              <kbd className="hidden md:inline-block text-[10px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                ⌘K
              </kbd>
            </button>

            {/* Pending Requests Badge */}
            {pendingRequestsCount > 0 && (
              <button
                type="button"
                onClick={onOpenJoinRequests}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors animate-pulse"
                title="Review pending membership access requests"
              >
                <Bell className="w-3.5 h-3.5 text-amber-600" />
                <span>{pendingRequestsCount}</span>
              </button>
            )}

            {/* Live Status indicator */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded-full border border-emerald-200/80">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
              <span>Realtime RLS</span>
            </div>

            {/* Profile Avatar */}
            {currentSession && (
              <div 
                onClick={() => onNavigate?.('profile')}
                className="flex items-center gap-2 pl-1 cursor-pointer group"
                title={`Signed in as ${currentSession.user.fullName}`}
              >
                <img
                  src={currentSession.user.avatarUrl}
                  alt={currentSession.user.fullName}
                  className="w-8 h-8 rounded-full border border-slate-200 object-cover group-hover:ring-2 group-hover:ring-blue-500/30 transition-all"
                />
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}

export default Header;
