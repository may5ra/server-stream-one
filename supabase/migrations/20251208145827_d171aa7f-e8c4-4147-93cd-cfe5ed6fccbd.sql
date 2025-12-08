-- Add proxy_mode column to streams table
ALTER TABLE public.streams 
ADD COLUMN proxy_mode TEXT DEFAULT 'direct';

-- Add comment for clarity
COMMENT ON COLUMN public.streams.proxy_mode IS 'Proxy mode: direct (passthrough), hls (HLS proxy), ffmpeg (FFmpeg re-stream)';