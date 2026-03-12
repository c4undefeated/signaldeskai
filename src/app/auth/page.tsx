'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Radio, Mail, ArrowRight, CheckCircle2, AlertCircle, Eye, EyeOff, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

type AuthMethod = 'magic' | 'password';
type AuthMode = 'signin' | 'signup';
type View = 'form' | 'sent';

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/leads';
  const errorParam = searchParams.get('error');
  const modeParam = searchParams.get('mode');

  const [mode, setMode] = useState<AuthMode>(modeParam === 'signup' ? 'signup' : 'signin');
  const [method, setMethod] = useState<AuthMethod>('magic');
  const [view, setView] = useState<View>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(
    errorParam === 'callback_failed' ? 'Sign-in link expired. Please try again.' : '',
  );

  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(redirectTo);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsLoading(true);
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${redirectTo}` },
    });
    setIsLoading(false);
    if (error) { setErrorMsg(error.message); return; }
    setView('sent');
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setIsLoading(true);
    setErrorMsg('');

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${redirectTo}` },
      });
      setIsLoading(false);
      if (error) { setErrorMsg(error.message); return; }
      setView('sent');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setIsLoading(false);
      if (error) { setErrorMsg(error.message); return; }
      router.replace(redirectTo);
    }
  };

  const handleGoogle = async () => {
    setIsGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${redirectTo}` },
    });
    if (error) { setErrorMsg(error.message); setIsGoogleLoading(false); }
  };

  const isSignUp = mode === 'signup';

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

          {/* Magic link / email confirmation sent */}
          {view === 'sent' && (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-zinc-100 mb-2">Check your email</h2>
              <p className="text-sm text-zinc-500 mb-1">
                {method === 'magic' ? 'We sent a sign-in link to' : isSignUp ? 'Confirm your account at' : 'Check your inbox at'}
              </p>
              <p className="text-sm font-medium text-zinc-300 mb-5">{email}</p>
              {method === 'magic' && (
                <p className="text-xs text-zinc-600 mb-4">No password needed — the link signs you in directly.</p>
              )}
              <button
                onClick={() => { setView('form'); setEmail(''); setPassword(''); }}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Use a different email
              </button>
            </div>
          )}

          {/* Auth form */}
          {view === 'form' && (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-semibold text-zinc-100 mb-1">
                  {isSignUp ? 'Create your account' : 'Welcome back'}
                </h1>
                <p className="text-sm text-zinc-500">
                  {isSignUp
                    ? 'Start finding high-intent leads on Reddit — free.'
                    : 'Sign in to your SignalDesk workspace.'}
                </p>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                  <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-400">{errorMsg}</p>
                </div>
              )}

              {/* Google OAuth */}
              <Button
                variant="outline"
                className="w-full mb-4 justify-center gap-3"
                onClick={handleGoogle}
                loading={isGoogleLoading}
                leftIcon={
                  !isGoogleLoading ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  ) : undefined
                }
              >
                Continue with Google
              </Button>

              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-800" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-zinc-900 px-3 text-xs text-zinc-600">or continue with email</span>
                </div>
              </div>

              {/* Magic / Password toggle */}
              <div className="flex bg-zinc-800 rounded-lg p-0.5 mb-4">
                {(['magic', 'password'] as AuthMethod[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMethod(m); setErrorMsg(''); }}
                    className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
                      method === m
                        ? 'bg-zinc-700 text-zinc-100 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {m === 'magic' ? 'Magic link' : 'Password'}
                  </button>
                ))}
              </div>

              {/* Magic link */}
              {method === 'magic' && (
                <form onSubmit={handleMagicLink} className="space-y-3">
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
                    {isSignUp ? 'Create account' : 'Send magic link'}
                  </Button>
                  <p className="text-xs text-zinc-600 text-center">No password needed. We email you a one-click sign-in link.</p>
                </form>
              )}

              {/* Email + password */}
              {method === 'password' && (
                <form onSubmit={handlePassword} className="space-y-3">
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    leftIcon={<Mail className="h-4 w-4" />}
                    required
                    autoFocus
                  />
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder={isSignUp ? 'Create a password (min 6 chars)' : 'Your password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      leftIcon={<Lock className="h-4 w-4" />}
                      required
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

                  {!isSignUp && (
                    <div className="flex justify-end">
                      <Link href="/auth/reset-password" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                        Forgot password?
                      </Link>
                    </div>
                  )}

                  <Button type="submit" className="w-full" loading={isLoading} rightIcon={<ArrowRight className="h-4 w-4" />}>
                    {isSignUp ? 'Create account' : 'Sign in'}
                  </Button>
                </form>
              )}

              {/* Toggle sign in / sign up */}
              <p className="text-xs text-zinc-600 text-center mt-5">
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <button
                  onClick={() => { setMode(isSignUp ? 'signin' : 'signup'); setErrorMsg(''); }}
                  className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
                >
                  {isSignUp ? 'Sign in' : 'Sign up free'}
                </button>
              </p>

              <p className="text-xs text-zinc-700 text-center mt-3">
                By continuing, you agree to our{' '}
                <span className="text-zinc-600 hover:text-zinc-400 cursor-pointer">Terms</span>{' '}
                and{' '}
                <span className="text-zinc-600 hover:text-zinc-400 cursor-pointer">Privacy Policy</span>.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthContent />
    </Suspense>
  );
}
