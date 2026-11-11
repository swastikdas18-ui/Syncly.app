'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Building2, 
  ArrowLeft, 
  ShieldCheck, 
  Globe, 
  Lock, 
  Plus, 
  Trash2, 
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useUser } from '@/lib/context/AuthContext.tsx';
import { useWorkspace } from '@/lib/context/WorkspaceContext.tsx';
import { api } from '@/src/lib/api.ts';

const INDUSTRY_PRESETS = [
  'Enterprise Software & SaaS',
  'Cloud Infrastructure & DevOps',
  'Fintech & Payments',
  'Robotics & Autonomous Systems',
  'Biotech & Life Sciences',
  'Cybersecurity & Trust',
  'E-Commerce & Retail Tech',
  'Media, Gaming & Entertainment',
];

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=120&auto=format&fit=crop&q=80',
];

export default function NewCommunityPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useUser();
  const { switchCommunity } = useWorkspace();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugCustomized, setIsSlugCustomized] = useState(false);
  const [tagline, setTagline] = useState('');
  const [industry, setIndustry] = useState('Enterprise Software & SaaS');
  const [logoUrl, setLogoUrl] = useState(AVATAR_PRESETS[0]);
  
  // Domains
  const [domainInput, setDomainInput] = useState('');
  const [allowedDomains, setAllowedDomains] = useState<string[]>(() => {
    const userDomain = user?.email?.split('@')[1];
    return userDomain ? [userDomain] : ['company.internal'];
  });

  // Privacy & Access
  const [isDiscoverable, setIsDiscoverable] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isSlugCustomized) {
      const generated = val
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setSlug(generated);
    }
  };

  const handleAddDomain = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    const clean = domainInput.trim().replace(/^@/, '').toLowerCase();
    if (clean && !allowedDomains.includes(clean)) {
      setAllowedDomains([...allowedDomains, clean]);
      setDomainInput('');
    }
  };

  const handleRemoveDomain = (domainToRemove: string) => {
    setAllowedDomains(allowedDomains.filter((d) => d !== domainToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Please enter a community name.');
      return;
    }
    if (allowedDomains.length === 0) {
      setErrorMessage('Please specify at least one allowed corporate domain (e.g. acme.com).');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await api.createCommunity({
        name: name.trim(),
        slug: slug.trim() || undefined,
        tagline: tagline.trim() || 'Official Corporate Workspace & Knowledge Hub',
        logoUrl,
        allowedDomains,
        requiresApproval,
        isDiscoverable,
        industry,
        creatorName: profile?.full_name || user?.email?.split('@')[0] || 'Community Founder',
        creatorEmail: user?.email || '',
      });

      if (!res.success || !res.data) {
        setErrorMessage(res.error || 'Failed to create workspace.');
        setIsSubmitting(false);
        return;
      }

      setSuccessData(res.data);
      setIsSubmitting(false);
      
      // Auto-switch to newly created community and navigate to feed
      try {
        switchCommunity(res.data.id);
      } catch (err) {
        console.warn('Auto-switch error:', err);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error creating workspace.');
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-xs font-medium text-slate-400">Verifying credentials...</p>
        </div>
      </div>
    );
  }

  // Fail-closed authorization: Admins and Owners can create workspaces; missing role or non-admin roles are restricted
  const canCreate = profile?.role === 'admin' || profile?.role === 'owner';
  if (!canCreate && !authLoading) {
    return (
      <div className="w-full max-w-xl mx-auto py-12 text-center">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 backdrop-blur-xl shadow-2xl space-y-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">Restricted Action</h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Workspace creation is restricted to Organization Administrators and Owners. Please contact your workspace administrator to provision a new tenant.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => router.push('/feed')}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Return to Feed
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (successData) {
    return (
      <div className="w-full max-w-2xl mx-auto py-8">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center backdrop-blur-xl shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center mb-4 text-2xl">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100">Workspace Created Successfully!</h2>
          <p className="text-sm text-slate-400 mt-2">
            <strong className="text-slate-200">{successData.name}</strong> (@{successData.slug}) is now active with PostgreSQL RLS tenant partition.
          </p>
          <div className="mt-4 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs font-mono text-slate-400 max-w-md mx-auto">
            Tenant ID: {successData.id}
          </div>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => router.push('/feed')}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors cursor-pointer"
            >
              Enter Workspace Feed
            </button>
            <button
              onClick={() => {
                setSuccessData(null);
                setName('');
                setSlug('');
                setTagline('');
              }}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-200 transition-colors cursor-pointer"
            >
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto py-4 sm:py-6">
      {/* Header Banner */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <Link
            href="/communities/explore"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Explore
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-400" />
            Create Corporate Workspace
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Establish a verified, isolated multi-tenant organization hub on Syncly.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 text-xs sm:text-sm text-rose-400 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Core Identity */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center font-bold">1</span>
            Organization Identity
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="workspace-name" className="block text-xs font-medium text-slate-300 mb-1.5">
                Workspace Name <span className="text-indigo-400">*</span>
              </label>
              <input
                id="workspace-name"
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Acme Global Corporation"
                className="w-full h-10 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="workspace-slug" className="block text-xs font-medium text-slate-300 mb-1.5">
                Workspace Slug (@identifier)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-mono">@</span>
                <input
                  id="workspace-slug"
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => {
                    setIsSlugCustomized(true);
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                  }}
                  placeholder="acme-corp"
                  className="w-full h-10 pl-8 pr-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="workspace-tagline" className="block text-xs font-medium text-slate-300 mb-1.5">
              Tagline / Mission Statement
            </label>
            <input
              id="workspace-tagline"
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Enterprise platform engineering and autonomous systems"
              className="w-full h-10 px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="workspace-industry" className="block text-xs font-medium text-slate-300 mb-1.5">
                Industry Preset
              </label>
              <select
                id="workspace-industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
              >
                {INDUSTRY_PRESETS.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Brand Emblem Avatar
              </label>
              <div className="flex items-center gap-2">
                {AVATAR_PRESETS.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setLogoUrl(url)}
                    className={`w-9 h-9 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                      logoUrl === url ? 'border-indigo-500 scale-105 shadow-md shadow-indigo-500/20' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Preset ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Corporate Domain Allowlist */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center font-bold">2</span>
            Verified Domain Eligibility
          </h2>
          <p className="text-xs text-slate-400">
            Specify the corporate email domains authorized to self-enroll or request access to this workspace.
          </p>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">@</span>
              <input
                type="text"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDomain(e)}
                placeholder="acme.com"
                className="w-full h-10 pl-8 pr-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 font-mono focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <button
              type="button"
              onClick={handleAddDomain}
              className="px-4 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Domain
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {allowedDomains.map((dom) => (
              <span
                key={dom}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs font-mono text-indigo-300"
              >
                @{dom}
                <button
                  type="button"
                  onClick={() => handleRemoveDomain(dom)}
                  className="text-indigo-400 hover:text-rose-400 transition-colors"
                  title="Remove domain"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Step 3: Governance & Join Approval Policy */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center font-bold">3</span>
            Governance &amp; Access Controls
          </h2>

          <div className="space-y-3">
            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900/50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-slate-200 block">Require Administrator Approval (Globex Pattern)</span>
                <span className="text-slate-400 mt-0.5 block">
                  New applicants from verified domains are queued in a review holding state until approved by an administrator via the canonical atomic RPC.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900/50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={isDiscoverable}
                onChange={(e) => setIsDiscoverable(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-slate-200 block">Public Organization Discovery</span>
                <span className="text-slate-400 mt-0.5 block">
                  Allow this workspace to be discovered on the public Explore Communities registry.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Submit Action */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
          <Link
            href="/communities/explore"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 text-center transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Workspace...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Establish Corporate Workspace</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

