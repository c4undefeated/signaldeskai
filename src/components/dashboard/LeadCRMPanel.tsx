'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Bookmark,
  CheckCircle2,
  Trophy,
  X,
  MessageSquare,
  ExternalLink,
  Circle,
  Clock,
  StickyNote,
  Save,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { LeadStatus, CRMHistoryEntry } from '@/types';

// ── Pipeline definition ───────────────────────────────────────────────────────

interface PipelineStage {
  status: LeadStatus;
  label: string;
  icon: React.ElementType;
  activeClass: string;   // ring + text when this stage is active
  dotClass: string;      // dot fill when reached
}

const PIPELINE: PipelineStage[] = [
  {
    status: 'new',
    label: 'New',
    icon: Circle,
    activeClass: 'text-blue-400 border-blue-500/50 bg-blue-500/10',
    dotClass: 'bg-blue-500',
  },
  {
    status: 'saved',
    label: 'Saved',
    icon: Bookmark,
    activeClass: 'text-purple-400 border-purple-500/50 bg-purple-500/10',
    dotClass: 'bg-purple-500',
  },
  {
    status: 'contacted',
    label: 'Contacted',
    icon: CheckCircle2,
    activeClass: 'text-teal-400 border-teal-500/50 bg-teal-500/10',
    dotClass: 'bg-teal-500',
  },
  {
    status: 'closed',
    label: 'Closed',
    icon: Trophy,
    activeClass: 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10',
    dotClass: 'bg-emerald-500',
  },
  {
    status: 'dismissed',
    label: 'Dismissed',
    icon: X,
    activeClass: 'text-zinc-400 border-zinc-600 bg-zinc-800',
    dotClass: 'bg-zinc-500',
  },
];

// Statuses not shown in the pipeline bar (intermediate sub-states)
const PIPELINE_STATUSES = PIPELINE.map((s) => s.status);

function stageIndex(status: LeadStatus): number {
  const idx = PIPELINE_STATUSES.indexOf(status);
  // Sub-states: 'opened' ≈ between saved(1) and contacted(2)
  //             'replied' ≈ same as contacted(2)
  if (idx !== -1) return idx;
  if (status === 'opened') return 1;
  if (status === 'replied') return 2;
  return 0;
}

// ── History action metadata ───────────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  new:       { label: 'Lead added',    icon: Circle,       color: 'text-blue-400' },
  saved:     { label: 'Saved',         icon: Bookmark,     color: 'text-purple-400' },
  opened:    { label: 'Post opened',   icon: ExternalLink, color: 'text-yellow-400' },
  replied:   { label: 'Replied',       icon: MessageSquare, color: 'text-emerald-400' },
  contacted: { label: 'Contacted',     icon: CheckCircle2, color: 'text-teal-400' },
  closed:    { label: 'Closed (won)',  icon: Trophy,       color: 'text-emerald-400' },
  dismissed: { label: 'Dismissed',     icon: X,            color: 'text-zinc-500' },
};

