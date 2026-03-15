// ============================================================
// SignalDesk AI — Behavioral Scoring Layer
// ============================================================
// Adjusts lead scores based on what this workspace has historically
// saved, contacted, replied to, or dismissed.
//
// Pipeline position: Stage 3 — runs after AI reranking, before
// diversity enforcement.
//
// How it works
// ─────────────
// 1. buildBehaviorProfile() queries the last 90 days of lead_statuses
//    and the corresponding lead_scores / leads rows.
//    For each feature (subreddit, signal_type, keyword) it records
//    how often it appeared in positively-actioned leads vs dismissed.
//
// 2. applyBehaviorBoost() computes a per-lead score adjustment using
//    rate-difference scoring:
//
//      featureBoost = (pos/totalPos - neg/totalNeg) × weight
//
//    A feature has zero effect when it appears equally in positive
//    and negative leads — bias only accumulates with clear patterns.
//    The total adjustment is clamped to [-25, +20].
//
// 3. Silence = neutrality. If a workspace has fewer than MIN_SAMPLES
//    actions, behavioral scoring is skipped entirely.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeatureCounts {
  pos: number; // appearances in saved / contacted / replied leads
  neg: number; // appearances in dismissed leads
}

export interface BehaviorProfile {
  subreddits:   Record<string, FeatureCounts>;
  signalTypes:  Record<string, FeatureCounts>; // 'buying' | 'pain' | 'competitor' | 'urgency'
  keywords:     Record<string, FeatureCounts>;
  totalPositive: number; // total leads with positive action
  totalNegative: number; // total dismissed leads
}

// Minimum actioned leads before behavioral scoring activates
const MIN_SAMPLES = 5;

// Score adjustment weights (max contribution per feature type)
const WEIGHT = {
  subreddit:  8,
  signalType: 5,
  keyword:    3,
} as const;

// Hard clamps on the final adjustment
const MAX_BOOST   =  20;
const MAX_PENALTY = -25;

// Actions that indicate positive engagement
const POSITIVE_STATUSES = new Set(['saved', 'contacted', 'replied']);
// Actions that indicate rejection
const NEGATIVE_STATUSES = new Set(['dismissed']);

// ── Profile builder ───────────────────────────────────────────────────────────

/**
 * Reads recent behavioral signals from the DB and returns a BehaviorProfile.
 * Returns an empty profile on any error — behavioral scoring degrades gracefully.
 */
export async function buildBehaviorProfile(
  workspaceId: string,
  supabase: SupabaseClient,
): Promise<BehaviorProfile> {
  const profile: BehaviorProfile = {
    subreddits:    {},
    signalTypes:   {},
    keywords:      {},
    totalPositive: 0,
    totalNegative: 0,
  };

  try {
    // ── 1. Fetch actioned leads from the last 90 days ─────────
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: statuses } = await supabase
      .from('lead_statuses')
      .select('lead_id, status')
      .eq('workspace_id', workspaceId)
      .in('status', ['saved', 'contacted', 'replied', 'dismissed'])
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(200);

    if (!statuses?.length) return profile;

    // Collapse to a sentiment map (contacted trumps saved — both are positive)
    const sentimentMap = new Map<string, 'pos' | 'neg'>();
    for (const { lead_id, status } of statuses) {
      if (POSITIVE_STATUSES.has(status)) sentimentMap.set(lead_id, 'pos');
      else if (NEGATIVE_STATUSES.has(status) && !sentimentMap.has(lead_id)) {
        sentimentMap.set(lead_id, 'neg');
      }
    }

    const leadIds = [...sentimentMap.keys()];
    if (!leadIds.length) return profile;

    // Count totals upfront — used for rate normalisation
    for (const sentiment of sentimentMap.values()) {
      if (sentiment === 'pos') profile.totalPositive++;
      else profile.totalNegative++;
    }

    if (profile.totalPositive + profile.totalNegative < MIN_SAMPLES) return profile;

    // ── 2. Fetch subreddits ────────────────────────────────────
    const { data: leadsData } = await supabase
      .from('leads')
      .select('id, subreddit')
      .in('id', leadIds);

    // ── 3. Fetch signal data ───────────────────────────────────
    const { data: scoresData } = await supabase
      .from('lead_scores')
      .select('lead_id, buying_signals, pain_signals, urgency_signals, competitor_mentions, matched_keywords')
      .in('lead_id', leadIds);

    const scoreMap = new Map<string, {
      buying_signals: string[];
      pain_signals: string[];
      urgency_signals: string[];
      competitor_mentions: string[];
      matched_keywords: string[];
    }>();
    for (const s of scoresData ?? []) scoreMap.set(s.lead_id, s);

    // ── 4. Accumulate counts ───────────────────────────────────
    const inc = (
      obj: Record<string, FeatureCounts>,
      key: string,
      sentiment: 'pos' | 'neg',
    ) => {
      if (!key) return;
      obj[key] ??= { pos: 0, neg: 0 };
      obj[key][sentiment]++;
    };

    for (const lead of leadsData ?? []) {
      const sentiment = sentimentMap.get(lead.id);
      if (!sentiment) continue;

      // Subreddit
      if (lead.subreddit) inc(profile.subreddits, lead.subreddit, sentiment);

      // Signal types
      const score = scoreMap.get(lead.id);
      if (score) {
        if ((score.buying_signals    ?? []).length > 0) inc(profile.signalTypes, 'buying',     sentiment);
        if ((score.pain_signals      ?? []).length > 0) inc(profile.signalTypes, 'pain',       sentiment);
        if ((score.competitor_mentions ?? []).length > 0) inc(profile.signalTypes, 'competitor', sentiment);
        if ((score.urgency_signals   ?? []).length > 0) inc(profile.signalTypes, 'urgency',    sentiment);

        // Keywords
        for (const kw of (score.matched_keywords ?? [])) {
          inc(profile.keywords, kw, sentiment);
        }
      }
    }
  } catch (err) {
    console.warn('buildBehaviorProfile failed, skipping behavioral scoring:', err);
  }

  return profile;
}

