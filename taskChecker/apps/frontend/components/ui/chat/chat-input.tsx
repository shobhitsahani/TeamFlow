"use client";

import * as React from "react";
import {
  AtSign,
  FileAudio,
  FileText,
  Mic,
  Paperclip,
  Send,
  Smile,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Blobatar } from "@blobatar/react";
import { motion, AnimatePresence } from "framer-motion";

export interface AttachmentItem {
  url: string;
  name: string;
  mime: string;
  size?: number;
}

export interface MentionUser {
  userId: string;
  name: string | null;
  email: string | null;
  status?: string;
}

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  attachments?: AttachmentItem[];
  onRemoveAttachment?: (index: number) => void;
  onAttachFiles?: (files: FileList | File[]) => void;
  mentionQuery?: string | null;
  mentionUsers?: MentionUser[];
  onSelectMention?: (user: MentionUser) => void;
  mentionIndex?: number;
  className?: string;
}

const EMOJI_CATEGORIES = [
  { label: "Frequent", emojis: ["👍", "❤️", "😂", "🎉", "🔥", "👀", "🙌", "🚀"] },
  { label: "Smiles", emojis: ["😀", "😅", "😊", "🥳", "😎", "🤔", "🫡", "🤩"] },
  { label: "Hands", emojis: ["👋", "👏", "🤝", "💪", "✌️", "✨", "💯", "⭐"] },
];

