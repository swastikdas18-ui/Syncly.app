'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Home, 
  Newspaper, 
  MessageSquare, 
  Users, 
  Compass, 
  Calendar, 
  Bell, 
  User, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Building2, 
  Plus, 
  ShieldCheck,
  Check,
  ChevronDown
} from 'lucide-react';
import { useTenant } from '@/lib/context/AuthContext.tsx';
import { useWorkspace } from '@/lib/context/WorkspaceContext.tsx';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  unreadChatCount?: number;
  unreadNotifsCount?: number;
  pendingRequestsCount?: number;
  onOpenCreateCommunity?: () => void;
  onOpenJoinRequests?: () => void;
}

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  unreadChatCount = 0,
  unreadNotifsCount = 2,
  pendingRequestsCount = 0,
  onOpenCreateCommunity,
  onOpenJoinRequests,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { activeTenant } = useTenant();
  const { activeCommunity, joinedCommunities, switchCommunity } = useWorkspace();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);

  const tenantName = activeTenant?.name || activeCommunity?.name || 'Workspace';

  const navItems = [
    {
      id: 'feed',
      label: 'Feed',
      href: '/feed',
      icon: Newspaper,
      description: 'Organization updates & posts',
    },
    {
      id: 'chat',
      label: 'Chat',
      href: '/channels/general',
      icon: MessageSquare,
      badge: unreadChatCount,
      description: 'Channels & direct messaging',
    },
    {
      id: 'members',
      label: 'Members',
      href: '/members',
      icon: Users,
      description: 'Colleague directory & roles',
    },
    {
      id: 'communities',
      label: 'Communities',
      href: '/communities/explore',
      icon: Compass,
      description: 'Discover & switch workspaces',
    },
    {
      id: 'events',
      label: 'Events',
      href: '/events',
      icon: Calendar,
      description: 'Agenda & team schedules',
    },
    {
      id: 'notifications',
      label: 'Notifications',
      href: '/notifications',
      icon: Bell,
      badge: unreadNotifsCount,
      description: 'Workspace activity alerts',
    },
    {
      id: 'search',
      label: 'Search',
      href: '/search',
      icon: Search,
      description: 'Omni-search workspaces & channels',
    },
    {
      id: 'profile',
      label: 'Profile',
      href: '/profile',
      icon: User,
      description: 'Corporate account settings',
    },
  ];

  const isActiveRoute = (href: string) => {
    if (href === '/feed') return pathname === '/' || pathname === '/feed';
    if (href === '/channels/general') return pathname.startsWith('/channels') || pathname.startsWith('/chat');
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={`hidden md:flex flex-col fixed top-0 left-0 bottom-0 z-40 bg-slate-950/95 border-r border-slate-800/80 backdrop-blur-xl transition-all duration-300 select-none ${
        isCollapsed ? 'w-18' : 'w-64'
      }`}
      aria-label="Global Sidebar Navigation"
    >
      {/* Brand & Workspace Identity */}
      <div className="h-16 flex items-center justify-between px-3.5 border-b border-slate-800/80 shrink-0">
        <button
          type="button"
          onClick={() => router.push('/feed')}
          className="flex items-center gap-3 min-w-0 cursor-pointer group text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-xl"
          title="Syncly Enterprise Hub"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0 group-hover:scale-105 transition-transform">
            S
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <span className="font-bold text-slate-100 tracking-tight text-base leading-none block">
                Syncly
              </span>
              <span className="text-[11px] text-slate-400 truncate block mt-0.5 font-medium">
                Enterprise Hub
              </span>
            </div>
          )}
        </button>

        {/* Toggle Collapse Button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors cursor-pointer shrink-0"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Active Workspace Mini Switcher */}
      <div className="p-3 border-b border-slate-800/60 shrink-0">
        <div className="relative">
          <button
            type="button"
            onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
            className={`w-full flex items-center gap-2.5 p-2 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700/80 transition-all cursor-pointer text-left ${
              isCollapsed ? 'justify-center' : 'justify-between'
            }`}
            title={`Active Workspace: ${tenantName}`}
            aria-label={`Active Workspace: ${tenantName}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-200 block truncate leading-tight">
                    {tenantName}
                  </span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Connected
                  </span>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${workspaceMenuOpen ? 'rotate-180' : ''}`} />
            )}
          </button>

          {/* Mini Workspace Dropdown */}
          {workspaceMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setWorkspaceMenuOpen(false)} 
              />
              <div className="absolute left-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-800">
                  <span>Joined Workspaces</span>
                  <span>{joinedCommunities.length} active</span>
                </div>
                <div className="max-h-48 overflow-y-auto py-1 space-y-0.5">
                  {joinedCommunities.map((c) => {
                    const isSelected = c.id === (activeTenant?.id || activeCommunity?.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={async () => {
                          setWorkspaceMenuOpen(false);
                          const res = await switchCommunity(c.id);
                          if (res.success) {
                            router.push('/feed');
                          }
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                          isSelected ? 'bg-indigo-600/15 text-indigo-300 font-semibold' : 'text-slate-300 hover:bg-slate-800/60'
                        }`}
                      >
                        <span className="truncate">{c.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <div className="pt-1 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setWorkspaceMenuOpen(false);
                      onOpenCreateCommunity?.();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-indigo-400 hover:bg-indigo-600/10 font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create New Workspace</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Primary Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActiveRoute(item.href);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative group cursor-pointer ${
                active
                  ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
              } ${isCollapsed ? 'justify-center px-2' : ''}`}
              title={isCollapsed ? `${item.label} — ${item.description}` : undefined}
              aria-current={active ? 'page' : undefined}
            >
              <div className="relative shrink-0 flex items-center justify-center">
                <Icon className={`w-5 h-5 transition-transform duration-200 ${active ? 'scale-105' : 'group-hover:scale-110'}`} />
                {typeof item.badge === 'number' && item.badge > 0 && isCollapsed && (
                  <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-indigo-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-slate-950">
                    {item.badge}
                  </span>
                )}
              </div>

              {!isCollapsed && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="truncate">{item.label}</span>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full shrink-0">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Info: RLS Badge & Pending Requests */}
      <div className="p-3 border-t border-slate-800/80 shrink-0">
        {pendingRequestsCount > 0 && (
          <button
            type="button"
            onClick={onOpenJoinRequests}
            className={`w-full mb-2 flex items-center gap-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition-all text-xs font-semibold cursor-pointer ${
              isCollapsed ? 'justify-center' : ''
            }`}
            title="Pending workspace join requests"
          >
            <ShieldCheck className="w-4 h-4 shrink-0 text-amber-400" />
            {!isCollapsed && (
              <span className="truncate">
                {pendingRequestsCount} Pending Review{pendingRequestsCount > 1 ? 's' : ''}
              </span>
            )}
          </button>
        )}

        <div className={`flex items-center gap-2 text-[11px] text-slate-500 ${isCollapsed ? 'justify-center' : ''}`}>
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
          {!isCollapsed && <span className="truncate">Multi-Tenant RLS Active</span>}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
