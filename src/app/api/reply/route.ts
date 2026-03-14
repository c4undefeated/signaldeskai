import { NextRequest, NextResponse } from 'next/server';
import { generateReply } from '@/lib/ai';
import { createServerClientInstance } from '@/lib/supabase.server';

type ToneVariant = 'standard' | 'less_salesy' | 'more_helpful' | 'direct';

// Safety post-processor
function validateReply(text: string): { valid: boolean; flags: string[] } {
  const flags: string[] = [];
  if (/i work at|full disclosure|disclaimer/i.test(text))             flags.push('SELF_IDENTIFYING');
  if (/click here|sign up now|try it free|get started today/i.test(text)) flags.push('HARD_CTA');
  if (text.split(/[.!?]/).length > 10)                                flags.push('TOO_LONG');
  const promotionWords = (text.match(/\b(product|solution|tool|platform|software|app)\b/gi) || []).length;
  if (promotionWords > 4)                                             flags.push('OVER_PROMOTING');
  return { valid: flags.length === 0, flags };
}

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
    } = body;

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
    let reply: Awaited<ReturnType<typeof generateReply>> | null = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
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
        tone_variant,
      });

      const { valid, flags } = validateReply(generated.reply_text);

      if (valid || attempts === maxAttempts) {
        // On last attempt accept whatever we have
        reply = {
          ...generated,
          // Downgrade risk if flags found on last attempt
          spam_risk: flags.includes('HARD_CTA') ? 'HIGH' : flags.includes('OVER_PROMOTING') ? 'MEDIUM' : generated.spam_risk,
        };
        break;
      }
      // Else retry with stricter tone
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
        model_used: 'claude-opus-4-6',
        prompt_version: 'v2',
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
