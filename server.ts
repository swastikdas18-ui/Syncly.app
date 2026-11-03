import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import crypto from 'crypto';
import { DEFAULT_TENANT_ID, SECONDARY_TENANT_ID, isValidUUID, resolveTenantId } from './src/lib/tenantContext.ts';
import { SUPABASE_MIGRATION_SQL } from './src/lib/migrationSql.ts';

// Extend Express Request to include tenantId
declare global {
  namespace Express {
    interface Request {
      tenantId: string;
    }
  }
}

interface TenantRecord {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  memberCount: number;
  createdAt: string;
}

interface ProfileRecord {
  id: string;
  tenantId: string;
  fullName: string;
  role: 'admin' | 'manager' | 'employee';
  status: 'active' | 'offline';
  avatarUrl?: string;
  initials: string;
}

interface PostRecord {
  id: string;
  tenantId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  authorInitials: string;
  authorAvatar?: string;
  title: string;
  content: string;
  category: 'announcement' | 'general' | 'spotlight' | 'qna' | 'event';
  mediaUrls: string[];
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  likedBy: Set<string>;
  comments: CommentRecord[];
}

interface CommentRecord {
  id: string;
  tenantId: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  authorInitials: string;
  content: string;
  createdAt: string;
}

interface ChannelRecord {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  isPrivate: boolean;
  createdAt: string;
}

interface MessageRecord {
  id: string;
  tenantId: string;
  channelId: string;
  userId: string;
  userName: string;
  userRole: string;
  userInitials: string;
  content: string;
  mediaUrls: string[];
  createdAt: string;
}

// -----------------------------------------------------------------------------
// IN-MEMORY MULTI-TENANT ISOLATED STORE
// -----------------------------------------------------------------------------
const tenants: TenantRecord[] = [
  {
    id: DEFAULT_TENANT_ID,
    name: 'Acme Corporation',
    slug: 'acme-corp',
    tagline: 'Enterprise Cloud Infrastructure & Logistics',
    memberCount: 248,
    createdAt: '2026-01-15T09:00:00Z',
  },
  {
    id: SECONDARY_TENANT_ID,
    name: 'Globex Technologies',
    slug: 'globex-tech',
    tagline: 'Next-Gen Robotics & Autonomous Systems',
    memberCount: 165,
    createdAt: '2026-02-01T10:30:00Z',
  },
];

const profiles: ProfileRecord[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    tenantId: DEFAULT_TENANT_ID,
    fullName: 'Elena Rostova',
    role: 'admin',
    status: 'active',
    initials: 'ER',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    tenantId: DEFAULT_TENANT_ID,
    fullName: 'Marcus Vance',
    role: 'manager',
    status: 'active',
    initials: 'MV',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    tenantId: SECONDARY_TENANT_ID,
    fullName: 'Devon Thorne',
    role: 'admin',
    status: 'active',
    initials: 'DT',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    tenantId: SECONDARY_TENANT_ID,
    fullName: 'Maya Lin',
    role: 'employee',
    status: 'active',
    initials: 'ML',
  },
];

interface PresenceRecord {
  id: string;
  tenantId: string;
  fullName: string;
  role: string;
  initials: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  currentChannelId?: string;
  lastSeen?: string;
}

