export type PostCategory = 'announcement' | 'general' | 'spotlight' | 'qna' | 'event';

export interface Tenant {
  id: string; // Valid UUID
  name: string;
  slug: string;
  createdAt: string;
  tagline: string;
  memberCount: number;
}

export interface Profile {
  id: string; // Valid UUID
  tenantId: string; // Valid UUID
  fullName: string;
  avatarUrl?: string;
  role: 'admin' | 'manager' | 'employee';
  status: 'active' | 'offline';
  initials: string;
}

export interface PresenceUser {
  id: string;
  tenantId: string;
  fullName: string;
  role: string;
  initials: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  currentChannelId?: string;
  lastSeen?: string;
}

export interface PostComment {
  id: string;
  tenantId: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorRole: string;
  authorInitials: string;
  content: string;
  createdAt: string;
}

export interface Post {
  id: string;
  tenantId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorRole: string;
  authorInitials: string;
  title: string;
  content: string;
  category: PostCategory;
  mediaUrls: string[];
  likesCount: number;
  commentsCount: number;
  hasLiked?: boolean;
  createdAt: string;
  comments?: PostComment[];
}

export interface Channel {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  isPrivate: boolean;
  createdAt: string;
  unreadCount?: number;
}

export interface ChatMessage {
  id: string;
  tenantId: string;
  channelId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userRole: string;
  userInitials: string;
  content: string;
  mediaUrls: string[];
  createdAt: string;
  status?: 'sending' | 'sent' | 'failed';
}

export interface IsolationAuditResult {
  tenantA: {
    id: string;
    name: string;
    postsCount: number;
    channelsCount: number;
    messagesCount: number;
    profilesCount: number;
  };
  tenantB: {
    id: string;
    name: string;
    postsCount: number;
    channelsCount: number;
    messagesCount: number;
    profilesCount: number;
  };
  crossQueryAudit: {
    queriedTenant: string;
    recordsBelongingToOtherTenant: number;
    isolationIntegrity: 'STRICT_PASS' | 'LEAK_DETECTED';
    verifiedAt: string;
  };
}
