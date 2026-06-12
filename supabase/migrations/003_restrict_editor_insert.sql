-- ============================================================
-- 003_restrict_editor_insert.sql
-- Restrict insert item policy: hanya admin yang bisa insert item
-- (sebelumnya admin DAN editor bisa insert)
-- ============================================================

-- Drop policy lama
DROP POLICY IF EXISTS "member_insert_items" ON board_items;

-- Buat policy baru: hanya admin yang bisa insert
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
