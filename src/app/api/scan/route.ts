import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { fetchLeadsFromReddit, redditPostToLead } from '@/lib/reddit';
import { scorePost } from '@/lib/intent-scorer';

// POST /api/scan — cron-triggered Reddit scan for all projects
// Runs every 6 hours via Vercel cron
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronKey = process.env.CRON_SECRET;
  if (!cronKey || authHeader !== `Bearer ${cronKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceClient = createServiceClient();

  // Get all projects
  const { data: projects } = await serviceClient
    .from('projects')
    .select('id, workspace_id');

  if (!projects || projects.length === 0) {
    return NextResponse.json({ success: true, message: 'No projects to scan', total_leads: 0 });
  }

  let totalLeads = 0;
  const results: { project_id: string; leads: number }[] = [];

  for (const project of projects) {
    try {
      // Get saved search queries for this project
      const { data: queryRows } = await serviceClient
        .from('search_queries')
        .select('query_text, query_type')
        .eq('project_id', project.id)
        .eq('is_active', true)
        .limit(12);

      if (!queryRows || queryRows.length === 0) continue;

      // Get website profile for scoring context
      const { data: profile } = await serviceClient
        .from('website_profiles')
        .select('keywords, competitors, buyer_intent_phrases')
        .eq('project_id', project.id)
        .single();

      const queries = queryRows.map((q) => ({ query: q.query_text, type: q.query_type }));
      const keywords: string[] = profile?.keywords || [];
      const competitors: string[] = profile?.competitors || [];
      const buyerIntentPhrases: string[] = profile?.buyer_intent_phrases || [];

      const redditPosts = await fetchLeadsFromReddit(queries, 8);

      const scoredLeads = redditPosts
        .map((post) => {
          const text = `${post.title} ${post.selftext}`;
          const score = scorePost(text, keywords, competitors, buyerIntentPhrases, {
            posted_at: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : null,
            subreddit: post.subreddit,
            comment_count: post.num_comments,
          });
          return { ...redditPostToLead(post, project.id), score };
        })
        .filter((l) => l.score.final_score >= 15)
        .sort((a, b) => b.score.final_score - a.score.final_score)
        .slice(0, 30);

      for (const lead of scoredLeads) {
        const { data: dbLead } = await serviceClient
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
            { onConflict: 'project_id,source,external_id' }
          )
          .select('id')
          .single();

        if (dbLead?.id) {
          await serviceClient.from('lead_scores').upsert(
            {
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
              buying_signals: lead.score.signals.buying_signals,
              pain_signals: lead.score.signals.pain_signals,
              urgency_signals: lead.score.signals.urgency_signals,
              competitor_mentions: lead.score.signals.competitor_signals,
              matched_keywords: lead.score.signals.matched_keywords,
              match_reasons: lead.score.match_reasons,
              scoring_version: 'v2',
            },
            { onConflict: 'lead_id' }
          );
        }
      }

      totalLeads += scoredLeads.length;
      results.push({ project_id: project.id, leads: scoredLeads.length });
    } catch (err) {
      console.error(`Scan error for project ${project.id}:`, err);
    }
  }

  return NextResponse.json({ success: true, total_leads: totalLeads, projects: results });
}
