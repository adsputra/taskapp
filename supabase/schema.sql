-- ============================================================
-- schema.sql — Tuesday task app, single source of truth
-- ============================================================
-- Replaces migrations 001–013. Run the whole file in
-- Supabase Dashboard → SQL Editor.
--
-- Idempotent and non-destructive for app data: safe on a fresh project
-- AND on a database built from the old migrations (every policy on the
-- app tables is dropped and recreated from here). The only table it
-- drops is the abandoned `team_members` from migration 012.
--
-- Security model
--   - The browser talks to PostgREST directly with the anon key, so
--     RLS + column privileges below ARE the API authorization layer.
--     Client-side validation in src/lib/api is UX only.
--   - Roles per board: owner (boards.user_id) > admin > editor > viewer.
--   - Every policy targets `authenticated`; `anon` has no table access.
--   - Rows that record an author (comments, attachments, time entries)
--     can only be written as yourself.
--   - The audit trail (task_activity), cross-user notifications and
--     boards.visibility are written ONLY by triggers — the API cannot
--     forge, skip or contradict them.
--   - Users with a verified MFA factor must present an aal2 session:
--     a RESTRICTIVE policy on every table enforces it in the database.
--
-- Tests: supabase/tests/database/*.test.sql (pgTAP) — `npm run test:db`
-- (throwaway container) or `supabase test db` (local stack).
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
  -- Derived from board_members by sync_board_visibility(): never written
  -- by the API (see §7).
  visibility  TEXT NOT NULL DEFAULT 'private',
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

-- mentioned_user_ids: people tagged with @ in the comment. The insert
-- trigger notifies only those who can actually read the board.
CREATE TABLE IF NOT EXISTS public.task_comments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id            UUID NOT NULL REFERENCES public.board_items(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content            TEXT NOT NULL,
  mentioned_user_ids UUID[] NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit trail: append-only, written only by triggers (§9b). No
-- INSERT/UPDATE/DELETE privilege for API roles.
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

-- Per-board automation switches. Each recipe is implemented by the
-- triggers in §9b (and send_due_date_reminders() for the scheduled one).
CREATE TABLE IF NOT EXISTS public.board_automations (
  board_id    UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  recipe      TEXT NOT NULL
              CHECK (recipe IN ('notify_status_change', 'notify_owner_on_done',
                                'subitems_done_parent', 'assign_creator',
                                'due_date_reminder')),
  enabled     BOOLEAN NOT NULL DEFAULT false,
  updated_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, recipe)
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

ALTER TABLE public.task_comments
  ADD COLUMN IF NOT EXISTS mentioned_user_ids UUID[] NOT NULL DEFAULT '{}';

-- Migration 012 (team workspace) was reverted by 013; both are folded in
-- here so schema.sql stays the single source of truth.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'team_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.team_members;
  END IF;
END $$;
DROP TABLE IF EXISTS public.team_members CASCADE;
DROP FUNCTION IF EXISTS public.get_user_team_owner(uuid);
DROP FUNCTION IF EXISTS public.is_team_shared_board(uuid);
DROP FUNCTION IF EXISTS public.get_user_team_role();
DROP FUNCTION IF EXISTS public.list_team_members();
DROP FUNCTION IF EXISTS public.invite_team_member(text, text);
DROP FUNCTION IF EXISTS public.update_team_member_role(uuid, text);
DROP FUNCTION IF EXISTS public.remove_team_member(uuid);
DROP FUNCTION IF EXISTS public.get_team_invitation(text);
DROP FUNCTION IF EXISTS public.accept_team_invitation(text);

-- 'public' was never backed by any policy. Visibility is now derived
-- from board_members: 'shared' while anyone is invited, else 'private'.
ALTER TABLE public.boards DROP CONSTRAINT IF EXISTS boards_visibility_check;
UPDATE public.boards b
SET visibility = CASE
  WHEN EXISTS (SELECT 1 FROM public.board_members m WHERE m.board_id = b.id) THEN 'shared'
  ELSE 'private'
END
WHERE b.visibility IS DISTINCT FROM CASE
  WHEN EXISTS (SELECT 1 FROM public.board_members m WHERE m.board_id = b.id) THEN 'shared'
  ELSE 'private'
END;
ALTER TABLE public.boards ADD CONSTRAINT boards_visibility_check
  CHECK (visibility IN ('private', 'shared'));

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
ALTER TABLE public.task_comments DROP CONSTRAINT IF EXISTS task_comments_mentions_limit;
ALTER TABLE public.task_comments ADD CONSTRAINT task_comments_mentions_limit
  CHECK (cardinality(mentioned_user_ids) <= 20) NOT VALID;

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
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower      ON public.profiles(lower(email));
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

-- Trigram indexes for search_workspace() (ILIKE '%term%'). pg_trgm lives
-- in `extensions` on Supabase, but older projects may have it in public.
DO $$
DECLARE
  v_schema text;
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'pg_trgm unavailable (%); search falls back to sequential scans', SQLERRM;
  END;

  SELECT n.nspname INTO v_schema
  FROM pg_opclass o JOIN pg_namespace n ON n.oid = o.opcnamespace
  WHERE o.opcname = 'gin_trgm_ops'
  LIMIT 1;

  IF v_schema IS NOT NULL THEN
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_board_items_title_trgm ON public.board_items USING gin (title %I.gin_trgm_ops)',
      v_schema);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_boards_title_trgm ON public.boards USING gin (title %I.gin_trgm_ops)',
      v_schema);
  END IF;
END $$;


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

-- MFA gate. A user who enrolled a verified factor must present an aal2
-- JWT; everyone else passes at aal1. Used by the RESTRICTIVE policies in
-- §8 and by the SECURITY DEFINER RPCs (which bypass RLS).
CREATE OR REPLACE FUNCTION public.mfa_satisfied()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      OR NOT EXISTS (
        SELECT 1 FROM auth.mfa_factors f
        WHERE f.user_id = auth.uid() AND f.status = 'verified'
      );
$$;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.mfa_satisfied()',
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

-- Internal helpers for triggers. Unlike the helpers above they answer
-- questions about ANY user, so they are not exposed to API roles.
CREATE OR REPLACE FUNCTION public.user_can_read_board(_user_id uuid, _board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM boards b WHERE b.id = _board_id AND b.user_id = _user_id)
      OR EXISTS (
        SELECT 1 FROM board_members bm
        WHERE bm.board_id = _board_id AND bm.user_id = _user_id AND bm.status = 'active'
      );
$$;

-- First column of a given type in a board's column list (or NULL).
CREATE OR REPLACE FUNCTION public.board_column_key(_columns jsonb, _type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT c.value ->> 'id'
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(_columns) = 'array' THEN _columns ELSE '[]'::jsonb END)
       WITH ORDINALITY AS c(value, ord)
  WHERE c.value ->> 'type' = _type
  ORDER BY c.ord
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.board_column_keys(_columns jsonb, _type text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(c.value ->> 'id' ORDER BY c.ord), '{}')
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(_columns) = 'array' THEN _columns ELSE '[]'::jsonb END)
       WITH ORDINALITY AS c(value, ord)
  WHERE c.value ->> 'type' = _type AND c.value ->> 'id' IS NOT NULL;
$$;

-- A people cell holds one email or an array of emails.
CREATE OR REPLACE FUNCTION public.people_emails(_value jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT lower(btrim(e))), '{}')
  FROM (
    SELECT jsonb_array_elements_text(_value) AS e WHERE jsonb_typeof(_value) = 'array'
    UNION ALL
    SELECT _value #>> '{}' WHERE jsonb_typeof(_value) = 'string'
  ) s
  WHERE e IS NOT NULL AND btrim(e) <> '';
$$;

-- Every assignee email across all people columns of an item.
CREATE OR REPLACE FUNCTION public.item_assignee_emails(_data jsonb, _columns jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT e), '{}')
  FROM unnest(public.board_column_keys(_columns, 'people')) AS k,
       unnest(public.people_emails(_data -> k)) AS e;
$$;

CREATE OR REPLACE FUNCTION public.profile_ids_for_emails(_emails text[])
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT p.id), '{}')
  FROM profiles p
  WHERE lower(p.email) = ANY (_emails);
$$;

CREATE OR REPLACE FUNCTION public.is_done_status(_value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(btrim(COALESCE(_value #>> '{}', ''))) = 'done';
$$;

CREATE OR REPLACE FUNCTION public.automation_enabled(_board_id uuid, _recipe text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM board_automations a
    WHERE a.board_id = _board_id AND a.recipe = _recipe AND a.enabled
  );
$$;

-- Readable form of a cell value for the audit trail.
CREATE OR REPLACE FUNCTION public.activity_format_value(_value jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT left(
    CASE
      WHEN _value IS NULL OR _value = 'null'::jsonb OR _value = '""'::jsonb THEN 'empty'
      WHEN jsonb_typeof(_value) = 'array' THEN COALESCE(
        (SELECT string_agg(CASE WHEN jsonb_typeof(e) = 'string' THEN e #>> '{}' ELSE e::text END, ', ')
         FROM jsonb_array_elements(_value) AS e),
        'empty')
      WHEN jsonb_typeof(_value) = 'boolean' THEN CASE WHEN _value = 'true'::jsonb THEN 'Yes' ELSE 'No' END
      WHEN jsonb_typeof(_value) = 'string' THEN _value #>> '{}'
      ELSE _value::text
    END,
    5000);
$$;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.user_can_read_board(uuid, uuid)',
    'public.board_column_key(jsonb, text)',
    'public.board_column_keys(jsonb, text)',
    'public.people_emails(jsonb)',
    'public.item_assignee_emails(jsonb, jsonb)',
    'public.profile_ids_for_emails(text[])',
    'public.is_done_status(jsonb)',
    'public.automation_enabled(uuid, text)',
    'public.activity_format_value(jsonb)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
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
  public.task_dependencies, public.board_automations
FROM anon;

-- TRUNCATE bypasses RLS entirely; REFERENCES/TRIGGER are never needed.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON
  public.profiles, public.boards, public.sprints, public.board_items,
  public.board_members, public.notifications, public.task_comments,
  public.task_activity, public.task_attachments, public.task_time_entries,
  public.task_dependencies, public.board_automations
FROM authenticated;

GRANT SELECT, INSERT, DELETE ON
  public.profiles, public.boards, public.sprints, public.board_items,
  public.board_members, public.notifications, public.task_comments,
  public.task_attachments, public.task_time_entries, public.task_dependencies,
  public.board_automations
TO authenticated;
-- The audit trail is written by triggers only (§9b).
GRANT SELECT ON public.task_activity TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.task_activity FROM authenticated;

REVOKE UPDATE ON
  public.boards, public.sprints, public.board_items, public.board_members,
  public.notifications, public.task_comments, public.task_attachments,
  public.task_time_entries, public.task_dependencies, public.board_automations
FROM authenticated;

-- profiles keeps table-level UPDATE: supabase-js upserts write every
-- column, and profiles.email is forced by the sync_profile_email trigger.
GRANT UPDATE ON public.profiles TO authenticated;
-- boards.visibility is absent on purpose: sync_board_visibility() owns it.
GRANT UPDATE (title, description, color, columns, groups) ON public.boards TO authenticated;
GRANT UPDATE (title, start_date, end_date, status) ON public.sprints TO authenticated;
GRANT UPDATE (title, description, order_index, group_id, data, parent_id, sprint_id, story_points, estimate_minutes)
  ON public.board_items TO authenticated;
GRANT UPDATE (role) ON public.board_members TO authenticated;
GRANT UPDATE (read) ON public.notifications TO authenticated;
GRANT UPDATE (content) ON public.task_comments TO authenticated;
GRANT UPDATE (duration_minutes, description, date) ON public.task_time_entries TO authenticated;
GRANT UPDATE (enabled) ON public.board_automations TO authenticated;


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
ALTER TABLE public.board_automations ENABLE ROW LEVEL SECURITY;

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
        'task_time_entries', 'task_dependencies', 'board_automations'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── MFA (RESTRICTIVE: AND-ed with every permissive policy) ──
-- A user with a verified factor is locked out of every table until the
-- session is stepped up to aal2. Enforced here, not only in the proxy,
-- because the browser talks to PostgREST directly.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'boards', 'sprints', 'board_items', 'board_members',
    'notifications', 'task_comments', 'task_activity', 'task_attachments',
    'task_time_entries', 'task_dependencies', 'board_automations'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
         USING ((SELECT public.mfa_satisfied())) WITH CHECK ((SELECT public.mfa_satisfied()))',
      t || '_require_mfa', t);
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
-- Create/edit: owner + admin + editor. Delete: owner + admin.
CREATE POLICY board_items_select ON public.board_items FOR SELECT TO authenticated
  USING (public.can_read_board(board_id));
CREATE POLICY board_items_insert ON public.board_items FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_board(board_id));
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

-- ── task_activity (append-only, trigger-written) ────────────
CREATE POLICY task_activity_select ON public.task_activity FOR SELECT TO authenticated
  USING (public.can_read_item(item_id));

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

-- ── board_automations ───────────────────────────────────────
CREATE POLICY board_automations_select ON public.board_automations FOR SELECT TO authenticated
  USING (public.can_read_board(board_id));
CREATE POLICY board_automations_insert ON public.board_automations FOR INSERT TO authenticated
  WITH CHECK (public.can_admin_board(board_id));
CREATE POLICY board_automations_update ON public.board_automations FOR UPDATE TO authenticated
  USING (public.can_admin_board(board_id))
  WITH CHECK (public.can_admin_board(board_id));
CREATE POLICY board_automations_delete ON public.board_automations FOR DELETE TO authenticated
  USING (public.can_admin_board(board_id));


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
  IF NOT public.mfa_satisfied() THEN
    RAISE EXCEPTION 'mfa_required' USING ERRCODE = '42501';
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
  IF NOT public.mfa_satisfied() THEN
    RAISE EXCEPTION 'mfa_required' USING ERRCODE = '42501';
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

  -- Let the inviter know (if they still administer the board).
  IF v_invite.invited_by IS NOT NULL AND v_invite.invited_by <> v_uid THEN
    INSERT INTO notifications (user_id, board_id, actor_id, title, message, type)
    SELECT v_invite.invited_by, v_invite.board_id, v_uid, 'Invitation accepted',
           left(COALESCE(p.full_name, v_email) || ' joined ' || b.title, 2000), 'invite_accepted'
    FROM boards b
    LEFT JOIN profiles p ON p.id = v_uid
    WHERE b.id = v_invite.board_id
      AND public.user_can_read_board(v_invite.invited_by, v_invite.board_id);
  END IF;

  RETURN jsonb_build_object('boardId', v_invite.board_id, 'alreadyAccepted', false);
END;
$$;

-- Batched item mutations. SECURITY INVOKER: RLS + column grants apply.
CREATE OR REPLACE FUNCTION public.reorder_board_items(p_group_id text, p_item_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF cardinality(p_item_ids) > 1000 THEN
    RAISE EXCEPTION 'too_many_ids' USING ERRCODE = '22023';
  END IF;

  UPDATE board_items bi
  SET order_index = ord.idx - 1
  FROM unnest(p_item_ids) WITH ORDINALITY AS ord(id, idx)
  WHERE bi.id = ord.id AND bi.group_id = p_group_id;
END;
$$;

-- Only moves items that live on the sprint's own board.
CREATE OR REPLACE FUNCTION public.set_items_sprint(p_sprint_id uuid, p_item_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF cardinality(p_item_ids) > 1000 THEN
    RAISE EXCEPTION 'too_many_ids' USING ERRCODE = '22023';
  END IF;

  UPDATE board_items bi
  SET sprint_id = p_sprint_id
  WHERE bi.id = ANY (p_item_ids)
    AND (
      p_sprint_id IS NULL
      OR bi.board_id = (SELECT s.board_id FROM sprints s WHERE s.id = p_sprint_id)
    );
END;
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
  IF NOT public.mfa_satisfied() THEN
    RAISE EXCEPTION 'mfa_required' USING ERRCODE = '42501';
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

-- Atomic edits to boards.columns / boards.groups. The client used to
-- send the whole array back, so two people adding a column at the same
-- time silently lost one of them. The row lock serialises concurrent
-- edits and each one is applied to the latest array.
-- SECURITY INVOKER: RLS (admin only) + column grants still apply.
CREATE OR REPLACE FUNCTION public.board_patch_list(
  p_board_id uuid,
  p_list text,
  p_op text,
  p_item_id text,
  p_value jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_board boards%ROWTYPE;
  v_list  jsonb;
  v_new   jsonb;
BEGIN
  IF p_list IS NULL OR p_list NOT IN ('columns', 'groups')
     OR p_op IS NULL OR p_op NOT IN ('add', 'update', 'delete') THEN
    RAISE EXCEPTION 'invalid_operation' USING ERRCODE = '22023';
  END IF;
  IF p_item_id IS NULL OR char_length(p_item_id) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'invalid_id' USING ERRCODE = '22023';
  END IF;
  IF p_op IN ('add', 'update')
     AND (p_value IS NULL OR jsonb_typeof(p_value) <> 'object' OR octet_length(p_value::text) > 16384) THEN
    RAISE EXCEPTION 'invalid_value' USING ERRCODE = '22023';
  END IF;

  -- FOR UPDATE applies the UPDATE policy: non-admins see no row.
  SELECT * INTO v_board FROM boards WHERE id = p_board_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'board_not_found_or_forbidden' USING ERRCODE = '42501';
  END IF;

  v_list := CASE p_list WHEN 'columns' THEN v_board.columns ELSE v_board.groups END;
  IF jsonb_typeof(v_list) IS DISTINCT FROM 'array' THEN
    v_list := '[]'::jsonb;
  END IF;

  IF p_op = 'add' THEN
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_list) e WHERE e ->> 'id' = p_item_id) THEN
      RAISE EXCEPTION 'duplicate_id' USING ERRCODE = '23505';
    END IF;
    v_new := v_list || jsonb_build_array(p_value || jsonb_build_object('id', p_item_id));
  ELSIF p_op = 'update' THEN
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_list) e WHERE e ->> 'id' = p_item_id) THEN
      RAISE EXCEPTION 'entry_not_found' USING ERRCODE = 'P0002';
    END IF;
    SELECT jsonb_agg(CASE WHEN t.e ->> 'id' = p_item_id THEN t.e || (p_value - 'id') ELSE t.e END ORDER BY t.ord)
    INTO v_new
    FROM jsonb_array_elements(v_list) WITH ORDINALITY AS t(e, ord);
  ELSE
    SELECT COALESCE(jsonb_agg(t.e ORDER BY t.ord), '[]'::jsonb)
    INTO v_new
    FROM jsonb_array_elements(v_list) WITH ORDINALITY AS t(e, ord)
    WHERE t.e ->> 'id' IS DISTINCT FROM p_item_id;

    -- A deleted group takes its tasks with it, in the same transaction.
    IF p_list = 'groups' THEN
      DELETE FROM board_items WHERE board_id = p_board_id AND group_id = p_item_id;
    END IF;
  END IF;

  IF p_list = 'columns' THEN
    UPDATE boards SET columns = v_new WHERE id = p_board_id RETURNING * INTO v_board;
  ELSE
    UPDATE boards SET groups = v_new WHERE id = p_board_id RETURNING * INTO v_board;
  END IF;

  RETURN to_jsonb(v_board);
END;
$$;

-- Turn an automation recipe on/off. updated_by/updated_at are stamped by
-- the board_automations_stamp trigger, never taken from the client.
CREATE OR REPLACE FUNCTION public.set_board_automation(p_board_id uuid, p_recipe text, p_enabled boolean)
RETURNS jsonb
LANGUAGE sql
SET search_path = public
AS $$
  INSERT INTO board_automations AS a (board_id, recipe, enabled)
  VALUES (p_board_id, p_recipe, COALESCE(p_enabled, false))
  ON CONFLICT (board_id, recipe) DO UPDATE SET enabled = EXCLUDED.enabled
  RETURNING to_jsonb(a);
$$;

-- Scheduled recipes need pg_cron (Database → Extensions on Supabase).
CREATE OR REPLACE FUNCTION public.get_automation_capabilities()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'cron', EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
  );
$$;

-- Global search (command palette). SECURITY INVOKER: RLS limits the
-- results to boards and tasks the caller can read.
CREATE OR REPLACE FUNCTION public.search_workspace(p_query text, p_limit integer DEFAULT 8)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH q AS (
    SELECT
      '%' || replace(replace(replace(btrim(COALESCE(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' AS pattern,
      LEAST(GREATEST(COALESCE(p_limit, 8), 1), 25) AS lim,
      char_length(btrim(COALESCE(p_query, ''))) BETWEEN 2 AND 100 AS valid
  )
  SELECT jsonb_build_object(
    'boards', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', b.id, 'title', b.title, 'color', b.color))
      FROM (
        SELECT b.id, b.title, b.color
        FROM boards b, q
        WHERE q.valid AND b.title ILIKE q.pattern
        ORDER BY b.updated_at DESC
        LIMIT (SELECT lim FROM q)
      ) b
    ), '[]'::jsonb),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id, 'title', i.title, 'board_id', i.board_id, 'parent_id', i.parent_id,
        'board_title', i.board_title, 'board_color', i.board_color))
      FROM (
        SELECT bi.id, bi.title, bi.board_id, bi.parent_id, b.title AS board_title, b.color AS board_color
        FROM board_items bi
        JOIN boards b ON b.id = bi.board_id
        CROSS JOIN q
        WHERE q.valid AND bi.title ILIKE q.pattern
        ORDER BY bi.updated_at DESC
        LIMIT (SELECT lim FROM q)
      ) i
    ), '[]'::jsonb)
  );
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
    'public.repair_missing_profiles(uuid[])',
    'public.board_patch_list(uuid, text, text, text, jsonb)',
    'public.set_board_automation(uuid, text, boolean)',
    'public.get_automation_capabilities()',
    'public.search_workspace(text, integer)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;


-- ============================================================
-- 9b. TRIGGERS — integrity, audit trail, notifications, automations
-- ============================================================
-- All side effects the client used to perform itself now happen here,
-- inside the same transaction as the write that caused them:
--   - task_activity rows (the client can no longer forge or skip them)
--   - notifications for OTHER users (RLS lets a client notify only itself)
--   - boards.visibility (derived from board_members)
-- Notification failures are caught and logged so they can never block
-- the user's write; audit failures are not (fail closed).

-- Profile for the acting user, creating it from auth.users if it is
-- missing (accounts that predate handle_new_user). NULL = no actor
-- (service role / pg_cron).
CREATE OR REPLACE FUNCTION public.ensure_actor_profile(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE id = _user_id) THEN
    RETURN _user_id;
  END IF;

  INSERT INTO profiles (id, full_name, avatar_url)
  SELECT u.id,
         public.profile_name_from_meta(u.raw_user_meta_data, u.email),
         public.profile_avatar_from_meta(u.raw_user_meta_data)
  FROM auth.users u
  WHERE u.id = _user_id
  ON CONFLICT (id) DO NOTHING;

  RETURN CASE WHEN EXISTS (SELECT 1 FROM profiles WHERE id = _user_id) THEN _user_id END;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_activity(
  _item_id uuid, _actor uuid, _action text, _field text, _old text, _new text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO task_activity (item_id, user_id, action, field_name, old_value, new_value)
  VALUES (_item_id, _actor, _action, left(_field, 100), left(_old, 5000), left(_new, 5000));
$$;

-- Notify users who can read the board, never the actor themselves.
CREATE OR REPLACE FUNCTION public.notify_users(
  _user_ids uuid[], _board_id uuid, _item_id uuid, _actor uuid,
  _type text, _title text, _message text, _data jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF _user_ids IS NULL OR cardinality(_user_ids) = 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO notifications (user_id, board_id, item_id, actor_id, type, title, message, data)
  SELECT s.u, _board_id, _item_id, _actor, _type, left(_title, 200), left(_message, 2000),
         COALESCE(_data, '{}'::jsonb)
  FROM (SELECT DISTINCT unnest(_user_ids) AS u) s
  WHERE s.u IS NOT NULL
    AND s.u IS DISTINCT FROM _actor
    AND public.user_can_read_board(s.u, _board_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.try_date(_value text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF _value IS NULL OR _value !~ '^\d{4}-\d{2}-\d{2}' THEN
    RETURN NULL;
  END IF;
  RETURN substring(_value FROM 1 FOR 10)::date;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- ── boards ──────────────────────────────────────────────────
-- A new board has no members, so it starts private whatever the client sent.
CREATE OR REPLACE FUNCTION public.boards_force_private()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.visibility := 'private';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS boards_force_private ON public.boards;
CREATE TRIGGER boards_force_private
  BEFORE INSERT ON public.boards
  FOR EACH ROW EXECUTE FUNCTION public.boards_force_private();

-- ── board_members → boards.visibility ───────────────────────
CREATE OR REPLACE FUNCTION public.sync_board_visibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_board_id uuid;
  v_target   text;
BEGIN
  v_board_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.board_id ELSE NEW.board_id END;
  v_target := CASE
    WHEN EXISTS (SELECT 1 FROM board_members WHERE board_id = v_board_id) THEN 'shared'
    ELSE 'private'
  END;

  UPDATE boards SET visibility = v_target
  WHERE id = v_board_id AND visibility IS DISTINCT FROM v_target;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_board_visibility ON public.board_members;
CREATE TRIGGER sync_board_visibility
  AFTER INSERT OR DELETE ON public.board_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_board_visibility();

-- ── board_items: reference integrity ────────────────────────
-- Foreign keys are checked without RLS, so without this an editor could
-- hang a task under a parent or sprint on a board they cannot see.
-- Subtasks are one level deep, which also rules out parent cycles.
CREATE OR REPLACE FUNCTION public.board_items_check_refs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL AND (
       TG_OP = 'INSERT'
       OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
       OR NEW.board_id IS DISTINCT FROM OLD.board_id
     ) THEN
    IF NEW.parent_id = NEW.id OR NOT EXISTS (
      SELECT 1 FROM board_items p
      WHERE p.id = NEW.parent_id AND p.board_id = NEW.board_id AND p.parent_id IS NULL
    ) THEN
      RAISE EXCEPTION 'invalid_parent' USING ERRCODE = '23514',
        DETAIL = 'A subtask parent must be a top-level task on the same board.';
    END IF;
  END IF;

  IF NEW.sprint_id IS NOT NULL AND (
       TG_OP = 'INSERT'
       OR NEW.sprint_id IS DISTINCT FROM OLD.sprint_id
       OR NEW.board_id IS DISTINCT FROM OLD.board_id
     ) THEN
    IF NOT EXISTS (SELECT 1 FROM sprints s WHERE s.id = NEW.sprint_id AND s.board_id = NEW.board_id) THEN
      RAISE EXCEPTION 'invalid_sprint' USING ERRCODE = '23514',
        DETAIL = 'A sprint must belong to the same board as the task.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS board_items_check_refs ON public.board_items;
CREATE TRIGGER board_items_check_refs
  BEFORE INSERT OR UPDATE OF parent_id, sprint_id, board_id ON public.board_items
  FOR EACH ROW EXECUTE FUNCTION public.board_items_check_refs();

-- ── board_items: automation "assign_creator" ────────────────
CREATE OR REPLACE FUNCTION public.board_items_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_people_key text;
  v_email      text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.automation_enabled(NEW.board_id, 'assign_creator') THEN
    RETURN NEW;
  END IF;

  SELECT public.board_column_key(b.columns, 'people') INTO v_people_key
  FROM boards b WHERE b.id = NEW.board_id;

  IF v_people_key IS NULL
     OR cardinality(public.people_emails(NEW.data -> v_people_key)) > 0 THEN
    RETURN NEW;
  END IF;

  SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = auth.uid();
  IF v_email IS NOT NULL THEN
    NEW.data := jsonb_set(COALESCE(NEW.data, '{}'::jsonb), ARRAY[v_people_key], jsonb_build_array(v_email));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS board_items_before_insert ON public.board_items;
CREATE TRIGGER board_items_before_insert
  BEFORE INSERT ON public.board_items
  FOR EACH ROW EXECUTE FUNCTION public.board_items_before_insert();

-- ── board_items: created ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.board_items_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor   uuid := public.ensure_actor_profile(auth.uid());
  v_columns jsonb;
BEGIN
  SELECT b.columns INTO v_columns FROM boards b WHERE b.id = NEW.board_id;

  IF v_actor IS NOT NULL THEN
    PERFORM public.log_activity(NEW.id, v_actor, 'created', NULL, NULL, NEW.title);
    IF NEW.parent_id IS NOT NULL THEN
      PERFORM public.log_activity(NEW.parent_id, v_actor, 'updated', 'Subtask', NULL, 'Added: ' || NEW.title);
    END IF;
  END IF;

  BEGIN
    PERFORM public.notify_users(
      public.profile_ids_for_emails(public.item_assignee_emails(NEW.data, v_columns)),
      NEW.board_id, NEW.id, v_actor, 'assigned', 'You were assigned a task', NEW.title);
  EXCEPTION WHEN others THEN
    RAISE WARNING 'board_items insert notifications failed: %', SQLERRM;
  END;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS board_items_after_insert ON public.board_items;
CREATE TRIGGER board_items_after_insert
  AFTER INSERT ON public.board_items
  FOR EACH ROW EXECUTE FUNCTION public.board_items_after_insert();

-- ── board_items: updated ────────────────────────────────────
-- Column list: a reorder (order_index only) does not fire this trigger.
CREATE OR REPLACE FUNCTION public.board_items_after_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor      uuid := public.ensure_actor_profile(auth.uid());
  v_columns    jsonb;
  v_groups     jsonb;
  v_owner      uuid;
  v_status_key text;
  v_status_col jsonb;
  v_done_label text;
  v_key        text;
  v_col        jsonb;
  v_old        text;
  v_new        text;
  v_logged     integer := 0;
  v_added      text[];
BEGIN
  SELECT b.columns, b.groups, b.user_id INTO v_columns, v_groups, v_owner
  FROM boards b WHERE b.id = NEW.board_id;
  v_status_key := public.board_column_key(v_columns, 'status');

  -- 1. Audit trail ------------------------------------------------
  IF v_actor IS NOT NULL THEN
    IF NEW.title IS DISTINCT FROM OLD.title THEN
      PERFORM public.log_activity(NEW.id, v_actor, 'updated', 'Title', OLD.title, NEW.title);
    END IF;

    IF NEW.description IS DISTINCT FROM OLD.description THEN
      PERFORM public.log_activity(NEW.id, v_actor, 'updated', 'Description',
        COALESCE(NULLIF(OLD.description, ''), 'empty'), COALESCE(NULLIF(NEW.description, ''), 'empty'));
    END IF;

    IF NEW.group_id IS DISTINCT FROM OLD.group_id THEN
      PERFORM public.log_activity(NEW.id, v_actor, 'updated', 'Group',
        COALESCE((SELECT g ->> 'title' FROM jsonb_array_elements(v_groups) g WHERE g ->> 'id' = OLD.group_id LIMIT 1), OLD.group_id),
        COALESCE((SELECT g ->> 'title' FROM jsonb_array_elements(v_groups) g WHERE g ->> 'id' = NEW.group_id LIMIT 1), NEW.group_id));
    END IF;

    IF NEW.sprint_id IS DISTINCT FROM OLD.sprint_id THEN
      PERFORM public.log_activity(NEW.id, v_actor, 'updated', 'Sprint',
        COALESCE((SELECT s.title FROM sprints s WHERE s.id = OLD.sprint_id), 'empty'),
        COALESCE((SELECT s.title FROM sprints s WHERE s.id = NEW.sprint_id), 'empty'));
    END IF;

    IF NEW.story_points IS DISTINCT FROM OLD.story_points THEN
      PERFORM public.log_activity(NEW.id, v_actor, 'updated', 'Story Points',
        COALESCE(OLD.story_points::text, 'empty'), COALESCE(NEW.story_points::text, 'empty'));
    END IF;

    IF NEW.estimate_minutes IS DISTINCT FROM OLD.estimate_minutes THEN
      PERFORM public.log_activity(NEW.id, v_actor, 'updated', 'Estimate (min)',
        COALESCE(OLD.estimate_minutes::text, 'empty'), COALESCE(NEW.estimate_minutes::text, 'empty'));
    END IF;

    IF NEW.data IS DISTINCT FROM OLD.data THEN
      FOR v_key IN
        SELECT k FROM (
          SELECT jsonb_object_keys(OLD.data) AS k
          UNION
          SELECT jsonb_object_keys(NEW.data)
        ) keys
        ORDER BY k
      LOOP
        v_old := public.activity_format_value(OLD.data -> v_key);
        v_new := public.activity_format_value(NEW.data -> v_key);
        CONTINUE WHEN v_old = v_new;

        v_col := (SELECT c FROM jsonb_array_elements(v_columns) c WHERE c ->> 'id' = v_key LIMIT 1);
        PERFORM public.log_activity(
          NEW.id, v_actor,
          CASE v_col ->> 'type' WHEN 'status' THEN 'status_changed' WHEN 'people' THEN 'assigned' ELSE 'updated' END,
          COALESCE(NULLIF(v_col ->> 'title', ''), initcap(replace(v_key, '_', ' '))),
          v_old, v_new);

        v_logged := v_logged + 1;
        EXIT WHEN v_logged >= 50;
      END LOOP;
    END IF;
  END IF;

  -- 2. Notifications (best effort) --------------------------------
  BEGIN
    v_added := ARRAY(
      SELECT unnest(public.item_assignee_emails(NEW.data, v_columns))
      EXCEPT
      SELECT unnest(public.item_assignee_emails(OLD.data, v_columns))
    );
    IF cardinality(v_added) > 0 THEN
      PERFORM public.notify_users(public.profile_ids_for_emails(v_added),
        NEW.board_id, NEW.id, v_actor, 'assigned', 'You were assigned a task', NEW.title);
    END IF;

    IF v_status_key IS NOT NULL
       AND (NEW.data -> v_status_key) IS DISTINCT FROM (OLD.data -> v_status_key) THEN
      IF public.automation_enabled(NEW.board_id, 'notify_status_change') THEN
        PERFORM public.notify_users(
          public.profile_ids_for_emails(public.item_assignee_emails(NEW.data, v_columns)),
          NEW.board_id, NEW.id, v_actor, 'status_changed', 'Status changed',
          NEW.title || ' → ' || public.activity_format_value(NEW.data -> v_status_key));
      END IF;

      IF public.is_done_status(NEW.data -> v_status_key)
         AND NOT public.is_done_status(OLD.data -> v_status_key)
         AND public.automation_enabled(NEW.board_id, 'notify_owner_on_done') THEN
        PERFORM public.notify_users(ARRAY[v_owner],
          NEW.board_id, NEW.id, v_actor, 'task_done', 'Task completed', NEW.title);
      END IF;
    END IF;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'board_items update notifications failed: %', SQLERRM;
  END;

  -- 3. Automation: every subtask done → parent done -----------------
  IF NEW.parent_id IS NOT NULL
     AND v_status_key IS NOT NULL
     AND (NEW.data -> v_status_key) IS DISTINCT FROM (OLD.data -> v_status_key)
     AND public.is_done_status(NEW.data -> v_status_key)
     AND public.automation_enabled(NEW.board_id, 'subitems_done_parent')
     AND NOT EXISTS (
       SELECT 1 FROM board_items s
       WHERE s.parent_id = NEW.parent_id AND NOT public.is_done_status(s.data -> v_status_key)
     ) THEN
    v_status_col := (SELECT c FROM jsonb_array_elements(v_columns) c WHERE c ->> 'id' = v_status_key LIMIT 1);
    v_done_label := COALESCE(
      (SELECT ch ->> 'label'
       FROM jsonb_array_elements(COALESCE(v_status_col -> 'options' -> 'choices', '[]'::jsonb)) ch
       WHERE lower(ch ->> 'label') = 'done'
       LIMIT 1),
      'Done');

    UPDATE board_items p
    SET data = jsonb_set(p.data, ARRAY[v_status_key], to_jsonb(v_done_label))
    WHERE p.id = NEW.parent_id AND NOT public.is_done_status(p.data -> v_status_key);
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS board_items_after_update ON public.board_items;
CREATE TRIGGER board_items_after_update
  AFTER UPDATE OF title, description, group_id, data, sprint_id, story_points, estimate_minutes
  ON public.board_items
  FOR EACH ROW EXECUTE FUNCTION public.board_items_after_update();

-- ── task_comments ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.task_comments_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item      record;
  v_columns   jsonb;
  v_excerpt   text;
  v_mentioned uuid[];
  v_others    uuid[];
BEGIN
  SELECT bi.id, bi.board_id, bi.title, bi.data INTO v_item
  FROM board_items bi WHERE bi.id = NEW.item_id;
  SELECT b.columns INTO v_columns FROM boards b WHERE b.id = v_item.board_id;

  PERFORM public.log_activity(NEW.item_id, NEW.user_id, 'commented', NULL, NULL, left(NEW.content, 100));

  BEGIN
    v_excerpt := left(regexp_replace(NEW.content, '\s+', ' ', 'g'), 140);
    v_mentioned := ARRAY(SELECT DISTINCT u FROM unnest(NEW.mentioned_user_ids) AS u WHERE u <> NEW.user_id);

    PERFORM public.notify_users(v_mentioned, v_item.board_id, NEW.item_id, NEW.user_id,
      'mention', 'You were mentioned', v_item.title || ': ' || v_excerpt);

    -- Assignees and earlier commenters, minus people already notified.
    v_others := ARRAY(
      SELECT unnest(public.profile_ids_for_emails(public.item_assignee_emails(v_item.data, v_columns)))
      UNION
      SELECT c.user_id FROM task_comments c WHERE c.item_id = NEW.item_id AND c.id <> NEW.id
      EXCEPT
      SELECT unnest(v_mentioned)
    );
    PERFORM public.notify_users(v_others, v_item.board_id, NEW.item_id, NEW.user_id,
      'comment', 'New comment', v_item.title || ': ' || v_excerpt);
  EXCEPTION WHEN others THEN
    RAISE WARNING 'comment notifications failed: %', SQLERRM;
  END;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS task_comments_after_insert ON public.task_comments;
CREATE TRIGGER task_comments_after_insert
  AFTER INSERT ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.task_comments_after_insert();

-- ── task_attachments ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.task_attachments_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.log_activity(NEW.item_id, NEW.user_id, 'attached', NULL, NULL, NEW.file_name);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS task_attachments_after_insert ON public.task_attachments;
CREATE TRIGGER task_attachments_after_insert
  AFTER INSERT ON public.task_attachments
  FOR EACH ROW EXECUTE FUNCTION public.task_attachments_after_insert();

-- ── board_automations ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.board_automations_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS board_automations_stamp ON public.board_automations;
CREATE TRIGGER board_automations_stamp
  BEFORE INSERT OR UPDATE ON public.board_automations
  FOR EACH ROW EXECUTE FUNCTION public.board_automations_stamp();

-- ── Scheduled automation: due date reminders ────────────────
-- Notifies assignees of unfinished tasks due today or tomorrow, once per
-- (user, task, due date). Runs hourly through pg_cron when available.
CREATE OR REPLACE FUNCTION public.send_due_date_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r        record;
  v_due    date;
  v_ids    uuid[];
  v_total  integer := 0;
BEGIN
  FOR r IN
    SELECT bi.id, bi.board_id, bi.title, bi.data, b.columns,
           public.board_column_key(b.columns, 'date')   AS date_key,
           public.board_column_key(b.columns, 'status') AS status_key
    FROM board_automations a
    JOIN boards b       ON b.id = a.board_id
    JOIN board_items bi ON bi.board_id = b.id
    WHERE a.recipe = 'due_date_reminder' AND a.enabled
  LOOP
    CONTINUE WHEN r.date_key IS NULL;
    v_due := public.try_date(r.data ->> r.date_key);
    CONTINUE WHEN v_due IS NULL OR v_due NOT IN (CURRENT_DATE, CURRENT_DATE + 1);
    CONTINUE WHEN r.status_key IS NOT NULL AND public.is_done_status(r.data -> r.status_key);

    v_ids := ARRAY(
      SELECT u
      FROM unnest(public.profile_ids_for_emails(public.item_assignee_emails(r.data, r.columns))) AS u
      WHERE NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = u AND n.item_id = r.id AND n.type = 'due_soon'
          AND n.data ->> 'due_date' = v_due::text
      )
    );
    CONTINUE WHEN cardinality(v_ids) = 0;

    v_total := v_total + public.notify_users(v_ids, r.board_id, r.id, NULL, 'due_soon',
      CASE WHEN v_due = CURRENT_DATE THEN 'Task due today' ELSE 'Task due tomorrow' END,
      r.title, jsonb_build_object('due_date', v_due::text));
  END LOOP;

  RETURN v_total;
END;
$$;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.ensure_actor_profile(uuid)',
    'public.log_activity(uuid, uuid, text, text, text, text)',
    'public.notify_users(uuid[], uuid, uuid, uuid, text, text, text, jsonb)',
    'public.try_date(text)',
    'public.boards_force_private()',
    'public.sync_board_visibility()',
    'public.board_items_check_refs()',
    'public.board_items_before_insert()',
    'public.board_items_after_insert()',
    'public.board_items_after_update()',
    'public.task_comments_after_insert()',
    'public.task_attachments_after_insert()',
    'public.board_automations_stamp()',
    'public.send_due_date_reminders()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;

-- Hourly reminder job. pg_cron is enabled when the role may do so; on
-- Supabase you can also enable it under Database → Extensions and re-run.
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'pg_cron unavailable (%); due date reminders stay off', SQLERRM;
  END;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    EXECUTE $cron$
      SELECT cron.schedule('taskapp-due-date-reminders', '0 * * * *',
                           'SELECT public.send_due_date_reminders()')
    $cron$;
  END IF;
END $$;


-- ============================================================
-- 10. STORAGE — private bucket task-attachments
-- ============================================================
-- Object keys: <board_id>/<item_id>/<uuid>_<filename>
--   read:   board owner or any active member
--   upload: board owner or active admin/editor, into an existing task
--           of that same board
--   change/delete: the uploader (while still an editor) or an admin
-- SVG is not accepted: it can carry script that runs when the signed
-- URL is opened directly.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-attachments',
  'task-attachments',
  false,
  10485760, -- 10 MB
  ARRAY[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
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

CREATE OR REPLACE FUNCTION public.item_id_from_object(_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF _name IS NULL OR _name !~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/' THEN
    RETURN NULL;
  END IF;
  RETURN split_part(_name, '/', 2)::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- Upload target must be a real task on the board named by the key.
CREATE OR REPLACE FUNCTION public.can_upload_board_object(_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT public.can_edit_board(bi.board_id)
    FROM board_items bi
    WHERE bi.id = public.item_id_from_object(_name)
      AND bi.board_id = public.board_id_from_object(_name)
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.can_admin_board_object(_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.can_admin_board(public.board_id_from_object(_name)), false);
$$;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.board_id_from_object(text)',
    'public.item_id_from_object(text)',
    'public.can_access_board_object(text)',
    'public.can_edit_board_object(text)',
    'public.can_upload_board_object(text)',
    'public.can_admin_board_object(text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "task_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "task_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "task_attachments_update" ON storage.objects;
DROP POLICY IF EXISTS "task_attachments_delete" ON storage.objects;

CREATE POLICY "task_attachments_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND public.can_access_board_object(name)
    AND (SELECT public.mfa_satisfied())
  );
CREATE POLICY "task_attachments_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND public.can_upload_board_object(name)
    AND (SELECT public.mfa_satisfied())
  );
CREATE POLICY "task_attachments_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND (public.can_admin_board_object(name)
         OR (owner = (SELECT auth.uid()) AND public.can_edit_board_object(name)))
    AND (SELECT public.mfa_satisfied())
  )
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND public.can_upload_board_object(name)
    AND (SELECT public.mfa_satisfied())
  );
CREATE POLICY "task_attachments_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'task-attachments'
    AND (public.can_admin_board_object(name)
         OR (owner = (SELECT auth.uid()) AND public.can_edit_board_object(name)))
    AND (SELECT public.mfa_satisfied())
  );


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
    'task_time_entries', 'board_automations'
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
-- DONE
-- ============================================================
