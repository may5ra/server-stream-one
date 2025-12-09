-- Dodaj SSH kredencijale na load_balancers tablicu
ALTER TABLE public.load_balancers 
ADD COLUMN IF NOT EXISTS ssh_username text DEFAULT 'root',
ADD COLUMN IF NOT EXISTS ssh_password text,
ADD COLUMN IF NOT EXISTS nginx_port integer DEFAULT 8080,
ADD COLUMN IF NOT EXISTS last_deploy timestamp with time zone;