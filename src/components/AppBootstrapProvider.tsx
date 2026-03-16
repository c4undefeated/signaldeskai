'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Radio } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import type { Project, WebsiteProfile } from '@/types';

type ProjectWithProfile = Project & { website_profiles?: WebsiteProfile[] };

export function AppBootstrapProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const {
    setUser,
    workspaceId,
    setWorkspaceId,
    setPlan,
    activeProject,
    setActiveProject,
    setWebsiteProfile,
    setUnreadCount,
    reset,
    isInitialized,
    setInitialized,
  } = useAppStore();

  useEffect(() => {
    const supabase = createClient();

    const bootstrap = async () => {
      // 1. Verify auth session
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/auth');
        return;
      }

      setUser(user.id, user.email ?? null);

      // 2. Load workspace (use cached value if available)
      let resolvedWorkspaceId = workspaceId;
      if (!resolvedWorkspaceId) {
        const wsRes = await fetch('/api/workspace', { method: 'POST' });
        const wsData = await wsRes.json();
        if (wsData.workspace?.id) {
          resolvedWorkspaceId = wsData.workspace.id;
          setWorkspaceId(wsData.workspace.id);
          if (wsData.workspace.plan) {
            setPlan(wsData.workspace.plan as 'free' | 'pro' | 'enterprise');
          }
        }
      }

      if (!resolvedWorkspaceId) {
        setInitialized();
        return;
      }

      // 3. Restore active project (use cached value if available)
      if (!activeProject) {
        // Query by workspace_id if available; fall back to all user projects (RLS scoped)
        const projectsUrl = resolvedWorkspaceId
          ? `/api/projects?workspace_id=${resolvedWorkspaceId}`
          : '/api/projects';
        const projRes = await fetch(projectsUrl);
        if (projRes.status === 401) {
          router.replace('/auth');
          return;
        }
        const projData = await projRes.json();
        let projects: ProjectWithProfile[] = projData.projects ?? [];

        // If workspace-scoped query found nothing, retry without workspace filter
        // (handles workspace ID mismatch from stale state)
        if (projects.length === 0 && resolvedWorkspaceId) {
          const fallbackRes = await fetch('/api/projects');
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            projects = fallbackData.projects ?? [];
          }
        }

        if (projects.length === 0) {
          setInitialized();
          router.replace('/onboarding');
          return;
        }

        const project = projects[0];
        setActiveProject(project);

        // 4. Restore website profile from joined data
        const profiles = project.website_profiles;
        const profile: WebsiteProfile | null =
          Array.isArray(profiles) && profiles.length > 0 ? profiles[0] : null;

        if (profile) {
          setWebsiteProfile(profile);
        } else if (project.website_url) {
          // Profile missing from DB (e.g. created before profile-persist was fixed).
          // Re-analyze silently in the background so leads can work immediately.
          fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: project.website_url, project_id: project.id }),
          })
            .then((r) => r.json())
            .then((d) => {
              if (d.success && d.analysis) {
                const rebuilt: WebsiteProfile = {
                  id: `profile_${project.id}`,
                  project_id: project.id,
                  product_name: d.analysis.product_name,
                  category: d.analysis.category,
                  target_customer: d.analysis.target_customer,
                  pain_points: d.analysis.pain_points ?? [],
                  features: d.analysis.features ?? [],
                  keywords: d.analysis.keywords ?? [],
                  buyer_intent_phrases: d.analysis.buyer_intent_phrases ?? [],
                  competitors: d.analysis.competitors ?? [],
                  industry: d.analysis.industry,
                  pricing_signals: d.analysis.pricing_signals,
                  raw_analysis: d.analysis,
                  crawled_pages: [],
                  analyzed_at: new Date().toISOString(),
                  created_at: new Date().toISOString(),
                };
                setWebsiteProfile(rebuilt);
              }
            })
            .catch(() => {}); // non-critical
        }
      }

      // 5. Load unread notification count (non-critical)
      try {
        const notifRes = await fetch('/api/notifications?limit=1');
        if (notifRes.ok) {
          const notifData = await notifRes.json();
          setUnreadCount(notifData.unread_count ?? 0);
        }
      } catch {
        // non-critical — ignore
      }

      setInitialized();
    };

    bootstrap();

    // Listen for auth state changes across the dashboard
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          reset();
          router.replace('/auth');
        }
        // SIGNED_IN fires immediately on subscription with the current session —
        // skip it here because bootstrap() already handles the initial load above.
        // Only react to TOKEN_REFRESHED to keep server-side cookies fresh.
      }
    );

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-violet-500/20 animate-ping" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 bg-violet-600/20 border border-violet-500/40 rounded-full flex items-center justify-center">
                <Radio className="h-4 w-4 text-violet-400 animate-pulse" />
              </div>
            </div>
          </div>
          <p className="text-sm text-zinc-500">Loading SignalDesk...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