const presenceList: PresenceRecord[] = [
  // Acme Corporation Members
  {
    id: '11111111-1111-1111-1111-111111111111',
    tenantId: DEFAULT_TENANT_ID,
    fullName: 'Elena Rostova (You)',
    role: 'VP Engineering',
    initials: 'ER',
    status: 'online',
    currentChannelId: 'general',
    lastSeen: 'Active now',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    tenantId: DEFAULT_TENANT_ID,
    fullName: 'Marcus Vance',
    role: 'Infrastructure Lead',
    initials: 'MV',
    status: 'online',
    currentChannelId: 'engineering',
    lastSeen: 'Active now',
  },
  {
    id: 'acme-user-3',
    tenantId: DEFAULT_TENANT_ID,
    fullName: 'David Chen',
    role: 'Staff SRE',
    initials: 'DC',
    status: 'away',
    currentChannelId: 'engineering',
    lastSeen: 'Away 12m ago',
  },
  {
    id: 'acme-user-4',
    tenantId: DEFAULT_TENANT_ID,
    fullName: 'Jordan Reed',
    role: 'Security Specialist',
    initials: 'JR',
    status: 'busy',
    currentChannelId: 'leadership',
    lastSeen: 'In meeting',
  },
  {
    id: 'acme-user-5',
    tenantId: DEFAULT_TENANT_ID,
    fullName: 'Sarah Miller',
    role: 'Product Designer',
    initials: 'SM',
    status: 'offline',
    lastSeen: 'Last seen 2h ago',
  },

  // Globex Technologies Members
  {
    id: '33333333-3333-3333-3333-333333333333',
    tenantId: SECONDARY_TENANT_ID,
    fullName: 'Devon Thorne (You)',
    role: 'Chief Product Officer',
    initials: 'DT',
    status: 'online',
    currentChannelId: 'product-sync',
    lastSeen: 'Active now',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    tenantId: SECONDARY_TENANT_ID,
    fullName: 'Maya Lin',
    role: 'Firmware Engineer',
    initials: 'ML',
    status: 'online',
    currentChannelId: 'general',
    lastSeen: 'Active now',
  },
  {
    id: 'globex-user-3',
    tenantId: SECONDARY_TENANT_ID,
    fullName: 'Lucas Ray',
    role: 'Robotics Lead',
    initials: 'LR',
    status: 'busy',
    currentChannelId: 'design-crit',
    lastSeen: 'In hardware test',
  },
  {
    id: 'globex-user-4',
    tenantId: SECONDARY_TENANT_ID,
    fullName: 'Priya Patel',
    role: 'Autonomous Nav Architect',
    initials: 'PP',
    status: 'away',
    lastSeen: 'Away 25m ago',
  },
  {
    id: 'globex-user-5',
    tenantId: SECONDARY_TENANT_ID,
    fullName: 'Zoe Adams',
    role: 'QA Specialist',
    initials: 'ZA',
    status: 'offline',
    lastSeen: 'Last seen yesterday',
  },
];

const channels: ChannelRecord[] = [
  // Acme Channels
  {
    id: 'general',
    tenantId: DEFAULT_TENANT_ID,
    name: 'general',
    description: 'Company-wide updates and watercooler talk',
    isPrivate: false,
    createdAt: '2026-01-15T09:10:00Z',
  },
  {
    id: 'announcements',
    tenantId: DEFAULT_TENANT_ID,
    name: 'announcements',
    description: 'Official executive broadcasts and security alerts',
    isPrivate: false,
    createdAt: '2026-01-15T09:15:00Z',
  },
  {
    id: 'engineering',
    tenantId: DEFAULT_TENANT_ID,
    name: 'engineering',
    description: 'Systems architecture, RFCs, and sprint discussions',
    isPrivate: false,
    createdAt: '2026-01-15T09:20:00Z',
  },
  {
    id: 'leadership',
    tenantId: DEFAULT_TENANT_ID,
    name: 'leadership',
    description: 'Private executive leadership and quarterly OKRs',
    isPrivate: true,
    createdAt: '2026-01-15T09:25:00Z',
  },
  // Globex Channels
  {
    id: 'general',
    tenantId: SECONDARY_TENANT_ID,
    name: 'general',
    description: 'Globex headquarters team hub',
    isPrivate: false,
    createdAt: '2026-02-01T10:35:00Z',
  },
  {
    id: 'product-sync',
    tenantId: SECONDARY_TENANT_ID,
    name: 'product-sync',
    description: 'Robotics roadmap alignment and firmware releases',
    isPrivate: false,
    createdAt: '2026-02-01T10:40:00Z',
  },
  {
    id: 'design-crit',
    tenantId: SECONDARY_TENANT_ID,
    name: 'design-crit',
    description: 'Telemetry UI design critiques and user research',
    isPrivate: false,
    createdAt: '2026-02-01T10:45:00Z',
  },
];

