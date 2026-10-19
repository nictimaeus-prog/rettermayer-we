// Protokoll per E-Mail verschicken (SMTP, Standard: Gmail über Port 465 mit App-Passwort)
// Geheimnisse (supabase secrets set ...):
//   SMTP_USER       Absender-Konto, z. B. nic.timaeus@gmail.com (später rettermayer@bio-vg.de)
//   SMTP_PASS       App-Passwort des Kontos (bei Gmail: Google-Konto → Sicherheit → App-Passwörter)
//   SMTP_HOST       optional, Standard smtp.gmail.com
//   SMTP_PORT       optional, Standard 465 (Supabase sperrt 25 und 587)
//   MAIL_FROM       optional, Absenderadresse, Standard = SMTP_USER
//   MAIL_FROM_NAME  optional, Standard "Rettermayer WE"
// @deno-types="npm:@types/nodemailer@6.4.17"
// Einzeldatei: kann im Supabase-Dashboard (Edge Functions → Deploy a new function → Via Editor) eingefügt werden.
import nodemailer from "npm:nodemailer@6.10.1";
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
  const { data: prof } = await adminClient().from("profiles").select("role,freigegeben").eq("id", data.user.id).maybeSingle();
  if (!prof?.freigegeben) return null; // nicht vom Admin angelegt → kein Zugriff
  return { user: data.user, role: prof.role || "user" };
}

export const isEmail = (s: unknown) => typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/* ---- Funktion ---- */
type Att = { filename?: string; mimeType?: string; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail(405, "bad_request", "Nur POST");
  const who = await caller(req);
  if (!who) return fail(401, "not_signed_in", "Bitte anmelden");

  const user = Deno.env.get("SMTP_USER"), pass = Deno.env.get("SMTP_PASS");
  if (!user || !pass) return fail(503, "not_configured", "Mailversand ist noch nicht eingerichtet (SMTP_USER/SMTP_PASS fehlen)");

  let body: { to?: string[] | string; cc?: string[]; subject?: string; htmlBody?: string; body?: string; attachments?: Att[] };
  try { body = await req.json(); } catch { return fail(400, "bad_request", "Ungültige Anfrage"); }
  const to = (Array.isArray(body.to) ? body.to : String(body.to || "").split(/[;,]/)).map((s) => String(s).trim()).filter(Boolean);
  if (!to.length || to.length > 25 || !to.every(isEmail)) return fail(400, "bad_request", "Empfänger fehlen oder sind ungültig");
  const subject = String(body.subject || "Wareneingang").slice(0, 300);
  const atts = (body.attachments || []).filter((a) => a && typeof a.content === "string").slice(0, 20);

  const host = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
  const port = Number(Deno.env.get("SMTP_PORT") || 465);
  const from = Deno.env.get("MAIL_FROM") || user;
  const fromName = Deno.env.get("MAIL_FROM_NAME") || "Rettermayer WE";

  const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  try {
    await transport.sendMail({
      from: { name: fromName, address: from },
      to,
      replyTo: who.user.email || undefined,
      subject,
      text: body.body || "Wareneingangsprotokoll im Anhang.",
      html: body.htmlBody || undefined,
      attachments: atts.map((a) => ({
        filename: a.filename || "anhang",
        contentType: a.mimeType || "application/octet-stream",
        content: a.content,
        encoding: "base64",
      })),
    });
  } catch (e) {
    console.error("SMTP", e);
    return fail(502, "upstream_error", "Mailserver hat abgelehnt: " + String((e as Error)?.message || e).slice(0, 200));
  } finally {
    transport.close();
  }
  return json({ ok: true, to, von: from });
});
