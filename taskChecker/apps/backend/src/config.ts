/**
 * App-environment config — reads process.env with dev-friendly defaults.
 * Never logs secrets.
 */
import { log } from "./lib/log.js";
export interface Config {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  /** Migrations run as the bootstrap superuser: tables + SECURITY DEFINER
   * lookups must be owned by a role RLS cannot constrain (the app role is
   * NOSUPERUSER so RLS applies to it). */
  migrateDatabaseUrl: string;
  databaseReplicaUrl?: string;
  redisUrl: string;
  jwtSecret: string;
  accessTokenTtl: string;
  uploadBackend: "memory" | "s3";
  s3Endpoint?: string;
  s3Bucket?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
  s3Region?: string;
  publicBaseUrl: string;
  /** Absolute URL of the web app — invite links point here, not at the API. */
  frontendBaseUrl: string;
  /** Deadline sweep cadence (ms) — how often overdue tasks move to backlog. */
  deadlineSweepMs: number;
  webhookRetries: number;
  logLevel: string;
  /** Resend outbound email (invite delivery). Optional: when unset, invites
   * are manual-relay only (link + code returned to the inviter). */
  resendApiKey?: string;
  inviteFromEmail?: string;
}

function need(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function configured(name: string, alias: string, fallback: string): string {
  const value = process.env[name];
  if (value && value !== `process.env.${alias}`) return value;
  return need(alias, fallback);
}

const DEV_JWT_FALLBACK = "dev-only-change-me-at-least-32-chars-with-randomness";

function hasEntropy(secret: string): boolean {
  if (secret.length < 32) return false;
  if (secret === DEV_JWT_FALLBACK) return false;
  if (/dev-only-change-me/i.test(secret)) return false;
  // Reject trivial secrets like "aaaa..." or "abcdabcdabcd..."
  if (/^(.)\1*$/.test(secret)) return false;
  if (new Set(secret).size < 8) return false;
  return true;
}

function resolveJwtSecret(nodeEnv: string): string {
  const raw = process.env.JWT_SECRET;
  const alias = process.env.JWT_SECRET_4;
  const candidate =
    raw && raw !== "process.env.JWT_SECRET_4"
      ? raw
      : alias && alias !== "process.env.JWT_SECRET_4"
        ? alias
        : undefined;
  if (nodeEnv === "production") {
    // Fail closed: never boot prod with a known/default secret. Also refuse
    // the auth-sandbox fallback flag in production (defense in depth — there
    // is currently no fallback path, and there must never be one in prod).
    if (process.env.ALLOW_AUTH_FALLBACK === "true") {
      throw new Error("ALLOW_AUTH_FALLBACK must never be enabled in production");
    }
    if (!candidate) throw new Error("Missing required env var: JWT_SECRET in production");
    if (!hasEntropy(candidate)) {
      throw new Error("JWT_SECRET in production must be ≥32 chars with real entropy (not a default/repeated value)");
    }
    return candidate;
  }
  if (!candidate) {
    log.warn("JWT_SECRET unset — using dev-only fallback. Never use this in production.");
    return DEV_JWT_FALLBACK;
  }
  if (!hasEntropy(candidate)) {
    log.warn("JWT_SECRET looks weak (<32 chars or low entropy). Use a strong random value in production.");
  }
  return candidate;
}

export function loadConfig(): Config {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  return {
    port: Number(process.env.PORT ?? 4002),
    nodeEnv,
    // v0 project variables may be referenced through an indirection such as
    // process.env.DATABASE_URL_4; resolve that alias before connecting.
    databaseUrl: configured("DATABASE_URL", "DATABASE_URL_4", "postgres://teamflow:teamflow@localhost:5432/teamflow"),
    migrateDatabaseUrl: configured("DATABASE_MIGRATE_URL", "DATABASE_URL_4", "postgres://postgres:postgres@localhost:5432/teamflow"),
    databaseReplicaUrl: process.env.DATABASE_REPLICA_URL,
    redisUrl: need("REDIS_URL", "redis://localhost:6379"),
    jwtSecret: resolveJwtSecret(nodeEnv),
    accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? "15m",
    uploadBackend: (process.env.UPLOAD_BACKEND as "memory" | "s3") ?? "memory",
    s3Endpoint: process.env.S3_ENDPOINT,
    s3Bucket: process.env.S3_BUCKET ?? "teamflow-attachments",
    s3AccessKey: process.env.S3_ACCESS_KEY,
    s3SecretKey: process.env.S3_SECRET_KEY,
    s3Region: process.env.S3_REGION ?? "us-east-1",
    publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:4002",
    frontendBaseUrl: (process.env.FRONTEND_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, ""),
    deadlineSweepMs: Number(process.env.DEADLINE_SWEEP_MS ?? 5 * 60 * 1000),
    webhookRetries: Number(process.env.WORKER_WEBHOOK_RETRIES ?? 10),
    logLevel: process.env.LOG_LEVEL ?? "info",
    resendApiKey: process.env.RESEND_API_KEY,
    inviteFromEmail: process.env.INVITE_FROM_EMAIL,
  };
}

/** Lazy singleton so importing the module never hard-fails (tests, healthz). */
let _config: Config | undefined;
export function config(): Config {
  _config ??= loadConfig();
  return _config;
}
