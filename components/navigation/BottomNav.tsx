'use client';

import React, { useState, useEffect } from 'react';
import { Newspaper, Calendar, MessageSquare, User } from 'lucide-react';

export type BottomNavTab = 'feed' | 'events' | 'chat' | 'profile';

interface BottomNavProps {
  currentTab: BottomNavTab;
  onTabChange: (tab: BottomNavTab) => void;
  unreadChatCount?: number;
}

export function BottomNav({ currentTab, onTabChange, unreadChatCount = 0 }: BottomNavProps) {
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const tabs = [
    {
      id: 'feed' as BottomNavTab,
      label: 'Feed',
      icon: Newspaper,
      href: '/feed'
    },
    {
      id: 'events' as BottomNavTab,
      label: 'Events',
      icon: Calendar,
      href: '/events'
    },
    {
      id: 'chat' as BottomNavTab,
      label: 'Chat',
      icon: MessageSquare,
      href: '/channels/general',
      badge: unreadChatCount
    },
    {
      id: 'profile' as BottomNavTab,
      label: 'Profile',
      icon: User,
      href: '/profile'
    }
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-2xl border-t border-slate-800/80 pb-[env(safe-area-inset-bottom,0px)] shadow-2xl transition-all duration-200 select-none touch-manipulation"
      suppressHydrationWarning
    >
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = isMounted ? currentTab === tab.id : tab.id === 'feed';

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center min-w-[52px] min-h-[52px] py-1 px-2.5 rounded-2xl transition-all relative group cursor-pointer active:scale-95 touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                isActive
                  ? 'text-indigo-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative flex items-center justify-center">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'scale-110 stroke-[2.25px] text-indigo-400' : 'stroke-2 group-hover:scale-105'
                  }`}
                  aria-hidden="true"
                />
                {isMounted && typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-indigo-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-slate-950 animate-pulse">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium mt-1 tracking-tight truncate max-w-[64px] ${isActive ? 'text-indigo-400' : 'text-slate-400'}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-xs shadow-indigo-400/50" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
