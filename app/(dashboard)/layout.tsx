'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser, useTenant } from '@/lib/context/AuthContext.tsx';
import { useWorkspace } from '@/lib/context/WorkspaceContext.tsx';
import { Header } from '@/components/navigation/Header.tsx';
import { Sidebar } from '@/components/navigation/Sidebar.tsx';
import { BottomNav } from '@/components/navigation/BottomNav.tsx';
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
  const { activeCommunity } = useWorkspace();

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinRequestsModalOpen, setIsJoinRequestsModalOpen] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Resolve workspace role from verified active membership (fallback to profile)
  const resolvedRole = activeCommunity?.userRole || (profile?.role as any) || 'employee';

  // Workspace creation policy: Managers, Members, and Interns cannot create workspaces
  const canCreateWorkspace = !resolvedRole || resolvedRole === 'admin' || resolvedRole === 'owner';

  // Restore sidebar collapse state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('syncly_sidebar_collapsed');
      if (saved !== null) {
        setSidebarCollapsed(saved === 'true');
      }
    } catch {}
  }, []);

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('syncly_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Enforce session boundary - redirect to /login if unauthenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Load pending join requests count if user is admin/owner
  useEffect(() => {
    if (!activeTenant?.id) return;
    const isPrivileged = resolvedRole === 'admin' || resolvedRole === 'owner';
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
      <div className="min-h-dvh bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-xs font-medium text-slate-400">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const sessionObj: UserSession | null = profile
    ? {
        user: {
          id: profile.id,
          email: user.email || '',
          fullName: profile.full_name || 'Member',
          headline: 'Corporate Team Member',
          role: (resolvedRole as any) || 'employee',
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
    <div className="min-h-dvh w-full max-w-full bg-slate-950 text-slate-100 font-sans flex">
      {/* Persistent Desktop Sidebar */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
        pendingRequestsCount={pendingRequestsCount}
        onOpenCreateCommunity={canCreateWorkspace ? () => setIsCreateModalOpen(true) : undefined}
        onOpenJoinRequests={() => setIsJoinRequestsModalOpen(true)}
      />

      {/* Main Container: dynamically padded based on sidebar width */}
      <div 
        className={`flex-1 flex flex-col min-h-dvh min-w-0 transition-all duration-300 w-full ${
          sidebarCollapsed ? 'md:pl-18' : 'md:pl-64'
        }`}
      >
        <Header
          currentSession={sessionObj}
          onNavigate={(path) => router.push(path.startsWith('/') ? path : `/${path}`)}
          onOpenCreateCommunity={canCreateWorkspace ? () => setIsCreateModalOpen(true) : undefined}
          onOpenJoinRequests={() => setIsJoinRequestsModalOpen(true)}
          pendingRequestsCount={pendingRequestsCount}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebarCollapse}
        />

        {/* Content Area with smooth responsive constraints and safe-areas */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 pt-20 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:py-8 md:pt-22 md:pb-12 min-w-0">
          {children}
        </main>

        {/* Responsive Mobile Bottom Navigation */}
        <BottomNav />
      </div>

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
