// Lieferschein-Foto auslesen (Claude über die Anthropic-API)
// Geheimnisse:
//   ANTHROPIC_API_KEY  API-Schlüssel aus console.anthropic.com (ohne Schlüssel: Funktion meldet "not_configured",
//                      die App fällt dann auf manuelles Abhaken zurück)
//   ANTHROPIC_MODEL    optional, Standard claude-sonnet-5-5
// Einzeldatei: kann im Supabase-Dashboard (Edge Functions → Deploy a new function → Via Editor) eingefügt werden.
import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

/* ---- Hilfen ---- */
export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
export function fail(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Angemeldete Person aus dem Aufruf; null, wenn nicht angemeldet (der öffentliche Schlüssel allein reicht nicht). */
export async function caller(req: Request): Promise<{ user: User; role: string } | null> {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return null;
  const { data: prof } = await adminClient().from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  return { user: data.user, role: prof?.role || "user" };
}

export const isEmail = (s: unknown) => typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/* ---- Funktion ---- */
type Img = { media_type: string; data: string };
type Msg = { role: "user" | "assistant"; content: unknown };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail(405, "bad_request", "Nur POST");
  if (!(await caller(req))) return fail(401, "not_signed_in", "Bitte anmelden");

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return fail(503, "not_configured", "Lieferschein-Lesen ist nicht eingerichtet");

  let body: { input?: string | Msg[]; images?: Img[] };
  try { body = await req.json(); } catch { return fail(400, "bad_request", "Ungültige Anfrage"); }
  const images = (body.images || []).filter((i) => i && i.data && /^image\/(jpeg|png|webp|gif)$/.test(i.media_type)).slice(0, 4);
  const imgBlocks = images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.media_type, data: i.data } }));

  let messages: Msg[];
  if (typeof body.input === "string") {
    messages = [{ role: "user", content: [...imgBlocks, { type: "text", text: body.input.slice(0, 8000) }] }];
  } else if (Array.isArray(body.input) && body.input.length) {
    messages = body.input.slice(-10).map((m) => ({ role: m.role, content: String(m.content ?? "").slice(0, 8000) }));
    const last = messages[messages.length - 1];
    last.content = [...imgBlocks, { type: "text", text: String(last.content) }];
  } else return fail(400, "bad_request", "Kein Text übergeben");

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5", max_tokens: 1024, messages }),
  });
  const out = await r.json().catch(() => null);
  if (!r.ok) {
    console.error("Anthropic", r.status, out);
    return fail(r.status === 429 ? 429 : 502, r.status === 429 ? "rate_limited" : "upstream_error", out?.error?.message || "Auslesen fehlgeschlagen");
  }
  const text = (out?.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
  return json({ text, truncated: out?.stop_reason === "max_tokens" });
});
