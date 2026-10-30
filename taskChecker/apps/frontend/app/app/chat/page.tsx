"use client";

/* TeamFlow — Group Chat section (/app/chat).
 *
 * Real-time team collaboration chat interface styled for TeamFlow.
 * Reuses WebSocket channel, REST endpoints, and SWR cache with:
 *   · Real-time messaging over WebSocket (useRealtime)
 *   · Discord / Slack-style Stream timeline layout + optional Bubble layout
 *   · @mention tagging with autocomplete + highlights + keyboard navigation
 *   · Rich attachments (image grid with lightbox zoom, audio player, documents)
 *   · Emoji reactions, day dividers, optimistic sends, typing presence
 *   · Collapsible active members panel with online status
 *   · Drag-and-drop file upload
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/components/store";
import { useToast } from "@/components/overlay";
import {
  api,
  getCurrentTenantId,
  type ChatAttachment,
  type ChatMessage,
  type PaginatedResponse,
  type Project,
} from "@/lib/api";
import { useSWR } from "@/lib/swr";
import { useRealtime } from "@/lib/realtime";
import { cn, formatChatTime } from "@/lib/utils";
import { LagoonShell, useLagoonChrome } from "@/components/lagoon/LagoonShell";
import {
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleMessage,
  ChatBubbleTimestamp,
  ChatBubbleAction,
  ChatBubbleReactions,
  ChatMessageList,
  type ChatMessageListRef,
  ChatDayDivider,
  ChatTypingIndicator,
  ChatEmptyState,
  ChatInput,
  ChatHeader,
  ChatMembersPanel,
  ChatAudioPlayer,
  ChatLightbox,
} from "@/components/ui/chat";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence, motion } from "framer-motion";
import "blobatar/motion.css";

/* ---------------- constants ---------------- */

const MAX_ATTACHMENTS = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const CHAT_LAYOUT_KEY = "tf.chat.layout.v3";
const CHAT_MEMBERS_KEY = "tf.chat.members.open.v3";

/* ---------------- mention helpers ---------------- */

export type ChatMember = {
  userId: string;
  name: string | null;
  email: string | null;
  status: string;
};

export function getMentionHandle(m: { name: string | null; email: string | null; userId: string }): string {
  if (m.name) return m.name.replace(/\s+/g, "").toLowerCase();
  if (m.email) return (m.email.split("@")[0] ?? "").replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
  return m.userId.slice(0, 8);
}

export function getDisplayName(m: { name: string | null; email: string | null; userId: string }): string {
  return m.name ?? m.email ?? `User ${m.userId.slice(0, 4)}`;
}

function detectMention(value: string, cursor: number): { at: number; query: string } | null {
  const before = value.slice(0, cursor);
  const atIdx = before.lastIndexOf("@");
  if (atIdx === -1) return null;
  if (atIdx > 0 && !/\s/.test(before[atIdx - 1] ?? "")) return null;
  const afterAt = before.slice(atIdx);
  if (!/^@[^\s@]*$/.test(afterAt)) return null;
  const query = afterAt.slice(1);
  if (query.length > 30) return null;
  return { at: atIdx, query };
}

function resolveMentionIds(text: string, members: ChatMember[]): string[] {
  const tokens = [...text.matchAll(/@([A-Za-z0-9_]+)/g)].map((m) => (m[1] ?? "").toLowerCase());
  if (tokens.length === 0) return [];
  const out = new Set<string>();
  const byHandle = new Map(members.map((m) => [getMentionHandle(m).toLowerCase(), m.userId]));
  const byCompact = new Map(
    members.map((m) => [(m.name ?? "").toLowerCase().replace(/\s+/g, ""), m.userId]),
  );
  const lower = text.toLowerCase();
  for (const t of tokens) {
    const hit = byHandle.get(t) ?? byCompact.get(t);
    if (hit) out.add(hit);
  }
  for (const m of members) {
    const n = (m.name ?? "").toLowerCase();
    if (n && lower.includes(`@${n}`)) out.add(m.userId);
  }
  return [...out].slice(0, 20);
}

