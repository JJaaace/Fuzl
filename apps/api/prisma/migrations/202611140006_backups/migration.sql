ALTER TABLE fuzl.fuzl_shared_plans ADD COLUMN backup JSONB;
-- Organizer-only backup; existing table RLS/direct-role revocations remain in force.
