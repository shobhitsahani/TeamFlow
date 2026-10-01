/** App assembly — the "API Gateway" concerns (request id, rate limits) plus the
 * mounted modules. Public routes skip auth; everything else requires a
 * principal, and every tenant-scoped handler opens with inTenant(). */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config.js";
import { API_VERSION, openApiDoc } from "./openapi.js";
import { randomToken } from "./lib/ids.js";
import { authenticate, enforceApiScopes } from "./lib/auth.js";
import { rateLimit } from "./lib/ratelimit.js";
import { errorHandler, notFoundHandler } from "./lib/errors.js";
import { sql } from "./db/client.js";
import { redisHealthy } from "./lib/redis.js";
import { authRoutes } from "./modules/auth.js";
import { orgRoutes } from "./modules/orgs.js";
import { coreRoutes } from "./modules/core.js";
import { taskRoutes } from "./modules/tasks.js";
import { commentRoutes } from "./modules/comments.js";
import { chatRoutes } from "./modules/chat.js";
import { dmRoutes } from "./modules/dm.js";
import { feedRoutes } from "./modules/feed.js";
import { searchRoutes } from "./modules/search.js";
import { govRoutes } from "./modules/governance.js";
import { attachmentRoutes } from "./modules/attachments.js";
import { billingRoutes } from "./modules/billing.js";

const PUBLIC_PATHS = [
  /^\/v1\/auth\/(signup|login|refresh|logout|google)$/,
  /^\/v1\/invites\/[^/]+$/,
  /^\/v1\/invites\/[^/]+\/preview$/,
  /^\/v1\/invites\/code\/[^/]+$/,
  /^\/v1\/invites\/code\/[^/]+\/preview$/,
  /^\/livez$/,
  /^\/healthz$/,
  /^\/readyz$/,
  /^\/v1\/openapi\.json$/,
];

/** Explicit CORS allowlist — never reflect arbitrary origins with credentials.
 * Production: FRONTEND_BASE_URL + CORS_ORIGINS (comma-separated) only.
 * Non-production additionally allows localhost/127.0.0.1 (any port) for dev.
 * Cookie audit (2026-09): the API sets no cookies — tokens ride the
 * Authorization header (WS via ?token=), so no HttpOnly/Secure/SameSite
 * flags are owed anywhere. */
