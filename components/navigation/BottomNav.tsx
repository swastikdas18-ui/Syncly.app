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
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/80 pb-[env(safe-area-inset-bottom,0px)] transition-all duration-200 select-none touch-manipulation"
      suppressHydrationWarning
    >
      <div className="grid grid-cols-4 h-16 max-w-lg mx-auto items-center px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = isMounted ? currentTab === tab.id : tab.id === 'feed';

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center min-h-[48px] w-full py-1 px-1 rounded-xl transition-all relative group cursor-pointer active:scale-95 ${
                isActive
                  ? 'text-blue-500 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative flex items-center justify-center">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? 'scale-110 stroke-[2.25px]' : 'stroke-2 group-hover:scale-105'
                  }`}
                />
                {isMounted && typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-blue-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-zinc-950 animate-pulse">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] sm:text-[11px] mt-1 tracking-tight truncate max-w-[64px] ${isActive ? 'text-blue-400 font-medium' : 'text-zinc-400'}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default BottomNav;
