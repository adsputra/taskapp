-- ============================================================
-- 008_private_attachments.sql
-- ============================================================
-- Makes task-attachments a PRIVATE bucket and enforces access
-- through Storage RLS:
--   - read:   board owner or any active member
--   - write:  board owner or active admin/editor member
-- Object keys follow: <board_id>/<item_id>/<uuid>_<filename>
-- ============================================================

-- ============================================================
-- 1. Private bucket + server-side size/MIME limits
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-attachments',
  'task-attachments',
  false,
  10485760, -- 10 MB
  ARRAY[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'text/plain', 'text/csv', 'application/json',
    'application/zip', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================
-- 2. Helpers — resolve the board from the object key safely
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_access_board_object(_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_board_id uuid;
BEGIN
  IF _name IS NULL OR _name !~ '^[0-9a-fA-F-]{36}/' THEN
    RETURN false;
  END IF;

  BEGIN
    v_board_id := split_part(_name, '/', 1)::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  RETURN public.is_board_owner(v_board_id) OR public.is_board_member(v_board_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_edit_board_object(_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_board_id uuid;
BEGIN
  IF _name IS NULL OR _name !~ '^[0-9a-fA-F-]{36}/' THEN
    RETURN false;
  END IF;

  BEGIN
    v_board_id := split_part(_name, '/', 1)::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  RETURN public.is_board_owner(v_board_id)
      OR public.is_board_member(v_board_id, ARRAY['admin', 'editor']);
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_board_object(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_edit_board_object(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_board_object(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_board_object(text) TO authenticated;

-- ============================================================
-- 3. Storage RLS policies (private bucket)
-- ============================================================
DROP POLICY IF EXISTS "task_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "task_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "task_attachments_update" ON storage.objects;
DROP POLICY IF EXISTS "task_attachments_delete" ON storage.objects;

CREATE POLICY "task_attachments_select" ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND public.can_access_board_object(name)
  );

CREATE POLICY "task_attachments_insert" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND public.can_edit_board_object(name)
  );

CREATE POLICY "task_attachments_update" ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND public.can_edit_board_object(name)
  );

CREATE POLICY "task_attachments_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND public.can_edit_board_object(name)
  );

-- ============================================================
-- SELESAI
-- ============================================================
