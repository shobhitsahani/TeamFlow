// Preflight for `bun run dev` (repo root).
// - If the dev servers are already up (ports occupied), exit 0 with a clear
//   message instead of spawning a second turbo session that dies with
//   EADDRINUSE / a native crash (Windows exit 3221226505).
// - Otherwise ensures Postgres+Redis are up, then starts the monorepo dev
//   session exactly once. No dependencies, runs on node or bun.
// - Starts the session with a non-TTY stdin, which keeps turbo's bin shim out
//   of its crashing Windows Ctrl+C-ownership mode (turbo 2.11.x aborts at
//   startup with 0xC0000409 / exit 3221226505 in that mode).
// - If turbo dies a native death (0xC0000409) anyway, its children usually
//   survive orphaned and keep the ports: sweep them via dev-stop --force and
//   retry the session once, automatically.
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDevPorts } from "./dev-ports.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND_DIR = path.join(ROOT, "taskChecker", "apps", "backend");

// Port -> owner, derived from the apps' own configs (see scripts/dev-ports.mjs)
// so this list can never drift from what the apps actually bind.
const PORTS = getDevPorts();

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

function sweepOrphans() {
  const res = spawnSync(process.execPath, [path.join(ROOT, "scripts", "dev-stop.mjs"), "--force"], {
    stdio: "inherit",
  });
  if (res.error) console.warn(`[dev] dev:stop failed to launch: ${res.error.message}`);
}

async function busyPorts() {
  const busy = [];
  for (const { port, owner } of PORTS) {
    // eslint-disable-next-line no-await-in-loop
    const busy4 = await portInUse(port);
    // A server bound to IPv6 loopback [::1] only is invisible to an IPv4
    // probe; try both stacks so a live session is never misreported as free.
    const busy6 = busy4 ? true : await portInUse(port, "::1");
    if (busy4 || busy6) busy.push(`${port} (${owner})`);
  }
  return busy;
}

async function main(retried = false) {
  const busy = await busyPorts();
  if (busy.length > 0) {
    console.log(`[dev] Already running — port(s) in use: ${busy.join(", ")}.`);
    console.log(`[dev] Reusing the existing session (open http://localhost:${PORTS[0].port}).`);
    console.log("[dev] To restart cleanly: Ctrl+C the original `bun run dev` terminal, then run `bun run dev` again.");
    process.exit(0);
  }

  ensureDockerDeps();

  // stdin must NOT be a TTY. Turbo's bin shim (node_modules/turbo/bin/turbo)
  // enables a Windows "Ctrl+C ownership" mode only when stdin is a TTY and the
  // process was launched from package-manager scripts (npm_config_user_agent
  // set): it then spawns turbo.exe with a __TURBO_WINDOWS_CTRL_C_FD=3 pipe.
  // turbo 2.11.x aborts natively at startup in that mode — exit 3221226505
  // (0xC0000409, fastfail), with zero output (verified: same binary exits 0
  // without the pipe; 2.11.10 still affected, unfixed upstream as of Oct 2026).
  // With a non-TTY stdin the shim takes the plain path and everything works.
  // Ctrl+C is unaffected: the console broadcasts CTRL_C_EVENT to every
  // attached process in the group, so turbo/next/bun still receive it.
  const child = spawn("pnpm --dir taskChecker run dev", {
    cwd: ROOT,
    stdio: ["ignore", "inherit", "inherit"],
    shell: true, // required on Windows to resolve pnpm.cmd (single command string, so no DEP0190)
    env: {
      ...process.env,
      TURBO_UI: "0",
      TURBO_NO_UPDATE_NOTIFIER: "1",
      NO_UPDATE_NOTIFIER: "1",
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
    // Clean stops: 0 = normal; 130 = SIGINT convention; 3221225786 =
    // 0xC000013A Windows STATUS_CONTROL_C_EXIT (Ctrl+C nothing handled).
    if (code === 0 || code === 130 || code === 3221225786) process.exit(0);
    // 0xC0000409: turbo died natively (Windows STACK_BUFFER_OVERRUN), not via
    // exit(). Its children usually survive orphaned and keep the ports — the
    // next `bun run dev` would then report "Already running" for a dead
    // session, so sweep the orphans and retry once, automatically.
    if (code === 3221226505 && !retried) {
      console.error("[dev] turbo crashed natively (Windows exit 3221226505).");
      console.error("[dev] Cleaning orphaned listeners and retrying once...");
      sweepOrphans();
      setTimeout(() => main(true), 1500);
      return;
    }
    if (code === 3221226505) {
      console.error("[dev] turbo crashed natively (Windows exit 3221226505) — again, after a retry.");
      console.error("[dev] Orphans were swept once automatically; run `bun run dev:stop --force` manually,");
      console.error("[dev] then `bun run dev`. If it keeps crashing, the turbo binary may be stale or");
      console.error("[dev] corrupted: cd taskChecker && pnpm install (or delete node_modules first).");
      process.exit(1);
    }
    // Previously any other non-zero code exited silently — the auto-retry once
    // died without a trace behind "retrying once...". Always say something.
    console.error(`[dev] dev session exited with code ${code}.`);
    process.exit(code ?? 1);
  });
}

await main();
