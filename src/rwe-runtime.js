/* Rettermayer WE – Laufzeit
 * Stellt der App dieselben Schnittstellen bereit wie vorher claude.ai (window.claude.use(...)),
 * aber mit Supabase (Datenbank, Dateien, Anmeldung, Server-Funktionen) und Offline-Speicher.
 *   db        – Dokumente je Sammlung, offline zuerst, Nachsenden über eine Warteschlange
 *   assets    – Dateiablage (Protokoll-PDFs, Logo), offline vorgemerkt
 *   user      – angemeldete Person, Rolle (admin/user), Namen
 *   mcp       – Mailversand über Server-Funktion "send-mail" (Aufruf wie früher Gmail send_message)
 *   sample    – Lieferschein lesen über Server-Funktion "read-ls"
 *   downloads – Datei speichern/teilen (Handy: Teilen-Dialog, Browser: Download)
 */
(function () {
  "use strict";
  const CFG = window.RWE_CONFIG || {};
  const ADMIN_COLLS = new Set(["erzeuger", "lieferanten", "config"]);
  const BUCKET = "files";
  const $ = (id) => document.getElementById(id);
  const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

  if (!window.supabase || !CFG.supabaseUrl || !CFG.supabaseAnonKey) {
    console.error("[RWE] config.js fehlt oder ist unvollständig");
    window.claude = { use: async () => null };
    return;
  }
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "rwe-auth" },
  });

  /* ---------------- Hilfen ---------------- */
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const rid = (n = 20) => {
    const a = "abcdefghijklmnopqrstuvwxyz0123456789";
    const b = crypto.getRandomValues(new Uint8Array(n));
    return Array.from(b, (x) => a[x % a.length]).join("");
  };
  const hexId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, "0")).join("");
  const online = () => navigator.onLine !== false;
  const isNetErr = (e) => !!e && (e.name === "TypeError" || /fetch|network|Failed to fetch|Load failed|NetworkError/i.test(String(e.message || e)));
  function blobToB64(blob) {
    return new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.readAsDataURL(blob); });
  }
  function abToB64(buf) {
    const u = new Uint8Array(buf); let s = "";
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function note(text) {
    const el = $("toast"); if (!el) return;
    el.textContent = text; el.hidden = false;
    clearTimeout(note.h); note.h = setTimeout(() => (el.hidden = true), 4500);
  }

  /* ---------------- IndexedDB ---------------- */
  let idbp = null;
  function idbOpen() {
    if (!idbp) idbp = new Promise((res, rej) => {
      const r = indexedDB.open("rwe", 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore("kv"); d.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true }); d.createObjectStore("blobs"); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return idbp;
  }
  async function idb(store, mode, fn) {
    const d = await idbOpen();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode); const s = t.objectStore(store); let out;
      const r = fn(s); if (r) r.onsuccess = () => (out = r.result);
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  }
  const kvGet = (k) => idb("kv", "readonly", (s) => s.get(k)).catch(() => undefined);
  const kvSet = (k, v) => idb("kv", "readwrite", (s) => s.put(v, k)).catch(() => {});
  const blobGet = (k) => idb("blobs", "readonly", (s) => s.get(k)).catch(() => undefined);
  const blobSet = (k, v) => idb("blobs", "readwrite", (s) => s.put(v, k));
  const blobDel = (k) => idb("blobs", "readwrite", (s) => s.delete(k)).catch(() => {});

  /* ---------------- Cache + Abonnenten ---------------- */
  const CACHE = {};           // coll -> Map(id -> data)
  const LOADED = {};          // coll -> Promise
  const LIS = new Set();      // {coll, id?, order?, limit?, cb}
  let OUT = [];               // Warteschlange (Spiegel der IDB-Outbox)
  const persistT = {};
  function coll(c) { return CACHE[c] || (CACHE[c] = new Map()); }
  function persist(c) {
    clearTimeout(persistT[c]);
    persistT[c] = setTimeout(() => kvSet("cache:" + c, Object.fromEntries(coll(c))), 400);
  }
  function snapDoc(c, id) {
    const has = coll(c).has(id); const d = coll(c).get(id);
    return { id, exists: has, data: () => (has ? clone(d) : undefined) };
  }
  function snapQuery(c, order, limit) {
    let rows = [...coll(c).entries()].map(([id, d]) => ({ id, d }));
    if (order) {
      const [f, dir] = order;
      rows.sort((a, b) => { const x = String(a.d?.[f] ?? ""), y = String(b.d?.[f] ?? ""); return dir === "desc" ? y.localeCompare(x) : x.localeCompare(y); });
    }
    if (limit) rows = rows.slice(0, limit);
    return { docs: rows.map((r) => ({ id: r.id, exists: true, data: () => clone(r.d) })), size: rows.length, empty: !rows.length };
  }
  let emitQ = new Set(), emitT = null;
  function emit(c) {
    emitQ.add(c);
    if (emitT) return;
    emitT = setTimeout(() => {
      const cs = emitQ; emitQ = new Set(); emitT = null;
      for (const l of LIS) {
        if (!cs.has(l.coll)) continue;
        try { l.cb(l.id ? snapDoc(l.coll, l.id) : snapQuery(l.coll, l.order, l.limit)); } catch (e) { console.error(e); }
      }
    }, 0);
  }
  const pendingFor = (c, id) => OUT.some((o) => o.coll === c && o.id === id);
  function applyLocal(op) {
    const m = coll(op.coll);
    if (op.op === "set") m.set(op.id, clone(op.data));
    else if (op.op === "merge") m.set(op.id, { ...(m.get(op.id) || {}), ...clone(op.data) });
    else if (op.op === "delete") m.delete(op.id);
  }
  async function fetchColl(c) {
    const rows = []; let from = 0; const page = 1000;
    for (;;) {
      const { data, error } = await sb.from("docs").select("id,data").eq("collection", c).range(from, from + page - 1);
      if (error) throw error;
      rows.push(...data); if (data.length < page) break; from += page;
    }
    const m = new Map(rows.map((r) => [r.id, r.data]));
    CACHE[c] = m;
    for (const o of OUT) if (o.coll === c) applyLocal(o);
    persist(c); emit(c);
  }
  function ensureLoaded(c) {
    if (!LOADED[c]) LOADED[c] = (async () => {
      const saved = await kvGet("cache:" + c);
      if (saved && !CACHE[c]?.size) { CACHE[c] = new Map(Object.entries(saved)); for (const o of OUT) if (o.coll === c) applyLocal(o); emit(c); }
      if (online()) { try { await fetchColl(c); } catch (e) { if (!isNetErr(e)) console.warn("[RWE] Laden", c, e); } }
    })();
    return LOADED[c];
  }

  /* ---------------- Warteschlange ---------------- */
  let flushing = false, inflight = null;
  async function enqueue(op) {
    if (op.op === "set" || op.op === "delete") {
      const drop = OUT.filter((o) => o !== inflight && o.coll === op.coll && o.id === op.id && o.op !== "blob");
      if (drop.length) {
        OUT = OUT.filter((o) => !drop.includes(o));
        await idb("outbox", "readwrite", (s) => { drop.forEach((o) => s.delete(o.seq)); return null; }).catch(() => {});
      }
    }
    const rec = { ...op }; delete rec.seq;
    const seq = await idb("outbox", "readwrite", (s) => s.add(rec));
    rec.seq = seq; OUT.push(rec); updNet();
    flush();
  }
  async function dequeue(o) {
    OUT = OUT.filter((x) => x !== o);
    await idb("outbox", "readwrite", (s) => s.delete(o.seq)).catch(() => {});
    updNet();
  }
  async function flush() {
    if (flushing || !online() || !session) return;
    flushing = true;
    try {
      while (OUT.length && online()) {
        const o = OUT[0]; inflight = o;
        try {
          if (o.op === "set") {
            const { data, error } = await sb.from("docs").upsert({ collection: o.coll, id: o.id, data: o.data, updated_at: new Date().toISOString() }).select("id,data").single();
            if (error) throw error;
            if (o.coll === "wareneingaenge" && data?.data?.charge && o.data?.charge && data.data.charge !== o.data.charge)
              note(`Charge ${o.data.charge} war schon vergeben – neu: ${data.data.charge}. Bitte Etiketten neu drucken.`);
            await dequeue(o);
            if (!pendingFor(o.coll, o.id)) { coll(o.coll).set(o.id, data.data); persist(o.coll); emit(o.coll); }
          } else if (o.op === "merge") {
            const { data, error } = await sb.rpc("doc_merge", { p_collection: o.coll, p_id: o.id, p_patch: o.data });
            if (error) throw error;
            await dequeue(o);
            if (data && !pendingFor(o.coll, o.id)) { coll(o.coll).set(o.id, data); persist(o.coll); emit(o.coll); }
          } else if (o.op === "delete") {
            const { error } = await sb.from("docs").delete().match({ collection: o.coll, id: o.id });
            if (error) throw error;
            await dequeue(o);
          } else if (o.op === "blob") {
            const blob = await blobGet(o.id);
            if (blob) {
              const { error } = await sb.storage.from(BUCKET).upload(o.id, blob, { contentType: o.type || blob.type || "application/octet-stream", upsert: true });
              if (error && !/exists/i.test(error.message || "")) throw error;
              await blobDel(o.id);
            }
            await dequeue(o);
          } else await dequeue(o);
        } catch (e) {
          if (isNetErr(e) || e?.status === 0 || /JWT|token/i.test(e?.message || "")) { break; }
          console.warn("[RWE] Änderung abgelehnt", o, e);
          await dequeue(o);
          note("Eine Änderung wurde vom Server abgelehnt: " + (e?.message || "unbekannter Fehler").slice(0, 120));
          if (o.coll) { try { await fetchColl(o.coll); } catch (_) {} }
        } finally { inflight = null; }
      }
    } finally { flushing = false; updNet(); }
  }

  /* ---------------- Live-Abgleich ---------------- */
  let channel = null;
  function startRealtime() {
    if (channel) return;
    channel = sb.channel("docs-all").on("postgres_changes", { event: "*", schema: "public", table: "docs" }, (p) => {
      const row = p.eventType === "DELETE" ? p.old : p.new;
      if (!row || !row.collection || !row.id) return;
      const c = row.collection; if (!LOADED[c] || pendingFor(c, row.id)) return;
      if (p.eventType === "DELETE") coll(c).delete(row.id); else coll(c).set(row.id, row.data);
      persist(c); emit(c);
    }).subscribe((st) => { if (st === "SUBSCRIBED") Object.keys(LOADED).forEach((c) => fetchColl(c).catch(() => {})); });
  }

  /* ---------------- db-Schnittstelle ---------------- */
  function checkWrite(c) {
    if (ADMIN_COLLS.has(c) && profile?.role !== "admin") { const e = new Error("Keine Schreibrechte"); e.code = "permission_denied"; throw e; }
  }
  function docRef(c, id) {
    return {
      id, path: c + "/" + id,
      async get() {
        if (online() && !pendingFor(c, id)) {
          try {
            const { data, error } = await sb.from("docs").select("data").eq("collection", c).eq("id", id).maybeSingle();
            if (error) throw error;
            if (data) coll(c).set(id, data.data); else coll(c).delete(id);
            persist(c);
          } catch (e) { if (!isNetErr(e)) throw e; }
        } else await ensureLoaded(c);
        return snapDoc(c, id);
      },
      async set(data) { checkWrite(c); const op = { op: "set", coll: c, id, data: clone(data) }; applyLocal(op); persist(c); emit(c); await enqueue(op); },
      async update(data) { checkWrite(c); const op = { op: "merge", coll: c, id, data: clone(data) }; applyLocal(op); persist(c); emit(c); await enqueue(op); },
      async delete() { checkWrite(c); const op = { op: "delete", coll: c, id }; applyLocal(op); persist(c); emit(c); await enqueue(op); },
      onSnapshot(cb) { const l = { coll: c, id, cb }; LIS.add(l); ensureLoaded(c).then(() => emit(c)); emit(c); return () => LIS.delete(l); },
    };
  }
  function query(c, order, limit) {
    return {
      orderBy(f, dir) { return query(c, [f, dir || "asc"], limit); },
      limit(n) { return query(c, order, n); },
      doc(id) { return docRef(c, id); },
      async add(data) { const id = rid(); await docRef(c, id).set(data); return docRef(c, id); },
      async get() { await ensureLoaded(c); return snapQuery(c, order, limit); },
      onSnapshot(cb) { const l = { coll: c, order, limit, cb }; LIS.add(l); ensureLoaded(c).then(() => emit(c)); emit(c); return () => LIS.delete(l); },
    };
  }
  const dbApi = Object.freeze({
    collection: (name) => query(String(name).split("/")[0]),
    doc: (path) => { const [c, id] = String(path).split("/"); return docRef(c, id); },
  });

  /* ---------------- Dateien ---------------- */
  const _fetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input?.url || "";
    const m = url.match(/^\/_blob\/([A-Za-z0-9_-]+)/);
    if (!m) return _fetch(input, init);
    const local = await blobGet(m[1]);
    if (local) return new Response(local, { status: 200, headers: { "Content-Type": local.type || "application/octet-stream" } });
    if (!online()) return new Response(null, { status: 503 });
    const { data, error } = await sb.storage.from(BUCKET).download(m[1]);
    if (error || !data) return new Response(null, { status: 404 });
    return new Response(data, { status: 200, headers: { "Content-Type": data.type || "application/octet-stream" } });
  };
  const assetsApi = Object.freeze({
    async upload(blob) {
      const id = hexId();
      await blobSet(id, blob);
      await enqueue({ op: "blob", id, type: blob.type });
      return { id, url: URL.createObjectURL(blob), sizeBytes: blob.size, contentType: blob.type };
    },
    async list() { return { assets: [], usage: {} }; },
    async delete(id) { await blobDel(id); try { await sb.storage.from(BUCKET).remove([id]); } catch (_) {} },
  });

  /* ---------------- Benutzer ---------------- */
  let session = null, profile = null;
  const NAMES = {};
  const uid = () => "u_" + session.user.id;
  const userApi = Object.freeze({
    async id() { return uid(); },
    async me() { return { id: uid(), name: profile?.name || "", email: session.user.email }; },
    isOwner() { return profile?.role === "admin"; },
    canEdit() { return profile?.role === "admin"; },
    can() { return true; },
    async profiles(ids) {
      const want = (ids || []).filter((i) => String(i).startsWith("u_")).map((i) => String(i).slice(2));
      const miss = want.filter((u) => !(("u_" + u) in NAMES));
      if (miss.length && online()) {
        try {
          const { data } = await sb.from("profiles").select("id,name").in("id", miss);
          (data || []).forEach((p) => (NAMES["u_" + p.id] = p.name || ""));
          miss.forEach((u) => { if (!(("u_" + u) in NAMES)) NAMES["u_" + u] = ""; });
          kvSet("names", NAMES);
        } catch (_) {}
      }
      const out = {}; (ids || []).forEach((i) => (out[i] = { id: i, name: NAMES[i] || "" })); return out;
    },
    async search() { return []; },
  });

  /* ---------------- Mailversand (wie früher Gmail send_message) ---------------- */
  async function invoke(fn, body) {
    if (!online()) { const e = new Error("offline"); e.code = "offline"; throw e; }
    const { data, error } = await sb.functions.invoke(fn, { body });
    if (error) {
      let msg = error.message || "Fehler", code = "tool_error";
      try { const j = await error.context?.json?.(); if (j?.error) { msg = j.error.message || j.error; code = j.error.code || code; } } catch (_) {}
      if (isNetErr(error)) code = "server_unavailable";
      const e = new Error(msg); e.code = code; throw e;
    }
    return data;
  }
  const mcpApi = Object.freeze({
    async listTools() { return { servers: [{ server: "Mail", tools: ["send_message"] }], fileArgs: false }; },
    async callTool(server, tool, input) {
      if (tool !== "send_message") { const e = new Error("unbekannt"); e.code = "not_in_manifest"; throw e; }
      const data = await invoke("send-mail", input);
      return { payload: data, content: [] };
    },
  });

  /* ---------------- Lieferschein lesen ---------------- */
  async function sampleCall(input, opts = {}) {
    const images = [];
    for (const b of opts.images || []) images.push({ media_type: b.type || "image/jpeg", data: await blobToB64(b) });
    const data = await invoke("read-ls", { input, images });
    return { text: data?.text || "", truncated: !!data?.truncated };
  }
  const sampleApi = Object.assign(sampleCall, {
    async json(input, opts) {
      const r = await sampleCall(input, opts);
      const t = r.text.trim(); const m = t.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      try { return JSON.parse(m ? m[0] : t); } catch (_) { const e = new Error("Antwort war kein JSON"); e.code = "bad_response"; throw e; }
    },
    async limits() { return { images: true }; },
  });
  Object.freeze(sampleApi);

  /* ---------------- Speichern / Teilen ---------------- */
  const downloadsApi = Object.freeze({
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const P = window.Capacitor?.Plugins;
      if (isNative && P?.Filesystem && P?.Share) {
        const b64 = data instanceof ArrayBuffer ? abToB64(data) : await blobToB64(blob);
        const safe = String(filename).replace(/[^\w.\-]+/g, "_");
        const w = await P.Filesystem.writeFile({ path: safe, data: b64, directory: "CACHE" });
        try { await P.Share.share({ title: safe, files: [w.uri] }); }
        catch (e) { if (/cancel/i.test(String(e?.message || e))) { const x = new Error("abgebrochen"); x.code = "declined"; throw x; } throw e; }
        return;
      }
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    },
  });

  /* ---------------- Statusanzeige Netz / Warteschlange ---------------- */
  function updNet() {
    let el = $("rwe-net");
    if (!el) {
      const host = document.querySelector("header.top .wrap"); if (!host) return;
      el = document.createElement("span"); el.id = "rwe-net"; el.className = "pill";
      el.style.cssText = "order:2;font-size:13px";
      host.appendChild(el);
    }
    const n = OUT.length;
    if (!online()) { el.hidden = false; el.className = "pill p-warn"; el.textContent = n ? `offline · ${n} wartet` : "offline"; }
    else if (n) { el.hidden = false; el.className = "pill p-info"; el.textContent = `sendet ${n} …`; }
    else el.hidden = true;
  }
  window.addEventListener("online", () => { updNet(); flush(); Object.keys(LOADED).forEach((c) => fetchColl(c).catch(() => {})); });
  window.addEventListener("offline", updNet);
  setInterval(() => { if (OUT.length) flush(); }, 20000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) flush(); });

  /* ---------------- Anmeldung ---------------- */
  function loginView(msg) {
    let ov = $("rwe-login");
    if (!ov) {
      ov = document.createElement("div"); ov.id = "rwe-login";
      ov.innerHTML = `<style>
        #rwe-login{position:fixed;inset:0;z-index:100;background:var(--field,#1b5aa6);display:grid;place-items:center;padding:24px max(16px,env(safe-area-inset-right,0px)) 24px max(16px,env(safe-area-inset-left,0px));overflow:auto}
        #rwe-login form{box-sizing:border-box;background:var(--panel,#fff);color:var(--ink,#0f2440);border-radius:20px;padding:24px;width:100%;max-width:400px;display:flex;flex-direction:column;gap:14px;box-shadow:0 10px 40px rgba(0,0,0,.25)}
        #rwe-login h1{margin:0;font-family:var(--f-display,sans-serif);font-size:30px;text-transform:uppercase;letter-spacing:.02em}
        #rwe-login p{margin:0;color:var(--muted,#56687e);font-size:15px}
        #rwe-login .err{color:var(--bad,#b3261e);font-weight:600;min-height:1.2em}
        #rwe-login input[type=password]{font:inherit;font-size:18px;color:var(--ink);background:var(--panel);border:2px solid var(--line);border-radius:10px;padding:10px 12px;width:100%;box-sizing:border-box}
      </style>
      <form id="rwe-login-f" novalidate>
        <div><h1>Rettermayer WE</h1><p>Wareneingang Knoblauch · VG Bio Bauern</p></div>
        <label class="f">E-Mail<input type="email" id="rwe-email" autocomplete="username" inputmode="email" required></label>
        <label class="f">Passwort<input type="password" id="rwe-pw" autocomplete="current-password" required></label>
        <p class="err" id="rwe-err" role="alert"></p>
        <button class="btn primary" id="rwe-go" type="submit">Anmelden</button>
        <p>Zugang bekommst du von deinem Admin. Passwort vergessen? Admin fragen, er setzt es in der App neu.</p>
      </form>`;
      document.body.appendChild(ov);
      $("rwe-login-f").addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const email = $("rwe-email").value.trim(), password = $("rwe-pw").value;
        if (!email || !password) { $("rwe-err").textContent = "Bitte E-Mail und Passwort eingeben."; return; }
        if (!online()) { $("rwe-err").textContent = "Für die erste Anmeldung braucht das Handy Netz."; return; }
        $("rwe-go").disabled = true; $("rwe-go").textContent = "Melde an …"; $("rwe-err").textContent = "";
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        $("rwe-go").disabled = false; $("rwe-go").textContent = "Anmelden";
        if (error) { $("rwe-err").textContent = /Invalid login/i.test(error.message) ? "E-Mail oder Passwort stimmt nicht." : isNetErr(error) || /fetch/i.test(error.message) ? "Server nicht erreichbar. Bitte Netz prüfen und erneut versuchen." : "Anmeldung fehlgeschlagen: " + error.message; return; }
        session = data.session; await afterLogin(); ov.remove();
      });
    }
    if (msg) $("rwe-err").textContent = msg;
    setTimeout(() => $("rwe-email")?.focus(), 50);
  }
  async function loadProfile() {
    const cached = await kvGet("profile:" + session.user.id);
    if (cached) profile = cached;
    if (online()) {
      try {
        const { data, error } = await sb.from("profiles").select("id,name,role").eq("id", session.user.id).maybeSingle();
        if (!error && data) { profile = data; kvSet("profile:" + session.user.id, data); }
      } catch (_) {}
    }
    if (!profile) profile = { id: session.user.id, name: session.user.email, role: "user" };
    NAMES[uid()] = profile.name || "";
  }
  let readyResolve; const ready = new Promise((r) => (readyResolve = r));
  async function afterLogin() {
    await loadProfile();
    const savedNames = await kvGet("names"); if (savedNames) Object.assign(NAMES, savedNames);
    OUT = (await idb("outbox", "readonly", (s) => s.getAll()).catch(() => [])) || [];
    updNet(); startRealtime(); flush();
    readyResolve();
  }
  sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") location.reload(); });
  (async () => {
    const { data } = await sb.auth.getSession();
    session = data.session;
    if (session) await afterLogin(); else loginView();
  })();

  /* ---------------- Für die App ---------------- */
  const CAPS = { db: dbApi, assets: assetsApi, user: userApi, mcp: mcpApi, sample: sampleApi, downloads: downloadsApi };
  window.claude = Object.freeze({ use: async (name) => { await ready; return CAPS[name] || null; } });
  window.RWE = Object.freeze({
    native: isNative,
    profile: () => (profile ? { ...profile, email: session?.user?.email } : null),
    isAdmin: () => profile?.role === "admin",
    pending: () => OUT.length,
    async logout() {
      if (OUT.length && !confirmLogout()) return;
      await sb.auth.signOut();
    },
    users: {
      list: () => invoke("users", { action: "list" }),
      create: (u) => invoke("users", { action: "create", ...u }),
      update: (u) => invoke("users", { action: "update", ...u }),
    },
  });
  let logoutAsked = false;
  function confirmLogout() {
    if (logoutAsked) return true;
    logoutAsked = true; setTimeout(() => (logoutAsked = false), 6000);
    note(`Noch ${OUT.length} Änderung(en) nicht gesendet. Zum Abmelden trotzdem nochmal tippen.`);
    return false;
  }
})();
