"use client";

/* Sign in with Google (Google Identity Services).
 * Renders the official Google button; the returned ID token is exchanged at
 * POST /v1/auth/google for a TeamFlow session (login-or-signup). Requires
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID — without it a disabled placeholder renders. */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: {
            client_id: string;
            callback: (resp: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            el: HTMLElement,
            opts: { theme?: string; size?: string; width?: number; text?: string; shape?: string },
          ) => void;
          cancel: () => void;
          /** One-Tap prompt for custom-styled buttons (same ID credential callback). */
          prompt: (
            cb?: (n: {
              isNotDisplayed: () => boolean;
              isSkippedMoment: () => boolean;
              isDismissedMoment: () => boolean;
            }) => void,
          ) => void;
        };
      };
    };
  }
}

const GSI_SRC = "https://accounts.google.com/gsi/client";

let gsiPromise: Promise<void> | null = null;
function loadGsi(): Promise<void> {
  if (typeof window !== "undefined" && window.google?.accounts?.id) return Promise.resolve();
  gsiPromise ??= new Promise<void>((resolve, reject) => {
    const el = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    if (el) {
      el.addEventListener("load", () => resolve(), { once: true });
      el.addEventListener("error", () => reject(new Error("gsi load failed")), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("gsi load failed"));
    document.head.appendChild(s);
  });
  return gsiPromise;
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5c-.1 1.1-.8 2.7-2.4 3.8l-.1.1 3.5 2.7.2.1c2.2-2 3.8-5 3.8-8.9Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5l-.1.1-3.6 2.8v.1C3.5 21.4 7.5 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-.1-.1-3.6-2.8-.1.1C.5 8.7 0 10.2 0 12s.5 3.3 1.4 4.7l3.8-2.3Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.5 0 3.5 2.6 1.4 6.8l3.8 2.9c1-2.9 3.7-5 6.8-5Z"
      />
    </svg>
  );
}

export function GoogleSignInButton({
  orgName,
  onError,
  text = "continue_with",
  variant = "official",
}: {
  /** Org name for newly provisioned accounts (sign-up form value). */
  orgName?: string;
  onError: (message: string) => void;
  text?: "signin_with" | "signup_with" | "continue_with";
  /** official = Google-rendered button; custom = app-styled two-line button
   * (matches the GitHub button) that opens the same One-Tap flow. */
  variant?: "official" | "custom";
}) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const router = useRouter();
  const { loginWithGoogle } = useAuth();
  const slotRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  /** Set the moment a credential arrives — a later "dismissed" prompt moment
   * is just One-Tap closing after success, not a failure. Reset per attempt. */
  const credentialSeen = useRef(false);
  const live = useRef({ loginWithGoogle, onError, orgName, text, variant });
  useEffect(() => {
    live.current = { loginWithGoogle, onError, orgName, text, variant };
  });

  useEffect(() => {
    if (!clientId) return;
    if (variant === "official" && !slotRef.current) return;
    let cancelled = false;
    loadGsi()
      .then(() => {
        if (cancelled || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: (resp) => {
            const credential = resp?.credential;
            if (!credential) {
              live.current.onError("Google sign-in was cancelled. Try again.");
              return;
            }
            credentialSeen.current = true;
            setBusy(true);
            const org = live.current.orgName?.trim();
            live.current
              .loginWithGoogle(credential, org ? org : undefined)
              .then(() => {
                router.push("/app/board");
                router.refresh();
              })
              .catch((err: unknown) => {
                live.current.onError(err instanceof Error ? err.message : "Google sign-in failed");
              })
              .finally(() => setBusy(false));
          },
        });
        if (live.current.variant === "official" && slotRef.current) {
          slotRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(slotRef.current, {
            theme: "outline",
            size: "large",
            width: 340,
            text: live.current.text,
            shape: "rectangular",
          });
        }
      })
      .catch(() => {
        if (!cancelled) live.current.onError("Could not load Google sign-in. Check your connection and retry.");
      });
    return () => {
      cancelled = true;
      try {
        window.google?.accounts?.id?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, [clientId, router, variant]);

  const openOneTap = () => {
    if (!window.google) {
      live.current.onError("Could not load Google sign-in. Check your connection and retry.");
      return;
    }
    credentialSeen.current = false;
    setBusy(true);
    try {
      window.google.accounts.id.prompt((moment) => {
        // A credential already in flight means this dismissal is One-Tap
        // closing after success — never an error.
        if (credentialSeen.current) return;
        // Credential arrives via the initialize callback; these are the dead
        // ends (origin not allowlisted yet, popup blocked, tap dismissed)
        // that never will. Naming the origin tells the user exactly which
        // string belongs in the console's JavaScript origins list.
        if (moment.isNotDisplayed() || moment.isSkippedMoment() || moment.isDismissedMoment()) {
          setBusy(false);
          live.current.onError(
            `Google sign-in didn't open from ${window.location.origin}. Allowlist that exact origin, or continue with email.`,
          );
        }
      });
    } catch {
      setBusy(false);
      live.current.onError("Google sign-in didn't open. Allow popups, or continue with email.");
    }
  };

  if (!clientId) {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled
        title="Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google sign-in"
      >
        <GoogleGlyph />
        Continue with Google (not configured)
      </Button>
    );
  }

  if (variant === "custom") {
    return (
      <button
        type="button"
        onClick={openOneTap}
        disabled={busy}
        aria-busy={busy}
        className="flex items-center justify-center rounded-xl border border-white/10 px-4 py-3 hover:bg-white/5 disabled:opacity-60"
      >
        <GoogleGlyph />
        <span className="ml-2 text-center text-sm font-medium leading-snug text-slate-800 dark:text-gray-200">
          Continue with
          <br />
          Google
        </span>
      </button>
    );
  }

  return (
    <div className="relative" aria-busy={busy}>
      <div ref={slotRef} className="flex min-h-10 items-center justify-center" />
      {busy ? (
        <p className="mt-2 text-center text-[13px] text-muted-foreground" role="status">
          Signing you in with Google…
        </p>
      ) : null}
    </div>
  );
}
