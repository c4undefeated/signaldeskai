// ============================================================
// SignalDesk AI – Intent Clustering Engine
//
// Groups leads into semantic "buying conversation" clusters.
// All functions are pure (no I/O) so they can be called from
// both API routes and tests without side effects.
// ============================================================

// ── Types ─────────────────────────────────────────────────────────────────────

export type IntentClusterType =
  | 'recommendations'   // "what tool do you use for X?"
  | 'competitor_switch' // "alternatives to / switching from Y"
  | 'budget_concerns'   // pricing complaints, cost objections
  | 'urgent_help'       // asap / deadline / broken / critical
  | 'feature_comparison'; // feature gaps, "does X support Y?", vs posts

/** Input shape – maps to a lead + its score signals */
export interface LeadSignalInput {
  id: string;
  title: string | null;
  body: string | null;
  subreddit: string | null;
  buying_signals: string[];
  pain_signals: string[];
  urgency_signals: string[];
  competitor_mentions: string[];
  intent_score: number;
}

/** Output shape – persisted to lead_clusters table */
export interface IntentCluster {
  project_id: string;
  intent_type: IntentClusterType;
  cluster_name: string;
  cluster_summary: string;
  lead_ids: string[];
  signal_count: number;
  avg_intent_score: number;
  top_competitors: string[];
  top_pain_phrases: string[];
  top_subreddits: string[];
}

// ── Cluster metadata ───────────────────────────────────────────────────────────

export const CLUSTER_META: Record<IntentClusterType, { name: string; description: string }> = {
  recommendations:    { name: 'Looking for Recommendations',  description: 'Users actively asking for tool suggestions' },
  competitor_switch:  { name: 'Switching from Competitor',    description: 'Users exploring alternatives to incumbents' },
  budget_concerns:    { name: 'Budget & Pricing Concerns',    description: 'Price sensitivity and cost objections' },
  urgent_help:        { name: 'Urgent Help Needed',           description: 'Time-sensitive requests or critical failures' },
  feature_comparison: { name: 'Feature Comparisons',          description: 'Evaluating feature gaps or integration needs' },
};

// ── Seed patterns ──────────────────────────────────────────────────────────────
// Matched against signal arrays (substrings) and free text (substrings / simple regex).

const SEEDS = {
  rec_buying:    ['looking for', 'recommend', 'suggest', 'what do you use', 'best tool', 'help me find', 'tool for', 'looking to try', 'searching for'],
  rec_text:      ['looking for', 'recommend', 'which tool', 'any recommendations', 'suggest me', 'what.*use.*for', 'best.*for', 'need.*tool'],

  switch_buying: ['switch', 'alternativ', 'replac', 'moving from', 'migrat', 'leaving', 'instead of', 'better than'],
  switch_text:   ['switching from', 'alternatives to', 'alternative to', 'moving away', 'replacing', 'migrate from', ' vs ', 'instead of'],

  budget_buying: ['pric', 'expensiv', 'cheap', 'cost', 'budget', 'afford', 'free tier', 'per seat', 'per user', 'per month', 'subscription'],
  budget_text:   ['too expensive', 'pricing', 'price increase', 'cost per', 'per seat', 'per user', 'monthly fee', 'cheaper', 'affordable', 'budget'],

  urgent_text:   ['asap', 'urgent', 'critical', 'deadline', 'today', 'help me', 'broken', 'not working', 'emergency', 'need now', 'immediately', 'right now'],

  feature_buying: ['compar', ' vs ', 'differ', 'integrat', 'feature', 'missing', 'support', 'connect', 'api', 'webhook', 'plugin', 'native'],
  feature_text:   [' vs ', 'compare', 'difference between', 'does.*support', 'missing feature', 'native integration', 'lack', 'comparison', 'integrate with'],
};

// ── Matching helpers ───────────────────────────────────────────────────────────

function signalMatch(signals: string[], seeds: string[]): boolean {
  return signals.some((s) =>
    seeds.some((seed) => s.toLowerCase().includes(seed.toLowerCase()))
  );
}

function textMatch(text: string, seeds: string[]): boolean {
  const lower = text.toLowerCase();
  return seeds.some((seed) => {
    if (seed.includes('.*')) {
      try { return new RegExp(seed, 'i').test(lower); } catch { return false; }
    }
    return lower.includes(seed);
  });
}

// ── Classifier ────────────────────────────────────────────────────────────────
// Returns ALL cluster types a lead matches (one lead can appear in multiple clusters).

