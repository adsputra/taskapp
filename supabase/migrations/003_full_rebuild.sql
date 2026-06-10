-- ============================================================
-- 003_full_rebuild.sql — FULL REBUILD (tables + sharing + RLS)
-- ============================================================
-- Cocok untuk: tabel boards, board_items, board_members SUDAH HAPUS.
-- Yang tersisa hanya: profiles, notifications.
-- ============================================================
-- Cara pakai: COPY-PASTE ke Supabase SQL Editor → RUN
-- ============================================================

-- ============================================================
-- 1. BUAT TABEL DULU (sebelum drop policy — karena tabel belum ada)
-- ============================================================

-- 1a. boards
CREATE TABLE IF NOT EXISTS boards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id);

-- 1b. board_items
CREATE TABLE IF NOT EXISTS board_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  group_id    TEXT NOT NULL,
  title       TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  data        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_items_board ON board_items(board_id);
CREATE INDEX IF NOT EXISTS idx_board_items_group ON board_items(board_id, group_id);
CREATE INDEX IF NOT EXISTS idx_board_items_order ON board_items(group_id, order_index);

-- 1c. board_members (TANPA RLS — aman dari circular dependency)
CREATE TABLE IF NOT EXISTS board_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'editor'
             CHECK (role IN ('admin', 'editor', 'viewer')),
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'active')),
  token      TEXT UNIQUE,
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_members_board ON board_members(board_id);
CREATE INDEX IF NOT EXISTS idx_board_members_user  ON board_members(user_id);
CREATE INDEX IF NOT EXISTS idx_board_members_email ON board_members(email);
CREATE INDEX IF NOT EXISTS idx_board_members_token ON board_members(token);

-- ============================================================
-- 2. DROP SISA POLICY LAMA (tabel sudah ada sekarang)
-- ============================================================
DROP POLICY IF EXISTS "select own profile" ON profiles;
DROP POLICY IF EXISTS "insert own profile" ON profiles;
DROP POLICY IF EXISTS "update own profile" ON profiles;
DROP POLICY IF EXISTS "select own boards" ON boards;
DROP POLICY IF EXISTS "insert own boards" ON boards;
DROP POLICY IF EXISTS "update own boards" ON boards;
DROP POLICY IF EXISTS "delete own boards" ON boards;
DROP POLICY IF EXISTS "all items via board owner" ON board_items;
DROP POLICY IF EXISTS "owner_select_boards" ON boards;
DROP POLICY IF EXISTS "owner_insert_boards" ON boards;
DROP POLICY IF EXISTS "owner_update_boards" ON boards;
DROP POLICY IF EXISTS "owner_delete_boards" ON boards;
DROP POLICY IF EXISTS "member_select_boards" ON boards;
DROP POLICY IF EXISTS "member_update_boards" ON boards;
DROP POLICY IF EXISTS "owner_all_items" ON board_items;
DROP POLICY IF EXISTS "member_select_items" ON board_items;
DROP POLICY IF EXISTS "member_insert_items" ON board_items;
DROP POLICY IF EXISTS "member_update_items" ON board_items;
DROP POLICY IF EXISTS "member_delete_items" ON board_items;

-- ============================================================
-- 3. UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_boards_updated_at ON boards;
CREATE TRIGGER update_boards_updated_at
  BEFORE UPDATE ON boards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_board_items_updated_at ON board_items;
CREATE TRIGGER update_board_items_updated_at
  BEFORE UPDATE ON board_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards      ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_items ENABLE ROW LEVEL SECURITY;

-- board_members & notifications: TIDAK pakai RLS
ALTER TABLE board_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. POLICIES
-- ============================================================

-- Profiles
CREATE POLICY "select own profile" ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "insert own profile" ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "update own profile" ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Boards — owner
CREATE POLICY "owner_select_boards" ON boards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "owner_insert_boards" ON boards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner_update_boards" ON boards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "owner_delete_boards" ON boards FOR DELETE
  USING (auth.uid() = user_id);

-- Boards — member SELECT (ngecek board_members — aman karena RLS mati)
CREATE POLICY "member_select_boards" ON boards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM board_members bm
      WHERE bm.board_id = boards.id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
    )
  );

-- Boards — member UPDATE (hanya admin)
CREATE POLICY "member_update_boards" ON boards FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM board_members bm
      WHERE bm.board_id = boards.id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
        AND bm.role = 'admin'
    )
  );

-- Board Items — owner ALL
CREATE POLICY "owner_all_items" ON board_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE id = board_items.board_id
        AND user_id = auth.uid()
    )
  );

-- Board Items — member SELECT
CREATE POLICY "member_select_items" ON board_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM board_members bm
      WHERE bm.board_id = board_items.board_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
    )
  );

-- Board Items — member INSERT & UPDATE (admin & editor)
CREATE POLICY "member_insert_items" ON board_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM board_members bm
      WHERE bm.board_id = board_items.board_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
        AND bm.role IN ('admin', 'editor')
    )
  );

CREATE POLICY "member_update_items" ON board_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM board_members bm
      WHERE bm.board_id = board_items.board_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
        AND bm.role IN ('admin', 'editor')
    )
  );

CREATE POLICY "member_delete_items" ON board_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM board_members bm
      WHERE bm.board_id = board_items.board_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
        AND bm.role = 'admin'
    )
  );

-- ============================================================
-- SELESAI
-- ============================================================
