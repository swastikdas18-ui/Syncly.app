'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser, useTenant } from '@/lib/context/AuthContext.tsx';
import { Header } from '@/components/navigation/Header.tsx';
import { BottomNav, BottomNavTab } from '@/components/navigation/BottomNav.tsx';
import { CreateCommunityModal } from '@/src/components/CreateCommunityModal.tsx';
import { JoinRequestsModal } from '@/src/components/JoinRequestsModal.tsx';
import { api } from '@/src/lib/api.ts';
import { Tenant, UserSession } from '@/src/types.ts';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading } = useUser();
  const { activeTenant } = useTenant();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinRequestsModalOpen, setIsJoinRequestsModalOpen] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Enforce session boundary - redirect to /login if unauthenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Load pending join requests count if user is admin/owner
  useEffect(() => {
    if (!activeTenant?.id) return;
    const isPrivileged = profile?.role === 'admin' || profile?.role === 'owner';
    if (!isPrivileged) {
      setPendingRequestsCount(0);
      return;
    }

    let isSubscribed = true;
    api.getCommunityRequests(activeTenant.id).then((res) => {
      if (isSubscribed && res) {
        setPendingRequestsCount(res.pendingCount || 0);
      }
    }).catch(() => {
      if (isSubscribed) setPendingRequestsCount(0);
    });

    return () => {
      isSubscribed = false;
    };
  }, [activeTenant?.id, profile?.role]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-xs font-medium text-zinc-400">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Derive current active tab from pathname
  let currentTab: BottomNavTab = 'feed';
  if (pathname?.startsWith('/events')) {
    currentTab = 'events';
  } else if (pathname?.startsWith('/channels') || pathname?.startsWith('/chat')) {
    currentTab = 'chat';
  } else if (pathname?.startsWith('/profile')) {
    currentTab = 'profile';
  }

  const sessionObj: UserSession | null = profile
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
    : null;

  const tenantObj: Tenant | null = activeTenant
    ? {
        id: activeTenant.id,
        name: activeTenant.name,
        slug: activeTenant.slug,
        tagline: activeTenant.tagline || 'Corporate Workspace',
        memberCount: 1,
        createdAt: activeTenant.created_at || new Date().toISOString(),
        logoUrl: activeTenant.logo_url || undefined,
        allowedDomains: (activeTenant.allowed_domains as string[]) || [],
        isDiscoverable: activeTenant.is_discoverable ?? true,
        requiresApproval: activeTenant.requires_approval ?? false,
        industry: activeTenant.industry || 'Technology',
      }
    : null;

  return (
    <div className="flex flex-col min-h-dvh w-full max-w-full overflow-x-hidden bg-zinc-950 text-zinc-100 font-sans">
      <Header
        currentSession={sessionObj}
        onNavigate={(path) => router.push(path.startsWith('/') ? path : `/${path}`)}
        onOpenCreateCommunity={() => setIsCreateModalOpen(true)}
        onOpenJoinRequests={() => setIsJoinRequestsModalOpen(true)}
        pendingRequestsCount={pendingRequestsCount}
      />
      <main className="flex-1 w-full max-w-4xl mx-auto px-3.5 sm:px-6 pt-16 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:py-6 md:pb-6 min-w-0">
        {children}
      </main>
      <BottomNav
        currentTab={currentTab}
        onTabChange={(tab) => {
          if (tab === 'feed') router.push('/feed');
          else if (tab === 'events') router.push('/events');
          else if (tab === 'chat') router.push('/channels/general');
          else if (tab === 'profile') router.push('/profile');
        }}
      />

      {/* Workspace Creation Modal */}
      {isCreateModalOpen && (
        <CreateCommunityModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          currentSession={sessionObj}
          onCommunityCreated={(newCommunity) => {
            setIsCreateModalOpen(false);
            if (newCommunity?.id) {
              window.location.reload();
            }
          }}
        />
      )}

      {/* Join Requests Review Modal */}
      {isJoinRequestsModalOpen && tenantObj && (
        <JoinRequestsModal
          isOpen={isJoinRequestsModalOpen}
          onClose={() => {
            setIsJoinRequestsModalOpen(false);
            if (activeTenant?.id) {
              api.getCommunityRequests(activeTenant.id).then((res) => {
                setPendingRequestsCount(res?.pendingCount || 0);
              });
            }
          }}
          activeTenant={tenantObj}
          onRequestReviewed={() => {
            if (activeTenant?.id) {
              api.getCommunityRequests(activeTenant.id).then((res) => {
                setPendingRequestsCount(res?.pendingCount || 0);
              });
            }
          }}
        />
      )}
    </div>
  );
}