export function classifyLead(lead: LeadSignalInput): IntentClusterType[] {
  const text = `${lead.title ?? ''} ${lead.body ?? ''}`;
  const result: IntentClusterType[] = [];

  // urgent_help — urgency signals take top priority
  if (lead.urgency_signals.length > 0 || textMatch(text, SEEDS.urgent_text)) {
    result.push('urgent_help');
  }

  // competitor_switch — any competitor mention counts, or explicit switching language
  if (
    lead.competitor_mentions.length > 0 ||
    signalMatch(lead.buying_signals, SEEDS.switch_buying) ||
    textMatch(text, SEEDS.switch_text)
  ) {
    result.push('competitor_switch');
  }

  // budget_concerns — pricing in buying or pain signals, or text
  if (
    signalMatch(lead.buying_signals, SEEDS.budget_buying) ||
    signalMatch(lead.pain_signals, SEEDS.budget_buying) ||
    textMatch(text, SEEDS.budget_text)
  ) {
    result.push('budget_concerns');
  }

  // recommendations — explicit recommendation-seeking
  if (
    signalMatch(lead.buying_signals, SEEDS.rec_buying) ||
    textMatch(text, SEEDS.rec_text)
  ) {
    result.push('recommendations');
  }

  // feature_comparison — feature/integration evaluation language
  if (
    signalMatch(lead.buying_signals, SEEDS.feature_buying) ||
    textMatch(text, SEEDS.feature_text)
  ) {
    result.push('feature_comparison');
  }

  return result;
}

// ── Summary generator ──────────────────────────────────────────────────────────
// Produces human-readable sentences like:
//   "12 users exploring alternatives to Salesforce"
//   "7 urgent requests needing immediate help: 'site is down'"
//   "9 posts mention pricing or budget concerns in r/SaaS and r/startups"

function topN<T extends string>(arr: T[], n = 2): T[] {
  const freq = new Map<T, number>();
  for (const v of arr) {
    const key = v.trim() as T;
    if (key) freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([v]) => v);
}

function n(count: number, sing: string, plur?: string): string {
  return `${count} ${count === 1 ? sing : (plur ?? sing + 's')}`;
}

export function generateClusterSummary(
  type: IntentClusterType,
  leads: LeadSignalInput[],
): string {
  const count = leads.length;
  const competitors = topN(leads.flatMap((l) => l.competitor_mentions));
  const pains       = topN(leads.flatMap((l) => l.pain_signals));
  const subreddits  = topN(leads.filter((l) => l.subreddit).map((l) => l.subreddit!));

  switch (type) {
    case 'recommendations':
      return `${n(count, 'person is', 'people are')} asking for tool recommendations`;

    case 'competitor_switch': {
      const compStr = competitors.length
        ? ` to ${competitors.slice(0, 2).join(' or ')}`
        : '';
      return `${n(count, 'user is', 'users are')} exploring alternatives${compStr}`;
    }

    case 'budget_concerns': {
      const srStr = subreddits.length
        ? ` in ${subreddits.map((s) => `r/${s}`).join(' and ')}`
        : '';
      return `${n(count, 'post mentions', 'posts mention')} pricing or budget concerns${srStr}`;
    }

    case 'urgent_help': {
      const painStr = pains.length ? `: "${pains[0]}"` : '';
      return `${n(count, 'urgent request', 'urgent requests')} needing immediate help${painStr}`;
    }

    case 'feature_comparison':
      return `${n(count, 'user is', 'users are')} comparing features or looking for specific integrations`;

    default:
      return `${n(count, 'signal')} detected`;
  }
}

// ── Cluster builder ────────────────────────────────────────────────────────────
// Buckets leads by intent type, generates summaries, and returns the cluster list.
// Clusters with ≥ 1 lead are included; sorted by signal_count desc.

export function buildLeadClusters(
  projectId: string,
  leads: LeadSignalInput[],
): IntentCluster[] {
  // Bucket leads per cluster type (one lead can appear in multiple buckets)
  const buckets = new Map<IntentClusterType, LeadSignalInput[]>();

  for (const lead of leads) {
    for (const type of classifyLead(lead)) {
      const bucket = buckets.get(type) ?? [];
      bucket.push(lead);
      buckets.set(type, bucket);
    }
  }

  const clusters: IntentCluster[] = [];

  for (const [type, clusterLeads] of buckets.entries()) {
    if (clusterLeads.length === 0) continue;

    const avgIntent = Math.round(
      clusterLeads.reduce((s, l) => s + l.intent_score, 0) / clusterLeads.length,
    );

    clusters.push({
      project_id:       projectId,
      intent_type:      type,
      cluster_name:     CLUSTER_META[type].name,
      cluster_summary:  generateClusterSummary(type, clusterLeads),
      lead_ids:         [...new Set(clusterLeads.map((l) => l.id))],
      signal_count:     clusterLeads.length,
      avg_intent_score: avgIntent,
      top_competitors:  topN(clusterLeads.flatMap((l) => l.competitor_mentions)),
      top_pain_phrases: topN(clusterLeads.flatMap((l) => l.pain_signals)),
      top_subreddits:   topN(clusterLeads.filter((l) => l.subreddit).map((l) => l.subreddit!)),
    });
  }

  return clusters.sort((a, b) => b.signal_count - a.signal_count);
}
