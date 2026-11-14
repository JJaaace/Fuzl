CREATE TABLE fuzl.fuzl_outings (
 id UUID PRIMARY KEY, "planId" UUID NOT NULL UNIQUE REFERENCES fuzl.fuzl_shared_plans(id) ON DELETE CASCADE,
 "groupId" UUID NOT NULL REFERENCES fuzl.fuzl_groups(id) ON DELETE CASCADE,
 original JSONB NOT NULL, "originalVersion" INTEGER NOT NULL, actual JSONB NOT NULL, "actualVersion" INTEGER NOT NULL DEFAULT 1,
 "sameListing" BOOLEAN NOT NULL DEFAULT false, "confirmedAttendees" JSONB NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1, "feedbackVersion" INTEGER NOT NULL DEFAULT 0,
 "privateNotes" VARCHAR(1000) NOT NULL DEFAULT '', "proposedTakeaway" VARCHAR(300) NOT NULL DEFAULT '',
 "approvedTakeaway" VARCHAR(300), "approvedFeedbackVersion" INTEGER,
 "lastRequestId" UUID NOT NULL, "lastRequestHash" VARCHAR(64) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE fuzl.fuzl_outing_feedback (
 id UUID PRIMARY KEY, "outingId" UUID NOT NULL REFERENCES fuzl.fuzl_outings(id) ON DELETE CASCADE,
 "submissionId" UUID NOT NULL, "editDigest" VARCHAR(64) NOT NULL, answers JSONB NOT NULL, "memoryOpinion" JSONB NOT NULL, "actualVersion" INTEGER NOT NULL DEFAULT 1,
 revision INTEGER NOT NULL DEFAULT 1, "lastRequestId" UUID, "lastRequestHash" VARCHAR(64),
 "updatedAt" TIMESTAMP(3) NOT NULL,
 UNIQUE ("outingId", "submissionId"), UNIQUE ("outingId", "editDigest")
);
CREATE INDEX fuzl_outings_group_idx ON fuzl.fuzl_outings ("groupId");
ALTER TABLE fuzl.fuzl_outings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuzl.fuzl_outing_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fuzl.fuzl_outings, fuzl.fuzl_outing_feedback FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON fuzl.fuzl_outings, fuzl.fuzl_outing_feedback FROM anon; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON fuzl.fuzl_outings, fuzl.fuzl_outing_feedback FROM authenticated; END IF;
END $$;
