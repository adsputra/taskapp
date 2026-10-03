-- ============================================================
-- MIGRATION 012: TEAM COLLABORATION & 2-TIER SHARING
-- ============================================================

-- 1. Create team_members table
CREATE TABLE IF NOT EXISTS public.team_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'member'
             CHECK (role IN ('admin', 'member')),
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'active')),
  token      TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_team_member UNIQUE (owner_id, email)
);

CREATE INDEX IF NOT EXISTS idx_team_members_owner ON public.team_members(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user  ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON public.team_members(email);
CREATE INDEX IF NOT EXISTS idx_team_members_token ON public.team_members(token);

-- Enable RLS on team_members
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_members_select ON public.team_members;
CREATE POLICY team_members_select ON public.team_members
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid() OR
    user_id = auth.uid() OR
    owner_id IN (
      SELECT tm.owner_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'active'
    )
  );

-- 2. Access Helper Functions
CREATE OR REPLACE FUNCTION public.get_user_team_owner(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT owner_id FROM public.team_members WHERE user_id = _user_id AND status = 'active' LIMIT 1),
    _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_shared_board(_board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.boards b
    WHERE b.id = _board_id
      AND b.visibility = 'shared'
      AND public.get_user_team_owner(b.user_id) = public.get_user_team_owner(auth.uid())
  );
$$;

-- Update can_read_board to include team shared boards
CREATE OR REPLACE FUNCTION public.can_read_board(_board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_board_owner(_board_id)
      OR public.is_board_member(_board_id)
      OR public.is_team_shared_board(_board_id);
$$;

-- Update can_edit_board to include team members on shared boards
CREATE OR REPLACE FUNCTION public.can_edit_board(_board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_board_owner(_board_id)
      OR public.is_board_member(_board_id, ARRAY['admin', 'editor'])
      OR public.is_team_shared_board(_board_id);
$$;

-- Update can_admin_board: owners, board admins, or team admins on shared boards
CREATE OR REPLACE FUNCTION public.can_admin_board(_board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_board_owner(_board_id)
      OR public.is_board_member(_board_id, ARRAY['admin'])
      OR (
        public.is_team_shared_board(_board_id)
        AND EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.user_id = auth.uid()
            AND tm.status = 'active'
            AND tm.role = 'admin'
        )
      );
$$;

-- 2b. Refresh boards policies to ensure INSERT ... RETURNING * succeeds without 42501 error
DROP POLICY IF EXISTS boards_select ON public.boards;
CREATE POLICY boards_select ON public.boards FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.can_read_board(id));

DROP POLICY IF EXISTS boards_insert ON public.boards;
CREATE POLICY boards_insert ON public.boards FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS boards_update ON public.boards;
CREATE POLICY boards_update ON public.boards FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.can_admin_board(id))
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.can_admin_board(id));

DROP POLICY IF EXISTS boards_delete ON public.boards;
CREATE POLICY boards_delete ON public.boards FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- 3. RPC: get_user_team_role
CREATE OR REPLACE FUNCTION public.get_user_team_role()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_membership record;
  v_team_owner uuid;
  v_is_owner boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_membership
  FROM public.team_members
  WHERE user_id = v_uid AND status = 'active'
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'role', v_membership.role,
      'isOwner', false,
      'ownerId', v_membership.owner_id
    );
  ELSE
    RETURN jsonb_build_object(
      'role', 'owner',
      'isOwner', true,
      'ownerId', v_uid
    );
  END IF;
END;
$$;

-- 4. RPC: list_team_members
CREATE OR REPLACE FUNCTION public.list_team_members()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner_id uuid;
  v_owner_profile record;
  v_members jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  v_owner_id := public.get_user_team_owner(v_uid);

  SELECT id, full_name, email, avatar_url INTO v_owner_profile
  FROM public.profiles
  WHERE id = v_owner_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', tm.id,
        'userId', tm.user_id,
        'email', tm.email,
        'role', tm.role,
        'status', tm.status,
        'token', CASE WHEN tm.owner_id = v_uid OR EXISTS (SELECT 1 FROM public.team_members WHERE user_id = v_uid AND role = 'admin' AND status = 'active') THEN tm.token ELSE NULL END,
        'createdAt', tm.created_at,
        'profile', jsonb_build_object(
          'fullName', p.full_name,
          'avatarUrl', p.avatar_url
        )
      ) ORDER BY tm.created_at ASC
    ),
    '[]'::jsonb
  ) INTO v_members
  FROM public.team_members tm
  LEFT JOIN public.profiles p ON p.id = tm.user_id
  WHERE tm.owner_id = v_owner_id;

  RETURN jsonb_build_object(
    'owner', jsonb_build_object(
      'id', v_owner_id,
      'fullName', COALESCE(v_owner_profile.full_name, 'Owner'),
      'email', v_owner_profile.email,
      'avatarUrl', v_owner_profile.avatar_url,
      'isCurrent', (v_owner_id = v_uid)
    ),
    'members', v_members
  );
END;
$$;

