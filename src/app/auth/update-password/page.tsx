'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Radio, Lock, ArrowRight, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const supabase = createClient();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setErrorMsg('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setErrorMsg('Passwords do not match.'); return; }

    setIsLoading(true);
    setErrorMsg('');

    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);

    if (error) { setErrorMsg(error.message); return; }
    setDone(true);
    setTimeout(() => router.replace('/leads'), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4">
      <Link href="/" className="flex items-center gap-2.5 mb-10">
        <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-violet-600/30">
          <Radio className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-white">SignalDesk AI</span>
      </Link>

      <div className="w-full max-w-sm">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-7">
          {done ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-zinc-100 mb-2">Password updated</h2>
              <p className="text-sm text-zinc-500">Redirecting you to the app…</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-zinc-100 mb-1">Set a new password</h1>
                <p className="text-sm text-zinc-500">Choose a strong password for your account.</p>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                  <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-400">{errorMsg}</p>
                </div>
              )}

              <form onSubmit={handleUpdate} className="space-y-3">
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="New password (min 6 chars)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    leftIcon={<Lock className="h-4 w-4" />}
                    required
                    autoFocus
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  leftIcon={<Lock className="h-4 w-4" />}
                  required
                />

                <Button type="submit" className="w-full" loading={isLoading} rightIcon={<ArrowRight className="h-4 w-4" />}>
                  Update password
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
