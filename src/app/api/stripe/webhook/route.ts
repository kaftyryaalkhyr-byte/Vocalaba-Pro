import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const signature = request.headers.get("stripe-signature");
  if (!stripeSecret || !webhookSecret || !supabaseUrl || !serviceRoleKey || !signature) {
    return Response.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  const stripe = new Stripe(stripeSecret);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch {
    return Response.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  const subscription = event.data.object as Stripe.Subscription;
  if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
    const userId = subscription.metadata.supabase_user_id;
    if (!userId) return Response.json({ received: true });
    const isActive = event.type !== "customer.subscription.deleted" && ["active", "trialing"].includes(subscription.status);
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await supabase.from("profiles").update({
      plan: isActive ? "pro" : "free",
      stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      updated_at: new Date().toISOString(),
    }).eq("id", userId);
    if (error) {
      console.error("Could not update subscription profile", error.message);
      return Response.json({ error: "Could not update subscription." }, { status: 500 });
    }
  }

  return Response.json({ received: true });
}
