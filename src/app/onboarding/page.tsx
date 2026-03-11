'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Radio,
  ArrowRight,
  Loader2,
  Globe,
  CheckCircle2,
  Sparkles,
  Target,
  Zap,
  TrendingUp,
  AlertCircle,
  Search,
  Users,
  ChevronRight,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, extractDomain, normalizeUrl } from '@/lib/utils';
import type { WebsiteProfile } from '@/types';

type OnboardingStep = 'url' | 'analyzing' | 'profile' | 'queries' | 'ready';

interface AnalysisResult {
  analysis: {
    product_name: string;
    category: string;
    target_customer: string;
    pain_points: string[];
    features: string[];
    keywords: string[];
    buyer_intent_phrases: string[];
    competitors: string[];
    industry: string;
    pricing_signals: string;
    summary: string;
  };
  queries: Array<{ query: string; type: string }>;
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1 rounded-full transition-all duration-300',
            i < current ? 'bg-violet-500 w-6' : i === current ? 'bg-violet-400 w-4' : 'bg-zinc-700 w-3'
          )}
        />
      ))}
    </div>
  );
}

function AnalyzingLoader({ url }: { url: string }) {
  const steps = [
    { label: 'Crawling website pages', icon: Globe },
    { label: 'Extracting product intelligence', icon: Sparkles },
    { label: 'Identifying target customers', icon: Users },
    { label: 'Generating intent signals', icon: Zap },
    { label: 'Building search queries', icon: Search },
  ];

  const [currentStep, setCurrentStep] = useState(0);

  // Cycle through steps
  useState(() => {
    const interval = setInterval(() => {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    }, 1200);
    return () => clearInterval(interval);
  });

  return (
    <div className="flex flex-col items-center">
      {/* Animated radar */}
      <div className="relative w-24 h-24 mb-8">
        <div className="absolute inset-0 rounded-full border-2 border-violet-500/20 animate-ping" />
        <div className="absolute inset-2 rounded-full border-2 border-violet-500/30 animate-ping" style={{ animationDelay: '0.3s' }} />
        <div className="absolute inset-4 rounded-full border border-violet-500/40" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 bg-violet-600/20 border border-violet-500/40 rounded-full flex items-center justify-center">
            <Radio className="h-5 w-5 text-violet-400 animate-pulse" />
          </div>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-zinc-100 mb-1">Analyzing {extractDomain(url)}</h2>
      <p className="text-sm text-zinc-500 mb-8">AI is extracting your business intelligence</p>

      <div className="w-full max-w-sm space-y-2.5">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isDone = i < currentStep;
          const isActive = i === currentStep;

          return (
            <div
              key={i}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300',
                isDone && 'opacity-60',
                isActive && 'bg-violet-500/10 border border-violet-500/20'
              )}
            >
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                isDone ? 'bg-emerald-500/20' : isActive ? 'bg-violet-500/20' : 'bg-zinc-800'
              )}>
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : isActive ? (
                  <Loader2 className="h-3.5 w-3.5 text-violet-400 animate-spin" />
                ) : (
                  <Icon className="h-3.5 w-3.5 text-zinc-600" />
                )}
              </div>
              <span className={cn(
                'text-sm',
                isDone ? 'text-zinc-500' : isActive ? 'text-zinc-200' : 'text-zinc-600'
              )}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfilePreview({ result }: { result: AnalysisResult }) {
  const analysis = result.analysis;

  return (
    <div className="w-full max-w-lg space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-semibold text-zinc-100">{analysis.product_name}</h3>
            <span className="text-xs bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded-full border border-violet-500/20">
              {analysis.category}
            </span>
          </div>
          <p className="text-xs text-zinc-400">{analysis.summary}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Target Customer */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
          <div className="flex items-center gap-1.5 mb-2">
            <Target className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-xs font-medium text-zinc-400">Target Customer</span>
          </div>
          <p className="text-xs text-zinc-300">{analysis.target_customer}</p>
        </div>

        {/* Industry */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-medium text-zinc-400">Industry</span>
          </div>
          <p className="text-xs text-zinc-300">{analysis.industry}</p>
          <p className="text-xs text-zinc-500 mt-1">{analysis.pricing_signals}</p>
        </div>
      </div>

      {/* Keywords */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Search className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-xs font-medium text-zinc-400">Intent Keywords</span>
          <span className="text-xs text-zinc-600 ml-auto">{analysis.keywords.length} extracted</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {analysis.keywords.map((kw) => (
            <span key={kw} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full border border-zinc-700/50">
              {kw}
            </span>
          ))}
        </div>
      </div>

      {/* Pain Points */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
        <div className="flex items-center gap-1.5 mb-2.5">
          <AlertCircle className="h-3.5 w-3.5 text-red-400" />
          <span className="text-xs font-medium text-zinc-400">Pain Points to Target</span>
        </div>
        <div className="space-y-1.5">
          {analysis.pain_points.slice(0, 4).map((pp) => (
            <div key={pp} className="flex items-start gap-2">
              <div className="w-1 h-1 bg-red-400 rounded-full mt-1.5 flex-shrink-0" />
              <span className="text-xs text-zinc-400">{pp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Competitors */}
      {analysis.competitors.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Zap className="h-3.5 w-3.5 text-orange-400" />
            <span className="text-xs font-medium text-zinc-400">Competitors to Monitor</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {analysis.competitors.map((c) => (
              <span key={c} className="text-xs bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/20">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QueriesPreview({ queries }: { queries: AnalysisResult['queries'] }) {
  const typeColors: Record<string, string> = {
    keyword: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    pain: 'bg-red-500/10 text-red-400 border-red-500/20',
    buying_intent: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    competitor: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  };

  const typeLabels: Record<string, string> = {
    keyword: 'Keyword',
    pain: 'Pain',
    buying_intent: 'Intent',
    competitor: 'Competitor',
  };

  return (
    <div className="w-full max-w-lg">
      <div className="flex items-center gap-2 mb-4">
        <Search className="h-4 w-4 text-violet-400" />
        <h3 className="text-sm font-semibold text-zinc-200">
          {queries.length} Search Queries Generated
        </h3>
      </div>
      <p className="text-xs text-zinc-500 mb-4">
        These queries will scan Reddit for people actively looking for what you sell.
      </p>
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {queries.map((q, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2"
          >
            <ChevronRight className="h-3.5 w-3.5 text-zinc-600 flex-shrink-0" />
            <span className="text-xs text-zinc-300 flex-1 font-mono">{q.query}</span>
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0',
              typeColors[q.type] || typeColors.keyword
            )}>
              {typeLabels[q.type] || q.type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { setActiveProject, setWebsiteProfile, userId, workspaceId, setWorkspaceId } = useAppStore();

  const [step, setStep] = useState<OnboardingStep>('url');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [projectName, setProjectName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!websiteUrl.trim()) return;
    setIsAnalyzing(true);
    setStep('analyzing');
    setError(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizeUrl(websiteUrl) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Analysis failed');
      setResult(data);
      setProjectName(data.analysis.product_name || extractDomain(websiteUrl));
      setStep('profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setStep('url');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleContinueToQueries = () => { setStep('queries'); };

  const handleLaunch = async () => {
    if (!result) return;
    setIsLaunching(true);
    setError(null);

    try {
      let resolvedWorkspaceId = workspaceId;

      // Ensure workspace exists (create if needed)
      if (userId && !resolvedWorkspaceId) {
        const wsRes = await fetch('/api/workspace', { method: 'POST' });
        const wsData = await wsRes.json();
        if (wsData.workspace?.id) {
          resolvedWorkspaceId = wsData.workspace.id;
          setWorkspaceId(wsData.workspace.id);
        }
      }

      // Create project in DB (or fall back to local)
      let projectId = `local_${Date.now()}`;
      if (userId && resolvedWorkspaceId) {
        const projRes = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: projectName,
            website_url: normalizeUrl(websiteUrl),
            workspace_id: resolvedWorkspaceId,
          }),
        });
        const projData = await projRes.json();
        if (projData.project?.id) {
          projectId = projData.project.id;

          // Re-run analysis with real project_id to persist profile
          await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: normalizeUrl(websiteUrl),
              project_id: projectId,
            }),
          });
        }
      }

      const project = {
        id: projectId,
        user_id: userId || 'local',
        name: projectName,
        website_url: normalizeUrl(websiteUrl),
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const profile: WebsiteProfile = {
        id: `profile_${projectId}`,
        project_id: projectId,
        product_name: result.analysis.product_name,
        category: result.analysis.category,
        target_customer: result.analysis.target_customer,
        pain_points: result.analysis.pain_points,
        features: result.analysis.features,
        keywords: result.analysis.keywords,
        buyer_intent_phrases: result.analysis.buyer_intent_phrases,
        competitors: result.analysis.competitors,
        industry: result.analysis.industry,
        pricing_signals: result.analysis.pricing_signals,
        raw_analysis: result.analysis as Record<string, unknown>,
        crawled_pages: [],
        analyzed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      setActiveProject(project);
      setWebsiteProfile(profile);
      router.push('/leads');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Launch failed. Please try again.');
    } finally {
      setIsLaunching(false);
    }
  };

  const totalSteps = 4;
  const stepIndex = { url: 0, analyzing: 1, profile: 2, queries: 3, ready: 4 }[step];

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-zinc-800/50 flex items-center px-6">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center">
            <Radio className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-white text-sm">SignalDesk AI</span>
        </div>

        <div className="ml-auto">
          <StepIndicator current={stepIndex} total={totalSteps} />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">

        {/* Step 1: URL Input */}
        {step === 'url' && (
          <div className="w-full max-w-md">
            {/* Hero */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-3 py-1 mb-4">
                <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
                <span className="text-xs text-violet-400 font-medium">AI-Powered Lead Discovery</span>
              </div>
              <h1 className="text-3xl font-bold text-zinc-100 mb-3">
                Find people already looking<br />
                <span className="text-violet-400">for what you sell</span>
              </h1>
              <p className="text-zinc-500 text-sm">
                Enter your website and we&apos;ll scan Reddit for high-intent conversations matching your product.
              </p>
            </div>

            {/* URL Input */}
            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Your website URL
                </label>
                <Input
                  placeholder="https://yoursaas.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  leftIcon={<Globe className="h-4 w-4" />}
                  className="h-11 text-sm"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <Button
              onClick={handleAnalyze}
              disabled={!websiteUrl.trim() || isAnalyzing}
              loading={isAnalyzing}
              className="w-full h-11"
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Analyze & Find Leads
            </Button>

            {/* Social proof */}
            <div className="flex items-center gap-6 mt-8 justify-center">
              {[
                { value: 'Reddit', label: 'Posts scanned daily' },
                { value: 'AI', label: 'Intent scoring' },
                { value: '< 60s', label: 'Setup time' },
              ].map(({ value, label }) => (
                <div key={label} className="text-center">
                  <p className="text-sm font-bold text-violet-400">{value}</p>
                  <p className="text-[10px] text-zinc-600">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Analyzing */}
        {step === 'analyzing' && (
          <AnalyzingLoader url={websiteUrl} />
        )}

        {/* Step 3: Profile Preview */}
        {step === 'profile' && result && (
          <div className="w-full max-w-lg">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 mb-3">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs text-emerald-400 font-medium">Analysis Complete</span>
              </div>
              <h2 className="text-xl font-semibold text-zinc-100 mb-1">
                Your Business Intelligence
              </h2>
              <p className="text-sm text-zinc-500">
                We extracted these signals to power your lead discovery
              </p>
            </div>

            <ProfilePreview result={result} />

            <div className="mt-6 flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setStep('url')}
                className="flex-1"
              >
                Re-analyze
              </Button>
              <Button
                onClick={handleContinueToQueries}
                className="flex-1"
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Queries */}
        {step === 'queries' && result && (
          <div className="w-full max-w-lg">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-zinc-100 mb-1">
                Reddit Search Queries
              </h2>
              <p className="text-sm text-zinc-500">
                These will continuously scan Reddit for high-intent conversations
              </p>
            </div>

            <QueriesPreview queries={result.queries} />

            <div className="mt-6">
              <Button
                onClick={handleLaunch}
                loading={isLaunching}
                className="w-full h-11"
                rightIcon={!isLaunching ? <ArrowRight className="h-4 w-4" /> : undefined}
              >
                {isLaunching ? 'Setting up project...' : 'Launch Lead Discovery'}
              </Button>
              <p className="text-xs text-zinc-600 text-center mt-2">
                This will start scanning Reddit for matching conversations
              </p>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
