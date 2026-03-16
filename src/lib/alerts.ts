// ============================================================
// SignalDesk AI – Alert Detection & Multi-Channel Delivery
// ============================================================
//
// A lead qualifies as a "strong opportunity" when ALL three
// conditions are true:
//   1. intent_score  > 85   — very high buying intent
//   2. freshness_score > 70 — posted recently (< 72 hours)
//   3. comment_count < 3    — barely any replies yet (be first)
//
// Delivery channels: in_app · email · slack (stubbed for future)
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AlertLead {
  id: string;
  title: string | null;
  url: string;
  subreddit: string | null;
  author: string | null;
  comment_count: number;
  posted_at: string | null;
  source: string;
  project_id: string;
}

export interface AlertScore {
  intent_score: number;
  freshness_score: number;
  final_score: number;
  match_reasons: string[];
  signals: {
    buying_signals: string[];
    pain_signals: string[];
    competitor_signals: string[];
  };
}

// ── Detection ─────────────────────────────────────────────────────────────────

/**
 * Returns true when a newly discovered lead meets all three strong-opportunity
 * criteria. Called before checking the user's configured threshold so that
 * threshold acts as an additional gate, not a replacement.
 */
export function shouldTriggerAlert(score: AlertScore, commentCount: number): boolean {
  return (
    score.intent_score > 85 &&
    score.freshness_score > 70 &&
    commentCount < 3
  );
}

// ── Delivery orchestrator ─────────────────────────────────────────────────────

/**
 * For each active high_intent alert config on the project, find qualifying
 * leads, deliver across all configured channels, and write an audit row to
 * alert_events.
 *
 * Returns the total number of lead-alert pairs fired.
 */
export async function fireAlerts(
  db: SupabaseClient,
  newLeads: AlertLead[],
  scoreMap: Map<string, AlertScore>,
  projectId: string,
  workspaceId: string,
): Promise<number> {
  if (!newLeads.length) return 0;

  const { data: alertConfigs } = await db
    .from('alerts')
    .select('user_id, threshold, delivery, config')
    .eq('project_id', projectId)
    .eq('alert_type', 'high_intent')
    .eq('is_active', true);

  if (!alertConfigs?.length) return 0;

  let totalFired = 0;

  for (const config of alertConfigs) {
    const threshold: number = config.threshold ?? 70;
    const delivery: string[] = config.delivery ?? ['in_app'];

    // Leads must pass the three-condition gate AND the user's threshold
    const qualifying = newLeads.filter((lead) => {
      const score = scoreMap.get(lead.id);
      return (
        score !== undefined &&
        shouldTriggerAlert(score, lead.comment_count) &&
        score.final_score >= threshold
      );
    });

    if (!qualifying.length) continue;

    // Resolve owner email up front if email delivery is requested
    let ownerEmail: string | undefined;
    if (delivery.includes('email')) {
      try {
        const { data: authUser } = await db.auth.admin.getUserById(config.user_id);
        ownerEmail = authUser?.user?.email;
      } catch {
        // Non-critical — proceed with remaining channels
      }
    }

    // ── In-app notification ──────────────────────────────────────────────────
    if (delivery.includes('in_app')) {
      const lead0 = qualifying[0];
      const score0 = scoreMap.get(lead0.id);

      await db.from('notifications').insert({
        user_id: config.user_id,
        workspace_id: workspaceId,
        type: 'alert',
        title:
          qualifying.length === 1
            ? 'High-intent lead spotted'
            : `${qualifying.length} high-intent leads spotted`,
        message:
          qualifying.length === 1
            ? `"${lead0.title ?? 'Untitled'}" scored ${score0?.final_score ?? '—'} — intent > 85, fresh, barely any replies.`
            : `${qualifying.length} leads scored intent > 85 with low engagement — perfect timing to respond.`,
        read: false,
        data: {
          lead_ids: qualifying.map((l) => l.id),
          project_id: projectId,
          alert_type: 'high_intent',
        },
      });
    }

    // ── Email notification ───────────────────────────────────────────────────
    if (delivery.includes('email') && ownerEmail) {
      await sendHighIntentEmail(ownerEmail, qualifying, scoreMap);
    }

    // ── Slack (future) ───────────────────────────────────────────────────────
    if (delivery.includes('slack')) {
      // TODO: POST to the Slack webhook stored in alerts.config.slack_webhook_url
      // Shape: { text, attachments: [{ title, title_link, fields }] }
      const webhookUrl = (config.config as Record<string, unknown>)?.slack_webhook_url;
      console.log(
        `[Alerts] Slack delivery not yet implemented.`,
        `Webhook configured: ${Boolean(webhookUrl)}.`,
        `${qualifying.length} lead(s) in project ${projectId} would be sent.`,
      );
    }

    // ── Audit log ────────────────────────────────────────────────────────────
    const auditRows = qualifying.map((lead) => {
      const score = scoreMap.get(lead.id)!;
      return {
        workspace_id: workspaceId,
        lead_id: lead.id,
        project_id: projectId,
        alert_type: 'high_intent' as const,
        delivery_channels: delivery,
        score_snapshot: {
          intent_score: score.intent_score,
          freshness_score: score.freshness_score,
          final_score: score.final_score,
        },
      };
    });

    await db.from('alert_events').insert(auditRows);

    totalFired += qualifying.length;
  }

  return totalFired;
}

