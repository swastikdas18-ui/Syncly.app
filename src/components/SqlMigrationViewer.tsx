import React, { useState } from 'react';
import { 
  FileCode2, 
  Copy, 
  Check, 
  Download, 
  Database, 
  Shield, 
  Layers, 
  HardDrive,
  ExternalLink
} from 'lucide-react';
import { SUPABASE_MIGRATION_SQL } from '../lib/migrationSql.ts';

export const SqlMigrationViewer: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(SUPABASE_MIGRATION_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleDownload = () => {
    const blob = new Blob([SUPABASE_MIGRATION_SQL], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'syncly_supabase_migration.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-3 sm:py-8 px-2.5 sm:px-6">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-6 border-b border-slate-200 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1">
            <FileCode2 className="w-4 h-4" />
            <span>Database Architecture Blueprint</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Supabase PostgreSQL Migration &amp; RLS
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Production-ready, idempotent SQL migration defining multi-tenant tables, composite indexes, storage rules, and publication triggers.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied to Clipboard</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy SQL</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .sql</span>
          </button>
        </div>
      </div>

      {/* SCHEMA OVERVIEW STATS */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Database className="w-4 h-4 text-blue-600" />
            <span>Core Tables</span>
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono">6 Tables</div>
          <div className="text-[11px] text-slate-400 mt-0.5">tenants, profiles, posts...</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>RLS Policies</span>
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono">10+ Policies</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Strict tenant isolation</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Composite Indexes</span>
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono">4 Indexes</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Optimized tenant sort</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <HardDrive className="w-4 h-4 text-amber-600" />
            <span>Storage Bucket</span>
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono">community-media</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Folder scoped uploads</div>
        </div>
      </div>

      {/* SQL CODE DISPLAY */}
      <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-lg">
        <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <span className="text-xs font-mono text-slate-400 ml-2">supabase/migrations/20260301_multi_tenant_rls.sql</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            <Copy className="w-3 h-3" />
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        <div className="p-4 max-h-[640px] overflow-y-auto">
          <pre className="text-xs font-mono text-slate-200 leading-relaxed overflow-x-auto">
            {SUPABASE_MIGRATION_SQL}
          </pre>
        </div>
      </div>

    </div>
  );
};