function buildOriginAllowlist(nodeEnv: string): Set<string> {
  const allow = new Set<string>();
  for (const raw of (process.env.CORS_ORIGINS ?? "").split(",")) {
    const o = raw.trim().replace(/\/+$/, "");
    if (o) allow.add(o);
  }
  try {
    allow.add(config().frontendBaseUrl.replace(/\/+$/, ""));
  } catch {
    // config() throws in prod without JWT_SECRET — fail closed elsewhere;
    // CORS just gets no frontend entry here.
  }
  if (nodeEnv !== "production") {
    for (const port of ["3000", "4000", "5173", "8080"]) {
      allow.add(`http://localhost:${port}`);
      allow.add(`http://127.0.0.1:${port}`);
    }
  }
  return allow;
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    return (
      (u.protocol === "http:" || u.protocol === "https:") &&
      (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

const RATE_LIMIT = 600; // requests/min per principal
const RATE_WINDOW = 60; // seconds

export function createApp(): Hono {
  const app = new Hono();
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const allowlist = buildOriginAllowlist(nodeEnv);

  // CORS: explicit allowlist only. Unknown origins get no ACAO header, so
  // browsers block the read — credentialed reflection is never allowed.
  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) return "*"; // non-browser client (curl/server-to-server)
        if (allowlist.has(origin.replace(/\/+$/, ""))) return origin;
        if (nodeEnv !== "production" && isLoopbackOrigin(origin)) return origin;
        return null;
      },
      allowHeaders: ["Content-Type", "Authorization", "X-TeamFlow-Key", "X-TeamFlow-Signature", "Idempotency-Key", "X-Object-Key", "Upgrade"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      exposeHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "Retry-After"],
      credentials: true,
      maxAge: 86400,
    }),
  );

  // Baseline security headers (helmet-equivalent for Hono).
  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "no-referrer");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    c.header("Cross-Origin-Opener-Policy", "same-origin");
    if (nodeEnv === "production") {
      c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
  });

  // request id + stable error envelope everywhere
  app.use(async (c, next) => {
    c.set("requestId", randomToken(8));
    await next();
  });

  // version stamp on every /v1 response — the versioning proof alongside
  // the /v1 URL prefix (see openapi.ts: breaking changes ship as /v2).
  app.use("/v1/*", async (c, next) => {
    await next();
    c.header("API-Version", API_VERSION);
  });

  // OpenAPI pilot (public, versioned under /v1).
  app.get("/v1/openapi.json", (c) => c.json(openApiDoc));

  // root service info
  app.get("/", (c) =>
    c.json({
      service: "teamflow-api",
      status: "running",
      version: "v1",
      endpoints: {
        livez: "/livez",
        healthz: "/healthz",
        readyz: "/readyz",
        openapi: "/v1/openapi.json",
        auth: "/v1/auth/*",
      },
    }),
  );

  // liveness (process only — dependency checks live in readiness).
  // /healthz is the conventional alias; both are public.
  const livePayload = { ok: true, service: "teamflow-api" };
  app.get("/livez", (c) => c.json(livePayload));
  app.get("/healthz", (c) => c.json(livePayload));

  // readiness — dependency probes the LB health-gates on
  app.get("/readyz", async (c) => {
    const pgOk = (await sql`select 1`.catch(() => null)) !== null;
    const redisOk = await redisHealthy();
    return c.json(
      { ok: pgOk && redisOk, checks: { postgres: pgOk ? "up" : "down", redis: redisOk ? "up" : "down" } },
      pgOk && redisOk ? 200 : 503,
    );
  });

  // auth (skips public paths; WS token comes via ?token=)
  app.use("/v1/*", async (c, next) => {
    if (PUBLIC_PATHS.some((re) => re.test(c.req.path))) return next();
    await authenticate(c, next);
  });

  // per-principal rate limit (Redis fixed window, in-memory fallback)
  app.use("/v1/*", async (c, next) => {
    const p = c.get("principal");
    if (!p) return next();
    const result = await rateLimit(`rl:${p.tokenType}:${p.userId || p.tenantId}`, RATE_LIMIT, RATE_WINDOW);
    c.header("X-RateLimit-Limit", String(result.limit));
    c.header("X-RateLimit-Remaining", String(result.remaining));
    if (!result.allowed) {
      c.header("Retry-After", String(result.retryAfterSeconds));
      return c.json(
        {
          error: {
            code: "rate_limited",
            message: `Rate limit exceeded; retry in ${result.retryAfterSeconds}s.`,
            request_id: c.get("requestId"),
            retryable: true,
          },
        },
        429,
      );
    }
    await next();
  });

  // API-key scopes: read-only keys cannot mutate. User tokens pass through.
  app.use("/v1/*", enforceApiScopes);

  // modules
  app.route("/v1", authRoutes); // /v1/auth/* + /v1/me + /v1/invites/:token (public)
  app.route("/v1", orgRoutes); // org + member management
  app.route("/v1", coreRoutes); // teams + projects
  app.route("/v1", taskRoutes); // tasks
  app.route("/v1", commentRoutes); // comments
  app.route("/v1", chatRoutes); // team chat
  app.route("/v1", dmRoutes); // E2E encrypted DMs (ciphertext store)
  app.route("/v1", feedRoutes); // activity + notifications
  app.route("/v1", searchRoutes); // full-text search
  app.route("/v1", govRoutes); // webhooks, api keys, audit, usage
  app.route("/v1", billingRoutes); // billing + subscription tiers
  app.route("/v1", attachmentRoutes); // attachments

  app.notFound(notFoundHandler);
  app.onError(errorHandler);
  return app;
}