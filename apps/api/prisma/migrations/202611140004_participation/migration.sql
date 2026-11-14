CREATE TABLE fuzl.fuzl_session_scopes (
 id UUID PRIMARY KEY, "sessionId" UUID NOT NULL UNIQUE REFERENCES fuzl.fuzl_sessions(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL DEFAULT 1, mode VARCHAR(12) NOT NULL DEFAULT 'everyone', "window" JSONB,
 "inviteId" UUID REFERENCES fuzl.fuzl_guest_invites(id) ON DELETE SET NULL,
 mappings JSONB NOT NULL DEFAULT '[]', selected JSONB NOT NULL DEFAULT '[]', "reviewHash" VARCHAR(64),
 "lastRequestId" UUID NOT NULL, "lastRequestHash" VARCHAR(64) NOT NULL
);
CREATE TABLE fuzl.fuzl_scope_opt_ins (
 id UUID PRIMARY KEY, "scopeId" UUID NOT NULL REFERENCES fuzl.fuzl_session_scopes(id) ON DELETE CASCADE,
 "inviteId" UUID NOT NULL REFERENCES fuzl.fuzl_guest_invites(id) ON DELETE CASCADE,
 "responseId" UUID NOT NULL REFERENCES fuzl.fuzl_guest_responses(id) ON DELETE CASCADE,
 choice VARCHAR(12) NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
 "lastRequestId" UUID NOT NULL, "lastRequestHash" VARCHAR(64) NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL,
 UNIQUE ("scopeId", "inviteId", "responseId")
);
ALTER TABLE fuzl.fuzl_session_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuzl.fuzl_scope_opt_ins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fuzl.fuzl_session_scopes, fuzl.fuzl_scope_opt_ins FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON fuzl.fuzl_session_scopes, fuzl.fuzl_scope_opt_ins FROM anon; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON fuzl.fuzl_session_scopes, fuzl.fuzl_scope_opt_ins FROM authenticated; END IF;
END $$;
