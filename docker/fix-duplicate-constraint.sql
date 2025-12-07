-- Fix duplicate key constraint on streams table
-- Run this to remove the name unique constraint that causes sync issues

-- Drop the unique constraint on name if it exists
ALTER TABLE streams DROP CONSTRAINT IF EXISTS streams_name_unique;
ALTER TABLE streams DROP CONSTRAINT IF EXISTS streams_name_key;

-- Verify the constraint is removed
SELECT conname FROM pg_constraint WHERE conrelid = 'streams'::regclass AND contype = 'u';

-- Now only id is the primary key, upsert on id will work correctly
