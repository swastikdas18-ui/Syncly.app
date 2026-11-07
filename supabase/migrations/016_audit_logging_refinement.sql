-- ==============================================================================
-- SYNCLY / SECURITY CYCLE 4.9.3 — HISTORICAL AUDIT LOGGING INTEGRITY
-- Migration: 016_audit_logging_refinement.sql
--
-- Objective:
--   1. Preserve historical audit records permanently, completely independent of the
--      actor profile lifecycle, by dropping the foreign key constraint on actor_id.
--   2. In security logging, audit records MUST NEVER be mutated or set to NULL
--      when a user is deleted; the historical user UUID must remain permanently recorded.
--   3. Maintain absolute immutability: ordinary authenticated users and workspace
--      administrators can NEVER update or delete audit records.
-- ==============================================================================

-- 1. Remove the foreign key constraint that triggered ON DELETE SET NULL cascades
ALTER TABLE public.audit_logs 
    DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;

-- 2. If desired, also remove tenant_id CASCADE so audit records survive tenant removal as historical evidence
ALTER TABLE public.audit_logs 
    DROP CONSTRAINT IF EXISTS audit_logs_tenant_id_fkey;

-- 3. Trigger immutability guarantee:
-- Absolutely NO updates or deletes by any client role.
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

COMMENT ON COLUMN public.audit_logs.actor_id IS 'Immutable historical UUID of the authenticated actor who performed the action. Preserved indefinitely without foreign key deletion cascade.';
