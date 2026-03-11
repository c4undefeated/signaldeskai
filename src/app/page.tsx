'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { Radio } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { activeProject } = useAppStore();

  useEffect(() => {
    if (activeProject) {
      router.replace('/leads');
    } else {
      router.replace('/onboarding');
    }
  }, [activeProject, router]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-600/30">
          <Radio className="h-6 w-6 text-white animate-pulse" />
        </div>
        <p className="text-sm text-zinc-500">Loading SignalDesk AI...</p>
      </div>
    </div>
  );
}
