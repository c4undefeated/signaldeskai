'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Radio } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import type { Project, WebsiteProfile } from '@/types';

type ProjectWithProfile = Project & { workspace_id?: string; website_profiles?: WebsiteProfile[] };

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

      // 2. Restore active project — query directly by user_id (most reliable path).
      // We go project-first and derive workspace from the found project. This avoids
      // the workspace-first approach which can fail silently and send users to onboarding
      // even when their project exists.
      if (!activeProject) {
        const projRes = await fetch('/api/projects');
        if (projRes.status === 401) {
          router.replace('/auth');
          return;
        }

        let projects: ProjectWithProfile[] = [];
        if (projRes.ok) {
          const projData = await projRes.json();
          projects = projData.projects ?? [];
        }

        if (projects.length === 0) {
          // No projects found — ensure workspace exists, then send to onboarding
          const wsRes = await fetch('/api/workspace', { method: 'POST' });
          if (wsRes.ok) {
            const wsData = await wsRes.json();
            if (wsData.workspace?.id) {
              setWorkspaceId(wsData.workspace.id);
              if (wsData.workspace.plan) {
                setPlan(wsData.workspace.plan as 'free' | 'pro' | 'enterprise');
              }
            }
          }
          setInitialized();
          router.replace('/onboarding');
          return;
        }

        const project = projects[0];
        setActiveProject(project);

        // 3. Derive workspace from the project (avoid a separate workspace round-trip
        //    if we already know the workspace_id from the project row)
        const projectWorkspaceId = project.workspace_id;
        if (projectWorkspaceId && !workspaceId) {
          setWorkspaceId(projectWorkspaceId);
          // Fetch plan details for the workspace
          const wsRes = await fetch(`/api/workspace?id=${projectWorkspaceId}`);
          if (wsRes.ok) {
            const wsData = await wsRes.json();
            if (wsData.plan) setPlan(wsData.plan as 'free' | 'pro' | 'enterprise');
          }
        } else if (!workspaceId) {
          // Project has no workspace_id — ensure one exists and associate it
          const wsRes = await fetch('/api/workspace', { method: 'POST' });
          if (wsRes.ok) {
            const wsData = await wsRes.json();
            if (wsData.workspace?.id) {
              setWorkspaceId(wsData.workspace.id);
              if (wsData.workspace.plan) {
                setPlan(wsData.workspace.plan as 'free' | 'pro' | 'enterprise');
              }
            }
          }
        }

        // 4. Restore website profile from joined data
        const profiles = project.website_profiles;
        const profile: WebsiteProfile | null =
          Array.isArray(profiles) && profiles.length > 0 ? profiles[0] : null;

        if (profile) {
          setWebsiteProfile(profile);
        } else if (project.website_url) {
          // Profile missing from DB — re-analyze silently in background
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
      } else if (!workspaceId) {
        // activeProject is cached but workspaceId got cleared — restore it
        const cachedWorkspaceId = (activeProject as ProjectWithProfile).workspace_id;
        if (cachedWorkspaceId) {
          setWorkspaceId(cachedWorkspaceId);
          const wsRes = await fetch(`/api/workspace?id=${cachedWorkspaceId}`);
          if (wsRes.ok) {
            const wsData = await wsRes.json();
            if (wsData.plan) setPlan(wsData.plan as 'free' | 'pro' | 'enterprise');
          }
        } else {
          const wsRes = await fetch('/api/workspace', { method: 'POST' });
          if (wsRes.ok) {
            const wsData = await wsRes.json();
            if (wsData.workspace?.id) {
              setWorkspaceId(wsData.workspace.id);
              if (wsData.workspace.plan) {
                setPlan(wsData.workspace.plan as 'free' | 'pro' | 'enterprise');
              }
            }
          }
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
      async (event) => {
        if (event === 'SIGNED_OUT') {
          reset();
          router.replace('/auth');
        }
        // SIGNED_IN fires immediately on subscription with the current session —
        // skip it here because bootstrap() already handles the initial load above.
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
