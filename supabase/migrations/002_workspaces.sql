-- SignalDesk AI - Workspaces & Team Members
-- Adds multi-workspace support with role-based membership

-- ============================================================
-- WORKSPACES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  digest_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WORKSPACE MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON public.workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_workspaces_stripe_customer ON public.workspaces(stripe_customer_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Workspaces: members can view their workspace
CREATE POLICY "Members can view their workspace" ON public.workspaces
  FOR SELECT USING (
    id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- Workspaces: owners and admins can update
CREATE POLICY "Owners and admins can update workspace" ON public.workspaces
  FOR UPDATE USING (
    id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Workspaces: anyone can insert (creation handled via API)
CREATE POLICY "Users can create workspaces" ON public.workspaces
  FOR INSERT WITH CHECK (true);

-- Workspace members: users can view their own memberships
CREATE POLICY "Users can view own memberships" ON public.workspace_members
  FOR SELECT USING (user_id = auth.uid());

-- Workspace members: workspace owners/admins can view all members
CREATE POLICY "Workspace owners can view all members" ON public.workspace_members
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Workspace members: insert allowed for service role and workspace creation
CREATE POLICY "Allow membership insertion" ON public.workspace_members
  FOR INSERT WITH CHECK (true);

-- Workspace members: users can remove themselves
CREATE POLICY "Users can remove own membership" ON public.workspace_members
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE TRIGGER trigger_workspaces_updated_at BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
