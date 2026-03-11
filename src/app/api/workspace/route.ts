import { NextRequest, NextResponse } from 'next/server';
import { createServerClientInstance } from '@/lib/supabase';

// GET /api/workspace?id=xxx — fetch workspace plan/details
export async function GET(req: NextRequest) {
  const supabase = await createServerClientInstance();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, plan, slug')
    .eq('id', id)
    .single();

  if (!workspace) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(workspace);
}

// POST /api/workspace — ensure workspace exists for user, create if needed
export async function POST(req: NextRequest) {
  const supabase = await createServerClientInstance();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check if already in a workspace
  const { data: existing } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(id, name, plan, slug)')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (existing?.workspace_id) {
    return NextResponse.json({ workspace: existing.workspaces });
  }

  // Create workspace
  const name = (user.email?.split('@')[0] || 'My Workspace');
  const slug = `${name}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .insert({ name, slug })
    .select()
    .single();

  if (wsError || !workspace) {
    return NextResponse.json({ error: wsError?.message || 'Failed to create workspace' }, { status: 500 });
  }

  await supabase.from('workspace_members').insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: 'owner',
    accepted_at: new Date().toISOString(),
  });

  return NextResponse.json({ workspace });
}
