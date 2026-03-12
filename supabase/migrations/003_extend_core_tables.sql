-- SignalDesk AI - Extend Core Tables
-- Adds workspace_id and new columns required by the application routes

-- ============================================================
-- PROJECTS — add workspace_id and created_by
-- ============================================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON public.projects(workspace_id);

-- Update RLS: projects are now queried by workspace_id
DROP POLICY IF EXISTS "Users can CRUD own projects" ON public.projects;

CREATE POLICY "Users can view workspace projects" ON public.projects
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can insert workspace projects" ON public.projects
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can update workspace projects" ON public.projects
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can delete workspace projects" ON public.projects
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR user_id = auth.uid()
  );

-- ============================================================
-- WEBSITE PROFILES — add summary and raw_crawl_data
-- ============================================================
ALTER TABLE public.website_profiles
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS raw_crawl_data JSONB;

-- ============================================================
-- LEADS — add is_answered flag
-- ============================================================
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_answered BOOLEAN DEFAULT false;

-- ============================================================
-- LEAD SCORES — add extended scoring columns
-- ============================================================
ALTER TABLE public.lead_scores
  ADD COLUMN IF NOT EXISTS freshness_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS community_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS competitor_bonus INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unanswered_bonus INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scoring_version TEXT DEFAULT 'v1';

CREATE INDEX IF NOT EXISTS idx_lead_scores_final ON public.lead_scores(final_score DESC);

-- ============================================================
-- LEAD ACTIONS — add workspace_id and metadata
-- ============================================================
ALTER TABLE public.lead_actions
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- ============================================================
-- NOTIFICATIONS — add workspace_id
-- (workspace-level notifications: digests, payment failures, etc.)
-- ============================================================
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_workspace_id ON public.notifications(workspace_id, read);
