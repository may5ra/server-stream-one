-- Create geo_blocked_countries table for geo-blocking
CREATE TABLE public.geo_blocked_countries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code TEXT NOT NULL UNIQUE,
  country_name TEXT NOT NULL,
  blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  blocked_by UUID,
  reason TEXT
);

-- Enable RLS
ALTER TABLE public.geo_blocked_countries ENABLE ROW LEVEL SECURITY;

-- Admin only access
CREATE POLICY "Admins can manage geo blocked countries" 
ON public.geo_blocked_countries 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));