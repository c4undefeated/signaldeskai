import { createMiddlewareClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Refresh the session cookie on every request so server-side
  // API routes always see an up-to-date auth token.
  const supabase = createMiddlewareClient(request, response);
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico
     * - public folder assets (svg, png, jpg, ico, txt, webmanifest, js at root)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|webmanifest|js)$).*)',
  ],
};
