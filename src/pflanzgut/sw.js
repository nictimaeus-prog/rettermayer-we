// Service Worker der Pflanzkartoffel-Seite: hält die Seite und ihre Bibliotheken im Speicher des Geräts,
// damit bei wackliger Verbindung die Seite aus dem Speicher kommt statt der Fehlerseite des Browsers.
// Online wird immer zuerst das Netz gefragt (immer aktuelle Version), nur bei Fehler oder Zeitüberschreitung der Speicher.
// Daten aus Supabase werden nicht gespeichert, sie laufen immer direkt übers Netz.
const CACHE = "pfg-v1";
const SHELL = ["./", "../config.js", "../lib/supabase.js", "../lib/xlsx.full.min.js", "../fonts/fonts.css"];
const TIMEOUT_MS = 5000;

self.addEventListener("install", ev => {
  ev.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, {cache: "reload"})).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", ev => {
  ev.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("pfg-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function mitZeitlimit(p, ms){ return new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("timeout")), ms); p.then(r => { clearTimeout(t); res(r); }, e => { clearTimeout(t); rej(e); }); }); }

self.addEventListener("fetch", ev => {
  const req = ev.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return; // Supabase, Schriften extern usw.: Browser direkt
  const isPage = req.mode === "navigate";
  ev.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = isPage ? new URL("./", self.registration.scope).href : req;
    try {
      const res = await mitZeitlimit(fetch(req), isPage ? TIMEOUT_MS : TIMEOUT_MS * 2);
      if (res && res.ok) cache.put(key, res.clone()).catch(() => {});
      return res;
    } catch (e) {
      const hit = await cache.match(key, {ignoreSearch: true});
      if (hit) return hit;
      if (isPage) return new Response(`<!DOCTYPE html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pflanzkartoffeln · VG Bio</title>
<body style="font:16px system-ui,sans-serif;padding:24px;color:#1F2A1A;background:#F4F6F0"><h2 style="color:#5C8A13">Keine Verbindung</h2><p>Die Seite versucht es automatisch erneut, sobald wieder Netz da ist.</p>
<script>const r=()=>location.reload();addEventListener("online",r);setTimeout(r,8000)<\/script></body></html>`, {headers: {"Content-Type": "text/html; charset=utf-8"}});
      throw e;
    }
  })());
});
