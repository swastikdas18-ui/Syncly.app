import React from 'react';
import { 
  Building2, 
  Layers, 
  MessageSquare, 
  FileCode2, 
  ShieldCheck, 
  ChevronDown, 
  Check, 
  Copy,
  Radio
} from 'lucide-react';
import { Tenant } from '../types.ts';

interface NavbarProps {
  tenants: Tenant[];
  activeTenant: Tenant | null;
  onSelectTenant: (tenant: Tenant) => void;
  activeView: 'feed' | 'chat' | 'schema' | 'inspector';
  onSelectView: (view: 'feed' | 'chat' | 'schema' | 'inspector') => void;
  isLiveConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  tenants,
  activeTenant,
  onSelectTenant,
  activeView,
  onSelectView,
  isLiveConnected,
}) => {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [copiedTenantId, setCopiedTenantId] = React.useState(false);

  const copyTenantId = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeTenant?.id) {
      navigator.clipboard.writeText(activeTenant.id);
      setCopiedTenantId(true);
      setTimeout(() => setCopiedTenantId(false), 2000);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* ZONE 1: BRAND & TENANT SWITCHER */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
                S
              </div>
              <span className="font-bold text-slate-900 tracking-tight text-lg">
                Syncly
              </span>
            </div>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            {/* Tenant Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                title="Switch active company tenant to verify isolation"
              >
                <Building2 className="w-4 h-4 text-slate-500" />
                <span className="font-semibold text-slate-900 max-w-[140px] sm:max-w-none truncate">
                  {activeTenant?.name || 'Select Workspace'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setDropdownOpen(false)} 
                  />
                  <div className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50">
                    <div className="px-3 py-1.5 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Switch Organization Tenant
                    </div>
                    {tenants.map((t) => {
                      const isSelected = t.id === activeTenant?.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            onSelectTenant(t);
                            setDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2.5 flex items-start justify-between hover:bg-slate-50 transition-colors ${
                            isSelected ? 'bg-blue-50/50' : ''
                          }`}
                        >
                          <div>
                            <div className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                              {t.name}
                              {isSelected && <span className="text-[11px] text-blue-600 font-medium">· Active</span>}
                            </div>
                            <div className="text-xs text-slate-500 truncate mt-0.5">{t.tagline}</div>
                            <div className="text-[11px] font-mono text-slate-400 mt-1 truncate">
                              ID: {t.id.slice(0, 8)}...{t.id.slice(-4)}
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Tenant UUID Chip with copy */}
            {activeTenant && (
              <div 
                onClick={copyTenantId}
                className="hidden lg:flex items-center gap-1.5 text-xs font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-200 cursor-pointer hover:bg-slate-100 hover:text-slate-800 transition-colors"
                title="Click to copy active UUID"
              >
                <span>x-tenant-id: {activeTenant.id.slice(0, 8)}...</span>
                {copiedTenantId ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3 text-slate-400" />
                )}
              </div>
            )}
          </div>

          {/* ZONE 2: PRIMARY NAVIGATION VIEWS (Desktop) */}
          <nav className="hidden md:flex items-center gap-1 p-1 bg-slate-100/80 rounded-lg border border-slate-200/60">
            <button
              type="button"
              onClick={() => onSelectView('feed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'feed'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Company Feed</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectView('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'chat'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Channels &amp; Chat</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectView('inspector')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'inspector'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Isolation Inspector</span>
              <span className="sm:hidden">Audit</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectView('schema')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'schema'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">SQL Migration</span>
              <span className="sm:hidden">SQL</span>
            </button>
          </nav>

          {/* ZONE 3: LIVE STATUS & PROFILE */}
          <div className="flex items-center gap-3 shrink-0">
            <div 
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500"
              title={isLiveConnected ? 'Realtime SSE Stream Active' : 'Connecting Realtime...'}
            >
              <Radio className={`w-3.5 h-3.5 ${isLiveConnected ? 'text-emerald-500 animate-pulse' : 'text-amber-500'}`} />
              <span className="hidden md:inline font-mono text-[11px]">
                {isLiveConnected ? 'Realtime' : 'Reconnecting'}
              </span>
            </div>

            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold">
              {activeTenant?.name === 'Acme Corporation' ? 'ER' : 'DT'}
            </div>
          </div>

        </div>
      </div>
    </header>
  );
};
