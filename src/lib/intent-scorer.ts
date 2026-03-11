// ============================================================
// SignalDesk AI - Intent Detection & Scoring Engine
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
  signals: IntentSignals;
  match_reasons: string[];
}

// Buying intent phrases (high weight)
const BUYING_PHRASES = [
  'looking for', 'need a tool', 'any recommendations', 'best software for',
  'alternatives to', 'recommend', 'suggestions for', 'what do you use for',
  'which tool', 'anyone using', 'tried any', 'switching from', 'migrating from',
  'looking to switch', 'evaluating', 'comparing', 'what\'s the best', 'anyone know',
  'does anyone use', 'help me find', 'need something', 'what software',
  'what app', 'what platform', 'what service', 'any good tools',
  'help me choose', 'decision', 'considering', 'thinking about trying',
  'how do you handle', 'how does everyone', 'how are you',
];

// Pain signals (high weight)
const PAIN_PHRASES = [
  'frustrated with', 'problem with', 'hate using', 'sick of', 'tired of',
  'issue with', 'annoyed', 'doesn\'t work', 'broken', 'fail', 'failing',
  'terrible', 'worst', 'bad experience', 'disappointing', 'overpriced',
  'too expensive', 'can\'t afford', 'struggling with', 'dealing with',
  'can\'t figure out', 'confused by', 'stuck on', 'keeps breaking',
  'not working', 'sucks', 'disaster', 'nightmare', 'pain in the',
  'wasting time', 'inefficient', 'slow', 'buggy', 'unreliable',
];

// Urgency signals (medium weight)
const URGENCY_PHRASES = [
  'asap', 'today', 'this week', 'urgent', 'immediately', 'right now',
  'quickly', 'fast', 'time sensitive', 'deadline', 'launching',
  'going live', 'need to decide', 'running out of time', 'by tomorrow',
  'by friday', 'by end of week', 'as soon as possible',
];

// Budget signals (medium weight)
const BUDGET_PHRASES = [
  'budget', 'affordable', 'pricing', 'cheap', 'cost', 'price',
  'free tier', 'freemium', 'free plan', 'expensive', 'enterprise pricing',
  'per month', 'per year', 'monthly plan', 'annual plan', 'cost effective',
  'roi', 'value for money', 'worth it',
];

// Question indicators (adds intent signal)
const QUESTION_PATTERNS = [
  /\?/,
  /^(has|have|does|do|is|are|can|could|would|should|what|which|how|where|when|who|why)/i,
];