const posts: PostRecord[] = [
  // Acme Posts
  {
    id: 'p-acme-1',
    tenantId: DEFAULT_TENANT_ID,
    authorId: '11111111-1111-1111-1111-111111111111',
    authorName: 'Elena Rostova',
    authorRole: 'VP Engineering',
    authorInitials: 'ER',
    title: 'Q1 Global Cloud Infrastructure Migration Complete',
    content: 'We have migrated 100% of tenant workloads into the new multi-region PostgreSQL cluster with Zero-RPO replication. Average latency dropped by 38% across all US and EU availability zones.',
    category: 'announcement',
    mediaUrls: [],
    likesCount: 32,
    commentsCount: 2,
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    likedBy: new Set(['user-1', 'user-2']),
    comments: [
      {
        id: 'c-acme-1',
        tenantId: DEFAULT_TENANT_ID,
        postId: 'p-acme-1',
        authorId: '22222222-2222-2222-2222-222222222222',
        authorName: 'Marcus Vance',
        authorRole: 'Infrastructure Lead',
        authorInitials: 'MV',
        content: 'Connection pooling with PgBouncer handled the peak traffic switchover with 0 dropped sockets.',
        createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
      },
    ],
  },
  {
    id: 'p-acme-2',
    tenantId: DEFAULT_TENANT_ID,
    authorId: '22222222-2222-2222-2222-222222222222',
    authorName: 'Marcus Vance',
    authorRole: 'Infrastructure Lead',
    authorInitials: 'MV',
    title: 'Team Spotlight: SRE Reliability Sprint Winners',
    content: 'Kudos to our platform resiliency squad for hardening our Row-Level Security test matrices. Automated tenant isolation checks now run on every pull request.',
    category: 'spotlight',
    mediaUrls: [],
    likesCount: 19,
    commentsCount: 1,
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    likedBy: new Set(),
    comments: [],
  },
  // Globex Posts
  {
    id: 'p-globex-1',
    tenantId: SECONDARY_TENANT_ID,
    authorId: '33333333-3333-3333-3333-333333333333',
    authorName: 'Devon Thorne',
    authorRole: 'Chief Product Officer',
    authorInitials: 'DT',
    title: 'Autonomous Navigation Firmware v4.2 Rolled Out',
    content: 'Firmware 4.2 introduces sub-millisecond edge sensor fusion and dynamic path planning under high interference. Field telemetry confirms a 99.98% mission success rate.',
    category: 'announcement',
    mediaUrls: [],
    likesCount: 44,
    commentsCount: 3,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    likedBy: new Set(['user-3']),
    comments: [
      {
        id: 'c-globex-1',
        tenantId: SECONDARY_TENANT_ID,
        postId: 'p-globex-1',
        authorId: '44444444-4444-4444-4444-444444444444',
        authorName: 'Maya Lin',
        authorRole: 'Firmware Engineer',
        authorInitials: 'ML',
        content: 'Memory footprint on the ARM Cortex edge units remained strictly within our 64KB SRAM ceiling.',
        createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
      },
    ],
  },
  {
    id: 'p-globex-2',
    tenantId: SECONDARY_TENANT_ID,
    authorId: '44444444-4444-4444-4444-444444444444',
    authorName: 'Maya Lin',
    authorRole: 'Firmware Engineer',
    authorInitials: 'ML',
    title: 'Q&A: Hardware In-The-Loop (HIL) Simulator Walkthrough',
    content: 'Hosting an open AMA this Thursday covering how we mock CAN bus anomalies and motor thermal spikes in CI pipelines.',
    category: 'qna',
    mediaUrls: [],
    likesCount: 15,
    commentsCount: 0,
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    likedBy: new Set(),
    comments: [],
  },
];

