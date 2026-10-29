"use client";

/* Quick chat — Lagoon-styled team chat.
 *
 * Clicking the "Quick chat" header opens a full real-time chat section right
 * in the sidebar. It shares the same WebSocket channel, REST endpoints and
 * SWR cache as ChatRail, so a message sent anywhere shows up here (and vice
 * versa) — one room, two windows onto it.
 *
 * Features:
 *   · Real-time messages over WebSocket (useRealtime)
 *   · @mention tagging with autocomplete + @you highlights
 *   · Image attachments (click to expand lightbox)
 *   · Audio attachments (inline player)
 *   · Emoji reactions, typing presence, day dividers, optimistic sends
 *   · Member sidebar with online/offline status
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/components/store";
import { useToast } from "@/components/overlay";
import {
  api,
  type ChatMessage as ApiChatMessage,
  type PaginatedResponse,
} from "@/lib/api";
import { useSWR } from "@/lib/swr";
import { useRealtime } from "@/lib/realtime";
import { cx, formatChatTime } from "@/lib/utils";
import { AnimatePresence } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import GroupChat from "@/components/ui/group-chat";
import {
  IconChevronDown,
  IconChevronRight,
  IconMessageSquare,
  IconSend,
  IconMic,
  IconPaperclip,
  IconSmile,
  IconTrash,
  IconX,
  IconDownload,
  IconCopy,
  IconUsers,
} from "@/components/icons";
import "blobatar/motion.css";

const OPEN_KEY = "tf.lagoon.quickchat.v1";

const sideVars: Record<string, string> = {
  "--card": "var(--lagoon-muted)",
  "--card-foreground": "var(--lagoon-ink)",
  "--border": "var(--lagoon-border)",
  "--muted-foreground": "var(--lagoon-muted-fg)",
  "--accent": "var(--lagoon-border)",
  "--input": "var(--lagoon-border)",
  "--ring": "var(--lagoon-purple)",
  "--primary": "var(--lagoon-purple)",
  "--primary-foreground": "var(--lagoon-on-purple)",
};

const MAX_ATTACHMENTS = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "😮", "🙏", "🔥", "👀"];

export type ChatMember = { userId: string; name: string | null; email: string | null };

export function getMentionHandle(m: ChatMember): string {
  if (m.name) return m.name.replace(/\s+/g, "");
  if (m.email) return (m.email.split("@")[0] ?? "").replace(/[^a-zA-Z0-9_]/g, "");
  return m.userId.slice(0, 8);
}
export function getDisplayName(m: ChatMember): string {
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
function renderMentions(text: string) {
  const parts = text.split(/(@[A-Za-z0-9_]+)/g);
  return parts.map((part, i) =>
    /^@[A-Za-z0-9_]+$/.test(part) ? (
      <span key={i} className="qc-mention-inline" data-mention={part}>
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

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

function hueFrom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}
function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function QcAvatar({ name, seed, size = 32 }: { name: string; seed: string; size?: number }) {
  const sz = size === 32 ? "size-8" : size === 40 ? "size-10" : "size-6";
  return (
    <span
      className={`shrink-0 rounded-full border border-current/20 flex shrink-0 items-center justify-center font-mono text-[10px] font-bold ${sz}`}
      style={{ background: `hsl(${hueFrom(seed)} 40% 18%)`, color: `hsl(${hueFrom(seed)} 80% 75%)` }}
    >
      {initials(name)}
    </span>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${Math.round(kb / 1024)} MB`;
}

type Attachment = { url: string; name: string; mime: string; size: number };

function QcAudio({ a, own }: { a: Attachment; own: boolean }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isAudio = a.mime.startsWith("audio/");
  const onEnded = useCallback(() => setPlaying(false), []);

  return (
    <div className={own ? "qc-audio qc-audio-own" : "qc-audio"}>
      <div className="qc-audio-head flex items-center gap-2">
        {isAudio ? (
          <IconMic size={12} className="text-lagoon-purple" />
        ) : (
          <IconPaperclip size={12} className="text-muted-fg" />
        )}
        <span className="text-xs font-semibold leading-none">{a.name}</span>
        <span className="text-[10px] text-muted-fg">{formatSize(a.size ?? 0)}</span>
      </div>
      {isAudio ? (
        <audio
          ref={audioRef}
          src={a.url}
          onPlay={() => setPlaying(true)}
          onPause={onEnded}
          onEnded={onEnded}
          className="w-full"
          style={{ height: 28 }}
        />
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="p-1 hover:bg-accent rounded"
            onClick={() => {
              if (audioRef.current) {
                if (playing) audioRef.current.pause();
                else audioRef.current.play();
              }
            }}
            title={playing ? "Pause" : "Play"}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? "⏸" : "▶"}
          </button>
          <button
            type="button"
            className="text-muted-fg hover:text-primary"
            onClick={() => {
              const l = document.createElement("a");
              l.href = a.url;
              l.download = a.name;
              document.body.appendChild(l);
              l.click();
              document.body.removeChild(l);
            }}
            title="Download"
            aria-label="Download file"
          >
            <IconDownload size={12} />
          </button>
          <button
            type="button"
            className="text-muted-fg hover:text-primary"
            onClick={() => navigator.clipboard.writeText(a.url)}
            title="Copy link"
            aria-label="Copy link"
          >
            <IconCopy size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

type QcBubbleProps = {
  message: ApiChatMessage;
  who: string;
  fullName: string;
  isOwn: boolean;
  time: string;
  tint: number;
  mentionedMe: boolean;
  onReact: (emoji: string) => void;
  onDelete?: () => void;
  onImage: (a: Attachment) => void;
  currentUserId?: string;
};

const QcBubble = ({
  message: m,
  who,
  fullName,
  isOwn,
  time,
  tint,
  mentionedMe,
  onReact,
  onDelete,
  onImage,
  currentUserId,
}: QcBubbleProps) => {
  const [hover, setHover] = useState(false);
  const images = (m.attachments ?? []).filter((a) => a.mime.startsWith("image/"));
  const audio = (m.attachments ?? []).filter((a) => a.mime.startsWith("audio/"));
  const reactions = m.reactions ?? [];

  return (
    <div
      className={mentionedMe ? "qc-msg is-mentioned" : "qc-msg"}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <QcAvatar name={fullName} seed={fullName} size={isOwn ? 28 : 32} />
      <div className="qc-msg-body">
        <div className="qc-msg-head">
          <span className="qc-msg-who">
            {who}
            {isOwn ? <span className="faint"> · you</span> : null}
            {mentionedMe ? <span className="qc-mention-flag">@you</span> : null}
          </span>
          <span className="qc-msg-time">{time}</span>
        </div>
        <div className="qc-bubble-wrap">
          <div className={isOwn ? "qc-bubble qc-bubble-brand" : "qc-bubble qc-bubble-slate"}>
            {m.body ? <p>{renderMentions(m.body)}</p> : null}
            {images.length > 0 ? (
              <div className="qc-img-grid">
                {images.map((a, i) => (
                  <button
                    key={`${m.id}-img-${i}`}
                    type="button"
                    className="qc-img-thumb"
                    onClick={() => onImage(a)}
                    title={`${a.name} — click to expand`}
                  >
                    <img src={a.url} alt={a.name} loading="lazy" />
                  </button>
                ))}
              </div>
            ) : null}
            {audio.length > 0 ? (
              <div className="qc-audio-list">
                {audio.map((a) => (
                  <QcAudio key={a.url + String(a.size)} a={a} own={isOwn} />
                ))}
              </div>
            ) : null}
            {isOwn && !m.id.startsWith("local-") ? (
              <span className="qc-checks" title="Sent">
                ✓
              </span>
            ) : null}
          </div>
          {hover ? (
            <div className="qc-react-bar">
              <div className="qc-react-quick-row">
                {["👍", "❤️", "😂", "🎉", "🔥", "👀"].map((e) => (
                  <button
                    key={e}
                    type="button"
                    className="qc-react-quick"
                    title={`React ${e}`}
                    aria-label={`React with ${e}`}
                    onClick={() => onReact(e)}
                  >
                    {e}
                  </button>
                ))}
                {onDelete && (
                  <button
                    type="button"
                    className="qc-react-del"
                    title="Delete message"
                    aria-label="Delete message"
                    onClick={onDelete}
                  >
                    <IconTrash size={11} />
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>
        {reactions.length > 0 ? (
          <div className="qc-reactions">
            {reactions.map((g) => (
              <button
                key={g.emoji}
                type="button"
                className={g.reactedByMe ? "qc-reaction-chip is-me" : "qc-reaction-chip"}
                title={`${g.count} · ${g.userIds.slice(0, 5).join(", ")}${g.userIds.length > 5 ? "…" : ""}`}
                onClick={() => onReact(g.emoji)}
              >
                <span>{g.emoji}</span>
                <span className="qc-reaction-n">{g.count}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export function QuickChat() {
  const { org } = useTenant();
  const { user } = useAuth();
  const toast = useToast();
  const orgId = org?.id;

  const [open, setOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(OPEN_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const [expanded, setExpanded] = useState(false);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [mention, setMention] = useState<{ at: number; query: string } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [pending, setPending] = useState<Attachment[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [lightbox, setLightbox] = useState<Attachment | null>(null);
  const [typing, setTyping] = useState<Map<string, { name: string; at: number }>>(new Map());

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastTypingRef = useRef(0);

  const chatQ = useSWR<PaginatedResponse<ApiChatMessage>>(
    orgId ? `chat-messages-${orgId}` : null,
    () => api.chat.list({ limit: 60 }),
  );
  const membersQ = useSWR<{ members: Array<{ userId: string; name: string | null; email: string | null; status: string }> }>(
    orgId ? `ctx-members-${orgId}` : null,
    () => api.orgs.listMembers(orgId!),
  );

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of membersQ.data?.members ?? []) {
      if (m.name) map.set(m.userId, m.name);
      else if (m.email) map.set(m.userId, m.email);
    }
    return map;
  }, [membersQ.data]);

  const items = useMemo(() => [...(chatQ.data?.data ?? [])].reverse(), [chatQ.data]);

  const itemsWithDay = useMemo(
    () =>
      items.map((m, i) => {
        const prev = i > 0 ? items[i - 1] : undefined;
        const sameAuthor = !!prev && prev.authorId === m.authorId;
        const gap = prev && sameAuthor ? Math.abs(new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime()) : Number.POSITIVE_INFINITY;
        return {
          m,
          showDay: i === 0 || dayKey(m.createdAt) !== dayKey(items[i - 1]?.createdAt ?? ""),
          compact: sameAuthor && gap < 5 * 60 * 1000,
        };
      }),
    [items],
  );

  /* Realtime */
  const mutateRef = useRef(chatQ.mutate);
  useEffect(() => {
    mutateRef.current = chatQ.mutate;
  });
  const userIdRef = useRef(user?.id);
  useEffect(() => {
    userIdRef.current = user?.id;
  });

  const { isConnected } = useRealtime({
    onChat: () => {
      void mutateRef.current();
    },
    onChatUpdated: (msg: { meta?: unknown; [key: string]: unknown }) => {
      const meta = msg.meta as { messageId?: string; reactions?: unknown[] } | undefined;
      if (meta?.messageId && Array.isArray(meta.reactions)) {
        void mutateRef.current();
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
  });

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

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stickRef.current) el.scrollTop = el.scrollHeight;
  }, [items.length, typing.size, expanded]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      stickRef.current = true;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, []);

  const members = membersQ.data?.members ?? [];
  const canSend = (draft.trim().length > 0 || pending.length > 0) && !sending;

  const filtered = useMemo(() => {
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

  const selectMember = useCallback((m: ChatMember) => {
    if (!mention || !inputRef.current) return;
    const handle = getMentionHandle(m);
    const cursor = inputRef.current.selectionStart ?? draft.length;
    const before = draft.slice(0, mention.at);
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
  }, [mention, draft]);

  const filesToAttachments = useCallback(async (files: FileList | File[]) => {
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
      if (f.size > cap) continue;
      const url = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result ?? ""));
        r.onerror = () => resolve("");
        r.readAsDataURL(f);
      });
      if (!url) continue;
      setPending((prev) =>
        prev.length >= MAX_ATTACHMENTS ? prev : [...prev, { url, name: f.name, mime: f.type, size: f.size }],
      );
    }
  }, [pending.length]);

  const handleSend = useCallback(
    async (body: string, attachments: Attachment[]) => {
      if (!user) {
        toast({ title: "Not signed in", msg: "Sign in to send messages.", kind: "err" });
        throw new Error("Not signed in");
      }
      const text = body.trim();
      if (!text && attachments.length === 0) return;
      const mentionIds = resolveMentionIds(text, members).filter((id) => id !== user.id);
      const optimistic: ApiChatMessage = {
        id: `local-${Date.now()}`,
        authorId: user.id,
        body: text,
        attachments,
        mentions: mentionIds,
        reactions: [],
        createdAt: new Date().toISOString(),
      };
      await chatQ.mutate(
        (current) => ({
          data: [optimistic, ...(current?.data ?? [])],
          nextCursor: current?.nextCursor ?? null,
          hasMore: current?.hasMore ?? false,
        }),
        { revalidate: false },
      );
      try {
        await api.chat.send({ body: text, attachments, mentions: mentionIds });
        await chatQ.mutate();
      } catch (err) {
        await chatQ.mutate(
          (current) =>
            current
              ? { ...current, data: current.data.filter((m) => m.id !== optimistic.id) }
              : { data: [], nextCursor: null, hasMore: false },
          { revalidate: false },
        );
        toast({ title: "Send failed", msg: err instanceof Error ? err.message : "Try again.", kind: "err" });
        throw err;
      }
    },
    [chatQ, toast, user, members],
  );

  const send = async () => {
    const text = draft.trim();
    if ((!text && pending.length === 0) || sending) return;
    const sentText = text;
    const sentPending = pending;
    setSending(true);
    try {
      await handleSend(text, pending);
      setDraft((v) => (v === sentText ? "" : v));
      setPending((p) => (p === sentPending ? [] : p));
      setMention(null);
      scrollToBottom();
    } catch {
      /* onSend already toasted + rolled back */
    } finally {
      setSending(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        if (filtered[mentionIndex]) {
          e.preventDefault();
          selectMember(filtered[mentionIndex]);
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === "Escape" && showEmoji) {
      e.preventDefault();
      setShowEmoji(false);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const typingNames = [...typing.values()].map((t) => t.name);
  const channel = useMemo(() => {
    const slug = (org?.name ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || "team";
  }, [org?.name]);

  if (!orgId) return null;

  const emojiInsert = (e: string) => {
    setDraft((v) => `${v}${e}`);
    inputRef.current?.focus();
  };

  return (
    <section aria-label="Quick chat" style={sideVars} className="qc-section">
      <button
        type="button"
        onClick={() => {
          setExpanded(true);
          setOpen(true);
        }}
        aria-expanded={expanded}
        className="flex w-full cursor-pointer items-center gap-1.5 px-4 py-2 text-[12px] font-semibold tracking-[0.01em] text-[var(--lagoon-muted-fg)] transition-colors hover:text-[var(--lagoon-ink)] hover:bg-[var(--lagoon-muted)] rounded-xl"
        style={{ background: "none", border: "none", textAlign: "left", width: "100%" }}
      >
        <IconMessageSquare size={12} className="shrink-0 text-lagoon-purple" />
        <span className="flex-1 min-w-0 truncate">Quick chat</span>
        <IconChevronDown size={12} className="shrink-0 text-lagoon-muted-fg" />
      </button>

      {open ? (
        <div className="qc-panel px-3 pb-2">
          {expanded ? (
            <div className="qc-expanded">
              <div className="qc-head flex items-center justify-between gap-3 px-3 py-2 border-b border-border">
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="qc-back p-1.5 hover:bg-accent rounded-lg"
                  aria-label="Collapse chat"
                >
                  <IconChevronRight size={14} />
                </button>
                <div className="flex flex-col min-w-0">
                  <span className="qc-channel text-[10px] font-bold tracking-wider text-muted-fg uppercase">
                    #{channel}
                  </span>
                  <span className="qc-room-name text-sm font-semibold truncate">
                    {org?.name ? `${org.name} team` : "Team chat"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-lagoon-purple" : "bg-red-500"}`} aria-hidden />
                  <span className="text-[10px] text-muted-fg">{isConnected ? "Online" : "Offline"}</span>
                </div>
              </div>

              <div className="qc-scroll" ref={scrollRef}>
                {chatQ.isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center" role="status" aria-label="Loading messages">
                    <Skeleton className="h-5 w-24 rounded" />
                    <Skeleton className="h-4 w-32 rounded mt-2" />
                  </div>
                ) : items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <IconMessageSquare size={36} className="dim mb-2" />
                    <p className="text-sm text-muted-fg">No messages yet — say hi to #{channel} 👋</p>
                  </div>
                ) : (
                  <>
                    {itemsWithDay.map(({ m, showDay }) => {
                      const name =
                        names.get(m.authorId) ?? (m.authorId === user?.id ? (user?.name ?? "You") : "Someone");
                      const own = m.authorId === user?.id;
                      const when = formatChatTime(m.createdAt);
                      const mentionedMe = (m.mentions ?? []).includes(user?.id ?? "__none__");
                      return (
                        <div key={m.id} className="qc-day-group">
                          {showDay ? (
                            <div className="qc-day-divider" aria-label={dayLabelFor(m.createdAt)}>
                              <span>{dayLabelFor(m.createdAt)}</span>
                            </div>
                          ) : null}
                          <QcBubble
                            message={m}
                            who={name.split(" ")[0] || "Someone"}
                            fullName={name}
                            isOwn={own}
                            time={when.relative}
                            tint={hueFrom(m.authorId)}
                            mentionedMe={mentionedMe}
                            currentUserId={user?.id}
                            onReact={(emoji: string) => {
                              const me = user?.id;
                              if (!me) return;
                              const current = m.reactions ?? [];
                              const mine = current.find((g) => g.emoji === emoji)?.reactedByMe;
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
                              const next = [...map.values()].sort((a, b) => b.count - a.count);
                              void mutateRef.current(
                                (cur) => {
                                  if (!cur) return { data: [], nextCursor: null, hasMore: false };
                                  return {
                                    ...cur,
                                    data: cur.data.map((mm) => (mm.id === m.id ? { ...mm, reactions: next } : mm)),
                                  };
                                },
                                { revalidate: false },
                              );
                            }}
                            onDelete={own ? () => void api.chat.remove(m.id).then(() => void mutateRef.current()) : undefined}
                            onImage={setLightbox}
                          />
                        </div>
                      );
                    })}
                    <div className="qc-typing">
                      {typingNames.length > 0 ? (
                        <span className="text-xs text-lagoon-purple italic">
                          {typingNames.slice(0, 2).join(", ")}
                          {typingNames.length > 2 ? ` +${typingNames.length - 2}` : ""} typing…
                        </span>
                      ) : null}
                    </div>
                  </>
                )}
              </div>

              <form className="qc-composer" onSubmit={submit} onDragOver={(e) => e.preventDefault()} onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files.length > 0) void filesToAttachments(e.dataTransfer.files);
              }}>
                {pending.length > 0 && (
                  <div className="qc-pending-strip" aria-label="Attachments to send">
                    {pending.map((a, i) => (
                      <div key={a.url || `${a.name}-${i}`} className="qc-pending-thumb">
                        {a.mime.startsWith("image/") ? (
                          <img src={a.url} alt={a.name} className="w-8 h-8 rounded" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-accent flex items-center justify-center text-[10px]">
                            📎
                          </div>
                        )}
                        <span className="qc-pending-name truncate">{a.name}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${a.name}`}
                          onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                          className="p-1 hover:bg-accent rounded"
                        >
                          <IconX size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="qc-composer-box">
                  {mention && filtered.length > 0 && (
                    <div className="qc-mention-list" role="listbox" aria-label="Mention suggestions" id="mention-list">
                      <div className="qc-mention-head">Mention — @{mention.query || "…"}</div>
                      {filtered.map((m, idx) => (
                        <button
                          key={m.userId}
                          type="button"
                          role="option"
                          aria-selected={idx === mentionIndex}
                          className={idx === mentionIndex ? "qc-mention-item is-active" : "qc-mention-item"}
                          onMouseDown={(ev) => {
                            ev.preventDefault();
                            selectMember(m);
                          }}
                        >
                          <QcAvatar name={getDisplayName(m)} seed={m.userId} size={24} />
                          <span className="qc-mention-name truncate">{getDisplayName(m)}</span>
                          <span className="qc-mention-handle text-[10px] text-muted-fg">
                            @{getMentionHandle(m)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <AnimatePresence>
                    {showEmoji && (
                      <div className="qc-emoji-pop">
                        {QUICK_EMOJIS.map((e) => (
                          <button
                            key={e}
                            type="button"
                            className="qc-emoji-cell"
                            title={`Insert ${e}`}
                            onMouseDown={(ev) => {
                              ev.preventDefault();
                              emojiInsert(e);
                            }}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    )}
                  </AnimatePresence>
                  <div className="qc-composer-row">
                    <button
                      type="button"
                      className="qc-add"
                      title="Attach image"
                      aria-label="Attach image"
                      onClick={() => {
                        fileRef.current?.click();
                        fileRef.current?.setAttribute("accept", "image/*");
                      }}
                    >
                      <IconPaperclip size={14} />
                    </button>
                    <button
                      type="button"
                      className="qc-add"
                      title="Attach audio"
                      aria-label="Attach audio"
                      onClick={() => {
                        fileRef.current?.click();
                        fileRef.current?.setAttribute("accept", "audio/*");
                      }}
                    >
                      <IconMic size={14} />
                    </button>
                    <Textarea
                      ref={inputRef}
                      rows={1}
                      value={draft}
                      onChange={(e) => {
                        setDraft(e.target.value);
                        updateMention(e.target.value, e.target.selectionStart);
                        broadcastTyping();
                      }}
                      onKeyDown={onKeyDown}
                      placeholder="Write a message…"
                      aria-label="Send a message"
                      aria-autocomplete="list"
                      aria-expanded={!!mention && filtered.length > 0}
                      aria-controls={mention ? "mention-list" : undefined}
                      maxLength={2000}
                      autoComplete="off"
                      className="qc-input max-h-32 min-h-[32px] resize-none"
                    />
                    <button
                      type="button"
                      className={showEmoji ? "qc-ghost is-on" : "qc-ghost"}
                      title="Insert emoji"
                      aria-label="Insert emoji"
                      aria-expanded={showEmoji}
                      onClick={() => setShowEmoji((v) => !v)}
                    >
                      <IconSmile size={16} />
                    </button>
                    <button
                      type="submit"
                      className="qc-send"
                      disabled={!canSend}
                      aria-label="Send message"
                      title="Send message"
                    >
                      <IconSend size={13} />
                    </button>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,audio/*"
                    multiple
                    hidden
                    aria-label="Attach files"
                    onChange={(e) => {
                      if (e.target.files) void filesToAttachments(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <div className="qc-hint text-[10px] text-muted-fg px-3">
                    @ to tag · image or audio · Enter to send
                  </div>
                </div>
              </form>
            </div>
          ) : (
            <div style={{ maxHeight: 200, overflowY: "auto", overscrollBehavior: "contain", marginTop: 8 }}>
              {items.length > 0 ? (
                <GroupChat
                  channel={channel}
                  messages={items.slice(0, 6).reverse().map((m) => ({
                    name: names.get(m.authorId) ?? "Someone",
                    text: m.body,
                    time: formatChatTime(m.createdAt).relative,
                  }))}
                  members={members.slice(0, 4).map((m) => m.name || m.email || "Member")}
                  extra={Math.max(0, members.length - 4)}
                  typing={typingNames.length > 0 ? typingNames[0] : undefined}
                  className="rounded-lg"
                />
              ) : (
                <p className="mt-2 rounded-lg border px-3 py-2.5 text-xs" style={{ background: "var(--lagoon-muted)", borderColor: "var(--lagoon-border)", color: "var(--lagoon-muted-fg)" }}>
                  No messages yet — say hi to #{channel} 👋
                </p>
              )}
              <form className="mt-2 flex items-center gap-1.5" onSubmit={submit}>
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`Message #${channel}`}
                  aria-label={`Message #${channel}`}
                  maxLength={2000}
                  autoComplete="off"
                  className="h-7 text-xs"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="size-7 shrink-0"
                  disabled={!draft.trim() || sending}
                  aria-label="Send message"
                >
                  <IconSend size={13} />
                </Button>
              </form>
            </div>
          )}
        </div>
      ) : null}

      {lightbox && (
        <div
          className="qc-lightbox"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Attachment preview"
        >
          {lightbox.mime.startsWith("image/") ? (
            <div className="qc-lightbox-content">
              <img src={lightbox.url} alt={lightbox.name} className="max-w-[70vw] max-h-[60vh] rounded-lg object-contain" />
              <span className="qc-lightbox-name">{lightbox.name}</span>
            </div>
          ) : (
            <div className="qc-lightbox-content">
              <QcAudio a={lightbox} own={false} />
              <span className="qc-lightbox-name">{lightbox.name}</span>
            </div>
          )}
          <button className="qc-lightbox-close" onClick={() => setLightbox(null)} aria-label="Close preview">
            ✕
          </button>
        </div>
      )}
    </section>
  );
}

export default QuickChat;
