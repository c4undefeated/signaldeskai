'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  AlertTriangle,
  Target,
  Tag,
  ArrowLeftRight,
  DollarSign,
  Puzzle,
  Users,
  Bug,
  BarChart3,
  Layers,
  Radio,
  RefreshCw,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { TopBar } from '@/components/layout/TopBar';
import { cn } from '@/lib/utils';
import type { IntentClusterType } from '@/lib/intent-clustering';

// ── Types ─────────────────────────────────────────────────────────────────────

interface IntentCluster {
  id?: string;
  intent_type: IntentClusterType;
  cluster_name: string;
  cluster_summary: string;
  signal_count: number;
  avg_intent_score: number;
  top_competitors: string[];
  top_pain_phrases: string[];
  top_subreddits: string[];
}

interface Competitor {
  name: string;
  count: number;
  pct: number;
}

interface PainPoint {
  phrase: string;
  count: number;
  pct: number;
}

interface Keyword {
  keyword: string;
  count: number;
  avg_intent: number;
}

interface Cluster {
  theme: string;
  keywords: string[];
  count: number;
  avg_intent: number;
}

interface SignalsData {
  competitors: Competitor[];
  pain_points: PainPoint[];
  keywords: Keyword[];
  clusters: Cluster[];
  meta: {
    total_leads: number;
    leads_with_signals: number;
  };
}

// ── Cluster theme icons ───────────────────────────────────────────────────────

const CLUSTER_ICONS: Record<string, React.ElementType> = {
  'Migration & Switching': ArrowLeftRight,
  'Pricing Pressure': DollarSign,
  'Feature & Integration': Puzzle,
  'Team & Workflow': Users,
  'Technical Issues': Bug,
  'Scale & Growth': TrendingUp,
  'Other Signals': Tag,
};

const CLUSTER_COLORS: Record<string, string> = {
  'Migration & Switching': 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  'Pricing Pressure': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  'Feature & Integration': 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  'Team & Workflow': 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  'Technical Issues': 'text-red-400 bg-red-500/10 border-red-500/20',
  'Scale & Growth': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  'Other Signals': 'text-zinc-400 bg-zinc-800 border-zinc-700',
};

// ── Intent cluster type config ────────────────────────────────────────────────

