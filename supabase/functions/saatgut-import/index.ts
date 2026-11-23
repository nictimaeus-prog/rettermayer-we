// Saatgut-Bestellung: Bestellschein / E-Mail / Foto auslesen (Claude über die Anthropic-API)
// Nutzt dieselben Geheimnisse wie read-ls:
//   ANTHROPIC_API_KEY  API-Schlüssel aus console.anthropic.com (ohne Schlüssel: "not_configured")
//   ANTHROPIC_MODEL    optional, Standard claude-sonnet-5-5
// Zugriff nur für angemeldete, freigegebene Nutzer mit Eintrag in saatgut_zugang.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fail = (status: number, code: string, message: string) => json({ error: { code, message } }, status);

async function erlaubt(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return false;
  const { data: ok } = await client.rpc("saatgut_ok");
  return ok === true;
}

type Img = { media_type: string; data: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail(405, "bad_request", "Nur POST");
  if (!(await erlaubt(req))) return fail(401, "not_signed_in", "Bitte anmelden");

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return fail(503, "not_configured", "Auslesen ist nicht eingerichtet");

  let body: { input?: string; images?: Img[] };
  try { body = await req.json(); } catch { return fail(400, "bad_request", "Ungültige Anfrage"); }
  if (typeof body.input !== "string" || !body.input.trim()) return fail(400, "bad_request", "Kein Text übergeben");
  const images = (body.images || [])
    .filter((i) => i && i.data && /^image\/(jpeg|png|webp|gif)$/.test(i.media_type))
    .slice(0, 4)
    .map((i) => ({ type: "image", source: { type: "base64", media_type: i.media_type, data: i.data } }));

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: [...images, { type: "text", text: body.input.slice(0, 60000) }] }],
    }),
  });
  const out = await r.json().catch(() => null);
  if (!r.ok) {
    console.error("Anthropic", r.status, out);
    return fail(r.status === 429 ? 429 : 502, r.status === 429 ? "rate_limited" : "upstream_error", out?.error?.message || "Auslesen fehlgeschlagen");
  }
  const text = (out?.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
  return json({ text, truncated: out?.stop_reason === "max_tokens" });
});
