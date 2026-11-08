'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase.ts';

/**
 * Root Landing Entrypoint: /
 * Redirects authenticated users to /feed, and unauthenticated visitors to /login.
 * Eliminates unauthenticated mounting of dashboard feeds and 401 console noise.
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    async function checkAuthAndRedirect() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          router.replace('/feed');
        } else {
          router.replace('/login');
        }
      } catch {
        router.replace('/login');
      }
    }
    checkAuthAndRedirect();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        <p className="text-xs font-medium text-slate-400">Loading Syncly...</p>
      </div>
    </div>
  );
}
