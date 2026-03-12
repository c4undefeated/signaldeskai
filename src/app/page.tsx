'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Radio, Zap, Search, ArrowRight, CheckCircle2,
  TrendingUp, MessageSquare, Bell, BarChart3,
  Clock, Menu, X, ChevronRight, Star,
  Target, Brain, Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={cn(
      'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
      scrolled ? 'bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/60' : 'bg-transparent',
    )}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-violet-600/40">
            <Radio className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-white text-sm tracking-tight">SignalDesk AI</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {[
            { label: 'Features', href: '#features' },
            { label: 'How it works', href: '#how-it-works' },
            { label: 'Pricing', href: '#pricing' },
          ].map(({ label, href }) => (
            <a key={href} href={href} className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
              {label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/auth" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors px-3 py-1.5">
            Sign in
          </Link>
          <Link
            href="/auth?mode=signup"
            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-lg shadow-violet-600/20"
          >
            Get started free
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <button onClick={() => setOpen(!open)} className="md:hidden text-zinc-400 hover:text-white">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-zinc-900 border-t border-zinc-800 px-6 py-4 space-y-3">
          {[
            { label: 'Features', href: '#features' },
            { label: 'How it works', href: '#how-it-works' },
            { label: 'Pricing', href: '#pricing' },
          ].map(({ label, href }) => (
            <a key={href} href={href} className="block text-sm text-zinc-400 py-1.5" onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
          <div className="pt-3 border-t border-zinc-800 flex flex-col gap-2">
            <Link href="/auth" className="text-sm text-zinc-400 text-center py-2">Sign in</Link>
            <Link href="/auth?mode=signup"
              className="text-center bg-violet-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg">
              Get started free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative pt-32 pb-20 px-6 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute top-20 left-1/4 w-[300px] h-[300px] bg-indigo-600/8 rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto text-center relative">
        <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/25 rounded-full px-4 py-1.5 mb-8">
          <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
          <span className="text-xs font-medium text-violet-300">AI-Powered Reddit Lead Discovery</span>
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6 tracking-tight">
          Find buyers{' '}
          <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            already looking
          </span>
          <br />for what you sell
        </h1>

        <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          SignalDesk AI scans thousands of Reddit conversations in real time, ranks every post
          by buying intent, and writes authentic replies — turning social listening into your
          #1 lead source.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
          <Link
            href="/auth?mode=signup"
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-7 py-3.5 rounded-xl transition-all shadow-xl shadow-violet-600/25 hover:shadow-violet-500/30 hover:-translate-y-0.5"
          >
            Start for free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#how-it-works"
            className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 font-medium px-5 py-3.5 rounded-xl border border-zinc-800 hover:border-zinc-600 transition-all"
          >
            See how it works
            <ChevronRight className="h-4 w-4" />
          </a>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-8 text-sm">
          {[
            { value: '200+', label: 'B2B subreddits scanned' },
            { value: '0–100', label: 'Intent score per lead' },
            { value: '< 60s', label: 'Setup time' },
            { value: 'Free', label: 'No credit card needed' },
          ].map(({ value, label }) => (
            <div key={label} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
              <span className="text-zinc-300 font-semibold">{value}</span>
              <span className="text-zinc-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dashboard mockup */}
      <div className="max-w-5xl mx-auto mt-16 relative">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur overflow-hidden shadow-2xl shadow-zinc-950/80">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800/80 bg-zinc-900">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
            <div className="flex-1 mx-4 bg-zinc-800 rounded-md h-6 flex items-center px-3">
              <span className="text-xs text-zinc-500">app.signaldesk.ai/leads</span>
            </div>
          </div>

          <div className="p-5 space-y-3">
            {[
              {
                score: 94, color: 'text-emerald-400', sub: 'r/entrepreneur',
                title: "Looking for a CRM that doesn't cost an arm and a leg — alternatives to HubSpot?",
                signals: ['buying intent', 'competitor mention', 'budget signal'],
              },
              {
                score: 87, color: 'text-emerald-400', sub: 'r/SaaS',
                title: "We're a 5-person startup — what's the best lead tracking tool for small teams?",
                signals: ['buying intent', 'problem signal'],
              },
              {
                score: 76, color: 'text-yellow-400', sub: 'r/smallbusiness',
                title: 'Frustrated with Salesforce complexity. Need something simpler for outreach.',
                signals: ['pain signal', 'competitor mention'],
              },
            ].map((lead, i) => (
              <div key={i} className="flex items-start gap-4 bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                <div className="relative w-11 h-11 flex-shrink-0">
                  <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
                    <circle cx="22" cy="22" r="18" fill="none" stroke="#27272a" strokeWidth="4" />
                    <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor"
                      strokeWidth="4" strokeLinecap="round"
                      strokeDasharray={`${(lead.score / 100) * 113} 113`}
                      className={lead.color} />
                  </svg>
                  <span className={cn('absolute inset-0 flex items-center justify-center text-[11px] font-bold', lead.color)}>
                    {lead.score}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-1.5 mb-1">
                    <span className="text-xs text-zinc-500">{lead.sub}</span>
                    {lead.signals.map((s) => (
                      <span key={s} className="text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 px-1.5 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                  <p className="text-sm text-zinc-200 leading-snug">{lead.title}</p>
                </div>
                <button className="flex-shrink-0 flex items-center gap-1.5 bg-violet-600/20 hover:bg-violet-600/40 text-violet-400 text-xs px-3 py-1.5 rounded-lg border border-violet-500/20 transition-colors">
                  <Sparkles className="h-3 w-3" /> Reply
                </button>
              </div>
            ))}
            <div className="flex items-center justify-center gap-2 py-2">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-xs text-zinc-500">Scanning Reddit live — 3 new leads in the last 2 minutes</span>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-2/3 h-16 bg-violet-600/15 blur-3xl rounded-full" />
      </div>
    </section>
  );
}

// ─── Trust bar ────────────────────────────────────────────────────────────────
function TrustBar() {
  return (
    <section className="border-y border-zinc-800/60 bg-zinc-900/30 py-5 px-6 mt-8">
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
        <p className="text-xs text-zinc-600 uppercase tracking-wider font-medium">Powered by</p>
        {[
          { name: 'Claude AI', color: 'text-orange-400' },
          { name: 'Reddit API', color: 'text-red-400' },
          { name: 'Supabase', color: 'text-emerald-400' },
          { name: 'Stripe', color: 'text-violet-400' },
          { name: 'Vercel', color: 'text-zinc-300' },
        ].map(({ name, color }) => (
          <span key={name} className={cn('text-sm font-semibold', color)}>{name}</span>
        ))}
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      step: '01',
      icon: Brain,
      title: 'Analyze your website',
      description: 'Paste your URL. Our AI crawls your site and extracts product signals — keywords, pain points, competitors, and buyer personas. 30 seconds.',
      color: 'text-violet-400',
      bg: 'bg-violet-500/10 border-violet-500/20',
    },
    {
      step: '02',
      icon: Search,
      title: 'We scan Reddit non-stop',
      description: 'Continuous multi-dimensional searches across 200+ B2B subreddits. Every post scored 0–100 for buying intent, pain signals, urgency, and competitor mentions.',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
    },
    {
      step: '03',
      icon: MessageSquare,
      title: 'Reply and convert',
      description: 'One click generates an authentic, Reddit-safe reply that sounds human. Copy it, post it, start a real conversation with an active buyer.',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
  ];

  return (
    <section id="how-it-works" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-3">How it works</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Up and running in under 60 seconds</h2>
          <p className="text-zinc-400 max-w-xl mx-auto">No integrations. No webhooks. No setup overhead. Just paste your URL and go.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-12 left-[37%] right-[37%] h-px bg-gradient-to-r from-violet-500/40 via-blue-500/40 to-emerald-500/40" />
          {steps.map(({ step, icon: Icon, title, description, color, bg }) => (
            <div key={step} className="relative">
              <div className={cn('w-12 h-12 rounded-2xl border flex items-center justify-center mb-5', bg)}>
                <Icon className={cn('h-5 w-5', color)} />
              </div>
              <div className="absolute top-0 right-0 text-5xl font-black text-zinc-800/50 select-none leading-none">
                {step}
              </div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-2">{title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────
function Features() {
  const features = [
    {
      icon: Brain,
      title: 'Website Intelligence Engine',
      description: 'Crawl once. Extract product name, pain points, competitors, buyer personas, and 8+ intent keywords — all automatically.',
      color: 'text-violet-400',
      bg: 'bg-violet-500/10 border-violet-500/20',
    },
    {
      icon: BarChart3,
      title: '0–100 Intent Scoring',
      description: 'Not just keyword matching. Every post scored on buying signals, pain intensity, urgency, relevance, freshness, and community engagement.',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
    },
    {
      icon: Search,
      title: 'Multi-Dimensional Discovery',
      description: 'Searches by keyword, pain phrase, competitor mention, and buyer intent phrase — simultaneously across 200+ B2B subreddits.',
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
    },
    {
      icon: Sparkles,
      title: 'AI Reply Generator',
      description: '4 tone variants: Standard, Less Salesy, More Helpful, Direct. Every reply validated for spam risk before you see it.',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      icon: Target,
      title: 'Lead Pipeline',
      description: 'Track every lead through New → Saved → Opened → Replied → Contacted. Full action history logged per workspace.',
      color: 'text-orange-400',
      bg: 'bg-orange-500/10 border-orange-500/20',
    },
    {
      icon: Bell,
      title: 'Daily Digest Email',
      description: 'Wake up to your top 10 leads from the last 24 hours, ranked by intent score. Straight to your inbox every morning.',
      color: 'text-pink-400',
      bg: 'bg-pink-500/10 border-pink-500/20',
    },
  ];

  return (
    <section id="features" className="py-24 px-6 bg-zinc-900/30">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-3">Features</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Everything you need to turn Reddit into pipeline</h2>
          <p className="text-zinc-400 max-w-xl mx-auto">Built for founders and growth teams who want signal, not noise.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title, description, color, bg }) => (
            <div key={title} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
              <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center mb-4', bg)}>
                <Icon className={cn('h-5 w-5', color)} />
              </div>
              <h3 className="text-sm font-semibold text-zinc-100 mb-2">{title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Intent score visual ──────────────────────────────────────────────────────
function IntentDemo() {
  const signals = [
    { label: 'Buying Intent Score', score: 92, color: 'bg-emerald-500', sub: '"any recommendations", "best tool for", "alternatives to"' },
    { label: 'Pain Signal Score', score: 78, color: 'bg-orange-500', sub: '"frustrated with", "hate using", "doesn\'t work"' },
    { label: 'Urgency Score', score: 65, color: 'bg-yellow-500', sub: '"ASAP", "this week", "launching soon"' },
    { label: 'Relevance Score', score: 88, color: 'bg-violet-500', sub: '6 keywords matched, 2 competitors mentioned' },
  ];

  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-3">Intent Scoring</p>
            <h2 className="text-3xl font-bold text-white mb-4">Not keywords. Buyer signals.</h2>
            <p className="text-zinc-400 leading-relaxed mb-6">
              Every Reddit post is broken down into four scored dimensions. The composite score tells you
              exactly how ready this person is to buy — not just whether they mentioned a relevant word.
            </p>
            <ul className="space-y-3">
              {[
                'Weighted formula — buying intent weighted 40%',
                'Freshness decay — older posts score lower automatically',
                'Unanswered post bonus — catch opportunities first',
                'Competitor mention amplification — score boost',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-400">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm font-medium text-zinc-300">Score Breakdown</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-emerald-400">91</span>
                <span className="text-sm text-zinc-500">/ 100</span>
              </div>
            </div>
            <div className="space-y-4">
              {signals.map(({ label, score, color, sub }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-zinc-300">{label}</span>
                    <span className="text-xs font-bold text-zinc-200">{score}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', color)} style={{ width: `${score}%` }} />
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-1 truncate">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Social proof ─────────────────────────────────────────────────────────────
function SocialProof() {
  const quotes = [
    {
      text: "We went from spending 3 hours manually browsing Reddit to having 20 qualified leads in my inbox every morning. This is the tool I've been looking for.",
      name: 'Marcus T.', role: 'Founder, B2B SaaS', score: '94',
    },
    {
      text: "The intent scoring is scary accurate. I only reply to leads scoring 75+, and my conversion rate from Reddit DM to demo call is now 28%.",
      name: 'Sarah K.', role: 'Head of Growth', score: '87',
    },
    {
      text: "The AI replies actually sound human. We've been using it for 2 months and not a single post has been flagged as spam.",
      name: 'David R.', role: 'Marketing Lead', score: '91',
    },
  ];

  return (
    <section className="py-24 px-6 bg-zinc-900/30">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-3">Early Users</p>
          <h2 className="text-3xl font-bold text-white">Founders closing from Reddit</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {quotes.map(({ text, name, role, score }) => (
            <div key={name} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-center gap-0.5 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 text-yellow-400" fill="currentColor" />
                ))}
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed mb-5 italic">"{text}"</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{name}</p>
                  <p className="text-xs text-zinc-500">{role}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-zinc-600">Avg lead score</p>
                  <p className="text-sm font-bold text-emerald-400">{score}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
function Pricing() {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'For founders testing the concept.',
      features: ['25 leads / day', '5 AI replies / day', '1 project', 'Reddit discovery', 'Intent scoring', 'Lead pipeline'],
      cta: 'Start for free',
      href: '/auth?mode=signup',
      highlight: false,
    },
    {
      name: 'Pro',
      price: '$49',
      period: '/ month',
      description: 'For teams actively closing from Reddit.',
      features: ['250 leads / day', '50 AI replies / day', '5 projects', '4 reply tone variants', 'Daily digest email', 'Priority support'],
      cta: 'Upgrade to Pro',
      href: '/auth?mode=signup',
      highlight: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'For large teams and custom use cases.',
      features: ['Unlimited leads', 'Unlimited replies', 'Unlimited projects', 'X/Twitter + LinkedIn', 'API access', 'Dedicated support'],
      cta: 'Contact sales',
      href: 'mailto:hello@signaldesk.ai',
      highlight: false,
    },
  ];

  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-3">Pricing</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Simple, transparent pricing</h2>
          <p className="text-zinc-400">Start free. Upgrade when leads start closing.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {plans.map(({ name, price, period, description, features, cta, href, highlight }) => (
            <div key={name} className={cn(
              'relative rounded-2xl p-6 border transition-all',
              highlight
                ? 'bg-violet-950/40 border-violet-500/50 shadow-xl shadow-violet-900/20'
                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700',
            )}>
              {highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="flex items-center gap-1 bg-violet-600 text-white text-[11px] font-semibold px-3 py-1 rounded-full shadow-lg">
                    <Star className="h-3 w-3" fill="currentColor" /> Most Popular
                  </span>
                </div>
              )}

              <div className="mb-5">
                <p className="text-sm font-semibold text-zinc-300 mb-1">{name}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className={cn('text-3xl font-black', highlight ? 'text-white' : 'text-zinc-100')}>{price}</span>
                  {period && <span className="text-sm text-zinc-500">{period}</span>}
                </div>
                <p className="text-xs text-zinc-500">{description}</p>
              </div>

              <ul className="space-y-2.5 mb-7">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-zinc-400">
                    <CheckCircle2 className={cn('h-3.5 w-3.5 flex-shrink-0', highlight ? 'text-violet-400' : 'text-emerald-400')} />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={href}
                className={cn(
                  'flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all',
                  highlight
                    ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/25'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200',
                )}
              >
                {cta}
                {highlight && <ArrowRight className="h-3.5 w-3.5" />}
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-zinc-600 mt-8">
          All plans include unlimited intent scoring. No hidden fees. Cancel anytime.
        </p>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <div className="relative bg-gradient-to-br from-violet-950/60 to-zinc-900 border border-violet-500/25 rounded-3xl p-12 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-violet-600/20 blur-3xl rounded-full" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-violet-500/15 border border-violet-500/25 rounded-full px-4 py-1.5 mb-6">
              <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-violet-300">Live on Reddit right now</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Start discovering leads<br />in under 60 seconds
            </h2>
            <p className="text-zinc-400 mb-8">Free plan. No credit card. No integrations. Just paste your URL.</p>
            <Link
              href="/auth?mode=signup"
              className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-8 py-3.5 rounded-xl transition-all shadow-xl shadow-violet-600/25 hover:-translate-y-0.5"
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="text-xs text-zinc-600 mt-4">
              Already have an account?{' '}
              <Link href="/auth" className="text-zinc-400 hover:text-zinc-200 transition-colors">Sign in →</Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-zinc-800/60 py-10 px-6">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center">
            <Radio className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-bold text-zinc-300 text-sm">SignalDesk AI</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-500">
          <Link href="/auth" className="hover:text-zinc-300 transition-colors">Sign in</Link>
          <Link href="/auth?mode=signup" className="hover:text-zinc-300 transition-colors">Sign up</Link>
          <a href="#pricing" className="hover:text-zinc-300 transition-colors">Pricing</a>
          <a href="mailto:hello@signaldesk.ai" className="hover:text-zinc-300 transition-colors">Contact</a>
        </div>
        <p className="text-xs text-zinc-600">© {new Date().getFullYear()} SignalDesk AI</p>
      </div>
    </footer>
  );
}

// ─── Page entry ───────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace('/leads');
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <Hero />
      <TrustBar />
      <HowItWorks />
      <Features />
      <IntentDemo />
      <SocialProof />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}
