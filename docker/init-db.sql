-- StreamPanel Database Schema
-- PostgreSQL initialization script

-- Create app_role enum
CREATE TYPE app_role AS ENUM ('admin', 'user');

-- Users table (for panel authentication)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role app_role DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Streaming users (IPTV subscribers)
CREATE TABLE IF NOT EXISTS streaming_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    status TEXT DEFAULT 'offline',
    max_connections INTEGER DEFAULT 1,
    connections INTEGER DEFAULT 0,
    expiry_date DATE NOT NULL,
    reseller_id UUID,
    last_active TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Servers
CREATE TABLE IF NOT EXISTS servers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    status TEXT DEFAULT 'offline',
    cpu_usage INTEGER DEFAULT 0,
    memory_usage INTEGER DEFAULT 0,
    disk_usage INTEGER DEFAULT 0,
    network_usage INTEGER DEFAULT 0,
    os TEXT DEFAULT 'Ubuntu 22.04',
    location TEXT,
    uptime TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Live categories
CREATE TABLE IF NOT EXISTS live_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Streams (Live channels)
CREATE TABLE IF NOT EXISTS streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    input_type TEXT DEFAULT 'rtmp',
    input_url TEXT NOT NULL,
    output_formats TEXT[] DEFAULT ARRAY['hls'],
    status TEXT DEFAULT 'inactive',
    viewers INTEGER DEFAULT 0,
    bitrate INTEGER DEFAULT 4500,
    resolution TEXT DEFAULT '1920x1080',
    category TEXT,
    bouquet TEXT,
    channel_number INTEGER,
    stream_icon TEXT,
    epg_channel_id TEXT,
    webvtt_enabled BOOLEAN DEFAULT FALSE,
    webvtt_url TEXT,
    webvtt_language TEXT DEFAULT 'hr',
    webvtt_label TEXT,
    dvr_enabled BOOLEAN DEFAULT FALSE,
    dvr_duration INTEGER DEFAULT 24,
    abr_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- VOD Categories
CREATE TABLE IF NOT EXISTS vod_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VOD Content
CREATE TABLE IF NOT EXISTS vod_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    stream_url TEXT NOT NULL,
    category_id UUID REFERENCES vod_categories(id),
    cover_url TEXT,
    plot TEXT,
    cast_names TEXT,
    director TEXT,
    genre TEXT,
    rating NUMERIC,
    release_date TEXT,
    duration INTEGER,
    tmdb_id INTEGER,
    container_extension TEXT DEFAULT 'mp4',
    status TEXT DEFAULT 'active',
    added TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Series Categories
CREATE TABLE IF NOT EXISTS series_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Series
CREATE TABLE IF NOT EXISTS series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category_id UUID REFERENCES series_categories(id),
    cover_url TEXT,
    plot TEXT,
    cast_names TEXT,
    director TEXT,
    genre TEXT,
    rating NUMERIC,
    release_date TEXT,
    tmdb_id INTEGER,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Series Episodes
CREATE TABLE IF NOT EXISTS series_episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    season_number INTEGER DEFAULT 1,
    episode_number INTEGER NOT NULL,
    title TEXT,
    stream_url TEXT NOT NULL,
    cover_url TEXT,
    plot TEXT,
    duration INTEGER,
    container_extension TEXT DEFAULT 'mp4',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- EPG Sources
CREATE TABLE IF NOT EXISTS epg_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    last_import TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- EPG Channels
CREATE TABLE IF NOT EXISTS epg_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    epg_channel_id TEXT NOT NULL,
    name TEXT NOT NULL,
    icon_url TEXT,
    stream_id UUID REFERENCES streams(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- EPG Programs
CREATE TABLE IF NOT EXISTS epg_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES epg_channels(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resellers
CREATE TABLE IF NOT EXISTS resellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    credits INTEGER DEFAULT 0,
    max_connections INTEGER DEFAULT 100,
    status TEXT DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reseller Credits
CREATE TABLE IF NOT EXISTS reseller_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reseller_id UUID NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Panel Settings
CREATE TABLE IF NOT EXISTS panel_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action TEXT NOT NULL,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_streams_category ON streams(category);
CREATE INDEX idx_streams_status ON streams(status);
CREATE INDEX idx_streaming_users_username ON streaming_users(username);
CREATE INDEX idx_vod_content_category ON vod_content(category_id);
CREATE INDEX idx_series_category ON series(category_id);
CREATE INDEX idx_epg_programs_channel ON epg_programs(channel_id);
CREATE INDEX idx_epg_programs_time ON epg_programs(start_time, end_time);

-- Create default admin user (password: admin123)
INSERT INTO users (email, password_hash, role) VALUES 
('admin@streampanel.local', '$2b$10$rQZ5QVJ.X3Q3z5Q3z5Q3zOeX3Q3z5Q3z5Q3z5Q3z5Q3z5Q3z5Q3z5', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Insert default settings
INSERT INTO panel_settings (key, value) VALUES
('server_name', 'StreamPanel'),
('server_domain', 'localhost'),
('rtmp_port', '1935'),
('http_port', '80'),
('https_port', '443')
ON CONFLICT (key) DO NOTHING;
