'use client';

import React, { useState, useEffect } from 'react';
import { PostFeed } from '@/components/community/PostFeed.tsx';
import { useUser, useTenant } from '@/lib/context/AuthContext.tsx';
import { Post } from '@/src/types.ts';
import { api } from '@/src/lib/api.ts';

export default function FeedDashboardPage() {
  const { profile } = useUser();
  const { activeTenant } = useTenant();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFeed() {
      try {
        setLoading(true);
        const data = await api.getPosts('all');
        setPosts(data || []);
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    }
    loadFeed();
  }, [activeTenant?.id]);

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

  if (!activeTenant) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-500 text-sm">
        No active workspace selected. Select a workspace from the top bar.
      </div>
    );
  }

  const tenantModel: any = activeTenant ? {
    id: activeTenant.id,
    name: activeTenant.name,
    slug: activeTenant.slug,
    createdAt: activeTenant.created_at,
    tagline: 'Enterprise Workspace',
    memberCount: 1,
  } : null;

  return (
    <div className="w-full">
      <PostFeed
        posts={posts}
        activeTenant={tenantModel}
        onPostCreated={handlePostCreated}
        onPostLiked={handlePostLiked}
        onCommentAdded={handleCommentAdded}
        userRole={profile?.role as any}
        canCreatePost={profile?.role !== 'intern'}
      />
    </div>
  );
}
