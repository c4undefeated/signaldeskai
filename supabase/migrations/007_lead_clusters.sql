-- SignalDesk AI – Intent Clusters
-- Groups leads by buying-intent pattern for signal intelligence.
-- Each row represents ONE cluster type per project (unique on project_id, intent_type).

CREATE TABLE IF NOT EXISTS public.lead_clusters (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id     UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  intent_type    TEXT        NOT NULL CHECK (intent_type IN (
                               'recommendations',
                               'competitor_switch',
                               'budget_concerns',
                               'urgent_help',
                               'feature_comparison'
                             )),
  cluster_name    TEXT        NOT NULL,
  cluster_summary TEXT        NOT NULL,
  lead_ids        UUID[]      NOT NULL DEFAULT '{}',
  signal_count    INTEGER     NOT NULL DEFAULT 0,
  avg_intent_score INTEGER    NOT NULL DEFAULT 0,
  top_competitors  TEXT[]     NOT NULL DEFAULT '{}',
  top_pain_phrases TEXT[]     NOT NULL DEFAULT '{}',
  top_subreddits   TEXT[]     NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, intent_type)
);

CREATE INDEX IF NOT EXISTS idx_lead_clusters_project_id
  ON public.lead_clusters(project_id);

ALTER TABLE public.lead_clusters ENABLE ROW LEVEL SECURITY;

-- Users can manage clusters that belong to their projects
CREATE POLICY "Users can manage clusters for their projects"
  ON public.lead_clusters
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE wm.user_id = auth.uid()
      UNION
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
      WHERE wm.user_id = auth.uid()
      UNION
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

CREATE TRIGGER trigger_lead_clusters_updated_at
  BEFORE UPDATE ON public.lead_clusters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
