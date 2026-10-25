import { FloosakClient } from "@alsharie/floosak";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/auth/owners";

export type FloosakOwnerContext = {
  userId: string;
  client: FloosakClient;
  admin: SupabaseClient;
};

export async function getFloosakOwnerContext(token?: string): Promise<FloosakOwnerContext | Response> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "Authentication is not configured." }, { status: 503 });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!isOwnerEmail(user.email)) {
    return Response.json({ error: "Floosak merchant operations are restricted to the app owner." }, { status: 403 });
  }

  const baseUrl = process.env.FLOOSAK_BASE_URL?.trim().replace(/\/+$/, "");
  const phone = process.env.FLOOSAK_MERCHANT_PHONE?.trim();
  const shortCode = process.env.FLOOSAK_SHORT_CODE?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !phone || !shortCode || !supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Floosak or secure token storage is not configured." }, { status: 503 });
  }

  return {
    userId: user.id,
    client: new FloosakClient({ baseUrl, phone, shortCode, token }),
    admin: createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}
