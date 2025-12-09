-- Create load_balancers table
CREATE TABLE public.load_balancers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE,
  ip_address TEXT NOT NULL,
  port INTEGER DEFAULT 80,
  status TEXT DEFAULT 'active',
  max_streams INTEGER DEFAULT 100,
  current_streams INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS
ALTER TABLE public.load_balancers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage load balancers"
ON public.load_balancers
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add load_balancer_id to streams table
ALTER TABLE public.streams 
ADD COLUMN load_balancer_id UUID REFERENCES public.load_balancers(id) ON DELETE SET NULL;

-- Create system_updates table for tracking available updates
CREATE TABLE public.system_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL,
  changelog TEXT,
  is_available BOOLEAN DEFAULT true,
  released_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  applied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.system_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage system_updates"
ON public.system_updates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_load_balancers_updated_at
BEFORE UPDATE ON public.load_balancers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();