export const ChatInput = React.forwardRef<HTMLTextAreaElement, ChatInputProps>(
  (
    {
      value,
      onChange,
      onSubmit,
      disabled,
      placeholder = "Write a message…",
      attachments = [],
      onRemoveAttachment,
      onAttachFiles,
      mentionQuery,
      mentionUsers = [],
      onSelectMention,
      mentionIndex = 0,
      className,
    },
    ref
  ) => {
    const internalRef = React.useRef<HTMLTextAreaElement | null>(null);
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement | null>) || internalRef;
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const audioInputRef = React.useRef<HTMLInputElement>(null);
    const [emojiOpen, setEmojiOpen] = React.useState(false);

    // Auto-resize textarea height
    React.useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      const maxHeight = 160;
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    }, [value, textareaRef]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (mentionQuery && mentionUsers.length > 0) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === "Tab") {
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if ((value.trim().length > 0 || attachments.length > 0) && !disabled) {
          onSubmit();
        }
      }
    };

    const handleEmojiClick = (emoji: string) => {
      onChange(value + emoji);
      setEmojiOpen(false);
      textareaRef.current?.focus();
    };

    const handleAtClick = () => {
      const current = value;
      const endsWithSpace = current.length === 0 || /\s$/.test(current);
      onChange(endsWithSpace ? `${current}@` : `${current} @`);
      textareaRef.current?.focus();
    };

    const canSend = (value.trim().length > 0 || attachments.length > 0) && !disabled;

    return (
      <div
        className={cn(
          "relative flex flex-col rounded-xl border border-[var(--tf-border)] bg-[var(--tf-card-bg)] shadow-md text-[var(--tf-fg)]",
          "focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/20 transition-all duration-150",
          className
        )}
      >
        {/* Mention Autocomplete popup */}
        <AnimatePresence>
          {mentionQuery !== null && mentionUsers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              className="absolute bottom-[calc(100%+8px)] left-0 right-0 z-50 rounded-xl border border-[var(--tf-border-strong)] bg-[var(--tf-card-bg)]/98 backdrop-blur-xl p-1.5 shadow-2xl"
            >
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--tf-fg-muted)] border-b border-[var(--tf-border)] mb-1">
                Mention member — @{mentionQuery || "…"}
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5 [scrollbar-width:thin]">
                {mentionUsers.map((u, i) => {
                  const displayName = u.name || u.email || "Member";
                  const handle = u.name
                    ? u.name.replace(/\s+/g, "").toLowerCase()
                    : (u.email?.split("@")[0] ?? "").replace(/[^a-zA-Z0-9_]/g, "");
                  const isSelected = i === mentionIndex;

                  return (
                    <button
                      key={u.userId}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onSelectMention?.(u);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors",
                        isSelected
                          ? "bg-purple-600 text-white font-medium shadow-xs"
                          : "hover:bg-[var(--tf-hover-bg)] text-[var(--tf-fg)]"
                      )}
                    >
                      <div className="size-6 shrink-0 rounded-full overflow-hidden bg-[var(--tf-hover-bg)] ring-1 ring-[var(--tf-border)]">
                        <Blobatar name={displayName} className="size-full" />
                      </div>
                      <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{displayName}</span>
                        <span
                          className={cn(
                            "text-[10px] font-mono",
                            isSelected ? "text-purple-200" : "text-[var(--tf-fg-muted)]"
                          )}
                        >
                          @{handle}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pending attachments strip */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-2.5 border-b border-[var(--tf-border)] bg-[var(--tf-hover-bg)]/30 rounded-t-xl">
            {attachments.map((att, idx) => {
              const isImg = att.mime.startsWith("image/");
              const isAudio = att.mime.startsWith("audio/");

              return (
                <div
                  key={att.url || `${att.name}-${idx}`}
                  className="group/att relative flex items-center gap-2 bg-[var(--tf-card-bg)] border border-[var(--tf-border)] rounded-lg p-1.5 pr-2 shadow-xs max-w-xs"
                >
                  {isImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={att.url}
                      alt={att.name}
                      className="size-8 rounded object-cover border border-[var(--tf-border)]"
                    />
                  ) : isAudio ? (
                    <div className="size-8 rounded bg-purple-500/20 flex items-center justify-center text-purple-500 dark:text-purple-400">
                      <FileAudio className="size-4" />
                    </div>
                  ) : (
                    <div className="size-8 rounded bg-[var(--tf-hover-bg)] flex items-center justify-center text-[var(--tf-fg-muted)]">
                      <FileText className="size-4" />
                    </div>
                  )}
                  <span className="text-xs truncate max-w-[120px] font-medium text-[var(--tf-fg)]">
                    {att.name}
                  </span>
                  {onRemoveAttachment && (
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(idx)}
                      className="size-5 rounded-full hover:bg-[var(--tf-hover-bg)] flex items-center justify-center text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] transition-colors ml-1"
                      title="Remove attachment"
                      aria-label="Remove attachment"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Textarea — borderless, outline-free */}
        <div className="px-4 pt-3 pb-1">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            style={{
              border: "none",
              outline: "none",
              boxShadow: "none",
              background: "transparent",
            }}
            className={cn(
              "w-full resize-none text-sm leading-relaxed text-[var(--tf-fg)] placeholder:text-[var(--tf-fg-muted)]",
              "!border-none !outline-none !shadow-none !ring-0 focus:!outline-none focus:!ring-0 focus:!border-none !p-0 min-h-[36px] max-h-40"
            )}
          />
        </div>

        {/* Bottom actions toolbar */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5">
          {/* Left toolbar items */}
          <div className="flex items-center gap-0.5">
            {/* Attachment */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] hover:bg-[var(--tf-hover-bg)] rounded-lg"
              title="Attach image or file"
              aria-label="Attach file"
              onClick={() => {
                fileInputRef.current?.click();
              }}
            >
              <Paperclip className="size-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,audio/*"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) onAttachFiles?.(e.target.files);
                e.target.value = "";
              }}
            />

            {/* Audio upload */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] hover:bg-[var(--tf-hover-bg)] rounded-lg"
              title="Attach audio note"
              aria-label="Attach audio note"
              onClick={() => {
                audioInputRef.current?.click();
              }}
            >
              <Mic className="size-4" />
            </Button>
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              hidden
              onChange={(e) => {
                if (e.target.files) onAttachFiles?.(e.target.files);
                e.target.value = "";
              }}
            />

            {/* Mention trigger */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] hover:bg-[var(--tf-hover-bg)] rounded-lg"
              title="Mention member (@)"
              aria-label="Mention member"
              onClick={handleAtClick}
            >
              <AtSign className="size-4" />
            </Button>

            {/* Emoji Popover */}
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger
                type="button"
                className={cn(
                  "inline-flex items-center justify-center size-7 text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] hover:bg-[var(--tf-hover-bg)] rounded-lg transition-colors cursor-pointer",
                  emojiOpen && "bg-[var(--tf-hover-bg)] text-[var(--tf-fg)]"
                )}
                title="Insert emoji"
                aria-label="Insert emoji"
              >
                <Smile className="size-4" />
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                className="w-68 p-2 rounded-xl shadow-2xl border border-[var(--tf-border-strong)] bg-[var(--tf-card-bg)] text-[var(--tf-fg)]"
              >
                <div className="space-y-2">
                  {EMOJI_CATEGORIES.map((cat) => (
                    <div key={cat.label}>
                      <div className="text-[10px] font-bold text-[var(--tf-fg-muted)] uppercase tracking-wider px-1 mb-1">
                        {cat.label}
                      </div>
                      <div className="grid grid-cols-8 gap-1">
                        {cat.emojis.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleEmojiClick(emoji)}
                            className="size-7 flex items-center justify-center text-base rounded hover:bg-[var(--tf-hover-bg)] active:scale-95 transition-transform"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Right items */}
          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline-block text-[11px] text-[var(--tf-fg-muted)] select-none font-mono">
              Return to send · Shift + Return for newline
            </span>

            <Button
              type="button"
              size="icon"
              disabled={!canSend}
              onClick={onSubmit}
              className={cn(
                "size-7 rounded-lg shadow-sm transition-all active:scale-95",
                canSend
                  ? "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30"
                  : "bg-[var(--tf-hover-bg)] text-[var(--tf-fg-muted)] opacity-40 cursor-default"
              )}
              title="Send message"
              aria-label="Send message"
            >
              <Send className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }
);
ChatInput.displayName = "ChatInput";
