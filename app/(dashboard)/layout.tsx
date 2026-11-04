'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useTenant } from '@/lib/context/AuthContext.tsx';
import { Header } from '@/components/navigation/Header.tsx';
import { BottomNav } from '@/components/navigation/BottomNav.tsx';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, profile, loading } = useUser();
  const { activeTenant } = useTenant();

  // Enforce session boundary - redirect to /login if unauthenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          <p className="text-xs font-medium text-slate-500">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Header
        currentSession={
          profile
            ? {
                user: {
                  id: profile.id,
                  email: user.email || '',
                  fullName: profile.full_name || 'Member',
                  headline: 'Corporate Team Member',
                  role: (profile.role as any) || 'employee',
                  tenantId: profile.tenant_id || activeTenant?.id || '',
                  hasCompletedOnboarding: true,
                },
                token: 'auth-session',
              }
            : null
        }
        onNavigate={(path) => router.push(path.startsWith('/') ? path : `/${path}`)}
      />
      <main className="flex-1 w-full pb-20 md:pb-8">
        {children}
      </main>
      <BottomNav
        currentTab="feed"
        onTabChange={(tab) => {
          if (tab === 'feed') router.push('/feed');
          else if (tab === 'events') router.push('/events');
          else if (tab === 'chat') router.push('/channels/general');
          else if (tab === 'profile') router.push('/profile');
        }}
      />
    </div>
  );
}