function renderFormattedMessage(text: string, isSentBubble = false) {
  const parts = text.split(/(@[A-Za-z0-9_]+|https?:\/\/[^\s]+)/g);
  return parts.map((part, i) => {
    if (/^@[A-Za-z0-9_]+$/.test(part)) {
      return (
        <span
          key={i}
          className={
            isSentBubble
              ? "inline-flex items-center px-1.5 py-0.2 rounded font-medium text-xs bg-white/20 text-white mx-0.5"
              : "inline-flex items-center px-1.5 py-0.2 rounded font-medium text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mx-0.5"
          }
        >
          {part}
        </span>
      );
    }
    if (/^https?:\/\/[^\s]+$/.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={
            isSentBubble
              ? "underline text-white/90 hover:text-white break-all"
              : "underline text-indigo-400 hover:text-indigo-300 break-all"
          }
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/* ---------------- timezone-aware local time formatting ---------------- */

function formatLocalMessageTime(iso: string): {
  timeStr: string;
  fullHeaderStr: string;
  fullTooltip: string;
} {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { timeStr: "", fullHeaderStr: "", fullTooltip: "" };
  }

  // Actual time formatted in user's local timezone (e.g. 9:12 AM)
  const timeStr = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOf(now) - startOf(d)) / 86_400_000);

  let fullHeaderStr: string;
  if (dayDiff <= 0) {
    fullHeaderStr = `Today at ${timeStr}`;
  } else if (dayDiff === 1) {
    fullHeaderStr = `Yesterday at ${timeStr}`;
  } else if (d.getFullYear() === now.getFullYear()) {
    const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    fullHeaderStr = `${dateStr} at ${timeStr}`;
  } else {
    const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    fullHeaderStr = `${dateStr} at ${timeStr}`;
  }

  // Full date, exact time and user's timezone for title tooltip
  const fullTooltip = d.toLocaleString(undefined, {
    dateStyle: "full",
    timeStyle: "long",
  });

  return { timeStr, fullHeaderStr, fullTooltip };
}

/* ---------------- day dividers ---------------- */

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabelFor(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/* ---------------- ChatRoom Component ---------------- */

function ChatRoom() {
  const { org } = useTenant();
  const { user } = useAuth();
  const { openMenu } = useLagoonChrome();
  const toast = useToast();
  const orgId = org?.id ?? getCurrentTenantId();

  // Layout mode: "stream" (Slack/Discord style) | "bubble" (Chat Bubbles)
  const [layoutMode, setLayoutMode] = useState<"stream" | "bubble">(() => {
    if (typeof window === "undefined") return "stream";
    return (window.localStorage.getItem(CHAT_LAYOUT_KEY) as "stream" | "bubble") || "stream";
  });

  // Members panel toggle
  const [isMembersOpen, setIsMembersOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem(CHAT_MEMBERS_KEY);
    return saved !== null ? saved === "true" : true;
  });

  const [lightbox, setLightbox] = useState<ChatAttachment | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typing, setTyping] = useState<Map<string, { name: string; at: number }>>(new Map());

  // Input & mentions state
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<ChatAttachment[]>([]);
  const [mention, setMention] = useState<{ at: number; query: string } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageListRef = useRef<ChatMessageListRef>(null);
  const lastTypingRef = useRef(0);

  // Queries
  const chatQ = useSWR<PaginatedResponse<ChatMessage>>(
    orgId ? `chat-messages-${orgId}` : null,
    () => api.chat.list({ limit: 60 }),
  );

  const membersQ = useSWR<{
    members: Array<{ userId: string; name: string | null; email: string | null; status: string }>;
  }>(orgId ? `ctx-members-${orgId}` : null, () => api.orgs.listMembers(orgId!));

  const members: ChatMember[] = useMemo(() => membersQ.data?.members ?? [], [membersQ.data]);

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) {
      if (m.name) map.set(m.userId, m.name);
      else if (m.email) map.set(m.userId, m.email);
    }
    return map;
  }, [members]);

  const rawItems = useMemo(() => [...(chatQ.data?.data ?? [])].reverse(), [chatQ.data]);

  // Filter messages if search query is active
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return rawItems;
    const q = searchQuery.toLowerCase();
    return rawItems.filter((m) => {
      const author = names.get(m.authorId)?.toLowerCase() ?? "";
      return m.body?.toLowerCase().includes(q) || author.includes(q);
    });
  }, [rawItems, searchQuery, names]);

  // Group items by day and identify compact runs (same author < 5 mins)
  const itemsWithDay = useMemo(
    () =>
      filteredItems.map((m, i) => {
        const prev = i > 0 ? filteredItems[i - 1] : undefined;
        const sameAuthor = !!prev && prev.authorId === m.authorId;
        const gap =
          prev && sameAuthor
            ? Math.abs(new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime())
            : Number.POSITIVE_INFINITY;
        return {
          m,
          showDay: i === 0 || dayKey(m.createdAt) !== dayKey(filteredItems[i - 1]?.createdAt ?? ""),
          compact: sameAuthor && gap < 5 * 60 * 1000,
        };
      }),
    [filteredItems],
  );

  // Persist layout & sidebar choices
  useEffect(() => {
    try {
      window.localStorage.setItem(CHAT_LAYOUT_KEY, layoutMode);
    } catch {}
  }, [layoutMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAT_MEMBERS_KEY, String(isMembersOpen));
    } catch {}
  }, [isMembersOpen]);

  /* Realtime hook */
  const mutateRef = useRef(chatQ.mutate);
  useEffect(() => {
    mutateRef.current = chatQ.mutate;
  });
  const userIdRef = useRef(user?.id);
  useEffect(() => {
    userIdRef.current = user?.id;
  });

  const patchReactions = useCallback(
    (
      messageId: string,
      reactions: { emoji: string; count: number; userIds: string[]; reactedByMe: boolean }[],
    ) => {
      void mutateRef.current(
        (current) => {
          if (!current) return { data: [], nextCursor: null, hasMore: false };
          return {
            ...current,
            data: current.data.map((m) => (m.id === messageId ? { ...m, reactions } : m)),
          };
        },
        { revalidate: false },
      );
    },
    [],
  );

  const realtimeOpts = useMemo(
    () => ({
      onChat: () => {
        void mutateRef.current();
        messageListRef.current?.scrollToBottom(true);
      },
      onChatUpdated: (msg: { meta?: unknown; [key: string]: unknown }) => {
        const meta = msg.meta as { messageId?: string; reactions?: unknown[] } | undefined;
        if (meta?.messageId && Array.isArray(meta.reactions)) {
          patchReactions(meta.messageId, meta.reactions as any);
        }
      },
      onChatTyping: (msg: { meta?: unknown; [key: string]: unknown }) => {
        const meta = msg.meta as { authorId?: string; displayName?: string | null } | undefined;
        const aid = meta?.authorId;
        if (!aid || aid === userIdRef.current) return;
        const name = meta?.displayName || names.get(aid)?.split(" ")[0] || "Someone";
        setTyping((prev) => {
          const next = new Map(prev);
          next.set(aid, { name, at: Date.now() });
          return next;
        });
      },
    }),
    [patchReactions, names],
  );

  const { isConnected } = useRealtime(realtimeOpts);

  // Auto-scroll to bottom on initial load and when message count changes
  useEffect(() => {
    if (!chatQ.isLoading && rawItems.length > 0) {
      requestAnimationFrame(() => {
        messageListRef.current?.scrollToBottom(false);
      });
    }
  }, [chatQ.isLoading, rawItems.length]);

  // Clear typing after 3.5s
  useEffect(() => {
    if (typing.size === 0) return;
    const id = setInterval(() => {
      const now = Date.now();
      setTyping((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [k, v] of prev) {
          if (now - v.at > 3500) {
            next.delete(k);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [typing.size]);

  // Mention filtering
  const filteredMentionMembers = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return members
      .filter((m) => {
        const handle = getMentionHandle(m).toLowerCase();
        const display = getDisplayName(m).toLowerCase();
        return handle.includes(q) || display.includes(q);
      })
      .slice(0, 8);
  }, [mention, members]);

  const updateMention = useCallback((val: string, cursor: number | null) => {
    if (cursor == null) {
      setMention(null);
      return;
    }
    const m = detectMention(val, cursor);
    setMention(m);
    setMentionIndex(0);
  }, []);

  const broadcastTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingRef.current < 2500) return;
    lastTypingRef.current = now;
    void api.chat.typing(user?.name || user?.email || "Someone");
  }, [user?.name, user?.email]);

  const selectMember = useCallback(
    (m: { name: string | null; email: string | null; userId: string }) => {
      if (!inputRef.current) {
        setDraft((prev) => `${prev}@${getMentionHandle(m)} `);
        return;
      }
      const handle = getMentionHandle(m);
      const cursor = inputRef.current.selectionStart ?? draft.length;
      const atPos = mention ? mention.at : cursor;
      const before = draft.slice(0, atPos);
      const after = draft.slice(cursor);
      const next = `${before}@${handle} ${after}`;
      setDraft(next);
      setMention(null);
      setMentionIndex(0);
      requestAnimationFrame(() => {
        const pos = before.length + handle.length + 2;
        inputRef.current?.setSelectionRange(pos, pos);
        inputRef.current?.focus();
      });
    },
    [mention, draft],
  );

  const filesToAttachments = useCallback(
    async (files: FileList | File[]) => {
      let remaining = MAX_ATTACHMENTS - pending.length;
      const arr: File[] = [];
      for (const f of [...files]) {
        if (remaining <= 0) break;
        if (!(f.type.startsWith("image/") || f.type.startsWith("audio/"))) continue;
        arr.push(f);
        remaining--;
      }
      if (arr.length === 0) return;
      for (const f of arr) {
        const cap = f.type.startsWith("audio/") ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES;
        if (f.size > cap) {
          toast({
            title: "File too large",
            msg: `Files must be under ${Math.round(cap / (1024 * 1024))}MB.`,
            kind: "err",
          });
          continue;
        }
        const url = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result ?? ""));
          r.onerror = () => resolve("");
          r.readAsDataURL(f);
        });
        if (!url) continue;
        setPending((prev) =>
          prev.length >= MAX_ATTACHMENTS
            ? prev
            : [...prev, { url, name: f.name, mime: f.type, size: f.size }],
        );
      }
    },
    [pending.length, toast],
  );

  // Send message
  const handleSend = useCallback(async () => {
    if (!user) {
      toast({ title: "Not signed in", msg: "Sign in to send messages.", kind: "err" });
      return;
    }
    const text = draft.trim();
    if (!text && pending.length === 0) return;

    const mentionIds = resolveMentionIds(text, members).filter((id) => id !== user.id);
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      authorId: user.id,
      body: text,
      attachments: pending,
      mentions: mentionIds,
      reactions: [],
      createdAt: new Date().toISOString(),
    };

    setSending(true);
    const sentDraft = text;
    const sentPending = pending;

    // Optimistic update
    await chatQ.mutate(
      (current) => ({
        data: [optimistic, ...(current?.data ?? [])],
        nextCursor: current?.nextCursor ?? null,
        hasMore: current?.hasMore ?? false,
      }),
      { revalidate: false },
    );

    setDraft("");
    setPending([]);
    setMention(null);
    messageListRef.current?.scrollToBottom(true);

    try {
      await api.chat.send({ body: sentDraft, attachments: sentPending, mentions: mentionIds });
      await chatQ.mutate();
    } catch (err) {
      // Revert optimistic insert
      await chatQ.mutate(
        (current) =>
          current
            ? { ...current, data: current.data.filter((m) => m.id !== optimistic.id) }
            : { data: [], nextCursor: null, hasMore: false },
        { revalidate: false },
      );
      setDraft(sentDraft);
      setPending(sentPending);
      toast({
        title: "Send failed",
        msg: err instanceof Error ? err.message : "Try again.",
        kind: "err",
      });
    } finally {
      setSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [user, draft, pending, members, chatQ, toast]);

  // Emoji reactions
  const handleReact = useCallback(
    async (m: ChatMessage, emoji: string) => {
      const me = user?.id;
      if (!me) return;
      const current = m.reactions ?? [];
      const mine = current.find((g) => g.emoji === emoji)?.reactedByMe;
      const next = (() => {
        const map = new Map(current.map((g) => [g.emoji, { ...g, userIds: [...g.userIds] }]));
        const g = map.get(emoji);
        if (mine) {
          if (g) {
            g.userIds = g.userIds.filter((u) => u !== me);
            g.count = g.userIds.length;
            g.reactedByMe = false;
            if (g.count <= 0) map.delete(emoji);
            else map.set(emoji, g);
          }
        } else if (g) {
          if (!g.userIds.includes(me)) g.userIds.push(me);
          g.count = g.userIds.length;
          g.reactedByMe = true;
          map.set(emoji, g);
        } else {
          map.set(emoji, { emoji, count: 1, userIds: [me], reactedByMe: true });
        }
        return [...map.values()].sort((a, b) => b.count - a.count);
      })();

      patchReactions(m.id, next);

      try {
        const res = mine ? await api.chat.unreact(m.id, emoji) : await api.chat.react(m.id, emoji);
        patchReactions(m.id, res.reactions ?? next);
      } catch {
        patchReactions(m.id, current);
      }
    },
    [patchReactions, user?.id],
  );

  // Message deletion
  const handleDelete = useCallback(
    async (m: ChatMessage) => {
      const prev = chatQ.data;
      await chatQ.mutate(
        (current) =>
          current
            ? { ...current, data: current.data.filter((x) => x.id !== m.id) }
            : { data: [], nextCursor: null, hasMore: false },
        { revalidate: false },
      );
      try {
        await api.chat.remove(m.id);
        await chatQ.mutate();
      } catch (err) {
        if (prev) await chatQ.mutate(prev, { revalidate: false });
        toast({
          title: "Delete failed",
          msg: err instanceof Error ? err.message : "Try again.",
          kind: "err",
        });
      }
    },
    [chatQ, toast],
  );

  const channelSlug = useMemo(() => {
    const slug = (org?.name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return slug || "team";
  }, [org?.name]);

  const teamName = org?.name ? `${org.name} team` : "Team chat";
  const onlineCount = useMemo(() => members.filter((m) => m.status === "active").length, [members]);
  const typingNames = [...typing.values()].map((t) => t.name);

  if (!orgId) return null;

  return (
    <div
      className="flex h-full w-full bg-[#0c1017] text-slate-100 overflow-hidden"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) void filesToAttachments(e.dataTransfer.files);
      }}
    >
      {/* Main chat column */}
      <div className="flex flex-1 flex-col h-full min-w-0 min-h-0 bg-[#0c1017]">
        {/* Compact Channel Header */}
        <ChatHeader
          channel={channelSlug}
          roomName={teamName}
          memberCount={members.length}
          onlineCount={onlineCount}
          isConnected={isConnected}
          isMembersOpen={isMembersOpen}
          onToggleMembers={() => setIsMembersOpen((v) => !v)}
          onOpenMobileMenu={openMenu}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          layoutMode={layoutMode}
          onChangeLayoutMode={setLayoutMode}
        />

        {/* Message feed */}
        <ChatMessageList ref={messageListRef}>
          {chatQ.isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 select-none">
              <div className="size-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <span className="text-xs text-slate-400 font-medium">Loading channel messages…</span>
            </div>
          ) : rawItems.length === 0 ? (
            <ChatEmptyState
              channelName={channelSlug}
              onQuickPrompt={(prompt) => {
                setDraft(prompt);
                inputRef.current?.focus();
              }}
            />
          ) : (
            itemsWithDay.map(({ m, showDay, compact }) => {
              const own = m.authorId === user?.id;
              const authorName = names.get(m.authorId) ?? (own ? user?.name ?? "You" : "Someone");
              const when = formatLocalMessageTime(m.createdAt);
              const mentionedMe = (m.mentions ?? []).includes(user?.id ?? "__none__");
              const memberInfo = members.find((x) => x.userId === m.authorId);

              const images = (m.attachments ?? []).filter((a) => a.mime.startsWith("image/"));
              const audios = (m.attachments ?? []).filter((a) => a.mime.startsWith("audio/"));
              const otherFiles = (m.attachments ?? []).filter(
                (a) => !a.mime.startsWith("image/") && !a.mime.startsWith("audio/"),
              );

              return (
                <div key={m.id} className="w-full">
                  {showDay && <ChatDayDivider label={dayLabelFor(m.createdAt)} />}

                  {layoutMode === "stream" ? (
                    /* ================= Stream / Slack Timeline Mode (Default) ================= */
                    <ChatBubble layout="stream" isCompact={compact}>
                      {/* Left Avatar column */}
                      {!compact ? (
                        <ChatBubbleAvatar
                          name={authorName}
                          isOnline={memberInfo?.status === "active"}
                          size="default"
                        />
                      ) : (
                        <div className="size-9 shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-100 select-none">
                          <span className="text-[10px] font-mono text-slate-400" title={when.fullTooltip}>
                            {when.timeStr}
                          </span>
                        </div>
                      )}

                      {/* Content column */}
                      <div className="flex-1 min-w-0">
                        {!compact && (
                          <div className="flex items-center gap-2 select-none mb-0.5">
                            <span className="text-xs font-semibold text-slate-100 hover:text-indigo-400 hover:underline cursor-pointer">
                              {authorName}
                            </span>
                            {own && (
                              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 bg-white/10 text-slate-300 border-none font-normal">
                                you
                              </Badge>
                            )}
                            {mentionedMe && (
                              <Badge
                                variant="default"
                                className="text-[10px] py-0 px-1.5 h-4 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium"
                              >
                                @you
                              </Badge>
                            )}
                            <ChatBubbleTimestamp timestamp={when.fullHeaderStr} title={when.fullTooltip} />
                          </div>
                        )}

                        <div className="relative group/bubble">
                          <ChatBubbleMessage layout="stream">
                            {m.body && (
                              <p className="whitespace-pre-wrap leading-relaxed select-text text-slate-200">
                                {renderFormattedMessage(m.body, false)}
                              </p>
                            )}

                            {/* Images */}
                            {images.length > 0 && (
                              <div
                                className={
                                  images.length === 1
                                    ? "mt-2"
                                    : "grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 max-w-lg"
                                }
                              >
                                {images.map((img, idx) => (
                                  <button
                                    key={`${m.id}-img-${idx}`}
                                    type="button"
                                    onClick={() => setLightbox(img)}
                                    className="overflow-hidden rounded-xl border border-white/10 hover:opacity-95 transition-transform active:scale-98 shadow-md"
                                  >
                                    <img
                                      src={img.url}
                                      alt={img.name}
                                      className="max-h-60 w-full object-cover rounded-xl"
                                      loading="lazy"
                                    />
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Audio */}
                            {audios.length > 0 && (
                              <div className="flex flex-col gap-1.5 mt-2">
                                {audios.map((a, idx) => (
                                  <ChatAudioPlayer
                                    key={`${m.id}-aud-${idx}`}
                                    url={a.url}
                                    name={a.name}
                                    size={a.size}
                                    mime={a.mime}
                                    isOwn={false}
                                  />
                                ))}
                              </div>
                            )}

                            {/* Documents */}
                            {otherFiles.length > 0 && (
                              <div className="flex flex-col gap-1.5 mt-2">
                                {otherFiles.map((a, idx) => (
                                  <ChatAudioPlayer
                                    key={`${m.id}-doc-${idx}`}
                                    url={a.url}
                                    name={a.name}
                                    size={a.size}
                                    mime={a.mime}
                                    isOwn={false}
                                  />
                                ))}
                              </div>
                            )}
                          </ChatBubbleMessage>

                          {/* Hover Action bar */}
                          <ChatBubbleAction
                            onReact={(emoji) => void handleReact(m, emoji)}
                            onCopy={m.body ? () => navigator.clipboard.writeText(m.body) : undefined}
                            onDelete={own ? () => void handleDelete(m) : undefined}
                            isOwn={own}
                          />
                        </div>

                        {/* Reactions */}
                        <ChatBubbleReactions
                          reactions={m.reactions ?? []}
                          onReact={(emoji) => void handleReact(m, emoji)}
                        />
                      </div>
                    </ChatBubble>
                  ) : (
                    /* ================= Modern Chat Bubble Mode ================= */
                    <ChatBubble
                      variant={own ? "sent" : "received"}
                      layout="bubble"
                      isCompact={compact}
                    >
                      {/* Avatar for received */}
                      {!own && !compact && (
                        <ChatBubbleAvatar
                          name={authorName}
                          isOnline={memberInfo?.status === "active"}
                          size="default"
                        />
                      )}
                      {!own && compact && <div className="size-9 shrink-0 select-none" />}

                      <div className={own ? "flex flex-col items-end max-w-[78%] sm:max-w-[70%] md:max-w-[62%]" : "flex flex-col items-start max-w-[78%] sm:max-w-[70%] md:max-w-[62%]"}>
                        {!own && !compact && (
                          <div className="flex items-center gap-1.5 mb-1 px-1 select-none">
                            <span className="text-xs font-semibold text-slate-300">
                              {authorName}
                            </span>
                            {mentionedMe && (
                              <Badge
                                variant="default"
                                className="text-[10px] py-0 px-1.5 h-4 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                              >
                                @you
                              </Badge>
                            )}
                          </div>
                        )}

                        <div className="relative group/bubble max-w-full">
                          <ChatBubbleMessage
                            variant={own ? "sent" : "received"}
                            layout="bubble"
                            className={cn(
                              mentionedMe && !own ? "ring-2 ring-indigo-500/50" : undefined,
                              own
                                ? compact
                                  ? "rounded-2xl rounded-tr-md rounded-br-md"
                                  : "rounded-2xl rounded-tr-xs"
                                : compact
                                ? "rounded-2xl rounded-tl-md rounded-bl-md"
                                : "rounded-2xl rounded-tl-xs"
                            )}
                          >
                            {/* Images */}
                            {images.length > 0 && (
                              <div
                                className={
                                  images.length === 1
                                    ? "mb-1.5"
                                    : "grid grid-cols-2 gap-1.5 mb-1.5 max-w-sm"
                                }
                              >
                                {images.map((img, idx) => (
                                  <button
                                    key={`${m.id}-img-${idx}`}
                                    type="button"
                                    onClick={() => setLightbox(img)}
                                    className="overflow-hidden rounded-xl border border-white/10 hover:opacity-95 transition-transform active:scale-98 shadow-sm"
                                  >
                                    <img
                                      src={img.url}
                                      alt={img.name}
                                      className="max-h-56 w-full object-cover rounded-xl"
                                      loading="lazy"
                                    />
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Audio */}
                            {audios.length > 0 && (
                              <div className="flex flex-col gap-1.5 mb-1.5">
                                {audios.map((a, idx) => (
                                  <ChatAudioPlayer
                                    key={`${m.id}-aud-${idx}`}
                                    url={a.url}
                                    name={a.name}
                                    size={a.size}
                                    mime={a.mime}
                                    isOwn={own}
                                  />
                                ))}
                              </div>
                            )}

                            {/* Documents */}
                            {otherFiles.length > 0 && (
                              <div className="flex flex-col gap-1.5 mb-1.5">
                                {otherFiles.map((a, idx) => (
                                  <ChatAudioPlayer
                                    key={`${m.id}-doc-${idx}`}
                                    url={a.url}
                                    name={a.name}
                                    size={a.size}
                                    mime={a.mime}
                                    isOwn={own}
                                  />
                                ))}
                              </div>
                            )}

                            {/* WhatsApp/Telegram style inline text + timestamp */}
                            {images.length === 0 && audios.length === 0 && otherFiles.length === 0 ? (
                              <div className="inline-flex flex-wrap items-baseline justify-end gap-x-2.5 gap-y-0.5">
                                {m.body && (
                                  <span className="whitespace-pre-wrap leading-relaxed select-text">
                                    {renderFormattedMessage(m.body, own)}
                                  </span>
                                )}
                                <ChatBubbleTimestamp
                                  timestamp={when.timeStr}
                                  title={when.fullTooltip}
                                  isSent={own && !m.id.startsWith("local-")}
                                  className={cn(
                                    "text-[10px] shrink-0 font-mono select-none self-end pb-0.5",
                                    own ? "text-indigo-200/80" : "text-slate-400"
                                  )}
                                />
                              </div>
                            ) : (
                              <>
                                {m.body && (
                                  <p className="whitespace-pre-wrap leading-relaxed select-text mt-1">
                                    {renderFormattedMessage(m.body, own)}
                                  </p>
                                )}
                                <div className="flex items-center justify-end gap-1.5 mt-1 select-none">
                                  <ChatBubbleTimestamp
                                    timestamp={when.timeStr}
                                    title={when.fullTooltip}
                                    isSent={own && !m.id.startsWith("local-")}
                                    className={own ? "text-indigo-200" : "text-slate-400"}
                                  />
                                </div>
                              </>
                            )}
                          </ChatBubbleMessage>

                          {/* Hover floating actions */}
                          <ChatBubbleAction
                            onReact={(emoji) => void handleReact(m, emoji)}
                            onCopy={m.body ? () => navigator.clipboard.writeText(m.body) : undefined}
                            onDelete={own ? () => void handleDelete(m) : undefined}
                            isOwn={own}
                          />
                        </div>

                        {/* Reaction badges */}
                        <ChatBubbleReactions
                          reactions={m.reactions ?? []}
                          onReact={(emoji) => void handleReact(m, emoji)}
                        />
                      </div>
                    </ChatBubble>
                  )}
                </div>
              );
            })
          )}
        </ChatMessageList>

        {/* Typing presence indicator */}
        <ChatTypingIndicator typingUsers={typingNames} />

        {/* Bottom Composer */}
        <div className="px-4 md:px-6 pb-4 pt-1 bg-[#0c1017] select-none">
          <ChatInput
            ref={inputRef}
              value={draft}
              onChange={(val) => {
                setDraft(val);
                updateMention(val, inputRef.current?.selectionStart ?? null);
                broadcastTyping();
              }}
              onSubmit={() => void handleSend()}
              disabled={sending}
              placeholder={`Message #${channelSlug}…`}
              attachments={pending}
              onRemoveAttachment={(i) => setPending((p) => p.filter((_, idx) => idx !== i))}
              onAttachFiles={filesToAttachments}
              mentionQuery={mention?.query ?? null}
              mentionUsers={filteredMentionMembers}
              mentionIndex={mentionIndex}
              onSelectMention={(m) => selectMember(m)}
            />
        </div>
      </div>

      {/* Right-side Active Members Drawer */}
      <AnimatePresence>
        {isMembersOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            className="hidden md:flex overflow-hidden shrink-0 border-l border-white/8"
          >
            <ChatMembersPanel
              members={members}
              isLoading={membersQ.isLoading}
              onClose={() => setIsMembersOpen(false)}
              onMentionMember={(m) => {
                selectMember(m);
                inputRef.current?.focus();
              }}
              className="w-60 border-l-0"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox Modal */}
      <ChatLightbox item={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}

/* Feature Page — mounts inside LagoonShell */
export default function ChatPage() {
  const router = useRouter();
  const orgId = useTenant().org?.id ?? getCurrentTenantId();
  const projectsQ = useSWR<{ projects: Project[] }>(
    orgId ? `chat-shell-projects-${orgId}` : null,
    () => api.projects.list(orgId!),
  );
  const projects = useMemo(() => projectsQ.data?.projects ?? [], [projectsQ.data]);

  return (
    <LagoonShell
      projects={projects}
      activeProjectId=""
      onSelectProject={(id) => router.push(`/app/board?project=${id}`)}
      onProjectsChanged={() => projectsQ.mutate()}
    >
      <ChatRoom />
    </LagoonShell>
  );
}
