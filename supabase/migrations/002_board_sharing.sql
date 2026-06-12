-- ============================================================
-- 002_board_sharing.sql — Multi-user board sharing (FIXED v3)
-- ============================================================
-- Cara pakai:
--   1. Buka Supabase Dashboard → SQL Editor
--   2. Paste seluruh file ini dan RUN
--   3. Kalau masih error "infinite recursion", RUN file ini LAGI
-- ===========================================================

-- ============================================================
-- 0. HAPUS SEMUA SISA PERCOBAAN SEBELUMNYA
-- ============================================================
-- Hapus trigger & function (kalau ada dari migrasi pertama yang error)
DROP TRIGGER IF EXISTS trg_board_members_after_insert ON boards;
DROP TRIGGER IF EXISTS trg_board_members_owner ON boards;
DROP FUNCTION IF EXISTS fn_auto_add_board_owner();
DROP FUNCTION IF EXISTS fn_add_owner_to_members();

-- Hapus policy lama
DROP POLICY IF EXISTS "select own boards"        ON boards;
DROP POLICY IF EXISTS "insert own boards"        ON boards;
DROP POLICY IF EXISTS "update own boards"        ON boards;
DROP POLICY IF EXISTS "delete own boards"        ON boards;
DROP POLICY IF EXISTS "all items via board owner" ON board_items;

DROP POLICY IF EXISTS "owner_all_boards"          ON boards;
DROP POLICY IF EXISTS "member_select_boards"      ON boards;
DROP POLICY IF EXISTS "member_update_boards"      ON boards;
DROP POLICY IF EXISTS "member_delete_boards"      ON boards;
DROP POLICY IF EXISTS "owner_all_items"           ON board_items;
DROP POLICY IF EXISTS "member_select_items"       ON board_items;
DROP POLICY IF EXISTS "member_insert_items"       ON board_items;
DROP POLICY IF EXISTS "member_update_items"       ON board_items;
DROP POLICY IF EXISTS "member_delete_items"       ON board_items;

-- Hapus policy di board_members kalau ada sisa dari percobaan sebelumnya
DROP POLICY IF EXISTS "member_access_board_members" ON board_members;
DROP POLICY IF EXISTS "select own board_members"     ON board_members;
DROP POLICY IF EXISTS "insert own board_members"     ON board_members;

-- ============================================================
-- 1. BUAT / UPDATE TABEL board_members
-- ============================================================
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

-- Tambah kolom yang mungkin belum ada (dari tabel yang sudah terlanjur dibuat)
ALTER TABLE board_members ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_board_members_board ON board_members(board_id);
CREATE INDEX IF NOT EXISTS idx_board_members_user  ON board_members(user_id);
CREATE INDEX IF NOT EXISTS idx_board_members_email ON board_members(email);
CREATE INDEX IF NOT EXISTS idx_board_members_token ON board_members(token);

-- ============================================================
-- 2. DISABLE RLS di board_members — PASTIIN OFF
-- ============================================================
-- Ini KRUSIAL. Kalau RLS nyala di board_members, dia akan
-- trigger circular dependency dengan boards.
ALTER TABLE board_members DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. TABEL: notifications (kalau belum ada)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  message    TEXT,
  type       TEXT DEFAULT 'info',
  read       BOOLEAN NOT NULL DEFAULT false,
  data       JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RE-ENABLE RLS di tables utama (kalau mati)
-- ============================================================
ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards      ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. BUAT POLICY BARU (TANPA circular dependency)
-- ============================================================

-- Profiles (tetap sama)
DROP POLICY IF EXISTS "select own profile" ON profiles;
DROP POLICY IF EXISTS "insert own profile" ON profiles;
DROP POLICY IF EXISTS "update own profile" ON profiles;
CREATE POLICY "select own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Boards policies
-- Policy 1: Owner bisa ALL (select, insert, update, delete)
-- ⚠️ PISAHKAN SELECT dan INSERT/UPDATE/DELETE biar gak konflik
CREATE POLICY "owner_select_boards" ON boards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "owner_insert_boards" ON boards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner_update_boards" ON boards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "owner_delete_boards" ON boards FOR DELETE
  USING (auth.uid() = user_id);

-- Policy 2: Member (active) bisa SELECT — subquery ke board_members
-- Aman karena board_members TIDAK punya RLS
CREATE POLICY "member_select_boards" ON boards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM board_members bm
      WHERE bm.board_id = boards.id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
    )
  );

-- Board Items policies
CREATE POLICY "owner_all_items" ON board_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM boards
      WHERE id = board_items.board_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "member_select_items" ON board_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM board_members bm
      WHERE bm.board_id = board_items.board_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
    )
  );

CREATE POLICY "member_insert_items" ON board_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM board_members bm
      WHERE bm.board_id = board_items.board_id
        AND bm.user_id = auth.uid()
        AND bm.status = 'active'
        AND bm.role = 'admin'
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
-- 6. INSERT owner ke board_members (untuk board yang SUDAH ADA)
-- ============================================================
INSERT INTO board_members (board_id, user_id, email, role, status)
SELECT
  b.id,
  b.user_id,
  p.email,
  'admin',
  'active'
FROM boards b
JOIN profiles p ON p.id = b.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM board_members bm
  WHERE bm.board_id = b.id AND bm.user_id = b.user_id
);

-- ============================================================
-- 7. TES: Verifikasi tidak ada infinite recursion
-- ============================================================
-- Coba SELECT — kalau error, berarti masih ada masalah
-- SELECT count(*) FROM boards LIMIT 1;
-- SELECT count(*) FROM board_members LIMIT 1;

-- ============================================================
-- SELESAI
-- ============================================================
