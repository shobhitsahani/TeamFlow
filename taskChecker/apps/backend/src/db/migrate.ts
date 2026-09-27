/** Migration runner — applies migrations/*.sql in filename order.
 * Uses postgres-js "simple" protocol so multi-statement scripts work.
 *
 *   bun run db:migrate
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { log } from "../lib/log.js";
import postgres from "postgres";

async function main() {
  // Run as the bootstrap superuser — tables and SECURITY DEFINER functions must
  // be owned by a role that RLS cannot constrain (the app role is NOSUPERUSER).
  const sql = postgres(config().migrateDatabaseUrl, { prepare: false, max: 1 });
  const dir = fileURLToPath(new URL("./migrations", import.meta.url));
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    log.info("no migrations found");
    await sql.end();
    return;
  }

  // Track applied migrations so re-runs are safe (idempotent runner).
  await sql`create table if not exists schema_migrations (
    name       text primary key,
    applied_at timestamptz not null default now()
  )`;
  const applied = new Set(
    (await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name),
  );

  // Baseline for databases migrated before the tracker existed: if the schema
  // is already there (marker enum exists) but the tracker is empty, record the
  // original full-schema migration as applied instead of re-running it.
  const schemaExists = await sql`select 1 from pg_type where typname = 'teamflow_plan'`;
  const first = files[0];
  if (schemaExists.length > 0 && first && !applied.has(first)) {
    await sql`insert into schema_migrations (name) values (${first}) on conflict do nothing`;
    applied.add(first);
    log.info("baseline already applied (schema present)", { migration: first });
  }

  for (const file of files) {
    if (applied.has(file)) {
      log.info("skipping applied migration", { migration: file });
      continue;
    }
    log.info("applying migration", { migration: file });
    const body = readFileSync(`${dir}/${file}`, "utf8");
    await sql.unsafe(body).simple();
    await sql`insert into schema_migrations (name) values (${file})`;
  }
  log.info("migrations done", { total: files.length, previouslyApplied: applied.size });
  await sql.end();
}

main().catch((err) => {
  log.error("migration failed", { error: (err as Error)?.message ?? String(err) });
  process.exit(1);
});