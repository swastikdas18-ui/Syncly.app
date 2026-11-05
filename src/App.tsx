import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, MainViewType } from './components/Navbar.tsx';
import { PostFeed } from './components/PostFeed.tsx';
import { ChannelChat } from './components/ChannelChat.tsx';
import { EventsView } from './components/EventsView.tsx';
import { ProfileView } from './components/ProfileView.tsx';
import { IsolationInspector } from './components/IsolationInspector.tsx';
import { SqlMigrationViewer } from './components/SqlMigrationViewer.tsx';
import { NextJsCodeExplorer } from './components/NextJsCodeExplorer.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import { OnboardingWizard } from './components/OnboardingWizard.tsx';
import { ExploreCommunitiesView } from './components/ExploreCommunitiesView.tsx';
import { SearchCommunitiesView } from './components/SearchCommunitiesView.tsx';
import { CreateCommunityModal } from './components/CreateCommunityModal.tsx';
import { JoinRequestsModal } from './components/JoinRequestsModal.tsx';
import { BottomNav, BottomNavTab } from '../components/navigation/BottomNav.tsx';
import { Tenant, Post, Channel, PostComment, UserSession } from './types.ts';
import { api } from './lib/api.ts';
import { DEFAULT_TENANT_ID, INITIAL_TENANTS } from './lib/tenantContext.ts';

