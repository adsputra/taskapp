-- ============================================================
-- 011_enable_realtime.sql
-- ============================================================
-- Enables Supabase Realtime publication for boards, board_items,
-- and board_members so changes are broadcast to subscribed clients.
-- ============================================================

DO $$
BEGIN
  -- 1. board_items
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'board_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE board_items;
  END IF;

  -- 2. boards
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'boards'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE boards;
  END IF;

  -- 3. board_members
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'board_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE board_members;
  END IF;
END $$;

-- Set replica identity to FULL so that DELETE/UPDATE payloads include complete row details
ALTER TABLE board_items REPLICA IDENTITY FULL;
ALTER TABLE boards REPLICA IDENTITY FULL;
