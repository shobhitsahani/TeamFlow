import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { now, t } from "./enums.js";

/** Per-user ECDH P-256 public identity key (JWK JSON). Global table — identity
 * is per-user, not per-tenant. The private half never leaves the browser. */
export const dmKeys = pgTable("dm_keys", {
  userId: uuid("user_id").primaryKey(),
  publicJwk: text("public_jwk").notNull(),
  createdAt: t("created_at").default(now()),
  updatedAt: t("updated_at").default(now()),
});

/** One row per unordered member pair per tenant. participantLow < participantHigh
 * (lexicographic on the uuid string) so (A,B) and (B,A) share one row. */
export const dmConversations = pgTable(
  "dm_conversations",
  {
    tenantId: uuid("tenant_id").notNull(),
    id: uuid("id").notNull(),
    participantLow: uuid("participant_low").notNull(),
    participantHigh: uuid("participant_high").notNull(),
    createdAt: t("created_at").default(now()),
    lastMessageAt: t("last_message_at"),
  },
  (table) => [
    index("dm_conversations_participant_idx").on(
      table.tenantId,
      table.participantLow,
      table.participantHigh,
      table.lastMessageAt,
    ),
  ],
);

/** Ciphertext store ONLY — there is deliberately no plaintext column. The
 * server persists { ciphertext, iv } (both base64, AES-256-GCM) and relays
 * ids over realtime; decryption happens exclusively in the two browsers. */
export const dmMessages = pgTable(
  "dm_messages",
  {
    tenantId: uuid("tenant_id").notNull(),
    id: uuid("id").notNull(),
    conversationId: uuid("conversation_id").notNull(),
    senderId: uuid("sender_id").notNull(),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    createdAt: t("created_at").default(now()),
    deletedAt: t("deleted_at"),
  },
  (table) => [
    index("dm_messages_conversation_idx").on(
      table.tenantId,
      table.conversationId,
      table.createdAt,
      table.id,
    ),
  ],
);
