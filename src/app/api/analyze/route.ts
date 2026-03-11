import { NextRequest, NextResponse } from 'next/server';
import { analyzeWebsite, crawlWebsite } from '@/lib/ai';
import { generateSearchQueries } from '@/lib/intent-scorer';
import { normalizeUrl } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const normalizedUrl = normalizeUrl(url);

    // Crawl the website
    console.log(`Crawling website: ${normalizedUrl}`);
    const websiteContent = await crawlWebsite(normalizedUrl);

    if (!websiteContent || websiteContent.length < 100) {
      return NextResponse.json(
        { error: 'Unable to crawl website. Please check the URL and try again.' },
        { status: 422 }
      );
    }

    // Analyze with AI
    console.log('Analyzing website with AI...');
    const analysis = await analyzeWebsite(websiteContent, normalizedUrl);

    // Generate search queries
    const queries = generateSearchQueries(
      analysis.keywords,
      analysis.pain_points,
      analysis.buyer_intent_phrases,
      analysis.competitors,
      analysis.category
    );

    return NextResponse.json({
      success: true,
      analysis,
      queries: queries.slice(0, 12), // Limit queries
    });
  } catch (error) {
    console.error('Analysis error:', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Failed to parse AI response. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Analysis failed. Please try again.' },
      { status: 500 }
    );
  }
}
