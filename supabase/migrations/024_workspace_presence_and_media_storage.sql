-- ==============================================================================
-- SYNCLY: TENANT-SCOPED REALTIME PRESENCE + DIRECT MEDIA UPLOADS
--
-- Realtime Presence is restricted to authenticated members of the tenant encoded
-- in the private channel topic: tenant:<tenant_uuid>:presence.
-- Media uploads go directly from the browser to this private Storage bucket,
-- avoiding Vercel Function request-body limits.
-- ==============================================================================

CREATE POLICY "workspace members can read tenant presence"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  extension = 'presence'
  AND CASE
    WHEN realtime.topic() ~ '^tenant:[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}:presence$'
    THEN public.is_tenant_member(split_part(realtime.topic(), ':', 2)::uuid)
    ELSE false
  END
);

CREATE POLICY "workspace members can publish tenant presence"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  extension = 'presence'
  AND CASE
    WHEN realtime.topic() ~ '^tenant:[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}:presence$'
    THEN public.is_tenant_member(split_part(realtime.topic(), ':', 2)::uuid)
    ELSE false
  END
);

UPDATE storage.buckets
SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf'
  ]::text[]
WHERE id = 'community-media';