export function scorePost(
  text: string,
  keywords: string[] = [],
  competitors: string[] = [],
  buyerIntentPhrases: string[] = []
): IntentScore {
  const normalizedText = text.toLowerCase();
  const words = normalizedText.split(/\s+/);

  const signals: IntentSignals = {
    buying_signals: [],
    pain_signals: [],
    urgency_signals: [],
    competitor_signals: [],
    matched_keywords: [],
  };

  const match_reasons: string[] = [];

  // Check buying phrases
  for (const phrase of [...BUYING_PHRASES, ...buyerIntentPhrases]) {
    if (normalizedText.includes(phrase.toLowerCase())) {
      if (!signals.buying_signals.includes(phrase)) {
        signals.buying_signals.push(phrase);
      }
    }
  }

  // Check pain phrases
  for (const phrase of PAIN_PHRASES) {
    if (normalizedText.includes(phrase.toLowerCase())) {
      if (!signals.pain_signals.includes(phrase)) {
        signals.pain_signals.push(phrase);
      }
    }
  }

  // Check urgency phrases
  for (const phrase of URGENCY_PHRASES) {
    if (normalizedText.includes(phrase.toLowerCase())) {
      if (!signals.urgency_signals.includes(phrase)) {
        signals.urgency_signals.push(phrase);
      }
    }
  }

  // Check budget phrases (add to buying signals)
  for (const phrase of BUDGET_PHRASES) {
    if (normalizedText.includes(phrase.toLowerCase())) {
      if (!signals.buying_signals.includes(phrase)) {
        signals.buying_signals.push(phrase);
      }
    }
  }

  // Check competitor mentions
  for (const competitor of competitors) {
    const compLower = competitor.toLowerCase();
    if (normalizedText.includes(compLower)) {
      if (!signals.competitor_signals.includes(competitor)) {
        signals.competitor_signals.push(competitor);
      }
    }
  }

  // Check product keywords
  for (const keyword of keywords) {
    const kwLower = keyword.toLowerCase();
    if (normalizedText.includes(kwLower)) {
      if (!signals.matched_keywords.includes(keyword)) {
        signals.matched_keywords.push(keyword);
      }
    }
  }

  // ============================================================
  // SCORING ALGORITHM
  // ============================================================

  // Base scores
  let buyingScore = Math.min(signals.buying_signals.length * 20, 100);
  let painScore = Math.min(signals.pain_signals.length * 20, 100);
  let urgencyScore = Math.min(signals.urgency_signals.length * 25, 100);

  // Competitor mentions boost buying intent significantly
  const competitorBoost = signals.competitor_signals.length * 15;

  // Keywords boost relevance
  const keywordScore = Math.min(signals.matched_keywords.length * 20, 80);

  // Question detection
  const hasQuestion = QUESTION_PATTERNS.some(pattern => pattern.test(text.trim()));
  if (hasQuestion && signals.buying_signals.length > 0) {
    buyingScore = Math.min(buyingScore + 15, 100);
  }

  // Post length bonus (more detailed = higher intent)
  const wordCount = words.length;
  const lengthBonus = wordCount > 100 ? 10 : wordCount > 50 ? 5 : 0;

  // Calculate relevance score (how well it matches keywords/category)
  const relevanceScore = Math.min(keywordScore + competitorBoost + lengthBonus, 100);

  // Calculate composite intent score
  const intentScore = Math.min(
    Math.round(
      (buyingScore * 0.40) +
      (painScore * 0.25) +
      (urgencyScore * 0.15) +
      (relevanceScore * 0.20)
    ),
    100
  );

  // Build match reasons
  if (signals.buying_signals.length > 0) {
    match_reasons.push('Asking for recommendations');
  }
  if (signals.pain_signals.length > 0) {
    match_reasons.push('Pain point detected');
  }
  if (signals.urgency_signals.length > 0) {
    match_reasons.push('Urgent need expressed');
  }
  if (signals.competitor_signals.length > 0) {
    match_reasons.push(`Competitor mentioned: ${signals.competitor_signals[0]}`);
  }
  if (signals.matched_keywords.length > 0) {
    match_reasons.push(`Matched ${signals.matched_keywords.length} keywords`);
  }
  if (hasQuestion) {
    match_reasons.push('Question format detected');
  }

  return {
    intent_score: intentScore,
    pain_score: Math.min(painScore, 100),
    urgency_score: Math.min(urgencyScore, 100),
    relevance_score: Math.min(relevanceScore, 100),
    signals,
    match_reasons,
  };
}

export function generateSearchQueries(
  keywords: string[],
  pain_points: string[],
  buyer_intent_phrases: string[],
  competitors: string[],
  category: string
): Array<{ query: string; type: string; subreddits?: string[] }> {
  const queries: Array<{ query: string; type: string; subreddits?: string[] }> = [];

  // Keyword queries
  for (const keyword of keywords.slice(0, 3)) {
    queries.push({
      query: `${keyword} recommendations`,
      type: 'keyword',
    });
    queries.push({
      query: `best ${keyword} tool`,
      type: 'buying_intent',
    });
  }

  // Pain point queries
  for (const pain of pain_points.slice(0, 3)) {
    queries.push({
      query: pain,
      type: 'pain',
    });
  }

  // Buyer intent queries with category
  queries.push({
    query: `looking for ${category} software`,
    type: 'buying_intent',
  });
  queries.push({
    query: `${category} tool recommendations`,
    type: 'buying_intent',
  });
  queries.push({
    query: `best ${category} alternatives`,
    type: 'buying_intent',
  });

  // Competitor queries
  for (const competitor of competitors.slice(0, 2)) {
    queries.push({
      query: `alternative to ${competitor}`,
      type: 'competitor',
    });
    queries.push({
      query: `${competitor} alternatives`,
      type: 'competitor',
    });
  }

  // Custom buyer intent phrases
  for (const phrase of buyer_intent_phrases.slice(0, 2)) {
    queries.push({
      query: phrase,
      type: 'buying_intent',
    });
  }

  // Deduplicate
  const seen = new Set<string>();
  return queries.filter(q => {
    if (seen.has(q.query)) return false;
    seen.add(q.query);
    return true;
  });
}
