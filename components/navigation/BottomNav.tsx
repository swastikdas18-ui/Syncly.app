'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  Newspaper, 
  Calendar, 
  MessageSquare, 
  Users, 
  Compass, 
  Bell, 
  User, 
  MoreHorizontal,
  X,
  Search,
  Building2,
  ShieldCheck
} from 'lucide-react';

export type BottomNavTab = 'feed' | 'chat' | 'events' | 'members' | 'profile' | 'more';

export interface BottomNavProps {
  currentTab?: BottomNavTab | string;
  onTabChange?: (tab: any) => void;
  unreadChatCount?: number;
  unreadNotifsCount?: number;
}

export function BottomNav({ 
  currentTab, 
  onTabChange, 
  unreadChatCount = 0, 
  unreadNotifsCount = 2 
}: BottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Primary 4 tabs on mobile bar + More menu trigger
  const primaryTabs = [
    {
      id: 'feed',
      label: 'Feed',
      icon: Newspaper,
      href: '/feed',
      isActive: pathname === '/' || pathname === '/feed',
    },
    {
      id: 'chat',
      label: 'Chat',
      icon: MessageSquare,
      href: '/channels/general',
      badge: unreadChatCount,
      isActive: pathname.startsWith('/channels') || pathname.startsWith('/chat'),
    },
    {
      id: 'events',
      label: 'Events',
      icon: Calendar,
      href: '/events',
      isActive: pathname.startsWith('/events'),
    },
    {
      id: 'members',
      label: 'Members',
      icon: Users,
      href: '/members',
      isActive: pathname.startsWith('/members'),
    },
  ];

  // Drawer additional modules
  const moreModules = [
    {
      id: 'communities',
      label: 'Communities & Workspaces',
      href: '/communities/explore',
      icon: Compass,
      description: 'Discover & switch workspaces',
    },
    {
      id: 'notifications',
      label: 'Notifications',
      href: '/notifications',
      icon: Bell,
      badge: unreadNotifsCount,
      description: 'Activity alerts & team mentions',
    },
    {
      id: 'search',
      label: 'Global Search',
      href: '/search',
      icon: Search,
      description: 'Omni-search channels & workspaces',
    },
    {
      id: 'profile',
      label: 'User Profile & Settings',
      href: '/profile',
      icon: User,
      description: 'Corporate account settings & logout',
    },
  ];

  const handleNavigate = (href: string, tabId: string) => {
    setDrawerOpen(false);
    if (onTabChange) {
      onTabChange(tabId);
    }
    router.push(href);
  };

  const isMoreActive = pathname.startsWith('/communities') || 
                       pathname.startsWith('/notifications') || 
                       pathname.startsWith('/search') || 
                       pathname.startsWith('/profile');

  return (
    <>
      <nav
        aria-label="Mobile Navigation Bar"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-2xl border-t border-slate-800/80 pb-[env(safe-area-inset-bottom,0px)] shadow-2xl transition-all duration-200 select-none touch-manipulation"
      >
        <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            const active = isMounted ? tab.isActive : tab.id === 'feed';

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleNavigate(tab.href, tab.id)}
                className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-2xl transition-all relative group cursor-pointer active:scale-95 touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                  active ? 'text-indigo-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <div className="relative flex items-center justify-center">
                  <Icon
                    className={`w-5 h-5 transition-transform duration-200 ${
                      active ? 'scale-110 stroke-[2.25px] text-indigo-400' : 'stroke-2 group-hover:scale-105'
                    }`}
                    aria-hidden="true"
                  />
                  {isMounted && typeof tab.badge === 'number' && tab.badge > 0 && (
                    <span className="absolute -top-1 -right-2 bg-indigo-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-slate-950 animate-pulse">
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-medium mt-1 tracking-tight truncate max-w-[64px] ${active ? 'text-indigo-400' : 'text-slate-400'}`}>
                  {tab.label}
                </span>
                {active && (
                  <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-xs shadow-indigo-400/50" />
                )}
              </button>
            );
          })}

          {/* More Menu Trigger Button (Min 44px touch target) */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-2 rounded-2xl transition-all relative group cursor-pointer active:scale-95 touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-400 ${
              isMoreActive ? 'text-indigo-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
            aria-label="Open more navigation options"
          >
            <div className="relative flex items-center justify-center">
              <MoreHorizontal
                className={`w-5 h-5 transition-transform duration-200 ${
                  isMoreActive ? 'scale-110 stroke-[2.25px] text-indigo-400' : 'stroke-2 group-hover:scale-105'
                }`}
                aria-hidden="true"
              />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-indigo-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-slate-950">
                  {unreadNotifsCount}
                </span>
              )}
            </div>
            <span className={`text-[10px] font-medium mt-1 tracking-tight truncate ${isMoreActive ? 'text-indigo-400' : 'text-slate-400'}`}>
              More
            </span>
            {isMoreActive && (
              <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-xs shadow-indigo-400/50" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile More Navigation Drawer Backdrop & Modal */}
      {drawerOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 rounded-t-3xl p-5 shadow-2xl animate-in slide-in-from-bottom duration-200 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
            role="dialog"
            aria-label="All Navigation Modules"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                  S
                </div>
                <span className="text-sm font-bold text-slate-100">All Modules</span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
                aria-label="Close navigation drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {moreModules.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.href);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.href, item.id)}
                    className={`w-full flex items-center gap-3.5 p-3 rounded-xl transition-all cursor-pointer text-left min-h-[48px] ${
                      active
                        ? 'bg-indigo-600/15 border border-indigo-500/30 text-indigo-300 font-semibold'
                        : 'bg-slate-950/60 border border-slate-800/80 text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{item.label}</span>
                        {typeof item.badge === 'number' && item.badge > 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-500 text-white rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5 font-normal">
                        {item.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default BottomNav;
