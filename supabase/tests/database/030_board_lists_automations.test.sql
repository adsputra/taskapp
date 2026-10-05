-- Atomic column/group edits, cross-board references, automations, search.
BEGIN;
SELECT plan(21);

SELECT tests.create_user('owner@test.dev')    AS owner_id    \gset
SELECT tests.create_user('editor@test.dev')   AS editor_id   \gset
SELECT tests.create_user('outsider@test.dev') AS outsider_id \gset

INSERT INTO public.boards (user_id, title, columns, groups)
VALUES (:'owner_id', 'Sprint board', tests.default_columns(),
        '[{"id": "g1", "title": "Now"}, {"id": "g2", "title": "Later"}]')
RETURNING id AS board_id \gset

INSERT INTO public.board_members (board_id, user_id, email, role, status)
VALUES (:'board_id', :'editor_id', 'editor@test.dev', 'editor', 'active');

-- A board the editor cannot see.
INSERT INTO public.boards (user_id, title, columns, groups)
VALUES (:'outsider_id', 'Secret', tests.default_columns(), '[{"id": "g1", "title": "Now"}]')
RETURNING id AS secret_board_id \gset
INSERT INTO public.board_items (board_id, group_id, title)
VALUES (:'secret_board_id', 'g1', 'Secret plan') RETURNING id AS secret_item_id \gset
INSERT INTO public.sprints (board_id, title)
VALUES (:'secret_board_id', 'Secret sprint') RETURNING id AS secret_sprint_id \gset

-- ── board_patch_list ────────────────────────────────────────
SELECT tests.authenticate_as(:'owner_id');

SELECT public.board_patch_list(:'board_id', 'columns', 'add', 'budget', '{"title": "Budget", "type": "number"}');
SELECT public.board_patch_list(:'board_id', 'columns', 'add', 'tags', '{"title": "Tags", "type": "tags"}');
SELECT is(
  (SELECT jsonb_path_query_array(columns, '$[*].id') FROM public.boards WHERE id = :'board_id'),
  '["task", "status", "owner", "due_date", "budget", "tags"]'::jsonb,
  'consecutive column additions are both kept, in order');

SELECT throws_ok(
  format($$SELECT public.board_patch_list(%L, 'columns', 'add', 'budget', '{"title": "Again"}')$$, :'board_id'),
  '23505', NULL,
  'a duplicate column id is rejected');

SELECT public.board_patch_list(:'board_id', 'columns', 'update', 'budget', '{"title": "Cost", "id": "hijack"}');
SELECT is(
  (SELECT c FROM public.boards b, jsonb_array_elements(b.columns) c WHERE b.id = :'board_id' AND c ->> 'id' = 'budget'),
  '{"id": "budget", "title": "Cost", "type": "number"}'::jsonb,
  'an update merges fields and cannot change the id');

SELECT public.board_patch_list(:'board_id', 'columns', 'delete', 'tags');
SELECT is(
  (SELECT jsonb_array_length(columns) FROM public.boards WHERE id = :'board_id'), 5,
  'a column can be deleted');

SELECT throws_ok(
  format($$SELECT public.board_patch_list(%L, 'title', 'add', 'x', '{}')$$, :'board_id'),
  '22023', NULL,
  'only columns and groups can be patched');

-- Deleting a group removes its tasks in the same transaction.
INSERT INTO public.board_items (board_id, group_id, title) VALUES
  (:'board_id', 'g2', 'Later 1'), (:'board_id', 'g2', 'Later 2'), (:'board_id', 'g1', 'Now 1');
SELECT public.board_patch_list(:'board_id', 'groups', 'delete', 'g2');
SELECT results_eq(
  format($$SELECT title FROM public.board_items WHERE board_id = %L ORDER BY title$$, :'board_id'),
  $$VALUES ('Now 1'::text)$$,
  'deleting a group deletes its tasks');

SELECT tests.authenticate_as(:'editor_id');
SELECT throws_ok(
  format($$SELECT public.board_patch_list(%L, 'columns', 'add', 'x', '{"title": "X"}')$$, :'board_id'),
  '42501', NULL,
  'editors cannot change the board layout');

SELECT tests.authenticate_as(:'outsider_id');
SELECT throws_ok(
  format($$SELECT public.board_patch_list(%L, 'groups', 'delete', 'g1')$$, :'board_id'),
  '42501', NULL,
  'outsiders cannot change the board layout');

-- ── Cross-board references ──────────────────────────────────
SELECT tests.authenticate_as(:'editor_id');
SELECT id AS now_item_id FROM public.board_items WHERE board_id = :'board_id' AND title = 'Now 1' \gset

