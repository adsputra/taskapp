-- Board roles, RLS and column privileges.
BEGIN;
SELECT plan(22);

-- ── Fixtures ────────────────────────────────────────────────
SELECT tests.create_user('owner@test.dev')    AS owner_id    \gset
SELECT tests.create_user('admin@test.dev')    AS admin_id    \gset
SELECT tests.create_user('editor@test.dev')   AS editor_id   \gset
SELECT tests.create_user('viewer@test.dev')   AS viewer_id   \gset
SELECT tests.create_user('outsider@test.dev') AS outsider_id \gset

-- The owner creates a board through the API role; the client asks for
-- 'shared' but a new board is always private.
SELECT tests.authenticate_as(:'owner_id');
INSERT INTO public.boards (user_id, title, visibility, columns, groups)
VALUES (:'owner_id', 'Roadmap', 'shared', tests.default_columns(), '[{"id": "g1", "title": "Now"}]')
RETURNING id AS board_id \gset

SELECT is((SELECT visibility FROM public.boards WHERE id = :'board_id'), 'private',
  'a new board starts private whatever the client sends');

INSERT INTO public.board_members (board_id, email, role, status, token, invited_by)
VALUES (:'board_id', 'admin@test.dev', 'admin', 'pending', 'tok-admin-0000000000', :'owner_id');

SELECT is((SELECT visibility FROM public.boards WHERE id = :'board_id'), 'shared',
  'inviting someone makes the board shared');

SELECT throws_ok(
  format($$INSERT INTO public.board_members (board_id, email, role, status, user_id, token, invited_by)
           VALUES (%L, 'x@test.dev', 'admin', 'active', %L, 'tok-x-00000000000000', %L)$$,
         :'board_id', :'outsider_id', :'owner_id'),
  '42501', NULL,
  'the API cannot create an already-active membership');

SELECT throws_ok(
  format($$UPDATE public.boards SET visibility = 'private' WHERE id = %L$$, :'board_id'),
  '42501', NULL,
  'visibility cannot be written through the API');

SELECT tests.clear_authentication();

-- Activate memberships the way accept_board_invitation() would.
UPDATE public.board_members SET user_id = :'admin_id', status = 'active', token = NULL
WHERE board_id = :'board_id' AND email = 'admin@test.dev';
INSERT INTO public.board_members (board_id, user_id, email, role, status) VALUES
  (:'board_id', :'editor_id', 'editor@test.dev', 'editor', 'active'),
  (:'board_id', :'viewer_id', 'viewer@test.dev', 'viewer', 'active');

-- ── Outsider ────────────────────────────────────────────────
SELECT tests.authenticate_as(:'outsider_id');
SELECT is_empty(format('SELECT 1 FROM public.boards WHERE id = %L', :'board_id'),
  'an outsider cannot see the board');
SELECT throws_ok(
  format($$INSERT INTO public.board_items (board_id, group_id, title) VALUES (%L, 'g1', 'x')$$, :'board_id'),
  '42501', NULL,
  'an outsider cannot add tasks');

-- ── Viewer ──────────────────────────────────────────────────
SELECT tests.authenticate_as(:'viewer_id');
SELECT isnt_empty(format('SELECT 1 FROM public.boards WHERE id = %L', :'board_id'),
  'a viewer can see the board');
SELECT throws_ok(
  format($$INSERT INTO public.board_items (board_id, group_id, title) VALUES (%L, 'g1', 'x')$$, :'board_id'),
  '42501', NULL,
  'a viewer cannot add tasks');

-- ── Editor ──────────────────────────────────────────────────
SELECT tests.authenticate_as(:'editor_id');
SELECT lives_ok(
  format($$INSERT INTO public.board_items (board_id, group_id, title) VALUES (%L, 'g1', 'Write spec')$$, :'board_id'),
  'an editor can add tasks');

SELECT tests.clear_authentication();
SELECT id AS item_id FROM public.board_items WHERE board_id = :'board_id' AND title = 'Write spec' \gset

