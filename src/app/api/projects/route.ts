import { NextRequest, NextResponse } from 'next/server';
import { createServerClientInstance } from '@/lib/supabase.server';

// GET /api/projects — list projects for current user (workspace_id optional)
export async function GET(req: NextRequest) {
  const supabase = await createServerClientInstance();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspaceId = req.nextUrl.searchParams.get('workspace_id');

  let query = supabase
    .from('projects')
    .select('*, website_profiles(*)')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  // Scope to workspace if provided, otherwise RLS handles user scoping
  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data });
}

// POST /api/projects — create a new project
export async function POST(req: NextRequest) {
  const supabase = await createServerClientInstance();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, website_url, workspace_id } = body;

  if (!name || !website_url || !workspace_id) {
    return NextResponse.json({ error: 'name, website_url, workspace_id required' }, { status: 400 });
  }

  // Check free plan project limit
  const { count } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspace_id)
    .eq('is_active', true);

  const { data: ws } = await supabase
    .from('workspaces')
    .select('plan')
    .eq('id', workspace_id)
    .single();

  const limit = ws?.plan === 'pro' ? 5 : ws?.plan === 'enterprise' ? 999 : 1;
  if ((count ?? 0) >= limit) {
    return NextResponse.json(
      { error: `Free plan allows ${limit} project. Upgrade to Pro for more.`, upgrade: true },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({ name, website_url, workspace_id, user_id: user.id, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data });
}
