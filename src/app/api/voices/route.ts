import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/auth/owners";

const localePattern = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "Authentication is not configured." }, { status: 503 });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!isOwnerEmail(user.email)) return Response.json({ error: "Owner access required." }, { status: 403 });
  const { data, error } = await supabase
    .from("voices")
    .select("id, name, language, accent, gender")
    .order("created_at", { ascending: true });
  if (error) return Response.json({ error: "Could not load voices." }, { status: 500 });

  return Response.json({ voices: data });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "Authentication is not configured." }, { status: 503 });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!isOwnerEmail(user.email)) return Response.json({ error: "Owner access required." }, { status: 403 });

  let body: { name?: unknown; language?: unknown; accent?: unknown; gender?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const language = typeof body.language === "string" ? body.language.trim() : "";
  const accent = typeof body.accent === "string" ? body.accent.trim() : null;
  const gender = typeof body.gender === "string" ? body.gender.trim() : null;
  if (!name || name.length > 60 || !localePattern.test(language)) {
    return Response.json({ error: "Enter a name (up to 60 characters) and valid language tag, such as ar or en-US." }, { status: 400 });
  }
  if (accent && accent.length > 60) return Response.json({ error: "Accent must be 60 characters or fewer." }, { status: 400 });
  if (gender && gender.length > 30) return Response.json({ error: "Voice style must be 30 characters or fewer." }, { status: 400 });

  const { data, error } = await supabase
    .from("voices")
    .insert({
      id: crypto.randomUUID(),
      name,
      language,
      accent,
      gender,
      is_public: true,
      owner_id: user.id,
    })
    .select("id, name, language, accent, gender")
    .single();

  if (error || !data) {
    console.error("Could not create custom voice", error?.message);
    return Response.json({ error: "Could not add voice. Confirm the Supabase schema has been applied." }, { status: 500 });
  }

  return Response.json({ voice: data }, { status: 201 });
}
