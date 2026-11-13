"use client";

import React from "react";
import { cx } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Shield, ShieldAlert, ShieldCheck, Eye } from "lucide-react";

export type TenantRole = "owner" | "admin" | "member" | "viewer" | string;

export interface RoleBadgeProps {
  role?: TenantRole;
  className?: string;
  showTooltip?: boolean;
}

export function RoleBadge({ role = "member", className, showTooltip = true }: RoleBadgeProps) {
  const normalized = (role ?? "member").toLowerCase();

  const configs: Record<
    string,
    { label: string; icon: React.ComponentType<{ className?: string }>; classes: string; tooltip: string }
  > = {
    owner: {
      label: "Owner",
      icon: ShieldAlert,
      classes: "bg-purple-500/15 border-purple-500/30 text-purple-300 dark:text-purple-200",
      tooltip: "Workspace Owner • Full administrative & billing permissions",
    },
    admin: {
      label: "Admin",
      icon: ShieldCheck,
      classes: "bg-indigo-500/15 border-indigo-500/30 text-indigo-300 dark:text-indigo-200",
      tooltip: "Workspace Admin • Can manage members, projects, and permissions",
    },
    member: {
      label: "Member",
      icon: Shield,
      classes: "bg-blue-500/15 border-blue-500/30 text-blue-300 dark:text-blue-200",
      tooltip: "Workspace Member • Can create, edit, move cards, and collaborate",
    },
    viewer: {
      label: "Viewer • Read Only",
      icon: Eye,
      classes: "bg-amber-500/15 border-amber-500/30 text-amber-300 dark:text-amber-200",
      tooltip: "Viewer Role • Can view boards and tasks in read-only mode",
    },
  };

  const current = configs[normalized] ?? {
    label: role,
    icon: Shield,
    classes: "bg-slate-500/15 border-slate-500/30 text-slate-300",
    tooltip: `Role: ${role}`,
  };

  const Icon = current.icon;

  const badge = (
    <span
      className={cx(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md border tracking-tight select-none",
        current.classes,
        className
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span>{current.label}</span>
    </span>
  );

  if (!showTooltip) return badge;

  return (
    <Tooltip>
      <TooltipTrigger render={badge} />
      <TooltipContent className="text-xs max-w-xs">{current.tooltip}</TooltipContent>
    </Tooltip>
  );
}
