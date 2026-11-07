'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase.ts';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/feed';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.includes('Email not confirmed')) {
          throw new Error('Please verify your email address before logging in. Check your inbox.');
        }
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password.');
        }
        throw new Error(error.message);
      }

      if (!data?.session) {
        throw new Error('Failed to establish session.');
      }

      // Hard redirect to ensure Edge middleware and server components re-evaluate session cookies
      window.location.href = redirectPath;
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err?.message || 'Login failed.');
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl backdrop-blur-xl">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Sign in to Syncly</h1>
        <p className="text-sm text-zinc-400 mt-1">Enter your corporate credentials</p>
      </div>

      {errorMsg && (
        <div className="mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">Corporate Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full h-11 px-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            className="w-full h-11 px-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 mt-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium text-sm transition-colors flex items-center justify-center disabled:opacity-50 cursor-pointer shadow-lg shadow-indigo-600/20"
        >
          {loading ? 'Authenticating...' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-zinc-800/80 text-center">
        <p className="text-xs text-zinc-400">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-zinc-950 p-4 text-zinc-100">
      <Suspense fallback={<div className="text-zinc-500 text-sm">Loading sign in...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
