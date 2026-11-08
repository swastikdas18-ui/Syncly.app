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

  // Derive organization details dynamically
  const resolvedTenantId = activeTenant?.id || activeCommunity?.id || profile?.tenant_id || '';
  const resolvedTenantName = activeTenant?.name || activeCommunity?.name || 'Workspace';
  const resolvedTenantSlug = activeTenant?.slug || activeCommunity?.slug || '';

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

  const tenantModel: any = resolvedTenantId ? {
    id: resolvedTenantId,
    name: resolvedTenantName,
    slug: resolvedTenantSlug,
    createdAt: activeTenant?.created_at || new Date().toISOString(),
    tagline: activeTenant?.tagline || 'Corporate Workspace',
    memberCount: 1,
  } : null;

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
        onSelectView={(view) => router.push(`/${view}`)}
        onUpdateProfile={handleUpdateProfile}
      />
    </div>
  );
}
