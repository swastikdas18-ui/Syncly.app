import React, { useState, useEffect, useCallback } from 'react';
import { Layers, MessageSquare, ShieldCheck, FileCode2 } from 'lucide-react';
import { Navbar } from './components/Navbar.tsx';
import { PostFeed } from './components/PostFeed.tsx';
import { ChannelChat } from './components/ChannelChat.tsx';
import { IsolationInspector } from './components/IsolationInspector.tsx';
import { SqlMigrationViewer } from './components/SqlMigrationViewer.tsx';
import { Tenant, Post, Channel, PostComment } from './types.ts';
import { api } from './lib/api.ts';
import { DEFAULT_TENANT_ID, INITIAL_TENANTS } from './lib/tenantContext.ts';

export function WorkConnectHub() {
  const [tenants, setTenants] = useState<Tenant[]>(INITIAL_TENANTS);
  const [activeTenant, setActiveTenant] = useState<Tenant>(INITIAL_TENANTS[0]);
  const [activeView, setActiveView] = useState<'feed' | 'chat' | 'schema' | 'inspector'>('feed');
  const [posts, setPosts] = useState<Post[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>('general');
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Load Tenants on mount
  useEffect(() => {
    api.getTenants().then((data) => {
      if (data && data.length > 0) {
        setTenants(data);
        const current = data.find((t) => t.id === activeTenant.id) || data[0];
        setActiveTenant(current);
        api.setTenantId(current.id);
      }
    });
  }, []);

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
    }
  }, [activeTenant, refreshTenantData]);

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
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSelectTenant = (tenant: Tenant) => {
    setActiveTenant(tenant);
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* Top Bar Navigation */}
      <Navbar
        tenants={tenants}
        activeTenant={activeTenant}
        onSelectTenant={handleSelectTenant}
        activeView={activeView}
        onSelectView={setActiveView}
        isLiveConnected={isLiveConnected}
      />

      {/* Main Content Viewport with mobile bottom spacing */}
      <main className="flex-1 pb-20 md:pb-6">
        {activeView === 'feed' && (
          <PostFeed
            posts={posts}
            activeTenant={activeTenant}
            onPostCreated={handlePostCreated}
            onPostLiked={handlePostLiked}
            onCommentAdded={handleCommentAdded}
          />
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

        {activeView === 'inspector' && (
          <IsolationInspector activeTenant={activeTenant} />
        )}

        {activeView === 'schema' && (
          <SqlMigrationViewer />
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav 
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-1 flex items-center justify-around shadow-lg"
      >
        <button
          type="button"
          onClick={() => setActiveView('feed')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-lg min-w-[60px] min-h-[46px] transition-colors cursor-pointer ${
            activeView === 'feed'
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
        >
          <Layers className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] leading-tight">Feed</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('chat')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-lg min-w-[60px] min-h-[46px] transition-colors cursor-pointer ${
            activeView === 'chat'
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
        >
          <MessageSquare className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] leading-tight">Chat</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('inspector')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-lg min-w-[60px] min-h-[46px] transition-colors cursor-pointer ${
            activeView === 'inspector'
              ? 'text-emerald-600 font-bold'
              : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
        >
          <ShieldCheck className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] leading-tight">Audit</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('schema')}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-lg min-w-[60px] min-h-[46px] transition-colors cursor-pointer ${
            activeView === 'schema'
              ? 'text-indigo-600 font-bold'
              : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
        >
          <FileCode2 className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] leading-tight">SQL</span>
        </button>
      </nav>

      {/* Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Clean Enterprise Footer (Hidden on mobile or compact) */}
      <footer className="hidden md:block border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">Syncly</span>
            <span>·</span>
            <span>Multi-Tenant Enterprise Hub</span>
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            Active Tenant ID: {activeTenant?.id}
          </div>
        </div>
      </footer>

    </div>
  );
}

export default WorkConnectHub;
