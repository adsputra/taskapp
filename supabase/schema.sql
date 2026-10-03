-- ============================================================
-- schema.sql — Tuesday task app, single source of truth
-- ============================================================
-- Replaces migrations 001–011. Run the whole file in
-- Supabase Dashboard → SQL Editor.
--
-- Idempotent and non-destructive: safe on a fresh project AND on a
-- database built from the old migrations (no DROP TABLE; every
-- policy on the app tables is dropped and recreated from here).
--
-- Security model
--   - The browser talks to PostgREST directly with the anon key, so
--     RLS + column privileges below ARE the API authorization layer.
--     Client-side validation in src/lib/api is UX only.
--   - Roles per board: owner (boards.user_id) > admin > editor > viewer.
--   - Every policy targets `authenticated`; `anon` has no table access.
--   - Rows that record an author (comments, activity, attachments,
--     time entries) can only be written as yourself.
-- ============================================================


-- ============================================================
-- 1. TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  email       TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.boards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT DEFAULT '',
  color       TEXT NOT NULL DEFAULT '#0073EA',
  visibility  TEXT NOT NULL DEFAULT 'private'
              CHECK (visibility IN ('public', 'private', 'shared')),
  columns     JSONB NOT NULL DEFAULT '[]',
  groups      JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sprints (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'planning'
              CHECK (status IN ('planning', 'active', 'completed')),
  start_date  DATE,
  end_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- group_id is the id of an entry in boards.groups (JSONB), not a FK.
CREATE TABLE IF NOT EXISTS public.board_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id         UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  group_id         TEXT NOT NULL,
  title            TEXT NOT NULL,
  order_index      INTEGER NOT NULL DEFAULT 0,
  data             JSONB NOT NULL DEFAULT '{}',
  description      TEXT DEFAULT '',
  parent_id        UUID REFERENCES public.board_items(id) ON DELETE SET NULL,
  sprint_id        UUID REFERENCES public.sprints(id) ON DELETE SET NULL,
  story_points     INTEGER DEFAULT 0,
  estimate_minutes INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.board_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'editor'
             CHECK (role IN ('admin', 'editor', 'viewer')),
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'active')),
  token      TEXT UNIQUE,
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '14 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  board_id   UUID REFERENCES public.boards(id) ON DELETE CASCADE,
  item_id    UUID REFERENCES public.board_items(id) ON DELETE CASCADE,
  actor_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title      TEXT NOT NULL,
  message    TEXT,
  type       TEXT DEFAULT 'info',
  read       BOOLEAN NOT NULL DEFAULT false,
  data       JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID NOT NULL REFERENCES public.board_items(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit trail: append-only (no UPDATE/DELETE policy or privilege).
CREATE TABLE IF NOT EXISTS public.task_activity (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID NOT NULL REFERENCES public.board_items(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action      TEXT NOT NULL DEFAULT 'updated'
              CHECK (action IN ('created', 'updated', 'deleted', 'commented', 'attached', 'status_changed', 'assigned')),
  field_name  TEXT,
  old_value   TEXT,
  new_value   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- file_url holds the storage object key: <board_id>/<item_id>/<uuid>_<name>
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID NOT NULL REFERENCES public.board_items(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  file_size   INTEGER DEFAULT 0,
  file_type   TEXT DEFAULT 'application/octet-stream',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_time_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id           UUID NOT NULL REFERENCES public.board_items(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  duration_minutes  INTEGER NOT NULL DEFAULT 0,
  description       TEXT DEFAULT '',
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_dependencies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_item_id  UUID NOT NULL REFERENCES public.board_items(id) ON DELETE CASCADE,
  target_item_id  UUID NOT NULL REFERENCES public.board_items(id) ON DELETE CASCADE,
  dep_type        TEXT NOT NULL DEFAULT 'blocks'
                  CHECK (dep_type IN ('blocks', 'blocked_by')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_item_id, target_item_id, dep_type)
);


-- ============================================================
-- 2. UPGRADE PATH — columns added by the old incremental migrations
-- ============================================================
-- No-ops on a fresh install (CREATE TABLE above already has them).

ALTER TABLE public.board_items
  ADD COLUMN IF NOT EXISTS description      TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS parent_id        UUID REFERENCES public.board_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sprint_id        UUID REFERENCES public.sprints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS story_points     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimate_minutes INTEGER DEFAULT 0;

ALTER TABLE public.board_members
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (now() + interval '14 days');

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES public.boards(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS item_id  UUID REFERENCES public.board_items(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS actor_id UUID;

-- notifications.actor_id used to reference auth.users, which PostgREST
-- cannot embed (`actor:actor_id(...)`). Point it at profiles instead.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_actor_id_fkey'
      AND confrelid = 'auth.users'::regclass
  ) THEN
    ALTER TABLE public.notifications DROP CONSTRAINT notifications_actor_id_fkey;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_actor_id_fkey') THEN
    UPDATE public.notifications n SET actor_id = NULL
    WHERE actor_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = n.actor_id);

    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_actor_id_fkey
      FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Invite tokens are only needed while an invite is pending.
UPDATE public.board_members SET token = NULL WHERE status = 'active' AND token IS NOT NULL;

-- One pending invite per (board, email).
DELETE FROM public.board_members a
USING public.board_members b
WHERE a.id <> b.id
  AND a.board_id = b.board_id
  AND lower(a.email) = lower(b.email)
  AND a.status = 'pending'
  AND b.status = 'pending'
  AND (a.created_at, a.id) > (b.created_at, b.id);


-- ============================================================
-- 3. DATA LIMITS (mirror src/lib/validation.js on the server)
-- ============================================================
-- NOT VALID: enforced for new/updated rows without failing on legacy
-- rows. Run `ALTER TABLE ... VALIDATE CONSTRAINT ...` after cleanup.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_full_name_length;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_full_name_length
  CHECK (char_length(full_name) <= 100) NOT VALID;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_avatar_url_format;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_url_format
  CHECK (avatar_url ~* '^https?://' AND char_length(avatar_url) <= 500) NOT VALID;

ALTER TABLE public.boards DROP CONSTRAINT IF EXISTS boards_title_length;
ALTER TABLE public.boards ADD CONSTRAINT boards_title_length
  CHECK (char_length(btrim(title)) BETWEEN 1 AND 200) NOT VALID;
ALTER TABLE public.boards DROP CONSTRAINT IF EXISTS boards_description_length;
ALTER TABLE public.boards ADD CONSTRAINT boards_description_length
  CHECK (char_length(description) <= 2000) NOT VALID;
ALTER TABLE public.boards DROP CONSTRAINT IF EXISTS boards_color_format;
ALTER TABLE public.boards ADD CONSTRAINT boards_color_format
  CHECK (color ~ '^#[0-9a-fA-F]{3,8}$') NOT VALID;
ALTER TABLE public.boards DROP CONSTRAINT IF EXISTS boards_columns_shape;
ALTER TABLE public.boards ADD CONSTRAINT boards_columns_shape
  CHECK (CASE WHEN jsonb_typeof(columns) = 'array'
              THEN jsonb_array_length(columns) <= 200 AND octet_length(columns::text) <= 262144
              ELSE false END) NOT VALID;
ALTER TABLE public.boards DROP CONSTRAINT IF EXISTS boards_groups_shape;
ALTER TABLE public.boards ADD CONSTRAINT boards_groups_shape
  CHECK (CASE WHEN jsonb_typeof(groups) = 'array'
              THEN jsonb_array_length(groups) <= 200 AND octet_length(groups::text) <= 262144
              ELSE false END) NOT VALID;

ALTER TABLE public.sprints DROP CONSTRAINT IF EXISTS sprints_title_length;
ALTER TABLE public.sprints ADD CONSTRAINT sprints_title_length
  CHECK (char_length(btrim(title)) BETWEEN 1 AND 200) NOT VALID;

ALTER TABLE public.board_items DROP CONSTRAINT IF EXISTS board_items_title_length;
ALTER TABLE public.board_items ADD CONSTRAINT board_items_title_length
  CHECK (char_length(btrim(title)) BETWEEN 1 AND 300) NOT VALID;
ALTER TABLE public.board_items DROP CONSTRAINT IF EXISTS board_items_description_length;
ALTER TABLE public.board_items ADD CONSTRAINT board_items_description_length
  CHECK (char_length(description) <= 20000) NOT VALID;
ALTER TABLE public.board_items DROP CONSTRAINT IF EXISTS board_items_group_id_length;
ALTER TABLE public.board_items ADD CONSTRAINT board_items_group_id_length
  CHECK (char_length(group_id) BETWEEN 1 AND 100) NOT VALID;
ALTER TABLE public.board_items DROP CONSTRAINT IF EXISTS board_items_numbers_non_negative;
ALTER TABLE public.board_items ADD CONSTRAINT board_items_numbers_non_negative
  CHECK (order_index >= 0 AND story_points >= 0 AND estimate_minutes >= 0) NOT VALID;
ALTER TABLE public.board_items DROP CONSTRAINT IF EXISTS board_items_data_shape;
ALTER TABLE public.board_items ADD CONSTRAINT board_items_data_shape
  CHECK (jsonb_typeof(data) = 'object' AND octet_length(data::text) <= 65536) NOT VALID;

ALTER TABLE public.board_members DROP CONSTRAINT IF EXISTS board_members_email_length;
ALTER TABLE public.board_members ADD CONSTRAINT board_members_email_length
  CHECK (char_length(email) <= 254) NOT VALID;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_text_length;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_text_length
  CHECK (char_length(title) <= 200 AND char_length(message) <= 2000) NOT VALID;

ALTER TABLE public.task_comments DROP CONSTRAINT IF EXISTS task_comments_content_length;
ALTER TABLE public.task_comments ADD CONSTRAINT task_comments_content_length
  CHECK (char_length(btrim(content)) BETWEEN 1 AND 5000) NOT VALID;

ALTER TABLE public.task_activity DROP CONSTRAINT IF EXISTS task_activity_text_length;
ALTER TABLE public.task_activity ADD CONSTRAINT task_activity_text_length
  CHECK (char_length(field_name) <= 100
     AND char_length(old_value) <= 5000
     AND char_length(new_value) <= 5000) NOT VALID;

ALTER TABLE public.task_attachments DROP CONSTRAINT IF EXISTS task_attachments_limits;
ALTER TABLE public.task_attachments ADD CONSTRAINT task_attachments_limits
  CHECK (char_length(file_name) <= 255
     AND char_length(file_url) <= 1024
     AND file_size BETWEEN 0 AND 10485760) NOT VALID;

ALTER TABLE public.task_time_entries DROP CONSTRAINT IF EXISTS task_time_entries_limits;
ALTER TABLE public.task_time_entries ADD CONSTRAINT task_time_entries_limits
  CHECK (duration_minutes BETWEEN 1 AND 14400 AND char_length(description) <= 2000) NOT VALID;


-- ============================================================
-- 4. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_email            ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_boards_user_id            ON public.boards(user_id);
CREATE INDEX IF NOT EXISTS idx_sprints_board             ON public.sprints(board_id);
CREATE INDEX IF NOT EXISTS idx_board_items_board         ON public.board_items(board_id);
CREATE INDEX IF NOT EXISTS idx_board_items_group         ON public.board_items(board_id, group_id);
CREATE INDEX IF NOT EXISTS idx_board_items_order         ON public.board_items(group_id, order_index);
CREATE INDEX IF NOT EXISTS idx_board_items_parent        ON public.board_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_board_items_sprint        ON public.board_items(sprint_id);
CREATE INDEX IF NOT EXISTS idx_board_members_board       ON public.board_members(board_id);
CREATE INDEX IF NOT EXISTS idx_board_members_user        ON public.board_members(user_id);
CREATE INDEX IF NOT EXISTS idx_board_members_email       ON public.board_members(email);
CREATE INDEX IF NOT EXISTS idx_board_members_token       ON public.board_members(token);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_board_invite
  ON public.board_members (board_id, lower(email))
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notifications_user        ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_board       ON public.notifications(board_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_item        ON public.task_comments(item_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user        ON public.task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_item        ON public.task_activity(item_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_user        ON public.task_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_created     ON public.task_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_attachments_item     ON public.task_attachments(item_id);
CREATE INDEX IF NOT EXISTS idx_task_time_entries_item    ON public.task_time_entries(item_id);
CREATE INDEX IF NOT EXISTS idx_task_time_entries_user    ON public.task_time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_source          ON public.task_dependencies(source_item_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_target          ON public.task_dependencies(target_item_id);


-- ============================================================
-- 5. TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_boards_updated_at ON public.boards;
CREATE TRIGGER update_boards_updated_at
  BEFORE UPDATE ON public.boards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_board_items_updated_at ON public.board_items;
CREATE TRIGGER update_board_items_updated_at
  BEFORE UPDATE ON public.board_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_sprints_updated_at ON public.sprints;
CREATE TRIGGER update_sprints_updated_at
  BEFORE UPDATE ON public.sprints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_task_comments_updated_at ON public.task_comments;
CREATE TRIGGER update_task_comments_updated_at
  BEFORE UPDATE ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Signup metadata is user-controlled: clamp it to the profile limits
-- so a crafted value can never make the insert (and the signup) fail.
CREATE OR REPLACE FUNCTION public.profile_name_from_meta(_meta jsonb, _email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT left(
    COALESCE(NULLIF(btrim(_meta->>'full_name'), ''), NULLIF(split_part(_email, '@', 1), ''), 'User'),
    100
  );
$$;

CREATE OR REPLACE FUNCTION public.profile_avatar_from_meta(_meta jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _meta->>'avatar_url' ~* '^https?://' AND char_length(_meta->>'avatar_url') <= 500
    THEN _meta->>'avatar_url'
  END;
$$;

-- Create a profile for every new auth user.
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
    public.profile_name_from_meta(new.raw_user_meta_data, new.email),
    new.email,
    public.profile_avatar_from_meta(new.raw_user_meta_data),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- profiles.email is shown to co-members, so it must be the verified
-- auth email — never a value the client wrote.
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.email := (SELECT u.email FROM auth.users u WHERE u.id = NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_email ON public.profiles;
CREATE TRIGGER sync_profile_email
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

CREATE OR REPLACE FUNCTION public.handle_auth_email_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_email_change();

REVOKE ALL ON FUNCTION public.profile_name_from_meta(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.profile_avatar_from_meta(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_profile_email() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_auth_email_change() FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 6. ACCESS HELPERS
-- ============================================================
-- SECURITY DEFINER so policies can read boards/board_members without
-- RLS recursion. Each helper only answers a question about the CALLER
-- (auth.uid()), so exposing them through PostgREST leaks nothing.

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

CREATE OR REPLACE FUNCTION public.can_read_item(_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM board_items bi
    WHERE bi.id = _item_id AND public.can_read_board(bi.board_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_item(_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM board_items bi
    WHERE bi.id = _item_id AND public.can_edit_board(bi.board_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_admin_item(_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM board_items bi
    WHERE bi.id = _item_id AND public.can_admin_board(bi.board_id)
  );
$$;

-- An attachment row may only point at an object stored under its own
-- item: <board_id>/<item_id>/... Without this, a row could reference a
-- file on another board and trick a privileged user into deleting it.
CREATE OR REPLACE FUNCTION public.attachment_path_matches_item(_item_id uuid, _path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM board_items bi
    WHERE bi.id = _item_id
      AND public.can_edit_board(bi.board_id)
      AND _path LIKE bi.board_id::text || '/' || bi.id::text || '/%'
  );
$$;

-- Self, or someone the caller shares at least one board with.
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
        (b.user_id = auth.uid() AND (
          b.user_id = _profile_id
          OR EXISTS (
            SELECT 1 FROM board_members m
            WHERE m.board_id = b.id AND m.user_id = _profile_id AND m.status = 'active'
          )
        ))
        OR
        (b.user_id = _profile_id AND EXISTS (
          SELECT 1 FROM board_members m
          WHERE m.board_id = b.id AND m.user_id = auth.uid() AND m.status = 'active'
        ))
    )
    OR EXISTS (
      SELECT 1
      FROM board_members me
      JOIN board_members them ON them.board_id = me.board_id
      WHERE me.user_id = auth.uid() AND me.status = 'active'
        AND them.user_id = _profile_id AND them.status = 'active'
    );
$$;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.is_board_owner(uuid)',
    'public.is_board_member(uuid, text[])',
    'public.can_read_board(uuid)',
    'public.can_edit_board(uuid)',
    'public.can_admin_board(uuid)',
    'public.can_read_item(uuid)',
    'public.can_edit_item(uuid)',
    'public.can_admin_item(uuid)',
    'public.attachment_path_matches_item(uuid, text)',
    'public.can_view_profile(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;


-- ============================================================
-- 7. TABLE & COLUMN PRIVILEGES
-- ============================================================
-- RLS decides WHICH rows; privileges decide WHICH columns. Column-level
-- UPDATE grants stop ownership/identity columns (boards.user_id,
-- board_members.status/user_id, *.user_id, *.board_id) from being
-- rewritten through the API, whatever the row policy allows.

REVOKE ALL ON
  public.profiles, public.boards, public.sprints, public.board_items,
  public.board_members, public.notifications, public.task_comments,
  public.task_activity, public.task_attachments, public.task_time_entries,
  public.task_dependencies
FROM anon;

-- TRUNCATE bypasses RLS entirely; REFERENCES/TRIGGER are never needed.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON
  public.profiles, public.boards, public.sprints, public.board_items,
  public.board_members, public.notifications, public.task_comments,
  public.task_activity, public.task_attachments, public.task_time_entries,
  public.task_dependencies
FROM authenticated;

GRANT SELECT, INSERT, DELETE ON
  public.profiles, public.boards, public.sprints, public.board_items,
  public.board_members, public.notifications, public.task_comments,
  public.task_attachments, public.task_time_entries, public.task_dependencies
TO authenticated;
GRANT SELECT, INSERT ON public.task_activity TO authenticated;
REVOKE UPDATE, DELETE ON public.task_activity FROM authenticated;

REVOKE UPDATE ON
  public.boards, public.sprints, public.board_items, public.board_members,
  public.notifications, public.task_comments, public.task_attachments,
  public.task_time_entries, public.task_dependencies
FROM authenticated;

-- profiles keeps table-level UPDATE: supabase-js upserts write every
-- column, and profiles.email is forced by the sync_profile_email trigger.
GRANT UPDATE ON public.profiles TO authenticated;
GRANT UPDATE (title, description, color, visibility, columns, groups) ON public.boards TO authenticated;
GRANT UPDATE (title, start_date, end_date, status) ON public.sprints TO authenticated;
GRANT UPDATE (title, description, order_index, group_id, data, parent_id, sprint_id, story_points, estimate_minutes)
  ON public.board_items TO authenticated;
GRANT UPDATE (role) ON public.board_members TO authenticated;
GRANT UPDATE (read) ON public.notifications TO authenticated;
GRANT UPDATE (content) ON public.task_comments TO authenticated;
GRANT UPDATE (duration_minutes, description, date) ON public.task_time_entries TO authenticated;


-- ============================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprints           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activity     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

-- Start from a clean slate: permissive policies are OR-ed, so any
-- leftover policy from the old migrations would silently widen access.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles', 'boards', 'sprints', 'board_items', 'board_members',
        'notifications', 'task_comments', 'task_activity', 'task_attachments',
        'task_time_entries', 'task_dependencies'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── profiles ────────────────────────────────────────────────
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (public.can_view_profile(id));
CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- ── boards ──────────────────────────────────────────────────
CREATE POLICY boards_select ON public.boards FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.can_read_board(id));
CREATE POLICY boards_insert ON public.boards FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY boards_update ON public.boards FOR UPDATE TO authenticated
  USING (public.can_admin_board(id))
  WITH CHECK (public.can_admin_board(id));
CREATE POLICY boards_delete ON public.boards FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ── sprints ─────────────────────────────────────────────────
CREATE POLICY sprints_select ON public.sprints FOR SELECT TO authenticated
  USING (public.can_read_board(board_id));
CREATE POLICY sprints_insert ON public.sprints FOR INSERT TO authenticated
  WITH CHECK (public.can_admin_board(board_id));
CREATE POLICY sprints_update ON public.sprints FOR UPDATE TO authenticated
  USING (public.can_admin_board(board_id))
  WITH CHECK (public.can_admin_board(board_id));
CREATE POLICY sprints_delete ON public.sprints FOR DELETE TO authenticated
  USING (public.can_admin_board(board_id));

-- ── board_items ─────────────────────────────────────────────
-- Create/delete: owner + admin. Edit: owner + admin + editor.
CREATE POLICY board_items_select ON public.board_items FOR SELECT TO authenticated
  USING (public.can_read_board(board_id));
CREATE POLICY board_items_insert ON public.board_items FOR INSERT TO authenticated
  WITH CHECK (public.can_admin_board(board_id));
CREATE POLICY board_items_update ON public.board_items FOR UPDATE TO authenticated
  USING (public.can_edit_board(board_id))
  WITH CHECK (public.can_edit_board(board_id));
CREATE POLICY board_items_delete ON public.board_items FOR DELETE TO authenticated
  USING (public.can_admin_board(board_id));

-- ── board_members ───────────────────────────────────────────
-- Pending rows carry invite tokens: only owner/admin see them.
CREATE POLICY board_members_select ON public.board_members FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.can_admin_board(board_id)
    OR (status = 'active' AND public.can_read_board(board_id))
  );
-- The API can only create PENDING invites. Membership becomes active
-- exclusively through accept_board_invitation(), which checks that the
-- accepting account owns the invited email.
CREATE POLICY board_members_insert ON public.board_members FOR INSERT TO authenticated
  WITH CHECK (
    public.can_admin_board(board_id)
    AND status = 'pending'
    AND user_id IS NULL
    AND token IS NOT NULL
    AND invited_by = (SELECT auth.uid())
  );
CREATE POLICY board_members_update ON public.board_members FOR UPDATE TO authenticated
  USING (public.can_admin_board(board_id))
  WITH CHECK (public.can_admin_board(board_id));
CREATE POLICY board_members_delete ON public.board_members FOR DELETE TO authenticated
  USING (public.can_admin_board(board_id));

-- ── notifications ───────────────────────────────────────────
-- Cross-user notifications must come from SECURITY DEFINER functions.
CREATE POLICY notifications_select ON public.notifications FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY notifications_insert ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (actor_id IS NULL OR actor_id = (SELECT auth.uid()))
  );
CREATE POLICY notifications_update ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY notifications_delete ON public.notifications FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ── task_comments ───────────────────────────────────────────
CREATE POLICY task_comments_select ON public.task_comments FOR SELECT TO authenticated
  USING (public.can_read_item(item_id));
CREATE POLICY task_comments_insert ON public.task_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.can_edit_item(item_id));
CREATE POLICY task_comments_update ON public.task_comments FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND public.can_read_item(item_id))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY task_comments_delete ON public.task_comments FOR DELETE TO authenticated
  USING (
    (user_id = (SELECT auth.uid()) AND public.can_read_item(item_id))
    OR public.can_admin_item(item_id)
  );

-- ── task_activity (append-only) ─────────────────────────────
CREATE POLICY task_activity_select ON public.task_activity FOR SELECT TO authenticated
  USING (public.can_read_item(item_id));
CREATE POLICY task_activity_insert ON public.task_activity FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.can_edit_item(item_id));

-- ── task_attachments ────────────────────────────────────────
CREATE POLICY task_attachments_select ON public.task_attachments FOR SELECT TO authenticated
  USING (public.can_read_item(item_id));
CREATE POLICY task_attachments_insert ON public.task_attachments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND public.attachment_path_matches_item(item_id, file_url)
  );
CREATE POLICY task_attachments_delete ON public.task_attachments FOR DELETE TO authenticated
  USING (
    (user_id = (SELECT auth.uid()) AND public.can_read_item(item_id))
    OR public.can_admin_item(item_id)
  );

-- ── task_time_entries ───────────────────────────────────────
CREATE POLICY task_time_entries_select ON public.task_time_entries FOR SELECT TO authenticated
  USING (public.can_read_item(item_id));
CREATE POLICY task_time_entries_insert ON public.task_time_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND public.can_edit_item(item_id));
CREATE POLICY task_time_entries_update ON public.task_time_entries FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND public.can_read_item(item_id))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY task_time_entries_delete ON public.task_time_entries FOR DELETE TO authenticated
  USING (
    (user_id = (SELECT auth.uid()) AND public.can_read_item(item_id))
    OR public.can_admin_item(item_id)
  );

-- ── task_dependencies ───────────────────────────────────────
CREATE POLICY task_dependencies_select ON public.task_dependencies FOR SELECT TO authenticated
  USING (public.can_read_item(source_item_id));
CREATE POLICY task_dependencies_insert ON public.task_dependencies FOR INSERT TO authenticated
  WITH CHECK (public.can_admin_item(source_item_id) AND public.can_read_item(target_item_id));
CREATE POLICY task_dependencies_delete ON public.task_dependencies FOR DELETE TO authenticated
  USING (public.can_admin_item(source_item_id));


-- ============================================================
-- 9. RPC FUNCTIONS
-- ============================================================

-- Invitation lookup. The token never leaves the server through SELECT.
CREATE OR REPLACE FUNCTION public.get_board_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_board  record;
  v_email  text;
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
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'board_id', v_invite.board_id,
    'role', v_invite.role,
    'status', v_invite.status,
    'email_matches', lower(coalesce(v_email, '')) = lower(v_invite.email),
    'board', jsonb_build_object('title', v_board.title, 'color', v_board.color)
  );
END;
$$;

-- Invitation acceptance. Bound to the invited email: a forwarded or
-- leaked link is useless to any other account.
CREATE OR REPLACE FUNCTION public.accept_board_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_invite record;
  v_email  text;
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
    AND status = 'pending'
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL OR lower(v_email) <> lower(v_invite.email) THEN
    RAISE EXCEPTION 'invite_email_mismatch' USING ERRCODE = '42501';
  END IF;

  -- Already an active member of this board: drop the pending duplicate.
  IF EXISTS (
    SELECT 1 FROM board_members
    WHERE board_id = v_invite.board_id AND user_id = v_uid AND status = 'active'
  ) THEN
    DELETE FROM board_members WHERE id = v_invite.id;
    RETURN jsonb_build_object('boardId', v_invite.board_id, 'alreadyAccepted', true);
  END IF;

  UPDATE board_members
  SET user_id = v_uid,
      status  = 'active',
      token   = NULL
  WHERE id = v_invite.id;

  INSERT INTO notifications (user_id, board_id, title, message, type)
  VALUES (v_uid, v_invite.board_id, 'Joined board', 'You now have access to a shared board', 'share_accepted');

  RETURN jsonb_build_object('boardId', v_invite.board_id, 'alreadyAccepted', false);
END;
$$;

-- Batched item mutations. SECURITY INVOKER: RLS + column grants apply.
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

-- Only moves items that live on the sprint's own board.
CREATE OR REPLACE FUNCTION public.set_items_sprint(p_sprint_id uuid, p_item_ids uuid[])
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE board_items bi
  SET sprint_id = p_sprint_id
  WHERE bi.id = ANY (p_item_ids)
    AND (
      p_sprint_id IS NULL
      OR bi.board_id = (SELECT s.board_id FROM sprints s WHERE s.id = p_sprint_id)
    );
$$;

-- Analytics aggregation. SECURITY INVOKER: only counts visible rows.
CREATE OR REPLACE FUNCTION public.get_analytics(
  p_board_id uuid DEFAULT NULL,
  p_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE sql
SET search_path = public
AS $$
  WITH board_meta AS (
    SELECT
      b.id,
      b.title,
      b.color,
      (
        SELECT c.value->>'id'
        FROM jsonb_array_elements(b.columns) WITH ORDINALITY AS c(value, ord)
        WHERE c.value->>'type' = 'status'
        ORDER BY c.ord
        LIMIT 1
      ) AS status_key,
      (
        SELECT c.value->>'id'
        FROM jsonb_array_elements(b.columns) WITH ORDINALITY AS c(value, ord)
        WHERE c.value->>'type' = 'date'
        ORDER BY c.ord
        LIMIT 1
      ) AS date_key
    FROM boards b
    WHERE p_board_id IS NULL OR b.id = p_board_id
  ),
  window_days AS (
    SELECT LEAST(GREATEST(COALESCE(p_days, 30), 1), 3650) AS days
  ),
  scoped AS (
    SELECT
      bi.id,
      bi.board_id,
      bi.data,
      bm.status_key,
      bm.date_key,
      COALESCE(NULLIF(bi.data->>bm.status_key, ''), 'Not Started') AS status_value
    FROM board_items bi
    JOIN board_meta bm ON bm.id = bi.board_id
    CROSS JOIN window_days w
    WHERE bi.updated_at >= now() - make_interval(days => w.days)
  ),
  totals AS (
    SELECT
      COUNT(*) AS total_tasks,
      COUNT(*) FILTER (WHERE status_value = 'Done') AS completed_tasks,
      COUNT(*) FILTER (
        WHERE status_value <> 'Done'
          AND date_key IS NOT NULL
          AND (data->>date_key) ~ '^\d{4}-\d{2}-\d{2}'
          AND substring(data->>date_key FROM 1 FOR 10)::date < CURRENT_DATE
      ) AS overdue_tasks
    FROM scoped
  ),
  status_dist AS (
    SELECT status_value, COUNT(*) AS count
    FROM scoped
    GROUP BY status_value
  ),
  board_stats AS (
    SELECT
      bm.id,
      bm.title,
      bm.color,
      COUNT(s.id) AS total_tasks,
      COUNT(s.id) FILTER (WHERE s.status_value = 'Done') AS completed_tasks
    FROM board_meta bm
    LEFT JOIN scoped s ON s.board_id = bm.id
    GROUP BY bm.id, bm.title, bm.color
  )
  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'totalTasks', t.total_tasks,
        'completedTasks', t.completed_tasks,
        'completionRate', CASE
          WHEN t.total_tasks > 0
          THEN ROUND((t.completed_tasks::numeric * 100) / t.total_tasks)
          ELSE 0
        END,
        'overdueTasks', t.overdue_tasks,
        'activeBoards', (SELECT COUNT(*) FROM board_meta)
      )
      FROM totals t
    ),
    'statusDistribution', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('status', status_value, 'count', count)
        ORDER BY count DESC, status_value
      )
      FROM status_dist
    ), '[]'::jsonb),
    'boardStats', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'title', title,
          'color', color,
          'totalTasks', total_tasks,
          'completedTasks', completed_tasks,
          'completionRate', CASE
            WHEN total_tasks > 0
            THEN ROUND((completed_tasks::numeric * 100) / total_tasks)
            ELSE 0
          END
        )
        ORDER BY title
      )
      FROM board_stats
    ), '[]'::jsonb)
  );
