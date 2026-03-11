// ============================================================
// SignalDesk AI — Intent Detection & Scoring Engine v2
// ============================================================

export interface IntentSignals {
  buying_signals: string[];
  pain_signals: string[];
  urgency_signals: string[];
  competitor_signals: string[];
  matched_keywords: string[];
}

export interface IntentScore {
  intent_score: number;
  pain_score: number;
  urgency_score: number;
  relevance_score: number;
  freshness_score: number;
  community_score: number;
  competitor_bonus: number;
  unanswered_bonus: number;
  final_score: number;
  signals: IntentSignals;
  match_reasons: string[];
}

const BUYING_PHRASES = [
  'looking for', 'need a tool', 'any recommendations', 'best software for',
  'alternatives to', 'alternative to', 'recommend', 'suggestions for',
  'what do you use for', 'which tool', 'anyone using', 'tried any',
  'switching from', 'migrating from', 'looking to switch', 'evaluating',
  'comparing', "what's the best", 'anyone know a good', 'help me find',
  'need something that', 'what software', 'what app', 'what platform',
  'what service', 'any good tools', 'help me choose', 'considering',
  'thinking about trying', 'how do you handle', 'how does everyone',
];

const PAIN_PHRASES = [
  'frustrated with', 'problem with', 'hate using', 'sick of', 'tired of',
  'issue with', 'annoyed', "doesn't work", 'broken', 'failing',
  'terrible', 'worst', 'bad experience', 'disappointing', 'overpriced',
  'too expensive', 'struggling with', 'dealing with', "can't figure out",
  'confused by', 'stuck on', 'keeps breaking', 'not working', 'buggy',
  'unreliable', 'wasting time', 'inefficient', 'nightmar', 'disaster',
  'pain point', 'hate how', 'kills productivity',
];

const URGENCY_PHRASES = [
  'asap', 'today', 'this week', 'urgent', 'immediately', 'right now',
  'quickly', 'time sensitive', 'deadline', 'launching', 'going live',
  'need to decide', 'running out of time', 'by friday', 'by end of week',
  'as soon as possible', 'within the next', 'by tomorrow',
];

const BUDGET_PHRASES = [
  'budget', 'affordable', 'pricing', 'cheap', 'cost', 'price',
  'free tier', 'freemium', 'free plan', 'enterprise pricing',
  'per month', 'per year', 'monthly plan', 'roi', 'value for money',
  'worth it', 'cost effective',
];

const QUESTION_PATTERNS = [
  /\?/,
  /^(has|have|does|do|is|are|can|could|would|should|what|which|how|where|when|who|why)\b/i,
];

const COMMUNITY_SCORES: Record<string, number> = {
  SaaS: 95, saas: 95, entrepreneur: 92, Entrepreneur: 92,
  startups: 88, Startups: 88, sales: 90, marketing: 88,
  growthhacking: 86, smallbusiness: 85, SmallBusiness: 85,
  ecommerce: 82, dropship: 78,
  webdev: 72, sysadmin: 70, devops: 75, software: 68,
  productivity: 73, freelance: 72, remotework: 68,
  learnprogramming: 60, programming: 62,
  technology: 50, AskReddit: 20, funny: 5, memes: 5,
};

function getFreshnessScore(postedAt: string | null): number {
  if (!postedAt) return 30;
  const ageHours = (Date.now() - new Date(postedAt).getTime()) / 3600000;
  if (ageHours < 1)   return 100;
  if (ageHours < 6)   return 90;
  if (ageHours < 24)  return 75;
  if (ageHours < 72)  return 55;
  if (ageHours < 168) return 35;
  return 15;
}

