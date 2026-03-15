import { NextRequest, NextResponse } from 'next/server';
import { createServerClientInstance } from '@/lib/supabase.server';

// ── Opportunity cluster theme definitions ─────────────────────────────────────
// Each keyword is assigned to the first theme whose seed list matches.
// Seed strings are matched as substrings of the lowercased keyword.
const CLUSTER_THEMES: { name: string; seeds: string[] }[] = [
  {
    name: 'Migration & Switching',
    seeds: ['switch', 'alternativ', 'migrat', 'replac', 'moving from', 'leaving', 'churn'],
  },
  {
    name: 'Pricing Pressure',
    seeds: ['pric', 'expensiv', 'cheap', 'cost', 'budget', 'afford', 'free tier', 'per month', 'per year'],
  },
  {
    name: 'Feature & Integration',
    seeds: ['feature', 'integrat', 'api', 'plugin', 'connect', 'missing', 'support', 'webhook', 'zapier'],
  },
  {
    name: 'Team & Workflow',
    seeds: ['team', 'workflow', 'collaborat', 'manag', 'process', 'org', 'departmen', 'role', 'permiss'],
  },
  {
    name: 'Technical Issues',
    seeds: ['bug', 'broken', 'error', 'crash', 'slow', 'fail', 'fix', 'unreliable', 'downtime', 'latenc'],
  },
  {
    name: 'Scale & Growth',
    seeds: ['scale', 'grow', 'enterpris', 'startup', 'launch', 'expand', 'volume', 'traffic'],
  },
];

function assignCluster(keyword: string): string {
  const kw = keyword.toLowerCase();
  for (const { name, seeds } of CLUSTER_THEMES) {
    if (seeds.some((seed) => kw.includes(seed))) return name;
  }
  return 'Other Signals';
}

// ── GET /api/signals?project_id=xxx ──────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClientInstance();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const projectId = req.nextUrl.searchParams.get('project_id');
    if (!projectId)
      return NextResponse.json({ error: 'project_id required' }, { status: 400 });

    // 1. Fetch all lead IDs for this project
    const { data: leads } = await supabase
      .from('leads')
      .select('id')
      .eq('project_id', projectId);

    if (!leads?.length) {
      return NextResponse.json({
        competitors: [],
        pain_points: [],
        keywords: [],
        clusters: [],
        meta: { total_leads: 0, leads_with_signals: 0 },
      });
    }

    const leadIds = leads.map((l) => l.id);

    // 2. Fetch all scored signals for those leads
    const { data: scores } = await supabase
      .from('lead_scores')
      .select(
        'lead_id, pain_signals, competitor_mentions, matched_keywords, buying_signals, intent_score'
      )
      .in('lead_id', leadIds);

    if (!scores?.length) {
      return NextResponse.json({
        competitors: [],
        pain_points: [],
        keywords: [],
        clusters: [],
        meta: { total_leads: leadIds.length, leads_with_signals: 0 },
      });
    }

    // 3. Accumulate frequency maps
    const competitorMap = new Map<string, number>();
    const painMap = new Map<string, number>();
    const keywordMap = new Map<string, { count: number; intentSum: number }>();

    let leadsWithSignals = 0;

    for (const score of scores) {
      const intent = score.intent_score ?? 0;
      const competitors = score.competitor_mentions ?? [];
      const painSignals = score.pain_signals ?? [];
      const keywords = score.matched_keywords ?? [];

      if (competitors.length > 0 || painSignals.length > 0 || keywords.length > 0) {
        leadsWithSignals++;
      }

      for (const c of competitors) {
        const key = c.trim().toLowerCase();
        if (key) competitorMap.set(key, (competitorMap.get(key) ?? 0) + 1);
      }

      for (const p of painSignals) {
        const key = p.trim().toLowerCase();
        if (key) painMap.set(key, (painMap.get(key) ?? 0) + 1);
      }

      for (const kw of keywords) {
        const key = kw.trim().toLowerCase();
        if (!key) continue;
        const prev = keywordMap.get(key) ?? { count: 0, intentSum: 0 };
        keywordMap.set(key, { count: prev.count + 1, intentSum: prev.intentSum + intent });
      }
    }

    const totalScored = scores.length;

    // 4. Sort and format competitors
    const competitors = [...competitorMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / totalScored) * 100),
      }));

    // 5. Sort and format pain points
    const pain_points = [...painMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([phrase, count]) => ({
        phrase,
        count,
        pct: Math.round((count / totalScored) * 100),
      }));

    // 6. Sort and format keywords
    const keywords = [...keywordMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 24)
      .map(([keyword, { count, intentSum }]) => ({
        keyword,
        count,
        avg_intent: Math.round(intentSum / count),
      }));

    // 7. Build opportunity clusters by theme-bucketing keywords
    const clusterAcc = new Map<
      string,
      { keywords: string[]; counts: number[]; intents: number[] }
    >();

    for (const { keyword, count, avg_intent } of keywords) {
      const theme = assignCluster(keyword);
      const prev = clusterAcc.get(theme) ?? { keywords: [], counts: [], intents: [] };
      prev.keywords.push(keyword);
      prev.counts.push(count);
      prev.intents.push(avg_intent);
      clusterAcc.set(theme, prev);
    }

    const clusters = [...clusterAcc.entries()]
      .map(([theme, { keywords: kws, counts, intents }]) => ({
        theme,
        keywords: kws.slice(0, 6),
        count: counts.reduce((s, v) => s + v, 0),
        avg_intent: Math.round(intents.reduce((s, v) => s + v, 0) / intents.length),
      }))
      .filter((c) => c.keywords.length >= 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return NextResponse.json({
      competitors,
      pain_points,
      keywords,
      clusters,
      meta: {
        total_leads: leadIds.length,
        leads_with_signals: leadsWithSignals,
      },
    });
  } catch (error) {
    console.error('Signals aggregation error:', error);
    return NextResponse.json({ error: 'Failed to aggregate signals' }, { status: 500 });
  }
}