const INTENT_CONFIG: Record<string, { icon: React.ElementType; text: string; bg: string; border: string }> = {
  recommendations:    { icon: Lightbulb,       text: 'text-violet-400', bg: 'bg-violet-500/10',  border: 'border-violet-500/20' },
  competitor_switch:  { icon: ArrowLeftRight,  text: 'text-orange-400', bg: 'bg-orange-500/10',  border: 'border-orange-500/20' },
  budget_concerns:    { icon: DollarSign,      text: 'text-yellow-400', bg: 'bg-yellow-500/10',  border: 'border-yellow-500/20' },
  urgent_help:        { icon: AlertTriangle,   text: 'text-red-400',    bg: 'bg-red-500/10',     border: 'border-red-500/20'    },
  feature_comparison: { icon: Puzzle,          text: 'text-blue-400',   bg: 'bg-blue-500/10',    border: 'border-blue-500/20'   },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function titleCase(str: string) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function intentColor(score: number) {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function CardSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
      <div className="h-4 skeleton rounded w-1/3" />
      <div className="space-y-2.5 pt-1">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-3 skeleton rounded flex-1" />
            <div className="h-3 skeleton rounded w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stat box ──────────────────────────────────────────────────────────────────

function StatBox({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon className={cn('h-4 w-4', color)} />
      </div>
      <div>
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="text-lg font-semibold text-zinc-100 tabular-nums leading-tight">{value}</p>
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  count,
  iconColor,
}: {
  icon: React.ElementType;
  title: string;
  count?: number;
  iconColor: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', iconColor)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
      {count !== undefined && (
        <span className="ml-auto text-xs text-zinc-600 tabular-nums">{count} found</span>
      )}
    </div>
  );
}

// ── Competitor Mentions card ───────────────────────────────────────────────────

function CompetitorCard({ competitors }: { competitors: Competitor[] }) {
  const maxCount = competitors[0]?.count ?? 1;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <SectionHeader
        icon={Target}
        title="Competitor Mentions"
        count={competitors.length}
        iconColor="bg-orange-500/15 text-orange-400"
      />

      {competitors.length === 0 ? (
        <p className="text-sm text-zinc-600 py-4 text-center">
          No competitor mentions detected yet
        </p>
      ) : (
        <div className="space-y-3">
          {competitors.map(({ name, count, pct }) => (
            <div key={name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-zinc-300 font-medium">{titleCase(name)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 tabular-nums">{pct}% of leads</span>
                  <span className="text-xs font-semibold text-orange-400 tabular-nums w-6 text-right">
                    {count}
                  </span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-orange-500/60 transition-all duration-500"
                  style={{ width: `${Math.max(3, (count / maxCount) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Pain Points card ──────────────────────────────────────────────────────────

function PainPointsCard({ painPoints }: { painPoints: PainPoint[] }) {
  const maxCount = painPoints[0]?.count ?? 1;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <SectionHeader
        icon={AlertTriangle}
        title="High-Frequency Pain Points"
        count={painPoints.length}
        iconColor="bg-red-500/15 text-red-400"
      />

      {painPoints.length === 0 ? (
        <p className="text-sm text-zinc-600 py-4 text-center">No pain signals detected yet</p>
      ) : (
        <div className="space-y-3">
          {painPoints.map(({ phrase, count, pct }) => (
            <div key={phrase}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-zinc-300 font-medium truncate max-w-[200px]">
                  &ldquo;{phrase}&rdquo;
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-zinc-500 tabular-nums">{pct}%</span>
                  <span className="text-xs font-semibold text-red-400 tabular-nums w-6 text-right">
                    {count}
                  </span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-red-500/50 transition-all duration-500"
                  style={{ width: `${Math.max(3, (count / maxCount) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Intent Clusters section ───────────────────────────────────────────────────
// Full-width section showing AI-detected buying-intent clusters, each with a
// natural-language summary generated from the underlying lead signals.

function IntentClustersSection({ clusters }: { clusters: IntentCluster[] }) {
  if (clusters.length === 0) return null;

  return (
    <div className="mb-5">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-7 h-7 bg-emerald-500/15 rounded-lg flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
        </div>
        <h2 className="text-sm font-semibold text-zinc-200">Intent Clusters</h2>
        <span className="text-xs text-zinc-600 ml-1">
          — buying conversations grouped by signal type
        </span>
        <span className="ml-auto text-xs text-zinc-600 tabular-nums">
          {clusters.length} active
        </span>
      </div>

      {/* Cluster cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {clusters.map((cluster) => {
          const cfg = INTENT_CONFIG[cluster.intent_type] ?? INTENT_CONFIG.recommendations;
          const Icon = cfg.icon;

          return (
            <div
              key={cluster.intent_type}
              className={cn(
                'rounded-xl border bg-zinc-900 p-4 transition-colors hover:border-zinc-600',
                cfg.border,
              )}
            >
              {/* Icon + summary */}
              <div className="flex items-start gap-3 mb-3">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', cfg.bg)}>
                  <Icon className={cn('h-4 w-4', cfg.text)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wide mb-0.5">
                    {cluster.cluster_name}
                  </p>
                  <p className="text-sm font-semibold text-zinc-100 leading-snug">
                    {cluster.cluster_summary}
                  </p>
                </div>
              </div>

              {/* Footer stats */}
              <div className="flex items-center gap-2 pt-3 border-t border-zinc-800/60 flex-wrap">
                <span className={cn('text-xs font-semibold tabular-nums', intentColor(cluster.avg_intent_score))}>
                  {cluster.avg_intent_score} intent
                </span>
                <span className="text-zinc-700">·</span>
                <span className="text-xs text-zinc-500 tabular-nums">
                  {cluster.signal_count} {cluster.signal_count === 1 ? 'signal' : 'signals'}
                </span>

                {/* Top competitors or subreddits as context chips */}
                {cluster.top_competitors.length > 0 && (
                  <>
                    <span className="text-zinc-700">·</span>
                    <span className="text-[10px] text-zinc-600 truncate">
                      {cluster.top_competitors.slice(0, 2).join(', ')}
                    </span>
                  </>
                )}
                {cluster.top_competitors.length === 0 && cluster.top_subreddits.length > 0 && (
                  <>
                    <span className="text-zinc-700">·</span>
                    <span className="text-[10px] text-zinc-600 truncate">
                      {cluster.top_subreddits.slice(0, 2).map((s) => `r/${s}`).join(', ')}
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Opportunity Clusters card ─────────────────────────────────────────────────

function ClustersCard({ clusters }: { clusters: Cluster[] }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <SectionHeader
        icon={Layers}
        title="Opportunity Clusters"
        count={clusters.length}
        iconColor="bg-emerald-500/15 text-emerald-400"
      />

      {clusters.length === 0 ? (
        <p className="text-sm text-zinc-600 py-4 text-center">Not enough data to form clusters</p>
      ) : (
        <div className="space-y-3">
          {clusters.map(({ theme, keywords, count, avg_intent }) => {
            const Icon = CLUSTER_ICONS[theme] ?? Tag;
            const colorClass =
              CLUSTER_COLORS[theme] ?? 'text-zinc-400 bg-zinc-800 border-zinc-700';
            const [textColor] = colorClass.split(' ');

            return (
              <div
                key={theme}
                className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('h-3.5 w-3.5', textColor)} />
                    <span className="text-xs font-semibold text-zinc-200">{theme}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-semibold tabular-nums', intentColor(avg_intent))}>
                      {avg_intent} avg intent
                    </span>
                    <span className="text-xs text-zinc-600 tabular-nums">{count} signals</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((kw) => (
                    <span
                      key={kw}
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border',
                        colorClass
                      )}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Keywords card ─────────────────────────────────────────────────────────────

function KeywordsCard({ keywords }: { keywords: Keyword[] }) {
  const maxCount = keywords[0]?.count ?? 1;

  // Compute font size for tag cloud: 11px–18px range
  const sizeFor = (count: number) => {
    const ratio = count / maxCount;
    return Math.round(11 + ratio * 7);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <SectionHeader
        icon={BarChart3}
        title="Trending Keywords"
        count={keywords.length}
        iconColor="bg-violet-500/15 text-violet-400"
      />

      {keywords.length === 0 ? (
        <p className="text-sm text-zinc-600 py-4 text-center">No keywords matched yet</p>
      ) : (
        <div className="flex flex-wrap gap-2 pt-1">
          {keywords.map(({ keyword, count, avg_intent }) => (
            <span
              key={keyword}
              title={`${count} mentions · avg intent ${avg_intent}`}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border cursor-default',
                'bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:border-violet-500/30',
                'hover:bg-violet-500/10 hover:text-violet-300 transition-colors'
              )}
              style={{ fontSize: `${sizeFor(count)}px` }}
            >
              {keyword}
              <span className="text-[10px] text-zinc-500 tabular-nums">×{count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ hasProject }: { hasProject: boolean }) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-5">
        <TrendingUp className="h-7 w-7 text-zinc-600" />
      </div>
      <h2 className="text-lg font-semibold text-zinc-200 mb-2">
        {hasProject ? 'No signals found yet' : 'Set up your first project'}
      </h2>
      <p className="text-sm text-zinc-500 text-center max-w-xs mb-6">
        {hasProject
          ? 'Scan for leads first — signals are aggregated from your discovered leads.'
          : 'Enter your website URL to start discovering market signals.'}
      </p>
      <button
        onClick={() => router.push(hasProject ? '/leads' : '/onboarding')}
        className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-500 transition-colors"
      >
        {hasProject ? 'Go to Lead Feed' : 'Get Started'}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SignalsPage() {
  const { activeProject } = useAppStore();
  const [data, setData] = useState<SignalsData | null>(null);
  const [intentClusters, setIntentClusters] = useState<IntentCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSignals = useCallback(
    async (isRefresh = false) => {
      if (!activeProject?.id) {
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        // Parallel fetch: signals aggregation + intent clusters
        const [signalsRes, clustersRes] = await Promise.all([
          fetch(`/api/signals?project_id=${activeProject.id}`),
          fetch(`/api/clusters?project_id=${activeProject.id}`),
        ]);
        const signalsJson = await signalsRes.json();
        const clustersJson = await clustersRes.json();

        if (!signalsRes.ok) throw new Error(signalsJson.error ?? 'Request failed');
        setData(signalsJson);
        setIntentClusters(clustersJson.clusters ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load signals');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeProject?.id]
  );

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  const hasProject = !!activeProject;
  const hasData =
    data &&
    (data.competitors.length > 0 ||
      data.pain_points.length > 0 ||
      data.keywords.length > 0);

  const uniqueCompetitors = data?.competitors.length ?? 0;
  const uniquePainPatterns = data?.pain_points.length ?? 0;
  const uniqueKeywords = data?.keywords.length ?? 0;

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopBar
        title="Signal Intelligence"
        subtitle={
          data
            ? `${data.meta.total_leads} leads analysed · ${data.meta.leads_with_signals} with signals`
            : undefined
        }
        onRefresh={hasProject ? () => fetchSignals(true) : undefined}
      />

      <div className="p-6">
        {/* No project */}
        {!hasProject && !loading && <EmptyState hasProject={false} />}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
            <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-400 flex-1">{error}</p>
            <button
              onClick={() => fetchSignals()}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && hasProject && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 h-16 skeleton" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-5">
                <CardSkeleton rows={6} />
                <CardSkeleton rows={4} />
              </div>
              <div className="space-y-5">
                <CardSkeleton rows={6} />
                <CardSkeleton rows={5} />
              </div>
            </div>
          </>
        )}

        {/* No data after load */}
        {!loading && hasProject && !error && !hasData && (
          <EmptyState hasProject={true} />
        )}

        {/* Data */}
        {!loading && hasProject && hasData && data && (
          <>
            {/* Stat row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              <StatBox
                label="Leads Analysed"
                value={data.meta.total_leads}
                icon={Radio}
                color="text-violet-400"
              />
              <StatBox
                label="Competitors Detected"
                value={uniqueCompetitors}
                icon={Target}
                color="text-orange-400"
              />
              <StatBox
                label="Pain Patterns"
                value={uniquePainPatterns}
                icon={AlertTriangle}
                color="text-red-400"
              />
              <StatBox
                label="Trending Keywords"
                value={uniqueKeywords}
                icon={TrendingUp}
                color="text-emerald-400"
              />
              <StatBox
                label="Intent Clusters"
                value={intentClusters.length}
                icon={Sparkles}
                color="text-emerald-400"
              />
            </div>

            {/* Refreshing indicator */}
            {refreshing && (
              <div className="flex items-center gap-2 text-xs text-zinc-500 mb-4">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Refreshing signals…
              </div>
            )}

            {/* Intent clusters — full-width above the 2-column grid */}
            <IntentClustersSection clusters={intentClusters} />

            {/* 2-column grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Left column */}
              <div className="space-y-5">
                <CompetitorCard competitors={data.competitors} />
                <ClustersCard clusters={data.clusters} />
              </div>

              {/* Right column */}
              <div className="space-y-5">
                <PainPointsCard painPoints={data.pain_points} />
                <KeywordsCard keywords={data.keywords} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
