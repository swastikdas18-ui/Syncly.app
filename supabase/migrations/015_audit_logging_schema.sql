-- ==============================================================================
-- SYNCLY / SECURITY CYCLE 4.9.1 — AUDIT LOGGING HARDENING
-- Migration: 015_audit_logging_schema.sql
-- Objective: Introduce an additive, immutable, tenant-aware audit logging table
--            with strict RLS policies preventing ordinary users from mutating records.
-- ==============================================================================

-- 1. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_resource TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for efficient chronological and tenant-scoped retrieval
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created 
    ON public.audit_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor 
    ON public.audit_logs (actor_id);

-- 2. Enable Row-Level Security
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. SELECT Policy: Tenant owners and administrators can view audit logs for their workspace
DROP POLICY IF EXISTS audit_logs_admin_select ON public.audit_logs;
CREATE POLICY audit_logs_admin_select ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.memberships
            WHERE community_id = audit_logs.tenant_id
              AND user_id = auth.uid()
              AND role IN ('owner', 'admin')
        )
    );

-- 4. INSERT Policy: System processes and authenticated users can insert audit records for their tenant
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert ON public.audit_logs
    FOR INSERT WITH CHECK (
        actor_id = auth.uid() 
        AND (
            public.is_tenant_member(tenant_id) 
            OR public.get_current_tenant_id() = tenant_id
            OR tenant_id IS NULL
        )
    );

-- 5. Immutability Enforcement: Disallow UPDATE and DELETE for all standard roles
-- (No UPDATE or DELETE policy is defined, meaning all UPDATE/DELETE attempts by authenticated/anon fail closed)

-- 6. Trigger defense for absolute immutability (Defense-in-depth)
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable. Mutations and deletions are strictly prohibited.'
        USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_log_mutation
    BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_audit_log_mutation();

COMMENT ON TABLE public.audit_logs IS 'Immutable security and administrative audit event store for Syncly multi-tenant workspace.';

