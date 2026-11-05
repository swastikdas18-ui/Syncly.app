'use client';

import React from 'react';
import { ProfileView } from '@/src/components/ProfileView.tsx';
import { useUser, useTenant } from '@/lib/context/AuthContext.tsx';
import { useWorkspace, DEFAULT_WORKSPACE } from '@/lib/context/WorkspaceContext.tsx';
import { useRouter } from 'next/navigation';

export default function ProfileDashboardPage() {
  const router = useRouter();
  const { user, profile, refreshProfile, signOut } = useUser();
  const { activeTenant } = useTenant();
  const { activeCommunity } = useWorkspace();

  const handleUpdateProfile = async (updatedData: any) => {
    // Refresh profile in context
    await refreshProfile();
  };

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  // Derive organization details dynamically with canonical fallbacks
  const resolvedTenantId = activeTenant?.id || activeCommunity?.id || DEFAULT_WORKSPACE.id;
  const resolvedTenantName = activeTenant?.name || activeCommunity?.name || DEFAULT_WORKSPACE.name;
  const resolvedTenantSlug = activeTenant?.slug || activeCommunity?.slug || DEFAULT_WORKSPACE.slug;

  // Resolve role: 'intern' for Demo Intern, 'admin' for Demo Mentor, or profile role
  const rawRole = (profile?.role || user?.role || 'employee').toLowerCase();
  const resolvedRole = rawRole.includes('intern') ? 'intern' : rawRole.includes('mentor') || rawRole.includes('admin') || rawRole.includes('owner') ? 'admin' : 'employee';

  const sessionObj: any = {
    user: {
      id: profile?.id || user?.id || '00000000-0000-0000-0000-000000000001',
      email: user?.email || (resolvedRole === 'intern' ? 'intern@syncly.internal' : 'mentor@syncly.internal'),
      fullName: profile?.full_name || (resolvedRole === 'intern' ? 'Demo Intern' : 'Demo Mentor'),
      headline: 'Corporate Team Member',
      role: resolvedRole,
      tenantId: resolvedTenantId,
      hasCompletedOnboarding: true,
    },
    token: 'auth-session',
  };

  const tenantModel: any = {
    id: resolvedTenantId,
    name: resolvedTenantName,
    slug: resolvedTenantSlug,
    createdAt: activeTenant?.created_at || new Date().toISOString(),
    tagline: 'Enterprise Workspace',
    memberCount: 1,
  };

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
