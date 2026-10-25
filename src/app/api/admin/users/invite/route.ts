import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/auth/owners";

export async function POST(request: Request) {
  const sessionClient = await createSupabaseServerClient();
  if (!sessionClient) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });

  const { data: { user }, error: authError } = await sessionClient.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!isOwnerEmail(user.email)) return NextResponse.json({ error: "Owner access required." }, { status: 403 });

  let body: { email?: unknown; redirectTo?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (isOwnerEmail(email)) {
    return NextResponse.json({ error: "This email already has owner access." }, { status: 400 });
  }

  const redirectTo = typeof body.redirectTo === "string" ? body.redirectTo : "";
  const origin = request.headers.get("origin");
  try {
    const redirect = new URL(redirectTo);
    const next = redirect.searchParams.get("next");
    if (
      !origin || redirect.origin !== origin ||
      !redirect.pathname.endsWith("/auth/callback") ||
      !next || !next.startsWith("/") || next.startsWith("//")
    ) {
      return NextResponse.json({ error: "Invalid invitation redirect URL." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid invitation redirect URL." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return NextResponse.json({ error: "User invitation is not configured." }, { status: 503 });

  const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (error) {
    const status = error.status === 429 ? 429 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ message: `Invitation sent to ${email}. New accounts start on the free 10,000-character plan.` }, { status: 201 });
}
