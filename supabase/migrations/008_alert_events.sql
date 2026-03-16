-- SignalDesk AI – Alert Events
-- Audit log: one row per alert fired during lead discovery.
-- Records which lead triggered it, which channels were used,
-- and a score snapshot so the alert is self-contained.
--
-- NOTE: The existing `alerts` table stores per-project alert
-- *preferences* (threshold, delivery channels, active flag).
-- This table stores *instances* — each time an alert was fired.

CREATE TABLE IF NOT EXISTS public.alert_events (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id      UUID        NOT NULL REFERENCES public.workspaces(id)  ON DELETE CASCADE,
  lead_id           UUID        NOT NULL REFERENCES public.leads(id)        ON DELETE CASCADE,
  project_id        UUID        NOT NULL REFERENCES public.projects(id)     ON DELETE CASCADE,
  alert_type        TEXT        NOT NULL DEFAULT 'high_intent'
                                CHECK (alert_type IN ('high_intent', 'competitor_mention', 'daily_digest')),
  delivery_channels TEXT[]      NOT NULL DEFAULT '{}',
  score_snapshot    JSONB       NOT NULL DEFAULT '{}',
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_events_workspace_id ON public.alert_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_lead_id      ON public.alert_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_sent_at      ON public.alert_events(sent_at DESC);

ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;

-- Workspace members can view alert events for their workspace
CREATE POLICY "Workspace members can view alert events" ON public.alert_events
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- Service role (background jobs) can insert and manage all alert events
CREATE POLICY "Service role can manage alert events" ON public.alert_events
  USING (true)
  WITH CHECK (true);
