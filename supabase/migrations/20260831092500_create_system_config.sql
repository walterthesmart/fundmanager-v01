CREATE TABLE public.system_config (
  id text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- For prototype simplicity, allow anon access so server functions without service role can update it locally
-- In a real production app, use the service role key or pass auth tokens to server functions.
GRANT ALL ON public.system_config TO anon;
GRANT ALL ON public.system_config TO authenticated;
GRANT ALL ON public.system_config TO service_role;
