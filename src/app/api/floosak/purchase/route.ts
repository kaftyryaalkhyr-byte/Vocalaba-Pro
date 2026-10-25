import { v4 as uuidv4 } from "uuid";
import { getFloosakOwnerContext } from "@/lib/floosak/server";

export async function POST(request: Request) {
  const context = await getFloosakOwnerContext();
  if (context instanceof Response) return context;

  let body: { target_phone?: unknown; amount?: unknown; purpose?: unknown; source_wallet_id?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const targetPhone = typeof body.target_phone === "string" ? body.target_phone.replace(/[\s()-]/g, "") : "";
  const amount = body.amount;
  const purpose = typeof body.purpose === "string" ? body.purpose.trim() : "";
  if (!/^\+?\d{7,15}$/.test(targetPhone) || typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > 100000) {
    return Response.json({ error: "Provide a valid customer phone and amount (0–100,000)." }, { status: 400 });
  }
  if (!purpose || purpose.length > 120) {
    return Response.json({ error: "Purpose is required and must be 120 characters or fewer." }, { status: 400 });
  }

  const { data: credentials, error: credentialsError } = await context.admin
    .from("floosak_credentials")
    .select("token, source_wallets")
    .eq("user_id", context.userId)
    .single();
  if (credentialsError || !credentials) {
    return Response.json({ error: "Authenticate the merchant account before requesting payment." }, { status: 409 });
  }

  const wallets = credentials.source_wallets as { id: number }[];
  const requestedWalletId = body.source_wallet_id;
  const walletId = typeof requestedWalletId === "number" ? requestedWalletId : wallets[0]?.id;
  if (!Number.isInteger(walletId) || !wallets.some((wallet) => wallet.id === walletId)) {
    return Response.json({ error: "Choose a wallet returned by merchant verification." }, { status: 400 });
  }

  try {
    const client = (await getFloosakOwnerContext(credentials.token));
    if (client instanceof Response) return client;
    const result = await client.client.purchaseRequest({
      source_wallet_id: walletId,
      request_id: uuidv4(),
      target_phone: targetPhone,
      amount,
      purpose,
    });
    const { data: payment, error: saveError } = await context.admin
      .from("floosak_purchases")
      .insert({
        owner_id: context.userId,
        provider_purchase_id: result.data.id,
        target_phone: targetPhone,
        amount,
        purpose,
        status: "pending",
      })
      .select("id")
      .single();

    if (saveError || !payment) {
      console.error("Could not save pending Floosak payment", saveError?.message);
      return Response.json({ error: "Payment request was sent but could not be recorded." }, { status: 500 });
    }

    return Response.json({
      payment_id: payment.id,
      status: "pending_otp",
      message: result.message,
      amount: result.data.gross,
    }, { status: 201 });
  } catch {
    return Response.json({ error: "Floosak could not initiate the purchase request." }, { status: 502 });
  }
}
