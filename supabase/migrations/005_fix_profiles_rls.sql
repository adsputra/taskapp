-- ============================================================
-- 005 — Fix profiles RLS for comments & board sharing
-- ============================================================
-- Problem:
--   Comments join with profiles to display author names.
--   The old "select own profile" policy blocked reading any
--   profile other than your own, so the join returned NULL and
--   all comments showed "User" instead of real names.
--
-- Solution:
--   Allow all authenticated users to read any profile row.
--   Profiles only contain basic public-ish info (name, email,
--   avatar) that board members need to see.
-- ============================================================

-- Drop the restrictive SELECT policy only
DROP POLICY IF EXISTS "select own profile" ON profiles;

-- Create a broad SELECT policy for all authenticated users
-- (INSERT & UPDATE remain restricted to own profile — unchanged)
CREATE POLICY "authenticated_select_profiles" ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');
