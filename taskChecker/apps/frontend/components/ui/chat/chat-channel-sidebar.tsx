"use client";

import * as React from "react";
import {
  Hash,
  MessageSquare,
  Search,
  Megaphone,
  Coffee,
  FolderGit2,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { Blobatar } from "@blobatar/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChatMember } from "@/app/app/chat/page";

export interface ChannelItem {
  id: string;
  name: string;
  description?: string;
  icon?: "hash" | "announcements" | "random" | "project";
  unreadCount?: number;
  isProject?: boolean;
}

export interface ChatChannelSidebarProps {
  channels: ChannelItem[];
  activeChannelId: string;
  onSelectChannel: (channelId: string) => void;
  members: ChatMember[];
  activeDmUserId?: string | null;
  onSelectDm?: (member: ChatMember) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

export function ChatChannelSidebar({
  channels,
  activeChannelId,
  onSelectChannel,
  members,
  activeDmUserId,
  onSelectDm,
  isCollapsed = false,
  onToggleCollapse,
  className,
}: ChatChannelSidebarProps) {
  const [filter, setFilter] = React.useState("");
  const [channelsExpanded, setChannelsExpanded] = React.useState(true);
  const [projectsExpanded, setProjectsExpanded] = React.useState(true);
  const [dmsExpanded, setDmsExpanded] = React.useState(true);

  const query = filter.toLowerCase().trim();

  const standardChannels = React.useMemo(
    () => channels.filter((c) => !c.isProject && (!query || c.name.toLowerCase().includes(query))),
    [channels, query]
  );

  const projectChannels = React.useMemo(
    () => channels.filter((c) => c.isProject && (!query || c.name.toLowerCase().includes(query))),
    [channels, query]
  );

  const filteredMembers = React.useMemo(() => {
    if (!query) return members;
    return members.filter(
      (m) =>
        (m.name ?? "").toLowerCase().includes(query) ||
        (m.email ?? "").toLowerCase().includes(query)
    );
  }, [members, query]);

  const renderChannelIcon = (icon?: string) => {
    switch (icon) {
      case "announcements":
        return <Megaphone className="size-3.5 shrink-0 opacity-80" />;
      case "random":
        return <Coffee className="size-3.5 shrink-0 opacity-80" />;
      case "project":
        return <FolderGit2 className="size-3.5 shrink-0 opacity-80" />;
      case "hash":
      default:
        return <Hash className="size-3.5 shrink-0 opacity-80" />;
    }
  };

  if (isCollapsed) {
    return (
      <aside
        className={cn(
          "w-14 shrink-0 flex flex-col items-center py-3 border-r border-[var(--tf-border)] bg-[var(--app-canvas-bg)] select-none transition-all",
          className
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="size-8 rounded-lg text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] hover:bg-[var(--tf-hover-bg)] mb-3"
          title="Expand channels sidebar"
          aria-label="Expand channels sidebar"
        >
          <PanelLeft className="size-4" />
        </Button>

        <div className="flex-1 flex flex-col items-center gap-1.5 w-full px-2 overflow-y-auto [scrollbar-width:none]">
          {channels.slice(0, 6).map((c) => {
            const isActive = activeChannelId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectChannel(c.id)}
                className={cn(
                  "size-8 rounded-lg flex items-center justify-center transition-colors relative",
                  isActive
                    ? "bg-purple-500/15 text-purple-600 dark:text-purple-300 font-bold ring-1 ring-purple-500/30"
                    : "text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] hover:bg-[var(--tf-hover-bg)]"
                )}
                title={`#${c.name}`}
              >
                {renderChannelIcon(c.icon)}
                {c.unreadCount ? (
                  <span className="absolute top-1 right-1 size-1.5 rounded-full bg-purple-500" />
                ) : null}
              </button>
            );
          })}
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "w-60 shrink-0 flex flex-col border-r border-[var(--tf-border)] bg-[var(--app-canvas-bg)] select-none text-[var(--tf-fg)] transition-all",
        className
      )}
    >
      {/* Channels Sidebar Header */}
      <div className="flex h-12 items-center justify-between px-3.5 border-b border-[var(--tf-border)]">
        <div className="flex items-center gap-2">
          <div className="size-5 rounded-md bg-purple-500/15 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <MessageSquare className="size-3" />
          </div>
          <span className="font-display font-semibold text-xs tracking-wide uppercase text-[var(--tf-fg-muted)]">
            Channels
          </span>
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 h-4 font-mono bg-[var(--tf-hover-bg)] text-[var(--tf-fg-muted)] border border-[var(--tf-border)]"
          >
            {channels.length}
          </Badge>
        </div>

        {onToggleCollapse && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="size-7 rounded-lg text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] hover:bg-[var(--tf-hover-bg)]"
            title="Collapse channels sidebar"
            aria-label="Collapse channels sidebar"
          >
            <PanelLeftClose className="size-3.5" />
          </Button>
        )}
      </div>

      {/* Filter / Search input */}
      <div className="p-2.5 border-b border-[var(--tf-border)]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-[var(--tf-fg-muted)] pointer-events-none" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter channels & DMs…"
            className="h-7 pl-7 pr-2 text-xs bg-[var(--tf-hover-bg)] border-[var(--tf-border)] rounded-lg text-[var(--tf-fg)] placeholder:text-[var(--tf-fg-muted)] focus-visible:ring-1 focus-visible:ring-purple-500"
          />
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 [scrollbar-width:thin]">
        {/* Workspace Channels */}
        <div>
          <button
            type="button"
            onClick={() => setChannelsExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] uppercase tracking-wider rounded-md"
          >
            <div className="flex items-center gap-1.5">
              {channelsExpanded ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
              <span>Channels</span>
            </div>
            <span className="font-mono text-[10px]">{standardChannels.length}</span>
          </button>

          {channelsExpanded && (
            <div className="space-y-0.5 mt-1">
              {standardChannels.map((c) => {
                const isActive = activeChannelId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectChannel(c.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors group",
                      isActive
                        ? "bg-purple-500/12 text-purple-600 dark:text-purple-300 font-semibold shadow-xs"
                        : "text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] hover:bg-[var(--tf-hover-bg)]"
                    )}
                    title={c.description || `#${c.name}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "transition-colors",
                          isActive
                            ? "text-purple-600 dark:text-purple-400"
                            : "text-[var(--tf-fg-muted)] group-hover:text-[var(--tf-fg)]"
                        )}
                      >
                        {renderChannelIcon(c.icon)}
                      </span>
                      <span className="truncate">{c.name}</span>
                    </div>

                    {c.unreadCount ? (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-purple-600 text-white font-medium">
                        {c.unreadCount}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Project Channels (if any) */}
        {projectChannels.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setProjectsExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] uppercase tracking-wider rounded-md"
            >
              <div className="flex items-center gap-1.5">
                {projectsExpanded ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
                <span>Projects</span>
              </div>
              <span className="font-mono text-[10px]">{projectChannels.length}</span>
            </button>

            {projectsExpanded && (
              <div className="space-y-0.5 mt-1">
                {projectChannels.map((c) => {
                  const isActive = activeChannelId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelectChannel(c.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors group",
                        isActive
                          ? "bg-purple-500/12 text-purple-600 dark:text-purple-300 font-semibold shadow-xs"
                          : "text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] hover:bg-[var(--tf-hover-bg)]"
                      )}
                      title={c.description || `#${c.name}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            "transition-colors",
                            isActive
                              ? "text-purple-600 dark:text-purple-400"
                              : "text-[var(--tf-fg-muted)] group-hover:text-[var(--tf-fg)]"
                          )}
                        >
                          <FolderGit2 className="size-3.5 shrink-0 opacity-80" />
                        </span>
                        <span className="truncate">{c.name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Direct Messages */}
        {members.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setDmsExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] uppercase tracking-wider rounded-md"
            >
              <div className="flex items-center gap-1.5">
                {dmsExpanded ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
                <span>Direct Messages</span>
              </div>
              <span className="font-mono text-[10px]">{filteredMembers.length}</span>
            </button>

            {dmsExpanded && (
              <div className="space-y-0.5 mt-1">
                {filteredMembers.map((m) => {
                  const displayName = m.name || m.email || "Member";
                  const isOnline = m.status === "active";
                  const isSelected = activeDmUserId === m.userId;

                  return (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => onSelectDm?.(m)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors group",
                        isSelected
                          ? "bg-purple-500/12 text-purple-600 dark:text-purple-300 font-semibold shadow-xs"
                          : "text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] hover:bg-[var(--tf-hover-bg)]"
                      )}
                      title={displayName}
                    >
                      <div className="relative size-5 shrink-0 rounded-full overflow-hidden bg-[var(--tf-hover-bg)] ring-1 ring-[var(--tf-border)]">
                        <Blobatar name={displayName} className="size-full" />
                        <span
                          className={cn(
                            "absolute bottom-0 right-0 size-1.5 rounded-full ring-1 ring-[var(--tf-card-bg)]",
                            isOnline ? "bg-emerald-500" : "bg-slate-400"
                          )}
                        />
                      </div>
                      <span className="truncate min-w-0 flex-1">{displayName}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