-- 5. RPC: invite_team_member
CREATE OR REPLACE FUNCTION public.invite_team_member(p_email text, p_role text DEFAULT 'member')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner_id uuid;
  v_clean_email text;
  v_token text;
  v_new_id uuid;
  v_existing_user uuid;
  v_caller_role text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  v_clean_email := lower(trim(p_email));
  IF v_clean_email IS NULL OR v_clean_email NOT LIKE '%@%.%' THEN
    RAISE EXCEPTION 'invalid_email' USING MESSAGE = 'Email tidak valid.';
  END IF;

  IF p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'invalid_role' USING MESSAGE = 'Role tidak valid.';
  END IF;

  v_owner_id := public.get_user_team_owner(v_uid);

  IF v_uid != v_owner_id THEN
    SELECT role INTO v_caller_role
    FROM public.team_members
    WHERE owner_id = v_owner_id AND user_id = v_uid AND status = 'active';

    IF v_caller_role != 'admin' THEN
      RAISE EXCEPTION 'permission_denied' USING MESSAGE = 'Hanya Owner atau Admin yang dapat mengundang anggota tim.';
    END IF;
  END IF;

  -- Cannot invite team owner
  IF v_clean_email = (SELECT email FROM public.profiles WHERE id = v_owner_id) THEN
    RAISE EXCEPTION 'cannot_invite_owner' USING MESSAGE = 'Email ini adalah pemilik tim.';
  END IF;

  -- Check if user already exists
  SELECT id INTO v_existing_user FROM public.profiles WHERE lower(email) = v_clean_email;

  -- Generate secure token using native gen_random_uuid
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  -- Insert or update pending invite
  INSERT INTO public.team_members (owner_id, user_id, email, role, status, token)
  VALUES (v_owner_id, v_existing_user, v_clean_email, p_role, 'pending', v_token)
  ON CONFLICT (owner_id, email) DO UPDATE
  SET role = EXCLUDED.role,
      token = EXCLUDED.token,
      status = 'pending',
      updated_at = now()
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'id', v_new_id,
    'email', v_clean_email,
    'role', p_role,
    'status', 'pending',
    'token', v_token
  );
END;
$$;

-- 6. RPC: update_team_member_role
CREATE OR REPLACE FUNCTION public.update_team_member_role(p_member_id uuid, p_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner_id uuid;
  v_member record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'invalid_role' USING MESSAGE = 'Role tidak valid.';
  END IF;

  v_owner_id := public.get_user_team_owner(v_uid);

  SELECT * INTO v_member FROM public.team_members WHERE id = p_member_id AND owner_id = v_owner_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'member_not_found' USING MESSAGE = 'Anggota tim tidak ditemukan.';
  END IF;

  -- Only owner can promote to admin or change roles
  IF v_uid != v_owner_id THEN
    RAISE EXCEPTION 'permission_denied' USING MESSAGE = 'Hanya Owner yang dapat mengubah role anggota tim.';
  END IF;

  UPDATE public.team_members
  SET role = p_role, updated_at = now()
  WHERE id = p_member_id;

  RETURN true;
END;
$$;

-- 7. RPC: remove_team_member
CREATE OR REPLACE FUNCTION public.remove_team_member(p_member_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner_id uuid;
  v_caller_role text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  v_owner_id := public.get_user_team_owner(v_uid);

  IF v_uid != v_owner_id THEN
    SELECT role INTO v_caller_role
    FROM public.team_members
    WHERE owner_id = v_owner_id AND user_id = v_uid AND status = 'active';

    IF v_caller_role != 'admin' THEN
      RAISE EXCEPTION 'permission_denied' USING MESSAGE = 'Hanya Owner atau Admin yang dapat menghapus anggota tim.';
    END IF;
  END IF;

  DELETE FROM public.team_members
  WHERE id = p_member_id AND owner_id = v_owner_id;

  RETURN true;
END;
$$;

-- 8. RPC: get_team_invitation
CREATE OR REPLACE FUNCTION public.get_team_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_owner record;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_invite
  FROM public.team_members
  WHERE token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT id, full_name, email, avatar_url INTO v_owner
  FROM public.profiles
  WHERE id = v_invite.owner_id;

  RETURN jsonb_build_object(
    'id', v_invite.id,
    'email', v_invite.email,
    'role', v_invite.role,
    'status', v_invite.status,
    'owner', jsonb_build_object(
      'id', v_owner.id,
      'fullName', COALESCE(v_owner.full_name, 'Team Owner'),
      'email', v_owner.email,
      'avatarUrl', v_owner.avatar_url
    )
  );
END;
$$;

-- 9. RPC: accept_team_invitation
CREATE OR REPLACE FUNCTION public.accept_team_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_invite record;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_invite
  FROM public.team_members
  WHERE token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- If user is already active in this team:
  IF v_invite.user_id = v_uid AND v_invite.status = 'active' THEN
    RETURN jsonb_build_object('success', true, 'alreadyJoined', true, 'ownerId', v_invite.owner_id);
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  UPDATE public.team_members
  SET user_id = v_uid,
      status = 'active',
      token = NULL,
      updated_at = now()
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'success', true,
    'alreadyJoined', false,
    'ownerId', v_invite.owner_id
  );
END;
$$;

-- 10. Enable Realtime for team_members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'team_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
  END IF;
END $$;

ALTER TABLE public.team_members REPLICA IDENTITY FULL;

-- Permissions on functions
REVOKE ALL ON FUNCTION public.get_team_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_invitation(text) TO authenticated, anon;

REVOKE ALL ON FUNCTION public.accept_team_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(text) TO authenticated;

REVOKE ALL ON FUNCTION public.list_team_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_team_members() TO authenticated;

REVOKE ALL ON FUNCTION public.invite_team_member(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_team_member(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.update_team_member_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_team_member_role(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.remove_team_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_team_member(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_user_team_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_team_role() TO authenticated;
