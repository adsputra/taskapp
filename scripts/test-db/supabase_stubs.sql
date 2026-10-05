-- ============================================================
-- Test harness only — NOT part of the app schema.
-- ============================================================
-- The bare supabase/postgres image ships the auth/storage schemas but not
-- the objects that GoTrue and Storage create at runtime. These stand-ins
-- mirror the columns schema.sql relies on so the pgTAP suite can run in a
-- single container (scripts/test-db.sh). On a full local stack
-- (`supabase test db`) the real objects already exist and this file is
-- not used.

-- Current GoTrue/PostgREST read the user from request.jwt.claims.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

CREATE TABLE IF NOT EXISTS auth.mfa_factors (
  id            uuid PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friendly_name text,
  factor_type   text NOT NULL,
  status        text NOT NULL,
  created_at    timestamptz NOT NULL,
  updated_at    timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS storage.buckets (
  id                 text PRIMARY KEY,
  name               text NOT NULL,
  owner              uuid,
  public             boolean DEFAULT false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id  text REFERENCES storage.buckets(id),
  name       text,
  owner      uuid,
  owner_id   text,
  metadata   jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- On Supabase the SQL editor role (postgres) may manage storage policies.
ALTER TABLE storage.buckets OWNER TO postgres;
ALTER TABLE storage.objects OWNER TO postgres;

-- Supabase grants these to the dashboard role and to API users.
GRANT ALL ON auth.mfa_factors TO postgres;
GRANT SELECT ON auth.mfa_factors TO authenticated;

GRANT USAGE ON SCHEMA auth, storage, extensions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT SELECT ON storage.buckets TO authenticated;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;