SELECT tests.authenticate_as(:'editor_id');
UPDATE public.board_items SET title = 'Write the spec' WHERE id = :'item_id';
SELECT is((SELECT title FROM public.board_items WHERE id = :'item_id'), 'Write the spec',
  'an editor can edit tasks');

DELETE FROM public.board_items WHERE id = :'item_id';
SELECT isnt_empty(format('SELECT 1 FROM public.board_items WHERE id = %L', :'item_id'),
  'an editor cannot delete tasks');

-- RLS filters the row silently, so assert on the result.
UPDATE public.boards SET title = 'Hijacked' WHERE id = :'board_id';
SELECT is((SELECT title FROM public.boards WHERE id = :'board_id'), 'Roadmap',
  'an editor cannot change board settings');

SELECT throws_ok(
  format($$UPDATE public.board_items SET board_id = gen_random_uuid() WHERE id = %L$$, :'item_id'),
  '42501', NULL,
  'tasks cannot be moved to another board through the API');

-- ── Viewer cannot edit ──────────────────────────────────────
SELECT tests.authenticate_as(:'viewer_id');
UPDATE public.board_items SET title = 'Viewer edit' WHERE id = :'item_id';
SELECT tests.clear_authentication();
SELECT is((SELECT title FROM public.board_items WHERE id = :'item_id'), 'Write the spec',
  'a viewer cannot edit tasks');

-- ── Admin ───────────────────────────────────────────────────
SELECT tests.authenticate_as(:'admin_id');
UPDATE public.boards SET title = 'Roadmap 2026' WHERE id = :'board_id';
SELECT is((SELECT title FROM public.boards WHERE id = :'board_id'), 'Roadmap 2026',
  'an admin can change board settings');

DELETE FROM public.board_items WHERE id = :'item_id';
SELECT is_empty(format('SELECT 1 FROM public.board_items WHERE id = %L', :'item_id'),
  'an admin can delete tasks');

-- ── Pending invite tokens stay hidden ───────────────────────
SELECT tests.clear_authentication();
INSERT INTO public.board_members (board_id, email, role, status, token, invited_by)
VALUES (:'board_id', 'later@test.dev', 'viewer', 'pending', 'tok-later-0000000000', :'owner_id');

SELECT tests.authenticate_as(:'editor_id');
SELECT is_empty(format($$SELECT 1 FROM public.board_members WHERE board_id = %L AND status = 'pending'$$, :'board_id'),
  'non-admins cannot read pending invites (and their tokens)');

SELECT tests.authenticate_as(:'admin_id');
SELECT isnt_empty(format($$SELECT 1 FROM public.board_members WHERE board_id = %L AND status = 'pending'$$, :'board_id'),
  'admins can read pending invites');

-- ── Visibility returns to private ───────────────────────────
SELECT tests.clear_authentication();
DELETE FROM public.board_members WHERE board_id = :'board_id';
SELECT is((SELECT visibility FROM public.boards WHERE id = :'board_id'), 'private',
  'removing every member makes the board private again');

-- ── Internal functions are not callable from the API ────────
SELECT tests.authenticate_as(:'outsider_id');
SELECT throws_ok(
  format($$SELECT public.notify_users(ARRAY[%L]::uuid[], %L, NULL, NULL, 'x', 'spam', 'spam')$$,
         :'owner_id', :'board_id'),
  '42501', NULL,
  'notify_users() is not exposed to API roles');
SELECT throws_ok(
  $$SELECT public.send_due_date_reminders()$$,
  '42501', NULL,
  'send_due_date_reminders() is not exposed to API roles');
SELECT throws_ok(
  format($$SELECT public.user_can_read_board(%L, %L)$$, :'owner_id', :'board_id'),
  '42501', NULL,
  'user_can_read_board() is not exposed to API roles');

SELECT tests.clear_authentication();
SELECT * FROM finish();
ROLLBACK;
