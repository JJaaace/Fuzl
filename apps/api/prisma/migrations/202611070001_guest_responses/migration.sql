CREATE TABLE fuzl.fuzl_guest_invites (
  id UUID PRIMARY KEY, "sessionId" UUID NOT NULL REFERENCES fuzl.fuzl_sessions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "activeSessionId" UUID UNIQUE, "tokenDigest" VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(100) NOT NULL, questions JSONB NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ("activeSessionId" IS NULL OR "activeSessionId" = "sessionId")
);
CREATE INDEX "fuzl_guest_invites_sessionId_idx" ON fuzl.fuzl_guest_invites("sessionId");
CREATE TABLE fuzl.fuzl_guest_responses (
  id UUID PRIMARY KEY, "inviteId" UUID NOT NULL REFERENCES fuzl.fuzl_guest_invites(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "submissionId" UUID NOT NULL, "editDigest" VARCHAR(64) NOT NULL UNIQUE, alias VARCHAR(80) NOT NULL,
  answers JSONB NOT NULL, revision INTEGER NOT NULL DEFAULT 1, "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("inviteId", "submissionId")
);
CREATE INDEX "fuzl_guest_responses_inviteId_idx" ON fuzl.fuzl_guest_responses("inviteId");
CREATE TABLE fuzl.fuzl_guest_private_answers (
  id UUID PRIMARY KEY, "responseId" UUID NOT NULL REFERENCES fuzl.fuzl_guest_responses(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "questionId" UUID NOT NULL, amount DECIMAL(12,2), currency VARCHAR(3), state VARCHAR(10) NOT NULL,
  UNIQUE ("responseId", "questionId"), CHECK (amount IS NULL OR amount >= 0)
);
DO $$ DECLARE table_name text; role_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['fuzl_guest_invites','fuzl_guest_responses','fuzl_guest_private_answers'] LOOP
    EXECUTE format('ALTER TABLE fuzl.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE fuzl.%I FROM PUBLIC', table_name);
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN EXECUTE format('REVOKE ALL ON TABLE fuzl.%I FROM %I', table_name, role_name); END IF;
    END LOOP;
  END LOOP;
END $$;
