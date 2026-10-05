-- Trigger-written audit trail and cross-user notifications.
BEGIN;
SELECT plan(17);

SELECT tests.create_user('owner@test.dev')    AS owner_id    \gset
SELECT tests.create_user('editor@test.dev')   AS editor_id   \gset
SELECT tests.create_user('viewer@test.dev')   AS viewer_id   \gset
SELECT tests.create_user('outsider@test.dev') AS outsider_id \gset

INSERT INTO public.boards (user_id, title, columns, groups)
VALUES (:'owner_id', 'Launch', tests.default_columns(), '[{"id": "g1", "title": "Now"}]')
RETURNING id AS board_id \gset

INSERT INTO public.board_members (board_id, user_id, email, role, status) VALUES
  (:'board_id', :'editor_id', 'editor@test.dev', 'editor', 'active'),
  (:'board_id', :'viewer_id', 'viewer@test.dev', 'viewer', 'active');

-- ── Audit trail ─────────────────────────────────────────────
SELECT tests.authenticate_as(:'editor_id');

SELECT throws_ok(
  format($$INSERT INTO public.task_activity (item_id, user_id, action) VALUES (gen_random_uuid(), %L, 'created')$$,
         :'editor_id'),
  '42501', NULL,
  'the API cannot write audit entries directly');

INSERT INTO public.board_items (board_id, group_id, title, data)
VALUES (:'board_id', 'g1', 'Press kit', '{"status": "Not Started", "owner": []}')
RETURNING id AS item_id \gset

SELECT results_eq(
  format($$SELECT action, user_id, new_value FROM public.task_activity WHERE item_id = %L$$, :'item_id'),
  format($$VALUES ('created'::text, %L::uuid, 'Press kit'::text)$$, :'editor_id'),
  'creating a task is audited with the real actor');

UPDATE public.board_items
SET data = data || '{"status": "Working on it"}', title = 'Press kit v2'
WHERE id = :'item_id';

SELECT results_eq(
  format($$SELECT action, field_name, old_value, new_value FROM public.task_activity
           WHERE item_id = %L AND action <> 'created' ORDER BY field_name$$, :'item_id'),
  $$VALUES ('status_changed'::text, 'Status'::text, 'Not Started'::text, 'Working on it'::text),
           ('updated', 'Title', 'Press kit', 'Press kit v2')$$,
  'each changed field is audited with old and new values');

SELECT throws_ok(
  format($$UPDATE public.task_activity SET new_value = 'forged' WHERE item_id = %L$$, :'item_id'),
  '42501', NULL,
  'audit entries cannot be edited');

SELECT throws_ok(
  format($$DELETE FROM public.task_activity WHERE item_id = %L$$, :'item_id'),
  '42501', NULL,
  'audit entries cannot be deleted');

-- A reorder touches only order_index and is not audited.
SELECT public.reorder_board_items('g1', ARRAY[:'item_id']::uuid[]);
SELECT is(
  (SELECT count(*)::int FROM public.task_activity WHERE item_id = :'item_id'), 3,
  'reordering does not flood the audit trail');

-- Subtasks are recorded on the parent.
INSERT INTO public.board_items (board_id, group_id, title, parent_id)
VALUES (:'board_id', 'g1', 'Logo files', :'item_id');
SELECT is(
  (SELECT new_value FROM public.task_activity WHERE item_id = :'item_id' AND field_name = 'Subtask'),
  'Added: Logo files',
  'adding a subtask is audited on the parent');

-- ── Assignment notifications ────────────────────────────────
UPDATE public.board_items
SET data = data || '{"owner": ["viewer@test.dev", "outsider@test.dev", "editor@test.dev"]}'
WHERE id = :'item_id';

SELECT is(
  (SELECT count(*)::int FROM public.notifications WHERE user_id = :'viewer_id' AND type = 'assigned'), 0,
  'notifications for others are invisible to the actor');

SELECT tests.clear_authentication();

SELECT results_eq(
  format($$SELECT type, item_id, actor_id FROM public.notifications WHERE user_id = %L$$, :'viewer_id'),
  format($$VALUES ('assigned'::text, %L::uuid, %L::uuid)$$, :'item_id', :'editor_id'),
  'a newly assigned member is notified');

SELECT is_empty(
  format($$SELECT 1 FROM public.notifications WHERE user_id = %L$$, :'outsider_id'),
  'someone without board access is never notified');

SELECT is_empty(
  format($$SELECT 1 FROM public.notifications WHERE user_id = %L AND type = 'assigned'$$, :'editor_id'),
  'the actor is not notified about their own change');

SELECT is(
  (SELECT action FROM public.task_activity WHERE item_id = :'item_id' AND field_name = 'Owner'),
  'assigned',
  'assignment changes are audited as "assigned"');

-- ── Comments and mentions ───────────────────────────────────
SELECT tests.authenticate_as(:'owner_id');
INSERT INTO public.task_comments (item_id, user_id, content, mentioned_user_ids)
VALUES (:'item_id', :'owner_id', 'Ready for review?', ARRAY[:'editor_id', :'outsider_id']::uuid[]);

SELECT tests.clear_authentication();

SELECT is(
  (SELECT type FROM public.notifications WHERE user_id = :'editor_id' AND item_id = :'item_id'),
  'mention',
  'a mentioned member gets one "mention" notification');

SELECT is(
  (SELECT type FROM public.notifications WHERE user_id = :'viewer_id' AND type <> 'assigned'),
  'comment',
  'an assignee gets a "comment" notification');

SELECT is_empty(
  format($$SELECT 1 FROM public.notifications WHERE user_id = %L$$, :'outsider_id'),
  'mentioning someone outside the board notifies nobody');

SELECT is(
  (SELECT new_value FROM public.task_activity WHERE item_id = :'item_id' AND action = 'commented'),
  'Ready for review?',
  'comments are audited');

-- ── Invitation acceptance notifies the inviter ──────────────
SELECT tests.create_user('newbie@test.dev') AS newbie_id \gset
INSERT INTO public.board_members (board_id, email, role, status, token, invited_by)
VALUES (:'board_id', 'newbie@test.dev', 'viewer', 'pending', 'tok-newbie-000000000', :'owner_id');

SELECT tests.authenticate_as(:'newbie_id');
SELECT public.accept_board_invitation('tok-newbie-000000000');
SELECT tests.clear_authentication();

SELECT is(
  (SELECT count(*)::int FROM public.notifications WHERE user_id = :'owner_id' AND type = 'invite_accepted'), 1,
  'the inviter hears when an invitation is accepted');

SELECT * FROM finish();
ROLLBACK;
