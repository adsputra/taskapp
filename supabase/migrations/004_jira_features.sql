-- ============================================================
-- 004_jira_features.sql — JIRA-LEVEL FEATURES
-- ============================================================
-- Builds on top of 003_full_rebuild.sql
-- Adds: comments, activity log, attachments, time tracking,
--        sprints, subtasks, dependencies, task descriptions
-- ============================================================

-- ============================================================
-- 1. SPRINTS (create first — board_items FK references it)
-- ============================================================
CREATE TABLE IF NOT EXISTS sprints (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'planning'
              CHECK (status IN ('planning', 'active', 'completed')),
  start_date  DATE,
  end_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sprints_board ON sprints(board_id);

-- ============================================================
-- 2. MODIFY board_items — add description, subtasks, sprint, etc.
-- ============================================================
ALTER TABLE board_items
  ADD COLUMN IF NOT EXISTS description     TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS parent_id       UUID REFERENCES board_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sprint_id       UUID REFERENCES sprints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS story_points    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimate_minutes INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_board_items_parent ON board_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_board_items_sprint ON board_items(sprint_id);

-- ============================================================
-- 3. TASK COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS task_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID NOT NULL REFERENCES board_items(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_item ON task_comments(item_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user ON task_comments(user_id);

-- ============================================================
-- 4. TASK ACTIVITY LOG (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS task_activity (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID NOT NULL REFERENCES board_items(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action      TEXT NOT NULL DEFAULT 'updated'
              CHECK (action IN ('created', 'updated', 'deleted', 'commented', 'attached', 'status_changed', 'assigned')),
  field_name  TEXT,
  old_value   TEXT,
  new_value   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_activity_item ON task_activity(item_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_user ON task_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_created ON task_activity(created_at DESC);

-- ============================================================
-- 5. TASK ATTACHMENTS (file metadata — files in Supabase Storage)
-- ============================================================
CREATE TABLE IF NOT EXISTS task_attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     UUID NOT NULL REFERENCES board_items(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  file_size   INTEGER DEFAULT 0,
  file_type   TEXT DEFAULT 'application/octet-stream',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_item ON task_attachments(item_id);

-- ============================================================
-- 6. TASK TIME ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS task_time_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id           UUID NOT NULL REFERENCES board_items(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  duration_minutes  INTEGER NOT NULL DEFAULT 0,
  description       TEXT DEFAULT '',
  date              DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_time_entries_item ON task_time_entries(item_id);
CREATE INDEX IF NOT EXISTS idx_task_time_entries_user ON task_time_entries(user_id);

-- ============================================================
-- 7. TASK DEPENDENCIES
-- ============================================================
CREATE TABLE IF NOT EXISTS task_dependencies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_item_id  UUID NOT NULL REFERENCES board_items(id) ON DELETE CASCADE,
  target_item_id  UUID NOT NULL REFERENCES board_items(id) ON DELETE CASCADE,
  dep_type        TEXT NOT NULL DEFAULT 'blocks'
                  CHECK (dep_type IN ('blocks', 'blocked_by')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_item_id, target_item_id, dep_type)
);

CREATE INDEX IF NOT EXISTS idx_task_deps_source ON task_dependencies(source_item_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_target ON task_dependencies(target_item_id);

-- ============================================================
-- 8. UPDATED_AT TRIGGERS (for new tables that have updated_at)
-- ============================================================
-- Reuse the function from 003_full_rebuild:
-- CREATE OR REPLACE FUNCTION update_updated_at() ...

DROP TRIGGER IF EXISTS update_sprints_updated_at ON sprints;
CREATE TRIGGER update_sprints_updated_at
  BEFORE UPDATE ON sprints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_task_comments_updated_at ON task_comments;
CREATE TRIGGER update_task_comments_updated_at
  BEFORE UPDATE ON task_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE sprints            ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activity      ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_time_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 10. RLS POLICIES — follow same pattern as board_items:
--     owner can do ALL, members can SELECT, admin/editor can INSERT/UPDATE
-- ============================================================

-- Helper: check if user is board owner
-- Helper: check if user is active member with role IN (...)

-- ── SPRINTS ──────────────────────────────────────────────────

-- Owner: ALL
CREATE POLICY "owner_all_sprints" ON sprints FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE id = sprints.board_id AND user_id = auth.uid()
    )
  );

-- Member: SELECT
CREATE POLICY "member_select_sprints" ON sprints FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM board_members bm
      WHERE bm.board_id = sprints.board_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
    )
  );

-- Member (admin): INSERT & UPDATE
CREATE POLICY "member_insert_sprints" ON sprints FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM board_members bm
      WHERE bm.board_id = sprints.board_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
        AND bm.role = 'admin'
    )
  );

CREATE POLICY "member_update_sprints" ON sprints FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM board_members bm
      WHERE bm.board_id = sprints.board_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
        AND bm.role = 'admin'
    )
  );

-- ── TASK COMMENTS ────────────────────────────────────────────

-- Helper: resolve board_id from item_id
-- Owner: ALL
CREATE POLICY "owner_all_comments" ON task_comments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM board_items bi
      JOIN boards b ON b.id = bi.board_id
      WHERE bi.id = task_comments.item_id AND b.user_id = auth.uid()
    )
  );

