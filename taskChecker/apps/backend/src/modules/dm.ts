/** End-to-end encrypted direct messages between two workspace members.
 *
 * Privacy model — the server is a ciphertext relay, never a reader:
 * - Clients generate an ECDH P-256 identity keypair in the browser. The private
 *   half stays in localStorage; only the public JWK is uploaded (`PUT /dm/keys`).
 * - For a pair (A,B) both sides derive the same AES-256-GCM key via
 *   ECDH(priv_self, pub_peer). Messages are encrypted client-side; the API only
 *   accepts `{ ciphertext, iv }` (both base64) — there is NO plaintext column,
 *   so a DB dump or a curious admin cannot read DMs.
 * - Realtime fan-out carries ids only (`dm.message` with conversationId +
 *   messageId); clients fetch ciphertext and decrypt locally.
 * - Conversations are per-tenant and exactly one row per unordered pair
 *   (participant_low < participant_high enforces (A,B)==(B,A)).
 */
import { Hono } from "hono";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { inTenant } from "../lib/request.js";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { uuidv7 } from "../lib/ids.js";
import { requireRole, Rbac } from "../lib/rbac.js";
import { emitEvent } from "../lib/events.js";
import { decodeCursor, encodeCursor, keysetBefore, parseLimit } from "../lib/cursor.js";
import { dmConversations, dmKeys, dmMessages } from "../db/schema.js";

export const dmRoutes = new Hono();

const uuidSchema = z.string().uuid();
const b64Schema = z
  .string()
  .min(4)
  .max(16000)
  .regex(/^[A-Za-z0-9+/=_-]+$/, "Must be base64.");

/** Minimal ECDH P-256 public-JWK shape check (full crypto validation is client-side). */
const publicJwkSchema = z
  .object({
    kty: z.literal("EC"),
    crv: z.literal("P-256"),
    x: z.string().min(10).max(200),
    y: z.string().min(10).max(200),
    ext: z.boolean().optional(),
    key_ops: z.array(z.string()).optional(),
  })
  .passthrough();

function sortPair(a: string, b: string): [low: string, high: string] {
  return a < b ? [a, b] : [b, a];
}

function dmRecord(r: typeof dmMessages.$inferSelect) {
  return {
    id: r.id,
    conversationId: r.conversationId,
    senderId: r.senderId,
    ciphertext: r.ciphertext,
    iv: r.iv,
    createdAt: r.createdAt,
  };
}

