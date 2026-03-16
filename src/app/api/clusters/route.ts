import { NextRequest, NextResponse } from 'next/server';
import { createServerClientInstance } from '@/lib/supabase.server';
import { buildLeadClusters, type LeadSignalInput } from '@/lib/intent-clustering';

// ── Shared: fetch lead signals for a project and build clusters ────────────────

async function computeClustersForProject(
  supabase: Awaited<ReturnType<typeof createServerClientInstance>>,
  projectId: string,
) {
  // Load all leads with their score signals in one round trip
  const { data: leads } = await supabase
    .from('leads')
    .select(`
      id, title, body, subreddit,
      lead_scores(buying_signals, pain_signals, urgency_signals, competitor_mentions, intent_score)
    `)
    .eq('project_id', projectId);

  if (!leads?.length) return [];

  const inputs: LeadSignalInput[] = leads.map((l) => {
    const score = Array.isArray(l.lead_scores)
      ? l.lead_scores[0]
      : l.lead_scores;
    return {
      id:                  l.id,
      title:               l.title,
      body:                l.body,
      subreddit:           l.subreddit,
      buying_signals:      score?.buying_signals      ?? [],
      pain_signals:        score?.pain_signals        ?? [],
      urgency_signals:     score?.urgency_signals     ?? [],
      competitor_mentions: score?.competitor_mentions ?? [],
      intent_score:        score?.intent_score        ?? 0,
    };
  });

  return buildLeadClusters(projectId, inputs);
}

async function upsertClusters(
  supabase: Awaited<ReturnType<typeof createServerClientInstance>>,
  clusters: ReturnType<typeof buildLeadClusters>,
) {
  for (const c of clusters) {
    await supabase.from('lead_clusters').upsert(
      {
        project_id:       c.project_id,
        intent_type:      c.intent_type,
        cluster_name:     c.cluster_name,
        cluster_summary:  c.cluster_summary,
        lead_ids:         c.lead_ids,
        signal_count:     c.signal_count,
        avg_intent_score: c.avg_intent_score,
        top_competitors:  c.top_competitors,
        top_pain_phrases: c.top_pain_phrases,
        top_subreddits:   c.top_subreddits,
        updated_at:       new Date().toISOString(),
      },
      { onConflict: 'project_id,intent_type' },
    );
  }
}

// ── GET /api/clusters?project_id=xxx ──────────────────────────────────────────
// Returns persisted clusters.  If none exist yet, computes and saves them
// on first call so the signals page always sees data after lead discovery.

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClientInstance();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const projectId = req.nextUrl.searchParams.get('project_id');
    if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

    // Try persisted clusters first
    const { data: existing } = await supabase
      .from('lead_clusters')
      .select('*')
      .eq('project_id', projectId)
      .order('signal_count', { ascending: false });

    if (existing?.length) {
      return NextResponse.json({ clusters: existing });
    }

    // First load — compute and persist
    const clusters = await computeClustersForProject(supabase, projectId);
    if (clusters.length > 0) {
      await upsertClusters(supabase, clusters);
    }

    return NextResponse.json({ clusters });
  } catch (error) {
    console.error('Clusters GET error:', error);
    return NextResponse.json({ error: 'Failed to load clusters' }, { status: 500 });
  }
}

// ── POST /api/clusters — force full rebuild ────────────────────────────────────
// Called after new leads are discovered to keep clusters fresh.
// Body: { project_id: string }

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClientInstance();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { project_id } = await req.json();
    if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

    const clusters = await computeClustersForProject(supabase, project_id);

    if (clusters.length > 0) {
      await upsertClusters(supabase, clusters);
    }

    return NextResponse.json({ success: true, clusters });
  } catch (error) {
    console.error('Clusters POST error:', error);
    return NextResponse.json({ error: 'Failed to rebuild clusters' }, { status: 500 });
  }
}
