CREATE TABLE public.conversation_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  chatera_conversation_id text,
  from_status text,
  to_status text,
  source text NOT NULL DEFAULT 'system',
  actor text,
  assignee_chatera_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.conversation_status_events TO authenticated;
GRANT ALL ON public.conversation_status_events TO service_role;

ALTER TABLE public.conversation_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read status events"
ON public.conversation_status_events
FOR SELECT TO authenticated
USING (true);

CREATE INDEX conversation_status_events_created_at_idx
  ON public.conversation_status_events (created_at DESC);
CREATE INDEX conversation_status_events_conversation_idx
  ON public.conversation_status_events (conversation_id);