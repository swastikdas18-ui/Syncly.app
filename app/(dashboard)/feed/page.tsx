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
        if (activeTenant?.id) {
          api.setTenantId(activeTenant.id);
        }
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

  const tenantModel: any = {
    id: activeTenant?.id || '00000000-0000-0000-0000-000000000001',
    name: activeTenant?.name || 'Acme Corporation',
    slug: activeTenant?.slug || 'acme-corp',
    createdAt: activeTenant?.created_at || new Date().toISOString(),
    tagline: 'Enterprise Workspace',
    memberCount: 1,
  };

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
