-- Add online_since column to track when stream went live
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS online_since timestamp with time zone DEFAULT NULL;