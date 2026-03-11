import { NextRequest, NextResponse } from 'next/server';
import { createServerClientInstance } from '@/lib/supabase';

// PATCH /api/leads/status — update lead status and log action
export async function PATCH(req: NextRequest) {
  const supabase = await createServerClientInstance();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { lead_id, status, workspace_id, notes } = body;

  if (!lead_id || !status) {
    return NextResponse.json({ error: 'lead_id and status required' }, { status: 400 });
  }

  // Resolve workspace_id if not provided
  let wsId = workspace_id;
  if (!wsId) {
    const { data } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();
    wsId = data?.workspace_id;
  }

  if (!wsId) return NextResponse.json({ error: 'No workspace found' }, { status: 400 });

  // Upsert lead status
  const { error: statusError } = await supabase
    .from('lead_statuses')
    .upsert(
      { lead_id, workspace_id: wsId, user_id: user.id, status, notes, updated_at: new Date().toISOString() },
      { onConflict: 'lead_id,workspace_id' }
    );

  if (statusError) return NextResponse.json({ error: statusError.message }, { status: 500 });

  // Log action
  await supabase.from('lead_actions').insert({
    lead_id,
    user_id: user.id,
    workspace_id: wsId,
    action: status,
    metadata: notes ? { notes } : {},
  });

  return NextResponse.json({ success: true });
}
