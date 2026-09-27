/** OpenAPI pilot (audit P2) — `GET /v1/openapi.json` serves this document.
 *
 * Coverage is deliberately partial (`x-coverage: pilot`): health + auth +
 * the board read are fully specified; every other module is listed under
 * `x-todo` until its paths are added the same way. Extend by copying an
 * existing path entry — never by hand-waving a path that isn't implemented.
 *
 * API versioning proof: all product routes live under `/v1`; every `/v1/*`
 * response carries `API-Version: v1`. Breaking changes ship as `/v2` with the
 * Sunset/Deprecation convention noted below — v1 is never silently mutated.
 */
export const API_VERSION = "v1";

export const openApiDoc = {
  openapi: "3.1.0",
  info: {
    title: "TeamFlow API",
    version: "1.0.0",
    description:
      "Multi-tenant TeamFlow SaaS with team chat. Versioning: URL prefix (/v1) + `API-Version` response header. " +
      "Breaking changes introduce /v2; deprecated v1 fields get `deprecated: true` plus `Sunset`/`Deprecation` headers " +
      "with ≥90 days notice — v1 behavior is never silently mutated.",
  },
  servers: [{ url: "http://localhost:4002", description: "local dev" }],
  security: [{ bearerAuth: [] }, { apiKey: [] }],
  "x-coverage": "pilot",
  "x-todo": [
    "orgs/invites/members",
    "teams/projects (core)",
    "tasks write paths + idempotency",
    "comments",
    "chat + realtime WS contract",
    "feed/notifications",
    "search",
    "governance (webhooks/api-keys/audit/usage)",
    "billing",
    "attachments",
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "User access token (15m TTL)." },
      apiKey: {
        type: "apiKey",
        in: "header",
        name: "X-TeamFlow-Key",
        description: "Org API key; read-only keys cannot mutate (403 on writes).",
      },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message", "request_id", "retryable"],
            properties: {
              code: { type: "string", example: "dependency_unavailable" },
              message: { type: "string" },
              request_id: { type: "string" },
              retryable: { type: "boolean" },
            },
          },
        },
      },
      Tokens: {
        type: "object",
        required: ["accessToken", "refreshToken"],
        properties: { accessToken: { type: "string" }, refreshToken: { type: "string" } },
      },
    },
  },
  paths: {
    "/healthz": {
      get: {
        summary: "Liveness (process only)",
        security: [],
        responses: { "200": { description: "alive", content: { "application/json": { schema: { type: "object" } } } } },
      },
    },
    "/readyz": {
      get: {
        summary: "Readiness (postgres + redis probes; LB health-gates here)",
        security: [],
        responses: {
          "200": { description: "ready" },
          "503": { description: "dependency down", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/v1/auth/signup": {
      post: {
        summary: "Signup — creates user + org + owner membership",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "name", "orgName"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                  name: { type: "string", maxLength: 80 },
                  orgName: { type: "string", minLength: 2, maxLength: 80 },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: { type: "object" },
                    org: { type: "object" },
                    tokens: { $ref: "#/components/schemas/Tokens" },
                  },
                },
              },
            },
          },
          "400": { description: "validation / duplicate", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "503": { description: "dependency down — never a token", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/v1/auth/login": {
      post: {
        summary: "Login — verifies creds, returns memberships + tokens",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: { email: { type: "string", format: "email" }, password: { type: "string" } },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "ok",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: { type: "object" },
                    memberships: { type: "array", items: { type: "object" } },
                    tenant: { type: "object" },
                    tokens: { $ref: "#/components/schemas/Tokens" },
                  },
                },
              },
            },
          },
          "401": { description: "bad creds / no membership", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "503": { description: "dependency down — never a token", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/v1/me": {
      get: {
        summary: "Session user + memberships (org picker)",
        responses: {
          "200": { description: "ok" },
          "401": { description: "unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/v1/orgs/{orgId}/projects/{projectId}/tasks": {
      get: {
        summary: "Board read — cache-aside, cursor-paginated",
        parameters: [
          { name: "orgId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "projectId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "cursor", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
        ],
        responses: {
          "200": { description: "ok" },
          "403": { description: "org mismatch", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
  },
} as const;
