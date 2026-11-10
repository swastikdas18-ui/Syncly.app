'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PostFeed } from '@/components/community/PostFeed.tsx';
import { useUser, useTenant } from '@/lib/context/AuthContext.tsx';
import { useWorkspace } from '@/lib/context/WorkspaceContext.tsx';
import { Post } from '@/src/types.ts';
import { api } from '@/src/lib/api.ts';
import { Building2, Compass, PlusCircle, Loader2 } from 'lucide-react';

export default function FeedDashboardPage() {
  const router = useRouter();
  const { profile } = useUser();
  const { activeTenant } = useTenant();
  const { activeCommunity, joinedCommunities, isLoading: isWorkspaceLoading } = useWorkspace();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const verifiedWorkspace = activeCommunity || activeTenant;
  const hasMembership = Boolean(verifiedWorkspace?.id);

  useEffect(() => {
    async function loadFeed() {
      if (!verifiedWorkspace?.id) {
        setPosts([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        api.setTenantId(verifiedWorkspace.id);
        const data = await api.getPosts('all');
        setPosts(data || []);
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    }
    loadFeed();
  }, [verifiedWorkspace?.id]);

  const handlePostCreated = (newPost: Post) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const handlePostLiked = (postId: string, count: number, hasLiked: boolean) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, likesCount: count, hasLiked } : p))
    );
  };

  const handleCommentAdded = (postId: string, comment: any, count: number) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const currentComments = p.comments || [];
          return {
            ...p,
            commentsCount: count,
            comments: [...currentComments, comment],
          };
        }
        return p;
      })
    );
  };

  const handlePostUpdated = (updatedPost: any) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === updatedPost.id ? { ...p, ...updatedPost } : p))
    );
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  if (loading && isWorkspaceLoading) {
    return (
      <div className="py-24 text-center flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        <p className="text-xs text-slate-400">Loading feed...</p>
      </div>
    );
  }

  // Proper No-Membership Onboarding View
  if (!hasMembership && !isWorkspaceLoading) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-5 animate-in fade-in duration-200">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto shadow-md">
          <Building2 className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            You are not currently a member of any workspace.
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
            To view updates, participate in channels, and collaborate with colleagues, join an existing organization or launch a new workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto pt-2">
          <button
            type="button"
            onClick={() => router.push('/communities/explore')}
            className="p-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-md flex flex-col items-center gap-2 cursor-pointer"
          >
            <Compass className="w-5 h-5" />
            <span>Explore Workspaces</span>
            <span className="text-[10px] text-indigo-200 font-normal">Discover &amp; request to join</span>
          </button>

          <button
            type="button"
            onClick={() => router.push('/communities/new')}
            className="p-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold text-xs transition-all flex flex-col items-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-5 h-5 text-indigo-400" />
            <span>Create Workspace</span>
            <span className="text-[10px] text-slate-400 font-normal">Set up your company hub</span>
          </button>
        </div>
      </div>
    );
  }

  const tenantModel: any = verifiedWorkspace ? {
    id: verifiedWorkspace.id,
    name: verifiedWorkspace.name,
    slug: verifiedWorkspace.slug,
    createdAt: (verifiedWorkspace as any).created_at || (verifiedWorkspace as any).createdAt || new Date().toISOString(),
    tagline: (verifiedWorkspace as any).tagline || 'Corporate Workspace',
    memberCount: (verifiedWorkspace as any).memberCount || 1,
  } : null;

  return (
    <div className="w-full">
      <PostFeed
        posts={posts}
        activeTenant={tenantModel}
        onPostCreated={handlePostCreated}
        onPostLiked={handlePostLiked}
        onCommentAdded={handleCommentAdded}
        onPostUpdated={handlePostUpdated}
        onPostDeleted={handlePostDeleted}
        userRole={profile?.role as any}
        currentUserId={profile?.id}
        canCreatePost={profile?.role !== 'intern'}
      />
    </div>
  );
}
