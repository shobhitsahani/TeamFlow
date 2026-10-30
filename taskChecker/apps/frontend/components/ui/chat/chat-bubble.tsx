"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Blobatar } from "@blobatar/react";
import { Check, CheckCheck, Copy, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

// ============================================================================
// ChatBubble Container
// ============================================================================

const chatBubbleVariants = cva("group relative w-full transition-colors", {
  variants: {
    variant: {
      received: "flex justify-start items-start gap-2.5",
      sent: "flex justify-end items-start",
    },
    layout: {
      stream: "flex justify-start items-start gap-3 px-3 py-1.5 -mx-1 rounded-xl hover:bg-white/[0.04]",
      bubble: "w-full",
    },
  },
  defaultVariants: {
    variant: "received",
    layout: "stream",
  },
});

export interface ChatBubbleProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof chatBubbleVariants> {
  isCompact?: boolean;
}

export const ChatBubble = React.forwardRef<HTMLDivElement, ChatBubbleProps>(
  ({ className, variant, layout = "stream", isCompact = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          chatBubbleVariants({ variant, layout }),
          layout === "bubble" ? (isCompact ? "mt-0.5" : "mt-2.5 mb-0.5") : (isCompact ? "pt-0 pb-0.5" : "pt-1.5 pb-0.5"),
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ChatBubble.displayName = "ChatBubble";

// ============================================================================
// ChatBubbleAvatar
// ============================================================================

export interface ChatBubbleAvatarProps {
  src?: string;
  name: string;
  fallback?: string;
  className?: string;
  size?: "sm" | "default" | "lg";
  isOnline?: boolean;
}

export function ChatBubbleAvatar({
  src,
  name,
  fallback,
  className,
  size = "default",
  isOnline,
}: ChatBubbleAvatarProps) {
  const sizePx = size === "sm" ? "size-7" : size === "lg" ? "size-10" : "size-8";
  const initials = (fallback || name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={cn("relative shrink-0 select-none", sizePx, className)}>
      {src ? (
        <Avatar className="size-full">
          <AvatarImage src={src} alt={name} />
          <AvatarFallback className="text-xs font-medium bg-[#1e2638] text-slate-200">
            {initials}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="size-full rounded-full overflow-hidden bg-[#1a2232] ring-1 ring-white/12 shadow-xs">
          <Blobatar
            name={name}
            animate="hover"
            title={name}
            className="size-full object-cover"
          />
        </div>
      )}
      {isOnline !== undefined && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-[#0c1017]",
            isOnline ? "bg-emerald-500" : "bg-slate-500"
          )}
          title={isOnline ? "Online" : "Offline"}
        />
      )}
    </div>
  );
}

// ============================================================================
// ChatBubbleMessage
// ============================================================================

const chatBubbleMessageVariants = cva(
  "relative text-sm select-text transition-all duration-150 leading-relaxed [overflow-wrap:anywhere]",
  {
    variants: {
      variant: {
        received:
          "bg-[#18202d] text-slate-100 border border-white/8 rounded-2xl shadow-sm px-3.5 py-2",
        sent:
          "bg-indigo-600 text-white rounded-2xl shadow-sm px-3.5 py-2",
      },
      layout: {
        stream: "w-full bg-transparent border-0 shadow-none p-0 text-slate-200",
        bubble: "w-fit max-w-full min-w-0",
      },
    },
    defaultVariants: {
      variant: "received",
      layout: "stream",
    },
  }
);

export interface ChatBubbleMessageProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof chatBubbleMessageVariants> {
  isLoading?: boolean;
}

export const ChatBubbleMessage = React.forwardRef<HTMLDivElement, ChatBubbleMessageProps>(
  ({ className, variant, layout = "stream", isLoading, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(chatBubbleMessageVariants({ variant, layout }), className)}
        {...props}
      >
        {isLoading ? (
          <div className="flex items-center gap-1.5 py-1">
            <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
            <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
            <span className="size-1.5 rounded-full bg-current animate-bounce" />
          </div>
        ) : (
          children
        )}
      </div>
    );
  }
);
ChatBubbleMessage.displayName = "ChatBubbleMessage";

// ============================================================================
// ChatBubbleTimestamp
// ============================================================================

export interface ChatBubbleTimestampProps extends React.HTMLAttributes<HTMLSpanElement> {
  timestamp: string;
  isSent?: boolean;
}

export function ChatBubbleTimestamp({
  timestamp,
  isSent,
  className,
  ...props
}: ChatBubbleTimestampProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] text-slate-400 select-none font-mono whitespace-nowrap",
        className
      )}
      {...props}
    >
      <span>{timestamp}</span>
      {isSent && <CheckCheck className="size-3 text-indigo-300" aria-label="Sent" />}
    </span>
  );
}

// ============================================================================
// ChatBubbleAction Bar (Floating on hover)
// ============================================================================

export interface ChatBubbleActionProps {
  quickEmojis?: string[];
  onReact?: (emoji: string) => void;
  onCopy?: () => void;
  onDelete?: () => void;
  isOwn?: boolean;
  className?: string;
}

export function ChatBubbleAction({
  quickEmojis = ["👍", "❤️", "😂", "🎉", "🔥", "👀"],
  onReact,
  onCopy,
  onDelete,
  isOwn,
  className,
}: ChatBubbleActionProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (onCopy) {
      onCopy();
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div
      className={cn(
        "absolute -top-7 z-20 hidden group-hover:flex items-center gap-0.5",
        isOwn ? "right-0" : "left-0",
        "rounded-lg border border-white/12 bg-[#161c28]/98 backdrop-blur-md px-1 py-0.5 shadow-xl",
        "animate-in fade-in zoom-in-95 duration-100",
        className
      )}
    >
      {onReact &&
        quickEmojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="flex size-6 items-center justify-center rounded hover:bg-white/10 text-sm transition-transform active:scale-115"
            title={`React ${emoji}`}
            onClick={() => onReact(emoji)}
          >
            {emoji}
          </button>
        ))}

      {onCopy && (
        <button
          type="button"
          className="flex size-6 items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title={copied ? "Copied!" : "Copy message"}
          onClick={handleCopy}
        >
          {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
        </button>
      )}

      {isOwn && onDelete && (
        <button
          type="button"
          className="flex size-6 items-center justify-center rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          title="Delete message"
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// ChatBubbleReactions Row
// ============================================================================

export interface ReactionItem {
  emoji: string;
  count: number;
  userIds: string[];
  reactedByMe?: boolean;
}

export interface ChatBubbleReactionsProps {
  reactions: ReactionItem[];
  onReact: (emoji: string) => void;
  className?: string;
}

export function ChatBubbleReactions({
  reactions,
  onReact,
  className,
}: ChatBubbleReactionsProps) {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 mt-1", className)}>
      {reactions.map((r) => {
        const isMe = r.reactedByMe;
        return (
          <motion.button
            key={r.emoji}
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => onReact(r.emoji)}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs transition-all duration-150 border select-none",
              isMe
                ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300 font-medium shadow-xs"
                : "bg-[#18202d] border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
            )}
            title={`${r.count} ${r.count === 1 ? "reaction" : "reactions"}`}
          >
            <span>{r.emoji}</span>
            <span className="text-[11px] font-semibold font-mono">{r.count}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
