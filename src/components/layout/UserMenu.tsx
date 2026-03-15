'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, CreditCard, LogOut, ChevronUp } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

const planStyles = {
  free: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  pro: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  enterprise: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

const planLabels = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

function Avatar({ email }: { email: string }) {
  const initials = email.charAt(0).toUpperCase();
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold select-none">
      {initials}
    </div>
  );
}

export function UserMenu() {
  const router = useRouter();
  const { userEmail, plan, reset } = useAppStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const handleSignOut = async () => {
    setOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    reset();
    router.push('/auth');
  };

  const email = userEmail ?? '—';

  return (
    <div ref={ref} className="relative mt-2 pt-2 border-t border-zinc-800/50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors group"
      >
        <Avatar email={email} />
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-medium text-zinc-300 truncate">{email}</p>
          <span
            className={cn(
              'inline-block text-[10px] font-medium px-1.5 py-px rounded-full border leading-tight mt-px',
              planStyles[plan]
            )}
          >
            {planLabels[plan]}
          </span>
        </div>
        <ChevronUp
          className={cn(
            'h-3.5 w-3.5 text-zinc-500 flex-shrink-0 transition-transform duration-150',
            !open && 'rotate-180'
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl shadow-zinc-950/60 overflow-hidden z-50">
          {/* Identity header */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-zinc-800">
            <Avatar email={email} />
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-200 truncate">{email}</p>
              <span
                className={cn(
                  'inline-block text-[10px] font-medium px-1.5 py-px rounded-full border leading-tight mt-px',
                  planStyles[plan]
                )}
              >
                {planLabels[plan]}
              </span>
            </div>
          </div>

          {/* Menu items */}
          <div className="p-1">
            <button
              onClick={() => { setOpen(false); router.push('/settings'); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <Settings className="h-3.5 w-3.5 flex-shrink-0" />
              Settings
            </button>
            <button
              onClick={() => { setOpen(false); router.push('/settings?tab=billing'); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <CreditCard className="h-3.5 w-3.5 flex-shrink-0" />
              Billing
            </button>
          </div>

          <div className="p-1 border-t border-zinc-800">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
