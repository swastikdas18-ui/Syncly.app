'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Building2, 
  ShieldCheck, 
  MessageSquare, 
  Users, 
  Compass, 
  ArrowRight, 
  Lock, 
  Zap, 
  Sparkles,
  Layers,
  ChevronRight,
  Globe2
} from 'lucide-react';

export default function RootLandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* 1. Global Navigation Header */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold text-base shadow-sm">
            S
          </div>
          <div>
            <span className="font-bold text-slate-100 tracking-tight text-base leading-none block">
              Syncly
            </span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide">
              Enterprise Hub
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/login"
            className="text-xs sm:text-sm font-semibold text-slate-300 hover:text-white px-3.5 py-2 rounded-xl hover:bg-slate-900 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
          >
            <span>Get Started</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </nav>
      </header>

      {/* 2. Hero Section */}
      <main className="flex-1 pt-28 pb-16 px-4 sm:px-8 max-w-6xl mx-auto flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Next-Generation Corporate Workspaces</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-100 leading-[1.15]">
            Unified Communication &amp; Multi-Tenant Workspaces
          </h1>

          <p className="text-base sm:text-lg text-slate-400 leading-relaxed font-normal">
            Syncly powers cross-organization team communication, dedicated department channels, real-time messaging, and verified membership directory with enterprise-grade tenant isolation.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold text-white transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2"
            >
              <span>Join Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sm font-bold text-slate-200 transition-colors flex items-center justify-center gap-2"
            >
              <Building2 className="w-4 h-4 text-slate-400" />
              <span>Sign In to Hub</span>
            </Link>
          </div>
        </div>

        {/* 3. Feature Highlights Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-100">Team Channels &amp; Chat</h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Real-time collaboration across dedicated channels, threaded updates, announcements, and direct team discussions.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-100">Tenant Isolation &amp; RBAC</h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Strict multi-tenant security boundaries enforcing Owner, Admin, Manager, Member, and Intern permissions at the database level.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-100">Multi-Workspace Directory</h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Explore corporate communities, request membership with verified domain matching, and switch seamlessly between organizations.
            </p>
          </div>
        </div>

        {/* 4. Security & Compliance Callout */}
        <div className="mt-12 p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">Cryptographically Verified Authentication</p>
              <p className="text-xs text-slate-400">Powered by Supabase Auth with Row-Level Security on PostgreSQL 17.</p>
            </div>
          </div>
          <Link
            href="/login"
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 shrink-0"
          >
            <span>Access Workspace</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </main>

      {/* 5. Minimal Enterprise Footer */}
      <footer className="border-t border-slate-800/80 py-6 px-4 sm:px-8 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>&copy; {new Date().getFullYear()} Syncly.app. Enterprise Communication Platform.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <Link href="/login" className="hover:text-slate-200 transition-colors">Sign In</Link>
            <Link href="/register" className="hover:text-slate-200 transition-colors">Create Account</Link>
            <Link href="/forgot-password" className="hover:text-slate-200 transition-colors">Password Recovery</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
