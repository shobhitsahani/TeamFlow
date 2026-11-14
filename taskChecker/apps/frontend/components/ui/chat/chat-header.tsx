"use client";

import * as React from "react";
import { ChevronDown, Hash, PanelLeft, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ChatHeaderProps {
  channel: string;
  roomName: string;
  memberCount: number;
  onlineCount: number;
  isConnected: boolean;
  isMembersOpen: boolean;
  onToggleMembers: () => void;
  onOpenMobileMenu?: () => void;
  onOpenMobileChannels?: () => void;
  onToggleChannels?: () => void;
  isChannelsOpen?: boolean;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  layoutMode: "stream" | "bubble";
  onChangeLayoutMode: (mode: "stream" | "bubble") => void;
  className?: string;
}

export function ChatHeader({
  channel,
  roomName,
  memberCount,
  onlineCount,
  isConnected,
  isMembersOpen,
  onToggleMembers,
  onOpenMobileMenu,
  onOpenMobileChannels,
  onToggleChannels,
  isChannelsOpen = true,
  searchQuery = "",
  onSearchChange,
  layoutMode,
  onChangeLayoutMode,
  className,
}: ChatHeaderProps) {
  const [showSearch, setShowSearch] = React.useState(false);

  return (
    <div
      className={cn(
        "flex h-12 shrink-0 items-center justify-between border-b border-[var(--tf-border)] px-3 sm:px-4 bg-[var(--app-canvas-bg)]/80 backdrop-blur-md select-none text-[var(--tf-fg)]",
        className
      )}
    >
      {/* Left side: Channel name & topic */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Toggle Channel Sidebar on Desktop */}
        {onToggleChannels && (
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex size-7 text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] hover:bg-[var(--tf-hover-bg)] rounded-lg"
            onClick={onToggleChannels}
            title={isChannelsOpen ? "Collapse channels sidebar" : "Open channels sidebar"}
            aria-label="Toggle channels sidebar"
          >
            <PanelLeft className="size-4" />
          </Button>
        )}

        {/* Fallback menu button */}
        {!onOpenMobileChannels && onOpenMobileMenu && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden size-7 text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)]"
            onClick={onOpenMobileMenu}
            aria-label="Open menu"
          >
            <ChevronDown className="size-4" />
          </Button>
        )}

        {/* Mobile Channel Switcher Button */}
        {onOpenMobileChannels ? (
          <button
            type="button"
            onClick={onOpenMobileChannels}
            className="md:hidden flex items-center gap-1.5 px-2 py-1 -ml-1 rounded-lg hover:bg-[var(--tf-hover-bg)] transition-colors text-left"
            title="Switch channel"
            aria-label="Switch channel"
          >
            <div className="size-6 rounded-md bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <Hash className="size-3.5" />
            </div>
            <span className="font-display font-semibold text-xs text-[var(--tf-fg)] truncate max-w-[140px]">
              {channel}
            </span>
            <ChevronDown className="size-3 text-[var(--tf-fg-muted)] shrink-0" />
          </button>
        ) : null}

        <div className={cn("items-center gap-2.5 min-w-0", onOpenMobileChannels ? "hidden md:flex" : "flex")}>
          <div className="size-7 rounded-lg bg-purple-500/12 border border-purple-500/25 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
            <Hash className="size-3.5" />
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <span className="font-display font-semibold text-sm text-[var(--tf-fg)] truncate">
              {channel}
            </span>
            <span className="hidden sm:inline text-xs text-[var(--tf-fg-muted)] truncate">
              · {roomName}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border",
                isConnected
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                )}
              />
              <span>{onlineCount} online</span>
            </span>
          </div>
        </div>
      </div>

      {/* Right side: Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Search */}
        {showSearch ? (
          <div className="relative flex items-center animate-in fade-in zoom-in-95 duration-100">
            <Search className="absolute left-2.5 size-3.5 text-[var(--tf-fg-muted)] pointer-events-none" />
            <Input
              autoFocus
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search messages…"
              className="h-7 w-36 sm:w-48 md:w-56 pl-8 pr-7 text-xs bg-[var(--tf-hover-bg)] border-[var(--tf-border)] rounded-lg text-[var(--tf-fg)] placeholder:text-[var(--tf-fg-muted)] focus-visible:ring-1 focus-visible:ring-purple-500"
            />
            <button
              type="button"
              onClick={() => {
                setShowSearch(false);
                onSearchChange?.("");
              }}
              className="absolute right-2 text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)]"
              aria-label="Close search"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] hover:bg-[var(--tf-hover-bg)] rounded-lg"
            onClick={() => setShowSearch(true)}
            title="Search messages"
            aria-label="Search messages"
          >
            <Search className="size-3.5" />
          </Button>
        )}

        {/* View Switcher: Stream vs Bubbles */}
        <div className="hidden sm:flex items-center bg-[var(--tf-hover-bg)] p-0.5 rounded-lg border border-[var(--tf-border)] text-[11px] font-medium text-[var(--tf-fg-muted)]">
          <button
            type="button"
            onClick={() => onChangeLayoutMode("stream")}
            className={cn(
              "px-2.5 py-0.5 rounded-md transition-colors",
              layoutMode === "stream"
                ? "bg-[var(--tf-card-bg)] text-[var(--tf-fg)] font-semibold shadow-xs"
                : "hover:text-[var(--tf-fg)]"
            )}
            title="Slack / Discord Stream View"
          >
            Stream
          </button>
          <button
            type="button"
            onClick={() => onChangeLayoutMode("bubble")}
            className={cn(
              "px-2.5 py-0.5 rounded-md transition-colors",
              layoutMode === "bubble"
                ? "bg-[var(--tf-card-bg)] text-[var(--tf-fg)] font-semibold shadow-xs"
                : "hover:text-[var(--tf-fg)]"
            )}
            title="Chat Bubble View"
          >
            Bubbles
          </button>
        </div>

        {/* Members toggle button */}
        <Button
          variant={isMembersOpen ? "secondary" : "ghost"}
          size="sm"
          className={cn(
            "h-7 gap-1.5 px-2 rounded-lg text-xs font-medium transition-colors border",
            isMembersOpen
              ? "bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30"
              : "border-transparent text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] hover:bg-[var(--tf-hover-bg)]"
          )}
          onClick={onToggleMembers}
          title={isMembersOpen ? "Hide members" : "Show members"}
          aria-label={isMembersOpen ? "Hide members" : "Show members"}
        >
          <Users className="size-3.5" />
          <span className="font-mono text-[11px]">{memberCount}</span>
        </Button>
      </div>
    </div>
  );
}
