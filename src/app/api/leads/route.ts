import { NextRequest, NextResponse } from 'next/server';
import { fetchLeadsFromReddit, redditPostToLead } from '@/lib/reddit';
import { scorePost } from '@/lib/intent-scorer';
import { createServerClientInstance } from '@/lib/supabase';

// ── GET /api/leads — load persisted leads from DB ──────────────
export async function GET(req: NextRequest) {
  const supabase = await createServerClientInstance();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const project_id = params.get('project_id');
  const source = params.get('source');
  const min_score = parseInt(params.get('min_score') || '0');
  const limit = Math.min(parseInt(params.get('limit') || '50'), 100);
  const offset = parseInt(params.get('offset') || '0');

  if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

  const query = supabase
    .from('leads')
    .select('*, lead_scores(*), lead_statuses(*)', { count: 'exact' })
    .eq('project_id', project_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (source && source !== 'all') query.eq('source', source);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ leads: data || [], total: count });
}

// ── POST /api/leads — discover & persist new leads from Reddit ──
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClientInstance();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await req.json();
    const { queries = [], keywords = [], competitors = [], buyer_intent_phrases = [], project_id, limit = 30 } = body;

    if (!queries.length) {
      return NextResponse.json({ error: 'Queries are required' }, { status: 400 });
    }

    // ── Daily usage limit check ──────────────────────────────
    if (user && project_id) {
      const { data: proj } = await supabase
        .from('projects')
        .select('workspace_id, workspaces(plan)')
        .eq('id', project_id)
        .single();

      const plan = (proj?.workspaces as { plan: string } | null)?.plan || 'free';
      const dailyLimit = plan === 'pro' ? 250 : plan === 'enterprise' ? 9999 : 25;
      const today = new Date().toISOString().split('T')[0];

      const { data: usage } = await supabase
        .from('usage_tracking')
        .select('leads_discovered')
        .eq('workspace_id', proj?.workspace_id)
        .eq('period', today)
        .single();

      if ((usage?.leads_discovered ?? 0) >= dailyLimit) {
        return NextResponse.json({
          success: true, leads: [], total: 0,
          limit_reached: true,
          message: `Daily lead limit (${dailyLimit}) reached. Upgrade to Pro for more.`,
        });
      }
    }

    // ── Fetch from Reddit ─────────────────────────────────────
    const redditPosts = await fetchLeadsFromReddit(queries, 8);

    // ── Score each post ───────────────────────────────────────
    const scoredLeads = redditPosts
      .map((post) => {
        const text = `${post.title} ${post.selftext}`;
        const score = scorePost(text, keywords, competitors, buyer_intent_phrases, {
          posted_at: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : null,
          subreddit: post.subreddit,
          comment_count: post.num_comments,
        });
        const lead = {
          ...redditPostToLead(post, project_id || 'demo'),
          id: `reddit_${post.id}`,
          score: {
            intent_score: score.intent_score,
            pain_score: score.pain_score,
            urgency_score: score.urgency_score,
            relevance_score: score.relevance_score,
            final_score: score.final_score,
            freshness_score: score.freshness_score,
            community_score: score.community_score,
            competitor_bonus: score.competitor_bonus,
            unanswered_bonus: score.unanswered_bonus,
            buying_signals: score.signals.buying_signals,
            pain_signals: score.signals.pain_signals,
            urgency_signals: score.signals.urgency_signals,
            competitor_mentions: score.signals.competitor_signals,
            matched_keywords: score.signals.matched_keywords,
            match_reasons: score.match_reasons,
            scored_at: new Date().toISOString(),
            lead_id: `reddit_${post.id}`,
            id: `score_${post.id}`,
          },
        };
        return lead;
      })
      .filter((l) => l.score.final_score >= 15)
      .sort((a, b) => b.score.final_score - a.score.final_score)
      .slice(0, limit);

    // ── Persist to Supabase ───────────────────────────────────
    if (user && project_id) {
      const { data: proj } = await supabase
        .from('projects')
        .select('workspace_id')
        .eq('id', project_id)
        .single();

      const workspaceId = proj?.workspace_id;

      for (const lead of scoredLeads) {
        const { data: dbLead } = await supabase
          .from('leads')
          .upsert({
            project_id: lead.project_id,
            source: lead.source,
            external_id: lead.external_id,
            url: lead.url,
            title: lead.title,
            body: lead.body,
            author: lead.author,
            subreddit: lead.subreddit,
            upvotes: lead.upvotes,
            comment_count: lead.comment_count,
            is_answered: (lead.comment_count || 0) > 0,
            posted_at: lead.posted_at,
          }, { onConflict: 'project_id,source,external_id' })
          .select('id')
          .single();

        if (dbLead?.id) {
          await supabase.from('lead_scores').upsert({
            lead_id: dbLead.id,
            intent_score: lead.score.intent_score,
            pain_score: lead.score.pain_score,
            urgency_score: lead.score.urgency_score,
            relevance_score: lead.score.relevance_score,
            freshness_score: lead.score.freshness_score,
            community_score: lead.score.community_score,
            competitor_bonus: lead.score.competitor_bonus,
            unanswered_bonus: lead.score.unanswered_bonus,
            final_score: lead.score.final_score,
            buying_signals: lead.score.buying_signals,
            pain_signals: lead.score.pain_signals,
            urgency_signals: lead.score.urgency_signals,
            competitor_mentions: lead.score.competitor_mentions,
            matched_keywords: lead.score.matched_keywords,
            match_reasons: lead.score.match_reasons,
            scoring_version: 'v2',
          }, { onConflict: 'lead_id' });

          // Update in-memory ID to DB ID
          lead.id = dbLead.id;
          lead.score.lead_id = dbLead.id;
        }
      }

      // Track usage
      if (workspaceId) {
        const today = new Date().toISOString().split('T')[0];
        await supabase.from('usage_tracking').upsert(
          { workspace_id: workspaceId, period: today, leads_discovered: scoredLeads.length },
          { onConflict: 'workspace_id,period', ignoreDuplicates: false }
        );
      }
    }

    return NextResponse.json({
      success: true,
      leads: scoredLeads,
      total: scoredLeads.length,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Lead fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch leads. Please try again.' }, { status: 500 });
  }
}
