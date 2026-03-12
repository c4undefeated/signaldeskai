import { NextRequest, NextResponse } from 'next/server';
import { createServerClientInstance } from '@/lib/supabase.server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/leads';
  const type = searchParams.get('type'); // 'recovery' for password reset

  if (code) {
    const supabase = await createServerClientInstance();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Password reset flow — send to update-password page
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/update-password`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth?error=callback_failed`);
}
