"use client";

import * as React from "react";
import { ArrowDown, Hash, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

// ============================================================================
// ChatMessageList
// ============================================================================

export interface ChatMessageListProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  autoScroll?: boolean;
}

export interface ChatMessageListRef {
  scrollToBottom: (smooth?: boolean) => void;
  scrollElement: HTMLDivElement | null;
}

export const ChatMessageList = React.forwardRef<ChatMessageListRef, ChatMessageListProps>(
  ({ className, children, autoScroll = true, ...props }, ref) => {
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const [isAtBottom, setIsAtBottom] = React.useState(true);

    const scrollToBottom = React.useCallback((smooth = true) => {
      if (!scrollRef.current) return;
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
      setIsAtBottom(true);
    }, []);

    React.useImperativeHandle(ref, () => ({
      scrollToBottom,
      scrollElement: scrollRef.current,
    }));

    const handleScroll = React.useCallback(() => {
      if (!scrollRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 60;
      setIsAtBottom(atBottom);
    }, []);

    return (
      <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-[#0c1017]">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className={cn(
            "h-full w-full overflow-y-auto px-4 md:px-6 pt-4 pb-8 space-y-1 scroll-smooth",
            "[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.1)_transparent]",
            className
          )}
          {...props}
        >
          {children}
        </div>

        {/* Floating jump to bottom button */}
        <AnimatePresence>
          {!isAtBottom && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20"
            >
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full shadow-2xl border border-white/12 gap-1.5 px-3.5 py-1 text-xs bg-[#161c28]/95 backdrop-blur-md hover:bg-[#1e2636] text-white"
                onClick={() => scrollToBottom(true)}
              >
                <ArrowDown className="size-3.5" />
                <span>Jump to present</span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
ChatMessageList.displayName = "ChatMessageList";

// ============================================================================
// ChatDayDivider
// ============================================================================

export interface ChatDayDividerProps {
  label: string;
  className?: string;
}

export function ChatDayDivider({ label, className }: ChatDayDividerProps) {
  return (
    <div className={cn("relative flex items-center justify-center my-6 py-1 select-none", className)}>
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-white/8" />
      </div>
      <div className="relative flex justify-center">
        <span className="px-3 py-0.5 text-[11px] font-semibold text-slate-400 bg-[#121722] border border-white/10 rounded-full shadow-xs">
          {label}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// ChatTypingIndicator
// ============================================================================

export interface ChatTypingIndicatorProps {
  typingUsers: string[];
  className?: string;
}

export function ChatTypingIndicator({ typingUsers, className }: ChatTypingIndicatorProps) {
  if (!typingUsers || typingUsers.length === 0) return null;

  const text =
    typingUsers.length === 1
      ? `${typingUsers[0]} is typing…`
      : typingUsers.length === 2
      ? `${typingUsers[0]} and ${typingUsers[1]} are typing…`
      : `${typingUsers.slice(0, 2).join(", ")} and ${typingUsers.length - 2} more are typing…`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className={cn("flex items-center gap-2 px-6 py-1 text-xs text-slate-400 select-none bg-[#0c1017]", className)}
    >
      <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-full border border-white/8">
        <span className="size-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]" />
        <span className="size-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]" />
        <span className="size-1.5 rounded-full bg-indigo-400 animate-bounce" />
      </div>
      <span className="italic">{text}</span>
    </motion.div>
  );
}

// ============================================================================
// ChatEmptyState
// ============================================================================

export interface ChatEmptyStateProps {
  channelName: string;
  onQuickPrompt?: (prompt: string) => void;
  className?: string;
}

export function ChatEmptyState({
  channelName,
  onQuickPrompt,
  className,
}: ChatEmptyStateProps) {
  const suggestions = ["👋 Say hello", "🎉 Welcome team", "📌 Share project updates"];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-20 px-4 text-center select-none max-w-md mx-auto",
        className
      )}
    >
      <div className="size-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400 mb-4 shadow-xl">
        <Hash className="size-7" />
      </div>
      <h3 className="text-lg font-bold tracking-tight text-white">
        Welcome to #{channelName}!
      </h3>
      <p className="text-sm text-slate-400 mt-1.5 max-w-xs leading-relaxed">
        This is the start of the #{channelName} channel. Start the conversation, share files, or mention teammates with @.
      </p>

      {onQuickPrompt && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onQuickPrompt(s.slice(2).trim())}
              className="text-xs bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-full px-3 py-1 transition-all active:scale-95"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
