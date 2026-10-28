// `bun run dev:stop` — kills whatever owns the dev ports.
//
// Why this exists: when turbo dies natively (Windows exit 3221226505) or is
// killed abruptly, its children (next dev, bun --watch backend) survive
// orphaned and keep the dev ports (derived in scripts/dev-ports.mjs). Ctrl+C
// in the wrong terminal never reaches them, so the next `bun run dev` reports
// "Already running" for a dead session. This kills the port owners directly —
// including their whole process TREE: `bun --watch` runs a supervisor process
// that respawns the listening child if you kill only the child, so a port
// that is still busy afterwards has its supervisor chain killed too — scoped:
// never our own ancestors (that would kill the shell / dev.mjs that invoked
// us mid-run, which is exactly what silently broke the crash-retry once).
//
// Deliberately NOT a global command-line sweep: matching text like "next dev"
// or "src/index.ts" kills every such process on the machine — including other
// projects' dev sessions (that bit us for real: a sibling repo's session died
// in one sweep). Only port owners and their supervisor chains are killed.
//
// Refuses to run while a turbo supervisor looks healthy — use it after a
// crash, never to stop a healthy session. Override with `--force`.
//
// Usage:
//   bun run dev:stop          # refuse if a turbo supervisor seems alive
//   bun run dev:stop --force  # stop everything regardless
import { execFileSync, spawnSync } from "node:child_process";
import { getDevPorts } from "./dev-ports.mjs";

// Ports derived from the apps' own configs (scripts/dev-ports.mjs) — this
// list drifted from 3000 to 3005 once, so orphans on 3005 survived a sweep.
const PORTS = (await getDevPorts()).map((p) => p.port);
const MAX_RESTART_BOUNCES = 4; // bun --watch can respawn the listener; loop until port is quiet
const MAX_PARENT_HOPS = 16;

function exe(file, args, opts = {}) {
  return spawnSync(file, args, { encoding: "utf8", ...opts }).stdout || "";
}

// All LISTENING pids on the port, as seen by netstat (covers IPv4, IPv6 and
// [::1]-only binds — no socket-probe games).
function portOwnerPids(port) {
  if (process.platform === "win32") {
    const pids = new Set();
    for (const line of exe("netstat", ["-ano", "-p", "TCP"]).split("\n")) {
      const m = line.match(/TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/);
      if (m && Number(m[1]) === port) pids.add(Number(m[2]));
    }
    return [...pids];
  }
  return exe("lsof", ["-ti", `tcp:${port}`])
    .split("\n")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function winProcs(predicate) {
  // Win32_Process via PowerShell: ProcessId, ParentProcessId, Name,
  // CommandLine — one PS call. ParentProcessId lets us walk supervisor
  // chains of the port owners (see the parent-walk below).
  if (process.platform !== "win32") return [];
  const cmd =
    "$OutputEncoding=[Console]::OutputEncoding=[Text.Encoding]::UTF8; " +
    "Get-CimInstance Win32_Process | ForEach-Object { " +
    '"{0}`t{1}`t{2}`t{3}" -f $_.ProcessId, $_.ParentProcessId, $_.Name, $_.CommandLine }';
  const out = exe("powershell.exe", ["-NoProfile", "-Command", cmd]);
  return out
    .split("\n")
    .map((l) => {
      const parts = l.split("\t");
      return parts.length >= 3 && Number.isInteger(Number(parts[0]))
        ? {
            pid: Number(parts[0]),
            ppid: Number(parts[1]),
            name: parts[2] ?? "",
            cmdline: parts.slice(3).join("\t"),
          }
        : null;
    })
    .filter(Boolean)
    .filter(predicate);
}

function describe(pid) {
  if (process.platform === "win32") {
    const out = exe("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"]).trim();
    return (out.split('","')[0] || "").replace(/"/g, "") || `pid ${pid}`;
  }
  return exe("ps", ["-p", String(pid), "-o", "comm="]).trim() || `pid ${pid}`;
}

function killTree(pid) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    execFileSync("sh", ["-c", `kill -9 -${pid} 2>/dev/null; kill -9 ${pid} 2>/dev/null`], { stdio: "ignore" });
  }
}

