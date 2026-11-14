CREATE TABLE fuzl.fuzl_saved_ideas (
 id UUID PRIMARY KEY, "groupId" UUID NOT NULL REFERENCES fuzl.fuzl_groups(id) ON DELETE CASCADE,
 content JSONB NOT NULL, origin JSONB NOT NULL,
 archived BOOLEAN NOT NULL DEFAULT false, edited BOOLEAN NOT NULL DEFAULT false,
 revision INTEGER NOT NULL DEFAULT 1, "creationId" UUID NOT NULL, "creationHash" VARCHAR(64) NOT NULL,
 "lastRequestId" UUID NOT NULL, "lastRequestHash" VARCHAR(64) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 UNIQUE ("groupId", "creationId")
);
CREATE INDEX fuzl_saved_ideas_group_idx ON fuzl.fuzl_saved_ideas ("groupId");
ALTER TABLE fuzl.fuzl_saved_ideas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fuzl.fuzl_saved_ideas FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON fuzl.fuzl_saved_ideas FROM anon; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON fuzl.fuzl_saved_ideas FROM authenticated; END IF;
END $$;
