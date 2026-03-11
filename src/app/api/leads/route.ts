import { NextRequest, NextResponse } from 'next/server';
import { fetchLeadsFromReddit, redditPostToLead } from '@/lib/reddit';
import { scorePost } from '@/lib/intent-scorer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      queries = [],
      keywords = [],
      competitors = [],
      buyer_intent_phrases = [],
      project_id,
      limit = 30,
    } = body;

    if (!queries.length) {
      return NextResponse.json({ error: 'Queries are required' }, { status: 400 });
    }

    // Fetch posts from Reddit
    console.log(`Fetching Reddit leads for ${queries.length} queries...`);
    const redditPosts = await fetchLeadsFromReddit(queries, 8);

    // Score and transform each post
    const scoredLeads = redditPosts
      .map((post) => {
        const text = `${post.title} ${post.selftext}`;
        const score = scorePost(text, keywords, competitors, buyer_intent_phrases);

        const lead = {
          ...redditPostToLead(post, project_id || 'demo'),
          id: `reddit_${post.id}_${Date.now()}`,
          score: {
            intent_score: score.intent_score,
            pain_score: score.pain_score,
            urgency_score: score.urgency_score,
            relevance_score: score.relevance_score,
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
      // Filter out very low intent posts
      .filter((lead) => lead.score.intent_score >= 10)
      // Sort by intent score
      .sort((a, b) => b.score.intent_score - a.score.intent_score)
      // Limit results
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      leads: scoredLeads,
      total: scoredLeads.length,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Lead fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leads. Please try again.' },
      { status: 500 }
    );
  }
}
