"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * bundle-dynamic-imports: Heavy components loaded on demand
 * Reduces initial bundle size by code-splitting
 */

/** Route-level code-split fallback: skeleton blocks, never bare text. */
function RouteSkeleton({ label }: { label: string }) {
  return (
    <div
      className="page-skeleton"
      role="status"
      aria-label={label}
      style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "stretch", textAlign: "left" }}
    >
      <Skeleton className="h-8 w-48 rounded" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}

// Board page - heavy with drag/drop, multiple columns, task cards
export const DynamicBoardPage = dynamic(
  () => import("@/app/app/board/page").then((mod) => mod.default),
  {
    loading: () => <RouteSkeleton label="Loading board" />,
    ssr: false,
  }
);

// Task detail page - comments, activity, sidebar
export const DynamicTaskDetailPage = dynamic(
  () => import("@/app/app/tasks/[id]/page").then((mod) => mod.default),
  {
    loading: () => <RouteSkeleton label="Loading task" />,
    ssr: false,
  }
);

// Integrations page - webhook forms, API key management
export const DynamicIntegrationsPage = dynamic(
  () => import("@/app/app/settings/integrations/page").then((mod) => mod.default),
  {
    loading: () => <RouteSkeleton label="Loading integrations" />,
    ssr: false,
  }
);

// Activity page - infinite scroll, filtering
export const DynamicActivityPage = dynamic(
  () => import("@/app/app/activity/page").then((mod) => mod.default),
  {
    loading: () => <RouteSkeleton label="Loading activity" />,
    ssr: false,
  }
);

// Audit log page - large data tables
export const DynamicAuditPage = dynamic(
  () => import("@/app/app/settings/audit/page").then((mod) => mod.default),
  {
    loading: () => <RouteSkeleton label="Loading audit log" />,
    ssr: false,
  }
);

// Members page - role management, invitations
export const DynamicMembersPage = dynamic(
  () => import("@/app/app/settings/members/page").then((mod) => mod.default),
  {
    loading: () => <RouteSkeleton label="Loading members" />,
    ssr: false,
  }
);

// Command palette - heavy with search, filtering, keyboard navigation
export const DynamicCommandPalette = dynamic(
  () => import("@/components/command-palette").then((mod) => mod.CommandPalette),
  {
    loading: () => <div className="cmdk-loading" role="status" aria-label="Loading command palette"><Skeleton className="mx-auto h-10 w-full max-w-md rounded-md" /></div>,
    ssr: false,
  }
);

// Notification sheet
export const DynamicNotifSheet = dynamic(
  () => import("@/components/notif-sheet").then((mod) => mod.NotifSheet),
  {
    loading: () => null,
    ssr: false,
  }
);