ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS agent_user_id uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS agent_name text;

GRANT UPDATE ON public.conversations TO authenticated;

CREATE POLICY "Authenticated update conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);