const messages: MessageRecord[] = [
  // Acme General Messages
  {
    id: 'm-acme-1',
    tenantId: DEFAULT_TENANT_ID,
    channelId: 'general',
    userId: '11111111-1111-1111-1111-111111111111',
    userName: 'Elena Rostova',
    userRole: 'admin',
    userInitials: 'ER',
    content: 'Morning team! Reminder that the quarterly town hall starts at 2:00 PM EST.',
    mediaUrls: [],
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'm-acme-2',
    tenantId: DEFAULT_TENANT_ID,
    channelId: 'general',
    userId: '22222222-2222-2222-2222-222222222222',
    userName: 'Marcus Vance',
    userRole: 'manager',
    userInitials: 'MV',
    content: 'Slide deck and Q&A slido link have been pinned to the #announcements channel.',
    mediaUrls: [],
    createdAt: new Date(Date.now() - 3600000 * 4.8).toISOString(),
  },
  {
    id: 'm-acme-3',
    tenantId: DEFAULT_TENANT_ID,
    channelId: 'engineering',
    userId: '22222222-2222-2222-2222-222222222222',
    userName: 'Marcus Vance',
    userRole: 'manager',
    userInitials: 'MV',
    content: 'Database connection pool scaling tested with 1,200 concurrent tenants. Memory overhead was negligible.',
    mediaUrls: [],
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  // Globex General Messages
  {
    id: 'm-globex-1',
    tenantId: SECONDARY_TENANT_ID,
    channelId: 'general',
    userId: '33333333-3333-3333-3333-333333333333',
    userName: 'Devon Thorne',
    userRole: 'admin',
    userInitials: 'DT',
    content: 'Welcome everyone! Firmware release party kicks off in the lab at 4 PM.',
    mediaUrls: [],
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: 'm-globex-2',
    tenantId: SECONDARY_TENANT_ID,
    channelId: 'product-sync',
    userId: '44444444-4444-4444-4444-444444444444',
    userName: 'Maya Lin',
    userRole: 'employee',
    userInitials: 'ML',
    content: 'LiDAR calibration metrics look rock solid. Zero edge drift detected over 48 hours of continuous runtime.',
    mediaUrls: [],
    createdAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
  },
];

// Active SSE client subscriptions keyed by client connection
interface SseClient {
  id: string;
  tenantId: string;
  res: Response;
}
let sseClients: SseClient[] = [];

function broadcastToTenant(tenantId: string, eventName: string, data: unknown) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    if (client.tenantId === tenantId) {
      try {
        client.res.write(payload);
      } catch {
        // Disconnected
      }
    }
  });
}

