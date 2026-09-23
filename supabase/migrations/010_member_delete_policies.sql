-- ============================================================
-- 010_member_delete_policies.sql
-- ============================================================
-- Adds missing DELETE policies so members can delete their own
-- comments and time tracking entries.
-- ============================================================

-- 1. task_time_entries: allow users to delete their own time entries
DROP POLICY IF EXISTS "member_delete_own_time_entries" ON task_time_entries;
CREATE POLICY "member_delete_own_time_entries" ON task_time_entries FOR DELETE
  USING (user_id = auth.uid());

-- 2. task_comments: allow authors to delete their own comments
DROP POLICY IF EXISTS "member_delete_own_comments" ON task_comments;
CREATE POLICY "member_delete_own_comments" ON task_comments FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- SELESAI
-- ============================================================
