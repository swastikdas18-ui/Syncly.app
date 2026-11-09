import React, { useState, useRef, useEffect } from 'react';
import { 
  Heart, 
  MessageSquare, 
  Share2, 
  Image as ImageIcon, 
  Upload, 
  X, 
  Send, 
  Plus, 
  Filter, 
  Check, 
  Sparkles,
  AlertCircle,
  Search,
  Edit3,
  Trash2
} from 'lucide-react';
import { Post, PostCategory, Tenant, PostComment } from '../types.ts';
import { api } from '../lib/api.ts';

interface PostFeedProps {
  posts: Post[];
  activeTenant: Tenant | null;
  onPostCreated: (post: Post) => void;
  onPostLiked: (postId: string, count: number, hasLiked: boolean) => void;
  onCommentAdded: (postId: string, comment: PostComment, count: number) => void;
  onPostUpdated?: (post: Post) => void;
  onPostDeleted?: (postId: string) => void;
  userRole?: string;
  currentUserId?: string;
  canCreatePost?: boolean;
}

const CATEGORIES: { id: string; label: string; key: PostCategory | 'all' }[] = [
  { id: 'all', label: 'All Updates', key: 'all' },
  { id: 'announcement', label: 'Announcements', key: 'announcement' },
  { id: 'general', label: 'General', key: 'general' },
  { id: 'spotlight', label: 'Spotlight', key: 'spotlight' },
  { id: 'qna', label: 'Q&A', key: 'qna' },
  { id: 'event', label: 'Events', key: 'event' },
];

