"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { IconGrip } from "../icons";

/* shadcn/ui resizable template — adapted for the chat rail.
   Mirrors the official shadcn ResizableHandle look (thin border rail +
   centered grip pill) but works with the rail's custom pointer-drag logic
   so width stays persisted + clamped without pulling in
   react-resizable-panels. */

type ChatResizeHandleProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "onPointerDown"
> & {
  dragging?: boolean;
  width?: number;
  minW?: number;
  maxW?: number;
  onResizeStart?: (e: React.PointerEvent<HTMLDivElement>) => void;
};

function ChatResizeHandle({
  className,
  dragging,
  width,
  minW,
  maxW,
  children,
  onResizeStart,
  ...props
}: ChatResizeHandleProps) {
  return (
    <div
      data-slot="resizable-handle"
      data-dragging={dragging ? "true" : undefined}
      className={cn(
        "st-chat-resize group",
        "relative z-20 flex w-4 -translate-x-2 items-center justify-center",
        "cursor-grab active:cursor-grabbing",
        "touch-none outline-none select-none",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        "after:bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:content-[\"\"]",
        dragging && "is-dragging",
        className,
      )}
      {...props}
      onPointerDown={onResizeStart}
    >
      {/* Grip pill — fades in on hover / focus, solid while dragging */}
      <span
        aria-hidden
        className={cn(
          "bg-background text-muted-foreground border-border relative z-10",
          "flex h-10 w-5 items-center justify-center rounded-full border shadow-sm",
          "transition-all duration-200 ease-out",
          "scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100",
          "group-focus-visible:scale-100 group-focus-visible:opacity-100",
          dragging && "border-primary bg-primary text-primary-foreground scale-100 opacity-100 shadow-md",
        )}
      >
        <IconGrip size={12} />
      </span>

      {/* Screen-reader + hover hint for min/max */}
      {typeof minW === "number" && typeof maxW === "number" ? (
        <span className="sr-only">
          Width {Math.round(width ?? 0)} pixels, range {minW} to {maxW}
        </span>
      ) : null}

      {children}
    </div>
  );
}

export { ChatResizeHandle };
