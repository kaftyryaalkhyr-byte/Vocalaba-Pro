import { getFloosakOwnerContext } from "@/lib/floosak/server";

export async function POST() {
  const context = await getFloosakOwnerContext();
  if (context instanceof Response) return context;

  try {
    const result = await context.client.requestAuthKey();
    return Response.json({ request_id: result.request_id, message: result.message });
  } catch {
    return Response.json({ error: "Could not request the merchant verification code." }, { status: 502 });
  }
}
