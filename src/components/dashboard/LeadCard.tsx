'use client';

import { useState } from 'react';
import {
  ExternalLink,
  Copy,
  Bookmark,
  BookmarkCheck,
  X,
  CheckCircle2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Zap,
  Clock,
  ArrowUp,
  MessageCircle,
  Sparkles,
  StickyNote,
} from 'lucide-react';
import { cn, formatRelativeTime, getStatusColor, truncateText } from '@/lib/utils';
import type { Lead, ReplySuggestion, WebsiteProfile } from '@/types';
import { IntentScoreRing, ScoreBreakdown } from './IntentScore';
import { LeadCRMPanel } from './LeadCRMPanel';
import { OpportunityBadges } from './OpportunityBadges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';

interface LeadCardProps {
  lead: Lead;
  websiteProfile?: WebsiteProfile | null;
  onStatusChange?: (leadId: string, status: Lead['status']) => void;
  className?: string;
}

export function LeadCard({ lead, websiteProfile, onStatusChange, className }: LeadCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCRM, setShowCRM] = useState(false);
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [reply, setReply] = useState<ReplySuggestion | null>(null);
  const [copiedReply, setCopiedReply] = useState(false);
  const [copiedDm, setCopiedDm] = useState(false);
  const [replyTracked, setReplyTracked] = useState(false);
  const [activeTone, setActiveTone] = useState<'standard' | 'less_salesy' | 'more_helpful' | 'direct'>('standard');
  const { workspaceId, activeProject } = useAppStore();

  const score = lead.score;
  const intentScore = (score as any)?.final_score ?? score?.intent_score ?? 0;

  const handleStatus = async (newStatus: Lead['status']) => {
    onStatusChange?.(lead.id, newStatus);
    fetch('/api/leads/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: lead.id, status: newStatus, workspace_id: workspaceId }),
    }).catch(console.error);
  };

  const handleGenerateReply = async (tone: typeof activeTone = activeTone) => {
    if (!websiteProfile) return;
    setIsGeneratingReply(true);
    setActiveTone(tone);

    try {
      const res = await fetch('/api/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_title: lead.title,
          post_body: lead.body,
          subreddit: lead.subreddit,
          product_name: websiteProfile.product_name,
          target_customer: websiteProfile.target_customer,
          pain_points: websiteProfile.pain_points,
          features: websiteProfile.features,
          match_reasons: score?.match_reasons || [],
          tone_variant: tone,
          lead_id: lead.id,
          project_id: activeProject?.id,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setReply(data.reply);
        setIsExpanded(true);
      }
    } catch (error) {
      console.error('Reply generation error:', error);
    } finally {
      setIsGeneratingReply(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'reply' | 'dm') => {
    await navigator.clipboard.writeText(text);
    if (type === 'reply') {
      setCopiedReply(true);
      setTimeout(() => setCopiedReply(false), 2000);
    } else {
      setCopiedDm(true);
      setTimeout(() => setCopiedDm(false), 2000);
    }
  };

  const markAsReplied = () => {
    handleStatus('replied');
    setReplyTracked(true);
  };

  const handleOpenPost = () => {
    window.open(lead.url, '_blank', 'noopener,noreferrer');
    handleStatus('opened');
  };

  const isSaved = lead.status === 'saved';
  const isDismissed = lead.status === 'dismissed';

  if (isDismissed) return null;

  return (
    <article
      className={cn(
        'bg-zinc-900 border border-zinc-800 rounded-xl transition-all duration-150 hover:border-zinc-700',
        intentScore >= 80 && 'border-l-2 border-l-emerald-500/60',
        intentScore >= 60 && intentScore < 80 && 'border-l-2 border-l-yellow-500/40',
        className
      )}
    >
      {/* Card Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          {/* Intent Score Ring */}
          <div className="flex-shrink-0 pt-0.5">
            <IntentScoreRing score={intentScore} size="sm" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Meta row */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {/* Source indicator */}
              {lead.source === 'twitter' ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-400">
                  {/* X (Twitter) logo */}
                  <svg
                    className="h-3 w-3 flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-label="X (Twitter)"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.739l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  X (Twitter)
                </span>
              ) : (
                <span className="text-xs font-medium text-orange-400/80">
                  r/{lead.subreddit || 'reddit'}
                </span>
              )}
              <span className="text-zinc-700">·</span>
              <span className="text-xs text-zinc-500">
                {lead.source === 'twitter' ? '@' : 'u/'}
                {lead.author || 'anonymous'}
              </span>
              <span className="text-zinc-700">·</span>
              <span className="text-xs text-zinc-500 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {lead.posted_at ? formatRelativeTime(lead.posted_at) : 'recently'}
              </span>
              <div className="flex items-center gap-1 ml-auto">
                <span className={cn('text-xs px-2 py-0.5 rounded-full border', getStatusColor(lead.status))}>
                  {lead.status}
                </span>
              </div>
            </div>

            {/* Title */}
            <h3 className="text-sm font-medium text-zinc-100 leading-snug mb-1.5">
              {lead.title}
            </h3>

            {/* Body preview */}
            {lead.body && (
              <p className="text-xs text-zinc-500 leading-relaxed">
                {truncateText(lead.body, 140)}
              </p>
            )}

            {/* Opportunity indicators */}
            <OpportunityBadges lead={lead} />

            {/* Engagement stats */}
            <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1 text-xs text-zinc-600">
                <ArrowUp className="h-3 w-3" />
                {lead.upvotes || 0}
              </span>
              <span className="flex items-center gap-1 text-xs text-zinc-600">
                <MessageCircle className="h-3 w-3" />
                {lead.comment_count || 0} comments
              </span>
            </div>
          </div>
        </div>

        {/* Why this matched */}
        {score?.match_reasons && score.match_reasons.length > 0 && (
          <div className="mt-3 pt-3 border-t border-zinc-800/60">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Zap className="h-3 w-3 text-violet-400" />
              <span className="text-xs font-medium text-violet-400">Why this matched</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {score.match_reasons.map((reason, i) => (
                <span
                  key={i}
                  className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full border border-zinc-700/50"
                >
                  {reason}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Score Breakdown (expandable) */}
      {isExpanded && score && (
        <div className="px-4 pb-3">
          <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-800">
            <p className="text-xs font-medium text-zinc-400 mb-2.5">Score Breakdown</p>
            <ScoreBreakdown
              intent_score={score.intent_score}
              pain_score={score.pain_score}
              urgency_score={score.urgency_score}
              relevance_score={score.relevance_score}
            />
          </div>
        </div>
      )}

      {/* Generated Reply */}
      {reply && isExpanded && (
        <div className="px-4 pb-3">
          <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-800 space-y-3">
            {/* Tone variant buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {([
                { key: 'standard',      label: 'Standard' },
                { key: 'less_salesy',   label: 'Less Salesy' },
                { key: 'more_helpful',  label: 'More Helpful' },
                { key: 'direct',        label: 'Direct' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleGenerateReply(key)}
                  disabled={isGeneratingReply}
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full border transition-all',
                    activeTone === key
                      ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                      : 'border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
                  )}
                >
                  {label}
                </button>
              ))}
              <span className="text-zinc-700 mx-1">·</span>
              <button
                onClick={() => handleGenerateReply(activeTone)}
                disabled={isGeneratingReply}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
              >
                ↺ Regenerate
              </button>
            </div>

            {/* Reply safety scores */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  reply.spam_risk === 'LOW' ? 'bg-emerald-400' : reply.spam_risk === 'MEDIUM' ? 'bg-yellow-400' : 'bg-red-400'
                )} />
                <span className={cn(
                  'text-xs font-medium',
                  reply.spam_risk === 'LOW' ? 'text-emerald-400' : reply.spam_risk === 'MEDIUM' ? 'text-yellow-400' : 'text-red-400'
                )}>
                  Spam Risk: {reply.spam_risk}
                </span>
              </div>
              <span className="text-zinc-700">·</span>
              <span className="text-xs text-zinc-500">Tone: {reply.natural_tone_score}/100</span>
              <span className="text-zinc-700">·</span>
              <span className="text-xs text-zinc-500">Promotion: {reply.promotion_level}</span>
            </div>

            {/* Comment Reply */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-zinc-400 flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  Comment Reply
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => copyToClipboard(reply.reply_text, 'reply')}
                  leftIcon={<Copy className="h-3 w-3" />}
                >
                  {copiedReply ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900 rounded-lg p-2.5 ai-text border border-zinc-800">
                {reply.reply_text}
              </p>

              {/* Reply success tracking */}
              <div className="flex items-center gap-2 mt-2">
                {replyTracked ? (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Tracked as replied
                  </span>
                ) : (
                  <button
                    onClick={markAsReplied}
                    className="text-[10px] text-zinc-500 hover:text-teal-400 transition-colors flex items-center gap-1"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Sent it? Mark as replied
                  </button>
                )}
              </div>
            </div>

            {/* DM Version */}
            {reply.dm_text && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-zinc-400">DM Version</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => copyToClipboard(reply.dm_text!, 'dm')}
                    leftIcon={<Copy className="h-3 w-3" />}
                  >
                    {copiedDm ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-900 rounded-lg p-2.5 border border-zinc-800">
                  {reply.dm_text}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Card Actions */}
      <div className="px-4 pb-4 pt-1 flex items-center gap-2 flex-wrap">
        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenPost}
          leftIcon={<ExternalLink className="h-3.5 w-3.5" />}
          className="h-7 px-3 text-xs"
        >
          Open Post
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleGenerateReply()}
          loading={isGeneratingReply}
          leftIcon={<Sparkles className="h-3.5 w-3.5" />}
          className="h-7 px-3 text-xs"
          disabled={!websiteProfile}
        >
          {reply ? 'Regenerate' : 'AI Reply'}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleStatus(isSaved ? 'new' : 'saved')}
          leftIcon={isSaved ? <BookmarkCheck className="h-3.5 w-3.5 text-violet-400" /> : <Bookmark className="h-3.5 w-3.5" />}
          className={cn('h-7 px-3 text-xs', isSaved && 'text-violet-400')}
        >
          {isSaved ? 'Saved' : 'Save'}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleStatus('contacted')}
          leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
          className={cn('h-7 px-3 text-xs', lead.status === 'contacted' && 'text-emerald-400')}
        >
          Contacted
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleStatus('dismissed')}
          leftIcon={<X className="h-3.5 w-3.5" />}
          className="h-7 px-3 text-xs text-zinc-600 hover:text-zinc-400 ml-auto"
        >
          Dismiss
        </Button>

        {/* CRM toggle */}
        <button
          onClick={() => setShowCRM(!showCRM)}
          title="Notes & pipeline"
          className={cn(
            'flex items-center gap-1 text-xs transition-colors h-7 px-2 rounded',
            showCRM
              ? 'text-violet-400 bg-violet-500/10'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60'
          )}
        >
          <StickyNote className="h-3.5 w-3.5" />
        </button>

        {/* Expand/Collapse */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors ml-1"
        >
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {isExpanded ? 'Less' : 'More'}
        </button>
      </div>

      {/* CRM Panel */}
      {showCRM && (
        <LeadCRMPanel
          leadId={lead.id}
          currentStatus={lead.status}
          onStatusChange={handleStatus}
        />
      )}
    </article>
  );
}
