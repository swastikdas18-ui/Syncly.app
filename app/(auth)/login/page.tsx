'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDemoLogin = async (role: 'intern' | 'mentor') => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error || 'Failed to authenticate demo persona.');
      }

      const data = await res.json();

      // Mirror user & workspace into LocalStorage for immediate CSR state hydration
      if (data?.user) {
        localStorage.setItem('syncly_user', JSON.stringify(data.user));
        localStorage.setItem('active_tenant_id', data.user.tenantId);
      }
      if (data?.workspace) {
        localStorage.setItem('syncly_workspace', JSON.stringify(data.workspace));
      }

      // Force hard navigation to trigger fresh server middleware validation
      window.location.href = '/feed';
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err?.message || 'Failed to authenticate demo persona.');
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-zinc-950 p-4 text-zinc-100">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Syncly Enterprise</h1>
          <p className="text-sm text-zinc-400 mt-1">Select a demo persona to enter</p>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleDemoLogin('intern')}
            className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium text-sm transition-colors flex items-center justify-center disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Entering...' : 'Demo Intern'}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleDemoLogin('mentor')}
            className="w-full h-11 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-medium text-sm transition-colors flex items-center justify-center disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Entering...' : 'Demo Mentor'}
          </button>
        </div>
      </div>
    </div>
  );
}
