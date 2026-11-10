'use client';

import React from 'react';
import { ProfileView } from '@/src/components/ProfileView.tsx';
import { useUser, useTenant } from '@/lib/context/AuthContext.tsx';
import { useWorkspace } from '@/lib/context/WorkspaceContext.tsx';
import { useRouter } from 'next/navigation';

export default function ProfileDashboardPage() {
  const router = useRouter();
  const { user, profile, refreshProfile, signOut } = useUser();
  const { activeTenant } = useTenant();
  const { activeCommunity } = useWorkspace();

  const handleUpdateProfile = async (_updatedData: any) => {
    await refreshProfile();
  };

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  // An active workspace exists ONLY if verified in activeTenant or activeCommunity
  const verifiedActiveTenant = activeCommunity || activeTenant;
  const resolvedTenantId = verifiedActiveTenant?.id || '';
  const resolvedTenantName = verifiedActiveTenant?.name || '';
  const resolvedTenantSlug = verifiedActiveTenant?.slug || '';

  const userRole = (profile?.role || (user as any)?.role || 'employee').toLowerCase();

  const sessionObj: any = user ? {
    user: {
      id: profile?.id || user.id,
      email: user.email || '',
      fullName: profile?.full_name || user.email?.split('@')[0] || 'Team Member',
      headline: (profile as any)?.headline || 'Corporate Team Member',
      role: userRole,
      tenantId: resolvedTenantId,
      hasCompletedOnboarding: true,
      avatarUrl: profile?.avatar_url || (user as any)?.avatar_url,
    },
    token: 'auth-session',
  } : null;

  const tenantModel: any = (resolvedTenantId && resolvedTenantName) ? {
    id: resolvedTenantId,
    name: resolvedTenantName,
    slug: resolvedTenantSlug,
    createdAt: (verifiedActiveTenant as any)?.created_at || (verifiedActiveTenant as any)?.createdAt || new Date().toISOString(),
    tagline: (verifiedActiveTenant as any)?.tagline || 'Corporate Workspace',
    memberCount: (verifiedActiveTenant as any)?.memberCount || 1,
  } : undefined;

  if (!sessionObj) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-slate-400">Loading user profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      <ProfileView
        session={sessionObj}
        currentTenant={tenantModel}
        onRestartOnboarding={() => router.push('/onboarding')}
        onLogout={handleLogout}
        onSelectView={(view) => router.push(view.startsWith('/') ? view : `/${view}`)}
        onUpdateProfile={handleUpdateProfile}
      />
    </div>
  );
}
