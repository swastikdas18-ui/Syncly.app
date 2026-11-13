import Link from 'next/link';
import { Compass, ArrowRight, Building2 } from 'lucide-react';

export default function GlobalNotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/95 p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 mx-auto flex items-center justify-center shadow-inner">
          <Compass className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Page Not Found</h1>
          <p className="text-xs sm:text-sm text-slate-400">
            The requested resource or page does not exist or has been moved.
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2.5">
          <Link
            href="/feed"
            className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition-all shadow-md shadow-indigo-600/20"
          >
            <span>Return to Workspace Feed</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-300 transition-colors"
          >
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Sign In to Syncly</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

