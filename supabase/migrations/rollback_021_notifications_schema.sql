-- ==============================================================================
-- ROLLBACK MIGRATION: 021_notifications_schema.sql
-- ==============================================================================

DROP FUNCTION IF EXISTS public.mark_all_notifications_read(UUID);
DROP TABLE IF EXISTS public.notifications CASCADE;