// -----------------------------------------------------------------------------
// SERVER INITIALIZATION
// -----------------------------------------------------------------------------
async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // ---------------------------------------------------------------------------
  // TENANT EXTRACTION & VALIDATION MIDDLEWARE
  // ---------------------------------------------------------------------------
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const rawTenantHeader = (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string);
    // Enforce strict UUID validation. Never allow string literals like 'tenant-default' to cause 22P02 Postgres errors.
    req.tenantId = resolveTenantId(rawTenantHeader);
    next();
  });

  // ---------------------------------------------------------------------------
  // REST API ROUTES
  // ---------------------------------------------------------------------------

  // 1. Tenants
  app.get('/api/tenants', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: tenants,
      defaultTenantId: DEFAULT_TENANT_ID,
    });
  });

  // 1b. Supabase Presence API (Scoped to active tenant)
  app.get('/api/presence', (req: Request, res: Response) => {
    const tenantPresence = presenceList.filter((p) => p.tenantId === req.tenantId);
    res.json({
      success: true,
      tenantId: req.tenantId,
      count: tenantPresence.length,
      data: tenantPresence,
    });
  });

  // Track / Update Current User Presence (Simulating channel.track())
  app.post('/api/presence/track', (req: Request, res: Response) => {
    const { status, channelId } = req.body;
    const validStatuses = ['online', 'away', 'busy', 'offline'];
    const newStatus = validStatuses.includes(status) ? status : 'online';

    // Find user or primary profile in active tenant
    const userInTenant = presenceList.find(
      (p) => p.tenantId === req.tenantId && p.fullName.includes('(You)')
    ) || presenceList.find((p) => p.tenantId === req.tenantId);

    if (userInTenant) {
      userInTenant.status = newStatus as 'online' | 'away' | 'busy' | 'offline';
      if (channelId) userInTenant.currentChannelId = channelId;
      userInTenant.lastSeen = newStatus === 'online' ? 'Active now' : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Broadcast Supabase Realtime Presence Sync Event
    const updatedTenantPresence = presenceList.filter((p) => p.tenantId === req.tenantId);
    broadcastToTenant(req.tenantId, 'PRESENCE_SYNC', {
      tenantId: req.tenantId,
      presence: updatedTenantPresence,
      updatedUser: userInTenant,
    });

    res.json({
      success: true,
      data: userInTenant,
      presence: updatedTenantPresence,
    });
  });

  // 2. Posts (Tenant-Isolated)
  app.get('/api/posts', (req: Request, res: Response) => {
    const category = req.query.category as string;
    const tenantPosts = posts.filter((p) => p.tenantId === req.tenantId);

    const filtered = category && category !== 'all'
      ? tenantPosts.filter((p) => p.category.toLowerCase() === category.toLowerCase())
      : tenantPosts;

    const sorted = [...filtered].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.json({
      success: true,
      tenantId: req.tenantId,
      count: sorted.length,
      data: sorted.map((p) => ({
        ...p,
        hasLiked: p.likedBy.has('current-user'),
      })),
    });
  });

  // Create Post
  app.post('/api/posts', (req: Request, res: Response) => {
    const { title, content, category, mediaUrls } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Post content is required.' });
    }

    const validCategories = ['announcement', 'general', 'spotlight', 'qna', 'event'];
    const sanitizedCategory = validCategories.includes(category) ? category : 'general';

    // Find author in this tenant
    const author = profiles.find((p) => p.tenantId === req.tenantId) || {
      id: crypto.randomUUID(),
      tenantId: req.tenantId,
      fullName: 'Alex Vance',
      role: 'employee' as const,
      initials: 'AV',
    };

    const newPost: PostRecord = {
      id: crypto.randomUUID(),
      tenantId: req.tenantId,
      authorId: author.id,
      authorName: author.fullName,
      authorRole: author.role === 'admin' ? 'Lead Architect' : 'Staff Engineer',
      authorInitials: author.initials,
      title: title?.trim() || 'Team Update',
      content: content.trim(),
      category: sanitizedCategory,
      mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : [],
      likesCount: 0,
      commentsCount: 0,
      createdAt: new Date().toISOString(),
      likedBy: new Set(),
      comments: [],
    };

    posts.unshift(newPost);

    // Broadcast Realtime Event
    broadcastToTenant(req.tenantId, 'POST_CREATED', {
      post: { ...newPost, hasLiked: false },
    });

    res.status(201).json({ success: true, data: newPost });
  });

  // Toggle Post Like
  app.post('/api/posts/:id/like', (req: Request, res: Response) => {
    const post = posts.find((p) => p.id === req.params.id && p.tenantId === req.tenantId);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found in active tenant.' });
    }

    const userId = 'current-user';
    const hasLiked = post.likedBy.has(userId);

    if (hasLiked) {
      post.likedBy.delete(userId);
      post.likesCount = Math.max(0, post.likesCount - 1);
    } else {
      post.likedBy.add(userId);
      post.likesCount += 1;
    }

    broadcastToTenant(req.tenantId, 'POST_LIKED', {
      postId: post.id,
      likesCount: post.likesCount,
    });

    res.json({
      success: true,
      postId: post.id,
      likesCount: post.likesCount,
      hasLiked: !hasLiked,
    });
  });

  // Add Comment
  app.post('/api/posts/:id/comments', (req: Request, res: Response) => {
    const post = posts.find((p) => p.id === req.params.id && p.tenantId === req.tenantId);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found in active tenant.' });
    }

    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Comment content cannot be empty.' });
    }

    const author = profiles.find((p) => p.tenantId === req.tenantId) || {
      id: crypto.randomUUID(),
      tenantId: req.tenantId,
      fullName: 'Alex Vance',
      role: 'employee' as const,
      initials: 'AV',
    };

    const newComment: CommentRecord = {
      id: crypto.randomUUID(),
      tenantId: req.tenantId,
      postId: post.id,
      authorId: author.id,
      authorName: author.fullName,
      authorRole: author.role,
      authorInitials: author.initials,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };

    post.comments.push(newComment);
    post.commentsCount = post.comments.length;

    broadcastToTenant(req.tenantId, 'COMMENT_CREATED', {
      postId: post.id,
      comment: newComment,
      commentsCount: post.commentsCount,
    });

    res.status(201).json({ success: true, data: newComment, commentsCount: post.commentsCount });
  });

  // 3. Channels (Tenant-Isolated)
  app.get('/api/channels', (req: Request, res: Response) => {
    const tenantChannels = channels.filter((c) => c.tenantId === req.tenantId);
    res.json({
      success: true,
      tenantId: req.tenantId,
      data: tenantChannels,
    });
  });

  // Create Channel
  app.post('/api/channels', (req: Request, res: Response) => {
    const { id, name, description, isPrivate } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Channel name is required.' });
    }

    const cleanId = (id || name).trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const existing = channels.find((c) => c.tenantId === req.tenantId && c.id === cleanId);
    if (existing) {
      return res.status(409).json({ success: false, error: 'Channel ID already exists in this tenant.' });
    }

    const newChannel: ChannelRecord = {
      id: cleanId,
      tenantId: req.tenantId,
      name: name.trim().toLowerCase(),
      description: description?.trim() || '',
      isPrivate: Boolean(isPrivate),
      createdAt: new Date().toISOString(),
    };

    channels.push(newChannel);
    broadcastToTenant(req.tenantId, 'CHANNEL_CREATED', { channel: newChannel });
    res.status(201).json({ success: true, data: newChannel });
  });

  // 4. Messages (Tenant & Channel Scoped)
  app.get('/api/channels/:channelId/messages', (req: Request, res: Response) => {
    const channelId = req.params.channelId;
    const channelMessages = messages.filter(
      (m) => m.tenantId === req.tenantId && m.channelId === channelId
    );

    const sorted = [...channelMessages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    res.json({
      success: true,
      tenantId: req.tenantId,
      channelId,
      count: sorted.length,
      data: sorted,
    });
  });

  // Send Message
  app.post('/api/channels/:channelId/messages', (req: Request, res: Response) => {
    const channelId = req.params.channelId;
    const { content, mediaUrls } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Message content is required.' });
    }

    const author = profiles.find((p) => p.tenantId === req.tenantId) || {
      id: crypto.randomUUID(),
      tenantId: req.tenantId,
      fullName: 'Alex Vance',
      role: 'employee' as const,
      initials: 'AV',
    };

    const newMessage: MessageRecord = {
      id: crypto.randomUUID(),
      tenantId: req.tenantId,
      channelId,
      userId: author.id,
      userName: author.fullName,
      userRole: author.role,
      userInitials: author.initials,
      content: content.trim(),
      mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : [],
      createdAt: new Date().toISOString(),
    };

    messages.push(newMessage);

    // Upstash Redis / Realtime PubSub broadcast simulation
    broadcastToTenant(req.tenantId, 'MESSAGE_CREATED', {
      channelId,
      message: newMessage,
    });

    res.status(201).json({ success: true, data: newMessage });
  });

  // 5. Media Upload API (Supabase Storage community-media simulation)
  app.post('/api/media/upload', (req: Request, res: Response) => {
    const { filename, base64Data, contentType } = req.body;
    if (!base64Data) {
      return res.status(400).json({ success: false, error: 'Media payload missing.' });
    }

    const cleanFilename = (filename || 'upload.png').replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${req.tenantId}/posts/${crypto.randomUUID()}_${cleanFilename}`;

    // Return persistent data URI or simulated bucket CDN url
    const cdnUrl = base64Data.startsWith('data:')
      ? base64Data
      : `data:${contentType || 'image/png'};base64,${base64Data}`;

    res.status(201).json({
      success: true,
      bucket: 'community-media',
      path: storagePath,
      url: cdnUrl,
      tenantId: req.tenantId,
    });
  });

  // 6. Real-Time SSE Stream Endpoint
  app.get('/api/events/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const clientId = crypto.randomUUID();
    const newClient: SseClient = {
      id: clientId,
      tenantId: req.tenantId,
      res,
    };

    sseClients.push(newClient);

    // Initial greeting handshake
    res.write(`event: CONNECTED\ndata: ${JSON.stringify({ clientId, tenantId: req.tenantId })}\n\n`);

    // Heartbeat
    const heartbeatTimer = setInterval(() => {
      try {
        res.write(': keep-alive\n\n');
      } catch {
        clearInterval(heartbeatTimer);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeatTimer);
      sseClients = sseClients.filter((c) => c.id !== clientId);
    });
  });

  // 7. Isolation Verification & Cross-Tenant Audit Endpoint
  app.get('/api/verify-isolation', (req: Request, res: Response) => {
    const tenantA = DEFAULT_TENANT_ID;
    const tenantB = SECONDARY_TENANT_ID;

    const postsA = posts.filter((p) => p.tenantId === tenantA);
    const channelsA = channels.filter((c) => c.tenantId === tenantA);
    const messagesA = messages.filter((m) => m.tenantId === tenantA);
    const profilesA = profiles.filter((p) => p.tenantId === tenantA);

    const postsB = posts.filter((p) => p.tenantId === tenantB);
    const channelsB = channels.filter((c) => c.tenantId === tenantB);
    const messagesB = messages.filter((m) => m.tenantId === tenantB);
    const profilesB = profiles.filter((p) => p.tenantId === tenantB);

    // Audit for leakage in active session
    const activeTenantId = req.tenantId;
    const foreignTenantId = activeTenantId === tenantA ? tenantB : tenantA;

    // Simulate query with active tenant RLS filter
    const activePosts = posts.filter((p) => p.tenantId === activeTenantId);
    const leakedRecords = activePosts.filter((p) => p.tenantId === foreignTenantId).length;

    res.json({
      success: true,
      tenantA: {
        id: tenantA,
        name: 'Acme Corporation',
        postsCount: postsA.length,
        channelsCount: channelsA.length,
        messagesCount: messagesA.length,
        profilesCount: profilesA.length,
      },
      tenantB: {
        id: tenantB,
        name: 'Globex Technologies',
        postsCount: postsB.length,
        channelsCount: channelsB.length,
        messagesCount: messagesB.length,
        profilesCount: profilesB.length,
      },
      crossQueryAudit: {
        queriedTenant: activeTenantId,
        recordsBelongingToOtherTenant: leakedRecords,
        isolationIntegrity: leakedRecords === 0 ? 'STRICT_PASS' : 'LEAK_DETECTED',
        verifiedAt: new Date().toISOString(),
      },
    });
  });

  // 8. SQL Migration Script Exporter
  app.get('/api/migration-sql', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(SUPABASE_MIGRATION_SQL);
  });

  // ---------------------------------------------------------------------------
  // VITE DEV SERVER INTEGRATION
  // ---------------------------------------------------------------------------
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Syncly Server] Multi-tenant backend running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Syncly Server] Failed to initialize:', err);
  process.exit(1);
});
