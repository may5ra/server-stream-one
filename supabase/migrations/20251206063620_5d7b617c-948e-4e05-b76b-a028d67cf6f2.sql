
-- VOD Categories
CREATE TABLE public.vod_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- VOD Content (Movies)
CREATE TABLE public.vod_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.vod_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  stream_url TEXT NOT NULL,
  cover_url TEXT,
  plot TEXT,
  cast_names TEXT,
  director TEXT,
  genre TEXT,
  release_date TEXT,
  duration INTEGER,
  rating DECIMAL(3,1),
  tmdb_id INTEGER,
  container_extension TEXT DEFAULT 'mp4',
  status TEXT DEFAULT 'active',
  added TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Series Categories
CREATE TABLE public.series_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Series
CREATE TABLE public.series (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.series_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  cover_url TEXT,
  plot TEXT,
  cast_names TEXT,
  director TEXT,
  genre TEXT,
  release_date TEXT,
  rating DECIMAL(3,1),
  tmdb_id INTEGER,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Series Episodes
CREATE TABLE public.series_episodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL DEFAULT 1,
  episode_number INTEGER NOT NULL,
  title TEXT,
  plot TEXT,
  duration INTEGER,
  stream_url TEXT NOT NULL,
  cover_url TEXT,
  container_extension TEXT DEFAULT 'mp4',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Live Categories (za bolje organiziranje)
CREATE TABLE public.live_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- EPG Channels
CREATE TABLE public.epg_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
  epg_channel_id TEXT NOT NULL,
  name TEXT NOT NULL,
  icon_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- EPG Programs
CREATE TABLE public.epg_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.epg_channels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- EPG Sources
CREATE TABLE public.epg_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  last_import TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Resellers
CREATE TABLE public.resellers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  credits INTEGER DEFAULT 0,
  max_connections INTEGER DEFAULT 100,
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Reseller credits history
CREATE TABLE public.reseller_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Link streaming_users to resellers
ALTER TABLE public.streaming_users ADD COLUMN IF NOT EXISTS reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL;

-- Add epg_channel_id to streams for EPG linking
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS epg_channel_id TEXT;
ALTER TABLE public.streams ADD COLUMN IF NOT EXISTS stream_icon TEXT;

-- Enable RLS on all tables
ALTER TABLE public.vod_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vod_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epg_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epg_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epg_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_credits ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admin access for all tables
CREATE POLICY "Admin full access vod_categories" ON public.vod_categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access vod_content" ON public.vod_content FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access series_categories" ON public.series_categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access series" ON public.series FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access series_episodes" ON public.series_episodes FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access live_categories" ON public.live_categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access epg_channels" ON public.epg_channels FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access epg_programs" ON public.epg_programs FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access epg_sources" ON public.epg_sources FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access resellers" ON public.resellers FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin full access reseller_credits" ON public.reseller_credits FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Index for EPG queries
CREATE INDEX idx_epg_programs_time ON public.epg_programs(channel_id, start_time, end_time);
CREATE INDEX idx_epg_programs_channel ON public.epg_programs(channel_id);