export const PostFeed: React.FC<PostFeedProps> = ({
  posts,
  activeTenant,
  onPostCreated,
  onPostLiked,
  onCommentAdded,
  onPostUpdated,
  onPostDeleted,
  userRole,
  currentUserId,
  canCreatePost,
}) => {
  const canCreate = canCreatePost !== undefined ? canCreatePost : userRole !== 'intern';
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<PostCategory>('general');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Active edit state per post
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isUpdatingPost, setIsUpdatingPost] = useState(false);

  // Active expanded comments accordion per post
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({});

  // Lightbox preview for images
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Press '/' or 'Cmd/Ctrl + K' to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter posts by category and local search query (title, content, or author)
  const filteredPosts = posts.filter((p) => {
    const matchesCategory =
      selectedCategory === 'all' || p.category.toLowerCase() === selectedCategory.toLowerCase();
    if (!matchesCategory) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const titleMatch = p.title?.toLowerCase().includes(q);
    const contentMatch = p.content.toLowerCase().includes(q);
    const authorMatch = p.authorName?.toLowerCase().includes(q);
    return Boolean(titleMatch || contentMatch || authorMatch);
  });

  // Handle Drag & Drop / File Upload
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadError(null);

    const uploads: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        setUploadError('Only image files (PNG, JPG, WebP) are supported.');
        continue;
      }
      try {
        const result = await api.uploadMedia(file);
        if (result?.url) {
          uploads.push(result.url);
        }
      } catch (err) {
        console.error('Upload failed:', err);
        setUploadError('Upload failed. Try a smaller file.');
      }
    }

    setMediaUrls((prev) => [...prev, ...uploads]);
    setIsUploading(false);
  };

  const removeMedia = (index: number) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    if (activeTenant?.id) {
      api.setTenantId(activeTenant.id);
    }

    setIsSubmitting(true);
    const result = await api.createPost({
      title: title.trim(),
      content: content.trim(),
      category,
      mediaUrls,
    });

    if (result) {
      onPostCreated(result);
      setTitle('');
      setContent('');
      setCategory('general');
      setMediaUrls([]);
      setIsComposerExpanded(false);
    }
    setIsSubmitting(false);
  };

  const handleToggleLike = async (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const optimisticLikes = post.hasLiked ? post.likesCount - 1 : post.likesCount + 1;
    onPostLiked(postId, optimisticLikes, !post.hasLiked);

    const res = await api.toggleLikePost(postId);
    if (res) {
      onPostLiked(postId, res.likesCount, res.hasLiked);
    }
  };

  const handleToggleComments = (postId: string) => {
    setExpandedComments((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  const handleAddComment = async (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text || submittingComment[postId]) return;

    setSubmittingComment((prev) => ({ ...prev, [postId]: true }));
    const comment = await api.addComment(postId, text);
    if (comment) {
      const post = posts.find((p) => p.id === postId);
      const newCount = (post?.commentsCount || 0) + 1;
      onCommentAdded(postId, comment, newCount);
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
      setExpandedComments((prev) => ({ ...prev, [postId]: true }));
    }
    setSubmittingComment((prev) => ({ ...prev, [postId]: false }));
  };

  const handleStartEdit = (post: Post) => {
    setEditingPostId(post.id);
    setEditTitle(post.title || '');
    setEditContent(post.content || '');
  };

  const handleSaveEdit = async (postId: string) => {
    if (!editContent.trim()) return;
    setIsUpdatingPost(true);
    const res = await api.editPost(postId, { title: editTitle.trim(), content: editContent.trim() });
    setIsUpdatingPost(false);
    if (res.success) {
      const post = posts.find((p) => p.id === postId);
      if (post) {
        onPostUpdated?.({
          ...post,
          title: editTitle.trim(),
          content: editContent.trim(),
        });
      }
      setEditingPostId(null);
    }
  };

  const handleDeletePost = async (postId: string) => {
    const res = await api.deletePost(postId);
    if (res.success) {
      onPostDeleted?.(postId);
    }
  };

  const formatTimeAgo = (isoDate: string) => {
    const diff = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="max-w-4xl mx-auto py-3 sm:py-8 px-2.5 sm:px-6">
      
      {/* HEADER BANNER FOR CURRENT TENANT */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-6 border-b border-slate-800">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Organization Updates</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            {activeTenant?.name || 'Company Hub'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            {activeTenant?.tagline || 'Corporate Communications & Team Discussions'}
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={() => setIsComposerExpanded(!isComposerExpanded)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 rounded-xl transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Company Update</span>
          </button>
        )}
      </div>

      {/* TOP SEARCH BAR & CATEGORY FILTERS */}
      <div className="mb-6 space-y-3">
        {/* Local Search Input */}
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search updates by title or content... (Press / to focus)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchQuery('');
                searchInputRef.current?.blur();
              }
            }}
            aria-label="Search posts by title or content"
            className="w-full pl-10 pr-10 sm:pr-24 py-2.5 text-sm bg-white border border-slate-700/80 rounded-xl shadow-xs focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-100 bg-slate-950 focus:ring-2 focus:ring-blue-100 transition-all text-slate-900 placeholder-slate-400"
          />
          <div className="absolute right-3 flex items-center gap-1.5">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                title="Clear search (Esc)"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-400 bg-slate-100 border border-slate-700/80 rounded">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Search Query Kicker */}
        {searchQuery.trim() && (
          <div className="flex items-center justify-between text-xs text-slate-600 px-3 py-2 bg-blue-50/70 border border-blue-100/90 rounded-lg">
            <span>
              Showing <span className="font-semibold text-slate-900 font-mono tabular-nums">{filteredPosts.length}</span> of{' '}
              <span className="font-mono tabular-nums">{posts.length}</span> updates matching &ldquo;<span className="text-blue-600 font-medium">{searchQuery}</span>&rdquo;
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer underline ml-2"
            >
              Clear Search
            </button>
          </div>
        )}

        {/* Category Filter Horizontal Rail & Create Post Trigger */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-2 -mx-3.5 px-3.5 sm:mx-0 sm:px-0 scroll-smooth">
          <div className="flex items-center gap-1.5 shrink-0">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.key;
              const count = cat.key === 'all'
                ? posts.length
                : posts.filter((p) => p.category.toLowerCase() === cat.key).length;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.key)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all min-h-[36px] sm:min-h-0 flex items-center gap-1.5 cursor-pointer touch-manipulation ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/25'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${isActive ? 'bg-indigo-700/80 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setIsComposerExpanded(!isComposerExpanded)}
            className="sticky right-0 shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm shadow-indigo-500/25 transition-all cursor-pointer touch-manipulation min-h-[36px] sm:min-h-0 ml-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Post</span>
          </button>
        </div>
      </div>

      {/* COMPOSER DRAWER / CARD */}
      {isComposerExpanded && (
        <form onSubmit={handleCreatePost} className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-xl p-5 mb-8 backdrop-blur-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
            <span className="text-sm font-semibold text-slate-100">Publish Company Announcement</span>
            <button
              type="button"
              onClick={() => setIsComposerExpanded(false)}
              className="text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Title & Category Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Headline or Announcement Title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-700/80 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-100 bg-slate-950"
                />
              </div>
              <div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PostCategory)}
                  className="w-full px-3 py-2 text-sm border border-slate-700/80 rounded-lg bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-100 bg-slate-950"
                >
                  <option value="announcement">Announcement</option>
                  <option value="general">General</option>
                  <option value="spotlight">Spotlight</option>
                  <option value="qna">Q&amp;A</option>
                  <option value="event">Event</option>
                </select>
              </div>
            </div>

            {/* Content Body */}
            <div>
              <textarea
                rows={3}
                placeholder="Share context, engineering milestones, quarterly updates, or team questions..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                className="w-full px-3 py-2.5 text-sm border border-slate-700/80 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-100 bg-slate-950 resize-y"
              />
            </div>

            {/* Drag & Drop File Zone */}
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700/80 hover:border-indigo-500/60 bg-slate-950/50 hover:bg-indigo-950/30 rounded-lg p-4 text-center cursor-pointer transition-colors"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleFiles(e.target.files)}
                multiple
                accept="image/*"
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center gap-1.5">
                <Upload className="w-5 h-5 text-slate-400" />
                <div className="text-xs font-medium text-slate-700">
                  Drag &amp; drop photos or <span className="text-blue-600 underline">browse</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Target Supabase Storage Bucket: <code className="font-mono text-slate-500">community-media/{activeTenant?.id.slice(0, 8)}...</code>
                </div>
              </div>
            </div>

            {uploadError && (
              <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 p-2 rounded">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Uploaded Media Previews */}
            {mediaUrls.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                {mediaUrls.map((url, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-700/80 aspect-video bg-slate-100">
                    <img src={url} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeMedia(idx)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Composer Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                {isUploading ? 'Uploading media to storage...' : `${mediaUrls.length} image(s) attached`}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsComposerExpanded(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !content.trim() || isUploading}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50 rounded-lg transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Posting...' : 'Publish'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* POSTS LIST */}
      {filteredPosts.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-8 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              {searchQuery ? `No updates matching "${searchQuery}"` : 'No company updates yet'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {searchQuery
                ? 'Try checking for spelling or searching with broader keywords.'
                : 'Check back soon or share the first update with your team!'}
            </p>
          </div>
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="px-4 py-2 text-xs font-semibold text-indigo-400 bg-indigo-950/60 hover:bg-indigo-900/60 rounded-xl transition-colors cursor-pointer"
            >
              Reset Search &amp; Filters
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsComposerExpanded(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer shadow-sm shadow-indigo-500/20"
            >
              <Plus className="w-4 h-4" />
              Share First Update
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => {
            const isCommentsOpen = Boolean(expandedComments[post.id]);
            return (
              <article 
                key={post.id} 
                className="rounded-2xl border border-slate-800/80 bg-slate-900/90 p-4 sm:p-5 mb-4 shadow-xs transition-colors hover:border-slate-700/80"
              >
                {/* Post Header with unboxed metadata discipline */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center text-xs font-bold shrink-0">
                      {post.authorInitials || 'SY'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-slate-100">{post.authorName}</span>
                        <span className="text-xs text-slate-400">{post.authorRole}</span>
                      </div>
                      {/* Zero-Pill Unboxed Metadata with Typographic Separator */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                        <span className="font-mono">{formatTimeAgo(post.createdAt)}</span>
                        <span>·</span>
                        <span className="capitalize font-medium text-slate-300">{post.category}</span>
                        <span>·</span>
                        <span className="font-mono text-[11px] text-slate-500">
                          tenant:{post.tenantId.slice(0, 8)}...
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Post Actions: Edit & Delete */}
                  <div className="flex items-center gap-1.5">
                    {currentUserId && post.authorId === currentUserId && (
                      <button
                        type="button"
                        onClick={() => handleStartEdit(post)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Edit post"
                        aria-label="Edit post"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                    )}
                    {currentUserId && (post.authorId === currentUserId || userRole === 'admin' || userRole === 'owner') && (
                      <button
                        type="button"
                        onClick={() => handleDeletePost(post.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                        title="Delete post"
                        aria-label="Delete post"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Title & Body / Edit Mode */}
                {editingPostId === post.id ? (
                  <div className="mb-4 space-y-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Post title"
                      className="w-full px-3 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      placeholder="Post content"
                      className="w-full px-3 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingPostId(null)}
                        className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(post.id)}
                        disabled={isUpdatingPost || !editContent.trim()}
                        className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                      >
                        {isUpdatingPost ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="text-base font-semibold text-slate-100 mb-2 leading-snug">
                      {post.title}
                    </h2>
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line mb-4">
                      {post.content}
                    </p>
                  </>
                )}

                {/* Media Gallery Grid */}
                {post.mediaUrls && post.mediaUrls.length > 0 && (
                  <div className={`mb-4 rounded-xl overflow-hidden border border-slate-800 grid gap-1.5 ${
                    post.mediaUrls.length === 1 
                      ? 'grid-cols-1' 
                      : post.mediaUrls.length === 2 
                        ? 'grid-cols-2' 
                        : 'grid-cols-2 sm:grid-cols-3'
                  }`}>
                    {post.mediaUrls.map((url, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => setLightboxUrl(url)}
                        className="relative cursor-pointer group aspect-video bg-slate-900 rounded-xl overflow-hidden"
                      >
                        <img 
                          src={url} 
                          alt="Media attachment" 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover rounded-xl group-hover:scale-102 transition-transform duration-200" 
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Post Footer Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs text-slate-400">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handleToggleLike(post.id)}
                      className={`flex items-center gap-1.5 font-medium transition-colors ${
                        post.hasLiked ? 'text-rose-600' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${post.hasLiked ? 'fill-rose-600 text-rose-600' : ''}`} />
                      <span className="font-mono tabular-nums">{post.likesCount}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleComments(post.id)}
                      className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 font-medium transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span className="font-mono tabular-nums">{post.commentsCount}</span>
                      <span>Replies</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                    }}
                    className="flex items-center gap-1 text-slate-400 hover:text-slate-200"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </button>
                </div>

                {/* Expanded Threaded Comments */}
                {isCommentsOpen && (
                  <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                    <div className="text-xs font-semibold text-slate-300">
                      Threaded Discussion ({post.comments?.length || 0})
                    </div>

                    {post.comments && post.comments.length > 0 ? (
                      <div className="space-y-2.5">
                        {post.comments.map((comment) => (
                          <div key={comment.id} className="bg-slate-50/80 rounded-lg p-3 text-xs border border-slate-100">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900">{comment.authorName}</span>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  {formatTimeAgo(comment.createdAt)}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-slate-400">
                                {comment.authorRole}
                              </span>
                            </div>
                            <p className="text-slate-700 leading-normal">{comment.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic">
                        No replies yet. Start the conversation.
                      </div>
                    )}

                    {/* Add Reply Input */}
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="text"
                        placeholder="Write a reply..."
                        value={commentInputs[post.id] || ''}
                        onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddComment(post.id);
                        }}
                        className="flex-1 px-3 py-1.5 text-xs border border-slate-700/80 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-100 bg-slate-950"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddComment(post.id)}
                        disabled={submittingComment[post.id] || !commentInputs[post.id]?.trim()}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50 rounded-lg transition-colors shrink-0"
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div 
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-xl">
            <img src={lightboxUrl} alt="Enlarged view" className="w-full h-full object-contain" />
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-slate-900"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
