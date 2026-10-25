import { getFloosakOwnerContext } from "@/lib/floosak/server";

export async function POST(request: Request) {
  const context = await getFloosakOwnerContext();
  if (context instanceof Response) return context;

  let body: { payment_id?: unknown; otp?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const paymentId = typeof body.payment_id === "string" ? body.payment_id : "";
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";
  if (!paymentId || !/^\d{4,8}$/.test(otp)) {
    return Response.json({ error: "A valid payment_id and customer OTP are required." }, { status: 400 });
  }

  const { data: payment, error: lookupError } = await context.admin
    .from("floosak_purchases")
    .select("provider_purchase_id")
    .eq("id", paymentId)
    .eq("owner_id", context.userId)
    .eq("status", "pending")
    .single();
  if (lookupError || !payment) return Response.json({ error: "Pending payment was not found." }, { status: 404 });

  const { data: credentials, error: credentialsError } = await context.admin
    .from("floosak_credentials")
    .select("token")
    .eq("user_id", context.userId)
    .single();
  if (credentialsError || !credentials) {
    return Response.json({ error: "Merchant credentials are unavailable. Re-authenticate the merchant." }, { status: 409 });
  }

  const authenticated = await getFloosakOwnerContext(credentials.token);
  if (authenticated instanceof Response) return authenticated;
  try {
    const result = await authenticated.client.purchaseConfirm({
      purchase_id: payment.provider_purchase_id,
      otp,
    });
    const { error: updateError } = await context.admin
      .from("floosak_purchases")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", paymentId)
      .eq("owner_id", context.userId)
      .eq("status", "pending");
    if (updateError) console.error("Could not update Floosak payment status", updateError.message);
    return Response.json({ status: "completed", transaction: result.data });
  } catch {
    return Response.json({ error: "Payment confirmation failed. Check the customer OTP." }, { status: 502 });
  }
}
