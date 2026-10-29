"use client";

/* TeamFlow User avatar — base-ui Avatar primitive with Quiet Harbor tones.
   Supports photo URLs, fallback initials with deterministic tinting, status badges,
   interactive camera edit overlay, and smooth framer-motion micro-interactions. */

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage, AvatarBadge } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { lagoonAvatarTone, lagoonInitials } from "@/components/lagoon/lagoon-utils";
import { motion, AnimatePresence } from "@/components/motion";

export type UserAvatarSize = "xs" | "sm" | "default" | "lg" | "xl" | "2xl";

const sizeClasses: Record<UserAvatarSize, { root: string; text: string; skeleton: string; iconSize: number }> = {
  xs: { root: "size-5 text-[10px]", text: "text-[9px]", skeleton: "size-5", iconSize: 10 },
  sm: { root: "size-6 text-xs", text: "text-[10px]", skeleton: "size-6", iconSize: 12 },
  default: { root: "size-8 text-sm", text: "text-xs", skeleton: "size-8", iconSize: 14 },
  lg: { root: "size-10 text-base", text: "text-sm", skeleton: "size-10", iconSize: 16 },
  xl: { root: "size-14 text-xl", text: "text-base font-semibold", skeleton: "size-14", iconSize: 20 },
  "2xl": { root: "size-20 text-2xl", text: "text-xl font-bold", skeleton: "size-20", iconSize: 24 },
};

export function UserAvatar({
  name,
  src,
  seed,
  size = "default",
  loading,
  status,
  editable,
  onPhotoClick,
  className,
  title,
}: {
  /** Display name — initials derived here if no photo or on image error */
  name: string;
  /** Photo image URL or data URI */
  src?: string | null;
  /** Stable color seed (user id preferred, name fallback). */
  seed?: string;
  size?: UserAvatarSize;
  loading?: boolean;
  /** Online/offline/busy status dot */
  status?: "online" | "offline" | "busy" | "away";
  /** If true, show a camera hover overlay for photo editing */
  editable?: boolean;
  /** Click handler for photo edit / preview */
  onPhotoClick?: () => void;
  className?: string;
  title?: string;
}) {
  const [imageError, setImageError] = useState(false);
  const cfg = sizeClasses[size] ?? sizeClasses.default;

  if (loading) {
    return <Skeleton aria-hidden className={cn(cfg.skeleton, "shrink-0 rounded-full", className)} />;
  }

  const tone = lagoonAvatarTone(seed ?? name ?? "?");
  const hasPhoto = Boolean(src && !imageError);

  const statusColor =
    status === "online"
      ? "var(--lagoon-success, #22c55e)"
      : status === "busy"
        ? "var(--lagoon-danger, #ef4444)"
        : status === "away"
          ? "var(--lagoon-gold, #f59e0b)"
          : "var(--tf-muted, #64748b)";

  const content = (
    <div className="relative inline-flex shrink-0">
      <Avatar
        size={size === "xs" ? "sm" : size === "xl" || size === "2xl" ? "lg" : size}
        title={title ?? name}
        className={cn(
          "relative overflow-hidden ring-1 ring-white/10 transition-all duration-200",
          cfg.root,
          editable && "cursor-pointer group",
          className,
        )}
      >
        {hasPhoto ? (
          <AvatarImage
            src={src!}
            alt={name || "User photo"}
            className="aspect-square size-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImageError(true)}
          />
        ) : null}
        <AvatarFallback
          style={{ background: tone, color: "#fff" }}
          className={cn("font-medium tracking-tight", cfg.text)}
        >
          {lagoonInitials(name || "?")}
        </AvatarFallback>

        {editable ? (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100"
            aria-label="Change photo"
          >
            <svg
              width={cfg.iconSize}
              height={cfg.iconSize}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
          </div>
        ) : null}
      </Avatar>

      {status ? (
        <span
          data-slot="avatar-badge"
          aria-label={`Status: ${status}`}
          className="absolute right-0 bottom-0 z-10 rounded-full ring-2 ring-background select-none"
          style={{
            background: statusColor,
            width: size === "xs" || size === "sm" ? 7 : size === "default" ? 9 : 12,
            height: size === "xs" || size === "sm" ? 7 : size === "default" ? 9 : 12,
          }}
        />
      ) : null}
    </div>
  );

  if (editable && onPhotoClick) {
    return (
      <motion.button
        type="button"
        onClick={onPhotoClick}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className="relative inline-flex p-0 bg-transparent border-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-full"
        title={title ?? `Change photo for ${name}`}
      >
        {content}
      </motion.button>
    );
  }

  return content;
}
