import { NextRequest, NextResponse } from 'next/server';
import { createServerClientInstance } from '@/lib/supabase.server';
import type { SupabaseClient } from '@supabase/supabase-js';

// GET /api/notifications — fetch notifications for the current user + their workspace
export async function GET(req: NextRequest) {
  const supabase = await createServerClientInstance();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 100);
  const workspaceIds = await getWorkspaceIds(supabase, user.id);

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .or(`user_id.eq.${user.id},workspace_id.in.(${workspaceIds})`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const notifications = data || [];
  const unread_count = notifications.filter((n) => !n.read).length;

  return NextResponse.json({ notifications, unread_count });
}

// PATCH /api/notifications — mark one or all notifications as read
export async function PATCH(req: NextRequest) {
  const supabase = await createServerClientInstance();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id, mark_all_read } = body;

  if (mark_all_read) {
    const workspaceIds = await getWorkspaceIds(supabase, user.id);
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .or(`user_id.eq.${user.id},workspace_id.in.(${workspaceIds})`)
      .eq('read', false);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (!id) return NextResponse.json({ error: 'id or mark_all_read required' }, { status: 400 });

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

async function getWorkspaceIds(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId);

  if (!data || data.length === 0) return '00000000-0000-0000-0000-000000000000';
  return data.map((m: { workspace_id: string }) => m.workspace_id).join(',');
}
