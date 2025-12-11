-- Create function to update load balancer stream count
CREATE OR REPLACE FUNCTION public.update_load_balancer_stream_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update old load balancer count if stream was moved
  IF TG_OP = 'UPDATE' AND OLD.load_balancer_id IS DISTINCT FROM NEW.load_balancer_id THEN
    IF OLD.load_balancer_id IS NOT NULL THEN
      UPDATE load_balancers 
      SET current_streams = (
        SELECT COUNT(*) FROM streams WHERE load_balancer_id = OLD.load_balancer_id
      )
      WHERE id = OLD.load_balancer_id;
    END IF;
  END IF;

  -- Update new load balancer count
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.load_balancer_id IS NOT NULL THEN
      UPDATE load_balancers 
      SET current_streams = (
        SELECT COUNT(*) FROM streams WHERE load_balancer_id = NEW.load_balancer_id
      )
      WHERE id = NEW.load_balancer_id;
    END IF;
    RETURN NEW;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    IF OLD.load_balancer_id IS NOT NULL THEN
      UPDATE load_balancers 
      SET current_streams = (
        SELECT COUNT(*) FROM streams WHERE load_balancer_id = OLD.load_balancer_id
      )
      WHERE id = OLD.load_balancer_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- Create trigger for stream changes
DROP TRIGGER IF EXISTS update_lb_stream_count_trigger ON streams;
CREATE TRIGGER update_lb_stream_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON streams
FOR EACH ROW
EXECUTE FUNCTION public.update_load_balancer_stream_count();

-- Initialize current counts for existing load balancers
UPDATE load_balancers lb
SET current_streams = (
  SELECT COUNT(*) FROM streams s WHERE s.load_balancer_id = lb.id
);