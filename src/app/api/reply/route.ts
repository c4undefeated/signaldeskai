import { NextRequest, NextResponse } from 'next/server';
import { generateReply } from '@/lib/ai';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      post_title,
      post_body,
      subreddit,
      product_name,
      target_customer,
      pain_points = [],
      features = [],
      match_reasons = [],
    } = body;

    if (!post_title || !product_name) {
      return NextResponse.json(
        { error: 'post_title and product_name are required' },
        { status: 400 }
      );
    }

    const reply = await generateReply({
      post_title,
      post_body: post_body || '',
      subreddit,
      product_name,
      target_customer: target_customer || '',
      pain_points,
      features,
      matched_signals: match_reasons,
    });

    return NextResponse.json({
      success: true,
      reply: {
        ...reply,
        id: `reply_${Date.now()}`,
        generated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Reply generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate reply. Please try again.' },
      { status: 500 }
    );
  }
}
