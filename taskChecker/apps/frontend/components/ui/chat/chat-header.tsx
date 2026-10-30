"use client";

import * as React from "react";
import { Hash, Menu, Search, Users, X } from "lucide-react";
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
        "flex h-12 shrink-0 items-center justify-between border-b border-white/8 px-4 bg-[#0e131b] select-none",
        className
      )}
    >
      {/* Left side: Channel name & topic */}
      <div className="flex items-center gap-3 min-w-0">
        {onOpenMobileMenu && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden size-8 text-slate-400 hover:text-white"
            onClick={onOpenMobileMenu}
            aria-label="Open menu"
          >
            <Menu className="size-4" />
          </Button>
        )}

        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Hash className="size-4" />
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm text-white truncate">
              {channel}
            </span>
            <span className="hidden sm:inline text-xs text-slate-400 truncate">
              · {roomName}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border",
                isConnected
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
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
            <Search className="absolute left-2.5 size-3.5 text-slate-400 pointer-events-none" />
            <Input
              autoFocus
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search messages…"
              className="h-7 w-44 md:w-56 pl-8 pr-7 text-xs bg-white/5 border-white/10 rounded-lg text-white placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={() => {
                setShowSearch(false);
                onSearchChange?.("");
              }}
              className="absolute right-2 text-slate-400 hover:text-white"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg"
            onClick={() => setShowSearch(true)}
            title="Search messages"
          >
            <Search className="size-3.5" />
          </Button>
        )}

        {/* View Switcher: Stream vs Bubbles */}
        <div className="hidden sm:flex items-center bg-white/5 p-0.5 rounded-lg border border-white/8 text-[11px] font-medium text-slate-400">
          <button
            type="button"
            onClick={() => onChangeLayoutMode("stream")}
            className={cn(
              "px-2 py-0.5 rounded-md transition-colors",
              layoutMode === "stream"
                ? "bg-white/15 text-white font-semibold shadow-xs"
                : "hover:text-white"
            )}
            title="Slack / Discord Stream View"
          >
            Stream
          </button>
          <button
            type="button"
            onClick={() => onChangeLayoutMode("bubble")}
            className={cn(
              "px-2 py-0.5 rounded-md transition-colors",
              layoutMode === "bubble"
                ? "bg-white/15 text-white font-semibold shadow-xs"
                : "hover:text-white"
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
            "h-7 gap-1.5 px-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white",
            isMembersOpen ? "bg-white/10 text-white" : "hover:bg-white/5"
          )}
          onClick={onToggleMembers}
          title={isMembersOpen ? "Hide members" : "Show members"}
        >
          <Users className="size-3.5" />
          <span className="font-mono text-[11px]">{memberCount}</span>
        </Button>
      </div>
    </div>
  );
}
