'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, ArrowRight, Building2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase.ts';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid corporate email address.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      const redirectUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/reset-password`
        : 'https://syncly-app.vercel.app/reset-password';

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      });

      if (error) {
        throw error;
      }

      setSubmitted(true);
    } catch {
      // Security best practice: Always show the same generic confirmation to avoid account enumeration
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-950 p-4 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/95 p-6 sm:p-8 shadow-2xl backdrop-blur-xl transition-all">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 mb-3 shadow-inner">
            <Building2 className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Reset Your Password</h1>
          <p className="text-sm text-slate-400 mt-1">Enterprise Multi-Tenant Account Recovery</p>
        </div>

        {submitted ? (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-emerald-200">Recovery Instructions Sent</p>
                <p className="text-emerald-300/90 leading-relaxed">
                  If a matching corporate account exists for <span className="font-mono font-medium text-emerald-100">{email}</span>, a secure password-reset link has been dispatched. Please check your inbox and spam folders.
                </p>
              </div>
            </div>

            <div className="pt-2 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Corporate Sign In</span>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleResetRequest} className="flex flex-col gap-4.5" noValidate>
            {errorMsg && (
              <div
                role="alert"
                aria-live="assertive"
                className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3.5 text-xs text-rose-300 flex items-start gap-2.5 animate-in fade-in duration-200"
              >
                <span className="shrink-0 font-bold">Error:</span>
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label htmlFor="recovery-email" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Corporate Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" aria-hidden="true" />
                </div>
                <input
                  id="recovery-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                A one-time cryptographic recovery link will be sent to your verified corporate address.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 font-semibold text-sm text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-indigo-600/25 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Dispatching Link...</span>
                </div>
              ) : (
                <>
                  <span>Send Recovery Link</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </>
              )}
            </button>

            <div className="mt-4 pt-4 border-t border-slate-800 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </Link>
            </div>
          </form>
        )}

        <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400" aria-hidden="true" />
          <span>Encrypted Account Recovery Protocol</span>
        </div>
      </div>
    </div>
  );
}

