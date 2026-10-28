"use client";

/* Quick chat — collapsible team-chat preview in the Lagoon sidebar, right
   below the Workspace nav. Shares ChatRail's SWR cache keys (`chat-messages-`,
   `ctx-members-`) and the same realtime socket, so a message sent here shows
   up in the rail and vice versa — one room, two windows onto it.

   GroupChat speaks shadcn tokens (`--card`, `--border`, …) while the sidebar
   speaks Lagoon tokens (`--lagoon-card`, …), so this wrapper re-points the
   shadcn family at the Lagoon palette: the widget inherits the sidebar's
   surfaces in both themes instead of pasting a foreign card onto it. */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import GroupChat, { type ChatMessage } from "@/components/ui/group-chat";
import {
  IconChevronDown,
  IconChevronRight,
  IconMessageSquare,
  IconSend,
} from "@/components/icons";
import "blobatar/motion.css";

const OPEN_KEY = "tf.lagoon.quickchat.v1";

/* Open/collapsed state persists in localStorage. A tiny external store keeps
   it lint-clean (no setState-in-effect) and hydration-safe: React renders
   with the server snapshot, then reconciles to the client snapshot. */
const quickChatStore = {
  listeners: new Set<() => void>(),
  subscribe(listener: () => void) {
    quickChatStore.listeners.add(listener);
    // Cross-tab sync comes free with the storage event.
    window.addEventListener("storage", listener);
    return () => {
      quickChatStore.listeners.delete(listener);
      window.removeEventListener("storage", listener);
    };
  },
  emit() {
    for (const listener of quickChatStore.listeners) listener();
  },
  read(): boolean {
    try {
      return localStorage.getItem(OPEN_KEY) !== "0";
    } catch {
      return true;
    }
  },
};

/* GroupChat tokens → Lagoon sidebar palette. Card sits one step above the
   sidebar surface (muted), borders and accents follow the sidebar's own. */
const sideVars: CSSProperties & Record<`--${string}`, string> = {
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

export function QuickChat() {
  const { org } = useTenant();
  const { user } = useAuth();
  const toast = useToast();
  const orgId = org?.id;

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState<Map<string, { name: string; at: number }>>(new Map());

  const open = useSyncExternalStore(quickChatStore.subscribe, quickChatStore.read, () => true);

  const toggle = useCallback(() => {
    try {
      localStorage.setItem(OPEN_KEY, quickChatStore.read() ? "0" : "1");
    } catch {
      /* ignore — persistence is best-effort */
    }
    quickChatStore.emit();
  }, []);

  const chatQ = useSWR<PaginatedResponse<ApiChatMessage>>(
    orgId ? `chat-messages-${orgId}` : null,
    () => api.chat.list({ limit: 40 }),
  );
  const membersQ = useSWR<{ members: Array<{ userId: string; name: string | null; email: string | null; status: string }> }>(
    orgId ? `ctx-members-${orgId}` : null,
    () => api.orgs.listMembers(orgId!),
  );

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of membersQ.data?.members ?? []) {
      map.set(m.userId, m.name || m.email || "Member");
    }
    return map;
  }, [membersQ.data]);

  /* The API returns newest-first; the sidebar shows the latest few messages
     in chronological order so the thread reads top-down like ChatRail. */
  const messages = useMemo<ChatMessage[]>(
    () =>
      (chatQ.data?.data ?? [])
        .slice(0, 12)
        .reverse()
        .map((m) => ({
          name: names.get(m.authorId) ?? "Someone",
          text: m.body,
          time: formatChatTime(m.createdAt).absolute,
        })),
    [chatQ.data, names],
  );

  const people = useMemo(
    () => (membersQ.data?.members ?? []).map((m) => m.name || m.email || "Member"),
    [membersQ.data],
  );
  const facepile = people.slice(0, 4);
  const extra = Math.max(0, people.length - facepile.length);

  const channel = useMemo(() => {
    const slug = (org?.name ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || "team";
  }, [org?.name]);

  /* GroupChat takes a single typing name — the most recent speaker wins. */
  const typingName = useMemo(() => {
    let latest: { name: string; at: number } | null = null;
    for (const v of typing.values()) if (!latest || v.at > latest.at) latest = v;
    return latest?.name;
  }, [typing]);

  /* Realtime — same wiring as ChatRail. Refs keep the socket stable. */
  const mutateRef = useRef(chatQ.mutate);
  useEffect(() => {
    mutateRef.current = chatQ.mutate;
  });
  const userIdRef = useRef(user?.id);
  useEffect(() => {
    userIdRef.current = user?.id;
  });
  const namesRef = useRef(names);
  useEffect(() => {
    namesRef.current = names;
  });

  useRealtime({
    onChat: () => {
      void mutateRef.current();
    },
    onChatTyping: (msg) => {
      const meta = msg.meta as { authorId?: string; displayName?: string | null } | undefined;
      const aid = meta?.authorId;
      if (!aid || aid === userIdRef.current) return;
      const name = meta?.displayName || namesRef.current.get(aid)?.split(" ")[0] || "Someone";
      setTyping((prev) => {
        const next = new Map(prev);
        next.set(aid, { name, at: Date.now() });
        return next;
      });
    },
  });

  /* Typing indicators expire after 3.5s, like ChatRail. */
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

  /* Broadcast my typing, throttled to one ping per 2.5s. */
  const lastTypingRef = useRef(0);
  const broadcastTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingRef.current < 2500) return;
    lastTypingRef.current = now;
    void api.chat.typing(user?.name || user?.email || "Someone");
  }, [user?.name, user?.email]);

  /* Optimistic send — prepend newest-first, then let the revalidate settle
     the real record in. Same shape of failure handling as ChatRail. */
  const handleSend = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const text = draft.trim();
      if (!text || !user || sending) return;
      setDraft("");
      setSending(true);
      const optimistic: ApiChatMessage = {
        id: `local-${Date.now()}`,
        authorId: user.id,
        body: text,
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
        await api.chat.send(text);
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
      } finally {
        setSending(false);
      }
    },
    [chatQ, draft, sending, toast, user],
  );

  if (!orgId) return null;

  return (
    <section aria-label="Quick chat" style={sideVars}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cx(
          "flex w-full cursor-pointer items-center gap-1.5 px-5 py-1.5 text-[12px] font-semibold tracking-[0.01em]",
          "text-[var(--lagoon-muted-fg)] transition-colors hover:text-[var(--lagoon-ink)]",
        )}
        style={{ background: "none", border: "none", textAlign: "left" }}
      >
        <IconMessageSquare size={12} className="shrink-0" />
        <span className="flex-1">Quick chat</span>
        {open ? <IconChevronDown size={12} className="shrink-0" /> : <IconChevronRight size={12} className="shrink-0" />}
      </button>

      {open ? (
        <div className="px-3 pb-2">
          {messages.length > 0 ? (
            <div style={{ maxHeight: 320, overflowY: "auto", overscrollBehavior: "contain" }}>
              <GroupChat
                channel={channel}
                messages={messages}
                members={facepile}
                extra={extra}
                typing={typingName}
                className="rounded-lg"
              />
            </div>
          ) : (
            <p
              className="rounded-lg border px-4 py-3 text-xs"
              style={{
                background: "var(--lagoon-muted)",
                borderColor: "var(--lagoon-border)",
                color: "var(--lagoon-muted-fg)",
              }}
            >
              No messages yet — say hi to #{channel} 👋
            </p>
          )}

          <form className="mt-2 flex items-center gap-1.5" onSubmit={handleSend}>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={broadcastTyping}
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
      ) : null}
    </section>
  );
}

export default QuickChat;