// ── Email template ────────────────────────────────────────────────────────────

async function sendHighIntentEmail(
  to: string,
  leads: AlertLead[],
  scoreMap: Map<string, AlertScore>,
) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const leadsHtml = leads
    .map((lead) => {
      const score = scoreMap.get(lead.id);
      const reasons = score?.match_reasons?.slice(0, 2).join(' · ') ?? '';
      return `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #27272a">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="display:inline-block;background:#7c3aed;border-radius:4px;padding:2px 8px;font-size:11px;color:#fff;font-weight:600">
              ${score?.final_score ?? '—'}
            </span>
            <span style="display:inline-block;background:#18181b;border:1px solid #3f3f46;border-radius:4px;padding:2px 8px;font-size:11px;color:#a1a1aa">
              intent ${score?.intent_score ?? '—'}
            </span>
            ${lead.subreddit ? `<span style="font-size:11px;color:#71717a">r/${lead.subreddit}</span>` : ''}
          </div>
          <a href="${lead.url}" style="color:#a78bfa;text-decoration:none;font-size:13px;font-weight:500;display:block;margin-bottom:4px">
            ${lead.title ?? 'Untitled post'}
          </a>
          ${reasons ? `<p style="color:#71717a;font-size:11px;margin:0 0 4px">${reasons}</p>` : ''}
          <p style="color:#52525b;font-size:11px;margin:0">
            ${lead.comment_count} ${lead.comment_count === 1 ? 'reply' : 'replies'} · u/${lead.author ?? 'unknown'} · ${lead.source}
          </p>
        </td>
      </tr>`;
    })
    .join('');

  const subject =
    leads.length === 1
      ? `High-intent lead: "${(leads[0].title ?? 'Untitled').slice(0, 55)}"`
      : `${leads.length} high-intent leads ready to reply`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="background:#09090b;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">

    <div style="margin-bottom:24px">
      <p style="color:#71717a;font-size:12px;margin:0 0 8px">SignalDesk AI · Real-Time Alert</p>
      <h1 style="font-size:20px;font-weight:600;margin:0;color:#fafafa">
        High-Intent ${leads.length === 1 ? 'Lead' : 'Leads'} Detected
      </h1>
      <p style="color:#a1a1aa;font-size:14px;margin:8px 0 0">
        ${
          leads.length === 1
            ? 'Someone is actively looking for a solution right now — reply while the post is fresh.'
            : `${leads.length} people are actively looking for solutions. Be the first to respond.`
        }
      </p>
    </div>

    <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;margin-bottom:24px">
      <div style="display:flex;gap:24px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #27272a">
        <div style="text-align:center;flex:1">
          <p style="font-size:26px;font-weight:700;margin:0;color:#fafafa">${leads.length}</p>
          <p style="font-size:11px;color:#71717a;margin:4px 0 0">${leads.length === 1 ? 'Lead' : 'Leads'}</p>
        </div>
        <div style="width:1px;background:#27272a"></div>
        <div style="text-align:center;flex:1">
          <p style="font-size:26px;font-weight:700;margin:0;color:#34d399">85+</p>
          <p style="font-size:11px;color:#71717a;margin:4px 0 0">Intent Score</p>
        </div>
        <div style="width:1px;background:#27272a"></div>
        <div style="text-align:center;flex:1">
          <p style="font-size:26px;font-weight:700;margin:0;color:#f59e0b">&lt; 3</p>
          <p style="font-size:11px;color:#71717a;margin:4px 0 0">Replies</p>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse">
        <tbody>${leadsHtml}</tbody>
      </table>
    </div>

    <div style="text-align:center;margin-bottom:24px">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://signaldesk.ai'}/leads"
         style="display:inline-block;background:#7c3aed;color:#fafafa;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500">
        Reply Now →
      </a>
    </div>

    <p style="color:#3f3f46;font-size:11px;text-align:center;margin:0">
      SignalDesk AI · High-intent alerts are enabled for your project.
      <br>Manage alert preferences in your project settings.
    </p>
  </div>
</body></html>`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SignalDesk AI <alerts@signaldesk.ai>',
        to: [to],
        subject,
        html,
      }),
    });
  } catch (err) {
    console.error('[Alerts] Email send failed:', err);
  }
}
