"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Blobatar } from "@blobatar/react";
import { cn } from "@/lib/utils";

export interface ChatMemberItem {
  userId: string;
  name: string | null;
  email: string | null;
  status: string;
  role?: string;
}

export interface ChatMembersPanelProps {
  members: ChatMemberItem[];
  isLoading?: boolean;
  onClose: () => void;
  onMentionMember?: (member: ChatMemberItem) => void;
  className?: string;
}

export function ChatMembersPanel({
  members,
  isLoading,
  onClose,
  onMentionMember,
  className,
}: ChatMembersPanelProps) {
  const [filter, setFilter] = React.useState("");

  const filteredMembers = React.useMemo(() => {
    if (!filter.trim()) return members;
    const q = filter.toLowerCase();
    return members.filter(
      (m) =>
        (m.name ?? "").toLowerCase().includes(q) ||
        (m.email ?? "").toLowerCase().includes(q)
    );
  }, [members, filter]);

  const onlineMembers = React.useMemo(
    () => filteredMembers.filter((m) => m.status === "active"),
    [filteredMembers]
  );
  const offlineMembers = React.useMemo(
    () => filteredMembers.filter((m) => m.status !== "active"),
    [filteredMembers]
  );

  return (
    <aside
      className={cn(
        "flex flex-col w-60 shrink-0 border-l border-[var(--tf-border)] bg-[var(--app-canvas-bg)] select-none text-[var(--tf-fg)]",
        className
      )}
    >
      {/* Header */}
      <div className="flex h-12 items-center justify-between px-3.5 border-b border-[var(--tf-border)]">
        <div className="flex items-center gap-2">
          <span className="font-display font-semibold text-xs tracking-wider uppercase text-[var(--tf-fg-muted)]">
            Members
          </span>
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 h-4 font-mono bg-[var(--tf-hover-bg)] text-[var(--tf-fg-muted)] border border-[var(--tf-border)]"
          >
            {members.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] rounded-lg hover:bg-[var(--tf-hover-bg)]"
          onClick={onClose}
          title="Close panel"
          aria-label="Close members panel"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Member search filter */}
      <div className="p-2.5 border-b border-[var(--tf-border)]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-[var(--tf-fg-muted)] pointer-events-none" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter members…"
            className="h-7 pl-7 text-xs bg-[var(--tf-hover-bg)] border-[var(--tf-border)] rounded-lg text-[var(--tf-fg)] placeholder:text-[var(--tf-fg-muted)] focus-visible:ring-1 focus-visible:ring-purple-500"
          />
        </div>
      </div>

      {/* Members list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4 [scrollbar-width:thin]">
        {isLoading ? (
          <div className="p-3 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2.5 animate-pulse">
                <div className="size-7 rounded-full bg-[var(--tf-hover-bg)]" />
                <div className="space-y-1 flex-1">
                  <div className="h-3 w-20 bg-[var(--tf-hover-bg)] rounded" />
                  <div className="h-2 w-14 bg-[var(--tf-hover-bg)]/60 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Online section */}
            <div>
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--tf-fg-muted)] flex items-center justify-between">
                <span>Online</span>
                <span className="font-mono text-emerald-500">{onlineMembers.length}</span>
              </div>
              <div className="space-y-0.5 mt-0.5">
                {onlineMembers.map((m) => {
                  const displayName = m.name || m.email || "Member";
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => onMentionMember?.(m)}
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left hover:bg-[var(--tf-hover-bg)] transition-colors group"
                      title={`Click to tag @${displayName}`}
                    >
                      <div className="relative size-7 shrink-0 rounded-full overflow-hidden bg-[var(--tf-hover-bg)] ring-1 ring-[var(--tf-border)]">
                        <Blobatar name={displayName} className="size-full" />
                        <span className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-500 ring-1.5 ring-[var(--app-canvas-bg)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-[var(--tf-fg)] truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          {displayName}
                        </div>
                        {m.email && m.name && (
                          <div className="text-[10px] text-[var(--tf-fg-muted)] truncate font-mono">
                            {m.email}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Offline section */}
            {offlineMembers.length > 0 && (
              <div>
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--tf-fg-muted)] flex items-center justify-between">
                  <span>Offline</span>
                  <span className="font-mono">{offlineMembers.length}</span>
                </div>
                <div className="space-y-0.5 mt-0.5 opacity-60 hover:opacity-100 transition-opacity">
                  {offlineMembers.map((m) => {
                    const displayName = m.name || m.email || "Member";
                    return (
                      <button
                        key={m.userId}
                        type="button"
                        onClick={() => onMentionMember?.(m)}
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left hover:bg-[var(--tf-hover-bg)] transition-colors group"
                        title={`Click to tag @${displayName}`}
                      >
                        <div className="relative size-7 shrink-0 rounded-full overflow-hidden bg-[var(--tf-hover-bg)] ring-1 ring-[var(--tf-border)] grayscale">
                          <Blobatar name={displayName} className="size-full" />
                          <span className="absolute bottom-0 right-0 size-2 rounded-full bg-slate-400 ring-1.5 ring-[var(--app-canvas-bg)]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-[var(--tf-fg)] truncate">
                            {displayName}
                          </div>
                          {m.email && m.name && (
                            <div className="text-[10px] text-[var(--tf-fg-muted)] truncate font-mono">
                              {m.email}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
