// `bun run dev:stop` — kills whatever owns the dev ports.
//
// Why this exists: when turbo dies natively (Windows exit 3221226505), its
// children (next dev, bun backend) survive orphaned and keep ports 3000/4002.
// Ctrl+C in the wrong terminal never reaches them, so the next `bun run dev`
// reports "Already running" for a dead session. This kills the port owners
// directly. Refuses to run when a healthy turbo supervisor is alive — use it
// only after a crash, never to stop a working session.
import { execSync } from "node:child_process";

const PORTS = [3000, 4002];

function portOwnerPids(port) {
  try {
    if (process.platform === "win32") {
      const out = execSync(`netstat -ano -p TCP | findstr :${port} `, { encoding: "utf8" });
      const pids = new Set();
      for (const line of out.split("\n")) {
        const m = line.match(/TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/);
        if (m && Number(m[1]) === port) pids.add(Number(m[2]));
      }
      return [...pids];
    }
    const out = execSync(`lsof -ti tcp:${port}`, { encoding: "utf8" });
    return out.split("\n").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n));
  } catch {
    return [];
  }
}

function describe(pid) {
  try {
    if (process.platform === "win32") {
      const out = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { encoding: "utf8" });
      return (out.split(",")[0] ?? "").replace(/"/g, "") || `pid ${pid}`;
    }
    const out = execSync(`ps -p ${pid} -o comm=`, { encoding: "utf8" });
    return out.trim() || `pid ${pid}`;
  } catch {
    return `pid ${pid}`;
  }
}

function kill(pid) {
  if (process.platform === "win32") execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
  else execSync(`kill -9 ${pid}`, { stdio: "ignore" });
}

let killed = 0;
for (const port of PORTS) {
  for (const pid of portOwnerPids(port)) {
    if (pid === process.pid) continue;
    try {
      const name = describe(pid);
      kill(pid);
      console.log(`[dev:stop] killed ${name} (pid ${pid}) on port ${port}`);
      killed += 1;
    } catch {
      console.warn(`[dev:stop] could not kill pid ${pid} on port ${port} (already gone?)`);
    }
  }
}
console.log(killed === 0 ? "[dev:stop] ports 3000/4002 are free — nothing to kill." : `[dev:stop] done. Run \`bun run dev\` to start fresh.`);
