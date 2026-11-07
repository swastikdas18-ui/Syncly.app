import { createAdminClient } from '@/lib/supabase/admin.ts';

/**
 * Centralized Audit Logging Service for Syncly
 * 
 * Invariants:
 * - Actor identity derived exclusively from verified authentication.
 * - Tenant identity derived from verified membership context.
 * - Records inserted into public.audit_logs via service role (bypassing RLS insert limits)
 *   or authenticated client, but immutable once written.
 * - Never logs passwords, tokens, full secrets, or PII.
 */

export interface AuditEventParams {
  tenantId?: string | null;
  actorId?: string | null;
  action: string;
  targetResource: string;
  metadata?: Record<string, any>;
}

export async function logAuditEvent(params: AuditEventParams): Promise<boolean> {
  try {
    const admin = createAdminClient();
    
    // Sanitize metadata to exclude tokens and secrets
    const safeMetadata = { ...(params.metadata || {}) };
    delete safeMetadata.token;
    delete safeMetadata.password;
    delete safeMetadata.secret;
    delete safeMetadata.key;

    const { error } = await (admin.from('audit_logs') as any).insert({
      tenant_id: params.tenantId || null,
      actor_id: params.actorId || null,
      action: params.action,
      target_resource: params.targetResource,
      metadata: safeMetadata,
    });

    if (error) {
      console.error('[Audit Log Insert Error]:', error.message);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error('[Audit Log Exception]:', err?.message || err);
    return false;
  }
}

