-- SignalDesk AI - New Feature Tables
-- lead_statuses, search_queries, usage_tracking, digests

-- ============================================================
-- LEAD STATUSES
-- Per-workspace status tracking for leads
-- (separates lead status from the lead itself, enabling multi-workspace)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'saved', 'opened', 'replied', 'contacted', 'dismissed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_statuses_lead_id ON public.lead_statuses(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_statuses_workspace_id ON public.lead_statuses(workspace_id);
CREATE INDEX IF NOT EXISTS idx_lead_statuses_status ON public.lead_statuses(status);

ALTER TABLE public.lead_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage lead statuses in their workspace" ON public.lead_statuses
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE TRIGGER trigger_lead_statuses_updated_at BEFORE UPDATE ON public.lead_statuses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEARCH QUERIES
-- AI-generated search queries per project for lead discovery
-- ============================================================
CREATE TABLE IF NOT EXISTS public.search_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  query_type TEXT,
  source TEXT NOT NULL DEFAULT 'reddit' CHECK (source IN ('reddit', 'twitter', 'hackernews', 'linkedin')),
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, query_text, source)
);

CREATE INDEX IF NOT EXISTS idx_search_queries_project_id ON public.search_queries(project_id);
CREATE INDEX IF NOT EXISTS idx_search_queries_is_active ON public.search_queries(is_active);

ALTER TABLE public.search_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access search queries for their projects" ON public.search_queries
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

-- ============================================================
-- USAGE TRACKING
-- Daily usage counters per workspace (for plan enforcement)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period DATE NOT NULL,
  leads_discovered INTEGER DEFAULT 0,
  replies_generated INTEGER DEFAULT 0,
  analyses_run INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, period)
);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_workspace_period ON public.usage_tracking(workspace_id, period);

ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their workspace usage" ON public.usage_tracking
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- Service role inserts/updates for usage tracking (bypasses RLS)
CREATE POLICY "Service role can manage usage tracking" ON public.usage_tracking
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER trigger_usage_tracking_updated_at BEFORE UPDATE ON public.usage_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- DIGESTS
-- Records of daily digest emails sent per workspace
-- ============================================================
CREATE TABLE IF NOT EXISTS public.digests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period DATE NOT NULL,
  leads_count INTEGER DEFAULT 0,
  high_intent_count INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_digests_workspace_id ON public.digests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_digests_period ON public.digests(workspace_id, period);

ALTER TABLE public.digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their workspace digests" ON public.digests
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage digests" ON public.digests
  USING (true)
  WITH CHECK (true);
