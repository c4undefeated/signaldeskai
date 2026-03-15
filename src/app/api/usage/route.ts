import { NextResponse } from 'next/server';
import { createServerClientInstance } from '@/lib/supabase.server';

const PLAN_LIMITS = {
  free:       { leads: 25,   replies: 5  },
  pro:        { leads: 250,  replies: 50 },
  enterprise: { leads: 9999, replies: 999 },
} as const;

export async function GET() {
  try {
    const supabase = await createServerClientInstance();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Resolve workspace + plan
    const { data: member } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces(plan)')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!member?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    const plan = (member.workspaces as unknown as { plan: string } | null)?.plan ?? 'free';
    const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free;
    const today = new Date().toISOString().split('T')[0];

    const { data: usage } = await supabase
      .from('usage_tracking')
      .select('leads_discovered, replies_generated')
      .eq('workspace_id', member.workspace_id)
      .eq('period', today)
      .maybeSingle();

    return NextResponse.json({
      plan,
      leads_discovered:  usage?.leads_discovered  ?? 0,
      replies_generated: usage?.replies_generated ?? 0,
      leads_limit:  limits.leads,
      replies_limit: limits.replies,
      period: today,
    });
  } catch (error) {
    console.error('Usage route error:', error);
    return NextResponse.json({ error: 'Failed to load usage' }, { status: 500 });
  }
}
