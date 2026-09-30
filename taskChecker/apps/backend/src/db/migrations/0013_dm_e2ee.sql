-- 0013_dm_e2ee.sql — end-to-end encrypted direct messages between two members.
--
-- Privacy model: the server is a dumb ciphertext store. It NEVER sees plaintext.
--   dm_keys          = per-user ECDH P-256 public key (JWK JSON, global — identity
--                      is per-user, not per-tenant). Private keys never leave the browser.
--   dm_conversations = one row per unordered member pair per tenant (low/high sorted
--                      so (A,B) and (B,A) collide on the UNIQUE constraint).
--   dm_messages      = ciphertext + iv ONLY (both base64). No body/plaintext column
--                      exists by design — a SELECT here cannot reveal content.
-- RLS mirrors the team-chat shape (fail-closed via nullif-hardened GUC) for the
-- tenant-scoped tables. dm_keys is global (like users) so it carries no RLS.
-- All statements idempotent-guarded so re-runs are safe.

-- 1) Public identity keys (global).
CREATE TABLE IF NOT EXISTS dm_keys (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  public_jwk TEXT NOT NULL CHECK (char_length(public_jwk) BETWEEN 50 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Conversations: exactly one row per unordered pair per tenant.
CREATE TABLE IF NOT EXISTS dm_conversations (
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id              UUID NOT NULL,
  participant_low UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_high UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, participant_low, participant_high),
  CHECK (participant_low < participant_high)
);
CREATE INDEX IF NOT EXISTS dm_conversations_participant_idx
  ON dm_conversations (tenant_id, participant_low, participant_high, last_message_at DESC);

-- 3) Messages: ciphertext store only.
CREATE TABLE IF NOT EXISTS dm_messages (
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id              UUID NOT NULL,
  conversation_id UUID NOT NULL,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ciphertext      TEXT NOT NULL CHECK (char_length(ciphertext) BETWEEN 4 AND 16000),
  iv              TEXT NOT NULL CHECK (char_length(iv) BETWEEN 4 AND 64),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, conversation_id) REFERENCES dm_conversations (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS dm_messages_conversation_idx
  ON dm_messages (tenant_id, conversation_id, created_at DESC, id DESC);

-- 4) RLS (fail-closed, same shape as chat_messages).
ALTER TABLE dm_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON dm_conversations;
CREATE POLICY tenant_isolation ON dm_conversations USING (
  tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
) WITH CHECK (
  tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
);
ALTER TABLE dm_conversations FORCE ROW LEVEL SECURITY;

ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON dm_messages;
CREATE POLICY tenant_isolation ON dm_messages USING (
  tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
) WITH CHECK (
  tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
);
ALTER TABLE dm_messages FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON dm_keys TO teamflow;
GRANT SELECT, INSERT, UPDATE, DELETE ON dm_conversations TO teamflow;
GRANT SELECT, INSERT, UPDATE, DELETE ON dm_messages TO teamflow;
