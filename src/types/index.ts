// ============================================================
// SignalDesk AI - Core Type Definitions
// ============================================================

export type LeadStatus = 'new' | 'saved' | 'opened' | 'replied' | 'contacted' | 'closed' | 'dismissed';

// ── CRM types ─────────────────────────────────────────────────────────────────

export interface CRMHistoryEntry {
  id: string;
  action: string;
  notes: string | null;
  created_at: string;
}
export type LeadSource = 'reddit' | 'twitter' | 'hackernews';
export type SpamRisk = 'LOW' | 'MEDIUM' | 'HIGH';
export type PromotionLevel = 'NONE' | 'SUBTLE' | 'MODERATE' | 'HIGH';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  onboarded: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  website_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebsiteProfile {
  id: string;
  project_id: string;
  product_name: string | null;
  category: string | null;
  target_customer: string | null;
  pain_points: string[];
  features: string[];
  keywords: string[];
  buyer_intent_phrases: string[];
  competitors: string[];
  industry: string | null;
  pricing_signals: string | null;
  raw_analysis: Record<string, unknown> | null;
  crawled_pages: CrawledPage[];
  analyzed_at: string;
  created_at: string;
}

export interface CrawledPage {
  url: string;
  title: string;
  content_preview: string;
}

export interface Lead {
  id: string;
  project_id: string;
  source: LeadSource;
  external_id: string;
  url: string;
  title: string | null;
  body: string | null;
  author: string | null;
  subreddit: string | null;
  upvotes: number;
  comment_count: number;
  posted_at: string | null;
  fetched_at: string;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
  // Joined fields
  score?: LeadScore;
  reply_suggestions?: ReplySuggestion[];
}

export interface LeadScore {
  id: string;
  lead_id: string;
  intent_score: number;
  pain_score: number;
  urgency_score: number;
  relevance_score: number;
  buying_signals: string[];
  pain_signals: string[];
  urgency_signals: string[];
  competitor_mentions: string[];
  matched_keywords: string[];
  match_reasons: string[];
  scored_at: string;
}

export interface LeadAction {
  id: string;
  lead_id: string;
  user_id: string;
  action: 'viewed' | 'saved' | 'opened' | 'dismissed' | 'contacted' | 'replied';
  notes: string | null;
  created_at: string;
}

export interface ReplySuggestion {
  id: string;
  lead_id: string;
  project_id: string;
  reply_text: string;
  dm_text: string | null;
  reply_type: 'comment' | 'dm';
  spam_risk: SpamRisk;
  natural_tone_score: number;
  promotion_level: PromotionLevel;
  confidence_score: number;
  generated_at: string;
  used_at: string | null;
}

export interface Alert {
  id: string;
  user_id: string;
  project_id: string;
  alert_type: 'daily_digest' | 'high_intent' | 'competitor_mention';
  is_active: boolean;
  delivery: string[];
  threshold: number;
  config: Record<string, unknown>;
  created_at: string;
}

/** One fired alert instance — written by the background job to alert_events. */
export interface AlertEvent {
  id: string;
  workspace_id: string;
  lead_id: string;
  project_id: string;
  alert_type: 'high_intent' | 'competitor_mention' | 'daily_digest';
  delivery_channels: string[];
  score_snapshot: {
    intent_score: number;
    freshness_score: number;
    final_score: number;
  };
  sent_at: string;
}

export interface Notification {
  id: string;
  user_id: string | null;
  workspace_id?: string | null;
  title: string;
  message: string;
  type: 'info' | 'lead' | 'alert' | 'system' | 'digest';
  read: boolean;
  data: Record<string, unknown>;
  created_at: string;
}

// ============================================================
// API Request/Response Types
// ============================================================

export interface AnalyzeWebsiteRequest {
  url: string;
  project_id?: string;
}

export interface AnalyzeWebsiteResponse {
  success: boolean;
  profile: WebsiteProfile;
  queries: SearchQuery[];
}

export interface SearchQuery {
  query: string;
  type: 'keyword' | 'pain' | 'buying_intent' | 'competitor';
  subreddits?: string[];
}

export interface FetchLeadsRequest {
  project_id: string;
  sources?: LeadSource[];
  limit?: number;
  force_refresh?: boolean;
}

export interface FetchLeadsResponse {
  success: boolean;
  leads: Lead[];
  total: number;
  fetched_at: string;
}

export interface GenerateReplyRequest {
  lead_id: string;
  project_id: string;
  context?: string;
}

export interface GenerateReplyResponse {
  success: boolean;
  reply: ReplySuggestion;
}

// ============================================================
// UI State Types
// ============================================================

export interface LeadFilters {
  source?: LeadSource | 'all';
  status?: LeadStatus | 'all';
  min_intent_score?: number;
  search?: string;
  subreddit?: string;
}

export interface OnboardingState {
  step: 1 | 2 | 3 | 4 | 5;
  website_url: string;
  project_name: string;
  profile: WebsiteProfile | null;
  queries: SearchQuery[];
  is_analyzing: boolean;
  is_fetching: boolean;
  error: string | null;
}
