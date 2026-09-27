/* k6 baseline (audit P2) — hot-path smoke + first numbers for the EXPLAIN audit.
 *
 *   docker compose up -d && bun run db:migrate && bun run db:seed
 *   bun src/index.ts & k6 run apps/backend/k6/smoke.js
 *
 * Thresholds below are the MVP baseline to beat (requirements.md: ~1.2 peak
 * QPS); tighten them after the first real run. Draft: committed unrun (k6 not
 * installed in this environment) — first green run owns updating this header.
 */
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 5 },
    { duration: "1m", target: 20 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(99)<500"],
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:4002";

export function setup() {
  const res = http.post(`${BASE}/v1/auth/login`, JSON.stringify({ email: "alice@acme.io", password: "password" }), {
    headers: { "Content-Type": "application/json" },
  });
  check(res, { "seed login ok": (r) => r.status === 200 });
  const body = res.json();
  return { token: body.tokens.accessToken, tenantId: body.tenant.id };
}

export default function (data) {
  const h = { Authorization: `Bearer ${data.token}` };
  // Hot paths: board read (cache-aside), me, healthz. EXPLAIN/index audit
  // targets: tasks board query (tenant_id, project_id, status, created_at),
  // memberships-for-user lookup, FTS search_vector GIN.
  const board = http.get(`${BASE}/v1/orgs/${data.tenantId}/projects/00000000-0000-0000-0000-000000000000/tasks`, { headers: h });
  check(board, { "board read": (r) => r.status === 200 || r.status === 404 });
  const me = http.get(`${BASE}/v1/me`, { headers: h });
  check(me, { me: (r) => r.status === 200 });
  const hz = http.get(`${BASE}/healthz`);
  check(hz, { healthz: (r) => r.status === 200 });
  sleep(1);
}
