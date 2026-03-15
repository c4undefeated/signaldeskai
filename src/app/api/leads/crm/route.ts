import { NextRequest, NextResponse } from 'next/server';
import { createServerClientInstance } from '@/lib/supabase.server';

// ── Helper: resolve workspace for the authenticated user ──────────────────────
async function resolveWorkspace(supabase: Awaited<ReturnType<typeof createServerClientInstance>>, userId: string) {
  const { data } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .single();
  return data?.workspace_id ?? null;
}

// ── GET /api/leads/crm?lead_id=xxx ────────────────────────────────────────────
// Returns current notes + full action history for the lead.
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClientInstance();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const leadId = req.nextUrl.searchParams.get('lead_id');
    if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });

    const wsId = await resolveWorkspace(supabase, user.id);

    // Fetch current notes from lead_statuses
    const { data: statusRow } = await supabase
      .from('lead_statuses')
      .select('notes')
      .eq('lead_id', leadId)
      .eq('workspace_id', wsId)
      .maybeSingle();

    // Fetch action history ordered chronologically
    const { data: actions } = await supabase
      .from('lead_actions')
      .select('id, action, metadata, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });

    const history = (actions ?? []).map((a) => ({
      id: a.id,
      action: a.action,
      notes: (a.metadata as Record<string, unknown>)?.notes as string | null ?? null,
      created_at: a.created_at,
    }));

    return NextResponse.json({
      notes: statusRow?.notes ?? null,
      history,
    });
  } catch (error) {
    console.error('CRM GET error:', error);
    return NextResponse.json({ error: 'Failed to load CRM data' }, { status: 500 });
  }
}

// ── PATCH /api/leads/crm — update notes without changing status ───────────────
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createServerClientInstance();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json() as { lead_id?: string; notes?: string };
    const { lead_id, notes } = body;

    if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });

    const wsId = await resolveWorkspace(supabase, user.id);
    if (!wsId) return NextResponse.json({ error: 'No workspace found' }, { status: 400 });

    // Update only the notes column; preserve existing status
    const { error } = await supabase
      .from('lead_statuses')
      .upsert(
        {
          lead_id,
          workspace_id: wsId,
          user_id: user.id,
          notes: notes ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'lead_id,workspace_id', ignoreDuplicates: false }
      );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('CRM PATCH error:', error);
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 });
  }
}
