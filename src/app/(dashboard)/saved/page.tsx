'use client';

import { useMemo } from 'react';
import { Bookmark, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { LeadCard } from '@/components/dashboard/LeadCard';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';

export default function SavedLeadsPage() {
  const router = useRouter();
  const { leads, websiteProfile, updateLeadStatus } = useAppStore();

  const savedLeads = useMemo(
    () => leads.filter((l) => l.status === 'saved' || l.status === 'contacted' || l.status === 'replied'),
    [leads]
  );

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopBar
        title="Saved Leads"
        subtitle={savedLeads.length > 0 ? `${savedLeads.length} leads` : undefined}
      />

      <div className="p-6">
        {savedLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-5">
              <Bookmark className="h-7 w-7 text-zinc-600" />
            </div>
            <h2 className="text-lg font-semibold text-zinc-200 mb-2">No saved leads yet</h2>
            <p className="text-sm text-zinc-500 text-center max-w-xs mb-6">
              Save leads from your feed to track them here. Great for organizing high-potential prospects.
            </p>
            <Button
              onClick={() => router.push('/leads')}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Go to Lead Feed
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {savedLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                websiteProfile={websiteProfile}
                onStatusChange={updateLeadStatus}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