// ── Score adjuster ────────────────────────────────────────────────────────────

interface LeadScore {
  final_score: number;
  buying_signals: string[];
  pain_signals: string[];
  urgency_signals: string[];
  competitor_mentions: string[];
  matched_keywords: string[];
}

interface BehaviorScoredLead {
  subreddit: string | null;
  score: LeadScore;
}

/**
 * Returns the rate-difference boost for a single feature:
 *   (positiveAppearanceRate - negativeAppearanceRate) × weight
 *
 * Positive when this feature correlates more with saves/contacts.
 * Negative when it correlates more with dismissals.
 * Zero when absent from the profile or rates are equal.
 */
function featureBoost(
  counts: FeatureCounts | undefined,
  totalPos: number,
  totalNeg: number,
  weight: number,
): number {
  if (!counts || (totalPos === 0 && totalNeg === 0)) return 0;
  const posRate = totalPos > 0 ? counts.pos / totalPos : 0;
  const negRate = totalNeg > 0 ? counts.neg / totalNeg : 0;
  return (posRate - negRate) * weight;
}

/**
 * Adjusts a lead's final_score based on its workspace's behavior profile.
 * Returns the lead unchanged if there is insufficient data (< MIN_SAMPLES).
 */
export function applyBehaviorBoost<T extends BehaviorScoredLead>(
  lead: T,
  profile: BehaviorProfile,
): T {
  const { totalPositive: totalPos, totalNegative: totalNeg } = profile;
  if (totalPos + totalNeg < MIN_SAMPLES) return lead;

  let adjustment = 0;

  // Subreddit affinity
  adjustment += featureBoost(
    profile.subreddits[lead.subreddit ?? ''],
    totalPos, totalNeg,
    WEIGHT.subreddit,
  );

  // Signal type affinity
  const { buying_signals, pain_signals, urgency_signals, competitor_mentions } = lead.score;
  if (buying_signals.length > 0)
    adjustment += featureBoost(profile.signalTypes['buying'],     totalPos, totalNeg, WEIGHT.signalType);
  if (pain_signals.length > 0)
    adjustment += featureBoost(profile.signalTypes['pain'],       totalPos, totalNeg, WEIGHT.signalType);
  if (competitor_mentions.length > 0)
    adjustment += featureBoost(profile.signalTypes['competitor'], totalPos, totalNeg, WEIGHT.signalType);
  if (urgency_signals.length > 0)
    adjustment += featureBoost(profile.signalTypes['urgency'],    totalPos, totalNeg, WEIGHT.signalType);

  // Keyword affinity
  for (const kw of lead.score.matched_keywords) {
    adjustment += featureBoost(profile.keywords[kw], totalPos, totalNeg, WEIGHT.keyword);
  }

  // Clamp and apply
  const clamped  = Math.max(MAX_PENALTY, Math.min(MAX_BOOST, adjustment));
  const newScore = Math.round(Math.max(0, Math.min(100, lead.score.final_score + clamped)));

  if (newScore === lead.score.final_score) return lead;
  return { ...lead, score: { ...lead.score, final_score: newScore } };
}
