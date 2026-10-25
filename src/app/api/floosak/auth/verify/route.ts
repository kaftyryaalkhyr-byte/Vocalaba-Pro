import { getFloosakOwnerContext } from "@/lib/floosak/server";

export async function POST(request: Request) {
  const context = await getFloosakOwnerContext();
  if (context instanceof Response) return context;

  let body: { request_id?: unknown; otp?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const requestId = body.request_id;
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";
  if (!(typeof requestId === "string" || typeof requestId === "number") || !/^\d{4,8}$/.test(otp)) {
    return Response.json({ error: "A valid request_id and merchant OTP are required." }, { status: 400 });
  }

  try {
    const result = await context.client.verifyAuthKey({ request_id: requestId, otp });
    const wallets = result.account_detail.account.wallets;
    const { error } = await context.admin.from("floosak_credentials").upsert({
      user_id: context.userId,
      token: result.key,
      source_wallets: wallets,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (error) {
      console.error("Could not securely store Floosak credentials", error.message);
      return Response.json({ error: "Merchant verification succeeded but secure token storage failed." }, { status: 500 });
    }

    return Response.json({
      message: result.message,
      wallets: wallets.map((wallet) => ({
        id: wallet.id,
        currency: wallet.currency.name,
        symbol: wallet.currency.symbol,
        balance: wallet.balance,
      })),
    });
  } catch {
    return Response.json({ error: "Merchant verification failed. Check the OTP and try again." }, { status: 502 });
  }
}
