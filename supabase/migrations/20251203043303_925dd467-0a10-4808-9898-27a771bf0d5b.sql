-- Create streaming_users table for IPTV users
CREATE TABLE public.streaming_users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  status text NOT NULL DEFAULT 'offline',
  connections integer DEFAULT 0,
  max_connections integer DEFAULT 1,
  expiry_date date NOT NULL,
  last_active timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.streaming_users ENABLE ROW LEVEL SECURITY;

-- Only admins can manage streaming users
CREATE POLICY "Admins can manage streaming users"
ON public.streaming_users
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_streaming_users_updated_at
BEFORE UPDATE ON public.streaming_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();