const force = process.argv.slice(2).includes("--force");

// Refuse when a healthy-looking turbo supervisor is alive, unless --force.
if (!force && process.platform === "win32") {
  const out = exe("tasklist", ["/FO", "CSV", "/NH"]);
  const turboAlive = out.split("\n").filter((l) => /"?turbo"?\[?\.exe/i.test(l) && l.trim().length > 5).length;
  if (turboAlive > 0) {
    console.log(
      `[dev:stop] ${turboAlive} turbo supervisor process(es) look healthy — refusing.`,
    );
    console.log("[dev:stop] A live session may be running (check other terminals).");
    console.log("[dev:stop] To stop it anyway: bun run dev:stop --force");
    process.exit(0);
  }
}

let killed = 0;
for (const port of PORTS) {
  // Kill the current owner, then whatever rebinds (bun --watch respawn races
  // are real: the supervisor's child rebinds within ~50ms).
  for (let bounce = 0; bounce < MAX_RESTART_BOUNCES; bounce++) {
    const pids = portOwnerPids(port);
    if (pids.length === 0) break;
    for (const pid of pids) {
      if (pid === process.pid) continue;
      try {
        const name = describe(pid);
        killTree(pid);
        console.log(`[dev:stop] killed ${name} (pid ${pid}) on port ${port}` + (bounce > 0 ? " [respawn]" : ""));
        killed += 1;
      } catch {
        console.warn(`[dev:stop] could not kill pid ${pid} on port ${port} (already gone?)`);
      }
    }
  }
}

// Kill the supervisor chains of any still-busy port (win32). A `bun --watch`
// supervisor respawns its child within ~50ms, so killing only the listener
// never frees the port — the parent chain must go. Scoped guard: our own
// ancestor chain is off-limits (taskkill /T on it kills THIS process
// mid-run); anything above that line is reported instead of killed.
if (process.platform === "win32") {
  const busyBefore = PORTS.filter((port) => portOwnerPids(port).length > 0);
  for (const port of busyBefore) {
    const procs = winProcs((x) => Number.isInteger(x.pid));
    const byPid = new Map(procs.map((p) => [p.pid, p]));
    const protectedPids = new Set([process.pid]);
    for (let cur = process.ppid, hops = 0; byPid.has(cur) && hops < MAX_PARENT_HOPS; hops++) {
      protectedPids.add(cur);
      cur = byPid.get(cur).ppid;
    }
    for (const pid of portOwnerPids(port)) {
      let cur = byPid.get(pid)?.ppid;
      for (let hop = 0; byPid.has(cur) && hop < MAX_PARENT_HOPS; hop++) {
        if (protectedPids.has(cur)) break;
        const proc = byPid.get(cur);
        killTree(cur); // /T also reaps the rebound listener below it
        console.log(
          `[dev:stop] killed supervisor pid ${cur} → ${String(proc.cmdline || proc.name).slice(0, 60)}`,
        );
        killed += 1;
        cur = byPid.get(cur).ppid;
      }
    }
  }
  const remaining = PORTS.filter((port) => portOwnerPids(port).length > 0);
  if (remaining.length > 0) {
    console.log(`[dev:stop] WARNING: port(s) ${remaining.join(", ")} still held — a respawn supervisor above this terminal's chain may be alive.`);
    console.log("[dev:stop] Stop that terminal, or run `bun run dev:stop --force` again from a plain prompt.");
  }
}

console.log(
  killed === 0
    ? `[dev:stop] ports ${PORTS.join("/")} are free — nothing to kill.`
    : `[dev:stop] stopped ${killed} process(es). Run \`bun run dev\` to start fresh.`,
);
