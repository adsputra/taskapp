-- ============================================================
-- Tuesday.com — Database Schema (JWT + Supabase Auth)
-- ============================================================
-- Cara pakai:
--   1. Buka Supabase Dashboard → SQL Editor
--   2. Paste seluruh file ini dan RUN
--   3. Semua tabel, index, trigger, dan RLS akan dibuat
-- ============================================================

-- ============================================================
-- 1. HAPUS OBJEK LAMA
-- ============================================================
DROP TRIGGER IF EXISTS update_board_items_updated_at ON board_items;
DROP TRIGGER IF EXISTS update_boards_updated_at ON boards;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP FUNCTION IF EXISTS update_updated_at;
DROP FUNCTION IF EXISTS handle_new_user;

DROP TABLE IF EXISTS board_items CASCADE;
DROP TABLE IF EXISTS board_groups CASCADE;
DROP TABLE IF EXISTS board_columns CASCADE;
DROP TABLE IF EXISTS boards CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================================
-- 2. TABEL: profiles
-- ============================================================
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  email       TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. TABEL: boards  (columns & groups disimpan sebagai JSONB)
-- ============================================================
CREATE TABLE boards (
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

-- ============================================================
-- 4. TABEL: board_items
-- ============================================================
-- group_id adalah string (id group dari JSONB boards.groups),
-- BUKAN foreign key ke tabel terpisah.
CREATE TABLE board_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  group_id    TEXT NOT NULL,
  title       TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  data        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. INDEXES
-- ============================================================
CREATE INDEX idx_profiles_email    ON profiles(email);
CREATE INDEX idx_boards_user_id    ON boards(user_id);
CREATE INDEX idx_board_items_board ON board_items(board_id);
CREATE INDEX idx_board_items_group ON board_items(board_id, group_id);
CREATE INDEX idx_board_items_order ON board_items(group_id, order_index);

-- ============================================================
-- 6. AUTO-UPDATE updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_boards_updated_at
  BEFORE UPDATE ON boards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_board_items_updated_at
  BEFORE UPDATE ON board_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards      ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_items ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "select own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Boards
CREATE POLICY "select own boards"  ON boards FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "insert own boards"  ON boards FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own boards"  ON boards FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "delete own boards"  ON boards FOR DELETE  USING (auth.uid() = user_id);

-- Board Items (akses via board ownership)
CREATE POLICY "all items via board owner" ON board_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE id = board_items.board_id
      AND user_id = auth.uid()
    )
  );

-- ============================================================
-- SELESAI
-- ============================================================
