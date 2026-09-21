-- ============================================================
-- 009_analytics_rpc.sql
-- ============================================================
-- Server-side aggregation for the Analytics page.
-- Replaces fetching up to 1000 tasks into the browser and
-- computing everything in JS.
--
-- SECURITY INVOKER → RLS on boards/board_items still applies,
-- so it only aggregates rows the caller can see.
-- ============================================================

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

REVOKE ALL ON FUNCTION public.get_analytics(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_analytics(uuid, integer) TO authenticated;

-- ============================================================
-- SELESAI
-- ============================================================
