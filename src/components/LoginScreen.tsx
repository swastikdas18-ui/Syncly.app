'use client';

import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, ArrowRight, User, Loader2, AlertCircle } from 'lucide-react';
import { UserSession } from '../types.ts';
import { supabase } from '@/lib/supabase.ts';

interface LoginScreenProps {
  onLoginSuccess: (session: UserSession, redirectTo: 'onboarding' | 'feed') => void;
  defaultTenantId?: string;
}

export function LoginScreen({ onLoginSuccess, defaultTenantId }: LoginScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please provide a valid corporate email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'signup') {
        if (!fullName.trim()) {
          setError('Full name is required for registration.');
          setIsLoading(false);
          return;
        }

        // Sign up via official Supabase Auth
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              tenant_id: defaultTenantId,
            },
          },
        });

        if (signUpError) {
          throw signUpError;
        }

        if (data.user && data.session) {
          const userSession: UserSession = {
            user: {
              id: data.user.id,
              email: cleanEmail,
              fullName: fullName.trim(),
              headline: 'Enterprise Member',
              role: 'employee',
              tenantId: defaultTenantId || '',
              avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanEmail)}`,
              hasCompletedOnboarding: false,
            },
            token: data.session.access_token,
          };

          saveSession(userSession);
          onLoginSuccess(userSession, 'onboarding');
        } else {
          setSuccessNotice('Account created! Please check your email to confirm your account, or sign in.');
          setMode('signin');
        }
      } else {
        // Sign in via official Supabase Auth
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (signInError) {
          setError(signInError.message || 'Invalid email or password.');
          setIsLoading(false);
          return;
        }

        if (data.session && data.user) {
          const user = data.user;
          const tenantId = user.user_metadata?.tenant_id || defaultTenantId || '';
          const userSession: UserSession = {
            user: {
              id: user.id,
              email: user.email || cleanEmail,
              fullName: user.user_metadata?.full_name || cleanEmail.split('@')[0],
              headline: user.user_metadata?.headline || 'Enterprise Member',
              role: user.user_metadata?.role || 'employee',
              tenantId,
              avatarUrl: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanEmail)}`,
              hasCompletedOnboarding: !!user.user_metadata?.has_completed_onboarding,
            },
            token: data.session.access_token,
          };

          saveSession(userSession);
          onLoginSuccess(userSession, userSession.user.hasCompletedOnboarding ? 'feed' : 'onboarding');
          return;
        }
      }
    } catch (err: any) {
      console.warn('Authentication error:', err);
      setError(err?.message || 'Authentication service error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/feed` : undefined,
        },
      });
      if (oauthError) {
        throw oauthError;
      }
    } catch (err: any) {
      setError(err?.message || 'Google OAuth connection failed. Please sign in with your corporate email.');
      setIsLoading(false);
    }
  };

  const saveSession = (session: UserSession) => {
    try {
      localStorage.setItem('syncly_session', JSON.stringify(session));
      if (session.user.tenantId) {
        localStorage.setItem('syncly_tenant_id', session.user.tenantId);
        localStorage.setItem('active_community_id', session.user.tenantId);
        localStorage.setItem('x-tenant-id', session.user.tenantId);
        document.cookie = `x-tenant-id=${session.user.tenantId}; path=/; max-age=2592000`;
        document.cookie = `active_community_id=${session.user.tenantId}; path=/; max-age=2592000`;
      }
      document.cookie = `syncly_role=${session.user.role}; path=/; max-age=2592000`;
      if (session.user.hasCompletedOnboarding) {
        document.cookie = `syncly_onboarded=true; path=/; max-age=2592000`;
      }
    } catch {}
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8 relative">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Centered Production Auth Card */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10">
        
        {/* Branding Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20 mb-3 border border-blue-400/30">
            <ShieldCheck className="w-6 h-6 text-white stroke-[2.2]" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            Syncly
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono font-medium">
              Enterprise
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Corporate Communication &amp; Team Workspace
          </p>
        </div>

        {/* Tab Switcher: Sign In vs Sign Up */}
        <div className="flex p-1 bg-zinc-950/80 rounded-xl border border-zinc-800 mb-6">
          <button
            type="button"
            onClick={() => { setMode('signin'); setError(null); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === 'signin'
                ? 'bg-zinc-800 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              mode === 'signup'
                ? 'bg-zinc-800 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {successNotice && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-start gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1" />
            <span className="leading-relaxed">{successNotice}</span>
          </div>
        )}

        {/* Official Credentials Form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="auth-fullname" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-fullname"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Sarah Chen"
                  required={mode === 'signup'}
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-zinc-950/80 border border-zinc-700/80 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-zinc-300 mb-1.5">
              Corporate Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="auth-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-zinc-950/80 border border-zinc-700/80 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="auth-password" className="text-xs font-medium text-zinc-300">
                Password
              </label>
              {mode === 'signin' && (
                <span className="text-[11px] text-zinc-500 hover:text-zinc-300 cursor-pointer">
                  Forgot password?
                </span>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="auth-password"
                name="password"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-zinc-950/80 border border-zinc-700/80 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{mode === 'signup' ? 'Creating Account...' : 'Authenticating...'}</span>
              </>
            ) : (
              <>
                <span>{mode === 'signup' ? 'Register Account' : 'Sign In to Workspace'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-800" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-zinc-900 px-3 text-zinc-500 font-medium">Or continue with</span>
          </div>
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-xl bg-zinc-950/90 hover:bg-zinc-800/80 border border-zinc-700/90 text-zinc-200 font-medium text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google Workspace</span>
        </button>

        {/* Security Notice */}
        <p className="text-[11px] text-zinc-500 text-center mt-5">
          Protected by Supabase Auth with PostgreSQL Row-Level Security (RLS) isolation.
        </p>

      </div>
    </div>
  );
}

export default LoginScreen;
