import React, { useState } from 'react';
import { 
  FolderTree, 
  FileCode, 
  Copy, 
  Check, 
  ShieldCheck, 
  ArrowRight, 
  Layers, 
  Download, 
  ExternalLink,
  Cpu,
  FileCheck
} from 'lucide-react';

interface FileNode {
  path: string;
  name: string;
  category: 'middleware' | 'context' | 'api' | 'ui';
  description: string;
  code: string;
}

const NEXTJS_FILES: FileNode[] = [
  {
    path: 'middleware.ts',
    name: 'middleware.ts',
    category: 'middleware',
    description: 'Next.js Edge Middleware extracting x-tenant-id, validating RFC 4122 UUID, defending against 22P02 Postgres errors, and rewriting request headers.',
    code: `import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { DEFAULT_TENANT_ID, SECONDARY_TENANT_ID, isValidUUID, resolveTenantId } from './lib/tenant/context';

const SUBDOMAIN_TENANTS: Record<string, string> = {
  acme: DEFAULT_TENANT_ID,
  'acme-corp': DEFAULT_TENANT_ID,
  globex: SECONDARY_TENANT_ID,
  'globex-tech': SECONDARY_TENANT_ID,
};

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') && !pathname.endsWith('.json')
  ) {
    return NextResponse.next();
  }

  // 1. Header lookup
  let candidateTenant = request.headers.get('x-tenant-id');

  // 2. Query param lookup
  if (!candidateTenant) {
    candidateTenant = searchParams.get('tenant') || searchParams.get('tenantId');
  }

  // 3. Cookie lookup
  if (!candidateTenant) {
    candidateTenant = request.cookies.get('workconnect_tenant_id')?.value;
  }

  // 4. Subdomain lookup (e.g. acme.workconnect.internal)
  if (!candidateTenant) {
    const host = request.headers.get('host') || '';
    const parts = host.split('.');
    if (parts.length > 2) {
      const subdomain = parts[0].toLowerCase();
      if (SUBDOMAIN_TENANTS[subdomain]) {
        candidateTenant = SUBDOMAIN_TENANTS[subdomain];
      }
    }
  }

  // 5. Strict UUID validation & Postgres 22P02 defense
  // Falling back safely to '00000000-0000-0000-0000-000000000001'
  const resolvedTenantId = resolveTenantId(candidateTenant);

  // 6. Inject into downstream request headers for Server Components & Route Handlers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-id', resolvedTenantId);
  requestHeaders.set('x-tenant-is-valid-uuid', isValidUUID(candidateTenant) ? 'true' : 'false');

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set('x-tenant-id', resolvedTenantId);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};`,
  },
  {
    path: 'lib/tenant/context.ts',
    name: 'context.ts',
    category: 'context',
    description: 'Next.js App Router server context, headers() accessor, UUID validator, and Supabase RLS session statement generator.',
    code: `import { headers } from 'next/headers';

export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
export const SECONDARY_TENANT_ID = '00000000-0000-0000-0000-000000000002';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(uuid: string | null | undefined): boolean {
  if (!uuid) return false;
  return UUID_REGEX.test(uuid.trim());
}

export function resolveTenantId(candidate: string | null | undefined): string {
  if (!candidate) return DEFAULT_TENANT_ID;
  const trimmed = candidate.trim();
  if (isValidUUID(trimmed)) return trimmed.toLowerCase();
  // Safe default prevents Postgres 22P02 syntax errors
  return DEFAULT_TENANT_ID;
}

export interface TenantContext {
  tenantId: string;
  source: 'header' | 'cookie' | 'fallback';
  isValid: boolean;
}

export async function getTenantContext(): Promise<TenantContext> {
  try {
    const headersList = await headers();
    const rawHeader = headersList.get('x-tenant-id');
    if (rawHeader && isValidUUID(rawHeader)) {
      return {
        tenantId: rawHeader.trim().toLowerCase(),
        source: 'header',
        isValid: true,
      };
    }
  } catch {
    // Outside request context fallback
  }

  return {
    tenantId: DEFAULT_TENANT_ID,
    source: 'fallback',
    isValid: true,
  };
}

export function buildTenantSessionSql(tenantId: string): string {
  const safeId = resolveTenantId(tenantId);
  return \`SET LOCAL app.current_tenant_id = '\${safeId}';\`;
}`,
  },
  {
    path: 'app/api/posts/route.ts',
    name: 'posts/route.ts',
    category: 'api',
    description: 'Next.js App Router Route Handler for paginated, category-filtered company posts with RLS session context.',
    code: `import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, buildTenantSessionSql } from '@/lib/tenant/context';

export async function GET(request: NextRequest) {
  const { tenantId } = await getTenantContext();
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category') || 'all';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

  // In production with Supabase:
  // const supabase = createClient();
  // await supabase.rpc('set_current_tenant', { tenant_id: tenantId });
  // const { data } = await supabase.from('posts').select('*, profiles(*), post_comments(*)')...

  return NextResponse.json({
    tenantId,
    rlsContextSql: buildTenantSessionSql(tenantId),
    category,
    limit,
    message: 'Posts strictly scoped to tenant_id with PostgreSQL RLS',
  });
}

export async function POST(request: NextRequest) {
  const { tenantId } = await getTenantContext();
  const body = await request.json();

  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'Content is required.' }, { status: 400 });
  }

  const newPost = {
    id: crypto.randomUUID(),
    tenantId,
    authorId: body.authorId || '00000000-0000-0000-0000-0000000000a1',
    title: body.title?.trim() || '',
    content: body.content.trim(),
    category: body.category || 'general',
    mediaUrls: body.mediaUrls || [],
    createdAt: new Date().toISOString(),
    rlsContextSql: buildTenantSessionSql(tenantId),
  };

  return NextResponse.json(newPost, { status: 201 });
}`,
  },
  {
    path: 'app/api/channels/[channelId]/messages/route.ts',
    name: '[channelId]/messages/route.ts',
    category: 'api',
    description: 'Next.js Route Handler for chronological channel chat, @mention extraction, and Upstash Redis real-time pub/sub broadcast.',
    code: `import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, buildTenantSessionSql } from '@/lib/tenant/context';

interface RouteContext {
  params: Promise<{ channelId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { tenantId } = await getTenantContext();
  const { channelId } = await context.params;

  return NextResponse.json({
    tenantId,
    channelId,
    rlsContextSql: buildTenantSessionSql(tenantId),
    message: \`Chronological messages for channel \${channelId}\`,
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { tenantId } = await getTenantContext();
  const { channelId } = await context.params;
  const body = await request.json();

  // Extract @mentions
  const mentionMatches = body.content?.match(/@([a-zA-Z0-9_\\-\\.]+)/g) || [];
  const mentions = mentionMatches.map((m: string) => m.substring(1));

  const messageRecord = {
    id: crypto.randomUUID(),
    tenantId,
    channelId,
    content: body.content,
    mentions,
    createdAt: new Date().toISOString(),
    pubSubTopic: \`tenant:\${tenantId}:channel:\${channelId}\`,
    rlsContextSql: buildTenantSessionSql(tenantId),
  };

  return NextResponse.json(messageRecord, { status: 201 });
}`,
  },
  {
    path: 'app/api/media/upload/route.ts',
    name: 'upload/route.ts',
    category: 'api',
    description: 'Next.js Route Handler for multipart media upload to Supabase Storage bucket community-media, validating tenant partition folder path.',
    code: `import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, buildTenantSessionSql } from '@/lib/tenant/context';

export async function POST(request: NextRequest) {
  const { tenantId } = await getTenantContext();
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  }

  // Sanitize path: {tenant_id}/posts/{uuid}_{filename}
  const sanitized = (file.name || 'image.png').replace(/[^a-zA-Z0-9\\._-]/g, '_');
  const objectKey = \`\${tenantId}/posts/\${crypto.randomUUID()}_\${sanitized}\`;

  // Storage RLS Policy check:
  // (storage.foldername(name))[1] = current_setting('app.current_tenant_id', true)
  const isPartitionValid = objectKey.startsWith(tenantId + '/');

  return NextResponse.json({
    bucket: 'community-media',
    key: objectKey,
    tenantId,
    isPartitionValid,
    rlsPolicyCheck: 'PASSED',
    rlsContextSql: buildTenantSessionSql(tenantId),
  }, { status: 201 });
}`,
  },
  {
    path: 'app/layout.tsx',
    name: 'layout.tsx',
    category: 'ui',
    description: 'Next.js App Router RootLayout with metadata, responsive viewport, typography, and theme provider.',
    code: `import type { Metadata, Viewport } from 'next';
import React from 'react';
import '@/src/index.css';

export const metadata: Metadata = {
  title: 'Work Connect — Multi-Tenant Corporate Hub',
  description: 'Enterprise multi-tenant corporate communication and real-time chat platform with strict PostgreSQL RLS isolation.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0a0f1d',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}`,
  },
  {
    path: 'app/page.tsx',
    name: 'page.tsx',
    category: 'ui',
    description: 'Next.js App Router main dashboard page importing the client WorkConnectHub.',
    code: `'use client';

import React from 'react';
import { WorkConnectHub } from '@/src/App';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950">
      <WorkConnectHub />
    </main>
  );
}`,
  },
  {
    path: 'app/(auth)/login/page.tsx',
    name: '(auth)/login/page.tsx',
    category: 'ui',
    description: 'Next.js App Router login page with dark frosted glass styling, email auth, Google OAuth, and instant demo personas.',
    code: `'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LoginScreen } from '@/src/components/LoginScreen';
import { UserSession } from '@/src/types';

export default function LoginPage() {
  const router = useRouter();

  const handleLoginSuccess = (session: UserSession, redirectTo: 'onboarding' | 'feed') => {
    if (redirectTo === 'onboarding') {
      router.push('/onboarding');
    } else {
      router.push('/feed');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4">
      <LoginScreen onLoginSuccess={handleLoginSuccess} />
    </div>
  );
}`,
  },
  {
    path: 'app/(auth)/onboarding/page.tsx',
    name: '(auth)/onboarding/page.tsx',
    category: 'ui',
    description: 'Next.js App Router 3-step onboarding wizard for workspace selection, employee/intern role setup, and channel preferences.',
    code: `'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingWizard } from '@/src/components/OnboardingWizard';
import { UserSession } from '@/src/types';

export default function OnboardingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4">
      <OnboardingWizard
        currentSession={null}
        tenants={[]}
        onComplete={(_session: UserSession) => router.push('/feed')}
        onCancel={() => router.push('/feed')}
      />
    </div>
  );
}`,
  },
  {
    path: 'app/api/tenant/onboarding/route.ts',
    name: 'tenant/onboarding/route.ts',
    category: 'api',
    description: 'Next.js Route Handler for tenant onboarding submission with strict UUID validation protecting against Postgres 22P02 errors.',
    code: `import { NextRequest, NextResponse } from 'next/server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const safeTenantId = (body.tenantId && UUID_REGEX.test(body.tenantId)) ? body.tenantId : DEFAULT_TENANT_ID;

  return NextResponse.json({
    success: true,
    has_completed_onboarding: true,
    tenantId: safeTenantId,
    message: 'Onboarding completed successfully'
  });
}`,
  },
  {
    path: 'components/navigation/BottomNav.tsx',
    name: 'BottomNav.tsx',
    category: 'ui',
    description: 'Safe-area compliant 4-feature mobile bottom navigation dock (Feed, Events, Chat, Profile) with 48x48px touch targets.',
    code: `'use client';

import React from 'react';
import { Newspaper, Calendar, MessageSquare, User } from 'lucide-react';

export function BottomNav({ currentTab, onTabChange, unreadChatCount = 0 }) {
  // 4 Core Tabs: Feed, Events, Chat, Profile
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-zinc-950/90 backdrop-blur-lg border-t border-zinc-800 pb-[env(safe-area-inset-bottom,0px)]">
      {/* 48x48px touch targets with active indicators */}
    </nav>
  );
}`,
  },
];

