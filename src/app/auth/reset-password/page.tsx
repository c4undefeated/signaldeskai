'use client';

import { useState } from 'react';
import { Radio, Mail, ArrowRight, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsLoading(true);
    setErrorMsg('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    setIsLoading(false);
    if (error) { setErrorMsg(error.message); return; }
    setSent(true);
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
          {sent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-zinc-100 mb-2">Check your email</h2>
              <p className="text-sm text-zinc-500 mb-1">We sent a password reset link to</p>
              <p className="text-sm font-medium text-zinc-300 mb-5">{email}</p>
              <p className="text-xs text-zinc-600 mb-6">
                Click the link in the email to set a new password. The link expires in 1 hour.
              </p>
              <Link href="/auth" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-zinc-100 mb-1">Reset your password</h1>
                <p className="text-sm text-zinc-500">
                  Enter your email and we'll send you a link to reset your password.
                </p>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                  <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-400">{errorMsg}</p>
                </div>
              )}

              <form onSubmit={handleReset} className="space-y-3">
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail className="h-4 w-4" />}
                  required
                  autoFocus
                />
                <Button type="submit" className="w-full" loading={isLoading} rightIcon={<ArrowRight className="h-4 w-4" />}>
                  Send reset link
                </Button>
              </form>

              <div className="mt-5 text-center">
                <Link
                  href="/auth"
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
