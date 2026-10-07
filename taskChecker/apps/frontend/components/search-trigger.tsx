"use client";

import { useState } from "react";
import { SearchIcon } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

/* ⌘K palette trigger — a real button (tab-reachable, Enter/Space opens),
   styled as a compact search field. Platform-aware hint: ⌘K on macOS,
   Ctrl K elsewhere. */
export function PaletteSearchTrigger({
  onOpen,
  className,
}: {
  onOpen: () => void;
  className?: string;
}) {
  const [mod] = useState<"cmd" | "ctrl">(() => {
    try {
      if (typeof navigator === "undefined") return "ctrl";
      return /mac|iphone|ipad/i.test(navigator.platform ?? "") ? "cmd" : "ctrl";
    } catch {
      return "ctrl";
    }
  });

  return (
    <button
      type="button"
      onClick={onOpen}
      title={
        mod === "cmd"
          ? "Search (⌘K)"
          : "Search (Ctrl K)"
      }
      aria-label={
        mod === "cmd"
          ? "Search — opens the command palette (Command K)"
          : "Search — opens the command palette (Control K)"
      }
      className={cn(
        "st-search cursor-pointer",
        "flex min-w-0 flex-1 items-center gap-2",
        "h-9 rounded-lg border border-border bg-muted/60 px-3",
        "text-sm text-muted-foreground",
        "transition-colors hover:bg-muted hover:text-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className
      )}
      style={{ maxWidth: 480, margin: "0 auto", width: "100%" }}
    >
      <SearchIcon aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left text-[13px]">
        Search…
      </span>
      <span className="flex shrink-0 items-center gap-1" aria-hidden>
        {mod === "cmd" ? (
          <>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </>
        ) : (
          <>
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </>
        )}
      </span>
    </button>
  );
}
