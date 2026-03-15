// ============================================================
// SignalDesk AI — Feed Diversity Algorithm
// ============================================================
// Prevents the lead feed from being dominated by one subreddit,
// one query type, or one intent class.
//
// Stage 3 in the pipeline (runs after AI reranking):
//   1. Classify each candidate into a primary intent class
//   2. Fill reserved slots per class (soft minimums)
//   3. Fill remaining slots with best unselected (subreddit cap only)
// ============================================================

export type IntentClass =
  | 'competitor'       // mentions a competitor product
  | 'switching'        // actively switching / evaluating alternatives
  | 'fresh_unanswered' // recent post with no replies yet
  | 'pain'             // expresses frustration / pain with current solution
  | 'high_intent'      // strong buying signal, intent_score >= 65
  | 'medium_intent';   // relevant but lower-confidence signal

// Phrases that indicate switching / evaluation behaviour.
// These appear verbatim inside the buying_signals array (from intent-scorer).
const SWITCHING_PHRASES = [
  'switching from',
  'migrating from',
  'alternative to',
  'alternatives to',
  'looking to switch',
  'replace',
  'moved from',
  'leaving',
];

// Minimum shape expected from a scored lead.
interface ScoredLead {
  subreddit: string | null;
  score: {
    intent_score: number;
    final_score: number;
    freshness_score: number;
    unanswered_bonus: number;
    pain_signals: string[];
    buying_signals: string[];
    competitor_mentions: string[];
  };
}

// ── Classification ────────────────────────────────────────────────────────────

export function classifyLead(lead: ScoredLead): IntentClass {
  const s = lead.score;

  const hasSwitching = s.buying_signals.some((sig) =>
    SWITCHING_PHRASES.some((phrase) => sig.toLowerCase().includes(phrase))
  );

  // Priority order: most specific / highest-value class first
  if (s.competitor_mentions.length > 0 && s.final_score >= 40) return 'competitor';
  if (hasSwitching)                                              return 'switching';
  if (s.unanswered_bonus > 0 && s.freshness_score >= 75)        return 'fresh_unanswered';
  if (s.pain_signals.length >= 2)                               return 'pain';
  if (s.intent_score >= 65)                                      return 'high_intent';
  return 'medium_intent';
}

// ── Slot budgets ──────────────────────────────────────────────────────────────
// Soft minimums per class for a 20-lead feed.
// Pass 1 tries to fill these; Pass 2 fills the rest with top-score candidates.

const CLASS_BUDGETS: Record<IntentClass, number> = {
  high_intent:      6,
  pain:             4,
  competitor:       3,
  switching:        2,
  fresh_unanswered: 2,
  medium_intent:    3,
};

// Order in which classes are filled during Pass 1
const CLASS_PRIORITY: IntentClass[] = [
  'high_intent',
  'competitor',
  'switching',
  'pain',
  'fresh_unanswered',
  'medium_intent',
];

const SUBREDDIT_CAP = 3;

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Apply diversity constraints to a score-sorted candidate list.
 *
 * @param candidates  Leads pre-sorted by final_score descending (Stage 1/2 output).
 * @param maxCount    Maximum leads to return (default 20).
 * @returns           Diverse subset, still roughly sorted by quality.
 */
export function diversifyLeads<T extends ScoredLead>(
  candidates: T[],
  maxCount = 20,
): T[] {
  if (candidates.length === 0) return [];

  // Index map for O(1) de-duplication
  const originalIndex = new Map<T, number>(candidates.map((l, i) => [l, i]));
  const usedIndices = new Set<number>();
  const subredditCounts: Record<string, number> = {};
  const selected: T[] = [];

  const canAdd = (lead: T): boolean => {
    const sub = lead.subreddit ?? '__none__';
    return (subredditCounts[sub] ?? 0) < SUBREDDIT_CAP;
  };

  const pick = (lead: T) => {
    const sub = lead.subreddit ?? '__none__';
    subredditCounts[sub] = (subredditCounts[sub] ?? 0) + 1;
    usedIndices.add(originalIndex.get(lead)!);
    selected.push(lead);
  };

  // Classify all candidates upfront (each into exactly one class)
  const buckets = new Map<IntentClass, T[]>();
  for (const cls of CLASS_PRIORITY) buckets.set(cls, []);
  for (const lead of candidates) {
    buckets.get(classifyLead(lead))!.push(lead);
  }

  // Pass 1 — fill reserved slots per class (respects subreddit cap)
  for (const cls of CLASS_PRIORITY) {
    const budget = CLASS_BUDGETS[cls];
    let filled = 0;
    for (const lead of buckets.get(cls)!) {
      if (filled >= budget || selected.length >= maxCount) break;
      if (usedIndices.has(originalIndex.get(lead)!)) continue;
      if (!canAdd(lead)) continue;
      pick(lead);
      filled++;
    }
  }

  // Pass 2 — fill remaining slots with best unselected (subreddit cap only)
  for (const lead of candidates) {
    if (selected.length >= maxCount) break;
    if (usedIndices.has(originalIndex.get(lead)!)) continue;
    if (!canAdd(lead)) continue;
    pick(lead);
  }

  return selected;
}
