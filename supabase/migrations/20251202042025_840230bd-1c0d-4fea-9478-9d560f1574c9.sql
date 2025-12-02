-- Add category and bouquet fields to streams table
ALTER TABLE public.streams 
ADD COLUMN category text,
ADD COLUMN bouquet text,
ADD COLUMN channel_number integer;

-- Create index for better performance when sorting
CREATE INDEX idx_streams_category ON public.streams(category);
CREATE INDEX idx_streams_bouquet ON public.streams(bouquet);
CREATE INDEX idx_streams_channel_number ON public.streams(channel_number);