// PUT /v1/dm/keys { publicJwk } — publish my ECDH public identity key.
dmRoutes.put("/dm/keys", async (c) => {
  const p = c.get("principal");
  if (!p.userId) throw forbidden("Direct messages require a user token.");
  const parsed = z.object({ publicJwk: publicJwkSchema }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw badRequest("A valid ECDH P-256 public JWK is required.");
  const raw = JSON.stringify(parsed.data.publicJwk);
  if (raw.length > 2000) throw badRequest("Public key too large.");
  return inTenant(c, async (tx) => {
    requireRole(p.role, Rbac.read);
    await tx
      .insert(dmKeys)
      .values({ userId: p.userId!, publicJwk: raw })
      .onConflictDoUpdate({ target: dmKeys.userId, set: { publicJwk: raw, updatedAt: new Date() } });
    return c.json({ ok: true });
  });
});

// GET /v1/dm/keys/:userId — fetch a member's public key (to derive the shared secret).
dmRoutes.get("/dm/keys/:userId", async (c) => {
  const p = c.get("principal");
  const peerId = c.req.param("userId");
  if (!uuidSchema.safeParse(peerId).success) throw badRequest("Invalid user id.");
  return inTenant(c, async (tx) => {
    requireRole(p.role, Rbac.read);
    // Caller and peer must both be active members of this tenant — no cross-org key harvesting.
    const peerMembership = await tx.query.memberships.findFirst({
      where: (m, { and: a, eq: e }) => a(e(m.tenantId, p.tenantId), e(m.userId, peerId)),
    });
    if (!peerMembership || peerMembership.status !== "active") throw notFound("Member not found.");
    const row = await tx.query.dmKeys.findFirst({ where: (k, { eq: e }) => e(k.userId, peerId) });
    if (!row) throw notFound("This member has not enabled encrypted chat yet.");
    return c.json({ userId: peerId, publicJwk: JSON.parse(row.publicJwk) });
  });
});

// POST /v1/dm/conversations { peerId } — get-or-create the 1:1 thread.
dmRoutes.post("/dm/conversations", async (c) => {
  const p = c.get("principal");
  const parsed = z.object({ peerId: uuidSchema }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw badRequest("peerId (uuid) is required.");
  const peerId = parsed.data.peerId;
  if (!p.userId) throw forbidden("Direct messages require a user token.");
  if (peerId === p.userId) throw badRequest("You cannot message yourself.");
  return inTenant(c, async (tx) => {
    requireRole(p.role, Rbac.write);
    const peerMembership = await tx.query.memberships.findFirst({
      where: (m, { and: a, eq: e }) => a(e(m.tenantId, p.tenantId), e(m.userId, peerId)),
    });
    if (!peerMembership || peerMembership.status !== "active") throw notFound("Member not found.");
    const [low, high] = sortPair(p.userId!, peerId);
    const existing = await tx.query.dmConversations.findFirst({
      where: (r, { and: a, eq: e }) =>
        a(e(r.tenantId, p.tenantId), e(r.participantLow, low), e(r.participantHigh, high)),
    });
    if (existing) {
      const peer = await tx.query.users.findFirst({ where: (u, { eq: e }) => e(u.id, peerId) });
      return c.json({
        conversation: {
          id: existing.id,
          peerId,
          peerName: peer?.name ?? null,
          peerEmail: peer?.email ?? null,
          createdAt: existing.createdAt,
          lastMessageAt: existing.lastMessageAt,
        },
      });
    }
    const id = uuidv7();
    await tx.insert(dmConversations).values({
      tenantId: p.tenantId,
      id,
      participantLow: low,
      participantHigh: high,
    });
    const peer = await tx.query.users.findFirst({ where: (u, { eq: e }) => e(u.id, peerId) });
    void emitEvent({
      tenantId: p.tenantId,
      actorId: p.userId!,
      type: "dm.created",
      entityType: "dm",
      entityId: id,
      meta: { conversationId: id, peerId },
      targetUserIds: [peerId],
    });
    return c.json(
      {
        conversation: {
          id,
          peerId,
          peerName: peer?.name ?? null,
          peerEmail: peer?.email ?? null,
          createdAt: new Date(),
          lastMessageAt: null,
        },
      },
      201,
    );
  });
});

// GET /v1/dm/conversations — my threads (newest activity first).
dmRoutes.get("/dm/conversations", async (c) => {
  const p = c.get("principal");
  if (!p.userId) throw forbidden("Direct messages require a user token.");
  return inTenant(c, async (tx) => {
    requireRole(p.role, Rbac.read);
    const rows = await tx
      .select()
      .from(dmConversations)
      .where(
        and(
          eq(dmConversations.tenantId, p.tenantId),
          or(
            eq(dmConversations.participantLow, p.userId!),
            eq(dmConversations.participantHigh, p.userId!),
          ),
        ),
      )
      .orderBy(desc(dmConversations.lastMessageAt), desc(dmConversations.createdAt))
      .limit(100);
    const peerIds = rows.map((r) => (r.participantLow === p.userId ? r.participantHigh : r.participantLow));
    const peers =
      peerIds.length > 0
        ? await tx.query.users.findMany({
            where: (u, { inArray }) => inArray(u.id, peerIds),
          })
        : [];
    const byId = new Map(peers.map((u) => [u.id, u]));
    return c.json({
      conversations: rows.map((r) => {
        const peerId = r.participantLow === p.userId ? r.participantHigh : r.participantLow;
        const peer = byId.get(peerId);
        return {
          id: r.id,
          peerId,
          peerName: peer?.name ?? null,
          peerEmail: peer?.email ?? null,
          createdAt: r.createdAt,
          lastMessageAt: r.lastMessageAt,
        };
      }),
    });
  });
});

async function requireParticipant(
  tx: Parameters<Parameters<typeof inTenant>[1]>[0],
  tenantId: string,
  userId: string,
  conversationId: string,
) {
  const conv = await tx.query.dmConversations.findFirst({
    where: (r, { and: a, eq: e }) => a(e(r.tenantId, tenantId), e(r.id, conversationId)),
  });
  if (!conv) throw notFound("Conversation not found.");
  if (conv.participantLow !== userId && conv.participantHigh !== userId) {
    throw forbidden("You are not a participant of this conversation.");
  }
  return conv;
}

// GET /v1/dm/conversations/:id/messages — ciphertext page (newest first).
dmRoutes.get("/dm/conversations/:id/messages", async (c) => {
  const p = c.get("principal");
  if (!p.userId) throw forbidden("Direct messages require a user token.");
  const id = c.req.param("id");
  if (!uuidSchema.safeParse(id).success) throw badRequest("Invalid conversation id.");
  const limit = parseLimit(c.req.query("limit"), 100, 50);
  const cursor = c.req.query("cursor") ? decodeCursor(c.req.query("cursor")!) : null;
  return inTenant(c, async (tx) => {
    requireRole(p.role, Rbac.read);
    await requireParticipant(tx, p.tenantId, p.userId!, id);
    const where = [eq(dmMessages.tenantId, p.tenantId), eq(dmMessages.conversationId, id)];
    if (cursor) where.push(keysetBefore(dmMessages.createdAt, dmMessages.id, cursor));
    const rows = await tx
      .select()
      .from(dmMessages)
      .where(and(...where, isNull(dmMessages.deletedAt)))
      .orderBy(desc(dmMessages.createdAt), desc(dmMessages.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return c.json({
      data: page.map(dmRecord),
      nextCursor: page.length === limit && last ? encodeCursor(last.createdAt!, last.id) : null,
      hasMore: rows.length > limit,
    });
  });
});

// POST /v1/dm/conversations/:id/messages { ciphertext, iv } — store ciphertext only.
dmRoutes.post("/dm/conversations/:id/messages", async (c) => {
  const p = c.get("principal");
  if (!p.userId) throw forbidden("Direct messages require a user token.");
  const id = c.req.param("id");
  if (!uuidSchema.safeParse(id).success) throw badRequest("Invalid conversation id.");
  const parsed = z.object({ ciphertext: b64Schema, iv: b64Schema }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw badRequest("ciphertext and iv (base64) are required.");
  // 12-byte IV → 16 chars base64; cap ciphertext at ~12KB (≈9KB plaintext + GCM tag).
  if (parsed.data.iv.length > 32) throw badRequest("Invalid iv.");
  return inTenant(c, async (tx) => {
    requireRole(p.role, Rbac.write);
    const conv = await requireParticipant(tx, p.tenantId, p.userId!, id);
    const peerId = conv.participantLow === p.userId ? conv.participantHigh : conv.participantLow;
    const msgId = uuidv7();
    await tx.insert(dmMessages).values({
      tenantId: p.tenantId,
      id: msgId,
      conversationId: id,
      senderId: p.userId!,
      ciphertext: parsed.data.ciphertext,
      iv: parsed.data.iv,
    });
    await tx
      .update(dmConversations)
      .set({ lastMessageAt: new Date() })
      .where(and(eq(dmConversations.tenantId, p.tenantId), eq(dmConversations.id, id)));
    // Realtime carries ids ONLY — never ciphertext preview, never plaintext.
    void emitEvent({
      tenantId: p.tenantId,
      actorId: p.userId!,
      type: "dm.message",
      entityType: "dm",
      entityId: msgId,
      meta: { conversationId: id, messageId: msgId, senderId: p.userId },
      targetUserIds: [peerId],
    });
    return c.json(
      {
        message: {
          id: msgId,
          conversationId: id,
          senderId: p.userId,
          ciphertext: parsed.data.ciphertext,
          iv: parsed.data.iv,
          createdAt: new Date(),
        },
      },
      201,
    );
  });
});
