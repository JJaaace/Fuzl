ALTER TABLE fuzl.fuzl_sessions ADD COLUMN "travelReview" JSONB;
ALTER TABLE fuzl.fuzl_outings ADD COLUMN "travelReview" JSONB;
-- Existing RLS and direct-role revocations cover both private columns.
