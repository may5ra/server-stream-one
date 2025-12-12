-- Migration script to add Load Balancer support to existing Docker database
-- Run this on existing installations: docker exec -i streampanel-db psql -U postgres -d streampanel < fix-lb-schema.sql

-- Create load_balancers table if not exists
CREATE TABLE IF NOT EXISTS load_balancers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    port INTEGER DEFAULT 80,
    nginx_port INTEGER DEFAULT 8080,
    status TEXT DEFAULT 'active',
    max_streams INTEGER DEFAULT 100,
    current_streams INTEGER DEFAULT 0,
    ssh_username TEXT,
    ssh_password TEXT,
    last_deploy TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add load_balancer_id to streams if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'streams' AND column_name = 'load_balancer_id') THEN
        ALTER TABLE streams ADD COLUMN load_balancer_id UUID REFERENCES load_balancers(id);
    END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_streams_load_balancer ON streams(load_balancer_id);
