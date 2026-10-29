"use client";

/* TeamFlow — Group Chat section.
 *
 * A full-page, real-time team chat room. Reuses the same WebSocket channel,
 * REST endpoints and SWR cache as the sidebar QuickChat / ChatRail, so a
 * message sent anywhere shows up here (and vice versa) — one room, many
 * windows onto it.
 *
 * Features:
 *   · Real-time messages over WebSocket (useRealtime)
 *   · @mention tagging with autocomplete + mention highlights / notifications
 *   · Image attachments (click to expand)
 *   · Audio attachments (record-style file upload, inline player)
 *   · Emoji reactions, typing presence, day dividers, optimistic sends
 *
 * Route: /app/chat
 */

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
import { cx, formatChatTime, hueFrom } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { LagoonShell, useLagoonChrome } from "@/components/lagoon/LagoonShell";
import { motion, AnimatePresence } from "@/components/motion";
import { Blobatar } from "@blobatar/react";
import "blobatar/motion.css";
import {
  IconSend,
  IconMic,
  IconPaperclip,
  IconSmile,
  IconTrash,
  IconX,
  IconChecks,
  IconDownload,
  IconCopy,
  IconUsers,
  IconMessageSquare,
  IconFile,
  IconMenu,
} from "@/components/icons";

/* ---------------- constants ---------------- */

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const MAX_ATTACHMENTS = 4;
const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "😮", "🙏", "🔥", "👀"];
const CHAT_LS_KEY = "tf.chat.section.w.v1";

const clampW = (n: number) => Math.min(900, Math.max(320, Math.round(n)));

function loadSectionWidth(): number {
  if (typeof window === "undefined") return 700;
  try {
    const raw = window.localStorage.getItem(CHAT_LS_KEY);
    if (raw == null) return 700;
    const n = Number(JSON.parse(raw));
    if (Number.isFinite(n)) return clampW(n);
  } catch {
    /* corrupted — default */
  }
  return 700;
}

/* ---------------- mention helpers ---------------- */

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
      <span key={i} className="st-mention-inline" data-mention={part}>
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
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

/* ---------------- avatar ---------------- */

function UserAvatar({ name, size = "sm", tint = 220, loading }: { name: string; size?: "sm" | "default" | "lg"; tint?: number; loading?: boolean }) {
  if (loading) {
    return (
      <Skeleton
        aria-hidden
        className={size === "sm" ? "size-6 shrink-0 rounded-full" : size === "lg" ? "size-10 shrink-0 rounded-full" : "size-8 shrink-0 rounded-full"}
      />
    );
  }
  return (
    <Blobatar name={name} animate="hover" title={name} className={`size-${size === "lg" ? 10 : size === "sm" ? 6 : 8} shrink-0 rounded-full`} />
  );
}

/* ---------------- audio message ---------------- */

