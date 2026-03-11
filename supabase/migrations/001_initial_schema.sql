-- SignalDesk AI - Initial Database Schema

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  onboarded BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROJECTS (one user can have multiple projects)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WEBSITE PROFILES (AI-extracted business intelligence)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.website_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  product_name TEXT,
  category TEXT,
  target_customer TEXT,
  pain_points TEXT[] DEFAULT '{}',
  features TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  buyer_intent_phrases TEXT[] DEFAULT '{}',
  competitors TEXT[] DEFAULT '{}',
  industry TEXT,
  pricing_signals TEXT,
  raw_analysis JSONB,
  crawled_pages JSONB DEFAULT '[]',
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEAD SOURCES (reddit, twitter, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('reddit', 'twitter', 'hackernews', 'linkedin')),
  is_active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}',
  last_fetched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEADS (discovered posts/tweets)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('reddit', 'twitter', 'hackernews')),
  external_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  body TEXT,
  author TEXT,
  subreddit TEXT,
  upvotes INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  posted_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'saved', 'opened', 'replied', 'contacted', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, source, external_id)
);

-- ============================================================
-- LEAD SCORES (intent scoring breakdown)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  intent_score INTEGER DEFAULT 0 CHECK (intent_score BETWEEN 0 AND 100),
  pain_score INTEGER DEFAULT 0 CHECK (pain_score BETWEEN 0 AND 100),
  urgency_score INTEGER DEFAULT 0 CHECK (urgency_score BETWEEN 0 AND 100),
  relevance_score INTEGER DEFAULT 0 CHECK (relevance_score BETWEEN 0 AND 100),
  buying_signals TEXT[] DEFAULT '{}',
  pain_signals TEXT[] DEFAULT '{}',
  urgency_signals TEXT[] DEFAULT '{}',
  competitor_mentions TEXT[] DEFAULT '{}',
  matched_keywords TEXT[] DEFAULT '{}',
  match_reasons TEXT[] DEFAULT '{}',
  scored_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id)
);

-- ============================================================
-- LEAD ACTIONS (user actions on leads)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('viewed', 'saved', 'opened', 'dismissed', 'contacted', 'replied')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REPLY SUGGESTIONS (AI-generated replies)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reply_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  reply_text TEXT NOT NULL,
  dm_text TEXT,
  reply_type TEXT DEFAULT 'comment' CHECK (reply_type IN ('comment', 'dm')),
  spam_risk TEXT DEFAULT 'LOW' CHECK (spam_risk IN ('LOW', 'MEDIUM', 'HIGH')),
  natural_tone_score INTEGER DEFAULT 80,
  promotion_level TEXT DEFAULT 'SUBTLE' CHECK (promotion_level IN ('NONE', 'SUBTLE', 'MODERATE', 'HIGH')),
  confidence_score INTEGER DEFAULT 85,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

-- ============================================================
-- ALERTS (notification preferences)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('daily_digest', 'high_intent', 'competitor_mention')),
  is_active BOOLEAN DEFAULT true,
  delivery TEXT[] DEFAULT ARRAY['in_app'],
  threshold INTEGER DEFAULT 70,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS (in-app notification log)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'lead', 'alert', 'system')),
  read BOOLEAN DEFAULT false,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_leads_project_id ON public.leads(project_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON public.leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_posted_at ON public.leads(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_scores_intent ON public.lead_scores(intent_score DESC);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id, read);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reply_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only see/edit their own
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Projects
CREATE POLICY "Users can CRUD own projects" ON public.projects
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Website profiles (through project ownership)
CREATE POLICY "Users can access own website profiles" ON public.website_profiles
  USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

-- Leads
CREATE POLICY "Users can access own leads" ON public.leads
  USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

-- Lead scores
CREATE POLICY "Users can access own lead scores" ON public.lead_scores
  USING (lead_id IN (SELECT id FROM public.leads WHERE project_id IN (
    SELECT id FROM public.projects WHERE user_id = auth.uid()
  )));

-- Lead actions
CREATE POLICY "Users can manage own lead actions" ON public.lead_actions
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Reply suggestions
CREATE POLICY "Users can access own reply suggestions" ON public.reply_suggestions
  USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

-- Alerts
CREATE POLICY "Users can manage own alerts" ON public.alerts
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Notifications
CREATE POLICY "Users can manage own notifications" ON public.notifications
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
