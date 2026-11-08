'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingWizard } from '@/src/components/OnboardingWizard';
import { UserSession, Tenant } from '@/src/types';
import { api } from '@/src/lib/api';
import { useAuth } from '@/lib/context/AuthContext';

export default function OnboardingPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);

  useEffect(() => {
    api.getTenants().then((data) => {
      if (data && Array.isArray(data)) {
        setTenants(data);
      }
    }).catch(() => {
      setTenants([]);
    });
  }, []);

  const handleComplete = (_session: UserSession) => {
    router.push('/feed');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4">
      <OnboardingWizard
        currentSession={session}
        tenants={tenants}
        onComplete={handleComplete}
        onCancel={() => router.push('/feed')}
      />
    </div>
  );
}
