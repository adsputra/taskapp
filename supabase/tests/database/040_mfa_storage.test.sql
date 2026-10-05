-- MFA enforcement in the database and Storage policies.
BEGIN;
SELECT plan(12);

SELECT tests.create_user('owner@test.dev')    AS owner_id    \gset
SELECT tests.create_user('editor@test.dev')   AS editor_id   \gset
SELECT tests.create_user('outsider@test.dev') AS outsider_id \gset

INSERT INTO public.boards (user_id, title, columns, groups)
VALUES (:'owner_id', 'Files', tests.default_columns(), '[{"id": "g1", "title": "Now"}]')
RETURNING id AS board_id \gset
INSERT INTO public.board_members (board_id, user_id, email, role, status)
VALUES (:'board_id', :'editor_id', 'editor@test.dev', 'editor', 'active');
INSERT INTO public.board_items (board_id, group_id, title)
VALUES (:'board_id', 'g1', 'Contract') RETURNING id AS item_id \gset

-- ── MFA ─────────────────────────────────────────────────────
SELECT tests.authenticate_as(:'owner_id', 'aal1');
SELECT isnt_empty(format('SELECT 1 FROM public.boards WHERE id = %L', :'board_id'),
  'without a verified factor an aal1 session has full access');

SELECT tests.clear_authentication();
INSERT INTO auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
VALUES (gen_random_uuid(), :'owner_id', 'test phone', 'totp', 'verified', now(), now());

SELECT tests.authenticate_as(:'owner_id', 'aal1');
SELECT is_empty(format('SELECT 1 FROM public.boards WHERE id = %L', :'board_id'),
  'with a verified factor an aal1 session sees nothing');
SELECT throws_ok(
  format($$INSERT INTO public.board_items (board_id, group_id, title) VALUES (%L, 'g1', 'x')$$, :'board_id'),
  '42501', NULL,
  'with a verified factor an aal1 session cannot write');
SELECT throws_ok(
  $$SELECT public.get_board_invitation('0123456789abcdef0123')$$,
  '42501', 'mfa_required',
  'SECURITY DEFINER RPCs enforce MFA too');

SELECT tests.authenticate_as(:'owner_id', 'aal2');
SELECT isnt_empty(format('SELECT 1 FROM public.boards WHERE id = %L', :'board_id'),
  'after stepping up to aal2 access is restored');

-- ── Storage ─────────────────────────────────────────────────
SELECT tests.authenticate_as(:'editor_id');

SELECT lives_ok(
  format($$INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('task-attachments', %L, %L)$$,
         :'board_id' || '/' || :'item_id' || '/a_contract.pdf', :'editor_id'),
  'an editor can upload to a task on their board');

SELECT throws_ok(
  format($$INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('task-attachments', %L, %L)$$,
         :'board_id' || '/' || gen_random_uuid() || '/b.pdf', :'editor_id'),
  '42501', NULL,
  'uploads must target an existing task of that board');

SELECT tests.authenticate_as(:'outsider_id');
SELECT throws_ok(
  format($$INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('task-attachments', %L, %L)$$,
         :'board_id' || '/' || :'item_id' || '/c.pdf', :'outsider_id'),
  '42501', NULL,
  'outsiders cannot upload');
SELECT is_empty(
  $$SELECT 1 FROM storage.objects WHERE bucket_id = 'task-attachments'$$,
  'outsiders cannot list the files');

-- An admin's file cannot be deleted by an editor, the editor's own can.
SELECT tests.clear_authentication();
INSERT INTO storage.objects (bucket_id, name, owner)
VALUES ('task-attachments', :'board_id' || '/' || :'item_id' || '/owner.pdf', :'owner_id');

-- The Storage API sets this before deleting (RLS still applies); plain SQL
-- deletes are otherwise refused by storage.protect_delete().
SELECT set_config('storage.allow_delete_query', 'true', true);

SELECT tests.authenticate_as(:'editor_id');
DELETE FROM storage.objects WHERE name LIKE '%/owner.pdf';
DELETE FROM storage.objects WHERE name LIKE '%/a_contract.pdf';
SELECT tests.clear_authentication();

SELECT isnt_empty($$SELECT 1 FROM storage.objects WHERE name LIKE '%/owner.pdf'$$,
  'an editor cannot delete someone else''s file');
SELECT is_empty($$SELECT 1 FROM storage.objects WHERE name LIKE '%/a_contract.pdf'$$,
  'an editor can delete their own file');

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'task-attachments' AND 'image/svg+xml' = ANY (allowed_mime_types)
  ),
  'SVG uploads are not allowed');

SELECT * FROM finish();
ROLLBACK;