-- Member: SELECT
CREATE POLICY "member_select_comments" ON task_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM board_items bi
      JOIN board_members bm ON bm.board_id = bi.board_id
      WHERE bi.id = task_comments.item_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
    )
  );

-- Member (admin, editor): INSERT & UPDATE own comments
CREATE POLICY "member_insert_comments" ON task_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM board_items bi
      JOIN board_members bm ON bm.board_id = bi.board_id
      WHERE bi.id = task_comments.item_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
        AND bm.role IN ('admin', 'editor')
    )
  );

CREATE POLICY "member_update_own_comments" ON task_comments FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM board_items bi
      JOIN board_members bm ON bm.board_id = bi.board_id
      WHERE bi.id = task_comments.item_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
    )
  );

-- Admin: DELETE any comment
CREATE POLICY "admin_delete_comments" ON task_comments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM board_items bi
      JOIN board_members bm ON bm.board_id = bi.board_id
      WHERE bi.id = task_comments.item_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
        AND bm.role = 'admin'
    )
  );

-- ── TASK ACTIVITY ────────────────────────────────────────────
-- Activity is append-only (INSERT + SELECT), no UPDATE/DELETE

-- Owner: SELECT + INSERT
CREATE POLICY "owner_select_activity" ON task_activity FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM board_items bi
      JOIN boards b ON b.id = bi.board_id
      WHERE bi.id = task_activity.item_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "owner_insert_activity" ON task_activity FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM board_items bi
      JOIN boards b ON b.id = bi.board_id
      WHERE bi.id = task_activity.item_id AND b.user_id = auth.uid()
    )
  );

-- Member: SELECT
CREATE POLICY "member_select_activity" ON task_activity FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM board_items bi
      JOIN board_members bm ON bm.board_id = bi.board_id
      WHERE bi.id = task_activity.item_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
    )
  );

-- Member (admin, editor): INSERT
CREATE POLICY "member_insert_activity" ON task_activity FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM board_items bi
      JOIN board_members bm ON bm.board_id = bi.board_id
      WHERE bi.id = task_activity.item_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
        AND bm.role IN ('admin', 'editor')
    )
  );

-- ── TASK ATTACHMENTS ─────────────────────────────────────────

-- Owner: ALL
CREATE POLICY "owner_all_attachments" ON task_attachments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM board_items bi
      JOIN boards b ON b.id = bi.board_id
      WHERE bi.id = task_attachments.item_id AND b.user_id = auth.uid()
    )
  );