function actionMeta(action: string) {
  return ACTION_META[action] ?? { label: action, icon: Clock, color: 'text-zinc-500' };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PipelineBar({
  currentStatus,
  onStatusChange,
}: {
  currentStatus: LeadStatus;
  onStatusChange: (s: LeadStatus) => void;
}) {
  const activeIdx = stageIndex(currentStatus);

  return (
    <div>
      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">
        Pipeline Stage
      </p>
      <div className="flex items-center gap-0">
        {PIPELINE.map((stage, idx) => {
          const isCurrent = currentStatus === stage.status;
          const isReached = idx <= activeIdx;
          const isLast = idx === PIPELINE.length - 1;
          const Icon = stage.icon;

          return (
            <div key={stage.status} className="flex items-center flex-1 min-w-0">
              {/* Stage button */}
              <button
                onClick={() => onStatusChange(stage.status)}
                title={`Move to ${stage.label}`}
                className={cn(
                  'flex flex-col items-center gap-1 group flex-shrink-0 transition-all duration-150',
                  'focus:outline-none'
                )}
              >
                {/* Dot */}
                <div
                  className={cn(
                    'w-7 h-7 rounded-full border flex items-center justify-center transition-all',
                    isCurrent
                      ? stage.activeClass + ' border'
                      : isReached
                      ? 'border-transparent ' + stage.dotClass + '/30 bg-opacity-20'
                      : 'border-zinc-700 bg-zinc-800/50 text-zinc-600',
                    'group-hover:border-zinc-500 group-hover:scale-110'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-3.5 w-3.5 transition-colors',
                      isCurrent
                        ? stage.activeClass.split(' ')[0]  // extract text-* color
                        : isReached
                        ? stage.dotClass.replace('bg-', 'text-') + '/70'
                        : 'text-zinc-600'
                    )}
                  />
                </div>
                {/* Label */}
                <span
                  className={cn(
                    'text-[10px] font-medium transition-colors whitespace-nowrap',
                    isCurrent
                      ? stage.activeClass.split(' ')[0]
                      : isReached
                      ? 'text-zinc-400'
                      : 'text-zinc-600'
                  )}
                >
                  {stage.label}
                </span>
              </button>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 mx-1 mb-4">
                  <div
                    className={cn(
                      'h-px transition-colors duration-300',
                      idx < activeIdx ? 'bg-zinc-500' : 'bg-zinc-800'
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NotesSection({
  leadId,
  initialNotes,
}: {
  leadId: string;
  initialNotes: string | null;
}) {
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = useRef(false);

  // Track unsaved changes
  const handleChange = (v: string) => {
    setNotes(v);
    dirty.current = true;
    setSaved(false);
  };

  const saveNotes = async () => {
    if (!dirty.current) return;
    setSaving(true);
    try {
      await fetch('/api/leads/crm', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, notes }),
      });
      dirty.current = false;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
        Notes
      </p>
      <textarea
        value={notes}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={saveNotes}
        placeholder="Add notes about this lead — last contact date, context, follow-up plans…"
        maxLength={500}
        rows={3}
        className={cn(
          'w-full text-xs text-zinc-300 bg-zinc-900 border border-zinc-700 rounded-lg p-2.5',
          'placeholder:text-zinc-600 resize-none focus:outline-none focus:border-zinc-500',
          'transition-colors'
        )}
      />
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-zinc-600 tabular-nums">{notes.length}/500</span>
        <button
          onClick={saveNotes}
          disabled={saving || !dirty.current}
          className={cn(
            'flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-all',
            saved
              ? 'text-emerald-400'
              : dirty.current
              ? 'text-violet-400 hover:text-violet-300'
              : 'text-zinc-600 cursor-default'
          )}
        >
          <Save className="h-3 w-3" />
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save note'}
        </button>
      </div>
    </div>
  );
}

function HistoryTimeline({ history }: { history: CRMHistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <div>
        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
          Contact History
        </p>
        <p className="text-xs text-zinc-600 italic">No actions recorded yet.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">
        Contact History
      </p>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-zinc-800" />

        <div className="space-y-3">
          {history.map((entry) => {
            const { label, icon: Icon, color } = actionMeta(entry.action);
            return (
              <div key={entry.id} className="flex items-start gap-3 relative">
                {/* Timeline dot */}
                <div
                  className={cn(
                    'w-5 h-5 rounded-full border border-zinc-800 bg-zinc-950',
                    'flex items-center justify-center flex-shrink-0 z-10'
                  )}
                >
                  <Icon className={cn('h-2.5 w-2.5', color)} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('text-xs font-medium', color)}>{label}</span>
                    <span className="text-[10px] text-zinc-600 flex-shrink-0">
                      {formatRelativeTime(entry.created_at)}
                    </span>
                  </div>
                  {entry.notes && (
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                      &ldquo;{entry.notes}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface LeadCRMPanelProps {
  leadId: string;
  currentStatus: LeadStatus;
  onStatusChange: (status: LeadStatus) => void;
}

export function LeadCRMPanel({ leadId, currentStatus, onStatusChange }: LeadCRMPanelProps) {
  const [notes, setNotes] = useState<string | null>(null);
  const [history, setHistory] = useState<CRMHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/leads/crm?lead_id=${leadId}`)
      .then((r) => r.json())
      .then((data) => {
        setNotes(data.notes ?? null);
        setHistory(data.history ?? []);
      })
      .catch(() => {
        setNotes(null);
        setHistory([]);
      })
      .finally(() => setLoading(false));
  }, [leadId]);

  if (loading) {
    return (
      <div className="px-4 pb-4">
        <div className="bg-zinc-800/30 border border-zinc-800 rounded-xl p-4 space-y-4">
          <div className="h-3 skeleton rounded w-1/4" />
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-1 h-8 skeleton rounded-full" />
            ))}
          </div>
          <div className="h-16 skeleton rounded-lg" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-4 skeleton rounded w-3/4" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4">
      <div className="bg-zinc-800/30 border border-zinc-800 rounded-xl p-4 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <StickyNote className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-xs font-semibold text-zinc-300">CRM</span>
        </div>

        <PipelineBar currentStatus={currentStatus} onStatusChange={onStatusChange} />

        <div className="border-t border-zinc-800" />

        <NotesSection leadId={leadId} initialNotes={notes} />

        <div className="border-t border-zinc-800" />

        <HistoryTimeline history={history} />
      </div>
    </div>
  );
}
