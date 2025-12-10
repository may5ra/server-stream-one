-- Add MAC address column to streaming_users table
ALTER TABLE public.streaming_users 
ADD COLUMN IF NOT EXISTS mac_address TEXT UNIQUE;

-- Create index for faster MAC lookups
CREATE INDEX IF NOT EXISTS idx_streaming_users_mac ON public.streaming_users(mac_address);

-- Add comment for documentation
COMMENT ON COLUMN public.streaming_users.mac_address IS 'MAC address for MAG/STB device authentication';