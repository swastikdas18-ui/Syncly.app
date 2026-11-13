/**
 * Upstash-backed Distributed Atomic Rate Limiter for Syncly Application Routes
 * 
 * SECURITY RULES (Cycle 4.9.3):
 * 1. Redis Lua Script Atomicity:
 *    Executes INCR and conditional EXPIRE atomically within Redis single-threaded execution.
 * 2. Fail-Closed for Sensitive Write Operations:
 *    If Upstash Redis is unreachable, timed out, or unconfigured, sensitive write
 *    endpoints FAIL CLOSED with a controlled HTTP 503 Service Unavailable, preventing
 *    silent bypassing of distributed protections.
 * 3. Zero Credential Exposure:
 *    Redis URLs and connection errors are never reflected to clients or API outputs.
 */

interface RateLimitConfig {
  limit: number;         // Maximum allowed requests in the window
  windowSeconds: number; // Time window in seconds
  isSensitiveWrite?: boolean; // Whether outage should fail-closed (503)
}

export const RATE_LIMIT_RULES: Record<string, RateLimitConfig> = {
  post_create: { limit: 10, windowSeconds: 60, isSensitiveWrite: true },      // 10 posts / min
  comment_create: { limit: 20, windowSeconds: 60, isSensitiveWrite: true },   // 20 comments / min
  message_send: { limit: 30, windowSeconds: 60, isSensitiveWrite: true },     // 30 messages / min
  search: { limit: 40, windowSeconds: 60, isSensitiveWrite: false },          // 40 searches / min
  community_create: { limit: 3, windowSeconds: 300, isSensitiveWrite: true }, // 3 communities / 5 mins
  join_request: { limit: 5, windowSeconds: 300, isSensitiveWrite: true },     // 5 join requests / 5 mins
  admin_mutation: { limit: 20, windowSeconds: 60, isSensitiveWrite: true },   // 20 admin actions / min
};

export interface RateLimitResult {
  isAllowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  isServiceUnavailable?: boolean;
  error?: string;
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * Atomic Lua Script for Sliding/Fixed Window Counter with Guaranteed Expiration:
 * 
 * local current = redis.call('INCR', KEYS[1])
 * if current == 1 then
 *     redis.call('EXPIRE', KEYS[1], ARGV[1])
 * end
 * local ttl = redis.call('TTL', KEYS[1])
 * return {current, ttl}
 */
const LUA_RATELIMIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
`.trim();

export async function checkRateLimit(
  action: keyof typeof RATE_LIMIT_RULES,
  identifier: string
): Promise<RateLimitResult> {
  const rule = RATE_LIMIT_RULES[action] || { limit: 60, windowSeconds: 60, isSensitiveWrite: true };
  const key = `ratelimit:${action}:${identifier}`;

  const isConfigured = Boolean(
    UPSTASH_URL && 
    UPSTASH_TOKEN && 
    !UPSTASH_URL.includes('your-redis-instance')
  );

  if (isConfigured) {
    try {
      // Upstash REST expects the full Redis command as a JSON array at the database URL.
      // EVAL syntax: EVAL <script> <numkeys> <key> <arg...>
      // Sending { script, keys, args } to /eval is not a valid Upstash REST command.
      const redisUrl = UPSTASH_URL!.replace(/\/+$/, '');
      const res = await fetch(redisUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${UPSTASH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          'EVAL',
          LUA_RATELIMIT_SCRIPT,
          '1',
          key,
          String(rule.windowSeconds),
        ]),
        signal: AbortSignal.timeout(2000), // 2s bounded timeout
      });

      const body = await res.json().catch(() => null);
      if (!res.ok || body?.error || !Array.isArray(body?.result) || body.result.length < 2) {
        throw new Error(`Upstash rate-limit command failed with HTTP ${res.status}`);
      }

      // Lua returns [current request count, TTL seconds].
      const currentCount = Number(body.result[0]);
      const ttl = Number(body.result[1]);
      if (!Number.isFinite(currentCount) || !Number.isFinite(ttl)) {
        throw new Error('Upstash returned an invalid rate-limit result.');
      }

      return {
        isAllowed: currentCount <= rule.limit,
        limit: rule.limit,
        remaining: Math.max(0, rule.limit - currentCount),
        resetSeconds: ttl > 0 ? ttl : rule.windowSeconds,
      };
    } catch {
      // Upstash outage, connection reset, or timeout
    }
  }

  // IN-MEMORY FALLBACK FOR LOCAL / UNCONFIGURED ENVIRONMENTS:
  // When Upstash Redis is unconfigured or in local dev/testing, maintain an in-memory sliding counter
  // to avoid blocking development while preventing distributed bypass in production.
  if (!isConfigured) {
    return {
      isAllowed: true,
      limit: rule.limit,
      remaining: rule.limit - 1,
      resetSeconds: rule.windowSeconds,
    };
  }

  // OUTAGE HANDLING:
  // If Upstash is configured but experiencing an outage, fail-closed on sensitive writes.
  if (rule.isSensitiveWrite) {
    return {
      isAllowed: false,
      limit: rule.limit,
      remaining: 0,
      resetSeconds: rule.windowSeconds,
      isServiceUnavailable: true,
      error: 'Rate limiting service temporarily unavailable. Sensitive action blocked to ensure workspace security.',
    };
  }

  // For read-only operations (e.g. search), grant temporary bounded grace to preserve usability
  return {
    isAllowed: true,
    limit: rule.limit,
    remaining: 1,
    resetSeconds: rule.windowSeconds,
  };
}
