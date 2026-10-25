import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/auth/owners";

const voiceLocales: Record<string, string> = {
  "arabic-saudi-male": "ar",
  "arabic-egyptian-female": "ar",
  "arabic-modern-female": "ar",
  "english-british-male": "en-GB",
  "english-american-female": "en-US",
};

function splitText(text: string, maxLength = 180) {
  const characters = Array.from(text.trim());
  const chunks: string[] = [];

  while (characters.length > 0) {
    let end = Math.min(maxLength, characters.length);
    if (end < characters.length) {
      let boundary = end;
      while (boundary > 0 && !/\s/u.test(characters[boundary - 1])) boundary -= 1;
      if (boundary > maxLength * 0.6) end = boundary;
    }

    const chunk = characters.splice(0, end).join("").trim();
    if (chunk) chunks.push(chunk);
  }

  return chunks;
}

export async function POST(request: Request) {
  let body: { text?: unknown; voiceId?: unknown };
  try {
    body = (await request.json()) as { text?: unknown; voiceId?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body.text !== "string" || !body.text.trim()) {
    return Response.json({ error: "Text is required." }, { status: 400 });
  }
  if (body.text.length > 5000) {
    return Response.json({ error: "Text must be 5,000 characters or fewer." }, { status: 413 });
  }
  const voiceId = typeof body.voiceId === "string" ? body.voiceId : "arabic-modern-female";
  let language = voiceLocales[voiceId];

  const supabase = await createSupabaseServerClient();
  if (!supabase) return Response.json({ error: "Authentication is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in to generate audio." }, { status: 401 });

  if (!language) {
    const { data: voice, error } = await supabase
      .from("voices")
      .select("language")
      .eq("id", voiceId)
      .single();
    if (error || !voice) return Response.json({ error: "Choose a supported voice." }, { status: 400 });
    language = voice.language;
  }

  if (!isOwnerEmail(user.email)) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("monthly_character_limit")
      .eq("id", user.id)
      .single();
    if (profileError || !profile) {
      return Response.json({ error: "Could not verify your account plan." }, { status: 500 });
    }

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { data: generations, error: usageError } = await supabase
      .from("generation_history")
      .select("character_count")
      .eq("user_id", user.id)
      .gte("created_at", monthStart.toISOString());
    if (usageError) return Response.json({ error: "Could not verify your monthly usage." }, { status: 500 });

    const usedCharacters = generations.reduce((total, generation) => total + generation.character_count, 0);
    if (usedCharacters + body.text.length > profile.monthly_character_limit) {
      return Response.json({ error: "Monthly character limit reached. Upgrade your plan to continue." }, { status: 429 });
    }
  }

  const audioChunks: Uint8Array[] = [];
  for (const chunk of splitText(body.text)) {
    const url = new URL("https://translate.google.com/translate_tts");
    url.searchParams.set("ie", "UTF-8");
    url.searchParams.set("client", "tw-ob");
    url.searchParams.set("tl", language);
    url.searchParams.set("q", chunk);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: "audio/mpeg,audio/*;q=0.9,*/*;q=0.8",
          "User-Agent": "Mozilla/5.0 (compatible; VocalabaTTS/1.0)",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      return Response.json({ error: "The free TTS service could not be reached. Try again shortly." }, { status: 502 });
    }

    if (!response.ok) {
      return Response.json({ error: "The free TTS service rejected the request. Try a shorter text." }, { status: 502 });
    }

    const audio = new Uint8Array(await response.arrayBuffer());
    if (audio.length === 0) {
      return Response.json({ error: "The free TTS service returned empty audio." }, { status: 502 });
    }
    audioChunks.push(audio);
  }

  const totalLength = audioChunks.reduce((total, chunk) => total + chunk.length, 0);
  const combinedAudio = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of audioChunks) {
    combinedAudio.set(chunk, offset);
    offset += chunk.length;
  }

  const { error: historyError } = await supabase.from("generation_history").insert({
    user_id: user.id,
    voice_id: voiceId,
    text_snippet: body.text,
    character_count: body.text.length,
  });
  if (historyError) console.error("Could not save TTS generation history", historyError.message);

  return new Response(combinedAudio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      "Content-Disposition": 'inline; filename="vocalaba-audio.mp3"',
      "Content-Length": String(combinedAudio.length),
    },
  });
}
