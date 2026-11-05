import { Post, Channel, ChatMessage, Tenant, PostComment, IsolationAuditResult, PostCategory, PresenceUser } from '../types.ts';
import { DEFAULT_TENANT_ID, resolveTenantId } from './tenantContext.ts';

class SynclyApiClient {
  private currentTenantId: string = DEFAULT_TENANT_ID;
  private sseSource: EventSource | null = null;
  private pollingTimer: any = null;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

  public setTenantId(tenantId: string) {
    this.currentTenantId = resolveTenantId(tenantId);
    this.reconnectSse();
  }

  public getTenantId(): string {
    return this.currentTenantId;
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'x-tenant-id': this.currentTenantId,
    };
  }

  // --- TENANTS & COMMUNITIES ---
  public async getTenants(): Promise<Tenant[]> {
    try {
      const res = await fetch('/api/tenants', { headers: this.getHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.data) && json.data.length > 0) {
          return json.data;
        }
      }
    } catch (e) {
      console.warn('API getTenants /api/tenants fallback:', e);
    }

    try {
      const res = await fetch('/api/communities/explore', { headers: this.getHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.data) && json.data.length > 0) {
          return json.data;
        }
      }
    } catch (e) {
      console.warn('API getTenants /api/communities/explore fallback:', e);
    }

    try {
      const res = await fetch('/api/tenant/members', { headers: this.getHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.data) && json.data.length > 0) {
          return json.data;
        }
      }
    } catch (e) {
      console.warn('API getTenants /api/tenant/members fallback:', e);
    }

    return [
      {
        id: DEFAULT_TENANT_ID,
        name: 'Acme Corporation',
        slug: 'acme-corp',
        tagline: 'Global Enterprise Systems & Operations',
        memberCount: 142,
        createdAt: '2026-01-15T00:00:00.000Z',
        allowedDomains: ['acme.com', 'acmecorp.internal'],
        isDiscoverable: true,
        requiresApproval: false,
        industry: 'Enterprise Software & Cloud Infrastructure',
        ownerId: DEFAULT_TENANT_ID,
      },
    ];
  }

  // --- MEMBERSHIPS ---
  public async getMemberships(): Promise<any[]> {
    try {
      const res = await fetch('/api/memberships', { headers: this.getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch memberships');
      const json = await res.json();
      return json.data || [];
    } catch (e) {
      console.warn('API getMemberships fallback:', e);
      return [];
    }
  }

  public async batchJoinCommunities(communityIds: string[]): Promise<{
    success: boolean;
    joinedCount: number;
    joinedCommunities: any[];
    message: string;
  }> {
    try {
      const res = await fetch('/api/memberships/batch-join', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ communityIds }),
      });
      const json = await res.json();
      return json;
    } catch (e: any) {
      console.error('API batchJoinCommunities error:', e);
      return { success: false, joinedCount: 0, joinedCommunities: [], message: e.message || 'Batch join failed' };
    }
  }

  public async exploreCommunities(query?: string, userEmail?: string, filter?: string): Promise<{
    data: (Tenant & { matchesUserDomain: boolean; isCurrentWorkspace: boolean; isMember?: boolean; userRole?: string; hasPendingRequest: boolean; pendingRequestId?: string })[];
    callerDomain: string;
  }> {
    return this.searchCommunities(query, filter, userEmail);
  }

  public async searchCommunities(query?: string, filter?: string, userEmail?: string): Promise<{
    data: (Tenant & { matchesUserDomain: boolean; isCurrentWorkspace: boolean; isMember?: boolean; userRole?: string; hasPendingRequest: boolean; pendingRequestId?: string })[];
    callerDomain: string;
  }> {
    try {
      const url = new URL('/api/communities/search', window.location.origin);
      if (query) url.searchParams.set('q', query);
      if (filter && filter !== 'all') url.searchParams.set('filter', filter);
      const headers = {
        ...this.getHeaders(),
        ...(userEmail ? { 'x-user-email': userEmail } : {}),
      };
      const res = await fetch(url.toString(), { headers });
      if (!res.ok) throw new Error('Failed to search communities');
      const json = await res.json();
      return { data: json.data || [], callerDomain: json.callerDomain || '' };
    } catch (e) {
      console.warn('API searchCommunities error:', e);
      return { data: [], callerDomain: '' };
    }
  }

  public async createCommunity(payload: {
    name: string;
    slug?: string;
    tagline?: string;
    description?: string;
    logoUrl?: string;
    allowedDomains: string[];
    requiresApproval: boolean;
    isDiscoverable: boolean;
    industry?: string;
    creatorName?: string;
    creatorEmail?: string;
  }): Promise<{ success: boolean; data?: Tenant; error?: string }> {
    try {
      const res = await fetch('/api/communities/create', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Failed to create community' };
      }
      return { success: true, data: json.data };
    } catch (e: any) {
      console.error('API createCommunity error:', e);
      return { success: false, error: e.message || 'Network error' };
    }
  }

  public async joinCommunity(
    communityId: string,
    options: { message?: string; userEmail?: string; userName?: string }
  ): Promise<{ success: boolean; status: 'joined' | 'pending' | 'already_requested'; message: string; tenant?: Tenant }> {
    try {
      const res = await fetch(`/api/communities/${communityId}/join`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(options),
      });
      const json = await res.json();
      return json;
    } catch (e: any) {
      console.error('API joinCommunity error:', e);
      return { success: false, status: 'pending', message: e.message || 'Error joining community' };
    }
  }

  public async getCommunityRequests(communityId: string): Promise<{ count: number; pendingCount: number; data: any[] }> {
    try {
      const res = await fetch(`/api/communities/${communityId}/requests`, { headers: this.getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch requests');
      const json = await res.json();
      return { count: json.count || 0, pendingCount: json.pendingCount || 0, data: json.data || [] };
    } catch (e) {
      console.warn('API getCommunityRequests error:', e);
      return { count: 0, pendingCount: 0, data: [] };
    }
  }

  public async reviewCommunityRequest(
    communityId: string,
    requestId: string,
    action: 'approve' | 'reject'
  ): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`/api/communities/${communityId}/requests/${requestId}/review`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      return json;
    } catch (e: any) {
      console.error('API reviewCommunityRequest error:', e);
      return { success: false, message: e.message || 'Review failed' };
    }
  }

  // --- USER PROFILE ---
  public async updateProfile(payload: {
    id?: string;
    fullName?: string;
    headline?: string;
    avatarUrl?: string;
    role?: 'owner' | 'admin' | 'manager' | 'employee' | 'intern';
    email?: string;
  }): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      return json;
    } catch (e: any) {
      console.error('API updateProfile error:', e);
      return { success: false, message: e.message || 'Failed to update profile' };
    }
  }

  // --- POSTS ---
  public async getPosts(category?: string): Promise<Post[]> {
    try {
      const url = new URL('/api/posts', window.location.origin);
      if (category && category !== 'all') {
        url.searchParams.set('category', category);
      }
      const res = await fetch(url.toString(), { headers: this.getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch posts');
      const json = await res.json();
      return json.data;
    } catch (e) {
      console.warn('API getPosts error:', e);
      return [];
    }
  }

  public async createPost(payload: {
    title: string;
    content: string;
    category: PostCategory;
    mediaUrls: string[];
  }): Promise<Post | null> {
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create post');
      const json = await res.json();
      return json.data;
    } catch (e) {
      console.error('API createPost error:', e);
      return null;
    }
  }

  public async toggleLikePost(postId: string): Promise<{ likesCount: number; hasLiked: boolean } | null> {
    try {
      const res = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to like post');
      const json = await res.json();
      return { likesCount: json.likesCount, hasLiked: json.hasLiked };
    } catch (e) {
      console.error('API toggleLikePost error:', e);
      return null;
    }
  }

  public async addComment(postId: string, content: string): Promise<PostComment | null> {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Failed to add comment');
      const json = await res.json();
      return json.data;
    } catch (e) {
      console.error('API addComment error:', e);
      return null;
    }
  }

  // --- CHANNELS ---
  public async getChannels(): Promise<Channel[]> {
    try {
      const res = await fetch('/api/channels', { headers: this.getHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.data) && json.data.length > 0) {
          return json.data;
        }
      }
    } catch (e) {
      console.warn('API getChannels network fallback:', e);
    }

    return [
      {
        id: 'general',
        tenantId: this.currentTenantId,
        name: 'general',
        description: 'Company-wide updates & general watercooler',
        isPrivate: false,
        createdAt: '2026-01-15T00:00:00.000Z',
      },
      {
        id: 'announcements',
        tenantId: this.currentTenantId,
        name: 'announcements',
        description: 'Executive broadcasts and corporate notices',
        isPrivate: false,
        createdAt: '2026-01-15T00:00:00.000Z',
      },
    ];
  }

  public async createChannel(payload: { id?: string; name: string; description?: string; isPrivate?: boolean }): Promise<Channel | null> {
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create channel');
      const json = await res.json();
      return json.data;
    } catch (e) {
      console.error('API createChannel error:', e);
      return null;
    }
  }

  // --- MESSAGES ---
  public async getMessages(channelId: string): Promise<ChatMessage[]> {
    try {
      const res = await fetch(`/api/channels/${channelId}/messages`, { headers: this.getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch messages');
      const json = await res.json();
      return json.data;
    } catch (e) {
      console.warn('API getMessages error:', e);
      return [];
    }
  }

  public async sendMessage(channelId: string, content: string, mediaUrls: string[] = []): Promise<ChatMessage | null> {
    try {
      const res = await fetch(`/api/channels/${channelId}/messages`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ content, mediaUrls }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      const json = await res.json();
      return json.data;
    } catch (e) {
      console.error('API sendMessage error:', e);
      return null;
    }
  }

  // --- MEDIA UPLOAD ---
  public async uploadMedia(file: File): Promise<{ url: string; path: string } | null> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const res = await fetch('/api/media/upload', {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
              filename: file.name,
              base64Data,
              contentType: file.type,
            }),
          });
          if (!res.ok) throw new Error('Media upload failed');
          const json = await res.json();
          resolve({ url: json.url, path: json.path });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  // --- SUPABASE REALTIME PRESENCE ---
  public async getPresence(): Promise<PresenceUser[]> {
    try {
      const res = await fetch('/api/presence', { headers: this.getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch presence');
      const json = await res.json();
      return json.data;
    } catch (e) {
      console.warn('API getPresence error:', e);
      return [];
    }
  }

  public async trackPresence(status: 'online' | 'away' | 'busy' | 'offline', channelId?: string): Promise<PresenceUser | null> {
    try {
      const res = await fetch('/api/presence/track', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ status, channelId }),
      });
      if (!res.ok) throw new Error('Failed to track presence');
      const json = await res.json();
      return json.data;
    } catch (e) {
      console.error('API trackPresence error:', e);
      return null;
    }
  }

  // --- ISOLATION VERIFICATION AUDIT ---
  public async verifyIsolation(): Promise<IsolationAuditResult | null> {
    try {
      const res = await fetch('/api/verify-isolation', { headers: this.getHeaders() });
      if (!res.ok) throw new Error('Failed to verify isolation');
      const json = await res.json();
      return json;
    } catch (e) {
      console.error('API verifyIsolation error:', e);
      return null;
    }
  }

  // --- REAL-TIME SSE SUBSCRIPTION ---
  public subscribeToEvents(callback: (event: string, data: unknown) => void): () => void {
    const handler = (data: unknown) => callback('EVENT', data);
    if (!this.listeners.has('all')) {
      this.listeners.set('all', new Set());
    }
    this.listeners.get('all')!.add(handler);

    if (!this.sseSource) {
      this.connectSse();
    }

    return () => {
      this.listeners.get('all')?.delete(handler);
    };
  }

  private connectSse() {
    if (typeof window === 'undefined') return;

    try {
      if (this.sseSource) {
        this.sseSource.close();
        this.sseSource = null;
      }

      if (!('EventSource' in window)) {
        this.startPollingFallback();
        return;
      }

      const rawTenantId = this.currentTenantId;
      const cleanTenantId = (rawTenantId && rawTenantId !== 'undefined' && rawTenantId !== 'null' ? rawTenantId : '00000000-0000-0000-0000-000000000001').trim();
      const sseUrl = `/api/events/stream?tenantId=${encodeURIComponent(cleanTenantId)}`;
      const eventSource = new EventSource(sseUrl);
      this.sseSource = eventSource;

      eventSource.onopen = () => {
        this.stopPollingFallback();
      };

      eventSource.onerror = (err) => {
        console.warn('SSE stream disconnected, closing source to prevent connection spam:', err);
        eventSource.close();
        if (this.sseSource === eventSource) {
          this.sseSource = null;
        }
        this.startPollingFallback();
      };

      const forwardEvent = (eventName: string, ev: MessageEvent) => {
        try {
          const parsed = JSON.parse(ev.data);
          this.listeners.get('all')?.forEach((cb) => cb({ type: eventName, ...parsed }));
        } catch {
          // ignore parsing error
        }
      };

      eventSource.addEventListener('MESSAGE_CREATED', (e) => forwardEvent('MESSAGE_CREATED', e));
      eventSource.addEventListener('POST_CREATED', (e) => forwardEvent('POST_CREATED', e));
      eventSource.addEventListener('POST_LIKED', (e) => forwardEvent('POST_LIKED', e));
      eventSource.addEventListener('COMMENT_CREATED', (e) => forwardEvent('COMMENT_CREATED', e));
      eventSource.addEventListener('CHANNEL_CREATED', (e) => forwardEvent('CHANNEL_CREATED', e));
      eventSource.addEventListener('PRESENCE_SYNC', (e) => forwardEvent('PRESENCE_SYNC', e));
    } catch (e) {
      console.warn('SSE connection failed, falling back to periodic polling:', e);
      this.startPollingFallback();
    }
  }

  private startPollingFallback() {
    if (this.pollingTimer) return;
    this.pollingTimer = setInterval(async () => {
      try {
        await fetch(`/api/presence?tenantId=${encodeURIComponent(this.currentTenantId)}`, {
          headers: this.getHeaders(),
        });
      } catch {}
    }, 30000);
  }

  private stopPollingFallback() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private reconnectSse() {
    if (typeof window !== 'undefined') {
      this.connectSse();
    }
  }
}

export const api = new SynclyApiClient();