-- Member: SELECT
CREATE POLICY "member_select_attachments" ON task_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM board_items bi
      JOIN board_members bm ON bm.board_id = bi.board_id
      WHERE bi.id = task_attachments.item_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
    )
  );

-- Member (admin, editor): INSERT
CREATE POLICY "member_insert_attachments" ON task_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM board_items bi
      JOIN board_members bm ON bm.board_id = bi.board_id
      WHERE bi.id = task_attachments.item_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
        AND bm.role IN ('admin', 'editor')
    )
  );

-- Uploader or admin: DELETE
CREATE POLICY "owner_or_admin_delete_attachments" ON task_attachments FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM board_items bi
      JOIN board_members bm ON bm.board_id = bi.board_id
      WHERE bi.id = task_attachments.item_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
        AND bm.role = 'admin'
    )
  );

-- ── TASK TIME ENTRIES ────────────────────────────────────────

-- Owner: ALL
CREATE POLICY "owner_all_time_entries" ON task_time_entries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM board_items bi
      JOIN boards b ON b.id = bi.board_id
      WHERE bi.id = task_time_entries.item_id AND b.user_id = auth.uid()
    )
  );

-- Member: SELECT
CREATE POLICY "member_select_time_entries" ON task_time_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM board_items bi
      JOIN board_members bm ON bm.board_id = bi.board_id
      WHERE bi.id = task_time_entries.item_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
    )
  );

-- Member (admin, editor): INSERT & UPDATE own entries
CREATE POLICY "member_insert_time_entries" ON task_time_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM board_items bi
      JOIN board_members bm ON bm.board_id = bi.board_id
      WHERE bi.id = task_time_entries.item_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
        AND bm.role IN ('admin', 'editor')
    )
  );

CREATE POLICY "member_update_own_time_entries" ON task_time_entries FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM board_items bi
      JOIN board_members bm ON bm.board_id = bi.board_id
      WHERE bi.id = task_time_entries.item_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
    )
  );

-- ── TASK DEPENDENCIES ────────────────────────────────────────

-- Owner: ALL
CREATE POLICY "owner_all_dependencies" ON task_dependencies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM board_items bi
      JOIN boards b ON b.id = bi.board_id
      WHERE bi.id = task_dependencies.source_item_id AND b.user_id = auth.uid()
    )
  );

-- Member: SELECT
CREATE POLICY "member_select_dependencies" ON task_dependencies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM board_items bi
      JOIN board_members bm ON bm.board_id = bi.board_id
      WHERE bi.id = task_dependencies.source_item_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
    )
  );

-- Member (admin): INSERT & DELETE
CREATE POLICY "member_insert_dependencies" ON task_dependencies FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM board_items bi
      JOIN board_members bm ON bm.board_id = bi.board_id
      WHERE bi.id = task_dependencies.source_item_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
        AND bm.role = 'admin'
    )
  );

CREATE POLICY "member_delete_dependencies" ON task_dependencies FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM board_items bi
      JOIN board_members bm ON bm.board_id = bi.board_id
      WHERE bi.id = task_dependencies.source_item_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
        AND bm.role = 'admin'
    )
  );

-- ============================================================
-- 7. NOTIFICATIONS (extend existing table)
-- ============================================================
-- Add new columns to existing notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES boards(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES board_items(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_board ON notifications(board_id);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (avoid conflicts)
DROP POLICY IF EXISTS "user_select_own_notifications" ON notifications;
DROP POLICY IF EXISTS "user_update_own_notifications" ON notifications;
DROP POLICY IF EXISTS "user_delete_own_notifications" ON notifications;
DROP POLICY IF EXISTS "auth_insert_notifications" ON notifications;

-- Users can only see their own notifications
CREATE POLICY "user_select_own_notifications" ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "user_update_own_notifications" ON notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "user_delete_own_notifications" ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- Allow authenticated users to insert notifications (for triggers)
CREATE POLICY "auth_insert_notifications" ON notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- SELESAI
-- ============================================================
