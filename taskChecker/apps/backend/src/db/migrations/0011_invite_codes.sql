-- Invite short codes: a human-typable 8-char code minted alongside every new
-- invite, so the inviter can relay "join with code XXXXXXXX" (chat, email,
-- whiteboard) instead of only the long token link. Codes are hashed at rest
-- like tokens; only the hash is stored. Rows created before this migration
-- keep code_hash NULL and continue to work through their token link.
ALTER TABLE invites ADD COLUMN IF NOT EXISTS code_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS invites_code_hash_idx ON invites (code_hash);

-- SECURITY DEFINER lookup so the public accept/preview routes can resolve a
-- code before any tenant context exists (same pattern as by-token).
CREATE OR REPLACE FUNCTION lookup_invite_by_code(p_code_hash text)
RETURNS TABLE (tenant_id uuid, id uuid, email text, role membership_role, expires_at timestamptz, accepted_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT tenant_id, id, email, role, expires_at, accepted_at
  FROM invites
  WHERE invites.code_hash = lookup_invite_by_code.p_code_hash
$$;

REVOKE ALL ON FUNCTION lookup_invite_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_invite_by_code(text) TO teamflow;
