/**
 * Centralized Supabase Configuration Utility
 * 
 * SECURITY RULES:
 * 1. Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY at runtime.
 * 2. Never falls back to demo hostnames (e.g. syncly-demo-workspace.supabase.co) or placeholder keys.
 * 3. Validates URL protocol (https:// or http:// for local development).
 * 4. Lazy evaluation prevents Next.js static build / evaluation crashes if variables are read during module definition.
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

export function validateSupabaseUrl(url: string | undefined): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new Error('[Supabase Config] NEXT_PUBLIC_SUPABASE_URL is required but was empty or undefined.');
  }

  const trimmed = url.trim();

  // Explicitly disallow fallback demo placeholders
  if (trimmed.includes('syncly-demo-workspace') || trimmed.includes('placeholder')) {
    throw new Error('[Supabase Config] Insecure placeholder Supabase URL detected.');
  }

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`[Supabase Config] Invalid protocol '${parsed.protocol}'. Must be http: or https:.`);
    }
    // Allow localhost/127.0.0.1 for local dev, require proper domain for production
    if (!parsed.hostname || parsed.hostname.length === 0) {
      throw new Error('[Supabase Config] Supabase URL lacks a valid hostname.');
    }
  } catch (err: any) {
    throw new Error(`[Supabase Config] Malformed NEXT_PUBLIC_SUPABASE_URL: ${err.message}`, { cause: err });
  }

  return trimmed;
}

export function validateSupabaseAnonKey(anonKey: string | undefined): string {
  if (!anonKey || typeof anonKey !== 'string' || !anonKey.trim()) {
    throw new Error('[Supabase Config] NEXT_PUBLIC_SUPABASE_ANON_KEY is required but was empty or undefined.');
  }

  const trimmed = anonKey.trim();

  // Disallow placeholder keys
  if (trimmed.includes('placeholder') || trimmed.includes('syncly_anon')) {
    throw new Error('[Supabase Config] Insecure placeholder Supabase anon key detected.');
  }

  // Basic JWT structure check (header.payload.signature)
  const parts = trimmed.split('.');
  if (parts.length !== 3) {
    throw new Error('[Supabase Config] Malformed NEXT_PUBLIC_SUPABASE_ANON_KEY: Expected valid 3-part JWT format.');
  }

  return trimmed;
}

/**
 * Retrieves and validates the public Supabase configuration.
 * Fails closed if required environment variables are missing or invalid.
 */
export function getSupabaseConfig(): SupabaseConfig {
  const url = validateSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = validateSupabaseAnonKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return {
    url,
    anonKey,
  };
}

/**
 * Retrieves the administrative service-role configuration (server-side only).
 * Throws if called in client/browser environment or if service role key is absent.
 */
export function getSupabaseAdminConfig(): SupabaseConfig & { serviceRoleKey: string } {
  if (typeof window !== 'undefined') {
    throw new Error('[Supabase Config] FATAL: getSupabaseAdminConfig cannot be invoked in a browser environment.');
  }

  const config = getSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey || typeof serviceRoleKey !== 'string' || !serviceRoleKey.trim()) {
    throw new Error('[Supabase Config] SUPABASE_SERVICE_ROLE_KEY is required for administrative operations.');
  }

  const trimmedKey = serviceRoleKey.trim();
  const parts = trimmedKey.split('.');
  if (parts.length !== 3) {
    throw new Error('[Supabase Config] Malformed SUPABASE_SERVICE_ROLE_KEY: Expected valid 3-part JWT format.');
  }

  return {
    ...config,
    serviceRoleKey: trimmedKey,
  };
}
