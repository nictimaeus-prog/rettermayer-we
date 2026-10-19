// Benutzerverwaltung für Admins (Liste, anlegen, Rolle/Passwort ändern)
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
  const { data: prof } = await adminClient().from("profiles").select("role,freigegeben").eq("id", data.user.id).maybeSingle();
  if (!prof?.freigegeben) return null; // nicht vom Admin angelegt → kein Zugriff
  return { user: data.user, role: prof.role || "user" };
}

export const isEmail = (s: unknown) => typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/* ---- Funktion ---- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail(405, "bad_request", "Nur POST");
  const who = await caller(req);
  if (!who) return fail(401, "not_signed_in", "Bitte anmelden");
  if (who.role !== "admin") return fail(403, "permission_denied", "Nur für Admins");

  let b: { action?: string; id?: string; email?: string; password?: string; name?: string; role?: string };
  try { b = await req.json(); } catch { return fail(400, "bad_request", "Ungültige Anfrage"); }
  const db = adminClient();
  const role = b.role === "admin" ? "admin" : "user";

  if (b.action === "list") {
    const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
    if (error) return fail(500, "server_error", error.message);
    const { data: profs } = await db.from("profiles").select("id,name,role");
    const pm = new Map((profs || []).map((p) => [p.id, p]));
    const users = data.users.map((u) => ({
      id: u.id, email: u.email, name: pm.get(u.id)?.name || "", role: pm.get(u.id)?.role || "user",
      lastSignIn: u.last_sign_in_at || null,
    })).sort((a, b) => a.name.localeCompare(b.name, "de"));
    return json({ users });
  }

  if (b.action === "create") {
    if (!isEmail(b.email)) return fail(400, "bad_request", "E-Mail ungültig");
    if (!b.password || b.password.length < 8) return fail(400, "bad_request", "Passwort mindestens 8 Zeichen");
    const name = String(b.name || "").trim().slice(0, 80);
    const { data, error } = await db.auth.admin.createUser({
      email: b.email!.trim().toLowerCase(), password: b.password, email_confirm: true, user_metadata: { name },
      app_metadata: { freigegeben: "true", role },
    });
    if (error) return fail(400, "bad_request", /already/i.test(error.message) ? "Diese E-Mail hat schon ein Konto" : error.message);
    const { error: pe } = await db.from("profiles").upsert({ id: data.user.id, name: name || b.email!.split("@")[0], role, freigegeben: true });
    if (pe) return fail(500, "server_error", pe.message);
    return json({ ok: true, id: data.user.id });
  }

  if (b.action === "update") {
    if (!b.id) return fail(400, "bad_request", "id fehlt");
    if (b.id === who.user.id && role !== "admin") return fail(400, "bad_request", "Du kannst dir die Admin-Rolle nicht selbst nehmen");
    if (b.password) {
      if (b.password.length < 8) return fail(400, "bad_request", "Passwort mindestens 8 Zeichen");
      const { error } = await db.auth.admin.updateUserById(b.id, { password: b.password });
      if (error) return fail(400, "bad_request", error.message);
    }
    const patch: Record<string, string> = { role };
    if (typeof b.name === "string" && b.name.trim()) patch.name = b.name.trim().slice(0, 80);
    const { error } = await db.from("profiles").update(patch).eq("id", b.id);
    if (error) return fail(500, "server_error", error.message);
    return json({ ok: true });
  }

  return fail(400, "bad_request", "Unbekannte Aktion");
});
