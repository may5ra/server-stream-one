-- Enable realtime for streaming_users and streams tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.streaming_users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.streams;