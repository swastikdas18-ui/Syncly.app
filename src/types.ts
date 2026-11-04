export type PostCategory = 'announcement' | 'general' | 'spotlight' | 'qna' | 'event';

export interface Tenant {
  id: string; // Valid UUID
  name: string;
  slug: string;
  createdAt: string;
  tagline: string;
  memberCount: number;
  logoUrl?: string;
  allowedDomains?: string[]; // e.g. ['stripe.com', 'stripe.org']
  isDiscoverable?: boolean;
  requiresApproval?: boolean;
  industry?: string;
  ownerId?: string;
}

export type Community = Tenant;

export interface Membership {
  id: string;
  userId: string;
  communityId: string;
  role: 'owner' | 'admin' | 'moderator' | 'member' | 'intern';
  joinedAt: string;
  community?: Tenant;
}

export interface CommunityJoinRequest {
  id: string;
  communityId: string;
  userId: string;
  userEmail: string;
  userName: string;
  userAvatar?: string;
  userRole?: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  id: string; // Valid UUID
  tenantId: string; // Valid UUID
  fullName: string;
  avatarUrl?: string;
  role: 'owner' | 'admin' | 'manager' | 'employee' | 'intern';
  status: 'active' | 'offline';
  initials: string;
  headline?: string;
}

export interface UserSession {
  user: {
    id: string;
    email: string;
    fullName: string;
    headline: string;
    role: 'owner' | 'admin' | 'manager' | 'employee' | 'intern';
    avatarUrl?: string;
    tenantId: string;
    hasCompletedOnboarding: boolean;
  };
  token: string;
}

export interface EventItem {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  category: 'workshop' | 'techtalk' | 'all-hands' | 'social';
  hostName: string;
  hostRole: string;
  rsvpCount: number;
  hasRsvped: boolean;
}

export interface OnboardingPayload {
  tenantId: string;
  fullName: string;
  headline: string;
  role: 'employee' | 'intern';
  avatarUrl: string;
  selectedChannels: string[];
  notifications: {
    emailDigest: boolean;
    realtimePush: boolean;
  };
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

// Re-export production database schema types
export type {
  Database,
  TenantRow,
  ProfileRow,
  ChannelRow,
  MessageRow,
  PostRow,
  PostCommentRow,
  UserViewRow,
} from '../types/database.ts';

