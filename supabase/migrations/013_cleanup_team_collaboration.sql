-- ============================================================
-- MIGRATION 013: REVERT TEAM COLLABORATION TO PER-BOARD MODEL
-- ============================================================

-- 1. Remove table team_members from realtime publication if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'team_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.team_members;
  END IF;
END $$;

-- 2. Drop team_members table
DROP TABLE IF EXISTS public.team_members CASCADE;

-- 3. Restore helper functions to pure per-board & owner logic
CREATE OR REPLACE FUNCTION public.can_read_board(_board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_board_owner(_board_id) OR public.is_board_member(_board_id);
$$;

CREATE OR REPLACE FUNCTION public.can_edit_board(_board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_board_owner(_board_id)
      OR public.is_board_member(_board_id, ARRAY['admin', 'editor']);
$$;

CREATE OR REPLACE FUNCTION public.can_admin_board(_board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_board_owner(_board_id)
      OR public.is_board_member(_board_id, ARRAY['admin']);
$$;

-- 4. Re-ensure boards policies (preserving the fix for RLS 42501 error on INSERT ... RETURNING *)
DROP POLICY IF EXISTS boards_select ON public.boards;
CREATE POLICY boards_select ON public.boards FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.can_read_board(id));

DROP POLICY IF EXISTS boards_insert ON public.boards;
CREATE POLICY boards_insert ON public.boards FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS boards_update ON public.boards;
CREATE POLICY boards_update ON public.boards FOR UPDATE TO authenticated
  USING (public.can_admin_board(id))
  WITH CHECK (public.can_admin_board(id));

DROP POLICY IF EXISTS boards_delete ON public.boards;
CREATE POLICY boards_delete ON public.boards FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- 5. Drop team-specific functions
DROP FUNCTION IF EXISTS public.get_user_team_owner(uuid);
DROP FUNCTION IF EXISTS public.is_team_shared_board(uuid);
DROP FUNCTION IF EXISTS public.get_user_team_role();
DROP FUNCTION IF EXISTS public.list_team_members();
DROP FUNCTION IF EXISTS public.invite_team_member(text, text);
DROP FUNCTION IF EXISTS public.update_team_member_role(uuid, text);
DROP FUNCTION IF EXISTS public.remove_team_member(uuid);
DROP FUNCTION IF EXISTS public.get_team_invitation(text);
DROP FUNCTION IF EXISTS public.accept_team_invitation(text);
