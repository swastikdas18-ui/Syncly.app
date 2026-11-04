'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingWizard } from '@/src/components/OnboardingWizard';
import { UserSession, Tenant } from '@/src/types';

const DEMO_TENANTS: Tenant[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Acme Corp',
    slug: 'acme-corp',
    createdAt: '2025-01-15T08:00:00Z',
    tagline: 'Leading global cloud infrastructure & logistics enterprise',
    memberCount: 1420
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Globex Tech',
    slug: 'globex-tech',
    createdAt: '2025-02-01T10:30:00Z',
    tagline: 'Autonomous AI robotics & high-performance computing labs',
    memberCount: 890
  }
];

export default function OnboardingPage() {
  const router = useRouter();

  const handleComplete = (_session: UserSession) => {
    router.push('/feed');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4">
      <OnboardingWizard
        currentSession={null}
        tenants={DEMO_TENANTS}
        onComplete={handleComplete}
        onCancel={() => router.push('/feed')}
      />
    </div>
  );
}
