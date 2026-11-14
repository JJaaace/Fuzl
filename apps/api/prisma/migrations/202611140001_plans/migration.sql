CREATE TABLE fuzl.fuzl_shared_plans (
 id uuid PRIMARY KEY, "sessionId" uuid NOT NULL UNIQUE REFERENCES fuzl.fuzl_sessions(id) ON DELETE CASCADE,
 draft jsonb NOT NULL, status varchar(12) NOT NULL DEFAULT 'proposed', revision integer NOT NULL DEFAULT 1,
 "publishedVersion" integer NOT NULL DEFAULT 0, "materialVersion" integer NOT NULL DEFAULT 0,
 "rsvpsClosed" boolean NOT NULL DEFAULT false, "lastRequestId" uuid NOT NULL, "lastRequestHash" varchar(64) NOT NULL,
 "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" timestamp(3) NOT NULL,
 CHECK (status IN ('proposed','confirmed','completed','cancelled'))
);
CREATE TABLE fuzl.fuzl_plan_versions (
 id uuid PRIMARY KEY, "planId" uuid NOT NULL REFERENCES fuzl.fuzl_shared_plans(id) ON DELETE CASCADE,
 version integer NOT NULL, "materialVersion" integer NOT NULL, snapshot jsonb NOT NULL,
 status varchar(12) NOT NULL, "changeNotice" varchar(500) NOT NULL, "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("planId",version)
);
CREATE TABLE fuzl.fuzl_plan_links (
 id uuid PRIMARY KEY, "planId" uuid NOT NULL REFERENCES fuzl.fuzl_shared_plans(id) ON DELETE CASCADE,
 "activePlanId" uuid UNIQUE CHECK ("activePlanId" IS NULL OR "activePlanId" = "planId"),
 "tokenDigest" varchar(64) UNIQUE NOT NULL, "expiresAt" timestamp(3) NOT NULL, "revokedAt" timestamp(3),
 "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX fuzl_plan_links_plan_idx ON fuzl.fuzl_plan_links("planId");
CREATE TABLE fuzl.fuzl_plan_rsvps (
 id uuid PRIMARY KEY, "planId" uuid NOT NULL REFERENCES fuzl.fuzl_shared_plans(id) ON DELETE CASCADE,
 "submissionId" uuid NOT NULL, "editDigest" varchar(64) UNIQUE NOT NULL, alias varchar(80) NOT NULL,
 choice varchar(8) NOT NULL CHECK (choice IN ('going','maybe','cant')), "answeredMaterialVersion" integer NOT NULL,
 revision integer NOT NULL DEFAULT 1, "lastRequestId" uuid, "updatedAt" timestamp(3) NOT NULL,
 UNIQUE ("planId","submissionId")
);
CREATE INDEX fuzl_plan_rsvps_plan_idx ON fuzl.fuzl_plan_rsvps("planId");
DO $$ DECLARE table_name text; role_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['fuzl_shared_plans','fuzl_plan_versions','fuzl_plan_links','fuzl_plan_rsvps'] LOOP
  EXECUTE format('ALTER TABLE fuzl.%I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('REVOKE ALL ON TABLE fuzl.%I FROM PUBLIC', table_name);
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON TABLE fuzl.%I FROM %I',table_name,role_name); END IF;
  END LOOP;
 END LOOP;
END $$;
