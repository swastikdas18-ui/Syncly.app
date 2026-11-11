-- ==============================================================================
-- SYNCLY / WORK-CONNECT: PERSISTENT NOTIFICATIONS SCHEMA & ROW LEVEL SECURITY
-- Migration: 021_notifications_schema.sql
--
-- Objective:
--   1. Create public.notifications table with strict recipient, actor, and tenant scoping.
--   2. Enable Row Level Security (RLS) on public.notifications:
--      - SELECT: Users can ONLY query notifications where recipient_id = auth.uid()
--        AND they are verified members of the associated tenant_id.
--      - INSERT: Trigger/internal or member self-notifications scoped to active tenant.
--      - UPDATE: Users can update 'read' status ONLY on their own notifications (recipient_id = auth.uid()).
--      - DELETE: Users can delete ONLY their own notifications.
--   3. Create indexes on (recipient_id, tenant_id, created_at, read) for performant queries.
--   4. RPC functions for marking notifications read atomically.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('message', 'announcement', 'request', 'event', 'system')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  resource_id TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing for high-performance notification feeds & unread counts
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_tenant ON public.notifications (recipient_id, tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications (recipient_id, tenant_id) WHERE read = FALSE;

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy 1: SELECT - A user can only see notifications addressed to them in a workspace they belong to
DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
CREATE POLICY "notifications_select_policy"
ON public.notifications FOR SELECT
USING (
  recipient_id = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.community_id = notifications.tenant_id
        AND m.user_id = auth.uid()
    )
  )
);

-- Policy 2: UPDATE - A user can only update their own notifications (e.g. mark as read)
DROP POLICY IF EXISTS "notifications_update_policy" ON public.notifications;
CREATE POLICY "notifications_update_policy"
ON public.notifications FOR UPDATE
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

-- Policy 3: INSERT - Scoped to authenticated users inserting within their workspace
DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications;
CREATE POLICY "notifications_insert_policy"
ON public.notifications FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.community_id = notifications.tenant_id
      AND m.user_id = auth.uid()
  )
);

-- Policy 4: DELETE - A user can only delete their own notifications
DROP POLICY IF EXISTS "notifications_delete_policy" ON public.notifications;
CREATE POLICY "notifications_delete_policy"
ON public.notifications FOR DELETE
USING (recipient_id = auth.uid());

-- Helper RPC: Mark all notifications read for caller in tenant
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_updated_count INT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'status', 401, 'error', 'Unauthorized.');
  END IF;

  UPDATE public.notifications
  SET read = TRUE
  WHERE recipient_id = v_caller_id
    AND tenant_id = p_tenant_id
    AND read = FALSE;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'status', 200,
    'updatedCount', v_updated_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_all_notifications_read(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_all_notifications_read(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(UUID) TO authenticated, service_role;
