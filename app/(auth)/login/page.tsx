'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LoginScreen } from '@/src/components/LoginScreen';
import { UserSession } from '@/src/types';

export default function LoginPage() {
  const router = useRouter();

  const handleLoginSuccess = (session: UserSession, redirectTo: 'onboarding' | 'feed') => {
    if (redirectTo === 'onboarding') {
      router.push('/onboarding');
    } else {
      router.push('/feed');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4">
      <LoginScreen onLoginSuccess={handleLoginSuccess} />
    </div>
  );
}