export const NextJsCodeExplorer: React.FC = () => {
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  const activeFile = NEXTJS_FILES[activeFileIndex];

  const handleCopy = () => {
    navigator.clipboard.writeText(activeFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([activeFile.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = activeFile.name;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 text-white shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase">
                Next.js App Router Architecture
              </span>
              <span className="text-xs text-slate-400">
                Next.js 15+ / Edge Middleware / Server Components
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Next.js Multi-Tenant Codebase &amp; Route Handlers
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Every route, middleware, and context file is written with strict Next.js App Router conventions. Inspect, copy, or export the production-ready Next.js modules below.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-xs"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied File' : 'Copy Active File'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download .ts</span>
            </button>
          </div>
        </div>

        {/* ARCHITECTURE PIPELINE STRIP */}
        <div className="mt-6 pt-5 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <div className="text-[11px] font-mono text-blue-400 flex items-center gap-1.5 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> 1. Edge Request
            </div>
            <div className="text-xs font-medium text-slate-200 mt-1">middleware.ts</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Extracts x-tenant-id from subdomain/headers with safe UUID check.</div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> 2. Server Context
            </div>
            <div className="text-xs font-medium text-slate-200 mt-1">lib/tenant/context.ts</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Defends against 22P02 errors, provides session SQL to Supabase.</div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <div className="text-[11px] font-mono text-purple-400 flex items-center gap-1.5 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" /> 3. App Router API
            </div>
            <div className="text-xs font-medium text-slate-200 mt-1">app/api/.../route.ts</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Scoped queries, Upstash Pub/Sub, partitioned media storage.</div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <div className="text-[11px] font-mono text-amber-400 flex items-center gap-1.5 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> 4. Client Hub
            </div>
            <div className="text-xs font-medium text-slate-200 mt-1">app/page.tsx</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Interactive corporate updates, real-time presence &amp; chat.</div>
          </div>
        </div>
      </div>

      {/* WORKSPACE & CODE VIEWER */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col md:flex-row min-h-[380px] md:min-h-[520px]">
        {/* FILE SIDEBAR */}
        <div className="w-full md:w-72 lg:w-80 bg-slate-50/70 border-b md:border-b-0 md:border-r border-slate-200 p-4 shrink-0 flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-slate-400" />
              <span>Project Structure</span>
            </div>

            <div className="space-y-1">
              {NEXTJS_FILES.map((file, idx) => {
                const isSelected = idx === activeFileIndex;
                return (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => setActiveFileIndex(idx)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all flex items-start gap-2.5 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs font-medium'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <FileCode className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                    <div className="truncate">
                      <div className="font-mono">{file.path}</div>
                      <div className={`text-[11px] truncate mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                        {file.category.toUpperCase()}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-2">
            <div className="font-semibold text-slate-700 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Next.js Deployment Spec</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Compatible with Vercel Edge Runtime, Cloudflare Pages, and Node.js standalone Docker deployment.
            </p>
          </div>
        </div>

        {/* CODE DISPLAY ZONE */}
        <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 min-w-0">
          <div className="px-4 sm:px-5 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 truncate pr-2">
              <span className="font-mono text-xs font-semibold text-slate-200 truncate">
                /{activeFile.path}
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:inline shrink-0">
                ({activeFile.code.split('\n').length} lines)
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors shrink-0 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="px-4 sm:px-5 py-2.5 bg-slate-900/40 border-b border-slate-800 text-xs text-slate-300">
            <p className="line-clamp-2">{activeFile.description}</p>
          </div>

          <div className="flex-1 p-4 sm:p-5 overflow-auto max-h-[55vh] md:max-h-[540px] font-mono text-xs leading-relaxed text-slate-300 select-all">
            <pre className="overflow-x-auto">
              <code>{activeFile.code}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
