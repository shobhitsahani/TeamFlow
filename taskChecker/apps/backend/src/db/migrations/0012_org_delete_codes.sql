-- Org-deletion verification codes: single-use 6-digit codes emailed to the
-- requesting owner, verified alongside their account password before a tenant
-- is destroyed. Hash-at-rest like invite tokens; only the hash is stored.
-- The FK cascade wipes a tenant's codes with it on delete.

CREATE TABLE IF NOT EXISTS org_delete_codes (
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  id             UUID NOT NULL,
  code_hash      TEXT NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  used_at        TIMESTAMPTZ,
  requested_by_id UUID NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_delete_codes_tenant_idx ON org_delete_codes (tenant_id, created_at);

-- Fail closed like every other tenant table (see 0002): without a tenant
-- context the app role sees zero rows.
ALTER TABLE org_delete_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_delete_codes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON org_delete_codes;
CREATE POLICY tenant_isolation ON org_delete_codes USING (
  tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
) WITH CHECK (
  tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
);
