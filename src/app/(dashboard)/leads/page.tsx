'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Radio,
  TrendingUp,
  Zap,
  AlertCircle,
  ArrowRight,
  Activity,
  CreditCard,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { LeadCard } from '@/components/dashboard/LeadCard';
import { LeadFilterBar } from '@/components/dashboard/LeadFilters';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Lead, WebsiteProfile } from '@/types';

function LeadCardSkeleton() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 skeleton rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 skeleton rounded w-1/3" />
          <div className="h-4 skeleton rounded w-5/6" />
          <div className="h-3 skeleton rounded w-2/3" />
        </div>
      </div>
      <div className="h-3 skeleton rounded w-full" />
      <div className="flex gap-2">
        <div className="h-7 w-20 skeleton rounded-lg" />
        <div className="h-7 w-20 skeleton rounded-lg" />
        <div className="h-7 w-16 skeleton rounded-lg" />
      </div>
    </div>
  );
}

function EmptyState({ hasProject }: { hasProject: boolean }) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-5">
        <Radio className="h-7 w-7 text-zinc-600" />
      </div>
      <h2 className="text-lg font-semibold text-zinc-200 mb-2">
        {hasProject ? 'No leads found yet' : 'Set up your first project'}
      </h2>
      <p className="text-sm text-zinc-500 text-center max-w-xs mb-6">
        {hasProject
          ? 'Leads will appear here once we find relevant conversations matching your business.'
          : 'Enter your website URL and let AI discover people actively looking for what you sell.'}
      </p>
      {!hasProject && (
        <Button
          onClick={() => router.push('/onboarding')}
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          Get Started
        </Button>
      )}
    </div>
  );
}

