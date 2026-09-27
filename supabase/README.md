# Supabase local stack (audit P1: one data-source-of-truth)

Postgres schema truth lives in **Drizzle** (`apps/backend/src/db/migrations/`),
not here — there is exactly one migration path. This directory is the local
Supabase *platform* (Postgres + Auth + Storage + pooler) to run that schema
against.

```powershell
supabase start
# point the backend at the local stack, then migrate + seed with Drizzle:
#   DATABASE_URL=postgres://postgres:postgres@localhost:54322/postgres
#   DATABASE_MIGRATE_URL=postgres://postgres:postgres@localhost:54322/postgres
#   bun run db:migrate
#   bun run db:seed
# (pooler on 54329 with ?pgbouncer=true mirrors the hosted shape)
```

`seed.sql` only provisions the NOSUPERUSER `teamflow` app role (see
`apps/backend/docker/init.sql`) — RLS applies to the app role, never to the
bootstrap superuser. Hosted Supabase works the same way: paste the pooler
string into `DATABASE_URL` (see `apps/backend/.env.example`).
