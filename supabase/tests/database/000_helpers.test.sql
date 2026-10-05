-- Shared helpers for the pgTAP suite. Committed (not rolled back) so the
-- other test files can use them; every other file runs in a transaction
-- that is rolled back.

CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO authenticated, anon;

-- Creates an auth user (and, through handle_new_user, its profile).
CREATE OR REPLACE FUNCTION tests.create_user(_email text, _name text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
  VALUES (v_id, lower(_email), jsonb_build_object('full_name', COALESCE(_name, split_part(_email, '@', 1))),
          'authenticated', 'authenticated');
  RETURN v_id;
END;
$$;

-- Act as a user for the rest of the transaction (or until the next call).
CREATE OR REPLACE FUNCTION tests.authenticate_as(_user_id uuid, _aal text DEFAULT 'aal1')
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _user_id, 'role', 'authenticated', 'aal', _aal)::text, true);
  PERFORM set_config('role', 'authenticated', true);
END;
$$;

-- Back to the test runner's own role (postgres) with no JWT.
CREATE OR REPLACE FUNCTION tests.clear_authentication()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('role', 'postgres', true);
END;
$$;

-- Default board layout, as created by CreateBoardModal.jsx.
CREATE OR REPLACE FUNCTION tests.default_columns()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '[
    {"id": "task", "title": "Task", "type": "text"},
    {"id": "status", "title": "Status", "type": "status",
     "options": {"choices": [{"label": "Not Started"}, {"label": "Working on it"}, {"label": "Done"}]}},
    {"id": "owner", "title": "Owner", "type": "people"},
    {"id": "due_date", "title": "Due Date", "type": "date"}
  ]'::jsonb;
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tests TO authenticated, anon;

BEGIN;
SELECT plan(1);
SELECT has_function('tests', 'authenticate_as', ARRAY['uuid', 'text'], 'test helpers are installed');
SELECT * FROM finish();
COMMIT;
