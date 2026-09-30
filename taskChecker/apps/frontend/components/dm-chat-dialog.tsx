"use client";

/* E2E encrypted 1:1 chat dialog.
 *
 * Flow: ensure my ECDH identity (localStorage + publish pubkey once) →
 * fetch peer pubkey → derive shared AES-GCM key → fetch ciphertext page →
 * decrypt locally → render. Sends encrypt first, then POST ciphertext.
 * The server only ever sees `{ ciphertext, iv }` — plaintext never leaves
 * this browser tab, and realtime fan-out carries ids only. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal, useToast } from "@/components/overlay";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api, type DmMessage, type PaginatedResponse } from "@/lib/api";
import { useSWR } from "@/lib/swr";
import { useRealtime } from "@/lib/realtime";
import { cx, formatChatTime, hueFrom } from "@/lib/utils";
import { IconLock, IconSend, IconX } from "@/components/icons";
import { decryptDm, deriveSharedKey, dmFingerprint, encryptDm, getOrCreateIdentity } from "@/lib/dm-crypto";

export interface DmPeer {
  conversationId: string;
  peerId: string;
  peerName: string | null;
  peerEmail: string | null;
}

function initialsOf(name: string | null, email: string | null): string {
  const src = (name ?? email ?? "?").trim();
  if (!src) return "?";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function DmChatDialog({
  open,
  onClose,
  peer,
  currentUserId,
}: {
  open: boolean;
  onClose: () => void;
  peer: DmPeer | null;
  currentUserId: string | undefined;
}) {
  const toast = useToast();
  const [sharedKey, setSharedKey] = useState<CryptoKey | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [cryptoError, setCryptoError] = useState<string | null>(null);
  const [cryptoReady, setCryptoReady] = useState(false);
  const [peerMissing, setPeerMissing] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [plain, setPlain] = useState<Map<string, string>>(new Map());
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const conversationId = peer?.conversationId ?? null;
  const peerId = peer?.peerId ?? null;

  const msgsQ = useSWR<PaginatedResponse<DmMessage>>(
    open && conversationId ? `dm-messages-${conversationId}` : null,
    () => api.dm.listMessages(conversationId!),
  );

  // ---- E2E setup: identity → publish (first run) → peer key → shared secret.
  useEffect(() => {
    if (!open || !peerId || !currentUserId) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setCryptoError(null);
        setCryptoReady(false);
        setPeerMissing(false);
        setSharedKey(null);
        setFingerprint(null);
      }
    });
    (async () => {
      try {
        const { privateKey, publicJwk, isNew } = await getOrCreateIdentity(currentUserId);
        if (isNew) {
          try {
            await api.dm.publishKey(publicJwk);
          } catch (err) {
            if (!cancelled) {
              setCryptoError(err instanceof Error ? err.message : "Could not publish encryption key.");
              return;
            }
          }
        }
        let peerJwk: JsonWebKey;
        try {
          const res = await api.dm.peerKey(peerId);
          peerJwk = res.publicJwk;
        } catch {
          if (!cancelled) setPeerMissing(true);
          return;
        }
        const shared = await deriveSharedKey(privateKey, peerJwk);
        const fp = await dmFingerprint(publicJwk, peerJwk);
        if (!cancelled) {
          setSharedKey(shared);
          setFingerprint(fp);
          setCryptoReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setCryptoError(
            err instanceof Error ? err.message : "Encryption unavailable in this browser.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, peerId, currentUserId]);

  // ---- Decrypt the page locally whenever ciphertext or the key changes.
  const items = useMemo(() => [...(msgsQ.data?.data ?? [])].reverse(), [msgsQ.data]);
  useEffect(() => {
    if (!sharedKey || items.length === 0) return;
    let cancelled = false;
    (async () => {
      const next = new Map<string, string>();
      await Promise.all(
        items.map(async (m) => {
          try {
            next.set(m.id, await decryptDm(sharedKey, m.ciphertext, m.iv));
          } catch {
            next.set(m.id, "");
          }
        }),
      );
      if (!cancelled) setPlain(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [sharedKey, items]);

  // ---- Realtime: a `dm.message` carries ids only — refetch + decrypt.
  const mutateRef = useRef(msgsQ.mutate);
  useEffect(() => {
    mutateRef.current = msgsQ.mutate;
  });
  const convRef = useRef(conversationId);
  useEffect(() => {
    convRef.current = conversationId;
  });
  useRealtime(
    useMemo(
      () => ({
        onDm: (msg: { meta?: unknown; type: string }) => {
          const meta = msg.meta as { conversationId?: string } | undefined;
          if (!meta?.conversationId || meta.conversationId !== convRef.current) return;
          void mutateRef.current();
        },
      }),
      [],
    ),
  );

  // Stick to bottom on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && open) el.scrollTop = el.scrollHeight;
  }, [items.length, open, plain.size]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || !sharedKey || !conversationId || sending) return;
    setSending(true);
    try {
      const { ciphertext, iv } = await encryptDm(sharedKey, text.slice(0, 2000));
      await api.dm.sendMessage(conversationId, { ciphertext, iv });
      setDraft("");
      await msgsQ.mutate();
    } catch (err) {
      toast({ title: "Send failed", msg: err instanceof Error ? err.message : "Try again.", kind: "err" });
    } finally {
      setSending(false);
    }
  }, [draft, sharedKey, conversationId, sending, msgsQ, toast]);

  const peerLabel = peer?.peerName ?? peer?.peerEmail ?? "Member";
  const tint = hueFrom(peer?.peerId ?? "dm");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Secure chat — ${peerLabel}`}
      sub={peer?.peerEmail ?? undefined}
      contentClassName="dm-dialog"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => void send()} disabled={!draft.trim() || !cryptoReady || sending} loading={sending}>
            <IconSend size={14} /> Send encrypted
          </Button>
        </>
      }
    >
      <div className="dm-e2e" role="status">
        <IconLock size={13} />
        <span>
          End-to-end encrypted — only you and {peerLabel} can read these messages.
          {fingerprint ? (
            <>
              {" "}
              Key fingerprint: <code className="font-mono">{fingerprint}</code>
            </>
          ) : null}
        </span>
      </div>

      {cryptoError ? (
        <p className="dm-error" role="alert">
          Encryption setup failed: {cryptoError}
        </p>
      ) : null}
      {peerMissing ? (
        <p className="dm-wait" role="status">
          {peerLabel} hasn&apos;t enabled encrypted chat yet — they&apos;ll appear once they open a
          secure chat on their device. Your messages stay on this device until then.
        </p>
      ) : null}

      <div className="dm-list" ref={scrollRef} role="log" aria-live="polite" aria-label="Encrypted messages">
        {msgsQ.isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="dim dm-empty">
            No messages yet. Say hello — it&apos;ll be encrypted before it leaves this browser.
          </p>
        ) : (
          items.map((m) => {
            const own = m.senderId === currentUserId;
            const text = plain.get(m.id);
            const when = formatChatTime(m.createdAt);
            return (
              <div key={m.id} className={cx("dm-msg", own ? "is-own" : "is-peer")}>
                {!own ? (
                  <Avatar size="sm">
                    <AvatarFallback
                      style={{
                        background: `hsl(${tint} 45% 20%)`,
                        color: `hsl(${tint} 80% 78%)`,
                      }}
                    >
                      {initialsOf(peer?.peerName ?? null, peer?.peerEmail ?? null)}
                    </AvatarFallback>
                  </Avatar>
                ) : null}
                <div className="dm-bubble">
                  {text === undefined ? (
                    <span className="dim">Decrypting…</span>
                  ) : text === "" ? (
                    <span className="dm-undecryptable">Couldn&apos;t decrypt this message on this device.</span>
                  ) : (
                    <p>{text}</p>
                  )}
                  <time className="dm-time" dateTime={m.createdAt} title={when.title}>
                    {when.relative} · {when.absolute}
                  </time>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="dm-composer">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
            if (e.key === "Escape") onClose();
          }}
          placeholder={cryptoReady ? "Write an encrypted message…" : "Setting up encryption…"}
          aria-label="Write an encrypted message"
          maxLength={2000}
          disabled={!cryptoReady || !!cryptoError}
        />
        {draft ? (
          <Button variant="ghost" size="icon-sm" onClick={() => setDraft("")} aria-label="Clear message">
            <IconX size={14} />
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}
