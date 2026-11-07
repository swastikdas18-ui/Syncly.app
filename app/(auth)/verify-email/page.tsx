'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase.ts';

export default function VerifyEmailPage() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      setLoading(true);
      setMsg(null);
      const redirectUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/auth/callback`
        : undefined;

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) throw error;
      setMsg('Verification email resent. Please check your inbox.');
    } catch (err: any) {
      setMsg(err?.message || 'Failed to resend verification email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-zinc-950 p-4 text-zinc-100">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl backdrop-blur-xl text-center">
        <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 mx-auto flex items-center justify-center mb-4 text-2xl">
          ✉
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Verify your email</h1>
        <p className="text-sm text-zinc-400 mt-2">
          Your account requires email verification before access is granted.
        </p>

        {msg && (
          <div className="my-4 rounded-lg bg-zinc-800 border border-zinc-700 p-3 text-xs text-zinc-300">
            {msg}
          </div>
        )}

        <form onSubmit={handleResend} className="mt-6 flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email to resend"
            className="w-full h-11 px-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors text-center"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium text-sm transition-colors flex items-center justify-center disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Resending...' : 'Resend Verification Email'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-zinc-800 text-center">
          <Link href="/login" className="text-xs text-zinc-400 hover:text-zinc-200">
            ← Return to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

