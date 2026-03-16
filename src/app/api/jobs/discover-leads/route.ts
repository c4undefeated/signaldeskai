import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { fetchLeadsFromReddit, redditPostToLead } from '@/lib/reddit';
import { searchTwitterPosts, twitterPostToLead } from '@/lib/twitter';
import { scorePost, generateSearchQueries } from '@/lib/intent-scorer';
import { buildLeadClusters, type LeadSignalInput } from '@/lib/intent-clustering';

// POST /api/jobs/discover-leads
// Autonomous background job: runs every 30 minutes via Vercel cron.
// Loops through all active projects, fetches from Reddit + Twitter,
// scores posts, persists new leads, and fires high-intent alerts.

const SCORE_THRESHOLD = 15;
const CANDIDATES_PER_PROJECT = 30;
const REDDIT_PER_QUERY = 8;
const TWITTER_PER_QUERY = 10;
// A lead is considered "new" if it was inserted within this window
const NEW_LEAD_WINDOW_MS = 3 * 60 * 1000;

const PLAN_LIMITS: Record<string, number> = {
  free: 25,
  starter: 100,
  pro: 250,
  enterprise: 9999,
};

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronKey = process.env.CRON_SECRET;
  if (!cronKey || authHeader !== `Bearer ${cronKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServiceClient();
  const today = new Date().toISOString().split('T')[0];

  // Load all active projects with workspace plan + website profile
  const { data: projects, error: projectsError } = await db
    .from('projects')
    .select(`
      id,
      workspace_id,
      workspaces(plan),
      website_profiles(
        keywords,
        competitors,
        buyer_intent_phrases,
        pain_points,
        category
      )
    `)
    .eq('is_active', true);

  if (projectsError) {
    console.error('[DiscoverLeads] Failed to load projects:', projectsError.message);
    return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 });
  }

  if (!projects?.length) {
    return NextResponse.json({ success: true, message: 'No active projects', total_new_leads: 0 });
  }

  let totalNewLeads = 0;
  const results: Array<{
    project_id: string;
    new_leads: number;
    alerts_fired: number;
    error?: string;
  }> = [];

  for (const project of projects) {
    try {
      const ws = project.workspaces as unknown as { plan: string } | null;
      const plan = ws?.plan ?? 'free';
      const dailyLimit = PLAN_LIMITS[plan] ?? 25;
      const workspaceId = project.workspace_id;

      // Skip projects that have already hit their daily limit
      if (workspaceId) {
        const { data: usage } = await db
          .from('usage_tracking')
          .select('leads_discovered')
          .eq('workspace_id', workspaceId)
          .eq('period', today)
          .single();
        if ((usage?.leads_discovered ?? 0) >= dailyLimit) continue;
      }

      // Resolve website profile (may be array or single object from join)
      const rawProfile = project.website_profiles as unknown;
      const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;

      const keywords: string[] = profile?.keywords ?? [];
      const competitors: string[] = profile?.competitors ?? [];
      const buyerIntentPhrases: string[] = profile?.buyer_intent_phrases ?? [];

      // Use saved search queries if present, otherwise generate from website profile
      let queries: Array<{ query: string; type: string }> = [];
      const { data: savedQueries } = await db
        .from('search_queries')
        .select('query_text, query_type')
        .eq('project_id', project.id)
        .eq('is_active', true)
        .limit(12);

      if (savedQueries?.length) {
        queries = savedQueries.map((q) => ({
          query: q.query_text,
          type: q.query_type ?? 'keyword',
        }));
      } else if (profile) {
        queries = generateSearchQueries(
          keywords,
          profile.pain_points ?? [],
          buyerIntentPhrases,
          competitors,
          profile.category ?? '',
        ).slice(0, 12);
      }

      if (!queries.length) continue;

      // Fetch from Reddit and Twitter in parallel
      const [redditPosts, twitterPosts] = await Promise.all([
        fetchLeadsFromReddit(queries, REDDIT_PER_QUERY),
        searchTwitterPosts(queries, TWITTER_PER_QUERY),
      ]);

      // Score all candidates and merge into a single ranked pool
      const scoreOpts = (opts: {
        posted_at?: string | null;
        subreddit?: string;
        comment_count?: number;
      }) => scorePost('', keywords, competitors, buyerIntentPhrases, opts);

      const candidates = [
        ...redditPosts.map((post) => ({
          lead: redditPostToLead(post, project.id),
          score: scorePost(
            `${post.title} ${post.selftext}`,
            keywords,
            competitors,
            buyerIntentPhrases,
            {
              posted_at: post.created_utc
                ? new Date(post.created_utc * 1000).toISOString()
                : null,
              subreddit: post.subreddit,
              comment_count: post.num_comments,
            },
          ),
        })),
        ...twitterPosts.map((post) => ({
          lead: twitterPostToLead(post, project.id),
          score: scorePost(post.text, keywords, competitors, buyerIntentPhrases, {
            posted_at: post.created_at ?? null,
            comment_count: post.public_metrics?.reply_count ?? 0,
          }),
        })),
      ]
        .filter((c) => c.score.final_score >= SCORE_THRESHOLD)
        .sort((a, b) => b.score.final_score - a.score.final_score)
        .slice(0, CANDIDATES_PER_PROJECT);

      if (!candidates.length) {
        results.push({ project_id: project.id, new_leads: 0, alerts_fired: 0 });
        continue;
      }

      // Upsert leads + scores; track which rows were newly inserted
      const now = Date.now();
      const newLeadIds: string[] = [];
      const clusterInputs: LeadSignalInput[] = [];

      for (const { lead, score } of candidates) {
        const { data: dbLead } = await db
          .from('leads')
          .upsert(
            {
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
            },
            { onConflict: 'project_id,source,external_id' },
          )
          .select('id, created_at')
          .single();

        if (!dbLead?.id) continue;

        // created_at is only set on INSERT; existing rows keep their original date.
        // A recent timestamp means this is a genuinely new lead.
        const isNew = now - new Date(dbLead.created_at).getTime() < NEW_LEAD_WINDOW_MS;
        if (isNew) newLeadIds.push(dbLead.id);

        await db.from('lead_scores').upsert(
          {
            lead_id: dbLead.id,
            intent_score: score.intent_score,
            pain_score: score.pain_score,
            urgency_score: score.urgency_score,
            relevance_score: score.relevance_score,
            freshness_score: score.freshness_score,
            community_score: score.community_score,
            competitor_bonus: score.competitor_bonus,
            unanswered_bonus: score.unanswered_bonus,
            final_score: score.final_score,
            buying_signals: score.signals.buying_signals,
            pain_signals: score.signals.pain_signals,
            urgency_signals: score.signals.urgency_signals,
            competitor_mentions: score.signals.competitor_signals,
            matched_keywords: score.signals.matched_keywords,
            match_reasons: score.match_reasons,
            scoring_version: 'v2-job',
          },
          { onConflict: 'lead_id' },
        );

        clusterInputs.push({
          id: dbLead.id,
          title: lead.title ?? null,
          body: lead.body ?? null,
          subreddit: lead.subreddit ?? null,
          buying_signals: score.signals.buying_signals,
          pain_signals: score.signals.pain_signals,
          urgency_signals: score.signals.urgency_signals,
          competitor_mentions: score.signals.competitor_signals,
          intent_score: score.intent_score,
        });
      }

      // Update intent clusters (non-critical — failure never blocks the job)
      if (clusterInputs.length > 0) {
        try {
          const clusters = buildLeadClusters(project.id, clusterInputs);
          for (const c of clusters) {
            await db.from('lead_clusters').upsert(
              {
                project_id: c.project_id,
                intent_type: c.intent_type,
                cluster_name: c.cluster_name,
                cluster_summary: c.cluster_summary,
                lead_ids: c.lead_ids,
                signal_count: c.signal_count,
                avg_intent_score: c.avg_intent_score,
                top_competitors: c.top_competitors,
                top_pain_phrases: c.top_pain_phrases,
                top_subreddits: c.top_subreddits,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'project_id,intent_type' },
            );
          }
        } catch (clusterErr) {
          console.warn(
            `[DiscoverLeads] Cluster update failed for project ${project.id}:`,
            clusterErr,
          );
        }
      }

      // Increment usage counter for newly discovered leads
      if (newLeadIds.length > 0 && workspaceId) {
        await db.rpc('increment_usage', {
          p_workspace_id: workspaceId,
          p_period: today,
          p_leads: newLeadIds.length,
        });
      }

      // Fire high-intent alerts for newly inserted leads
      let alertsFired = 0;
      if (newLeadIds.length > 0 && workspaceId) {
        const { data: activeAlerts } = await db
          .from('alerts')
          .select('user_id, threshold')
          .eq('project_id', project.id)
          .eq('alert_type', 'high_intent')
          .eq('is_active', true);

        if (activeAlerts?.length) {
          const { data: newLeadScores } = await db
            .from('lead_scores')
            .select('lead_id, final_score')
            .in('lead_id', newLeadIds);

          for (const alert of activeAlerts) {
            const threshold = alert.threshold ?? 70;
            const highIntentLeads = (newLeadScores ?? []).filter(
              (s) => s.final_score >= threshold,
            );

            if (highIntentLeads.length > 0) {
              await db.from('notifications').insert({
                user_id: alert.user_id,
                workspace_id: workspaceId,
                type: 'alert',
                title: `${highIntentLeads.length} high-intent lead${highIntentLeads.length > 1 ? 's' : ''} discovered`,
                message: `${highIntentLeads.length} new lead${highIntentLeads.length > 1 ? 's' : ''} scored ${threshold}+ for your project.`,
                read: false,
                data: {
                  lead_ids: highIntentLeads.map((l) => l.lead_id),
                  project_id: project.id,
                },
              });
              alertsFired++;
            }
          }
        }
      }

      totalNewLeads += newLeadIds.length;
      results.push({ project_id: project.id, new_leads: newLeadIds.length, alerts_fired: alertsFired });
    } catch (err) {
      console.error(`[DiscoverLeads] Error for project ${project.id}:`, err);
      results.push({
        project_id: project.id,
        new_leads: 0,
        alerts_fired: 0,
        error: String(err),
      });
    }
  }

  return NextResponse.json({
    success: true,
    total_new_leads: totalNewLeads,
    projects: results,
    ran_at: new Date().toISOString(),
  });
}
