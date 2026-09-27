-- Supabase local-stack seed (runs on `supabase db reset`).
--
-- Single source of truth for the schema is Drizzle:
--   apps/backend/src/db/migrations/*.sql, applied with `bun run db:migrate`.
-- This seed only provisions the restricted app role, mirroring
-- apps/backend/docker/init.sql: the API connects as NOSUPERUSER `teamflow`
-- so Postgres RLS applies; migrations run as the superuser.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'teamflow') THEN
    CREATE ROLE teamflow LOGIN PASSWORD 'teamflow' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;
GRANT ALL ON SCHEMA public TO teamflow;
GRANT ALL ON DATABASE postgres TO teamflow;
