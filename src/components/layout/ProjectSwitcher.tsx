'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Loader2, Plus } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { extractDomain } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Project, WebsiteProfile } from '@/types';

type ProjectWithProfile = Project & { website_profiles?: WebsiteProfile[] };

function ProjectAvatar({ name }: { name: string }) {
  const letter = name.charAt(0).toUpperCase();
  return (
    <div className="w-6 h-6 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-md flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold select-none">
      {letter}
    </div>
  );
}

export function ProjectSwitcher() {
  const router = useRouter();
  const {
    activeProject,
    workspaceId,
    setActiveProject,
    setWebsiteProfile,
    setLeads,
  } = useAppStore();

  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectWithProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // Fetch projects when dropdown opens
  useEffect(() => {
    if (!open || !workspaceId) return;

    const fetchProjects = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects?workspace_id=${workspaceId}`);
        const data = await res.json();
        setProjects(data.projects ?? []);
      } catch {
        // silently fail — user sees the current project only
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [open, workspaceId]);

  const handleSelect = (project: ProjectWithProfile) => {
    if (project.id === activeProject?.id) {
      setOpen(false);
      return;
    }

    // 1. Update active project
    setActiveProject(project);

    // 2. Load the corresponding website profile
    const profiles = project.website_profiles;
    const profile: WebsiteProfile | null =
      Array.isArray(profiles) && profiles.length > 0 ? profiles[0] : null;
    setWebsiteProfile(profile);

    // 3. Clear cached leads — leads/page.tsx useEffect will re-fetch
    setLeads([]);

    setOpen(false);
  };

  const handleNewProject = () => {
    setOpen(false);
    router.push('/onboarding');
  };

  return (
    <div ref={ref} className="relative px-3 py-3 border-b border-zinc-800/50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-800/60 transition-colors"
      >
        <ProjectAvatar name={activeProject?.name || '?'} />
        <div className="flex-1 text-left min-w-0">
          <p className="text-xs font-medium text-zinc-200 truncate">
            {activeProject?.name || 'Select Project'}
          </p>
          {activeProject && (
            <p className="text-[10px] text-zinc-500 truncate">
              {extractDomain(activeProject.website_url)}
            </p>
          )}
        </div>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-zinc-500 flex-shrink-0 transition-transform duration-150',
            open && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-3 right-3 mt-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl shadow-zinc-950/60 overflow-hidden z-50">
          {/* Current project header */}
          {activeProject && (
            <>
              <div className="px-3 pt-2.5 pb-1">
                <p className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
                  Current Project
                </p>
              </div>
              <div className="px-1 pb-1">
                <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                  <ProjectAvatar name={activeProject.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-violet-300 truncate">
                      {activeProject.name}
                    </p>
                    <p className="text-[10px] text-zinc-500 truncate">
                      {extractDomain(activeProject.website_url)}
                    </p>
                  </div>
                  <Check className="h-3.5 w-3.5 text-violet-400 flex-shrink-0" />
                </div>
              </div>
            </>
          )}

          {/* Divider + project list */}
          {loading ? (
            <div className="flex items-center justify-center py-5">
              <Loader2 className="h-4 w-4 text-zinc-600 animate-spin" />
            </div>
          ) : (
            <>
              {projects.filter((p) => p.id !== activeProject?.id).length > 0 && (
                <>
                  <div className="h-px bg-zinc-800 mx-3" />
                  <div className="px-1 py-1">
                    {projects
                      .filter((p) => p.id !== activeProject?.id)
                      .map((project) => (
                        <button
                          key={project.id}
                          onClick={() => handleSelect(project)}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-zinc-800 transition-colors"
                        >
                          <ProjectAvatar name={project.name} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-zinc-300 truncate">
                              {project.name}
                            </p>
                            <p className="text-[10px] text-zinc-500 truncate">
                              {extractDomain(project.website_url)}
                            </p>
                          </div>
                        </button>
                      ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* New project */}
          <div className="h-px bg-zinc-800 mx-3" />
          <div className="px-1 py-1">
            <button
              onClick={handleNewProject}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <div className="w-6 h-6 rounded-md border border-dashed border-zinc-700 flex items-center justify-center flex-shrink-0">
                <Plus className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs">New Project</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