SELECT throws_ok(
  format($$UPDATE public.board_items SET parent_id = %L WHERE id = %L$$, :'secret_item_id', :'now_item_id'),
  '23514', NULL,
  'a task cannot be parented to a task on another board');

SELECT throws_ok(
  format($$UPDATE public.board_items SET sprint_id = %L WHERE id = %L$$, :'secret_sprint_id', :'now_item_id'),
  '23514', NULL,
  'a task cannot join a sprint of another board');

SELECT throws_ok(
  format($$UPDATE public.board_items SET parent_id = %L WHERE id = %L$$, :'now_item_id', :'now_item_id'),
  '23514', NULL,
  'a task cannot be its own parent');

-- ── Automations ─────────────────────────────────────────────
SELECT throws_ok(
  format($$SELECT public.set_board_automation(%L, 'assign_creator', true)$$, :'board_id'),
  '42501', NULL,
  'editors cannot change automations');

SELECT tests.authenticate_as(:'owner_id');
SELECT lives_ok(
  format($$SELECT public.set_board_automation(%L, 'assign_creator', true)$$, :'board_id'),
  'admins can enable an automation');
SELECT is(
  (SELECT updated_by FROM public.board_automations WHERE board_id = :'board_id' AND recipe = 'assign_creator'),
  :'owner_id'::uuid,
  'automation changes are stamped with the real actor');

SELECT public.set_board_automation(:'board_id', 'subitems_done_parent', true);
SELECT public.set_board_automation(:'board_id', 'notify_owner_on_done', true);
SELECT public.set_board_automation(:'board_id', 'notify_status_change', true);

SELECT tests.authenticate_as(:'editor_id');
INSERT INTO public.board_items (board_id, group_id, title, data)
VALUES (:'board_id', 'g1', 'Parent', '{"status": "Working on it"}')
RETURNING id AS parent_id \gset

SELECT is(
  (SELECT data -> 'owner' FROM public.board_items WHERE id = :'parent_id'),
  '["editor@test.dev"]'::jsonb,
  'assign_creator assigns the creator to an unassigned task');

INSERT INTO public.board_items (board_id, group_id, title, parent_id, data) VALUES
  (:'board_id', 'g1', 'Child A', :'parent_id', '{"status": "Not Started"}'),
  (:'board_id', 'g1', 'Child B', :'parent_id', '{"status": "Not Started"}');

UPDATE public.board_items SET data = data || '{"status": "Done"}'
WHERE parent_id = :'parent_id' AND title = 'Child A';
SELECT is(
  (SELECT data ->> 'status' FROM public.board_items WHERE id = :'parent_id'), 'Working on it',
  'the parent stays open while a subtask is unfinished');

UPDATE public.board_items SET data = data || '{"status": "Done"}'
WHERE parent_id = :'parent_id' AND title = 'Child B';
SELECT is(
  (SELECT data ->> 'status' FROM public.board_items WHERE id = :'parent_id'), 'Done',
  'subitems_done_parent closes the parent when every subtask is done');

SELECT tests.clear_authentication();
SELECT is(
  (SELECT count(*)::int FROM public.notifications
   WHERE user_id = :'owner_id' AND type = 'task_done' AND item_id = :'parent_id'), 1,
  'notify_owner_on_done tells the owner when the parent is completed');

-- ── Due date reminders ──────────────────────────────────────
SELECT public.set_board_automation(:'board_id', 'due_date_reminder', true);
UPDATE public.board_items
SET data = data || jsonb_build_object('due_date', to_char(CURRENT_DATE + 1, 'YYYY-MM-DD'), 'status', 'Working on it')
WHERE id = :'now_item_id';
UPDATE public.board_items SET data = data || '{"owner": ["editor@test.dev"]}' WHERE id = :'now_item_id';

SELECT public.send_due_date_reminders();
SELECT public.send_due_date_reminders();
SELECT is(
  (SELECT count(*)::int FROM public.notifications WHERE user_id = :'editor_id' AND type = 'due_soon'), 1,
  'assignees are reminded once about a task due tomorrow');

-- ── Search ──────────────────────────────────────────────────
SELECT tests.authenticate_as(:'editor_id');
SELECT is(
  (SELECT jsonb_array_length(public.search_workspace('secret') -> 'items')), 0,
  'search never returns tasks from boards the caller cannot read');
SELECT is(
  (SELECT public.search_workspace('now 1') -> 'items' -> 0 ->> 'title'), 'Now 1',
  'search finds readable tasks case-insensitively');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
