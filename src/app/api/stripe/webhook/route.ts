import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' });
}

// Map Stripe price IDs to plan names
function getPlanFromPriceId(priceId: string): 'free' | 'pro' | 'enterprise' {
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro';
  if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) return 'enterprise';
  return 'free';
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const workspaceId = session.metadata?.workspace_id;
        const plan = session.metadata?.plan as 'pro' | 'enterprise';

        if (workspaceId && plan) {
          await supabase
            .from('workspaces')
            .update({
              plan,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
            })
            .eq('id', workspaceId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const workspaceId = sub.metadata?.workspace_id;
        const priceId = sub.items.data[0]?.price?.id;
        const plan = getPlanFromPriceId(priceId || '');
        const isActive = sub.status === 'active' || sub.status === 'trialing';

        if (workspaceId) {
          await supabase
            .from('workspaces')
            .update({
              plan: isActive ? plan : 'free',
              stripe_subscription_id: sub.id,
            })
            .eq('id', workspaceId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const workspaceId = sub.metadata?.workspace_id;

        if (workspaceId) {
          await supabase
            .from('workspaces')
            .update({ plan: 'free', stripe_subscription_id: null })
            .eq('id', workspaceId);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Find workspace by customer ID and notify (just log for now)
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (workspace) {
          await supabase.from('notifications').insert({
            workspace_id: workspace.id,
            type: 'system',
            title: 'Payment Failed',
            message: 'Your subscription payment failed. Please update your payment method.',
            read: false,
          });
        }
        break;
      }

      default:
        // Ignore unhandled event types
        break;
    }
  } catch (error) {
    console.error(`Error handling ${event.type}:`, error);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
