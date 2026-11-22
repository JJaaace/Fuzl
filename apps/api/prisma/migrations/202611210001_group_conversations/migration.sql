-- Additive native chat storage. Existing groups/sessions and published plans are unchanged.
CREATE TABLE fuzl.fuzl_chat_threads (
  id uuid PRIMARY KEY, "groupId" uuid NOT NULL REFERENCES fuzl.fuzl_groups(id) ON DELETE CASCADE, "sessionId" uuid NOT NULL UNIQUE REFERENCES fuzl.fuzl_sessions(id) ON DELETE CASCADE, "creationId" uuid NOT NULL, "creationHash" varchar(64) NOT NULL, title varchar(100) NOT NULL, version integer NOT NULL DEFAULT 1, "contentVersion" integer NOT NULL DEFAULT 1, "nextSequence" integer NOT NULL DEFAULT 0, "sharedVersion" integer NOT NULL DEFAULT 0, "sharedSummary" jsonb NOT NULL, "sharedSources" jsonb NOT NULL DEFAULT '{}', "activeRequestId" uuid, "activeUntil" timestamp(3), "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE("groupId","creationId")
);

CREATE TABLE fuzl.fuzl_chat_invites (
  id uuid PRIMARY KEY, "threadId" uuid NOT NULL REFERENCES fuzl.fuzl_chat_threads(id) ON DELETE CASCADE, "tokenDigest" varchar(64) NOT NULL UNIQUE, "allowAI" boolean NOT NULL DEFAULT false, "expiresAt" timestamp(3) NOT NULL, "revokedAt" timestamp(3), "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fuzl.fuzl_chat_members (
  id uuid PRIMARY KEY, "threadId" uuid NOT NULL REFERENCES fuzl.fuzl_chat_threads(id) ON DELETE CASCADE, "authSubject" uuid, "credentialDigest" varchar(64) UNIQUE, "joinId" uuid NOT NULL, "inviteId" uuid REFERENCES fuzl.fuzl_chat_invites(id) ON DELETE SET NULL, "displayName" varchar(60) NOT NULL, role varchar(12) NOT NULL CHECK(role IN ('organizer','member')), "canAI" boolean NOT NULL DEFAULT false, "planningParticipantId" varchar(80), "removedAt" timestamp(3), "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE("threadId","authSubject"), UNIQUE("threadId","joinId"), CHECK (("authSubject" IS NULL) <> ("credentialDigest" IS NULL))
);

CREATE TABLE fuzl.fuzl_chat_messages (
  id uuid PRIMARY KEY, "threadId" uuid NOT NULL REFERENCES fuzl.fuzl_chat_threads(id) ON DELETE CASCADE, "memberId" uuid REFERENCES fuzl.fuzl_chat_members(id) ON DELETE SET NULL, author varchar(60) NOT NULL, "submissionId" uuid NOT NULL, "submissionHash" varchar(64) NOT NULL, sequence integer NOT NULL, "changeVersion" integer NOT NULL, kind varchar(12) NOT NULL CHECK(kind IN ('person','fuzl','system')), body varchar(2000), "requestId" uuid, "deletedAt" timestamp(3), "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE("threadId",sequence), UNIQUE("threadId","memberId","submissionId")
);

CREATE TABLE fuzl.fuzl_chat_requests (
  id uuid PRIMARY KEY, "threadId" uuid NOT NULL REFERENCES fuzl.fuzl_chat_threads(id) ON DELETE CASCADE, "memberId" uuid NOT NULL REFERENCES fuzl.fuzl_chat_members(id) ON DELETE CASCADE, "inputHash" varchar(64) NOT NULL, kind varchar(12) NOT NULL CHECK(kind IN ('plan','question')), state varchar(12) NOT NULL CHECK(state IN ('pending','ready','stale','failed','cancelled','applied')), "contentVersion" integer NOT NULL, "sharedVersion" integer NOT NULL, "sessionRevision" integer NOT NULL, "sourceVersions" jsonb NOT NULL, "contextHash" varchar(64), "sourceMap" jsonb NOT NULL DEFAULT '{}', result jsonb, message varchar(1000) NOT NULL, "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "fuzl_chat_threads_groupId_idx" ON fuzl.fuzl_chat_threads("groupId");
CREATE INDEX "fuzl_chat_members_threadId_idx" ON fuzl.fuzl_chat_members("threadId");
CREATE INDEX "fuzl_chat_invites_threadId_idx" ON fuzl.fuzl_chat_invites("threadId");
CREATE INDEX "fuzl_chat_requests_threadId_idx" ON fuzl.fuzl_chat_requests("threadId");
CREATE INDEX "fuzl_chat_messages_threadId_changeVersion_idx" ON fuzl.fuzl_chat_messages("threadId","changeVersion");

-- Chat is available only through authenticated, membership-checked backend routes.
ALTER TABLE fuzl.fuzl_chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuzl.fuzl_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuzl.fuzl_chat_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuzl.fuzl_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuzl.fuzl_chat_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fuzl.fuzl_chat_threads, fuzl.fuzl_chat_members, fuzl.fuzl_chat_invites, fuzl.fuzl_chat_messages, fuzl.fuzl_chat_requests FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON fuzl.fuzl_chat_threads, fuzl.fuzl_chat_members, fuzl.fuzl_chat_invites, fuzl.fuzl_chat_messages, fuzl.fuzl_chat_requests FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON fuzl.fuzl_chat_threads, fuzl.fuzl_chat_members, fuzl.fuzl_chat_invites, fuzl.fuzl_chat_messages, fuzl.fuzl_chat_requests FROM authenticated;
  END IF;
END $$;
