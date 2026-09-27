/** Postgres client + drizzle instance. postgres-js connects lazily, so the
 * server boots even when the DB is down; endpoints surface 503 until it returns.
 *
 * Single source of truth is the docker-compose Postgres (see
 * docker-compose.yml + .env.example). The app connects as the NON-superuser
 * `teamflow` role so RLS applies; migrations run as `postgres`.
 */
import { config } from "../config.js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

// The app connects as a NON-superuser role so RLS is enforced (superusers bypass
// row-level security). See docker-compose.yml + migrations. Tenant scoping is
// additionally enforced in application queries (tenant_id filters).
const dbUrl = config().databaseUrl;

export const sql = postgres(dbUrl, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 5,
  prepare: false, // required when using drizzle with postgres-js
});

export const db = drizzle(sql, { schema });

export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];