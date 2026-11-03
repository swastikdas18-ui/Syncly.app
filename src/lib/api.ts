import { Post, Channel, ChatMessage, Tenant, PostComment, IsolationAuditResult, PostCategory, PresenceUser } from '../types.ts';
import { DEFAULT_TENANT_ID, resolveTenantId } from './tenantContext.ts';

class SynclyApiClient {
  private currentTenantId: string = DEFAULT_TENANT_ID;
  private sseSource: EventSource | null = null;
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

  // --- TENANTS ---
  public async getTenants(): Promise<Tenant[]> {
    try {
      const res = await fetch('/api/tenants', { headers: this.getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch tenants');
      const json = await res.json();
      return json.data;
    } catch (e) {
      console.warn('API getTenants fallback:', e);
      return [];
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
      if (!res.ok) throw new Error('Failed to fetch channels');
      const json = await res.json();
      return json.data;
    } catch (e) {
      console.warn('API getChannels error:', e);
      return [];
    }
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
    try {
      if (this.sseSource) {
        this.sseSource.close();
      }
      const sseUrl = `/api/events/stream?tenantId=${encodeURIComponent(this.currentTenantId)}`;
      this.sseSource = new EventSource(sseUrl);

      const forwardEvent = (eventName: string, ev: MessageEvent) => {
        try {
          const parsed = JSON.parse(ev.data);
          this.listeners.get('all')?.forEach((cb) => cb({ type: eventName, ...parsed }));
        } catch {
          // ignore parsing error
        }
      };

      this.sseSource.addEventListener('MESSAGE_CREATED', (e) => forwardEvent('MESSAGE_CREATED', e));
      this.sseSource.addEventListener('POST_CREATED', (e) => forwardEvent('POST_CREATED', e));
      this.sseSource.addEventListener('POST_LIKED', (e) => forwardEvent('POST_LIKED', e));
      this.sseSource.addEventListener('COMMENT_CREATED', (e) => forwardEvent('COMMENT_CREATED', e));
      this.sseSource.addEventListener('CHANNEL_CREATED', (e) => forwardEvent('CHANNEL_CREATED', e));
      this.sseSource.addEventListener('PRESENCE_SYNC', (e) => forwardEvent('PRESENCE_SYNC', e));
    } catch (e) {
      console.warn('SSE connection failed:', e);
    }
  }

  private reconnectSse() {
    if (this.sseSource) {
      this.connectSse();
    }
  }
}

export const api = new SynclyApiClient();
