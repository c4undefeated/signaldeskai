import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(date: string | Date): string {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return 'unknown time';
  }
}

export function getIntentColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

export function getIntentBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500/10 border-emerald-500/20';
  if (score >= 60) return 'bg-yellow-500/10 border-yellow-500/20';
  if (score >= 40) return 'bg-orange-500/10 border-orange-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

export function getIntentLabel(score: number): string {
  if (score >= 85) return 'Very High Intent';
  if (score >= 70) return 'High Intent';
  if (score >= 50) return 'Medium Intent';
  if (score >= 30) return 'Low Intent';
  return 'Very Low Intent';
}

export function getSpamRiskColor(risk: string): string {
  switch (risk) {
    case 'LOW': return 'text-emerald-400';
    case 'MEDIUM': return 'text-yellow-400';
    case 'HIGH': return 'text-red-400';
    default: return 'text-zinc-400';
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export function normalizeUrl(url: string): string {
  if (!url) return '';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'new': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'saved': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'opened': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'replied': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'contacted': return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
    case 'dismissed': return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
  }
}
