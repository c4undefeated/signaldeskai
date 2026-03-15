import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

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

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  const result = await model.generateContent(prompt);
  const rawText = result.response.text().trim();
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]+?)\s*```/) || [null, rawText];
  const jsonText = jsonMatch[1] || rawText;

  return JSON.parse(jsonText) as WebsiteAnalysis;
}

export type ToneVariant = 'standard' | 'less_salesy' | 'more_helpful' | 'direct';

export interface ReplyGenerationInput {
  post_title: string;
  post_body: string;
  subreddit?: string;
  product_name: string;
  target_customer: string;
  pain_points: string[];
  features: string[];
  matched_signals: string[];
  tone_variant?: ToneVariant;
}

export interface GeneratedReply {
  reply_text: string;
  dm_text: string;
  spam_risk: 'LOW' | 'MEDIUM' | 'HIGH';
  natural_tone_score: number;
  promotion_level: 'NONE' | 'SUBTLE' | 'MODERATE' | 'HIGH';
  confidence_score: number;
}

const TONE_DIRECTIVES: Record<ToneVariant, string> = {
  standard:      'Balance helpfulness and a subtle product mention. Sound like a knowledgeable peer.',
  less_salesy:   'Focus 90% on providing genuine value. Mention the product only once, very briefly, as an afterthought. No product description.',
  more_helpful:  'Lead with deep insight and actionable advice. Mention the product only as the tool that helped you solve this exact problem.',
  direct:        'Be slightly more explicit about what the product does, but still conversational. Mention the specific feature that applies to their problem.',
};

export async function generateReply(input: ReplyGenerationInput): Promise<GeneratedReply> {
  const toneVariant = input.tone_variant || 'standard';
  const toneDirective = TONE_DIRECTIVES[toneVariant];

  const prompt = `You are an expert at writing authentic, helpful Reddit responses that naturally introduce a product.

TONE: ${toneDirective}

CONTEXT:
- Product: ${input.product_name}
- Target Customer: ${input.target_customer}
- Pain Points We Solve: ${input.pain_points.slice(0, 3).join(', ')}
- Key Features: ${input.features.slice(0, 3).join(', ')}
- Why This Post Matched: ${input.matched_signals.join(', ')}

POST:
Title: ${input.post_title}
Subreddit: ${input.subreddit ? 'r/' + input.subreddit : 'N/A'}
Body: ${(input.post_body || '').slice(0, 1000)}

STRICT RULES:
1. Start with empathy — acknowledge their specific pain or question (1-2 sentences)
2. Add genuine insight or perspective that helps them, independent of the product (2-3 sentences)
3. Introduce the product naturally — like a peer sharing what worked for them (1-2 sentences)
4. Max 200 words total
5. NEVER say: "I work at", "full disclosure", "disclaimer", "check it out", "sign up"
6. NO bullet points, NO headers, NO exclamation marks
7. Sound like a thoughtful Reddit user, not a marketer

Also write a DM version (max 80 words) — slightly more direct but still human.

Return ONLY valid JSON:
{
  "reply_text": "...",
  "dm_text": "...",
  "spam_risk": "LOW",
  "natural_tone_score": 85,
  "promotion_level": "SUBTLE",
  "confidence_score": 88
}`;

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  const result = await model.generateContent(prompt);
  const rawText = result.response.text().trim();
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]+?)\s*```/) || [null, rawText];
  const jsonText = jsonMatch[1] || rawText;

  return JSON.parse(jsonText) as GeneratedReply;
}

// ─── AI Lead Reranking ────────────────────────────────────────────────────────

export interface RerankResult {
  post_index: number;
  intent_confidence: number;
  refined_reason: string;
}

export interface RerankContext {
  product_name: string;
  target_customer: string;
  pain_points: string[];
  features: string[];
  keywords: string[];
  competitors: string[];
  buyer_intent_phrases: string[];
}

export async function rerankLeads(
  candidates: Array<{ title: string; body: string | null; subreddit: string | null }>,
  context: RerankContext
): Promise<RerankResult[]> {
  const postList = candidates
    .map((p, i) => {
      const body = (p.body || '').slice(0, 300).replace(/\n+/g, ' ');
      return `[${i}] r/${p.subreddit || 'unknown'}\nTitle: ${p.title}\n${body ? `Body: ${body}` : '(no body)'}`;
    })
    .join('\n\n');

  const prompt = `You are a B2B sales intelligence system. Evaluate Reddit posts for genuine buyer intent.

PRODUCT CONTEXT:
- Product: ${context.product_name}
- Target Customer: ${context.target_customer}
- Problems We Solve: ${context.pain_points.slice(0, 4).join('; ')}
- Key Features: ${context.features.slice(0, 3).join('; ')}
- Keywords: ${context.keywords.slice(0, 6).join(', ')}
- Competitors: ${context.competitors.slice(0, 4).join(', ')}
- Buyer Phrases: ${context.buyer_intent_phrases.slice(0, 4).join('; ')}

REDDIT POSTS TO EVALUATE:
${postList}

TASK:
Rerank these ${candidates.length} posts by genuine buyer intent for the product above.

Scoring guide:
- 70–100: actively seeking a solution, comparing tools, frustrated with a competitor, or has a clear buying signal
- 40–69: relevant problem or pain but not in active buying mode
- 0–39: general discussion, news, tutorial, or unrelated

Set confidence to 0 for any post that is:
- A news article, announcement, or general tech discussion
- A tutorial, tip, or how-to with no buying signal
- Completely unrelated to the product context

Return ONLY a valid JSON array — no markdown, no explanation, no trailing text:
[
  { "post_index": 0, "intent_confidence": 85, "refined_reason": "Actively comparing CRM tools, mentioned switching from a competitor and tight deadline" },
  { "post_index": 1, "intent_confidence": 42, "refined_reason": "Relevant pain point but seeking general advice, not evaluating tools" }
]

Include ALL ${candidates.length} posts. Order by intent_confidence descending.`;

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  const result = await model.generateContent(prompt);
  const rawText = result.response.text().trim();

  // Extract the JSON array — be tolerant of extra prose around it
  const jsonMatch = rawText.match(/\[[\s\S]+\]/);
  if (!jsonMatch) throw new Error('No JSON array in Gemini rerank response');

  return JSON.parse(jsonMatch[0]) as RerankResult[];
}

// ─────────────────────────────────────────────────────────────────────────────

export async function crawlWebsite(url: string): Promise<string> {
  // Primary: Jina AI reader — handles JS-rendered sites, Cloudflare, and bot protection.
  // Free with no API key. Returns clean readable text.
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'text',
        'X-Timeout': '15',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (response.ok) {
      const text = await response.text();
      if (text && text.length > 200) {
        return text.slice(0, 12000);
      }
    }
  } catch {
    // Fall through to direct fetch
  }

  // Fallback: direct HTML fetch + strip tags
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
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
