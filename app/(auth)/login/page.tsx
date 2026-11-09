'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Building2, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase.ts';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/feed';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both corporate email and password.');
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
          throw new Error('Please verify your email address before logging in. Check your inbox for the confirmation link.');
        }
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid corporate email or password. Please re-check your credentials.');
        }
        throw new Error(error.message);
      }

      if (!data?.session) {
        throw new Error('Failed to establish authenticated session.');
      }

      // Hard redirect to ensure Edge middleware and server components re-evaluate session cookies
      window.location.href = redirectPath;
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err?.message || 'Authentication failed. Please try again.');
    }
  };

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/95 p-6 sm:p-8 shadow-2xl backdrop-blur-xl transition-all">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 mb-3 shadow-inner">
          <Building2 className="w-6 h-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">Sign in to Syncly</h1>
        <p className="text-sm text-slate-400 mt-1">Enterprise Multi-Tenant Workspace Hub</p>
      </div>

      {errorMsg && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-5 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3.5 text-xs text-rose-300 flex items-start gap-2.5 animate-in fade-in duration-200"
        >
          <span className="shrink-0 font-bold">Error:</span>
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="flex flex-col gap-4.5" noValidate>
        <div>
          <label htmlFor="login-email" className="block text-xs font-semibold text-slate-300 mb-1.5">
            Corporate Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Mail className="w-4 h-4" aria-hidden="true" />
            </div>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="login-password" className="block text-xs font-semibold text-slate-300">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Lock className="w-4 h-4" aria-hidden="true" />
            </div>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full h-11 pl-10 pr-11 rounded-xl bg-slate-950/80 border border-slate-700/80 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 focus:outline-hidden cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 mt-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 font-semibold text-sm text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-indigo-600/25 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span>Authenticating...</span>
            </div>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-800 text-center">
        <p className="text-xs text-slate-400">
          New to Syncly?{' '}
          <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors focus-visible:outline-hidden focus-visible:underline">
            Register your corporate account
          </Link>
        </p>
      </div>

      <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
        <ShieldCheck className="w-3.5 h-3.5 text-teal-400" aria-hidden="true" />
        <span>End-to-end multi-tenant RLS isolation active</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-950 p-4 text-slate-100">
      <Suspense fallback={<div className="text-slate-500 text-sm">Loading sign in...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
