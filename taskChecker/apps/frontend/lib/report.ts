"use client";

/** Minimal client error hook (audit P1).
 *
 * Every `console.error` site in realtime/audit/search funnels through
 * `reportError`, which:
 * - always logs to the console (dev visibility preserved), and
 * - forwards to Sentry when `NEXT_PUBLIC_SENTRY_DSN` is set. The SDK stays
 *   an opt-in peer: it is lazy-imported only when a DSN exists, so the
 *   default bundle pays nothing. To enable: set the DSN (the SDK,
 *   `@sentry/browser`, is already a dependency) and run the Sentry wizard
 *   for source maps.
 */
export function reportError(err: unknown, context: string, extra?: Record<string, unknown>): void {
  console.error(`[${context}]`, err, extra ?? "");
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn || typeof window === "undefined") return;
  void import("@sentry/browser")
    .then((sentry) => {
      const client = (sentry as unknown as { getClient?: () => unknown }).getClient?.();
      if (!client && typeof (sentry as unknown as { init?: unknown }).init === "function") {
        (sentry as unknown as { init: (o: unknown) => void }).init({ dsn });
      }
      (sentry as unknown as { captureException: (e: unknown, o?: unknown) => void }).captureException(err, {
        tags: { context },
        extra,
      });
    })
    .catch(() => {
      /* reporting must never break the app */
    });
}
