// Pflanzkartoffeln: Adressen in Koordinaten umwandeln und Straßen-Kilometer berechnen.
// Mit Geheimnis ORS_API_KEY (openrouteservice/HeiGIT, kostenloses Konto auf account.heigit.org; Endpunkte api.heigit.org): Geocoding und LKW-Straßenkilometer (driving-hgv).
// Ohne Schlüssel: Geocoding über OpenStreetMap-Nominatim (langsam, 1 Anfrage/Sekunde) und Kilometer als Luftlinie × 1,3 („geschätzt“).
// Zugriff nur für angemeldete, freigegebene Nutzer mit Eintrag in pfg_zugang.
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
  const { data: ok } = await client.rpc("pfg_ok");
  return ok === true;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function haversine(a: number[], b: number[]) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail(405, "bad_request", "Nur POST");
  if (!(await erlaubt(req))) return fail(401, "not_signed_in", "Bitte anmelden");
  const key = Deno.env.get("ORS_API_KEY") || "";
  let body: any;
  try { body = await req.json(); } catch { return fail(400, "bad_request", "Ungültige Anfrage"); }

  if (body.action === "status") return json({ ors: !!key });

  if (body.action === "geocode") {
    const items = (Array.isArray(body.items) ? body.items : []).slice(0, key ? 40 : 12);
    const out: unknown[] = [];
    for (const it of items) {
      const q = String(it.q || "").trim();
      if (!q) continue;
      try {
        if (key) {
          const u = `https://api.heigit.org/pelias/v1/search?api_key=${encodeURIComponent(key)}&size=1&boundary.country=DE,AT,NL,BE,DK,FR,CZ&text=${encodeURIComponent(q)}`;
          const r = await fetch(u); const j = await r.json();
          const f = j?.features?.[0];
          if (f) { out.push({ key: it.key, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], quelle: "ORS", label: f.properties?.label }); continue; }
          const n = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, { headers: { "User-Agent": "VG-Bio-Pflanzkartoffeln/1.0 (rettermayer-we.pages.dev)" } }).then((x) => x.json()).catch(() => null);
          if (n?.[0]) out.push({ key: it.key, lon: Number(n[0].lon), lat: Number(n[0].lat), quelle: "OSM", label: n[0].display_name });
          else out.push({ key: it.key, error: "nicht gefunden" });
          await sleep(1100);
        } else {
          const u = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=de,at,nl,be,dk,fr,cz&q=${encodeURIComponent(q)}`;
          const r = await fetch(u, { headers: { "User-Agent": "VG-Bio-Pflanzkartoffeln/1.0 (rettermayer-we.pages.dev)" } });
          const j = await r.json();
          if (j?.[0]) out.push({ key: it.key, lon: Number(j[0].lon), lat: Number(j[0].lat), quelle: "OSM", label: j[0].display_name });
          else out.push({ key: it.key, error: "nicht gefunden" });
          await sleep(1100);
        }
      } catch (e) { out.push({ key: it.key, error: String(e) }); }
    }
    return json({ results: out, ors: !!key });
  }

  if (body.action === "matrix") {
    const src: number[][] = body.sources || [], dst: number[][] = body.destinations || [];
    if (!src.length || !dst.length) return fail(400, "bad_request", "Keine Punkte");
    if (key && src.length * dst.length <= 3500) {
      const locations = [...src, ...dst];
      const r = await fetch("https://api.heigit.org/openrouteservice/v2/matrix/driving-hgv", {
        method: "POST",
        headers: { Authorization: key, "Content-Type": "application/json" },
        body: JSON.stringify({ locations, sources: src.map((_, i) => i), destinations: dst.map((_, i) => src.length + i), metrics: ["distance", "duration"], units: "km" }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.distances) return json({ km: j.distances, min: (j.durations || []).map((row: number[]) => row.map((s) => s == null ? null : s / 60)), quelle: "ORS" });
      console.error("ORS matrix", r.status, j);
    }
    const km = src.map((a) => dst.map((b) => Math.round(haversine(a, b) * 1.3 * 10) / 10));
    return json({ km, min: km.map((row) => row.map((k) => Math.round(k / 60 * 60))), quelle: "geschätzt" });
  }
  return fail(400, "bad_request", "Unbekannte Aktion");
});
