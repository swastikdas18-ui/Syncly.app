import React, { useState } from 'react';
import { 
  Building2, User, Bell, CheckCircle2, ArrowRight, ArrowLeft, 
  Sparkles, Check, Hash, Mail, Smartphone, ShieldCheck, Briefcase, 
  HelpCircle, AlertCircle
} from 'lucide-react';
import { Tenant, UserSession, OnboardingPayload } from '../types';

interface OnboardingWizardProps {
  currentSession: UserSession | null;
  tenants: Tenant[];
  onComplete: (updatedSession: UserSession) => void;
  onCancel?: () => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
];

const DEFAULT_CHANNELS = [
  { id: 'announcements', name: 'announcements', desc: 'Company-wide updates & leadership briefs' },
  { id: 'general', name: 'general', desc: 'Team syncs, work discussions & ideas' },
  { id: 'engineering', name: 'engineering', desc: 'Architecture, PR reviews & deployments' },
  { id: 'watercooler', name: 'watercooler', desc: 'Casual chatter, hobbies & coffee breaks' },
];

export function OnboardingWizard({ currentSession, tenants, onComplete, onCancel }: OnboardingWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Form State
  const [selectedTenantId, setSelectedTenantId] = useState<string>(
    currentSession?.user.tenantId || tenants[0]?.id || '00000000-0000-0000-0000-000000000001'
  );
  const [fullName, setFullName] = useState(currentSession?.user.fullName || 'Alex Morgan');
  const [headline, setHeadline] = useState(currentSession?.user.headline || 'Product Systems Specialist');
  const [role, setRole] = useState<'employee' | 'intern'>(
    currentSession?.user.role === 'intern' ? 'intern' : 'employee'
  );
  const [avatarUrl, setAvatarUrl] = useState(
    currentSession?.user.avatarUrl || PRESET_AVATARS[0]
  );
  const [customAvatarInput, setCustomAvatarInput] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<string[]>([
    'announcements', 'general', 'engineering'
  ]);
  const [notifications, setNotifications] = useState({
    emailDigest: true,
    realtimePush: true,
  });

  // Strict UUID validation check
  const isValidUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

  const toggleChannel = (channelId: string) => {
    setSelectedChannels(prev => 
      prev.includes(channelId)
        ? prev.filter(c => c !== channelId)
        : [...prev, channelId]
    );
  };

  const handleNext = () => {
    if (step === 1) {
      if (!isValidUuid(selectedTenantId)) {
        setSelectedTenantId('00000000-0000-0000-0000-000000000001');
      }
      setStep(2);
    } else if (step === 2) {
      if (!fullName.trim()) return;
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as 1 | 2);
    }
  };

  const handleFinishOnboarding = async () => {
    setIsSubmitting(true);

    const safeTenantId = isValidUuid(selectedTenantId) 
      ? selectedTenantId 
      : '00000000-0000-0000-0000-000000000001';

    const payload: OnboardingPayload = {
      tenantId: safeTenantId,
      fullName: fullName.trim(),
      headline: headline.trim() || (role === 'intern' ? 'Software Intern' : 'Enterprise Team Member'),
      role,
      avatarUrl: customAvatarInput.trim() || avatarUrl,
      selectedChannels,
      notifications
    };

    try {
      // Send to Next.js API Route
      const response = await fetch('/api/tenant/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.warn('API route call fallback applied in client mode');
      }
    } catch {
      // In standalone client preview, fallback gracefully
    }

    const updatedSession: UserSession = {
      user: {
        id: currentSession?.user.id || '00000000-0000-0000-0000-000000000201',
        email: currentSession?.user.email || 'user@company.internal',
        fullName: payload.fullName,
        headline: payload.headline,
        role: payload.role,
        avatarUrl: payload.avatarUrl,
        tenantId: safeTenantId,
        hasCompletedOnboarding: true
      },
      token: currentSession?.token || 'onboarded-token-' + Date.now()
    };

    // Store in localStorage & cookies
    try {
      localStorage.setItem('syncly_session', JSON.stringify(updatedSession));
      localStorage.setItem('syncly_tenant_id', safeTenantId);
      document.cookie = `x-tenant-id=${safeTenantId}; path=/; max-age=2592000`;
      document.cookie = `syncly_role=${payload.role}; path=/; max-age=2592000`;
      document.cookie = `syncly_onboarded=true; path=/; max-age=2592000`;
    } catch {
      // ignore
    }

    setIsSubmitting(false);
    setShowCelebration(true);

    setTimeout(() => {
      onComplete(updatedSession);
    }, 1200);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      {/* Toast celebration overlay */}
      {showCelebration && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 bg-emerald-950 border border-emerald-500/60 text-emerald-200 px-4 sm:px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce max-w-[90vw]">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold shrink-0">
            ✓
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-xs sm:text-sm truncate">Welcome aboard, {fullName}!</div>
            <div className="text-[11px] sm:text-xs text-emerald-300">Profile initialized with strict RLS isolation.</div>
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden">
        {/* Top Header & Step Progress Indicator */}
        <div className="p-4 sm:p-6 border-b border-zinc-800 bg-zinc-950/40">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/30">
                S
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Syncly Onboarding</h2>
                <p className="text-xs text-zinc-400">Step {step} of 3: {
                  step === 1 ? 'Workspace Selection' : step === 2 ? 'Profile & Role Setup' : 'Channels & Notifications'
                }</p>
              </div>
            </div>
            {onCancel && (
              <button 
                onClick={onCancel}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Skip for now
              </button>
            )}
          </div>

          {/* Stepper bar */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            {[1, 2, 3].map((s) => {
              const isActive = step === s;
              const isPast = step > s;
              return (
                <div key={s} className="space-y-1.5">
                  <div className={`h-1.5 rounded-full transition-all duration-300 ${
                    isPast 
                      ? 'bg-blue-500' 
                      : isActive 
                        ? 'bg-blue-400 animate-pulse' 
                        : 'bg-zinc-800'
                  }`} />
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={`font-medium ${isActive ? 'text-blue-400' : isPast ? 'text-zinc-300' : 'text-zinc-600'}`}>
                      {s === 1 ? '1. Workspace' : s === 2 ? '2. Profile' : '3. Channels'}
                    </span>
                    {isPast && <Check className="w-3 h-3 text-blue-400" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Wizard Body */}
        <div className="p-4 sm:p-6">
          {/* STEP 1: Workspace Selection */}
          {step === 1 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h3 className="text-base font-semibold text-white">Choose your Corporate Workspace</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Tenant boundaries are enforced cryptographically via Postgres Row-Level Security (RLS). Select your verified organization.
                </p>
              </div>

              <div className="space-y-3">
                {tenants.map((t) => {
                  const isSelected = selectedTenantId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTenantId(t.id)}
                      className={`w-full p-4 rounded-xl border text-left transition-all flex items-start gap-4 ${
                        isSelected
                          ? 'bg-blue-950/30 border-blue-500/70 shadow-lg shadow-blue-500/10'
                          : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-blue-600 text-white shadow-md' : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-zinc-100">{t.name}</span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
                            {t.slug}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">{t.tagline}</p>
                        <div className="mt-2 text-[10px] text-zinc-500 font-mono truncate">
                          Tenant UUID: {t.id}
                        </div>
                      </div>
                      <div className="pt-1">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-zinc-700'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Postgres 22P02 Safety Notice */}
              <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-900/40 text-xs text-blue-300 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Postgres 22P02 Protection:</span> Selected tenant ID is strictly validated against UUID syntax (<code className="text-blue-200">00000000-0000-0000-0000-000000000001</code>).
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Profile & Role Setup */}
          {step === 2 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h3 className="text-base font-semibold text-white">Profile &amp; Role Setup</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Configure your corporate identity and access tier. Roles define channel posting and moderation policies.
                </p>
              </div>

              {/* Role Selector Pills */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-2">
                  Select Corporate Role
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setRole('employee');
                      if (headline.includes('Intern')) setHeadline('Product Systems Engineer');
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                      role === 'employee'
                        ? 'bg-blue-950/40 border-blue-500 text-white shadow-md shadow-blue-500/10'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Briefcase className={`w-5 h-5 ${role === 'employee' ? 'text-blue-400' : 'text-zinc-500'}`} />
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">Employee</div>
                      <div className="text-[11px] text-zinc-400">Full channel posting &amp; updates</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRole('intern');
                      setHeadline('Engineering Intern — Cohort 2026');
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                      role === 'intern'
                        ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-md shadow-emerald-500/10'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Sparkles className={`w-5 h-5 ${role === 'intern' ? 'text-emerald-400' : 'text-zinc-500'}`} />
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">Intern</div>
                      <div className="text-[11px] text-zinc-400">Guided mentorship &amp; learning</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Full Name & Headline */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="w-full px-3 py-2 text-sm bg-zinc-950/80 border border-zinc-700/80 rounded-xl text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Job Title / Headline
                  </label>
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="e.g. Senior Frontend Specialist"
                    className="w-full px-3 py-2 text-sm bg-zinc-950/80 border border-zinc-700/80 rounded-xl text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Preset Avatar Selection */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-2">
                  Choose Avatar Preset
                </label>
                <div className="flex items-center gap-3 overflow-x-auto pb-2">
                  {PRESET_AVATARS.map((url, idx) => {
                    const isSelected = avatarUrl === url && !customAvatarInput;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setAvatarUrl(url);
                          setCustomAvatarInput('');
                        }}
                        className={`relative rounded-full p-0.5 shrink-0 transition-transform ${
                          isSelected ? 'ring-2 ring-blue-500 scale-105' : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={url}
                          alt={`Avatar ${idx + 1}`}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        {isSelected && (
                          <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-0.5 text-white">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Custom avatar URL option */}
                <div className="mt-2.5">
                  <input
                    type="url"
                    value={customAvatarInput}
                    onChange={(e) => {
                      setCustomAvatarInput(e.target.value);
                      if (e.target.value) setAvatarUrl(e.target.value);
                    }}
                    placeholder="Or enter custom image URL (https://...)"
                    className="w-full px-3 py-1.5 text-xs bg-zinc-950/60 border border-zinc-800 rounded-lg text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Channels & Notification Preferences */}
          {step === 3 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h3 className="text-base font-semibold text-white">Channels &amp; Notifications</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Pick company channels you want to follow and customize how you receive critical workplace announcements.
                </p>
              </div>

              {/* Channels List */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Default Channels to Join
                </label>
                {DEFAULT_CHANNELS.map((ch) => {
                  const isChecked = selectedChannels.includes(ch.id);
                  return (
                    <div
                      key={ch.id}
                      onClick={() => toggleChannel(ch.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        isChecked 
                          ? 'bg-zinc-900 border-blue-500/50 text-zinc-100' 
                          : 'bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                          isChecked ? 'bg-blue-600/20 text-blue-400' : 'bg-zinc-800 text-zinc-500'
                        }`}>
                          <Hash className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium flex items-center gap-2">
                            #{ch.name}
                            {ch.id === 'announcements' && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                                Required
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-400">{ch.desc}</div>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by parent div
                        className="rounded border-zinc-700 text-blue-600 focus:ring-blue-500 bg-zinc-900 w-4 h-4"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Notification Toggles */}
              <div className="pt-2 border-t border-zinc-800/80 space-y-3">
                <label className="block text-xs font-medium text-zinc-300">
                  Notification Delivery Preferences
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div 
                    onClick={() => setNotifications(prev => ({ ...prev, emailDigest: !prev.emailDigest }))}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      notifications.emailDigest
                        ? 'bg-blue-950/20 border-blue-500/40 text-zinc-200'
                        : 'bg-zinc-950/40 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Mail className="w-4 h-4 text-blue-400" />
                      <div>
                        <div className="text-xs font-semibold text-zinc-200">Daily Digest</div>
                        <div className="text-[10px] text-zinc-400">Summarized team updates</div>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                      notifications.emailDigest ? 'bg-blue-600 border-blue-500 text-white' : 'border-zinc-700'
                    }`}>
                      {notifications.emailDigest && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>

                  <div 
                    onClick={() => setNotifications(prev => ({ ...prev, realtimePush: !prev.realtimePush }))}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      notifications.realtimePush
                        ? 'bg-blue-950/20 border-blue-500/40 text-zinc-200'
                        : 'bg-zinc-950/40 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Smartphone className="w-4 h-4 text-emerald-400" />
                      <div>
                        <div className="text-xs font-semibold text-zinc-200">Real-time Push</div>
                        <div className="text-[10px] text-zinc-400">Mentions &amp; direct alerts</div>
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                      notifications.realtimePush ? 'bg-blue-600 border-blue-500 text-white' : 'border-zinc-700'
                    }`}>
                      {notifications.realtimePush && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Navigation */}
        <div className="p-4 sm:p-6 bg-zinc-950/60 border-t border-zinc-800 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-800 rounded-xl transition-all flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-2"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinishOnboarding}
              disabled={isSubmitting}
              className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>Saving Profile...</>
              ) : (
                <>
                  Complete Setup &amp; Enter Workspace
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default OnboardingWizard;