export function scorePost(
  text: string,
  keywords: string[] = [],
  competitors: string[] = [],
  buyerIntentPhrases: string[] = [],
  options: { posted_at?: string | null; subreddit?: string; comment_count?: number } = {}
): IntentScore {
  const norm = text.toLowerCase();

  const signals: IntentSignals = {
    buying_signals: [], pain_signals: [], urgency_signals: [],
    competitor_signals: [], matched_keywords: [],
  };

  for (const p of [...BUYING_PHRASES, ...BUDGET_PHRASES, ...buyerIntentPhrases]) {
    if (norm.includes(p.toLowerCase()) && !signals.buying_signals.includes(p))
      signals.buying_signals.push(p);
  }
  for (const p of PAIN_PHRASES) {
    if (norm.includes(p.toLowerCase()) && !signals.pain_signals.includes(p))
      signals.pain_signals.push(p);
  }
  for (const p of URGENCY_PHRASES) {
    if (norm.includes(p.toLowerCase()) && !signals.urgency_signals.includes(p))
      signals.urgency_signals.push(p);
  }
  for (const c of competitors) {
    if (norm.includes(c.toLowerCase()) && !signals.competitor_signals.includes(c))
      signals.competitor_signals.push(c);
  }
  for (const k of keywords) {
    if (norm.includes(k.toLowerCase()) && !signals.matched_keywords.includes(k))
      signals.matched_keywords.push(k);
  }

  const hasQuestion = QUESTION_PATTERNS.some(p => p.test(text.trim()));
  const questionBoost = hasQuestion && signals.buying_signals.length > 0 ? 15 : 0;
  const wordCount = norm.split(/\s+/).length;
  const lengthBonus = wordCount > 100 ? 10 : wordCount > 50 ? 5 : 0;

  const intent_score    = Math.min(signals.buying_signals.length * 20 + questionBoost, 100);
  const pain_score      = Math.min(signals.pain_signals.length * 20, 100);
  const urgency_score   = Math.min(signals.urgency_signals.length * 25, 100);
  const relevance_score = Math.min(signals.matched_keywords.length * 15 + signals.competitor_signals.length * 10 + lengthBonus, 100);
  const freshness_score = getFreshnessScore(options.posted_at ?? null);
  const community_score = COMMUNITY_SCORES[options.subreddit ?? ''] ?? 50;
  const competitor_bonus  = signals.competitor_signals.length > 0 ? 10 : 0;
  const unanswered_bonus  = options.comment_count === 0 ? 10 : 0;

  const final_score = Math.min(Math.round(
    intent_score    * 0.30 +
    pain_score      * 0.20 +
    urgency_score   * 0.10 +
    relevance_score * 0.15 +
    freshness_score * 0.15 +
    community_score * 0.10 +
    competitor_bonus + unanswered_bonus
  ), 100);

  const match_reasons: string[] = [];
  if (signals.buying_signals.length > 0)     match_reasons.push('Asking for recommendations');
  if (signals.pain_signals.length > 0)       match_reasons.push('Pain point detected');
  if (signals.urgency_signals.length > 0)    match_reasons.push('Urgent need expressed');
  if (signals.competitor_signals.length > 0) match_reasons.push(`Competitor: ${signals.competitor_signals[0]}`);
  if (signals.matched_keywords.length > 0)   match_reasons.push(`${signals.matched_keywords.length} keyword match${signals.matched_keywords.length > 1 ? 'es' : ''}`);
  if (unanswered_bonus > 0)                  match_reasons.push('No replies yet — be first');
  if (freshness_score >= 90)                 match_reasons.push('Posted recently');

  return { intent_score, pain_score, urgency_score, relevance_score,
    freshness_score, community_score, competitor_bonus, unanswered_bonus,
    final_score, signals, match_reasons };
}

export function generateSearchQueries(
  keywords: string[], pain_points: string[], buyer_intent_phrases: string[],
  competitors: string[], category: string
): Array<{ query: string; type: string }> {
  const queries: Array<{ query: string; type: string }> = [];

  for (const kw of keywords.slice(0, 3)) {
    queries.push({ query: `${kw} recommendations`, type: 'keyword' });
    queries.push({ query: `best ${kw} tool`, type: 'buying_intent' });
  }
  for (const pain of pain_points.slice(0, 3)) {
    queries.push({ query: pain, type: 'pain' });
  }
  queries.push({ query: `looking for ${category} software`, type: 'buying_intent' });
  queries.push({ query: `${category} tool recommendations`, type: 'buying_intent' });
  queries.push({ query: `best ${category} alternatives`, type: 'buying_intent' });
  for (const c of competitors.slice(0, 2)) {
    queries.push({ query: `alternative to ${c}`, type: 'competitor' });
    queries.push({ query: `${c} alternatives`, type: 'competitor' });
  }
  for (const phrase of buyer_intent_phrases.slice(0, 2)) {
    queries.push({ query: phrase, type: 'buying_intent' });
  }

  const seen = new Set<string>();
  return queries.filter(q => { if (seen.has(q.query)) return false; seen.add(q.query); return true; });
}
