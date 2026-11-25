-- Optional organizer-selected destination. No device location or existing data rewrite.
ALTER TABLE fuzl.fuzl_chat_threads ADD COLUMN destination jsonb;

-- Database-wide beta rate/concurrency leases, independent of deletable threads.
CREATE TABLE fuzl.fuzl_ai_request_leases (
  id uuid PRIMARY KEY, "authSubject" uuid NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" timestamp(3) NOT NULL
);
CREATE INDEX "fuzl_ai_request_leases_authSubject_createdAt_idx" ON fuzl.fuzl_ai_request_leases("authSubject", "createdAt");
ALTER TABLE fuzl.fuzl_ai_request_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fuzl.fuzl_ai_request_leases FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON fuzl.fuzl_ai_request_leases FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON fuzl.fuzl_ai_request_leases FROM authenticated; END IF;
END $$;