$$;

-- Fills in missing profile rows/names for people the caller shares a
-- board with. Replaces the old service-role server action: no service
-- key in the app, never overwrites a name the user already set.
CREATE OR REPLACE FUNCTION public.repair_missing_profiles(p_user_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_user_ids IS NULL OR cardinality(p_user_ids) = 0 THEN
    RETURN 0;
  END IF;

  IF cardinality(p_user_ids) > 20 THEN
    RAISE EXCEPTION 'too_many_ids' USING ERRCODE = '22023';
  END IF;

  INSERT INTO profiles AS p (id, full_name, avatar_url)
  SELECT
    u.id,
    public.profile_name_from_meta(u.raw_user_meta_data, u.email),
    public.profile_avatar_from_meta(u.raw_user_meta_data)
  FROM auth.users u
  WHERE u.id = ANY (p_user_ids)
    AND public.can_view_profile(u.id)
  ON CONFLICT (id) DO UPDATE
    SET full_name = COALESCE(NULLIF(p.full_name, ''), EXCLUDED.full_name)
    WHERE p.full_name IS NULL OR p.full_name = '' OR p.email IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.get_board_invitation(text)',
    'public.accept_board_invitation(text)',
    'public.reorder_board_items(text, uuid[])',
    'public.set_items_sprint(uuid, uuid[])',
    'public.get_analytics(uuid, integer)',
    'public.repair_missing_profiles(uuid[])'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;


-- ============================================================
-- 10. STORAGE — private bucket task-attachments
-- ============================================================
-- Object keys: <board_id>/<item_id>/<uuid>_<filename>
--   read:  board owner or any active member
--   write: board owner or active admin/editor

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

CREATE OR REPLACE FUNCTION public.board_id_from_object(_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF _name IS NULL OR _name !~ '^[0-9a-fA-F-]{36}/' THEN
    RETURN NULL;
  END IF;
  RETURN split_part(_name, '/', 1)::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_board_object(_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.can_read_board(public.board_id_from_object(_name)), false);
$$;

CREATE OR REPLACE FUNCTION public.can_edit_board_object(_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.can_edit_board(public.board_id_from_object(_name)), false);
$$;

REVOKE ALL ON FUNCTION public.board_id_from_object(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_board_object(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_edit_board_object(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.board_id_from_object(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_board_object(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_board_object(text) TO authenticated;

DROP POLICY IF EXISTS "task_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "task_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "task_attachments_update" ON storage.objects;
DROP POLICY IF EXISTS "task_attachments_delete" ON storage.objects;

CREATE POLICY "task_attachments_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-attachments' AND public.can_access_board_object(name));
CREATE POLICY "task_attachments_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-attachments' AND public.can_edit_board_object(name));
CREATE POLICY "task_attachments_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'task-attachments' AND public.can_edit_board_object(name))
  WITH CHECK (bucket_id = 'task-attachments' AND public.can_edit_board_object(name));
CREATE POLICY "task_attachments_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'task-attachments' AND public.can_edit_board_object(name));


-- ============================================================
-- 11. REALTIME
-- ============================================================
-- postgres_changes respects the SELECT policies above, so each client
-- only receives events for rows it may read. (Supabase Broadcast does
-- NOT — never broadcast row data from the client.)

DO $$
DECLARE
  t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH t IN ARRAY ARRAY[
    'profiles', 'boards', 'sprints', 'board_items', 'board_members',
    'notifications', 'task_comments', 'task_activity', 'task_attachments',
    'task_time_entries'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.board_items REPLICA IDENTITY FULL;
ALTER TABLE public.boards      REPLICA IDENTITY FULL;

-- ============================================================
-- 15. TEAM COLLABORATION & 2-TIER SHARING
-- ============================================================

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

CREATE OR REPLACE FUNCTION public.get_user_team_role()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_membership record;
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

  IF v_clean_email = (SELECT email FROM public.profiles WHERE id = v_owner_id) THEN
    RAISE EXCEPTION 'cannot_invite_owner' USING MESSAGE = 'Email ini adalah pemilik tim.';
  END IF;

  SELECT id INTO v_existing_user FROM public.profiles WHERE lower(email) = v_clean_email;

  v_token := encode(gen_random_bytes(24), 'hex');

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

  IF v_uid != v_owner_id THEN
    RAISE EXCEPTION 'permission_denied' USING MESSAGE = 'Hanya Owner yang dapat mengubah role anggota tim.';
  END IF;

  UPDATE public.team_members
  SET role = p_role, updated_at = now()
  WHERE id = p_member_id;

  RETURN true;
END;
$$;

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

-- ============================================================
-- DONE
-- ============================================================
