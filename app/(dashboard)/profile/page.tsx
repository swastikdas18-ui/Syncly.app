'use client';

import React from 'react';
import { ProfileView } from '@/src/components/ProfileView.tsx';
import { useUser, useTenant } from '@/lib/context/AuthContext.tsx';
import { useRouter } from 'next/navigation';

export default function ProfileDashboardPage() {
  const router = useRouter();
  const { user, profile, refreshProfile, signOut } = useUser();
  const { activeTenant } = useTenant();

  const handleUpdateProfile = async (updatedData: any) => {
    // Refresh profile in context
    await refreshProfile();
  };

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const sessionObj: any = profile
    ? {
        user: {
          id: profile.id,
          email: user?.email || '',
          fullName: profile.full_name || 'Member',
          headline: 'Corporate Team Member',
          role: profile.role || 'employee',
          tenantId: profile.tenant_id || activeTenant?.id || '',
          hasCompletedOnboarding: true,
        },
        token: 'auth-session',
      }
    : null;

  const tenantModel: any = activeTenant ? {
    id: activeTenant.id,
    name: activeTenant.name,
    slug: activeTenant.slug,
    createdAt: activeTenant.created_at,
    tagline: 'Enterprise Workspace',
    memberCount: 1,
  } : undefined;

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
