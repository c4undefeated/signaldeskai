import { NextRequest, NextResponse } from 'next/server';
import { createServerClientInstance, createServiceClient } from '@/lib/supabase';

// POST /api/digest — generate and send daily digest for a workspace
// Called by Vercel cron or Supabase pg_cron
export async function POST(req: NextRequest) {
  try {
    // Allow both authenticated and cron-key calls
    const authHeader = req.headers.get('authorization');
    const cronKey = process.env.CRON_SECRET;
    const isCron = cronKey && authHeader === `Bearer ${cronKey}`;

    let workspaceId: string | null = null;

    if (isCron) {
      // Cron mode: process all workspaces that have digest enabled
      const serviceClient = createServiceClient();
      const { data: workspaces } = await serviceClient
        .from('workspaces')
        .select('id')
        .eq('digest_enabled', true);

      if (workspaces && workspaces.length > 0) {
        const results = await Promise.allSettled(
          workspaces.map((ws) => sendDigestForWorkspace(ws.id))
        );
        const sent = results.filter((r) => r.status === 'fulfilled').length;
        return NextResponse.json({ success: true, sent, total: workspaces.length });
      }
      return NextResponse.json({ success: true, sent: 0, total: 0 });
    }

    // Authenticated single-workspace mode
    const supabase = await createServerClientInstance();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    workspaceId = body.workspace_id;

    if (!workspaceId) {
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single();
      workspaceId = membership?.workspace_id ?? null;
    }

    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 });
    }

    const result = await sendDigestForWorkspace(workspaceId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Digest error:', error);
    return NextResponse.json({ error: 'Digest failed' }, { status: 500 });
  }
}

async function sendDigestForWorkspace(workspaceId: string) {
  const serviceClient = createServiceClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Get workspace + owner email
  const { data: workspace } = await serviceClient
    .from('workspaces')
    .select('id, name, plan')
    .eq('id', workspaceId)
    .single();

  if (!workspace) return { success: false, error: 'Workspace not found' };

  const { data: member } = await serviceClient
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('role', 'owner')
    .single();

  if (!member) return { success: false, error: 'No owner found' };

  // Get owner email from auth.users (service role required)
  const { data: authUser } = await serviceClient.auth.admin.getUserById(member.user_id);
  const ownerEmail = authUser?.user?.email;
  if (!ownerEmail) return { success: false, error: 'No owner email' };

  // Get all projects for this workspace
  const { data: projects } = await serviceClient
    .from('projects')
    .select('id, name')
    .eq('workspace_id', workspaceId);

  if (!projects || projects.length === 0) {
    return { success: false, error: 'No projects' };
  }

  const projectIds = projects.map((p) => p.id);

  // Get top leads from last 24h
  const { data: leads } = await serviceClient
    .from('leads')
    .select(`
      id, title, url, subreddit, author, upvotes, comment_count, posted_at, project_id,
      lead_scores(final_score, intent_score, match_reasons)
    `)
    .in('project_id', projectIds)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(100);

  // Filter & sort by final_score
  const topLeads = (leads || [])
    .map((lead) => {
      const score = Array.isArray(lead.lead_scores)
        ? lead.lead_scores[0]
        : lead.lead_scores;
      return { ...lead, finalScore: (score as any)?.final_score ?? 0, score };
    })
    .filter((l) => l.finalScore >= 50)
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 10);

  const highIntent = topLeads.filter((l) => l.finalScore >= 80).length;

  // Store digest record
  const { data: digest } = await serviceClient
    .from('digests')
    .insert({
      workspace_id: workspaceId,
      period: new Date().toISOString().split('T')[0],
      leads_count: topLeads.length,
      high_intent_count: highIntent,
      sent_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  // Create in-app notification
  await serviceClient.from('notifications').insert({
    workspace_id: workspaceId,
    type: 'digest',
    title: 'Daily Digest Ready',
    message: `${topLeads.length} new leads discovered today. ${highIntent} with intent score above 80.`,
    read: false,
  });

  // Send email via Resend
  const emailSent = await sendDigestEmail({
    to: ownerEmail,
    workspaceName: workspace.name,
    leads: topLeads,
    period: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    highIntent,
  });

  return {
    success: true,
    digest_id: digest?.id,
    leads_count: topLeads.length,
    high_intent_count: highIntent,
    email_sent: emailSent,
  };
}

async function sendDigestEmail({
  to,
  workspaceName,
  leads,
  period,
  highIntent,
}: {
  to: string;
  workspaceName: string;
  leads: any[];
  period: string;
  highIntent: number;
}) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return false;

  const leadsHtml = leads
    .map(
      (lead) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #27272a">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="display:inline-block;background:#18181b;border:1px solid #3f3f46;border-radius:4px;padding:2px 8px;font-size:11px;color:#a1a1aa">
              ${lead.finalScore}
            </span>
            <span style="font-size:11px;color:#71717a">r/${lead.subreddit || 'reddit'}</span>
          </div>
          <a href="${lead.url}" style="color:#a78bfa;text-decoration:none;font-size:13px;font-weight:500;display:block;margin-bottom:4px">
            ${lead.title}
          </a>
          ${
            lead.score?.match_reasons?.length
              ? `<p style="color:#71717a;font-size:11px;margin:0">${(lead.score.match_reasons as string[]).slice(0, 2).join(' · ')}</p>`
              : ''
          }
        </td>
      </tr>`
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#09090b;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <div style="margin-bottom:24px">
      <p style="color:#71717a;font-size:12px;margin:0 0 8px">SignalDesk AI · ${period}</p>
      <h1 style="font-size:20px;font-weight:600;margin:0;color:#fafafa">Daily Lead Digest</h1>
      <p style="color:#a1a1aa;font-size:14px;margin:8px 0 0">${workspaceName}</p>
    </div>

    <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;margin-bottom:24px;display:flex;gap:24px">
      <div style="text-align:center">
        <p style="font-size:28px;font-weight:700;margin:0;color:#fafafa">${leads.length}</p>
        <p style="font-size:12px;color:#71717a;margin:4px 0 0">New Leads</p>
      </div>
      <div style="width:1px;background:#27272a"></div>
      <div style="text-align:center">
        <p style="font-size:28px;font-weight:700;margin:0;color:#34d399">${highIntent}</p>
        <p style="font-size:12px;color:#71717a;margin:4px 0 0">High Intent (80+)</p>
      </div>
    </div>

    ${
      leads.length > 0
        ? `
    <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;margin-bottom:24px">
      <h2 style="font-size:13px;font-weight:600;color:#a1a1aa;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em">Top Leads</h2>
      <table style="width:100%;border-collapse:collapse">
        <tbody>${leadsHtml}</tbody>
      </table>
    </div>`
        : `<div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:32px;text-align:center;margin-bottom:24px">
      <p style="color:#71717a;font-size:14px;margin:0">No leads scored above 50 in the last 24 hours.</p>
    </div>`
    }

    <div style="text-align:center;margin-bottom:24px">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://signaldesk.ai'}/leads"
         style="display:inline-block;background:#7c3aed;color:#fafafa;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500">
        View All Leads →
      </a>
    </div>

    <p style="color:#3f3f46;font-size:11px;text-align:center;margin:0">
      SignalDesk AI · You're receiving this because digest emails are enabled for ${workspaceName}.
    </p>
  </div>
</body>
</html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SignalDesk AI <digest@signaldesk.ai>',
        to: [to],
        subject: `Your Daily Digest: ${leads.length} new leads${highIntent > 0 ? `, ${highIntent} high-intent` : ''}`,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
