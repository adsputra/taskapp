-- ============================================================
-- 007_security_hardening.sql
-- ============================================================
-- Fixes:
--   1. board_members had RLS DISABLED — any authenticated (or anon)
--      client could read every invite token/email and mutate rows.
--      Now RLS is enabled with least-privilege policies.
--   2. Invite tokens are no longer readable through table SELECT.
--      Token lookup/acceptance goes through SECURITY DEFINER RPCs.
--   3. Invite tokens are cleared once accepted and get a 14-day
--      expiry for new invites.
--   4. notifications INSERT was open to any authenticated user for
--      ANY recipient — restricted to self-notifications.
--   5. profiles were readable by every authenticated user — now
--      restricted to yourself + people you share a board with.
--   6. Duplicate pending invites per (board, email) prevented with a
--      partial unique index.
--   7. handle_new_user hardened with an explicit search_path.
--
-- Safe to re-run (idempotent DDL).
-- ============================================================

-- ============================================================
-- 1. board_members: expiry + token hygiene
-- ============================================================
ALTER TABLE board_members
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + interval '14 days');

-- A token is only needed while the invite is pending.
UPDATE board_members SET token = NULL WHERE status = 'active' AND token IS NOT NULL;

-- De-duplicate pending invites before adding the unique index.
DELETE FROM board_members a
USING board_members b
WHERE a.id <> b.id
  AND a.board_id = b.board_id
  AND lower(a.email) = lower(b.email)
  AND a.status = 'pending'
  AND b.status = 'pending'
  AND (a.created_at, a.id) > (b.created_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_board_invite
  ON board_members (board_id, lower(email))
  WHERE status = 'pending';

-- ============================================================
-- 2. Helper functions
-- ============================================================
-- The old schema disabled RLS on board_members specifically to avoid
-- "infinite recursion": a board policy reads board_members, while a
-- board_members policy would read boards. SECURITY DEFINER helpers
-- break that cycle and centralize the access rules.

CREATE OR REPLACE FUNCTION public.is_board_owner(_board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM boards b
    WHERE b.id = _board_id AND b.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_board_member(_board_id uuid, _roles text[] DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM board_members bm
    WHERE bm.board_id = _board_id
      AND bm.user_id = auth.uid()
      AND bm.status = 'active'
      AND (_roles IS NULL OR bm.role = ANY (_roles))
  );
$$;

-- True when the caller may see the given profile: self, or someone
-- with whom the caller shares at least one board (owner or member).
CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM boards b
      WHERE
        -- caller owns the board
        (b.user_id = auth.uid() AND (
          b.user_id = _profile_id
          OR EXISTS (
            SELECT 1 FROM board_members m
            WHERE m.board_id = b.id AND m.user_id = _profile_id AND m.status = 'active'
          )
        ))
        OR
        -- target owns the board
        (b.user_id = _profile_id AND EXISTS (
          SELECT 1 FROM board_members m
          WHERE m.board_id = b.id AND m.user_id = auth.uid() AND m.status = 'active'
        ))
        OR
        -- both are active members of the same board
        EXISTS (
          SELECT 1
          FROM board_members me
          JOIN board_members them ON them.board_id = me.board_id
          WHERE me.user_id = auth.uid() AND me.status = 'active'
            AND them.user_id = _profile_id AND them.status = 'active'
        )
    );
$$;

REVOKE ALL ON FUNCTION public.is_board_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_board_member(uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_profile(uuid) FROM PUBLIC;
-- RLS policies run as the querying role, so anon needs EXECUTE for the
-- policies to evaluate (helpers only ever report on the current caller).
GRANT EXECUTE ON FUNCTION public.is_board_owner(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_board_member(uuid, text[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_view_profile(uuid) TO authenticated, anon;

-- ============================================================
-- 3. board_members RLS
-- ============================================================
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_board_members" ON board_members;
DROP POLICY IF EXISTS "insert_board_members" ON board_members;
DROP POLICY IF EXISTS "update_board_members" ON board_members;
DROP POLICY IF EXISTS "delete_board_members" ON board_members;

-- Self row (any status), board owner, or an active member seeing
-- other active members. Pending invite rows (which hold tokens) are
-- only visible to the board owner/admin.
CREATE POLICY "select_board_members" ON board_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_board_owner(board_id)
    OR (status = 'active' AND is_board_member(board_id))
  );

CREATE POLICY "insert_board_members" ON board_members FOR INSERT
  WITH CHECK (
    is_board_owner(board_id)
    OR is_board_member(board_id, ARRAY['admin'])
  );

CREATE POLICY "update_board_members" ON board_members FOR UPDATE
  USING (
    is_board_owner(board_id)
    OR is_board_member(board_id, ARRAY['admin'])
  );

CREATE POLICY "delete_board_members" ON board_members FOR DELETE
  USING (
    is_board_owner(board_id)
    OR is_board_member(board_id, ARRAY['admin'])
  );

-- ============================================================
-- 4. Invitation RPCs (token stays server-side)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_board_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_board record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_token IS NULL OR length(p_token) < 16 OR length(p_token) > 128 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_invite
  FROM board_members
  WHERE token = p_token
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT id, title, color INTO v_board FROM boards WHERE id = v_invite.board_id;

  RETURN jsonb_build_object(
    'board_id', v_invite.board_id,
    'role', v_invite.role,
    'status', v_invite.status,
    'board', jsonb_build_object('title', v_board.title, 'color', v_board.color)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_board_invitation(p_token text)
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

  IF p_token IS NULL OR length(p_token) < 16 OR length(p_token) > 128 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_invite
  FROM board_members
  WHERE token = p_token
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Already an active member of this board: drop the pending duplicate.
  IF EXISTS (
    SELECT 1 FROM board_members
    WHERE board_id = v_invite.board_id AND user_id = v_uid AND status = 'active'
  ) THEN
    DELETE FROM board_members WHERE id = v_invite.id;
    RETURN jsonb_build_object('boardId', v_invite.board_id, 'alreadyAccepted', true);
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  UPDATE board_members
  SET user_id = v_uid,
      status = 'active',
      email = COALESCE(v_email, email),
      token = NULL
  WHERE id = v_invite.id;

  INSERT INTO notifications (user_id, board_id, title, message, type)
  VALUES (v_uid, v_invite.board_id, 'Joined board', 'You now have access to a shared board', 'share_accepted');

  RETURN jsonb_build_object('boardId', v_invite.board_id, 'alreadyAccepted', false);
END;
$$;

REVOKE ALL ON FUNCTION public.get_board_invitation(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_board_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_board_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_board_invitation(text) TO authenticated;

-- ============================================================
-- 5. Batched item mutations (one round trip, atomic)
-- ============================================================

CREATE OR REPLACE FUNCTION public.reorder_board_items(p_group_id text, p_item_ids uuid[])
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE board_items bi
  SET order_index = ord.idx - 1
  FROM unnest(p_item_ids) WITH ORDINALITY AS ord(id, idx)
  WHERE bi.id = ord.id AND bi.group_id = p_group_id;
$$;

CREATE OR REPLACE FUNCTION public.set_items_sprint(p_sprint_id uuid, p_item_ids uuid[])
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE board_items
  SET sprint_id = p_sprint_id
  WHERE id = ANY (p_item_ids);
$$;

REVOKE ALL ON FUNCTION public.reorder_board_items(text, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_items_sprint(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_board_items(text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_items_sprint(uuid, uuid[]) TO authenticated;

-- ============================================================
-- 6. notifications: insert only for yourself
-- ============================================================
DROP POLICY IF EXISTS "auth_insert_notifications" ON notifications;
DROP POLICY IF EXISTS "user_insert_own_notifications" ON notifications;

CREATE POLICY "user_insert_own_notifications" ON notifications FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (actor_id IS NULL OR actor_id = auth.uid())
  );

-- ============================================================
-- 7. profiles: only yourself + people you share a board with
-- ============================================================
DROP POLICY IF EXISTS "authenticated_select_profiles" ON profiles;
DROP POLICY IF EXISTS "select_visible_profiles" ON profiles;

CREATE POLICY "select_visible_profiles" ON profiles FOR SELECT
  USING (can_view_profile(id));

-- ============================================================
-- 8. Harden the signup trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url, updated_at)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'User'),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

-- ============================================================
-- SELESAI
-- ============================================================
