-- Create settings table for persistent configuration
CREATE TABLE public.panel_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.panel_settings ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read settings
CREATE POLICY "Authenticated users can read settings"
ON public.panel_settings
FOR SELECT
TO authenticated
USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can modify settings"
ON public.panel_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create activity logs table
CREATE TABLE public.activity_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view activity logs
CREATE POLICY "Admins can view activity logs"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert activity logs
CREATE POLICY "Admins can insert activity logs"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create streams table for Nimble Streamer
CREATE TABLE public.streams (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    input_type TEXT NOT NULL DEFAULT 'rtmp',
    input_url TEXT NOT NULL,
    output_formats TEXT[] DEFAULT ARRAY['hls'],
    status TEXT NOT NULL DEFAULT 'inactive',
    viewers INTEGER DEFAULT 0,
    bitrate INTEGER DEFAULT 4500,
    resolution TEXT DEFAULT '1920x1080',
    webvtt_enabled BOOLEAN DEFAULT false,
    webvtt_url TEXT,
    webvtt_language TEXT DEFAULT 'hr',
    webvtt_label TEXT,
    dvr_enabled BOOLEAN DEFAULT false,
    dvr_duration INTEGER DEFAULT 24,
    abr_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;

-- Admins can manage streams
CREATE POLICY "Admins can manage streams"
ON public.streams
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create servers table
CREATE TABLE public.servers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'offline',
    cpu_usage INTEGER DEFAULT 0,
    memory_usage INTEGER DEFAULT 0,
    disk_usage INTEGER DEFAULT 0,
    network_usage INTEGER DEFAULT 0,
    uptime TEXT,
    os TEXT DEFAULT 'Ubuntu 22.04',
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;

-- Admins can manage servers
CREATE POLICY "Admins can manage servers"
ON public.servers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply triggers
CREATE TRIGGER update_panel_settings_updated_at
BEFORE UPDATE ON public.panel_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_streams_updated_at
BEFORE UPDATE ON public.streams
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_servers_updated_at
BEFORE UPDATE ON public.servers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();