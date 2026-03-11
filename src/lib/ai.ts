import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface WebsiteAnalysis {
  product_name: string;
  category: string;
  target_customer: string;
  pain_points: string[];
  features: string[];
  keywords: string[];
  buyer_intent_phrases: string[];
  competitors: string[];
  industry: string;
  pricing_signals: string;
  summary: string;
}

export async function analyzeWebsite(
  websiteContent: string,
  url: string
): Promise<WebsiteAnalysis> {
  const prompt = `You are a business intelligence analyst. Analyze this website content and extract structured information for a lead discovery platform.

Website URL: ${url}

Website Content:
${websiteContent.slice(0, 8000)}

Extract the following information and respond with ONLY valid JSON (no markdown, no explanation):

{
  "product_name": "name of the product/service",
  "category": "product category (e.g., CRM, analytics, project management, etc.)",
  "target_customer": "ideal customer persona description",
  "pain_points": ["pain point 1", "pain point 2", "pain point 3", "pain point 4", "pain point 5"],
  "features": ["feature 1", "feature 2", "feature 3", "feature 4", "feature 5"],
  "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5", "keyword 6", "keyword 7", "keyword 8"],
  "buyer_intent_phrases": ["phrase someone would use when looking for this product", "phrase 2", "phrase 3", "phrase 4"],
  "competitors": ["competitor 1", "competitor 2", "competitor 3"],
  "industry": "industry vertical",
  "pricing_signals": "pricing model description (e.g., SaaS monthly, freemium, enterprise, etc.)",
  "summary": "1-2 sentence description of what the company does"
}

Focus on:
- What problems does this product solve?
- Who is the ideal buyer?
- What would someone search for on Reddit when looking for this type of product?
- What are the most likely competitor products?
- What pain phrases would a frustrated user of a competitor post?`;

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from AI');
  }

  const rawText = content.text.trim();
  // Extract JSON if wrapped in markdown code blocks
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]+?)\s*```/) || [null, rawText];
  const jsonText = jsonMatch[1] || rawText;

  return JSON.parse(jsonText) as WebsiteAnalysis;
}

export interface ReplyGenerationInput {
  post_title: string;
  post_body: string;
  subreddit?: string;
  product_name: string;
  target_customer: string;
  pain_points: string[];
  features: string[];
  matched_signals: string[];
}

export interface GeneratedReply {
  reply_text: string;
  dm_text: string;
  spam_risk: 'LOW' | 'MEDIUM' | 'HIGH';
  natural_tone_score: number;
  promotion_level: 'NONE' | 'SUBTLE' | 'MODERATE' | 'HIGH';
  confidence_score: number;
}

export async function generateReply(input: ReplyGenerationInput): Promise<GeneratedReply> {
  const prompt = `You are an expert at writing authentic, helpful Reddit responses that subtly introduce a product.

CONTEXT:
- Product: ${input.product_name}
- Target Customer: ${input.target_customer}
- Key Pain Points We Solve: ${input.pain_points.join(', ')}
- Key Features: ${input.features.slice(0, 3).join(', ')}
- Why This Post Matched: ${input.matched_signals.join(', ')}

POST TO REPLY TO:
Title: ${input.post_title}
Subreddit: ${input.subreddit ? 'r/' + input.subreddit : 'N/A'}
Body: ${(input.post_body || '').slice(0, 1000)}

RULES FOR REPLY:
1. Start with genuine empathy - acknowledge their pain or question
2. Share useful insight or perspective (not just promotion)
3. Introduce the product naturally and subtly, like a peer recommendation
4. Sound like a real person, not a marketer
5. Keep it under 200 words
6. NO: "I work at", "Full disclosure", "Disclaimer"  - be natural
7. NO aggressive CTAs or hard selling
8. YES: Conversational, helpful, adds value

Also write a short DM version (max 100 words) that's more direct.

Respond with ONLY this JSON structure:
{
  "reply_text": "the reddit comment reply",
  "dm_text": "the direct message version",
  "spam_risk": "LOW",
  "natural_tone_score": 85,
  "promotion_level": "SUBTLE",
  "confidence_score": 88,
  "reasoning": "brief explanation of approach"
}`;

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 800,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from AI');
  }

  const rawText = content.text.trim();
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]+?)\s*```/) || [null, rawText];
  const jsonText = jsonMatch[1] || rawText;

  return JSON.parse(jsonText) as GeneratedReply;
}

export async function crawlWebsite(url: string): Promise<string> {
  // In production, use a proper crawler. For now, fetch the HTML.
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SignalDeskAI/1.0)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // Extract text content from HTML
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return text;
  } catch (error) {
    console.error(`Failed to crawl ${url}:`, error);
    return '';
  }
}