function AudioMessage({ a, own }: { a: ChatAttachment; own: boolean }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isAudio = a.mime.startsWith("audio/");

  const onEnded = useCallback(() => setPlaying(false), []);

  return (
    <div className={cx("st-audio", own && "st-audio-own")}>
      <div className="st-audio-head flex items-center gap-2">
        {isAudio ? <IconMic size={13} className="text-primary" /> : <IconFile size={13} className="text-muted-foreground" />}
        <span className="text-xs font-medium leading-none">{a.name}</span>
        <span className="text-[10px] text-muted-foreground">{formatSize(a.size ?? 0)}</span>
      </div>
      {isAudio ? (
        <audio
          ref={audioRef}
          src={a.url}
          onPlay={() => setPlaying(true)}
          onPause={onEnded}
          onEnded={onEnded}
          className="w-full"
          style={{ height: 32 }}
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
          <button type="button" className="text-muted-foreground hover:text-primary" onClick={() => {
            const link = document.createElement("a");
            link.href = a.url;
            link.download = a.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }} title="Download" aria-label="Download file">
            <IconDownload size={13} />
          </button>
          <button type="button" className="text-muted-foreground hover:text-primary" onClick={() => navigator.clipboard.writeText(a.url)} title="Copy link" aria-label="Copy link">
            <IconCopy size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${Math.round(kb / 1024)} MB`;
}

/* ---------------- message bubble ---------------- */

type ChatBubbleProps = {
  message: ChatMessage;
  who: string;
  fullName: string;
  isOwn: boolean;
  time: string;
  absolute: string;
  tint: number;
  mentionedMe: boolean;
  onReact: (m: ChatMessage, emoji: string) => void;
  onDelete?: () => void;
  onImage: (a: ChatAttachment) => void;
  onAudio: (a: ChatAttachment) => void;
  currentUserId?: string;
};

const ChatBubble = ({ message: m, who, fullName, isOwn, time, absolute, tint, mentionedMe, onReact, onDelete, onImage, onAudio, currentUserId }: ChatBubbleProps) => {
  const [hover, setHover] = useState(false);
  const images = (m.attachments ?? []).filter((a) => a.mime.startsWith("image/"));
  const audio = (m.attachments ?? []).filter((a) => a.mime.startsWith("audio/"));
  const other = (m.attachments ?? []).filter((a) => !a.mime.startsWith("image/") && !a.mime.startsWith("audio/"));
  const reactions = m.reactions ?? [];

  return (
    <motion.div
      className={cx("st-msg", mentionedMe && "is-mentioned")}
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <UserAvatar name={fullName} tint={tint} size="sm" />
      <div className="st-msg-body">
        <div className="st-msg-head">
          <span className="st-msg-who">{who}{isOwn ? <span className="faint"> · you</span> : null}{mentionedMe ? <span className="st-mention-flag">@you</span> : null}</span>
          <span className="st-msg-time">
            <time dateTime={m.createdAt} title={absolute}>{time}</time>
          </span>
        </div>
        <div className="st-bubble-wrap">
          <div className={cx("st-bubble", isOwn ? "st-bubble-brand" : "st-bubble-slate")}>
            {m.body ? <p>{renderMentions(m.body)}</p> : null}
            {images.length > 0 ? (
              <div className="st-img-grid">
                {images.map((a, i) => (
                  <button
                    key={`${m.id}-img-${i}`}
                    type="button"
                    className="st-img-thumb"
                    onClick={() => onImage(a)}
                    title={`${a.name} — click to expand`}
                  >
                    <img src={a.url} alt={a.name} loading="lazy" />
                  </button>
                ))}
              </div>
            ) : null}
            {audio.length > 0 ? (
              <div className="st-audio-list">
                {audio.map((a) => (
                  <AudioMessage key={a.url + a.size} a={a} own={isOwn} />
                ))}
              </div>
            ) : null}
            {other.length > 0 ? (
              <div className="st-other-list">
                {other.map((a) => (
                  <AudioMessage key={a.url + a.size} a={a} own={isOwn} />
                ))}
              </div>
            ) : null}
            {isOwn && !m.id.startsWith("local-") ? (
              <span className="st7-checks" title="Sent">
                <IconChecks size={13} />
              </span>
            ) : null}
          </div>
          <AnimatePresence>
            {hover ? (
              <motion.div key="react-bar" className="st-react-bar" initial={{ opacity: 0, y: 4, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.96 }} transition={{ duration: 0.15 }}>
                {["👍", "❤️", "😂", "🎉", "🔥", "👀"].map((e) => (
                  <button key={e} type="button" className="st-react-quick" title={`React ${e}`} aria-label={`React with ${e}`} onClick={() => onReact(m, e)}>
                    {e}
                  </button>
                ))}
                {onDelete && (
                  <button type="button" className="st-react-del" title="Delete message" aria-label="Delete message" onClick={onDelete}>
                    <IconTrash size={13} />
                  </button>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        {reactions.length > 0 ? (
          <div className="st-reactions">
            {reactions.map((g) => (
              <motion.button
                key={g.emoji}
                type="button"
                className={cx("st-reaction-chip", g.reactedByMe && "is-me")}
                title={`${g.count} · ${g.userIds.slice(0, 5).join(", ")}${g.userIds.length > 5 ? "…" : ""}`}
                onClick={() => onReact(m, g.emoji)}
                whileTap={{ scale: 0.9 }}
              >
                <span>{g.emoji}</span>
                <span className="st-reaction-n">{g.count}</span>
              </motion.button>
            ))}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
};

/* ---------------- page ---------------- */

function ChatRoom() {
  const { org } = useTenant();
  const { user } = useAuth();
  const { openMenu } = useLagoonChrome();
  const toast = useToast();
  const orgId = org?.id ?? getCurrentTenantId();
  const [width, setWidth] = useState<number>(loadSectionWidth);
  const [lightbox, setLightbox] = useState<ChatAttachment | null>(null);
  const [typing, setTyping] = useState<Map<string, { name: string; at: number }>>(new Map());

  const chatQ = useSWR<PaginatedResponse<ChatMessage>>(
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
  useEffect(() => { mutateRef.current = chatQ.mutate; });
  const userIdRef = useRef(user?.id);
  useEffect(() => { userIdRef.current = user?.id; });

  const patchReactions = useCallback((messageId: string, reactions: { emoji: string; count: number; userIds: string[]; reactedByMe: boolean }[]) => {
    void mutateRef.current(
      (current) => {
        if (!current) return { data: [], nextCursor: null, hasMore: false };
        return { ...current, data: current.data.map((m) => (m.id === messageId ? { ...m, reactions } : m)) };
      },
      { revalidate: false },
    );
  }, []);

  const realtimeOpts = useMemo(
    () => ({
      onChat: () => {
        void mutateRef.current();
      },
      onChatUpdated: (msg: { meta?: unknown; [key: string]: unknown }) => {
        const meta = msg.meta as { messageId?: string; reactions?: unknown[] } | undefined;
        if (meta?.messageId && Array.isArray(meta.reactions)) patchReactions(meta.messageId, meta.reactions as any);
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

  useEffect(() => {
    if (typing.size === 0) return;
    const id = setInterval(() => {
      const now = Date.now();
      setTyping((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [k, v] of prev) {
          if (now - v.at > 3500) { next.delete(k); changed = true; }
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
  }, [items.length, typing.size]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) { stickRef.current = true; el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); }
  }, []);

  /* Composer state */
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [mention, setMention] = useState<{ at: number; query: string } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [pending, setPending] = useState<ChatAttachment[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastTypingRef = useRef(0);

  const members = membersQ.data?.members ?? [];
  const canSend = (draft.trim().length > 0 || pending.length > 0) && !sending;

  const filtered = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return members.filter((m) => {
      const handle = getMentionHandle(m).toLowerCase();
      const display = getDisplayName(m).toLowerCase();
      return handle.includes(q) || display.includes(q);
    }).slice(0, 8);
  }, [mention, members]);

  const updateMention = useCallback((val: string, cursor: number | null) => {
    if (cursor == null) { setMention(null); return; }
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
      setPending((prev) => (prev.length >= MAX_ATTACHMENTS ? prev : [...prev, { url, name: f.name, mime: f.type, size: f.size }]));
    }
  }, [pending.length]);

  const handleSend = useCallback(async (body: string, attachments: ChatAttachment[]) => {
    if (!user) { toast({ title: "Not signed in", msg: "Sign in to send messages.", kind: "err" }); throw new Error("Not signed in"); }
    const text = body.trim();
    if (!text && attachments.length === 0) return;
    const mentionIds = resolveMentionIds(text, members).filter((id) => id !== user.id);
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      authorId: user.id,
      body: text,
      attachments,
      mentions: mentionIds,
      reactions: [],
      createdAt: new Date().toISOString(),
    };
    await chatQ.mutate(
      (current) => ({ data: [optimistic, ...(current?.data ?? [])], nextCursor: current?.nextCursor ?? null, hasMore: current?.hasMore ?? false }),
      { revalidate: false },
    );
    try {
      await api.chat.send({ body: text, attachments, mentions: mentionIds });
      await chatQ.mutate();
    } catch (err) {
      await chatQ.mutate((current) => (current ? { ...current, data: current.data.filter((m) => m.id !== optimistic.id) } : { data: [], nextCursor: null, hasMore: false }), { revalidate: false });
      toast({ title: "Send failed", msg: err instanceof Error ? err.message : "Try again.", kind: "err" });
      throw err;
    }
  }, [chatQ, toast, user, members]);

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

  const submit = (e: FormEvent) => { e.preventDefault(); void send(); };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && filtered.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => (i + 1) % filtered.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((i) => (i - 1 + filtered.length) % filtered.length); return; }
      if (e.key === "Enter" || e.key === "Tab") {
        if (filtered[mentionIndex]) { e.preventDefault(); selectMember(filtered[mentionIndex]); return; }
      }
      if (e.key === "Escape") { e.preventDefault(); setMention(null); return; }
    }
    if (e.key === "Escape" && showEmoji) { e.preventDefault(); setShowEmoji(false); return; }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  const handleReact = useCallback(async (m: ChatMessage, emoji: string) => {
    const me = user?.id;
    if (!me) return;
    const current = m.reactions ?? [];
    const mine = current.find((g) => g.emoji === emoji)?.reactedByMe;
    const next = (() => {
      const map = new Map(current.map((g) => [g.emoji, { ...g, userIds: [...g.userIds] }]));
      const g = map.get(emoji);
      if (mine) {
        if (g) { g.userIds = g.userIds.filter((u) => u !== me); g.count = g.userIds.length; g.reactedByMe = false; if (g.count <= 0) map.delete(emoji); else map.set(emoji, g); }
      } else if (g) {
        if (!g.userIds.includes(me)) g.userIds.push(me);
        g.count = g.userIds.length; g.reactedByMe = true; map.set(emoji, g);
      } else {
        map.set(emoji, { emoji, count: 1, userIds: [me], reactedByMe: true });
      }
      return [...map.values()].sort((a, b) => b.count - a.count);
    })();
    patchReactions(m.id, next);
    try {
      const res = mine ? await api.chat.unreact(m.id, emoji) : await api.chat.react(m.id, emoji);
      patchReactions(m.id, res.reactions ?? next);
    } catch { patchReactions(m.id, current); }
  }, [patchReactions, user?.id]);

  const handleDelete = useCallback(async (m: ChatMessage) => {
    const prev = chatQ.data;
    await chatQ.mutate((current) => (current ? { ...current, data: current.data.filter((x) => x.id !== m.id) } : { data: [], nextCursor: null, hasMore: false }), { revalidate: false });
    try {
      await api.chat.remove(m.id);
      await chatQ.mutate();
    } catch (err) {
      if (prev) await chatQ.mutate(prev, { revalidate: false });
      toast({ title: "Delete failed", msg: err instanceof Error ? err.message : "Try again.", kind: "err" });
    }
  }, [chatQ, toast]);

  /* Persist width */
  useEffect(() => {
    try { window.localStorage.setItem(CHAT_LS_KEY, JSON.stringify(width)); } catch {}
  }, [width]);

  const typingNames = [...typing.values()].map((t) => t.name);
  const channel = useMemo(() => {
    const slug = (org?.name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return slug || "team";
  }, [org?.name]);
  const teamName = org?.name ? `${org.name} team` : "Team chat";
  const people = useMemo(() => members.map((m) => m.name || m.email || "Member"), [members]);
  const facepile = people.slice(0, 6);
  const extra = Math.max(0, people.length - facepile.length);

  if (!orgId) return null;

  return (
    <div className="chat-section">
        <header className="chat-head">
          <div className="chat-head-left">
            <Button
              variant="ghost"
              size="icon"
              className="lagoon-icon-btn lagoon-only-mobile size-9"
              aria-label="Open menu"
              onClick={openMenu}
            >
              <IconMenu size={18} />
            </Button>
            <div className="flex flex-col">
              <span className="chat-channel"><span className="text-muted-foreground">#</span>{channel}</span>
              <span className="chat-room-name">{teamName}</span>
            </div>
          </div>
          <div className="chat-head-right flex items-center gap-2">
            <Button variant="ghost" size="icon" className="size-8" title="Members" aria-label="Members">
              <IconUsers size={14} />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" disabled={!isConnected} title={isConnected ? "Connected" : "Disconnected"} aria-label="Connection status">
              <div className={`size-2.5 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
            </Button>
          </div>
        </header>

        <div className="chat-body">
          <aside className="chat-sidebar">
            <div className="sidebar-pane">
              <h2 className="sidebar-title">Members</h2>
              <div className="sidebar-list">
                {membersQ.isLoading ? (
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-24 rounded" /><Skeleton className="h-4 w-32 rounded" /><Skeleton className="h-4 w-20 rounded" />
                  </div>
                ) : members.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No members</p>
                ) : (
                  members.map((m) => (
                    <div key={m.userId} className="sidebar-person flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent rounded-lg transition-colors">
                      <UserAvatar name={m.name || m.email || "Member"} size="sm" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{m.name || m.email || "Member"}</div>
                        <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                      </div>
                      <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full ${m.status === "active" ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-muted/50 text-muted-foreground border border-muted/30"}`}>
                        {m.status === "active" ? "Online" : "Offline"}
                      </span>
                    </div>
                  ))
                )}
              </div>
              {extra > 0 && <p className="text-xs text-muted-foreground mt-2 px-3">+{extra} more</p>}
            </div>
          </aside>

          <main className="chat-main">
            <div className="chat-scroll" ref={scrollRef} onScroll={(e) => {
              const el = e.currentTarget;
              stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}>
              {chatQ.isLoading ? (
                <div className="flex flex-col items-center justify-center py-20" role="status" aria-label="Loading messages">
                  <Skeleton className="h-8 w-32 rounded" /><Skeleton className="h-6 w-48 rounded mt-2" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <IconMessageSquare size={40} className="dim mb-3" />
                  <h3 className="text-sm font-medium">No messages yet</h3>
                  <p className="text-muted-foreground text-sm">Say hello, tag someone with @, or drop an image or audio.</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {itemsWithDay.map(({ m, showDay, compact }) => {
                    const name = names.get(m.authorId) ?? (m.authorId === user?.id ? (user?.name ?? "You") : "Someone");
                    const own = m.authorId === user?.id;
                    const when = formatChatTime(m.createdAt);
                    const avatarLoading = membersQ.isLoading && !names.get(m.authorId) && m.authorId !== user?.id;
                    const mentionedMe = (m.mentions ?? []).includes(user?.id ?? "__none__");
                    return (
                      <div key={m.id}>
                        {showDay ? (
                          <div className="st-day-divider" aria-label={dayLabelFor(m.createdAt)}>
                            <span>{dayLabelFor(m.createdAt)}</span>
                          </div>
                        ) : null}
                        <ChatBubble
                          message={m}
                          who={name.split(" ")[0] || "Someone"}
                          fullName={name}
                          isOwn={own}
                          time={when.relative}
                          absolute={when.absolute}
                          tint={hueFrom(m.authorId)}
                          mentionedMe={mentionedMe}
                          currentUserId={user?.id}
                          onReact={handleReact}
                          onDelete={own ? () => void handleDelete(m) : undefined}
                          onImage={setLightbox}
                          onAudio={setLightbox}
                        />
                      </div>
                    );
                  })}
                  <AnimatePresence>
                    {typingNames.length > 0 ? (
                      <motion.div key="typing" className="st-typing" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}>
                        <span className="st-typing-dots" aria-hidden><i /><i /><i /></span>
                        <span>{typingNames.slice(0, 2).join(", ")}{typingNames.length > 2 ? ` +${typingNames.length - 2}` : ""} typing…</span>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </AnimatePresence>
              )}
            </div>

            <form className="chat-composer" onSubmit={submit} onDragOver={(e) => { e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length > 0) void filesToAttachments(e.dataTransfer.files); }}>
              {pending.length > 0 && (
                <div className="st-pending-strip" aria-label="Attachments to send">
                  {pending.map((a, i) => (
                    <div key={a.url || `${a.name}-${i}`} className="st-pending-thumb">
                      {a.mime.startsWith("image/") ? (
                        <img src={a.url} alt={a.name} />
                      ) : (
                        <div className="flex size-8 items-center justify-center rounded bg-muted text-xs font-medium">{a.mime.split("/")[0] === "audio" ? "🎵" : "📎"}</div>
                      )}
                      <span className="st-pending-name truncate">{a.name}</span>
                      <button type="button" aria-label={`Remove ${a.name}`} onClick={() => setPending((p) => p.filter((_, j) => j !== i))}><IconX size={10} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="chat-composer-box">
                {mention && filtered.length > 0 && (
                  <div className="st-mention-list" role="listbox" aria-label="Mention suggestions" id="mention-list">
                    <div className="st-mention-list-head">Mention — @{mention.query || "…"}</div>
                    {filtered.map((m, idx) => (
                      <button key={m.userId} type="button" role="option" aria-selected={idx === mentionIndex} className={cx("st-mention-item", idx === mentionIndex && "is-active")} onMouseDown={(e) => { e.preventDefault(); selectMember(m); }}>
                        <UserAvatar name={getDisplayName(m)} tint={hueFrom(m.userId)} size="sm" />
                        <span className="st-mention-item-name">{getDisplayName(m)}</span>
                        <span className="st-mention-item-handle">@{getMentionHandle(m)}</span>
                      </button>
                    ))}
                  </div>
                )}
                <AnimatePresence>
                  {showEmoji && (
                    <motion.div key="composer-emoji" className="st-emoji-pop" initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4 }}>
                      {QUICK_EMOJIS.map((e) => (
                        <button key={e} type="button" className="st-emoji-cell" title={`Insert ${e}`} onMouseDown={(ev) => { ev.preventDefault(); setDraft((v) => `${v}${e}`); inputRef.current?.focus(); }}>
                          {e}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="composer-row">
                  <button type="button" className="composer-add" title="Attach image" aria-label="Attach image" onClick={() => { fileRef.current?.click(); fileRef.current?.setAttribute("accept", "image/*"); }}>
                    <IconPaperclip size={15} />
                  </button>
                  <button type="button" className="composer-add" title="Attach audio" aria-label="Attach audio" onClick={() => { fileRef.current?.click(); fileRef.current?.setAttribute("accept", "audio/*"); }}>
                    <IconMic size={15} />
                  </button>
                  <Textarea ref={inputRef} rows={1} value={draft} onChange={(e) => { setDraft(e.target.value); updateMention(e.target.value, e.target.selectionStart); broadcastTyping(); }} onKeyDown={onKeyDown} placeholder="Write a message…" aria-label="Send a message" aria-autocomplete="list" aria-expanded={!!mention && filtered.length > 0} aria-controls={mention ? "mention-list" : undefined} maxLength={2000} autoComplete="off" className="chat-input max-h-32 min-h-[34px] resize-none" />
                  <button type="button" className={cx("composer-ghost", showEmoji && "is-on")} title="Insert emoji" aria-label="Insert emoji" aria-expanded={showEmoji} onClick={() => setShowEmoji((v) => !v)}>
                    <IconSmile size={16} />
                  </button>
                  <button type="submit" className="composer-send" disabled={!canSend} aria-label="Send message" title="Send message">
                    <IconSend size={14} />
                  </button>
                </div>
                <input ref={fileRef} type="file" accept="image/*,audio/*" multiple hidden aria-label="Attach files" onChange={(e) => { if (e.target.files) void filesToAttachments(e.target.files); e.target.value = ""; }} />
                <div className="composer-hint">@ to tag · image or audio · Enter to send</div>
              </div>
            </form>
          </main>
        </div>

        <AnimatePresence>
          {lightbox && (
            <motion.div key="lightbox" className="st-lightbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLightbox(null)} role="dialog" aria-modal="true" aria-label="Attachment preview">
              {lightbox.mime.startsWith("image/") ? (
                <>
                  <img src={lightbox.url} alt={lightbox.name} className="max-w-[70vw] max-h-[60vh] rounded-lg object-contain" />
                  <span className="st-lightbox-name">{lightbox.name}</span>
                </>
              ) : (
                <>
                  <AudioMessage a={lightbox} own={false} />
                  <span className="st-lightbox-name">{lightbox.name}</span>
                </>
              )}
              <button className="st-lightbox-close" onClick={() => setLightbox(null)} aria-label="Close preview">✕</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
  );
}

/** The feature page — mounts as a first-class section of the workspace shell.
 *  LagoonShell carries the sidebar + auth gate + ⌘K palette; the room fills
 *  the remaining viewport next to it. Boards feed the sidebar's board list so
 *  navigation stays one click away, exactly like the other /app sections. */
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
