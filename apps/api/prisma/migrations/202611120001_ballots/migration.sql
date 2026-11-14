CREATE TABLE fuzl.fuzl_ballot_shortlists (
  "sessionId" uuid PRIMARY KEY REFERENCES fuzl.fuzl_sessions(id) ON DELETE CASCADE,
  content jsonb NOT NULL, revision integer NOT NULL DEFAULT 1, "updatedAt" timestamp(3) NOT NULL
);
CREATE TABLE fuzl.fuzl_ballots (
  id uuid PRIMARY KEY, "sessionId" uuid NOT NULL REFERENCES fuzl.fuzl_sessions(id) ON DELETE CASCADE,
  "currentSessionId" uuid UNIQUE CHECK ("currentSessionId" IS NULL OR "currentSessionId" = "sessionId"), "publicationId" uuid NOT NULL, version integer NOT NULL,
  revision integer NOT NULL DEFAULT 1, "tokenDigest" varchar(64) NOT NULL UNIQUE,
  content jsonb NOT NULL, "expiresAt" timestamp(3) NOT NULL, "closedAt" timestamp(3), "revokedAt" timestamp(3),
  "supersededByVersion" integer, "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  UNIQUE ("sessionId", version), UNIQUE ("sessionId", "publicationId")
);
CREATE INDEX fuzl_ballots_session_idx ON fuzl.fuzl_ballots("sessionId");
CREATE TABLE fuzl.fuzl_ballot_votes (
  id uuid PRIMARY KEY, "ballotId" uuid NOT NULL REFERENCES fuzl.fuzl_ballots(id) ON DELETE CASCADE,
  "submissionId" uuid NOT NULL, "editDigest" varchar(64) NOT NULL UNIQUE, "optionId" uuid NOT NULL,
  revision integer NOT NULL DEFAULT 1, "lastRequestId" uuid, "updatedAt" timestamp(3) NOT NULL,
  UNIQUE ("ballotId", "submissionId")
);
CREATE INDEX fuzl_ballot_votes_ballot_idx ON fuzl.fuzl_ballot_votes("ballotId");
ALTER TABLE fuzl.fuzl_ballot_shortlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuzl.fuzl_ballots ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuzl.fuzl_ballot_votes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fuzl.fuzl_ballot_shortlists, fuzl.fuzl_ballots, fuzl.fuzl_ballot_votes FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON fuzl.fuzl_ballot_shortlists, fuzl.fuzl_ballots, fuzl.fuzl_ballot_votes FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
