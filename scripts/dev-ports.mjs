// Single source of truth for the dev-server ports.
//
// Why derived dynamically instead of hardcoded: the ports live in the apps'
// own configs (apps/frontend package.json `dev` script, apps/backend/.env
// with a code default in src/config.ts) and they have drifted before —
// dev-stop once swept port 3000 while next dev actually listened on 3005,
// so orphans survived a "clean". Both scripts/dev.mjs and scripts/dev-stop.mjs
// read the ports from here, so they can never disagree with the apps.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FRONTEND_PKG = path.join(REPO_ROOT, "taskChecker", "apps", "frontend", "package.json");
const BACKEND_ENV = path.join(REPO_ROOT, "taskChecker", "apps", "backend", ".env");

// Matches the code defaults: next's own default port (3000) and
// apps/backend/src/config.ts (`process.env.PORT ?? 4002`).
const FALLBACKS = { frontend: 3000, backend: 4002 };

function frontendPort() {
  try {
    const pkg = JSON.parse(fs.readFileSync(FRONTEND_PKG, "utf8"));
    const dev = pkg?.scripts?.dev ?? "";
    const m = String(dev).match(/-p\s+(\d+)/);
    if (m) return Number(m[1]);
  } catch {}
  return FALLBACKS.frontend;
}

function backendPort() {
  try {
    const env = fs.readFileSync(BACKEND_ENV, "utf8");
    const m = env.match(/^PORT=(\d+)\s*$/m);
    if (m) return Number(m[1]);
  } catch {}
  return FALLBACKS.backend;
}

// Port -> owner labels, mirroring the apps' dev scripts.
export function getDevPorts() {
  const frontend = frontendPort();
  const backend = backendPort();
  return [
    { port: frontend, owner: `frontend (next dev -p ${frontend})` },
    { port: backend, owner: "backend (bun --watch src/index.ts)" },
  ];
}
