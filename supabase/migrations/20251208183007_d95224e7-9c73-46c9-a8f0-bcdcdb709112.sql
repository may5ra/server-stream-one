-- Add bouquets column to streaming_users (array of bouquet names)
ALTER TABLE public.streaming_users 
ADD COLUMN IF NOT EXISTS bouquets text[] DEFAULT ARRAY[]::text[];

-- Add comment for documentation
COMMENT ON COLUMN public.streaming_users.bouquets IS 'Array of bouquet names this user has access to. Empty means access to all content.';