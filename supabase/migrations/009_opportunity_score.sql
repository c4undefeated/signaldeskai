-- SignalDesk AI – Opportunity Score
-- Adds opportunity_score to lead_scores.
-- This metric combines intent, freshness, unanswered window, community
-- quality, and engagement velocity to estimate how valuable it is to
-- engage with a lead right now. Range: 0–100.
-- Labels: >= 70 = High, >= 40 = Medium, < 40 = Low.

ALTER TABLE public.lead_scores
  ADD COLUMN IF NOT EXISTS opportunity_score INTEGER DEFAULT 0
    CHECK (opportunity_score BETWEEN 0 AND 100);

CREATE INDEX IF NOT EXISTS idx_lead_scores_opportunity
  ON public.lead_scores(opportunity_score DESC);
