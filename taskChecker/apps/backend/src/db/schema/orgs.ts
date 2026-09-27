import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { membershipStatusEnum, roleEnum, t, now } from "./enums.js";

/** RBAC anchor: (tenant_id, user_id) with role + status. */
export const memberships = pgTable(
  "memberships",
  {
    tenantId: uuid("tenant_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: roleEnum("role").notNull(),
    status: membershipStatusEnum("status").notNull().default("active"),
    invitedAt: t("invited_at").default(now()),
    acceptedAt: t("accepted_at"),
  },
  (table) => [index("memberships_user_idx").on(table.userId)]
);

export const invites = pgTable("invites", {
  tenantId: uuid("tenant_id").notNull(),
  id: uuid("id").notNull(),
  email: text("email").notNull(),
  role: roleEnum("role").notNull().default("member"),
  tokenHash: text("token_hash").notNull(),
  /** SHA-256 of the short shareable code (NULL for pre-code invites). */
  codeHash: text("code_hash"),
  expiresAt: t("expires_at").notNull(),
  acceptedAt: t("accepted_at"),
  invitedById: uuid("invited_by_id").notNull(),
  createdAt: t("created_at").default(now()),
}, (table) => [
  index("invites_hash_idx").on(table.tokenHash),
  index("invites_code_hash_idx").on(table.codeHash),
]);

/** Organization-deletion verification codes: single-use 6-digit codes emailed
 * to the requesting owner and verified alongside their account password
 * before the tenant row (and, via FK cascade, all tenant data) is deleted. */
export const orgDeleteCodes = pgTable("org_delete_codes", {
  tenantId: uuid("tenant_id").notNull(),
  id: uuid("id").notNull(),
  /** SHA-256 of the 6-digit code — the plaintext only ever travels by email. */
  codeHash: text("code_hash").notNull(),
  expiresAt: t("expires_at").notNull(),
  usedAt: t("used_at"),
  requestedById: uuid("requested_by_id").notNull(),
  createdAt: t("created_at").default(now()),
}, (table) => [
  index("org_delete_codes_tenant_idx").on(table.tenantId, table.createdAt),
]);
