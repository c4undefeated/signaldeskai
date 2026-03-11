'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Settings,
  Globe,
  Bell,
  Key,
  CreditCard,
  Database,
  LogOut,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, extractDomain } from '@/lib/utils';

function SettingsSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-zinc-800 rounded-lg flex items-center justify-center">
            <Icon className="h-4 w-4 text-zinc-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
            {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-zinc-800/50 last:border-0">
      <div>
        <p className="text-sm text-zinc-300">{label}</p>
        {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none',
          checked ? 'bg-violet-600' : 'bg-zinc-700'
        )}
      >
        <span
          className={cn(
            'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform transition-transform duration-200',
            checked ? 'translate-x-4.5' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  );
}

const PLANS = [
  {
    key: 'pro',
    name: 'Pro',
    price: '$49/mo',
    features: ['250 leads/day', 'AI reply generation', 'Tone variants', 'Daily digest email', 'Priority support'],
    highlight: true,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    features: ['Unlimited leads', 'X/Twitter + LinkedIn', 'API access', 'Custom integrations', 'Dedicated support'],
    highlight: false,
  },
] as const;

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeProject, websiteProfile, workspaceId, plan, setPlan, setActiveProject, setWebsiteProfile, setLeads } = useAppStore();

  const [alerts, setAlerts] = useState({
    daily_digest: true,
    high_intent: true,
    competitor_mention: false,
    email_notifications: false,
  });
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);

  useEffect(() => {
    if (searchParams.get('upgraded') === '1') {
      setUpgradeSuccess(true);
      // Refresh plan from DB
      if (workspaceId) {
        fetch(`/api/workspace?id=${workspaceId}`)
          .then((r) => r.json())
          .then((d) => { if (d.plan) setPlan(d.plan); })
          .catch(() => {});
      }
    }
  }, [searchParams, workspaceId, setPlan]);

  const handleUpgrade = async (planKey: string) => {
    if (!workspaceId) return;
    setCheckoutLoading(planKey);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey, workspace_id: workspaceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageBilling = async () => {
    if (!workspaceId) return;
    setPortalLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Portal error:', err);
    } finally {
      setPortalLoading(false);
    }
  };

  const toggleAlert = (key: keyof typeof alerts) => {
    setAlerts(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleResetProject = () => {
    setActiveProject(null);
    setWebsiteProfile(null);
    setLeads([]);
    router.push('/onboarding');
  };

  const handleClearLeads = () => {
    setLeads([]);
  };

  const isOnPaidPlan = plan === 'pro' || plan === 'enterprise';

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopBar title="Settings" />

      <div className="p-6 max-w-2xl space-y-4">

        {/* Upgrade success banner */}
        {upgradeSuccess && (
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-300">
              Welcome to {plan.charAt(0).toUpperCase() + plan.slice(1)}! Your plan has been upgraded.
            </p>
          </div>
        )}

        {/* Current Project */}
        {activeProject && (
          <SettingsSection title="Project" description="Your active lead discovery project" icon={Globe}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <Globe className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">{activeProject.name}</p>
                  <p className="text-xs text-zinc-500">{extractDomain(activeProject.website_url)}</p>
                </div>
              </div>
              <Badge variant="success">Active</Badge>
            </div>

            {websiteProfile && (
              <div className="bg-zinc-800/50 rounded-lg p-3 mb-4 border border-zinc-800">
                <p className="text-xs font-medium text-zinc-400 mb-2">Extracted Profile</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-zinc-500">Product: </span>
                    <span className="text-zinc-300">{websiteProfile.product_name}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Industry: </span>
                    <span className="text-zinc-300">{websiteProfile.industry}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Keywords: </span>
                    <span className="text-zinc-300">{websiteProfile.keywords?.length || 0}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Competitors: </span>
                    <span className="text-zinc-300">{websiteProfile.competitors?.length || 0}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push('/onboarding')}
                leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              >
                Re-analyze Website
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetProject}
                className="text-zinc-500 hover:text-red-400"
                leftIcon={<LogOut className="h-3.5 w-3.5" />}
              >
                Reset Project
              </Button>
            </div>
          </SettingsSection>
        )}

        {/* AI Profile */}
        {websiteProfile && (
          <SettingsSection title="AI Intelligence" description="Extracted business signals" icon={Sparkles}>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-zinc-400 mb-1.5">Keywords</p>
                <div className="flex flex-wrap gap-1.5">
                  {(websiteProfile.keywords || []).map((kw) => (
                    <span key={kw} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-700/50">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-400 mb-1.5">Pain Points</p>
                <div className="flex flex-wrap gap-1.5">
                  {(websiteProfile.pain_points || []).map((pp) => (
                    <span key={pp} className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20">
                      {pp}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-400 mb-1.5">Competitors Tracked</p>
                <div className="flex flex-wrap gap-1.5">
                  {(websiteProfile.competitors || []).map((c) => (
                    <span key={c} className="text-xs bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/20">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </SettingsSection>
        )}

        {/* Billing / Plan */}
        <SettingsSection title="Plan & Billing" description="Your current subscription" icon={CreditCard}>
          {/* Current plan status */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-800/50">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-zinc-200 capitalize">{plan} Plan</p>
                {plan === 'free' && (
                  <Badge variant="outline">Free</Badge>
                )}
                {plan === 'pro' && (
                  <Badge variant="success">Active</Badge>
                )}
                {plan === 'enterprise' && (
                  <Badge variant="info">Enterprise</Badge>
                )}
              </div>
              <p className="text-xs text-zinc-500">
                {plan === 'free' && '25 leads/day · Basic AI replies'}
                {plan === 'pro' && '250 leads/day · Full AI features · Daily digest'}
                {plan === 'enterprise' && 'Unlimited · X/Twitter · API access'}
              </p>
            </div>
            {isOnPaidPlan && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleManageBilling}
                loading={portalLoading}
                leftIcon={<ExternalLink className="h-3.5 w-3.5" />}
                className="text-zinc-400"
              >
                Manage
              </Button>
            )}
          </div>

          {/* Plan cards */}
          {!isOnPaidPlan && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PLANS.map(({ key, name, price, features, highlight }) => (
                <div
                  key={key}
                  className={cn(
                    'relative border rounded-xl p-4 transition-colors',
                    highlight
                      ? 'bg-violet-950/30 border-violet-500/40'
                      : 'bg-zinc-800/30 border-zinc-700/50'
                  )}
                >
                  {highlight && (
                    <div className="absolute -top-2.5 left-4">
                      <span className="bg-violet-600 text-white text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Zap className="h-2.5 w-2.5" /> Most Popular
                      </span>
                    </div>
                  )}
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-zinc-100">{name}</p>
                    <p className={cn('text-lg font-bold', highlight ? 'text-violet-400' : 'text-zinc-300')}>
                      {price}
                    </p>
                  </div>
                  <ul className="space-y-1.5 mb-4">
                    {features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-zinc-400">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={highlight ? 'primary' : 'secondary'}
                    size="sm"
                    className="w-full"
                    onClick={() => key !== 'enterprise' ? handleUpgrade(key) : window.open('mailto:hello@signaldesk.ai', '_blank')}
                    loading={checkoutLoading === key}
                  >
                    {key === 'enterprise' ? 'Contact Sales' : `Upgrade to ${name}`}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {isOnPaidPlan && (
            <div className="bg-zinc-800/30 rounded-lg p-3 border border-zinc-700/50">
              <p className="text-xs text-zinc-500">
                To change or cancel your subscription, use the billing portal above.
              </p>
            </div>
          )}
        </SettingsSection>

        {/* Alerts */}
        <SettingsSection title="Alerts & Notifications" description="Configure when to be notified" icon={Bell}>
          <Toggle
            checked={alerts.high_intent}
            onChange={() => toggleAlert('high_intent')}
            label="High Intent Alerts"
            description="Get notified when a lead scores 80+ intent"
          />
          <Toggle
            checked={alerts.daily_digest}
            onChange={() => toggleAlert('daily_digest')}
            label="Daily Digest"
            description="Morning summary of new leads"
          />
          <Toggle
            checked={alerts.competitor_mention}
            onChange={() => toggleAlert('competitor_mention')}
            label="Competitor Mentions"
            description="Alert when competitors are mentioned"
          />
          <Toggle
            checked={alerts.email_notifications}
            onChange={() => toggleAlert('email_notifications')}
            label="Email Notifications"
            description="Receive alerts via email"
          />
        </SettingsSection>

        {/* API Keys */}
        <SettingsSection title="API Configuration" description="Manage your API connections" icon={Key}>
          <div className="space-y-3">
            {[
              { name: 'Anthropic (Claude)', status: 'configured', env: 'ANTHROPIC_API_KEY' },
              { name: 'Reddit API', status: 'using-public', env: 'Optional' },
              { name: 'Supabase', status: 'configured', env: 'NEXT_PUBLIC_SUPABASE_URL' },
              { name: 'Stripe', status: 'configure', env: 'STRIPE_SECRET_KEY' },
              { name: 'Resend (Email)', status: 'configure', env: 'RESEND_API_KEY' },
            ].map(({ name, status, env }) => (
              <div key={name} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                <div>
                  <p className="text-sm text-zinc-300">{name}</p>
                  <p className="text-xs text-zinc-500 font-mono">{env}</p>
                </div>
                <Badge
                  variant={status === 'configured' ? 'success' : status === 'using-public' ? 'warning' : 'outline'}
                >
                  {status === 'configured' ? 'Connected' : status === 'using-public' ? 'Public API' : 'Set in .env'}
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-600 mt-3">
            Configure API keys in your .env.local file
          </p>
        </SettingsSection>

        {/* Data Management */}
        <SettingsSection title="Data Management" description="Manage your lead data" icon={Database}>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleClearLeads}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Clear Lead Cache
            </Button>
          </div>
        </SettingsSection>

      </div>
    </div>
  );
}
