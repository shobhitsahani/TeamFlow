"use client";

import { type ReactNode } from "react";
import { LagoonShell } from "@/components/lagoon/LagoonShell";

/**
 * AppShell renders the unified glassmorphic application shell.
 * Provides consistent floating glass sidebar, topbar, realtime sync status,
 * role badge, and ⌘K command palette across all surfaces.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return <LagoonShell>{children}</LagoonShell>;
}