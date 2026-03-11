'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setWorkspaceId, reset } = useAppStore();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Sync initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser(user.id, user.email ?? null);
        loadWorkspace(user.id);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user.id, session.user.email ?? null);
          await loadWorkspace(session.user.id);
          router.refresh();
        } else if (event === 'SIGNED_OUT') {
          reset();
          router.push('/auth');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function loadWorkspace(userId: string) {
    const { data } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces(plan)')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (data?.workspace_id) {
      setWorkspaceId(data.workspace_id);
      const ws = data.workspaces as { plan: string } | null;
      if (ws?.plan) {
        useAppStore.getState().setPlan(ws.plan as 'free' | 'pro' | 'enterprise');
      }
    }
  }

  return <>{children}</>;
}
