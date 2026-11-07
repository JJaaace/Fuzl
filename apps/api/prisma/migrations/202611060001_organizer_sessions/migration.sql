-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "fuzl";

-- CreateTable
CREATE TABLE "fuzl"."fuzl_organizers" (
    "id" UUID NOT NULL,
    "authSubject" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuzl_organizers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuzl"."fuzl_groups" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fuzl_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuzl"."fuzl_aliases" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fuzl_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuzl"."fuzl_sessions" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "summaryVersion" INTEGER NOT NULL DEFAULT 1,
    "summary" JSONB NOT NULL,
    "provenance" JSONB NOT NULL,
    "origin" VARCHAR(10) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fuzl_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fuzl_organizers_authSubject_key" ON "fuzl"."fuzl_organizers"("authSubject");

-- CreateIndex
CREATE INDEX "fuzl_groups_ownerId_idx" ON "fuzl"."fuzl_groups"("ownerId");

-- CreateIndex
CREATE INDEX "fuzl_aliases_groupId_idx" ON "fuzl"."fuzl_aliases"("groupId");

-- CreateIndex
CREATE INDEX "fuzl_sessions_groupId_idx" ON "fuzl"."fuzl_sessions"("groupId");

-- AddForeignKey
ALTER TABLE "fuzl"."fuzl_groups" ADD CONSTRAINT "fuzl_groups_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "fuzl"."fuzl_organizers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuzl"."fuzl_aliases" ADD CONSTRAINT "fuzl_aliases_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "fuzl"."fuzl_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuzl"."fuzl_sessions" ADD CONSTRAINT "fuzl_sessions_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "fuzl"."fuzl_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The browser uses Supabase Auth only. Keep Prisma-managed app tables closed
-- to the public Data API; server-side ownership checks are always required.
DO $$
DECLARE table_name text; role_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['fuzl_organizers','fuzl_groups','fuzl_aliases','fuzl_sessions','_prisma_migrations'] LOOP
    EXECUTE format('ALTER TABLE fuzl.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE fuzl.%I FROM PUBLIC', table_name);
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
        EXECUTE format('REVOKE ALL ON TABLE fuzl.%I FROM %I', table_name, role_name);
      END IF;
    END LOOP;
  END LOOP;
END $$;

REVOKE ALL ON SCHEMA fuzl FROM PUBLIC;
