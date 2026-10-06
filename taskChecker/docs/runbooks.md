# TeamFlow runbooks (audit P2)

Targets (from `design/teamflow.md`): **RPO ≤ 15 min, RTO ≤ 1 h**, 99.9%.
Probes: liveness `GET /healthz`, readiness `GET /readyz` (Postgres + Redis).
Starter alerts: `design/resilience-observability-security.md` (TeamFlowApiDown,
TeamFlowNotReady, TeamFlowDependencyErrors).

## 1. API down (`TeamFlowApiDown` firing, `/healthz` failing)

1. `GET /healthz` from outside the cluster (LB vs app?).
2. If the process is dead: check the last deploy (`git log --oneline -3`),
   `LOG_LEVEL=debug` tail for the `request failed` JSON lines (all carry
   `requestId`), roll back the deploy if the error spike correlates.
3. If the process is alive but `/healthz` fails: node OOM / event-loop stall —
   restart the pod, capture heap via `NODE_OPTIONS=--heapsnapshot-signal`.

## 2. Not ready (`TeamFlowNotReady`, `/readyz` → 503)

- `checks.postgres == down`: RDS/Supabase reachability, connection count
  (pool saturation shows as latency first — see `HighLatency`), fail over
  the replica only after confirming the primary is truly down.
- `checks.redis == down`: ElastiCache/Memorystripe endpoint, evictions, then
  note the app degrades (cache/limiter/queue fall back) — 503 here means
  *both* are down or Postgres alone is down; Redis alone does not fail ready.
- Auth callers see retryable `503 dependency_unavailable` (never a token) —
  tell support the retry guidance, not a password reset.

## 3. Backup / DR drill (evidence for RPO/RTO)

- Postgres: nightly `pg_dump` + WAL archiving (Supabase: PITR window ≥ 7d).
  Quarterly drill: restore to a scratch project, run
  `TEAMFLOW_IT=1 bun test test/integration.test.ts` against it, record the
  wall-clock restore time as the measured RTO and the newest recovered row
  timestamp as the measured RPO. File the evidence (date, duration, RPO) here:

  | Date | Restore target | Measured RTO | Measured RPO | Operator |
  |------|----------------|--------------|--------------|----------|
  | _pending first drill_ | | | | |

- Redis: AOF persisted (`appendonly yes` in compose); loss window = rebuild
  from Postgres (rate-limit counters and pub/sub are ephemeral by design).
- Blobs (S3/MinIO): versioned bucket + cross-region replication for prod.

## 4. Key rotation (after any exposure)

1. Rotate at the provider dashboard (Groq/Gemini/OpenRouter/JWT_SECRET), update
   `.env` (never a committed file), restart API + proxy.
2. Sweep: Gitleaks (`gitleaks detect` in CI) + `git log -S '<prefix>'`.
3. Confirm no billing/usage anomalies before/after rotation.
