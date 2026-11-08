'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase.ts';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName.trim()) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      const redirectUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/auth/callback`
        : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName.trim(),
            // Security: Never allow client to inject privileged roles or tenant IDs
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      setSuccess(true);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err?.message || 'Registration failed.');
    }
  };

  if (success) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-zinc-950 p-4 text-zinc-100">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl backdrop-blur-xl text-center">
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 mx-auto flex items-center justify-center mb-4 text-2xl">
            ✉
          </div>
          <h2 className="text-xl font-bold">Check your inbox</h2>
          <p className="text-sm text-zinc-400 mt-2">
            We sent a verification link to <span className="text-zinc-200 font-medium">{email}</span>.
            Please confirm your email address to activate your account.
          </p>
          <div className="mt-6 pt-6 border-t border-zinc-800">
            <Link
              href="/login"
              className="inline-block px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-medium transition-colors"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-zinc-950 p-4 text-zinc-100">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="text-sm text-zinc-400 mt-1">Join your organization on Syncly</p>
        </div>

        {errorMsg && (
          <div
            id="register-error"
            role="alert"
            aria-live="polite"
            className="mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400"
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleRegister} className="flex flex-col gap-4" noValidate>
          <div>
            <label htmlFor="register-fullname" className="block text-xs font-medium text-zinc-300 mb-1.5">
              Full Name <span className="text-indigo-400" aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </label>
            <input
              id="register-fullname"
              name="fullName"
              type="text"
              required
              aria-required="true"
              aria-invalid={!!errorMsg && !fullName.trim()}
              aria-describedby={errorMsg ? 'register-error' : undefined}
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Elena Rostova"
              className="w-full h-11 px-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="register-email" className="block text-xs font-medium text-zinc-300 mb-1.5">
              Corporate Email <span className="text-indigo-400" aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </label>
            <input
              id="register-email"
              name="email"
              type="email"
              required
              aria-required="true"
              aria-invalid={!!errorMsg && !email.trim()}
              aria-describedby={errorMsg ? 'register-error' : undefined}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full h-11 px-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="register-password" className="block text-xs font-medium text-zinc-300 mb-1.5">
              Password <span className="text-indigo-400" aria-hidden="true">*</span>
              <span className="sr-only">(required, minimum 8 characters)</span>
            </label>
            <input
              id="register-password"
              name="password"
              type="password"
              required
              aria-required="true"
              aria-invalid={!!errorMsg && password.length < 8}
              aria-describedby={errorMsg ? 'register-error' : undefined}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full h-11 px-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 mt-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium text-sm transition-colors flex items-center justify-center disabled:opacity-50 cursor-pointer shadow-lg shadow-indigo-600/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-950"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-zinc-800/80 text-center">
          <p className="text-xs text-zinc-400">
            Already have an account?{' '}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

