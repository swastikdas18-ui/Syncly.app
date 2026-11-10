import React, { useState } from 'react';
import { 
  Building2, 
  X, 
  Globe, 
  Lock, 
  ShieldCheck, 
  Sparkles, 
  Plus, 
  Trash2, 
  Hash, 
  Check, 
  AlertCircle,
  HelpCircle,
  Loader2
} from 'lucide-react';
import { Tenant, UserSession } from '../types.ts';
import { api } from '../lib/api.ts';

interface CreateCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSession: UserSession | null;
  onCommunityCreated: (newCommunity: Tenant) => void;
}

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

export const CreateCommunityModal: React.FC<CreateCommunityModalProps> = ({
  isOpen,
  onClose,
  currentSession,
  onCommunityCreated,
}) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugCustomized, setIsSlugCustomized] = useState(false);
  const [tagline, setTagline] = useState('');
  const [industry, setIndustry] = useState('Enterprise Software & SaaS');
  const [logoUrl, setLogoUrl] = useState(AVATAR_PRESETS[0]);
  
  // Domains
  const [domainInput, setDomainInput] = useState('');
  const [allowedDomains, setAllowedDomains] = useState<string[]>(() => {
    const userDomain = currentSession?.user?.email?.split('@')[1];
    return userDomain ? [userDomain] : ['company.internal'];
  });

  // Privacy & Access
  const [isDiscoverable, setIsDiscoverable] = useState(true);
  const [requiresApproval, setRequiresApproval] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const userRole = currentSession?.user?.role;
  const isPrivileged = !userRole || userRole === 'admin' || userRole === 'owner';

  if (!isOpen) return null;

  if (!isPrivileged) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
        <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-100">Restricted Action</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Workspace creation is restricted to Organization Administrators and Owners. Please contact your workspace administrator to provision a new tenant.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

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

  const handleAddDomain = () => {
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

    setIsLoading(true);
    setErrorMessage(null);

    const res = await api.createCommunity({
      name: name.trim(),
      slug: slug.trim() || undefined,
      tagline: tagline.trim() || 'Official Corporate Workspace & Knowledge Hub',
      logoUrl,
      allowedDomains,
      requiresApproval,
      isDiscoverable,
      industry,
      creatorName: currentSession?.user?.fullName || 'Workspace Lead',
      creatorEmail: currentSession?.user?.email || 'admin@acmecorp.internal',
    });

    setIsLoading(false);

    if (res.success && res.data) {
      onCommunityCreated(res.data);
      onClose();
    } else {
      setErrorMessage(res.error || 'Failed to provision community.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                Create New Corporate Community
              </h2>
              <p className="text-xs text-slate-500">
                Workspace Admin Wizard · Auto-provisions channels &amp; sets owner role
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[calc(85vh-120px)] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Basic Info */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>1. Basic Information</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Community Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Stripe Engineering, Acme Global, Globex AI"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Unique Slug (URL path)
                </label>
                <div className="flex items-center px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-xs text-slate-500">
                  <span className="shrink-0 text-slate-400">syncly.io/</span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                      setIsSlugCustomized(true);
                    }}
                    placeholder="stripe-eng"
                    className="w-full bg-transparent font-mono text-slate-800 focus:outline-none ml-0.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Industry / Domain
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {INDUSTRY_PRESETS.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description &amp; Mission Tagline
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Cross-functional developer sync, platform architecture &amp; team updates."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Logo Presets */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Community Icon / Logo
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {AVATAR_PRESETS.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setLogoUrl(url)}
                    className={`relative w-10 h-10 rounded-xl overflow-hidden border-2 transition-all ${
                      logoUrl === url ? 'border-blue-600 ring-2 ring-blue-500/30' : 'border-slate-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Preset ${i + 1}`} className="w-full h-full object-cover" />
                    {logoUrl === url && (
                      <div className="absolute inset-0 bg-blue-600/30 flex items-center justify-center text-white">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-200" />

          {/* Section 2: Corporate Domain Whitelist */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span>2. Allowed Corporate Domains</span>
              </div>
              <span className="text-[11px] text-slate-400">Auto-match work emails</span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Colleagues signing in with these email domains will be verified automatically for instant workspace membership:
            </p>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs">
                  @
                </span>
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddDomain();
                    }
                  }}
                  placeholder="e.g. stripe.com or company.internal"
                  className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                />
              </div>
              <button
                type="button"
                onClick={handleAddDomain}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Domain</span>
              </button>
            </div>

            {/* Domain chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {allowedDomains.map((dom) => (
                <div
                  key={dom}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-xs font-mono font-medium text-blue-800"
                >
                  <span>@{dom}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDomain(dom)}
                    className="text-blue-400 hover:text-blue-700 transition-colors ml-0.5"
                    title="Remove domain"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-slate-200" />

          {/* Section 3: Privacy & Access Policy */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>3. Privacy &amp; Access Controls</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Discoverable toggle */}
              <div 
                onClick={() => setIsDiscoverable(!isDiscoverable)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  isDiscoverable ? 'bg-blue-50/60 border-blue-300 ring-1 ring-blue-500/20' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className={`w-4 h-4 ${isDiscoverable ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="text-xs font-bold text-slate-800">Public &amp; Discoverable</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isDiscoverable}
                    onChange={() => {}}
                    className="rounded text-blue-600 focus:ring-0 mt-0.5"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Appears in community directory search. Anyone with allowed work domain can join directly.
                </p>
              </div>

              {/* Approval toggle */}
              <div 
                onClick={() => setRequiresApproval(!requiresApproval)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  requiresApproval ? 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-500/20' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className={`w-4 h-4 ${requiresApproval ? 'text-amber-600' : 'text-slate-400'}`} />
                    <span className="text-xs font-bold text-slate-800">Require Admin Approval</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={requiresApproval}
                    onChange={() => {}}
                    className="rounded text-amber-600 focus:ring-0 mt-0.5"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  New members enter a pending queue for admin review before gaining access to posts and channels.
                </p>
              </div>
            </div>

            {/* Auto-provisioning banner */}
            <div className="p-3 rounded-xl bg-slate-100 border border-slate-200/80 text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Instant Auto-Provisioning Includes:</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] font-mono">
                <div className="flex items-center gap-1 text-slate-700">
                  <Hash className="w-3 h-3 text-slate-400" /> #general
                </div>
                <div className="flex items-center gap-1 text-slate-700">
                  <Hash className="w-3 h-3 text-slate-400" /> #announcements
                </div>
                <div className="flex items-center gap-1 text-slate-700">
                  <Hash className="w-3 h-3 text-slate-400" /> #dev-team
                </div>
                <div className="flex items-center gap-1 text-slate-700">
                  <Hash className="w-3 h-3 text-slate-400" /> #random
                </div>
              </div>
              <div className="text-[11px] text-slate-500 pt-1">
                Your role will be assigned as <span className="font-semibold text-blue-600">owner</span> with full administrative permissions.
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1.5"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Provisioning Workspace...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Create Workspace &amp; Join</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
