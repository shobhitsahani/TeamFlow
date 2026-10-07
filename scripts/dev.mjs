// Preflight for `bun run dev` (repo root).
// - If the dev servers are already up (ports occupied), exit 0 with a clear
//   message instead of spawning a second turbo session that dies with
//   EADDRINUSE / a native crash (Windows exit 3221226505).
// - Otherwise ensures Postgres+Redis are up, then starts the monorepo dev
//   session exactly once. No dependencies, runs on node or bun.
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND_DIR = path.join(ROOT, "taskChecker", "apps", "backend");

// Port -> owner. Must match taskChecker/apps/{frontend,backend}/package.json dev scripts.
const PORTS = [
  { port: 3000, owner: "frontend (next dev -p 3000)" },
  { port: 4002, owner: "backend (bun --watch src/index.ts)" },
];

function portInUse(port, host = "127.0.0.1", timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = net.connect(port, host);
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      done(true);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      done(false);
    });
  });
}

function ensureDockerDeps() {
  const res = spawnSync("docker", ["compose", "up", "-d"], {
    cwd: BACKEND_DIR,
    stdio: "ignore",
    timeout: 120000,
    shell: false,
  });
  if (res.error || res.status !== 0) {
    console.warn(
      "[dev] WARNING: could not start docker dependencies (postgres/redis). " +
        "The backend will answer 503 'A required dependency is unavailable' until you run " +
        "`docker compose up -d` in taskChecker/apps/backend.",
    );
  }
}

const busy = [];
for (const { port, owner } of PORTS) {
  // eslint-disable-next-line no-await-in-loop
  if (await portInUse(port)) busy.push(`${port} (${owner})`);
}

if (busy.length > 0) {
  console.log(`[dev] Already running — port(s) in use: ${busy.join(", ")}.`);
  console.log("[dev] Reusing the existing session (open http://localhost:3000).");
  console.log("[dev] To restart cleanly: Ctrl+C the original `bun run dev` terminal, then run `bun run dev` again.");
  process.exit(0);
}

ensureDockerDeps();

const child = spawn("pnpm --dir taskChecker run dev", {
  cwd: ROOT,
  stdio: "inherit",
  shell: true, // required on Windows to resolve pnpm.cmd (single command string, so no DEP0190)
  env: {
    ...process.env,
    TURBO_UI: "0",
  },
});
child.on("error", (err) => {
  console.error(`[dev] Failed to start: ${err.message}`);
  console.error("[dev] Is pnpm installed? (packageManager: pnpm@10.34.3)");
  process.exit(1);
});
child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`[dev] Dev session ended by signal ${signal}.`);
    process.exit(1);
  }
  // 0xC0000409: turbo died natively (Windows STACK_BUFFER_OVERRUN), not via
  // exit(). Its children usually survive orphaned and keep the ports — the
  // next `bun run dev` then reports "Already running" for a dead session.
  if (code === 3221226505) {
    console.error("[dev] turbo crashed natively (Windows exit 3221226505).");
    console.error("[dev] Run `bun run dev:stop` to kill the orphans, then `bun run dev` again.");
  }
  process.exit(code ?? 1);
});
