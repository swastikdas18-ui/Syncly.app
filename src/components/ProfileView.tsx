import React, { useState } from 'react';
import { 
  Building2, ShieldCheck, Mail, LogOut, 
  CheckCircle2, RefreshCw, Compass, Edit3, Check, X,
  Camera, Loader2, AlertCircle, Save, PlusCircle
} from 'lucide-react';
import { UserSession, Tenant } from '../types.ts';
import { api } from '../lib/api.ts';

interface ProfileViewProps {
  session: UserSession | null;
  currentTenant?: Tenant;
  onSwitchPersona?: (role: 'mentor' | 'intern' | 'employee') => void;
  onRestartOnboarding: () => void;
  onLogout: () => void;
  onSelectView?: (view: any) => void;
  onUpdateProfile?: (updatedData: {
    fullName?: string;
    headline?: string;
    avatarUrl?: string;
    role?: 'owner' | 'admin' | 'manager' | 'employee' | 'intern';
    email?: string;
  }) => void;
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
];

const ROLE_OPTIONS: Array<{
  id: 'owner' | 'admin' | 'manager' | 'employee' | 'intern';
  label: string;
  desc: string;
  badgeClass: string;
}> = [
  { id: 'admin', label: 'Admin', desc: 'Full workspace governance & channel moderation', badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  { id: 'manager', label: 'Manager', desc: 'Team coordination & project management', badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  { id: 'employee', label: 'Employee', desc: 'Direct access to channels, feed updates & discussions', badgeClass: 'bg-blue-500/10 text-indigo-400 border-indigo-500/20' },
  { id: 'intern', label: 'Intern', desc: 'Cohort channels & team syncs', badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { id: 'owner', label: 'Owner', desc: 'Primary administrative workspace lead', badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
];

export function ProfileView({
  session,
  currentTenant,
  onRestartOnboarding,
  onLogout,
  onSelectView,
  onUpdateProfile,
}: ProfileViewProps) {
  const user = session?.user || {
    id: '',
    email: '',
    fullName: 'Corporate Member',
    headline: 'Workspace Member',
    role: 'employee' as const,
    tenantId: currentTenant?.id || '',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    hasCompletedOnboarding: false,
  };

  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user.fullName);
  const [headline, setHeadline] = useState(user.headline || '');
  const [email, setEmail] = useState(user.email);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || AVATAR_PRESETS[0]);
  const [customAvatarInput, setCustomAvatarInput] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Sync state if external user session changes
  React.useEffect(() => {
    if (!isEditing) {
      setFullName(user.fullName);
      setHeadline(user.headline || '');
      setEmail(user.email);
      setAvatarUrl(user.avatarUrl || AVATAR_PRESETS[0]);
    }
  }, [user, isEditing]);

  const getRoleBadge = (r: string) => {
    const found = ROLE_OPTIONS.find((opt) => opt.id === r);
    const cls = found ? found.badgeClass : 'bg-blue-500/10 text-indigo-400 border-indigo-500/20';
    const label = found ? found.label : r;
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${cls}`}>
        {label}
      </span>
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMessage(null);
    try {
      const res = await api.uploadMedia(file);
      if (res?.url) {
        setAvatarUrl(res.url);
      }
    } catch {
      setErrorMessage('Failed to upload image. Please try a different file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid work email address.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const updatedData = {
      id: user.id,
      fullName: fullName.trim(),
      headline: headline.trim(),
      email: email.trim(),
      avatarUrl,
    };

    const res = await api.updateProfile(updatedData);
    setIsSaving(false);

    if (res.success) {
      onUpdateProfile?.(updatedData);
      setIsEditing(false);
      setSuccessBanner('Profile details updated successfully across your workspace!');
      setTimeout(() => setSuccessBanner(null), 4000);
    } else {
      setErrorMessage(res.message || 'Failed to update profile details.');
    }
  };

  const handleCancelEdit = () => {
    setFullName(user.fullName);
    setHeadline(user.headline || '');
    setEmail(user.email);
    setAvatarUrl(user.avatarUrl || AVATAR_PRESETS[0]);
    setErrorMessage(null);
    setIsEditing(false);
  };

  const hasConnectedWorkspace = Boolean(currentTenant?.id && currentTenant?.name);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-6">
      
      {/* Toast / Notification Banner */}
      {successBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. Personal Information Header Card */}
      <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        {!isEditing ? (
          /* READ-ONLY VIEW */
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 relative z-10">
            <div className="relative group">
              <img
                src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.fullName)}`}
                alt={user.fullName}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-2 ring-zinc-700 shadow-lg"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-zinc-900" title="Online" />
            </div>

            <div className="flex-1 text-center sm:text-left space-y-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">{user.fullName}</h2>
                {hasConnectedWorkspace && getRoleBadge(user.role)}
              </div>
              <p className="text-xs text-slate-400 font-medium">{user.headline || 'Enterprise Team Member'}</p>
              <div className="flex items-center justify-center sm:justify-start gap-3 pt-1 text-xs text-slate-500 flex-wrap">
                <span className="flex items-center gap-1 truncate max-w-xs">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col xs:flex-row sm:flex-col gap-2 shrink-0 w-full sm:w-auto pt-2 sm:pt-0">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
              <button
                type="button"
                onClick={onRestartOnboarding}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                <span>Re-run Wizard</span>
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="px-3.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-800/40 text-red-300 text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        ) : (
          /* INLINE PROFILE EDITING FORM */
          <form onSubmit={handleSaveProfile} className="space-y-5 relative z-10 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Edit Your Profile Details</h3>
              </div>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-md hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* AVATAR PICKER SECTION */}
            <div className="space-y-2.5">
              <label className="block text-xs font-semibold text-slate-300">
                Profile Avatar
              </label>
              
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                <div className="relative shrink-0">
                  <img
                    src={avatarUrl}
                    alt="Preview"
                    className="w-16 h-16 rounded-2xl object-cover ring-2 ring-indigo-500 shadow-md bg-slate-800"
                  />
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center text-white">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                    {AVATAR_PRESETS.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setAvatarUrl(url)}
                        className={`relative w-8 h-8 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                          avatarUrl === url ? 'border-indigo-500 ring-2 ring-blue-400/40 scale-105' : 'border-slate-700 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={url} alt={`Preset ${i + 1}`} className="w-full h-full object-cover" />
                        {avatarUrl === url && (
                          <div className="absolute inset-0 bg-indigo-600/30 flex items-center justify-center text-white">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    ))}

                    <label className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 cursor-pointer transition-colors">
                      <Camera className="w-3 h-3 text-indigo-400" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-2 max-w-md">
                    <input
                      type="url"
                      value={customAvatarInput}
                      onChange={(e) => setCustomAvatarInput(e.target.value)}
                      placeholder="Paste image URL (https://...)"
                      className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-slate-950/80 border border-slate-800 text-slate-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customAvatarInput.trim()) {
                          setAvatarUrl(customAvatarInput.trim());
                          setCustomAvatarInput('');
                        }
                      }}
                      className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* FULL NAME & HEADLINE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Sarah Chen"
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-950/90 border border-slate-800 text-slate-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Job Title / Headline
                </label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Senior Software Engineer"
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-950/90 border border-slate-800 text-slate-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* EMAIL ADDRESS */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Corporate Work Email *
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm font-mono rounded-xl bg-slate-950/90 border border-slate-800 text-slate-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* ROLE (AUTHORITATIVE READ-ONLY DISPLAY) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Workspace Role & Permissions
              </label>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-slate-200 capitalize">{user.role}</span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  Assigned by workspace administration
                </span>
              </div>
            </div>

            {/* FORM ACTIONS */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-xs hover:shadow transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Profile...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 2. Workspace Membership Section */}
      {hasConnectedWorkspace ? (
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-indigo-400" />
              Connected Workspace
            </span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Active Member
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div>
              <div className="text-base font-bold text-slate-100">{currentTenant?.name}</div>
              <div className="text-xs text-slate-400 mt-0.5">{currentTenant?.tagline || 'Corporate Workspace'}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Your Role:</span>
              {getRoleBadge(user.role)}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onSelectView?.('communities/explore')}
              className="py-2 px-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 text-indigo-400" />
              <span>Explore Other Workspaces</span>
            </button>
          </div>
        </div>
      ) : (
        /* NO MEMBERSHIP STATE */
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Building2 className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">No Workspace Connected</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            You haven&apos;t joined an organization yet. Explore available workspaces or create your own to collaborate with colleagues.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onSelectView?.('communities/explore')}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Explore Workspaces</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectView?.('communities/new')}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
              <span>Create Workspace</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Account Settings */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md space-y-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Account Settings
        </h3>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
          <div>
            <div className="text-xs font-medium text-slate-200">Password &amp; Security</div>
            <div className="text-[11px] text-slate-500">Reset your login credentials securely</div>
          </div>
          <button
            type="button"
            onClick={() => onSelectView?.('forgot-password')}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
          >
            Reset Password
          </button>
        </div>
      </div>

    </div>
  );
}

export default ProfileView;