export function WorkConnectHub() {
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [tenants, setTenants] = useState<Tenant[]>(INITIAL_TENANTS);
  const [activeTenant, setActiveTenant] = useState<Tenant>(INITIAL_TENANTS[0]);
  const [joinedCommunities, setJoinedCommunities] = useState<Array<Tenant & { userRole?: string; isMember?: boolean }>>([]);
  const [activeView, setActiveView] = useState<MainViewType>('feed');
  const [session, setSession] = useState<UserSession | null>(null);
  const [isAuthMode, setIsAuthMode] = useState<boolean>(false);
  const [isOnboardingMode, setIsOnboardingMode] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
    const path = window.location.pathname;
    if (path.includes('search')) setActiveView('search');
    else if (path.includes('events')) setActiveView('events');
    else if (path.includes('chat') || path.includes('channels')) setActiveView('chat');
    else if (path.includes('profile')) setActiveView('profile');
    else if (path.includes('explore')) setActiveView('search');

    try {
      const stored = localStorage.getItem('syncly_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.user?.id && parsed?.user?.email) {
          setSession(parsed);
          setIsAuthMode(false);
          return;
        }
      }
      setIsAuthMode(true);
    } catch {
      setIsAuthMode(true);
    }
  }, []);

  const [posts, setPosts] = useState<Post[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>('general');
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Community Discovery & Modals
  const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState(false);
  const [isJoinRequestsOpen, setIsJoinRequestsOpen] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchPendingRequests = useCallback(async (tenantId: string) => {
    try {
      const res = await api.getCommunityRequests(tenantId);
      setPendingRequestsCount(res.pendingCount || 0);
    } catch {
      setPendingRequestsCount(0);
    }
  }, []);

  // Sync cookies with current session
  useEffect(() => {
    if (session) {
      document.cookie = `x-tenant-id=${session.user.tenantId}; path=/; max-age=2592000`;
      document.cookie = `syncly_role=${session.user.role}; path=/; max-age=2592000`;
      if (session.user.hasCompletedOnboarding) {
        document.cookie = `syncly_onboarded=true; path=/; max-age=2592000`;
      }
    }
  }, [session]);

  const fetchMemberships = useCallback(async () => {
    try {
      const res = await api.getMemberships();
      if (res && res.length > 0) {
        setJoinedCommunities(
          res.map((m: any) => ({
            ...(m.community || {}),
            id: m.communityId,
            name: m.community?.name || (m.communityId === INITIAL_TENANTS[0].id ? INITIAL_TENANTS[0].name : INITIAL_TENANTS[1].name),
            slug: m.community?.slug || (m.communityId === INITIAL_TENANTS[0].id ? INITIAL_TENANTS[0].slug : INITIAL_TENANTS[1].slug),
            tagline: m.community?.tagline || '',
            logoUrl: m.community?.logoUrl,
            userRole: m.role || 'member',
            isMember: true,
          }))
        );
      }
    } catch {
      // fallback
    }
  }, []);

  // Load Tenants & Memberships on mount
  useEffect(() => {
    api.getTenants().then((data) => {
      if (data && data.length > 0) {
        setTenants(data);
        const storedActiveId = typeof localStorage !== 'undefined' ? localStorage.getItem('active_community_id') : null;
        const current = (storedActiveId && data.find((t) => t.id === storedActiveId)) || data.find((t) => t.id === activeTenant.id) || data[0];
        setActiveTenant(current);
        api.setTenantId(current.id);
      }
    });
    fetchMemberships();
  }, [fetchMemberships]);

  // Refresh posts & channels when activeTenant changes
  const refreshTenantData = useCallback(async (tenantId: string) => {
    api.setTenantId(tenantId);
    
    const [fetchedPosts, fetchedChannels] = await Promise.all([
      api.getPosts('all'),
      api.getChannels(),
    ]);

    setPosts(fetchedPosts);
    setChannels(fetchedChannels);
    if (fetchedChannels.length > 0) {
      setActiveChannelId(fetchedChannels[0].id);
    }
  }, []);

  useEffect(() => {
    if (activeTenant) {
      refreshTenantData(activeTenant.id);
      fetchPendingRequests(activeTenant.id);
    }
  }, [activeTenant, refreshTenantData, fetchPendingRequests]);

  // Real-time Event Subscription
  useEffect(() => {
    const unsubscribe = api.subscribeToEvents((event, data) => {
      const payload = data as {
        type?: string;
        post?: Post;
        postId?: string;
        likesCount?: number;
        comment?: PostComment;
        commentsCount?: number;
        channel?: Channel;
        community?: Tenant;
        request?: any;
      };

      if (payload.type === 'POST_CREATED' && payload.post) {
        setPosts((prev) => {
          if (prev.some((p) => p.id === payload.post?.id)) return prev;
          return [payload.post!, ...prev];
        });
      } else if (payload.type === 'POST_LIKED' && payload.postId) {
        setPosts((prev) =>
          prev.map((p) => (p.id === payload.postId ? { ...p, likesCount: payload.likesCount ?? p.likesCount } : p))
        );
      } else if (payload.type === 'COMMENT_CREATED' && payload.postId && payload.comment) {
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id === payload.postId) {
              const currentComments = p.comments || [];
              return {
                ...p,
                commentsCount: payload.commentsCount ?? currentComments.length + 1,
                comments: [...currentComments, payload.comment!],
              };
            }
            return p;
          })
        );
      } else if (payload.type === 'CHANNEL_CREATED' && payload.channel) {
        setChannels((prev) => {
          if (prev.some((c) => c.id === payload.channel?.id)) return prev;
          return [...prev, payload.channel!];
        });
      } else if (payload.type === 'JOIN_REQUEST_CREATED') {
        if (activeTenant) {
          fetchPendingRequests(activeTenant.id);
          showToast('New membership access request submitted for admin review');
        }
      } else if (payload.type === 'JOIN_REQUEST_UPDATED') {
        if (activeTenant) {
          fetchPendingRequests(activeTenant.id);
        }
      } else if (payload.type === 'COMMUNITY_CREATED' && payload.community) {
        api.getTenants().then((data) => {
          if (data && data.length > 0) setTenants(data);
        });
      }
    });

    return () => unsubscribe();
  }, [activeTenant, fetchPendingRequests]);

  const handleSelectTenant = (tenant: Tenant) => {
    setActiveTenant(tenant);
    api.setTenantId(tenant.id);
    document.cookie = `active_community_id=${tenant.id}; path=/; max-age=2592000`;
    document.cookie = `x-tenant-id=${tenant.id}; path=/; max-age=2592000`;
    try {
      localStorage.setItem('active_community_id', tenant.id);
      localStorage.setItem('x-tenant-id', tenant.id);
    } catch {}
    if (session) {
      const updated = {
        ...session,
        user: { ...session.user, tenantId: tenant.id }
      };
      setSession(updated);
      try {
        localStorage.setItem('syncly_session', JSON.stringify(updated));
      } catch {}
    }
    showToast(`Switched workspace context to ${tenant.name}`);
  };

  const handlePostCreated = (newPost: Post) => {
    setPosts((prev) => [newPost, ...prev]);
    showToast('Company update published');
  };

  const handlePostLiked = (postId: string, count: number, hasLiked: boolean) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, likesCount: count, hasLiked } : p))
    );
  };

  const handleCommentAdded = (postId: string, comment: PostComment, count: number) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const existing = p.comments || [];
          return {
            ...p,
            commentsCount: count,
            comments: [...existing, comment],
          };
        }
        return p;
      })
    );
    showToast('Reply added to discussion');
  };

  const handleChannelCreated = (newChannel: Channel) => {
    setChannels((prev) => [...prev, newChannel]);
    showToast(`Channel #${newChannel.name} created`);
  };

  const handleCommunityCreated = (newCommunity: Tenant) => {
    setTenants((prev) => {
      if (prev.some((t) => t.id === newCommunity.id)) return prev;
      return [...prev, newCommunity];
    });
    setActiveTenant(newCommunity);
    api.setTenantId(newCommunity.id);
    document.cookie = `active_community_id=${newCommunity.id}; path=/; max-age=2592000`;
    document.cookie = `x-tenant-id=${newCommunity.id}; path=/; max-age=2592000`;
    try {
      localStorage.setItem('active_community_id', newCommunity.id);
      localStorage.setItem('x-tenant-id', newCommunity.id);
    } catch {}
    if (session) {
      const updated: UserSession = {
        ...session,
        user: {
          ...session.user,
          tenantId: newCommunity.id,
          role: 'owner',
        },
      };
      setSession(updated);
      try {
        localStorage.setItem('syncly_session', JSON.stringify(updated));
      } catch {}
    }
    fetchMemberships();
    setActiveView('feed');
    showToast(`🎉 Workspace "${newCommunity.name}" created! You are the workspace owner.`);
  };

  const handleLoginSuccess = (newSession: UserSession) => {
    setSession(newSession);
    setIsAuthMode(false);
    try {
      localStorage.setItem('syncly_session', JSON.stringify(newSession));
      localStorage.setItem('active_community_id', newSession.user.tenantId);
      localStorage.setItem('x-tenant-id', newSession.user.tenantId);
      document.cookie = `active_community_id=${newSession.user.tenantId}; path=/; max-age=2592000`;
      document.cookie = `x-tenant-id=${newSession.user.tenantId}; path=/; max-age=2592000`;
      document.cookie = `syncly_role=${newSession.user.role}; path=/; max-age=2592000`;
    } catch {}
    api.setTenantId(newSession.user.tenantId);
    showToast(`Welcome back, ${newSession.user.fullName}!`);
  };

  const handleOnboardingComplete = (updatedSession: UserSession) => {
    setSession(updatedSession);
    setIsOnboardingMode(false);
    try {
      localStorage.setItem('syncly_session', JSON.stringify(updatedSession));
    } catch {}
    showToast('Onboarding completed! Welcome to your team.');
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('syncly_session');
      localStorage.removeItem('active_community_id');
      localStorage.removeItem('x-tenant-id');
      document.cookie = 'x-tenant-id=; path=/; max-age=0';
      document.cookie = 'syncly_role=; path=/; max-age=0';
      document.cookie = 'active_community_id=; path=/; max-age=0';
    } catch {}
    setSession(null);
    setIsAuthMode(true);
    showToast('Signed out of workspace');
  };

  const handleUpdateProfile = (updatedData: {
    fullName?: string;
    headline?: string;
    avatarUrl?: string;
    role?: 'owner' | 'admin' | 'manager' | 'employee' | 'intern';
    email?: string;
  }) => {
    if (!session) return;
    const updatedSession: UserSession = {
      ...session,
      user: {
        ...session.user,
        ...updatedData,
      },
    };
    setSession(updatedSession);
    try {
      localStorage.setItem('syncly_session', JSON.stringify(updatedSession));
    } catch {}
    if (updatedData.role) {
      document.cookie = `syncly_role=${updatedData.role}; path=/; max-age=2592000`;
    }
  };

  // Convert main activeView to BottomNavTab if applicable
  const getBottomNavTab = (): BottomNavTab => {
    if (activeView === 'events') return 'events';
    if (activeView === 'chat') return 'chat';
    if (activeView === 'profile') return 'profile';
    return 'feed';
  };

  const handleBottomNavChange = (tab: BottomNavTab) => {
    setActiveView(tab);
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 h-16" />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* If in Auth Mode */}
      {isAuthMode ? (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
          <LoginScreen
            onLoginSuccess={handleLoginSuccess}
            defaultTenantId={activeTenant.id}
          />
        </div>
      ) : isOnboardingMode ? (
        /* If in Guided 3-Step Onboarding Mode */
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4">
          <OnboardingWizard
            currentSession={session}
            tenants={tenants}
            onComplete={handleOnboardingComplete}
            onCancel={() => setIsOnboardingMode(false)}
          />
        </div>
      ) : (
        /* Standard Workspace Application View */
        <>
          {/* Top Bar Navigation */}
          <Navbar
            tenants={tenants}
            activeTenant={activeTenant}
            onSelectTenant={handleSelectTenant}
            activeView={activeView}
            onSelectView={setActiveView}
            isLiveConnected={isLiveConnected}
            currentSession={session}
            onOpenLogin={() => setIsAuthMode(true)}
            pendingRequestsCount={pendingRequestsCount}
            onOpenJoinRequests={() => setIsJoinRequestsOpen(true)}
            onOpenCreateCommunity={() => setIsCreateCommunityOpen(true)}
            joinedCommunities={joinedCommunities}
          />

          {/* Main Content Viewport with adaptive padding for chat vs standard scrolling views */}
          <main className={`flex-1 w-full overflow-x-hidden ${activeView === 'chat' ? 'pb-16 md:pb-0' : 'pb-24 md:pb-6'}`}>
            {activeView === 'feed' && (
              <PostFeed
                posts={posts}
                activeTenant={activeTenant}
                onPostCreated={handlePostCreated}
                onPostLiked={handlePostLiked}
                onCommentAdded={handleCommentAdded}
                userRole={session?.user?.role}
                canCreatePost={session?.user?.role !== 'intern'}
              />
            )}

            {activeView === 'events' && (
              <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
                <EventsView currentTenant={activeTenant} />
              </div>
            )}

            {activeView === 'chat' && (
              <ChannelChat
                channels={channels}
                activeChannelId={activeChannelId}
                onSelectChannel={setActiveChannelId}
                onChannelCreated={handleChannelCreated}
                activeTenant={activeTenant}
              />
            )}

            {(activeView === 'search' || activeView === 'explore') && (
              <SearchCommunitiesView
                currentSession={session}
                activeTenant={activeTenant}
                onSelectTenant={(t) => {
                  handleSelectTenant(t);
                  fetchMemberships();
                }}
                onOpenCreateModal={() => setIsCreateCommunityOpen(true)}
                onShowToast={showToast}
                onNavigateToFeed={() => setActiveView('feed')}
              />
            )}

            {activeView === 'profile' && (
              <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
                <ProfileView
                  session={session}
                  currentTenant={activeTenant}
                  onRestartOnboarding={() => setIsOnboardingMode(true)}
                  onLogout={handleLogout}
                  onSelectView={setActiveView}
                  onUpdateProfile={handleUpdateProfile}
                />
              </div>
            )}

            {activeView === 'nextjs' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <NextJsCodeExplorer />
              </div>
            )}

            {activeView === 'inspector' && (
              <IsolationInspector activeTenant={activeTenant} />
            )}

            {activeView === 'schema' && (
              <SqlMigrationViewer />
            )}
          </main>

          {/* Creation & Admin Modals */}
          <CreateCommunityModal
            isOpen={isCreateCommunityOpen}
            onClose={() => setIsCreateCommunityOpen(false)}
            currentSession={session}
            onCommunityCreated={handleCommunityCreated}
          />

          <JoinRequestsModal
            isOpen={isJoinRequestsOpen}
            onClose={() => setIsJoinRequestsOpen(false)}
            activeTenant={activeTenant}
            onRequestReviewed={() => {
              fetchPendingRequests(activeTenant.id);
              showToast('Membership request updated');
            }}
          />

          {/* STREAMLINED 4-FEATURE MOBILE BOTTOM NAVIGATION DOCK */}
          <BottomNav
            currentTab={getBottomNavTab()}
            onTabChange={handleBottomNavChange}
            unreadChatCount={2}
          />

          {/* Notification Toast */}
          {toastMessage && (
            <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Clean Enterprise Footer (Hidden on mobile) */}
          <footer className="hidden md:block border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">Syncly</span>
                <span>·</span>
                <span>Multi-Tenant Enterprise Hub</span>
                <span>·</span>
                <span className="text-blue-600 font-mono">Next.js App Router &amp; Postgres RLS</span>
              </div>
              <div className="font-mono text-[11px] text-slate-400">
                Active Tenant UUID: {activeTenant?.id}
              </div>
            </div>
          </footer>
        </>
      )}

    </div>
  );
}

export default WorkConnectHub;
