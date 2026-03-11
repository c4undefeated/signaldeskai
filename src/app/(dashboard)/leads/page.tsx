'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Radio,
  TrendingUp,
  Zap,
  AlertCircle,
  ArrowRight,
  Activity,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { LeadCard } from '@/components/dashboard/LeadCard';
import { LeadFilterBar } from '@/components/dashboard/LeadFilters';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Lead } from '@/types';

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
    <div className="grid grid-cols-4 gap-3 mb-5">
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

export default function LeadsPage() {
  const router = useRouter();
  const {
    leads,
    setLeads,
    activeProject,
    websiteProfile,
    filters,
    isLoadingLeads,
    setIsLoadingLeads,
    isRefreshing,
    setIsRefreshing,
    updateLeadStatus,
  } = useAppStore();

  const [fetchError, setFetchError] = useState<string | null>(null);

  const hasProject = !!activeProject;

  const fetchLeads = useCallback(async (isRefresh = false) => {
    if (!activeProject || !websiteProfile) return;

    if (isRefresh) setIsRefreshing(true);
    else setIsLoadingLeads(true);
    setFetchError(null);

    try {
      // Generate queries from the website profile
      const { generateSearchQueries } = await import('@/lib/intent-scorer');
      const queries = generateSearchQueries(
        websiteProfile.keywords || [],
        websiteProfile.pain_points || [],
        websiteProfile.buyer_intent_phrases || [],
        websiteProfile.competitors || [],
        websiteProfile.category || ''
      );

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queries: queries.slice(0, 8),
          keywords: websiteProfile.keywords,
          competitors: websiteProfile.competitors,
          buyer_intent_phrases: websiteProfile.buyer_intent_phrases,
          project_id: activeProject.id,
          limit: 30,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setLeads(data.leads);
      } else {
        setFetchError(data.error || 'Failed to fetch leads');
      }
    } catch {
      setFetchError('Network error. Please check your connection.');
    } finally {
      setIsLoadingLeads(false);
      setIsRefreshing(false);
    }
  }, [activeProject, websiteProfile, setLeads, setIsLoadingLeads, setIsRefreshing]);

  useEffect(() => {
    if (hasProject && websiteProfile && leads.length === 0) {
      fetchLeads();
    }
  }, [hasProject, websiteProfile, leads.length, fetchLeads]);

  // Filter leads based on current filters
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

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopBar
        title="Lead Feed"
        subtitle={hasProject ? `${filteredLeads.length} leads` : undefined}
        onRefresh={hasProject ? () => fetchLeads(true) : undefined}
        showSearch={hasProject}
      />

      <div className="p-6">
        {/* Project not set up */}
        {!hasProject && (
          <EmptyState hasProject={false} />
        )}

        {/* Project set up but no profile */}
        {hasProject && !websiteProfile && (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertCircle className="h-8 w-8 text-yellow-400 mb-3" />
            <p className="text-sm text-zinc-400 mb-4">Website analysis required</p>
            <Button onClick={() => router.push('/onboarding')}>
              Complete Setup
            </Button>
          </div>
        )}

        {/* Main content */}
        {hasProject && websiteProfile && (
          <>
            {/* Stats */}
            {leads.length > 0 && <StatsBar leads={filteredLeads} />}

            {/* Filters */}
            <div className="mb-4">
              <LeadFilterBar />
            </div>

            {/* Error state */}
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

            {/* Loading skeletons */}
            {isLoadingLeads && (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <LeadCardSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Lead cards */}
            {!isLoadingLeads && filteredLeads.length > 0 && (
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

            {/* Empty filtered state */}
            {!isLoadingLeads && filteredLeads.length === 0 && leads.length > 0 && (
              <div className="text-center py-16">
                <p className="text-sm text-zinc-500 mb-3">No leads match your current filters</p>
                <Button variant="ghost" size="sm" onClick={() => useAppStore.getState().resetFilters()}>
                  Clear filters
                </Button>
              </div>
            )}

            {/* Empty state - no leads */}
            {!isLoadingLeads && !fetchError && leads.length === 0 && (
              <EmptyState hasProject={true} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
