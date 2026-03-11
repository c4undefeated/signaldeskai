import { createServerClientInstance } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export async function getUser(): Promise<User | null> {
  try {
    const supabase = await createServerClientInstance();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) throw new Error('Unauthorized');
  return user;
}

// Ensure a workspace exists for the user. Called after sign-in.
export async function ensureWorkspace(userId: string, email: string) {
  const supabase = await createServerClientInstance();

  // Check if user already has a workspace
  const { data: existing } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (existing) return existing.workspace_id;

  // Create workspace
  const name = email.split('@')[0] || 'My Workspace';
  const slug = `${name}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .insert({ name, slug })
    .select('id')
    .single();

  if (wsError || !workspace) throw wsError;

  // Add user as owner
  await supabase.from('workspace_members').insert({
    workspace_id: workspace.id,
    user_id: userId,
    role: 'owner',
    accepted_at: new Date().toISOString(),
  });

  return workspace.id;
}
