"use client";

/* Shared auth shell — one card spec for sign-in, sign-up, and invite flows:
   flat muted backdrop (no gradients), single brand lockup, one error style.
   No entrance animation: auth screens appear, they don't perform. */

import type { ReactNode } from "react";
import Image from "next/image";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatePresence, motion } from "@/components/motion";

export function AuthCard({
  sub,
  children,
  footer,
}: {
  sub: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="auth-page flex min-h-screen items-center justify-center bg-muted/40 p-4 sm:p-6">
      <Card className="auth-card w-full max-w-md overflow-hidden border-border/70 bg-card p-2 shadow-lg">
        <CardHeader className="items-center text-center">
          <Image
            src="/logo_mark.png"
            alt="TeamFlow"
            width={48}
            height={48}
            className="size-12 rounded-xl object-contain shadow-sm mb-1"
          />
          <CardTitle className="text-2xl">TeamFlow</CardTitle>
          <CardDescription>{sub}</CardDescription>
        </CardHeader>
        {children}
        {footer ? (
          <CardFooter className="justify-center border-t py-4">{footer}</CardFooter>
        ) : null}
      </Card>
    </div>
  );
}

/** Single error style for all auth flows (animated swap, role=alert). */
export function AuthError({ message }: { message: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={message}
        role="alert"
        className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive"
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
      >
        {message}
      </motion.p>
    </AnimatePresence>
  );
}

/** Leading icon inside an auth input (shared positioning). */
export function AuthFieldIcon({ children }: { children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
      {children}
    </span>
  );
}
