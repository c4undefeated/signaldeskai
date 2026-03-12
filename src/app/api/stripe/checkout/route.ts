import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerClientInstance } from '@/lib/supabase.server';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });
}

function getPriceIds(): Record<string, string> {
  return {
    pro: process.env.STRIPE_PRO_PRICE_ID || '',
    enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID || '',
  };
}

// POST /api/stripe/checkout — create a Stripe checkout session
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClientInstance();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { plan, workspace_id } = await req.json();
    const stripe = getStripe();
    const PRICE_IDS = getPriceIds();

    if (!plan || !PRICE_IDS[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      return NextResponse.json({ error: `${plan} price ID not configured` }, { status: 400 });
    }

    const origin = req.nextUrl.origin;

    // Look up or create Stripe customer
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id, stripe_customer_id')
      .eq('id', workspace_id)
      .single();

    let customerId = workspace?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { workspace_id, user_id: user.id },
      });
      customerId = customer.id;

      await supabase
        .from('workspaces')
        .update({ stripe_customer_id: customerId })
        .eq('id', workspace_id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/settings?upgraded=1`,
      cancel_url: `${origin}/settings?cancelled=1`,
      metadata: { workspace_id, plan, user_id: user.id },
      subscription_data: {
        metadata: { workspace_id, plan },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
  }
}