function StatsBar({ leads }: { leads: Lead[] }) {
  const highIntent = leads.filter(l => (l.score?.intent_score ?? 0) >= 80).length;
  const redditLeads = leads.filter(l => l.source === 'reddit').length;
  const avgScore = leads.length > 0
    ? Math.round(leads.reduce((sum, l) => sum + (l.score?.intent_score ?? 0), 0) / leads.length)
    : 0;

  const stats = [
    { label: 'Total Leads', value: leads.length, icon: Activity, color: 'text-violet-400' },
    { label: 'High Intent', value: highIntent, icon: Zap, color: 'text-emerald-400' },
    { label: 'From Reddit', value: redditLeads, icon: TrendingUp, color: 'text-orange-400' },
    { label: 'Avg Score', value: avgScore, icon: Radio, color: 'text-blue-400' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      {stats.map(({ label, value, icon: Icon, color }) => (
        <div
          key={label}
          className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3"
        >
          <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center">
            <Icon className={cn('h-4 w-4', color)} />
          </div>
          <div>
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="text-lg font-semibold text-zinc-100 tabular-nums leading-tight">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Generate search queries using profile data, with robust fallbacks if profile fields are sparse. */
function buildQueries(
  projectName: string,
  websiteUrl: string,
  profile: WebsiteProfile | null,
): Array<{ query: string; type: string }> {
  // Try to use the real profile
  if (profile) {
    const { generateSearchQueries } = require('@/lib/intent-scorer');
    const profileQueries: Array<{ query: string; type: string }> = generateSearchQueries(
      profile.keywords || [],
      profile.pain_points || [],
      profile.buyer_intent_phrases || [],
      profile.competitors || [],
      profile.category || '',
    );
    // If the profile produced real queries (not just empty-category ones), use them
    const nonEmptyQueries = profileQueries.filter(
      q => !q.query.startsWith('looking for  ') && !q.query.startsWith(' tool') && !q.query.startsWith('best  ')
    );
    if (nonEmptyQueries.length >= 3) return profileQueries;
  }

  // Fallback: derive queries from project name and website URL
  let domain = '';
  try {
    domain = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`)
      .hostname.replace(/^www\./, '');
  } catch {
    domain = projectName.toLowerCase();
  }

  const name = projectName.trim();
  return [
    { query: `${name} recommendations`, type: 'keyword' },
    { query: `${name} alternatives`, type: 'keyword' },
    { query: `${domain} review`, type: 'keyword' },
    { query: `looking for ${name} software`, type: 'buying_intent' },
    { query: 'SaaS tool recommendations', type: 'buying_intent' },
    { query: 'what software do you recommend for small business', type: 'buying_intent' },
    { query: 'software recommendations', type: 'buying_intent' },
    { query: 'looking for a tool to help with', type: 'buying_intent' },
  ];
}

export default function LeadsPage() {
  const router = useRouter();
  const {
    leads,
    setLeads,
    activeProject,
    websiteProfile,
    setWebsiteProfile,
    filters,
    isLoadingLeads,
    setIsLoadingLeads,
    isRefreshing,
    setIsRefreshing,
    updateLeadStatus,
  } = useAppStore();

  const [fetchError, setFetchError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [isRebuildingProfile, setIsRebuildingProfile] = useState(false);
  const didInitialLoad = useRef(false);

  const hasProject = !!activeProject;

  // ── Load existing leads from DB immediately on mount ───────────
  // Shows cached leads right away without waiting for a fresh Reddit fetch.
  const loadFromDB = useCallback(async () => {
    if (!activeProject?.id || activeProject.id.startsWith('local_')) return;
    try {
      const res = await fetch(`/api/leads?project_id=${activeProject.id}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        if (data.leads?.length > 0) {
          setLeads(data.leads);
        }
      }
    } catch {
      // non-critical — fresh fetch will follow
    }
  }, [activeProject, setLeads]);

  // ── Rebuild website profile if missing ─────────────────────────
  const rebuildProfile = useCallback(async (): Promise<WebsiteProfile | null> => {
    if (!activeProject?.website_url || !activeProject.id) return null;
    setIsRebuildingProfile(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: activeProject.website_url, project_id: activeProject.id }),
      });
      const data = await res.json();
      if (data.success && data.analysis) {
        const profile: WebsiteProfile = {
          id: `profile_${activeProject.id}`,
          project_id: activeProject.id,
          product_name: data.analysis.product_name,
          category: data.analysis.category,
          target_customer: data.analysis.target_customer,
          pain_points: data.analysis.pain_points ?? [],
          features: data.analysis.features ?? [],
          keywords: data.analysis.keywords ?? [],
          buyer_intent_phrases: data.analysis.buyer_intent_phrases ?? [],
          competitors: data.analysis.competitors ?? [],
          industry: data.analysis.industry,
          pricing_signals: data.analysis.pricing_signals,
          raw_analysis: data.analysis,
          crawled_pages: [],
          analyzed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
        setWebsiteProfile(profile);
        return profile;
      }
    } catch {
      // fall through
    } finally {
      setIsRebuildingProfile(false);
    }
    return null;
  }, [activeProject, setWebsiteProfile]);

  // ── Main lead fetch (Reddit + scoring) ──────────────────────────
  const fetchLeads = useCallback(async (isRefresh = false) => {
    if (!activeProject) return;

    if (isRefresh) setIsRefreshing(true);
    else setIsLoadingLeads(true);
    setFetchError(null);

    try {
      // If profile is missing, rebuild it first (blocking, since we need it for good queries)
      let profile = websiteProfile;
      if (!profile) {
        profile = await rebuildProfile();
        // If rebuild also failed, continue with fallback queries (don't block the user)
      }

      const queries = buildQueries(
        activeProject.name,
        activeProject.website_url,
        profile,
      );

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queries: queries.slice(0, 8),
          keywords: profile?.keywords ?? [],
          competitors: profile?.competitors ?? [],
          buyer_intent_phrases: profile?.buyer_intent_phrases ?? [],
          project_id: activeProject.id,
          limit: 30,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.limit_reached) {
          setLimitReached(true);
          setLimitMessage(data.message || 'Daily limit reached.');
        } else {
          setLimitReached(false);
        }
        if (data.leads?.length > 0) {
          setLeads(data.leads);
        } else if (!data.limit_reached) {
          // Got 0 new leads — keep showing existing DB leads (don't wipe them)
          setFetchError(null);
        }
      } else {
        setFetchError(data.error || 'Failed to fetch leads');
      }
    } catch {
      setFetchError('Network error. Please check your connection.');
    } finally {
      setIsLoadingLeads(false);
      setIsRefreshing(false);
    }
  }, [activeProject, websiteProfile, rebuildProfile, setLeads, setIsLoadingLeads, setIsRefreshing]);

  // ── Initial load: DB first, then fresh fetch ──────────────────
  useEffect(() => {
    if (!hasProject || didInitialLoad.current) return;
    didInitialLoad.current = true;

    // Load cached leads from DB immediately (fast), then do a fresh fetch
    loadFromDB().then(() => {
      fetchLeads();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProject]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (lead.status === 'dismissed') return false;
      if (filters.source && filters.source !== 'all' && lead.source !== filters.source) return false;
      if (filters.status && filters.status !== 'all' && lead.status !== filters.status) return false;
      if (filters.min_intent_score && (lead.score?.intent_score ?? 0) < filters.min_intent_score) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const titleMatch = lead.title?.toLowerCase().includes(search);
        const bodyMatch = lead.body?.toLowerCase().includes(search);
        const subredditMatch = lead.subreddit?.toLowerCase().includes(search);
        if (!titleMatch && !bodyMatch && !subredditMatch) return false;
      }
      return true;
    });
  }, [leads, filters]);

  const isLoading = isLoadingLeads || isRefreshing;

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopBar
        title="Lead Feed"
        subtitle={hasProject ? `${filteredLeads.length} leads` : undefined}
        onRefresh={hasProject ? () => fetchLeads(true) : undefined}
        showSearch={hasProject}
      />

      <div className="p-6">
        {!hasProject && <EmptyState hasProject={false} />}

        {hasProject && (
          <>
            {leads.length > 0 && <StatsBar leads={filteredLeads} />}

            <div className="mb-4">
              <LeadFilterBar />
            </div>

            {/* Profile rebuilding banner (non-blocking) */}
            {isRebuildingProfile && (
              <div className="flex items-center gap-3 bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 mb-4">
                <RefreshCw className="h-4 w-4 text-violet-400 animate-spin flex-shrink-0" />
                <p className="text-sm text-violet-300">
                  Rebuilding your website profile — searching with basic queries in the meantime…
                </p>
              </div>
            )}

            {limitReached && (
              <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-4">
                <CreditCard className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-yellow-300 font-medium">Daily limit reached</p>
                  <p className="text-xs text-yellow-400/70 mt-0.5">{limitMessage}</p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push('/settings')}
                  className="text-xs flex-shrink-0"
                >
                  Upgrade
                </Button>
              </div>
            )}

            {fetchError && (
              <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-400">{fetchError}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchLeads()}
                  className="ml-auto text-xs"
                >
                  Retry
                </Button>
              </div>
            )}

            {isLoading && leads.length === 0 && (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <LeadCardSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Refreshing indicator when leads already visible */}
            {isRefreshing && leads.length > 0 && (
              <div className="flex items-center gap-2 text-zinc-500 text-xs mb-3">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Fetching fresh leads…
              </div>
            )}

            {filteredLeads.length > 0 && (
              <div className="space-y-3">
                {filteredLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    websiteProfile={websiteProfile}
                    onStatusChange={updateLeadStatus}
                  />
                ))}
              </div>
            )}

            {!isLoading && filteredLeads.length === 0 && leads.length > 0 && (
              <div className="text-center py-16">
                <p className="text-sm text-zinc-500 mb-3">No leads match your current filters</p>
                <Button variant="ghost" size="sm" onClick={() => useAppStore.getState().resetFilters()}>
                  Clear filters
                </Button>
              </div>
            )}

            {!isLoading && !fetchError && leads.length === 0 && (
              <EmptyState hasProject={true} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
