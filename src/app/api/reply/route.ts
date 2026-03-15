import { NextRequest, NextResponse } from 'next/server';
import { generateReply } from '@/lib/ai';
import type { ToneVariant } from '@/lib/ai';
import { createServerClientInstance } from '@/lib/supabase.server';

// ── Safety validator ──────────────────────────────────────────────────────────

// Patterns that indicate hard promotional CTAs
const HARD_CTA_RE = /\b(click here|sign up\s*(now|today|free)?|try it free|get started\s*(today|now|free)?|join now|buy now|subscribe now|limited time|act now|don't miss out|claim (your|my) (free|deal|spot)|register now)\b/i;

// Affiliate / sponsored content signals
const AFFILIATE_RE = /\b(affiliate|sponsored|paid promotion|use (my |my affiliate )?code|use (this |my )?link|referral (link|code)|link in( my)? bio|exclusive deal|discount code|promo code|save \d+%|get \d+% off|best deal|partnered? with)\b/i;

// Superlative promotional adjectives — 3+ in one reply = over-promotion
const PROMO_SUPERLATIVES_RE = /\b(amazing|incredible|revolutionary|game.?changer|must.?have|must.?try|life.?changing|industry.?leading|state.?of.?the.?art|best.?in.?class|unbelievable|unmatched|unrivalled|powerful|perfect solution)\b/gi;

// Self-identification as the product creator
const SELF_ID_RE = /\b(i work at|i'm (from|at|on the team)|full disclosure|disclaimer|i (built|created|made|founded)|we built|our (product|tool|app|platform))\b/i;

function validateReply(text: string): { valid: boolean; flags: string[] } {
  const flags: string[] = [];

  if (SELF_ID_RE.test(text))
    flags.push('SELF_IDENTIFYING');

  if (HARD_CTA_RE.test(text))
    flags.push('HARD_CTA');

  if (AFFILIATE_RE.test(text))
    flags.push('AFFILIATE_WORDING');

  const superlativeCount = (text.match(PROMO_SUPERLATIVES_RE) || []).length;
  if (superlativeCount >= 3)
    flags.push('OVER_PROMOTING');

  // Sentence count guard — more than 10 sentences is almost certainly too long
  if (text.split(/[.!?]+/).filter(s => s.trim().length > 0).length > 10)
    flags.push('TOO_LONG');

  return { valid: flags.length === 0, flags };
}

// Escalating fallback tones — each retry uses a safer mode
const RETRY_TONE_ESCALATION: ToneVariant[] = ['less_salesy', 'no_product_mention'];

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClientInstance();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await req.json();
    const {
      post_title, post_body, subreddit,
      product_name, target_customer,
      pain_points = [], features = [], match_reasons = [],
      tone_variant = 'standard' as ToneVariant,
      lead_id, project_id,
    } = body as {
      post_title: string;
      post_body?: string;
      subreddit?: string;
      product_name: string;
      target_customer?: string;
      pain_points?: string[];
      features?: string[];
      match_reasons?: string[];
      tone_variant?: ToneVariant;
      lead_id?: string;
      project_id?: string;
    };

    if (!post_title || !product_name) {
      return NextResponse.json({ error: 'post_title and product_name are required' }, { status: 400 });
    }

    // ── Usage limit check ────────────────────────────────────
    if (user && project_id) {
      const { data: proj } = await supabase
        .from('projects')
        .select('workspace_id, workspaces(plan)')
        .eq('id', project_id)
        .single();

      const workspaces = proj?.workspaces as unknown as { plan: string } | null;
      const plan = workspaces?.plan || 'free';
      const dailyLimit = plan === 'pro' ? 50 : plan === 'enterprise' ? 999 : 5;
      const today = new Date().toISOString().split('T')[0];

      const { data: usage } = await supabase
        .from('usage_tracking')
        .select('replies_generated')
        .eq('workspace_id', proj?.workspace_id)
        .eq('period', today)
        .single();

      if ((usage?.replies_generated ?? 0) >= dailyLimit) {
        return NextResponse.json(
          { error: `Daily reply limit (${dailyLimit}) reached. Upgrade to Pro for more.`, upgrade: true },
          { status: 429 }
        );
      }
    }

    // ── Generate with retry on safety failure ────────────────
    // Each failed attempt escalates to a safer tone:
    //   attempt 1 → requested tone
    //   attempt 2 → less_salesy
    //   attempt 3 → no_product_mention (last resort)
    let reply: Awaited<ReturnType<typeof generateReply>> | null = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      const activeTone: ToneVariant =
        attempts === 0
          ? tone_variant
          : RETRY_TONE_ESCALATION[Math.min(attempts - 1, RETRY_TONE_ESCALATION.length - 1)];

      attempts++;
      const generated = await generateReply({
        post_title,
        post_body: post_body || '',
        subreddit,
        product_name,
        target_customer: target_customer || '',
        pain_points,
        features,
        matched_signals: match_reasons,
        tone_variant: activeTone,
      });

      const { valid, flags } = validateReply(generated.reply_text);

      if (valid || attempts === maxAttempts) {
        reply = {
          ...generated,
          // Surface accurate risk level based on what the validator caught
          spam_risk:
            flags.includes('HARD_CTA') || flags.includes('AFFILIATE_WORDING') ? 'HIGH'
            : flags.includes('OVER_PROMOTING') ? 'MEDIUM'
            : generated.spam_risk,
        };
        break;
      }
      // Safety check failed — retry with escalated tone
    }

    if (!reply) {
      return NextResponse.json({ error: 'Failed to generate a safe reply. Please try again.' }, { status: 500 });
    }

    const suggestion = {
      ...reply,
      id: `reply_${Date.now()}`,
      tone_variant,
      generated_at: new Date().toISOString(),
    };

    // ── Persist reply to DB ──────────────────────────────────
    if (user && lead_id && project_id) {
      await supabase.from('reply_suggestions').insert({
        lead_id,
        project_id,
        generated_by: user.id,
        reply_text: reply.reply_text,
        dm_text: reply.dm_text,
        tone_variant,
        spam_risk: reply.spam_risk,
        natural_tone_score: reply.natural_tone_score,
        promotion_level: reply.promotion_level,
        confidence_score: reply.confidence_score,
        model_used: 'gemini-2.5-flash-lite',
        prompt_version: 'v3',
      });

      // Track usage
      const { data: proj } = await supabase
        .from('projects')
        .select('workspace_id')
        .eq('id', project_id)
        .single();

      if (proj?.workspace_id) {
        const today = new Date().toISOString().split('T')[0];
        await supabase.rpc('increment_usage', {
          p_workspace_id: proj.workspace_id,
          p_period: today,
          p_replies: 1,
        });
      }
    }

    return NextResponse.json({ success: true, reply: suggestion });
  } catch (error) {
    console.error('Reply generation error:', error);
    return NextResponse.json({ error: 'Failed to generate reply. Please try again.' }, { status: 500 });
  }
}
