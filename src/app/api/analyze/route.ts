import { NextRequest, NextResponse } from 'next/server';
import { analyzeWebsite, crawlWebsite } from '@/lib/ai';
import { generateSearchQueries } from '@/lib/intent-scorer';
import { normalizeUrl } from '@/lib/utils';
import { createServerClientInstance } from '@/lib/supabase.server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClientInstance();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await req.json();
    const { url, project_id } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const normalizedUrl = normalizeUrl(url);

    // Crawl website
    const websiteContent = await crawlWebsite(normalizedUrl);
    if (!websiteContent || websiteContent.length < 100) {
      return NextResponse.json(
        { error: 'Unable to crawl website. Please check the URL and try again.' },
        { status: 422 }
      );
    }

    // AI analysis
    const analysis = await analyzeWebsite(websiteContent, normalizedUrl);

    // Generate search queries
    const queries = generateSearchQueries(
      analysis.keywords,
      analysis.pain_points,
      analysis.buyer_intent_phrases,
      analysis.competitors,
      analysis.category
    ).slice(0, 12);

    // ── Persist to Supabase if authenticated and project_id provided ──
    if (user && project_id) {
      await supabase
        .from('website_profiles')
        .upsert(
          {
            project_id,
            product_name: analysis.product_name,
            category: analysis.category,
            industry: analysis.industry,
            target_customer: analysis.target_customer,
            pain_points: analysis.pain_points,
            features: analysis.features,
            keywords: analysis.keywords,
            buyer_intent_phrases: analysis.buyer_intent_phrases,
            competitors: analysis.competitors,
            pricing_signals: analysis.pricing_signals,
            summary: analysis.summary,
            raw_crawl_data: { content: websiteContent.slice(0, 4000) },
            analyzed_at: new Date().toISOString(),
          },
          { onConflict: 'project_id' }
        );

      // Upsert search queries
      if (queries.length > 0) {
        const queryRows = queries.map((q) => ({
          project_id,
          query_text: q.query,
          query_type: q.type,
          source: 'reddit',
          is_active: true,
        }));
        await supabase
          .from('search_queries')
          .upsert(queryRows, { onConflict: 'project_id,query_text,source', ignoreDuplicates: true });
      }
    }

    return NextResponse.json({ success: true, analysis, queries });
  } catch (error) {
    console.error('Analysis error:', error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Failed to parse AI response. Please try again.' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 });
  }
}
