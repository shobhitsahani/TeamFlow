"use client";

/* TeamFlow User avatar — shadcn Avatar primitive with Quiet Harbor tones.
   Single reusable avatar: initials fallback, Harbor-tone fill, optional
   online/offline status dot, loading skeleton at the same size. */

import { Avatar, AvatarFallback, AvatarBadge } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { lagoonAvatarTone, lagoonInitials } from "@/components/lagoon/lagoon-utils";

export type UserAvatarSize = "sm" | "default" | "lg";

const sizeSkeleton: Record<UserAvatarSize, string> = {
  sm: "size-6 shrink-0 rounded-full",
  default: "size-8 shrink-0 rounded-full",
  lg: "size-10 shrink-0 rounded-full",
};

export function UserAvatar({
  name,
  seed,
  size = "default",
  loading,
  status,
  className,
  title,
}: {
  /** Display name — initials derived here, never passed in pre-split. */
  name: string;
  /** Stable color seed (user id preferred, name fallback). */
  seed?: string;
  size?: UserAvatarSize;
  loading?: boolean;
  /** Online/offline dot where presence is useful; omitted by default. */
  status?: "online" | "offline";
  className?: string;
  title?: string;
}) {
  if (loading) {
    return <Skeleton aria-hidden className={cn(sizeSkeleton[size], className)} />;
  }
  const tone = lagoonAvatarTone(seed ?? name ?? "?");
  return (
    <Avatar size={size} title={title ?? name} className={className}>
      <AvatarFallback style={{ background: tone, color: "#fff" }}>
        {lagoonInitials(name || "?")}
      </AvatarFallback>
      {status ? (
        <AvatarBadge
          aria-label={status === "online" ? "Online" : "Offline"}
          style={{
            background: status === "online" ? "var(--lagoon-success)" : "var(--tf-muted)",
          }}
        />
      ) : null}
    </Avatar>
  );
}
