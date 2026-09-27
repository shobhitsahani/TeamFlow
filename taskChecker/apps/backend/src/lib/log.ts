/** Structured logging (audit P1) — the single replacement for ad-hoc
 * `console.*` in request/worker paths.
 *
 * - Production (`NODE_ENV=production`): one JSON object per line
 *   (`{ ts, level, msg, ...fields }`) so collectors can parse it; always
 *   includes the request id when logged with `log.child({ requestId })`.
 * - Development: terse `ts [level] msg {fields}` text on stdout/stderr.
 * - Level floor from `LOG_LEVEL` (debug|info|warn|error, default info).
 * - Zero dependencies (Bun + Node safe). Never logs secrets — callers pass
 *   only redacted fields (see config.ts: "Never logs secrets").
 */
type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function parseLevel(raw: string | undefined): Level {
  return raw === "debug" || raw === "info" || raw === "warn" || raw === "error" ? raw : "info";
}

export type LogFields = Record<string, unknown>;

function render(level: Level, msg: string, fields: LogFields): string {
  const rec = { ts: new Date().toISOString(), level, msg, ...fields };
  if (process.env.NODE_ENV === "production") return JSON.stringify(rec);
  const extra = Object.keys(fields).length > 0 ? ` ${JSON.stringify(fields)}` : "";
  return `${rec.ts} [${level}] ${msg}${extra}`;
}

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  child(bindings: LogFields): Logger;
}

function makeLogger(bindings: LogFields): Logger {
  const min = ORDER[parseLevel(process.env.LOG_LEVEL)];
  const emit = (level: Level, msg: string, fields: LogFields = {}) => {
    if (ORDER[level] < min) return;
    const line = render(level, msg, { ...bindings, ...fields });
    (level === "error" || level === "warn" ? process.stderr : process.stdout).write(line + "\n");
  };
  return {
    debug: (msg, fields) => emit("debug", msg, fields),
    info: (msg, fields) => emit("info", msg, fields),
    warn: (msg, fields) => emit("warn", msg, fields),
    error: (msg, fields) => emit("error", msg, fields),
    child: (extra) => makeLogger({ ...bindings, ...extra }),
  };
}

export const log: Logger = makeLogger({});
