import { NextRequest, NextResponse } from 'next/server';
import { fetchLeadsFromReddit, redditPostToLead } from '@/lib/reddit';
import { searchTwitterPosts, twitterPostToLead } from '@/lib/twitter';
import { scorePost } from '@/lib/intent-scorer';
import { rerankLeads } from '@/lib/ai';
import { diversifyLeads } from '@/lib/diversity';
import { buildBehaviorProfile, applyBehaviorBoost } from '@/lib/behavioral-scorer';
import { createServerClientInstance } from '@/lib/supabase.server';
import { buildLeadClusters, type LeadSignalInput } from '@/lib/intent-clustering';

interface ProfileRow {
  product_name: string | null;
  target_customer: string | null;
  pain_points: string[];
  features: string[];
  keywords: string[];
  competitors: string[];
  buyer_intent_phrases: string[];
}

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

// ── POST /api/leads — discover & rank new leads (multi-source) ─
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClientInstance();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await req.json();
    const {
      queries = [],
      keywords = [],
      competitors = [],
      buyer_intent_phrases = [],
      project_id,
      limit = 30,
      sources = ['reddit'],
    } = body;

    if (!queries.length) {
      return NextResponse.json({ error: 'Queries are required' }, { status: 400 });
    }

    // ── Load project + workspace plan + website profile ────────
    let workspaceId: string | null = null;
    let plan = 'free';
    let websiteProfile: ProfileRow | null = null;

    if (user && project_id) {
      const { data: proj } = await supabase
        .from('projects')
        .select(`
          workspace_id,
          workspaces(plan),
          website_profiles(
            product_name,
            target_customer,
            pain_points,
            features,
            keywords,
            competitors,
            buyer_intent_phrases
          )
        `)
        .eq('id', project_id)
        .single();

      workspaceId = proj?.workspace_id ?? null;
      const ws = proj?.workspaces as unknown as { plan: string } | null;
      plan = ws?.plan ?? 'free';

      const rawProfiles = proj?.website_profiles as unknown as ProfileRow | ProfileRow[] | null;
      if (Array.isArray(rawProfiles) && rawProfiles.length > 0) {
        websiteProfile = rawProfiles[0];
      } else if (rawProfiles && !Array.isArray(rawProfiles)) {
        websiteProfile = rawProfiles;
      }

      // ── Daily usage limit check ──────────────────────────────
      const dailyLimit = plan === 'pro' ? 250 : plan === 'enterprise' ? 9999 : 25;
      const today = new Date().toISOString().split('T')[0];

      const { data: usage } = await supabase
        .from('usage_tracking')
        .select('leads_discovered')
        .eq('workspace_id', workspaceId)
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

    // ── Stage 1: Fetch from enabled sources + deterministic scoring ──
    const activeSources: string[] = Array.isArray(sources) ? sources : ['reddit'];

    const CANDIDATE_POOL = 25;
    const FINAL_COUNT = 20;
    const SCORE_THRESHOLD = 15;

    // Helper: convert a scorePost() result to the score shape used downstream
    const buildScoreShape = (
      score: ReturnType<typeof scorePost>,
      localId: string,
    ) => ({
      intent_score:       score.intent_score,
      pain_score:         score.pain_score,
      urgency_score:      score.urgency_score,
      relevance_score:    score.relevance_score,
      final_score:        score.final_score,
      freshness_score:    score.freshness_score,
      community_score:    score.community_score,
      competitor_bonus:   score.competitor_bonus,
      unanswered_bonus:   score.unanswered_bonus,
      buying_signals:     score.signals.buying_signals,
      pain_signals:       score.signals.pain_signals,
      urgency_signals:    score.signals.urgency_signals,
      competitor_mentions: score.signals.competitor_signals,
      matched_keywords:   score.signals.matched_keywords,
      match_reasons:      score.match_reasons,
      scored_at:          new Date().toISOString(),
      lead_id: localId,
      id:      `score_${localId}`,
    });

    // Parallel fetch from all active sources
    const [redditPosts, twitterPosts] = await Promise.all([
      activeSources.includes('reddit')
        ? fetchLeadsFromReddit(queries, 8)
        : Promise.resolve([]),
      activeSources.includes('twitter')
        ? searchTwitterPosts(queries, 10)
        : Promise.resolve([]),
    ]);

    // Score Reddit candidates
    const redditCandidates = redditPosts.map((post) => {
      const localId = `reddit_${post.id}`;
      const score = scorePost(
        `${post.title} ${post.selftext}`,
        keywords, competitors, buyer_intent_phrases,
        {
          posted_at: post.created_utc
            ? new Date(post.created_utc * 1000).toISOString()
            : null,
          subreddit:     post.subreddit,
          comment_count: post.num_comments,
        },
      );
      return {
        ...redditPostToLead(post, project_id || 'demo'),
        id: localId,
        score: buildScoreShape(score, localId),
      };
    });

    // Score Twitter candidates using the same pipeline
    const twitterCandidates = twitterPosts.map((post) => {
      const localId = `twitter_${post.id}`;
      const score = scorePost(
        post.text,
        keywords, competitors, buyer_intent_phrases,
        {
          posted_at:     post.created_at ?? null,
          subreddit:     undefined,
          comment_count: post.public_metrics?.reply_count ?? 0,
        },
      );
      return {
        ...twitterPostToLead(post, project_id || 'demo'),
        id: localId,
        score: buildScoreShape(score, localId),
      };
    });

    // Merge, filter, and rank the combined candidate pool
    const deterministic = [...redditCandidates, ...twitterCandidates]
      .filter((l) => l.score.final_score >= SCORE_THRESHOLD)
      .sort((a, b) => b.score.final_score - a.score.final_score)
      .slice(0, CANDIDATE_POOL);

    // ── Stage 2: AI reranking (requires website profile) ───────
    let finalLeads = deterministic.slice(0, Math.min(FINAL_COUNT, limit));

    if (websiteProfile && deterministic.length > 0) {
      try {
        const rerankContext = {
          product_name: websiteProfile.product_name ?? '',
          target_customer: websiteProfile.target_customer ?? '',
          pain_points: websiteProfile.pain_points ?? [],
          features: websiteProfile.features ?? [],
          keywords: websiteProfile.keywords ?? keywords,
          competitors: websiteProfile.competitors ?? competitors,
          buyer_intent_phrases: websiteProfile.buyer_intent_phrases ?? buyer_intent_phrases,
        };

        const rerankResults = await rerankLeads(
          deterministic.map((l) => ({
            title: l.title ?? '',
            body: l.body,
            subreddit: l.subreddit,
          })),
          rerankContext
        );

        // Apply AI reranking: blend scores, replace match_reasons
        const reranked = rerankResults
          .filter((r) => r.post_index >= 0 && r.post_index < deterministic.length)
          .map((r) => {
            const lead = deterministic[r.post_index];
            const aiConfidence = Math.max(0, Math.min(100, r.intent_confidence));
            const blendedScore = Math.round(
              aiConfidence * 0.60 + lead.score.final_score * 0.40
            );
            return {
              ...lead,
              score: {
                ...lead.score,
                intent_score: aiConfidence,
                final_score: blendedScore,
                match_reasons: r.refined_reason
                  ? [r.refined_reason]
                  : lead.score.match_reasons,
              },
            };
          })
          // Keep only posts with meaningful AI confidence
          .filter((l) => l.score.intent_score >= 30)
          .sort((a, b) => b.score.final_score - a.score.final_score)
          .slice(0, Math.min(FINAL_COUNT, limit));

        // Fall back to deterministic if AI returned too few results
        if (reranked.length >= 3) {
          finalLeads = reranked;
        }
      } catch (aiErr) {
        console.warn('AI reranking failed, using deterministic results:', aiErr);
        // finalLeads stays as deterministic slice
      }
    }

    // ── Stage 3: Behavioral scoring ───────────────────────────
    if (workspaceId) {
      const behaviorProfile = await buildBehaviorProfile(workspaceId, supabase);
      finalLeads = finalLeads
        .map((lead) => applyBehaviorBoost(lead, behaviorProfile))
        .sort((a, b) => b.score.final_score - a.score.final_score);
    }

    // ── Stage 4: Diversity enforcement ────────────────────────
    finalLeads = diversifyLeads(finalLeads, Math.min(FINAL_COUNT, limit));

    // ── Persist to Supabase ────────────────────────────────────
    if (user && project_id) {
      for (const lead of finalLeads) {
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
            scoring_version: 'v3-ai',
          }, { onConflict: 'lead_id' });

          lead.id = dbLead.id;
          lead.score.lead_id = dbLead.id;
        }
      }

      // Track usage
      if (workspaceId && finalLeads.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        await supabase.rpc('increment_usage', {
          p_workspace_id: workspaceId,
          p_period: today,
          p_leads: finalLeads.length,
        });
      }

      // ── Update intent clusters ──────────────────────────────
      // Runs after leads are persisted (we have real DB ids now).
      // Errors are swallowed so a clustering failure never blocks
      // the discovery response.
      if (finalLeads.length > 0) {
        try {
          const inputs: LeadSignalInput[] = finalLeads
            .filter((l) => l.id && l.score)
            .map((l) => ({
              id:                  l.id,
              title:               l.title,
              body:                l.body,
              subreddit:           l.subreddit,
              buying_signals:      l.score.buying_signals      ?? [],
              pain_signals:        l.score.pain_signals        ?? [],
              urgency_signals:     l.score.urgency_signals     ?? [],
              competitor_mentions: l.score.competitor_mentions ?? [],
              intent_score:        l.score.intent_score        ?? 0,
            }));

          const clusters = buildLeadClusters(project_id, inputs);
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
        } catch (clusterErr) {
          console.warn('[Clustering] Update failed (non-critical):', clusterErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      leads: finalLeads,
      total: finalLeads.length,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Lead fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch leads. Please try again.' }, { status: 500 });
  }
}
