/* Rettermayer WE – Lieferscheine (Warenausgang) und Bestand
   Bestellung einladen (Foto, PDF, Drag & Drop) → auslesen → Charge je Position wählen → abschließen → PDF-Vorschau
   → Versand an Spedition / Kontrollstelle. Die Lieferschein-Nr. kommt aus büro+.
   Paletten-Etiketten mit Barcode: beim Verladen wird je Palette gescannt, nicht je Kiste.
   Bestand je Produkt = Wareneingang (KNT: Brutto B, sonst Menge) minus abgeschlossene Lieferscheine; Warnung unter der Schwelle (Standard 10.000 kg). */
(function () {
"use strict";
const LS_ED = "rwe-la-ed";
const EINH = ["Kolli", "Karton", "Stück", "kg", "Palette"];
const LA_DEF = {
  absender: "Vermarktungsgesellschaft Bio-Bauern mbH, Marktplatz 19, 86554 Pöttmes",
  fuss: [
    "Vermarktungsgesellschaft\nBio-Bauern mbH\nMarktplatz 19\nD-86554 Pöttmes",
    "Sitz der Gesellschaft: Pöttmes\nHRB 26286 Augsburg\nGeschäftsführer: Andreas Hopf\nSteuer Nr.: 102/141/30152",
    "Tel.: 08253 997020-0\nE-Mail: buero@bio-vg.de\nURL: www.bio-vg.de\nDE-ÖKO-006 · USt-IdNr.: DE278098048",
    "Bankverbindung: VR Bank Neuburg – Rain eG\nIBAN: DE29 7216 9756 0000 0248 56\nBIC: GENODEF1ND2",
  ].join("\n\n"),
  empf: [{ name: "Spedition Schmied", email: "" }, { name: "MTG", email: "" }, { name: "Ökoring", email: "" }],
  min: 10000,
};
const LA = { ed: null, filt: "offen", list: [], open: null };
window.LA = LA;
const cfg = () => ({ absender: CFG.laAbsender || LA_DEF.absender, fuss: CFG.laFuss || LA_DEF.fuss, empf: Array.isArray(CFG.laEmpf) && CFG.laEmpf.length ? CFG.laEmpf : LA_DEF.empf, min: num(CFG.bestandMin) || LA_DEF.min });
const kg = (n, d = 0) => K.fmtKg(n, d);
const today = () => isoDate(new Date());
const P_NAME = { KNT: "Knoblauch trocken", KNF: "Knoblauch frisch", KPG: "Pflanzgut" };

/* ---------------- Bestand ---------------- */
function zugangKg(v) { if (v.produkt === "KNT") return v.stufe === "verwogen" ? v.brutto2 || 0 : v.brutto1 || 0; return v.mengeKg ?? v.brutto1 ?? 0; }
function abgang() { const m = {}; LA.list.filter((l) => l.status === "abgeschlossen").forEach((l) => (l.positionen || []).forEach((p) => { if (p.chargeId) m[p.chargeId] = (m[p.chargeId] || 0) + (num(p.gewicht) || 0); })); return m; }
function restJeCharge() { const ab = abgang(); const out = {}; VORG.forEach((v) => { out[v.id] = zugangKg(v) - (ab[v.id] || 0); }); return out; }
function bestand() { const r = restJeCharge(), b = {}; VORG.forEach((v) => { if (!P_NAME[v.produkt]) return; b[v.produkt] = (b[v.produkt] || 0) + Math.max(0, r[v.id] || 0); }); return b; }
function warnungen() {
  const b = bestand(), min = cfg().min, seit = new Date(Date.now() - 60 * 864e5).toISOString();
  return Object.keys(P_NAME).filter((p) => VORG.some((v) => v.produkt === p && String(v.erstellt || v.datum) >= seit.slice(0, 10)) && (b[p] || 0) < min).map((p) => ({ p, kg: b[p] || 0 }));
}
LA.banner = function () {
  let el = document.getElementById("bwarn"); const main = document.getElementById("main"); if (!main) return;
  if (!el) { el = document.createElement("div"); el.id = "bwarn"; main.parentNode.insertBefore(el, main); }
  const w = warnungen();
  el.innerHTML = w.length ? `<div class="wrap"><div class="lawarn">⚠ <b>Bestand niedrig:</b> ${w.map((x) => `${esc(P_NAME[x.p])} nur noch ${kg(x.kg)} kg`).join(" · ")} <span>(Warnschwelle ${kg(cfg().min)} kg)</span> <button class="btn small" data-la="go">Lieferscheine & Bestand</button></div></div>` : "";
};

/* ---------------- Editor ---------------- */
function newPos(x = {}) { return { menge: "", einheit: "Kolli", nummer: "", gewicht: "", text: "", chargeId: "", paletten: "", ...x }; }
function newEd() { return { id: null, nr: "", datum: today(), lieferdatum: today(), kundeName: "", kundeAdr: "", kundeNr: "", bestellNr: "", belege: [], pos: [newPos()], bem: "", busy: false, msg: "", ok: false, aktiv: 0 }; }
function persist() { if (!LA.ed || LA.ed.id) return; clearTimeout(persist.t); persist.t = setTimeout(() => { try { localStorage.setItem(LS_ED, JSON.stringify({ ...LA.ed, busy: false })); } catch (_) {} }, 300); }
function ladeEntwurf() { try { const s = JSON.parse(localStorage.getItem(LS_ED) || "null"); if (s && Array.isArray(s.pos)) return { ...newEd(), ...s, busy: false }; } catch (_) {} return null; }
function clearEntwurf() { try { localStorage.removeItem(LS_ED); } catch (_) {} }
const istWare = (p) => num(p.gewicht) > 0;
function chargeZusatz(v) {
  if (!v) return "";
  const e = (v.produkt === "KPG" ? LIEF : ERZ).find((x) => x.id === v.erzeugerId) || {};
  return [v.sorte ? `Sorte: ${v.sorte}` : "", `Ursprungsland: ${v.produkt === "KPG" ? v.herkunftsland || e.land || "-" : e.land || "Deutschland"}`, `Charge: ${v.charge}`, v.lot ? `LOT: ${v.lot}` : "",
    e.ggn ? `GGN Erzeuger: ${e.ggn}` : "", e.qs || v.qs ? `QS ID: ${e.qs || v.qs}` : ""].filter(Boolean).join("\n");
}
function fehlt() {
  const e = LA.ed, out = [];
  if (!String(e.nr).trim()) out.push("Lieferschein-Nr. aus büro+ eintragen");
  if (!e.kundeName.trim()) out.push("Kunde eintragen");
  if (!e.pos.some((p) => num(p.menge) > 0)) out.push("Mindestens eine Position mit Menge");
  e.pos.forEach((p, i) => { if (istWare(p) && !p.chargeId) out.push(`Position ${i + 1}: Charge wählen`); });
  return out;
}
function chargenAuswahl(cur) {
  const r = restJeCharge();
  return VORG.filter((v) => P_NAME[v.produkt] && (r[v.id] > 0.5 || v.id === cur)).sort((a, b) => String(a.datum).localeCompare(String(b.datum)))
    .map((v) => `<option value="${esc(v.id)}" ${v.id === cur ? "selected" : ""}>${esc(v.charge)} · ${esc(v.sorte || "")} · ${esc(v.erzeuger)} · Rest ${kg(Math.max(0, r[v.id]))} kg${v.produkt === "KNT" && v.stufe !== "verwogen" ? " (Brutto A)" : ""}</option>`).join("");
}
function kundenListe() { const m = new Map(); LA.list.forEach((l) => { if (l.kundeName && !m.has(l.kundeName)) m.set(l.kundeName, l); }); return [...m.values()]; }
function viewEd() {
  const e = LA.ed, f = fehlt(), r = restJeCharge(), netto = e.pos.reduce((a, p) => a + (num(p.gewicht) || 0), 0);
  return `<div class="chips" style="margin-bottom:6px"><button class="btn small" data-la="ed-close">← Lieferscheine</button></div>
  <h1>${e.id ? "Lieferschein " + esc(e.nr) + " bearbeiten" : "Neuer Lieferschein"}</h1>
  <p class="lead">Bestellung einladen, Charge je Position wählen (oder Etikett der Charge scannen), abschließen – die PDF-Vorschau kommt sofort.</p>
  <section class="card kdz" data-ladrop="1"><h2><span class="knum">1</span>Bestellung</h2>
    <div class="kbig">${K.pick("btn primary kbtn", "📷 Bestellung fotografieren", { kind: "la" }, { capture: true, kp: "la-foto", disabled: e.busy })}${K.pick("btn kbtn", "📎 Datei wählen", { kind: "la" }, { accept: K.ACC_ALL, multiple: true, kp: "la-file", disabled: e.busy })}</div>
    <p class="hint kdrophint">oder Bestellung (PDF, Foto, Mail-Ausdruck) hierher ziehen</p>
    ${e.busy ? `<div class="kread"><span class="kspin"></span>Bestellung wird gelesen …</div>` : e.msg ? `<div class="kread ${e.ok ? "ok" : "warn"}">${esc(e.msg)}</div>` : ""}
    ${e.belege.length ? `<div class="kthumbs">${e.belege.map((b, i) => `<figure>${/^image\//.test(b.type) && K.thumb(b.id) ? `<img src="${K.thumb(b.id)}" alt="">` : `<div class="kfile">${/pdf/i.test(b.type) ? "PDF" : "DOC"}</div>`}<figcaption>${esc(b.name)}</figcaption><button data-la="beleg-del" data-i="${i}" aria-label="Entfernen">×</button></figure>`).join("")}</div>` : ""}
  </section>
  <section class="card"><h2><span class="knum">2</span>Kopf</h2>
    <div class="kgrid">
      <label class="f">Lieferschein-Nr. (büro+)<input type="text" id="la-nr" value="${esc(e.nr)}" inputmode="numeric" autocomplete="off"></label>
      <label class="f">Datum<input type="date" id="la-datum" value="${esc(e.datum)}"></label>
      <label class="f">Lieferdatum<input type="date" id="la-lieferdatum" value="${esc(e.lieferdatum)}"></label>
      <label class="f">Bestell-Nr.<input type="text" id="la-bestellNr" value="${esc(e.bestellNr)}" autocomplete="off"></label>
      <label class="f">Kunden-Nr.<input type="text" id="la-kundeNr" value="${esc(e.kundeNr)}" autocomplete="off"></label>
    </div>
    <div class="kgrid" style="margin-top:10px">
      <label class="f">Kunde<input type="text" id="la-kundeName" list="la-kunden" value="${esc(e.kundeName)}" autocomplete="off"><datalist id="la-kunden">${kundenListe().map((k) => `<option value="${esc(k.kundeName)}">`).join("")}</datalist></label>
      <label class="f">Anschrift<textarea id="la-kundeAdr" rows="4">${esc(e.kundeAdr)}</textarea></label>
    </div></section>
  <section class="card"><h2><span class="knum">3</span>Positionen</h2>
    <p class="hint">Tipp: Etikett einer Charge oder Palette mit Kamera oder Bluetooth-Scanner scannen – die Charge kommt in die markierte Position.</p>
    ${e.pos.map((p, i) => { const v = VORG.find((x) => x.id === p.chargeId); const alt = e.id && LA.list.find((l) => l.id === e.id && l.status === "abgeschlossen"); const eigen = alt ? alt.positionen.filter((q) => q.chargeId === p.chargeId).reduce((a, q) => a + (q.gewicht || 0), 0) : 0; const rest = v ? r[v.id] + eigen : null; const zuviel = v && num(p.gewicht) > rest + 0.5;
      return `<div class="lapos${e.aktiv === i ? " akt" : ""}" data-la="pos-akt" data-i="${i}"><div class="pphead"><b>Pos. ${i + 1}</b>${e.pos.length > 1 ? `<button class="btn small" data-la="pos-del" data-i="${i}" aria-label="Position ${i + 1} entfernen">✕</button>` : ""}</div>
      <div class="lagrid">
        <label class="f">Menge<input type="number" inputmode="decimal" id="lp-menge-${i}" value="${esc(p.menge)}"></label>
        <label class="f">Einheit<select id="lp-einheit-${i}">${EINH.map((x) => `<option ${p.einheit === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>
        <label class="f">Nummer<input type="text" id="lp-nummer-${i}" value="${esc(p.nummer)}"></label>
        <label class="f">Gewicht [kg]<input type="number" inputmode="decimal" id="lp-gewicht-${i}" value="${esc(p.gewicht)}"></label>
        <label class="f">Paletten<input type="number" inputmode="numeric" min="0" id="lp-paletten-${i}" value="${esc(p.paletten)}"></label>
      </div>
      <label class="f">Text<textarea id="lp-text-${i}" rows="3">${esc(p.text)}</textarea></label>
      ${istWare(p) || p.chargeId ? `<label class="f">Charge<select id="lp-charge-${i}"><option value="">– Charge wählen –</option>${chargenAuswahl(p.chargeId)}</select></label>
      ${v ? `<div class="hint" style="white-space:pre-line;margin:6px 0 0">${esc(chargeZusatz(v))}</div>` : ""}${zuviel ? `<div class="warnbox" style="margin-top:6px">Mehr als der Restbestand der Charge (${kg(Math.max(0, rest))} kg)</div>` : ""}` : ""}
      </div>`; }).join("")}
    <div class="chips"><button class="btn dark" data-la="pos-add">+ Position</button><button class="btn small" data-la="pos-vp" data-v="Karton Einweg">+ Karton Einweg</button><button class="btn small" data-la="pos-vp" data-v="Europalette">+ Europalette</button></div>
    <p style="margin:10px 0 0;font-size:18px">Nettogewicht: <b class="kb1" id="la-netto">${kg(netto, 1)} kg</b></p></section>
  <label class="f">Bemerkung <span class="h">optional, erscheint auf dem Lieferschein</span><input type="text" id="la-bem" value="${esc(e.bem)}"></label>
  <div class="chips" style="margin-top:10px"><button class="btn small" data-la="ed-verwerfen">Verwerfen</button></div>
  <div class="kbar"><div class="msg" id="la-msg"><b>${e.pos.length} Position${e.pos.length > 1 ? "en" : ""} · ${kg(netto, 1)} kg</b><br>${f.length ? esc(f[0]) : ""}</div>
    <button class="btn" data-la="ed-save" ${e.busy ? "disabled" : ""}>Entwurf speichern</button><button class="btn primary" data-la="ed-fertig" ${f.length || e.busy ? "disabled" : ""}>Abschließen & PDF</button></div>`;
}
function refreshBar() {
  const e = LA.ed; if (!e) return; const f = fehlt(), netto = e.pos.reduce((a, p) => a + (num(p.gewicht) || 0), 0);
  const m = document.getElementById("la-msg"); if (m) m.innerHTML = `<b>${e.pos.length} Position${e.pos.length > 1 ? "en" : ""} · ${kg(netto, 1)} kg</b><br>${f.length ? esc(f[0]) : ""}`;
  const n = document.getElementById("la-netto"); if (n) n.textContent = kg(netto, 1) + " kg";
  const b = document.querySelector('[data-la="ed-fertig"]'); if (b) b.disabled = !!f.length || e.busy;
}

/* ---------------- Bestellung einlesen ---------------- */
async function bestellungDateien(files) {
  const e = LA.ed; files = [...files]; if (!files.length || e.busy) return;
  e.busy = true; e.msg = ""; render();
  const imgs = [];
  for (const f of files) {
    if (f.size > 15 * 1024 * 1024) { toast(`${f.name}: größer als 15 MB`); continue; }
    try { const img = K.isImgFile(f), pdf = /pdf/i.test(f.type || "") || /\.pdf$/i.test(f.name || "");
      const r = await K.uploadFile(f, img); if (!r) continue; e.belege.push(r);
      if (img) imgs.push({ id: r.id }); else if (pdf) for (const pg of await K.pdfSeiten(f, 3)) imgs.push({ blob: pg });
    } catch (err) { console.error(err); toast(`${f.name}: nicht übernommen`); }
  }
  if (!imgs.length) { e.busy = false; e.ok = false; e.msg = "Datei abgelegt. Auslesen geht mit Foto oder PDF – bitte von Hand eintragen."; persist(); render(); return; }
  if (!sample) { e.busy = false; e.ok = false; e.msg = "Automatisches Auslesen ist nicht eingerichtet – bitte von Hand eintragen."; persist(); render(); return; }
  const prompt = `Du liest eine Bestellung (Foto oder PDF-Seiten) eines Kunden an die Vermarktungsgesellschaft Bio-Bauern mbH (Bio-Knoblauch). Antworte NUR mit JSON in genau dieser Form:
{"kunde":{"name":"Firmenname oder null","zusatz":"z. B. (Lidl) oder null","strasse":"oder null","plz":"oder null","ort":"oder null","land":"oder null"},"kundenNr":"unsere Kunden-/Lieferantennummer beim Kunden oder null","bestellNr":"oder null","lieferdatum":"JJJJ-MM-TT oder null","lieferscheinNr":"nur falls angegeben, sonst null",
"positionen":[{"menge":Zahl,"einheit":"Kolli|Karton|Stück|kg|Palette","artikelNr":"oder null","text":"Artikelbezeichnung wie bestellt, mit Packung, Kaliber, IAN, EAN","gewichtKg":Zahl oder null,"paletten":Zahl oder null}]}
Lieferadresse hat Vorrang vor Rechnungsadresse. Nur was in der Bestellung steht, nichts erfinden.`;
  try {
    const blobs = []; for (const i of imgs.slice(0, 4)) blobs.push(i.blob || (await (await fetch("/_blob/" + i.id)).blob()));
    const j = await sample.json(prompt, { images: blobs, modelTier: "default" }); uebernehmen(j);
  } catch (err) { e.ok = false; e.msg = err?.code === "not_configured" ? "Automatisches Auslesen ist nicht eingerichtet – bitte von Hand eintragen." : err?.code === "offline" ? "Zum Auslesen braucht das Gerät Netz – bitte von Hand eintragen." : "Bestellung konnte nicht gelesen werden – bitte von Hand eintragen."; }
  e.busy = false; persist(); render();
}
function uebernehmen(j) {
  const e = LA.ed, got = []; const k = j?.kunde || {};
  if (k.name && !e.kundeName) { e.kundeName = String(k.name); got.push(e.kundeName); }
  const adr = [k.zusatz, k.strasse, [k.plz, k.ort].filter(Boolean).join(" "), k.land].filter(Boolean).join("\n");
  if (adr && !e.kundeAdr) e.kundeAdr = adr;
  if (!e.kundeAdr && e.kundeName) { const alt = kundenListe().find((x) => x.kundeName === e.kundeName); if (alt) { e.kundeAdr = alt.kundeAdr; e.kundeNr = e.kundeNr || alt.kundeNr; } }
  if (j?.kundenNr && !e.kundeNr) e.kundeNr = String(j.kundenNr);
  if (j?.bestellNr && !e.bestellNr) { e.bestellNr = String(j.bestellNr); got.push("Bestell-Nr. " + e.bestellNr); }
  if (j?.lieferdatum && /^\d{4}-\d{2}-\d{2}$/.test(j.lieferdatum)) { e.lieferdatum = j.lieferdatum; got.push("Lieferdatum " + deDate(j.lieferdatum)); }
  if (j?.lieferscheinNr && !e.nr) e.nr = String(j.lieferscheinNr);
  const pos = Array.isArray(j?.positionen) ? j.positionen.filter((p) => p && (p.menge || p.text)) : [];
  const leer = e.pos.every((p) => !p.menge && !p.text && !p.gewicht);
  if (pos.length && leer) { e.pos = pos.map((p) => newPos({ menge: p.menge != null ? String(p.menge) : "", einheit: EINH.find((x) => x.toLowerCase() === String(p.einheit || "").toLowerCase()) || "Kolli", nummer: p.artikelNr ? String(p.artikelNr) : "", gewicht: p.gewichtKg ? String(p.gewichtKg) : "", text: p.text || "", paletten: p.paletten ? String(p.paletten) : "" })); got.push(`${pos.length} Position${pos.length > 1 ? "en" : ""}`); }
  e.ok = got.length > 0; e.msg = got.length ? `Erkannt und eingetragen: ${got.join(", ")}. Bitte Lieferschein-Nr. aus büro+ eintragen und Charge je Position wählen.` : "Nichts Verwertbares erkannt – bitte von Hand eintragen.";
}

/* ---------------- Speichern, Abschließen ---------------- */
function docAusEd(e) {
  const pos = e.pos.filter((p) => num(p.menge) > 0 || p.text.trim()).map((p) => { const v = VORG.find((x) => x.id === p.chargeId);
    return { menge: num(p.menge), einheit: p.einheit, nummer: p.nummer.trim(), gewicht: num(p.gewicht), text: p.text.trim(), chargeId: p.chargeId || "", charge: v?.charge || "", produkt: v?.produkt || "", sorte: v?.sorte || "", zusatz: chargeZusatz(v), paletten: num(p.paletten) || 0 }; });
  return { nr: String(e.nr).trim(), datum: e.datum, lieferdatum: e.lieferdatum, kundeName: e.kundeName.trim(), kundeAdr: e.kundeAdr.trim(), kundeNr: e.kundeNr.trim(), bestellNr: e.bestellNr.trim(), bem: e.bem.trim(), belege: e.belege.slice(), positionen: pos, nettoKg: pos.reduce((a, p) => a + (p.gewicht || 0), 0) };
}
async function speichern(fertig) {
  const e = LA.ed; if (e.busy) return; if (fertig && fehlt().length) { toast(fehlt()[0]); return; }
  if (fertig && LA.list.some((l) => l.nr === String(e.nr).trim() && l.id !== e.id)) { toast(`Lieferschein-Nr. ${e.nr} gibt es schon`); return; }
  e.busy = true; render();
  const d = docAusEd(e), alt = e.id ? LA.list.find((l) => l.id === e.id) : null;
  Object.assign(d, fertig ? { status: "abgeschlossen", abgeschlossen: new Date().toISOString(), abgeschlossenVon: ME, abgeschlossenVonName: K.meName() } : { status: alt?.status === "abgeschlossen" ? "abgeschlossen" : "entwurf" });
  if (alt && fertig && alt.status === "abgeschlossen") Object.assign(d, { geaendert: new Date().toISOString(), geaendertVonName: K.meName() });
  try {
    let id = e.id;
    if (db) { if (id) await db.doc("lieferscheine/" + id).update(d); else { d.erstellt = new Date().toISOString(); d.erstelltVon = ME; d.erstelltVonName = K.meName(); d.versand = []; d.verladen = {}; const ref = await db.collection("lieferscheine").add(d); id = ref.id; } }
    else { id = id || "ls" + Date.now(); const i = LA.list.findIndex((l) => l.id === id); const full = { ...(alt || { erstellt: new Date().toISOString(), versand: [], verladen: {} }), ...d, id }; if (i >= 0) LA.list[i] = full; else LA.list.unshift(full); }
    clearEntwurf(); LA.ed = null; LA.open = id; e.busy = false;
    const full = { ...(alt || {}), ...d, id, versand: alt?.versand || [], verladen: alt?.verladen || {} };
    if (!db) {} else { const i = LA.list.findIndex((l) => l.id === id); if (i >= 0) LA.list[i] = { ...LA.list[i], ...full }; else LA.list.unshift(full); }
    render(); window.scrollTo(0, 0);
    if (fertig) { const buf = pdfLs(full); showPdf(buf, `Lieferschein_${full.nr}.pdf`, `Lieferschein ${full.nr}`); ablegen(full, buf); }
    else toast("Entwurf gespeichert");
  } catch (err) { console.error(err); e.busy = false; toast("Speichern fehlgeschlagen"); render(); }
}
async function ablegen(l, buf) { if (!assets) return; try { const a = await assets.upload(new Blob([buf], { type: "application/pdf" })); if (db) await db.doc("lieferscheine/" + l.id).update({ pdf: a.id }); l.pdf = a.id; } catch (err) { console.error(err); } }

/* ---------------- PDF Lieferschein (A4, wie büro+) ---------------- */
const pt = (s) => String(s ?? "").replace(/[–—]/g, "-").replace(/[„“]/g, '"').replace(/[^\x00-\xFF\n]/g, "");
function pdfLs(l) {
  const { jsPDF } = window.jspdf; const d = new jsPDF({ unit: "mm", format: "a4", compress: true }); const L = 20, R = 190, W = R - L, BOTTOM = 255;
  const font = (st, sz, c = [0, 0, 0]) => { d.setFont("helvetica", st); d.setFontSize(sz); d.setTextColor(...c); };
  const fuss = () => { const cols = cfg().fuss.split(/\n\s*\n/); const cw = W / Math.max(1, cols.length); d.setDrawColor(160, 160, 160); d.setLineWidth(0.2); d.line(L, 266, R, 266); font("normal", 6.6, [90, 90, 90]); cols.forEach((c, i) => d.text(d.splitTextToSize(pt(c), cw - 3), L + i * cw, 270)); };
  const kopf = (erste) => { try { d.addImage(LOGO_VG, "JPEG", 105 - 19, 6, 38, 38); } catch (_) {} fuss(); return erste ? 54 : 52; };
  let y = kopf(true);
  font("normal", 7.5, [60, 60, 60]); d.text(pt(cfg().absender), L, y); d.setLineWidth(0.1); d.setDrawColor(60, 60, 60); d.line(L, y + 0.8, L + d.getTextWidth(pt(cfg().absender)), y + 0.8); y += 6;
  font("normal", 10.5); const adr = [l.kundeName, ...String(l.kundeAdr || "").split("\n")].filter((x) => x && x.trim()); adr.forEach((z) => { d.text(pt(z), L, y); y += 5; });
  const info = [["Kunden Nr.:", l.kundeNr || "-"], ["Bestellnr.:", l.bestellNr || "-"], ["Lieferdatum:", deDate(l.lieferdatum)], ["Datum:", deDate(l.datum)]];
  let yi = 82; font("normal", 9.5); info.forEach(([a, b]) => { d.text(a, 130, yi); d.text(pt(b), R, yi, { align: "right" }); yi += 4.6; });
  y = Math.max(y, yi) + 10; font("bold", 13); d.text(pt(`Lieferschein Nr. ${l.nr}`), L, y); y += 9;
  const cols = [["Pos", 10], ["Menge", 18, 1], ["", 15], ["Nummer", 22], ["Gewicht", 25, 1], ["Text", W - 90]];
  const hdr = () => { d.setDrawColor(0, 0, 0); d.setLineWidth(0.3); d.rect(L, y - 5, W, 8); font("normal", 9.5); let x = L; cols.forEach((c) => { if (c[0]) d.text(c[0], c[2] ? x + c[1] - 2 : x + 2, y, { align: c[2] ? "right" : "left" }); x += c[1]; }); y += 8; };
  hdr(); let bodyTop = y - 5;
  const closeBox = () => { d.setDrawColor(0, 0, 0); d.setLineWidth(0.3); d.rect(L, bodyTop, W, y - 2 - bodyTop); let xv = L; cols.slice(0, -1).forEach((c) => { xv += c[1]; d.line(xv, bodyTop - 8, xv, y - 2); }); };
  l.positionen.forEach((p, i) => {
    const txt = d.splitTextToSize(pt([p.text, p.zusatz].filter(Boolean).join("\n")), cols[5][1] - 4); const h = Math.max(1, txt.length) * 4.3 + 2;
    if (y + h > BOTTOM) { closeBox(); d.addPage(); y = kopf(false) + 6; hdr(); bodyTop = y - 5; }
    font("normal", 9.5); let x = L; const cells = [String(i + 1), (p.menge ?? "").toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), p.einheit, p.nummer || "", p.gewicht ? p.gewicht.toLocaleString("de-DE", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : ""];
    cells.forEach((c, k) => { d.text(pt(c), cols[k][2] ? x + cols[k][1] - 2 : x + 2, y, { align: cols[k][2] ? "right" : "left" }); x += cols[k][1]; });
    d.text(txt, x + 2, y); y += h;
  });
  closeBox();
  y += 8; font("normal", 10); d.text(pt(`Das Nettogewicht beträgt ${l.nettoKg.toLocaleString("de-DE", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg.`), L, y);
  if (l.bem) { y += 7; d.text(d.splitTextToSize(pt(l.bem), W), L, y); }
  const pal = l.positionen.reduce((a, p) => a + (p.paletten || 0), 0); if (pal) { y += 7; d.text(pt(`Paletten: ${pal}`), L, y); }
  return d.output("arraybuffer");
}

/* ---------------- Paletten-Etiketten (A6) und Verladen per Scan ---------------- */
const palCode = (l, n) => `LS${String(l.nr).replace(/[^A-Za-z0-9]/g, "").toUpperCase()}P${String(n).padStart(2, "0")}`;
function paletten(l) { const out = []; l.positionen.forEach((p, pi) => { for (let k = 0; k < (p.paletten || 0); k++) out.push({ pi, p, k, n: p.paletten }); }); return out.map((x, i) => ({ ...x, nr: i + 1, code: palCode(l, i + 1) })); }
function palPdf(l) {
  const { jsPDF } = window.jspdf; const d = new jsPDF({ unit: "mm", format: "a6", orientation: "portrait" }); const ps = paletten(l), N = ps.length; let first = true;
  for (const x of ps) { if (!first) d.addPage("a6", "portrait"); first = false; const p = x.p;
    d.setFont("helvetica", "bold"); d.setFontSize(8.5); d.setTextColor(0, 0, 0); d.text("VG BIO · BIOHOF RETTERMAYER", 6, 9); d.text(pt(`Lieferschein ${l.nr}`), 99, 9, { align: "right" });
    d.setFont("helvetica", "normal"); d.setFontSize(11); d.text(d.splitTextToSize(pt(l.kundeName), 93).slice(0, 2), 6, 16); d.setLineWidth(0.4); d.line(6, 24, 99, 24);
    d.setFont("helvetica", "bold"); d.setFontSize(30); d.text(pt(`Palette ${x.nr}/${N}`), 6, 37);
    try { d.addImage(bcPng(x.code), "PNG", 6, 42, 93, 22); } catch (_) {} d.setFont("courier", "normal"); d.setFontSize(9); d.text(x.code, 52.5, 68, { align: "center" });
    const kolli = p.menge && p.paletten ? Math.round((p.menge / p.paletten) * 100) / 100 : null, gew = p.gewicht && p.paletten ? p.gewicht / p.paletten : null;
    const rows = [["Artikel", String(p.text || "").split("\n")[0] || "-"], ["Menge", kolli ? `${kolli.toLocaleString("de-DE")} ${p.einheit}` : "-"], ["Gewicht", gew ? `${kg(gew, 1)} kg` : "-"], ["Charge", p.charge || "-"], ["Lieferdatum", deDate(l.lieferdatum)], ["Bestell-Nr.", l.bestellNr || "-"]];
    let y = 77; rows.forEach(([a, b]) => { d.setFont("helvetica", "normal"); d.setFontSize(8.5); d.setTextColor(90, 90, 90); d.text(a, 6, y); d.setTextColor(0, 0, 0); d.setFont("helvetica", "bold"); d.setFontSize(10.5); d.text(d.splitTextToSize(pt(b), 64)[0], 33, y); y += 9.6; d.setDrawColor(200, 200, 200); d.setLineWidth(0.2); d.line(6, y - 6, 99, y - 6); });
  }
  return d.output("arraybuffer");
}
K.scanHooks.push((c) => {
  const m = c.match(/^LS([A-Z0-9]+?)P(\d{2,3})$/); if (!m) {
    if (LA.ed && view === "la") { const t = K.codeFinden(c); if (t) { const e = LA.ed, i = Math.min(e.aktiv || 0, e.pos.length - 1); e.pos[i].chargeId = t.v.id; persist(); render(); return { html: `<div class="ksc-res ok"><div class="ksc-ch">${esc(t.v.charge)}</div><div>in Lieferschein-Position ${i + 1} übernommen</div></div>`, close: true }; } }
    return null; }
  const l = LA.list.find((x) => String(x.nr).replace(/[^A-Za-z0-9]/g, "").toUpperCase() === m[1]); const n = parseInt(m[2], 10);
  if (!l) return { ok: false, html: `<div class="ksc-res bad"><b>${esc(c)}</b><br>Kein Lieferschein mit dieser Nummer gefunden.</div>` };
  const ps = paletten(l); const x = ps[n - 1]; if (!x) return { ok: false, html: `<div class="ksc-res bad"><b>${esc(c)}</b><br>Palette ${n} gibt es auf Lieferschein ${esc(l.nr)} nicht.</div>` };
  const ver = { ...(l.verladen || {}) }; const neu = !ver[x.code]; if (neu) ver[x.code] = new Date().toISOString(); l.verladen = ver;
  if (neu && db) db.doc("lieferscheine/" + l.id).update({ verladen: ver }).catch(() => toast("Verladen nicht gespeichert (offline?)"));
  const z = ps.filter((q) => ver[q.code]).length;
  return { html: `<div class="ksc-res ok"><div class="ksc-ch">Palette ${n}/${ps.length}</div><div>Lieferschein <b>${esc(l.nr)}</b> · ${esc(l.kundeName)}</div><div>${esc(String(x.p.text || "").split("\n")[0])}${x.p.charge ? " · " + esc(x.p.charge) : ""}</div>
    <div class="ksc-big">${neu ? "✓ verladen" : "war schon verladen"} · ${z}/${ps.length}</div>${z === ps.length ? `<div class="ksc-st" style="color:var(--ok)">Alle Paletten verladen</div>` : ""}
    <div class="ksc-act"><button class="btn" data-la="pdf" data-id="${esc(l.id)}">📄 Lieferschein</button></div></div>` };
});

/* ---------------- Versand ---------------- */
async function versenden(l, i) {
  const em = cfg().empf[i]; if (!em || !em.email) { toast("E-Mail-Adresse in den Stammdaten eintragen"); return; }
  if (!window.confirm(`Lieferschein ${l.nr} an ${em.name} (${em.email}) senden?`)) return;
  LA.sending = i; render();
  try { const buf = pdfLs(l);
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#333"><p>Guten Tag,</p><p>anbei der Lieferschein <b>${esc(l.nr)}</b> für <b>${esc(l.kundeName)}</b>, Lieferdatum ${deDate(l.lieferdatum)}${l.bestellNr ? `, Bestell-Nr. ${esc(l.bestellNr)}` : ""}.</p><p>Nettogewicht: ${kg(l.nettoKg, 1)} kg${l.positionen.reduce((a, p) => a + (p.paletten || 0), 0) ? ` · Paletten: ${l.positionen.reduce((a, p) => a + (p.paletten || 0), 0)}` : ""}</p><p>Viele Grüße<br>${esc(K.meName() || "")}<br>Vermarktungsgesellschaft Bio-Bauern mbH</p></div>`;
    await K.sendMailK([em.email, ...(CFG.verteiler || [])].filter((x, j, a) => a.indexOf(x) === j), `Lieferschein ${l.nr} – ${l.kundeName} – Lieferdatum ${deDate(l.lieferdatum)}`, html, `Lieferschein ${l.nr}, ${l.kundeName}, Lieferdatum ${deDate(l.lieferdatum)}. PDF im Anhang.`, buf, `Lieferschein_${l.nr}.pdf`);
    const v = [...(l.versand || []), { an: em.name, email: em.email, am: new Date().toISOString(), vonName: K.meName() }]; l.versand = v; if (db) await db.doc("lieferscheine/" + l.id).update({ versand: v });
    toast(`An ${em.name} gesendet`);
  } catch (err) { toast("Nicht gesendet: " + K.mailErrText(err)); }
  LA.sending = null; render();
}

/* ---------------- Ansicht ---------------- */
function viewLa() {
  if (LA.ed) return viewEd();
  const b = bestand(), min = cfg().min, w = warnungen().map((x) => x.p);
  const l = LA.list.filter((x) => (LA.filt === "offen" ? x.status !== "abgeschlossen" || !(x.versand || []).length : true));
  const det = LA.open && LA.list.find((x) => x.id === LA.open);
  return `<h1>Lieferscheine</h1><p class="lead">Bestellung einladen, Charge wählen, abschließen – PDF-Vorschau sofort, dann an Spedition oder Kontrollstelle senden. Die Nummer kommt aus büro+.</p>
  <div class="dtiles">${Object.keys(P_NAME).map((p) => `<div class="dtile${w.includes(p) ? " alert" : ""}"><span>Bestand ${esc(P_NAME[p])}</span><b>${kg(b[p] || 0)} kg</b><small>${w.includes(p) ? `unter ${kg(min)} kg` : "Wareneingang minus Lieferscheine"}</small></div>`).join("")}</div>
  <div class="kbig" style="margin-bottom:16px">${K.pick("btn primary kbtn", "📷 Bestellung fotografieren", { kind: "la-neu" }, { capture: true, kp: "la-neu-foto" })}${K.pick("btn kbtn", "📎 Bestellung (Datei) einladen", { kind: "la-neu" }, { accept: K.ACC_ALL, multiple: true, kp: "la-neu-file" })}<button class="btn kbtn" data-la="neu">＋ Ohne Bestellung</button></div>
  <div class="kdz kdrop" data-ladrop="neu" style="margin-bottom:16px"><b>Bestellung hierher ziehen</b> <span class="hint" style="margin:0">PDF, Foto oder Ausdruck</span></div>
  ${det ? viewDetail(det) : ""}
  <div class="kchips" style="margin-bottom:10px"><button class="kchip" data-la="filt" data-v="offen" aria-pressed="${LA.filt === "offen"}">Offen / nicht versendet</button><button class="kchip" data-la="filt" data-v="alle" aria-pressed="${LA.filt === "alle"}">Alle</button></div>
  ${l.length ? `<div class="tw"><table class="t"><thead><tr><th>Nr.</th><th>Kunde</th><th>Lieferdatum</th><th class="n">Netto kg</th><th>Stand</th><th></th></tr></thead><tbody>${l.map((x) => { const ps = paletten(x), z = ps.filter((q) => (x.verladen || {})[q.code]).length;
    return `<tr><td style="font-family:var(--f-mono);font-weight:700">${esc(x.nr || "–")}</td><td>${esc(x.kundeName)}</td><td>${deDate(x.lieferdatum)}</td><td class="n">${kg(x.nettoKg, 1)}</td>
    <td>${x.status === "abgeschlossen" ? `<span class="pill p-ok">abgeschlossen</span>` : `<span class="pill p-warn">Entwurf</span>`}${ps.length ? ` <span class="pill ${z === ps.length ? "p-ok" : "p-info"}">${z}/${ps.length} Pal. verladen</span>` : ""}${(x.versand || []).map((v) => ` <span class="pill p-info">→ ${esc(v.an)}</span>`).join("")}</td>
    <td><span class="chips"><button class="btn small dark" data-la="det" data-id="${esc(x.id)}">Öffnen</button></span></td></tr>`; }).join("")}</tbody></table></div>` : `<div class="empty"><p class="hint">Noch keine Lieferscheine.</p></div>`}`;
}
function viewDetail(l) {
  const ps = paletten(l), z = ps.filter((q) => (l.verladen || {})[q.code]).length, em = cfg().empf;
  return `<section class="card kev"><div class="sechead"><h2>Lieferschein ${esc(l.nr)} · ${esc(l.kundeName)}</h2><button class="btn small" data-la="det-zu">✕</button></div>
    <p>Lieferdatum ${deDate(l.lieferdatum)} · ${l.positionen.length} Position${l.positionen.length > 1 ? "en" : ""} · ${kg(l.nettoKg, 1)} kg${ps.length ? ` · ${z}/${ps.length} Paletten verladen` : ""}${l.status !== "abgeschlossen" ? ` · <b>Entwurf</b>` : ""}</p>
    <div class="kbig"><button class="btn dark kbtn" data-la="pdf" data-id="${esc(l.id)}">📄 PDF ansehen</button>${ps.length ? `<button class="btn kbtn" data-la="pal" data-id="${esc(l.id)}">🏷️ Paletten-Etiketten</button>` : ""}<button class="btn kbtn" data-la="edit" data-id="${esc(l.id)}">✏️ Ändern</button></div>
    ${l.status === "abgeschlossen" ? `<h3 style="margin:14px 0 6px">Versenden</h3><div class="kbig">${em.map((x, i) => `<button class="btn ${x.email ? "primary" : ""} kbtn" data-la="send" data-id="${esc(l.id)}" data-i="${i}" ${x.email && LA.sending == null ? "" : "disabled"}>${LA.sending === i ? "Wird gesendet …" : "✉ " + esc(x.name)}</button>`).join("")}</div>
    ${em.some((x) => !x.email) ? `<p class="hint">Ohne E-Mail-Adresse nicht aktiv – Adressen unter Stammdaten → Lieferscheine eintragen.</p>` : ""}
    ${(l.versand || []).length ? `<p class="hint">Gesendet: ${l.versand.map((v) => `${esc(v.an)} (${new Date(v.am).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}, ${esc(v.vonName || "")})`).join(" · ")}</p>` : ""}` : `<p class="hint">Zum Versenden erst abschließen.</p>`}
  </section>`;
}
function viewStammLa() {
  const c = cfg();
  return `<section class="card"><h2>Lieferscheine</h2>
    <p class="hint">Empfänger der Versand-Knöpfe. Ohne Adresse bleibt der Knopf aus.</p>
    ${c.empf.map((x, i) => `<div class="kgrid"><label class="f">Name<input type="text" id="la-em-n-${i}" value="${esc(x.name)}"></label><label class="f">E-Mail<input type="email" id="la-em-e-${i}" value="${esc(x.email)}"></label></div>`).join("")}
    <div class="kgrid" style="margin-top:10px"><label class="f">Warnung, wenn Bestand unter [kg]<input type="number" id="la-min" value="${esc(c.min)}"></label></div>
    <label class="f">Absenderzeile<input type="text" id="la-abs" value="${esc(c.absender)}"></label>
    <label class="f">Fußzeile (Spalten mit Leerzeile trennen)<textarea id="la-fuss" rows="8">${esc(c.fuss)}</textarea></label>
    <div><button class="btn small dark" data-la="cfg-save">Lieferschein-Einstellungen speichern</button></div></section>`;
}
LA.viewStamm = viewStammLa; LA.pdfLs = pdfLs; LA.palPdf = palPdf;
LA.view = viewLa;

/* ---------------- Ereignisse ---------------- */
async function neuMit(files) { LA.ed = ladeEntwurf() || newEd(); LA.open = null; view = "la"; render(); if (files && files.length) await bestellungDateien(files); }
document.addEventListener("click", async (ev) => {
  const b = ev.target.closest("[data-la]"); if (!b) return; const a = b.dataset.la, e = LA.ed, i = +b.dataset.i;
  switch (a) {
    case "go": view = "la"; render(); window.scrollTo(0, 0); break;
    case "neu": neuMit(); break;
    case "filt": LA.filt = b.dataset.v; render(); break;
    case "det": LA.open = b.dataset.id; render(); window.scrollTo(0, 0); break;
    case "det-zu": LA.open = null; render(); break;
    case "ed-close": persist(); LA.ed = null; render(); break;
    case "ed-verwerfen": if (window.confirm("Lieferschein-Entwurf verwerfen?")) { clearEntwurf(); LA.ed = null; render(); } break;
    case "ed-save": speichern(false); break;
    case "ed-fertig": speichern(true); break;
    case "beleg-del": e.belege.splice(i, 1); persist(); render(); break;
    case "pos-add": e.pos.push(newPos({ einheit: e.pos[e.pos.length - 1]?.einheit || "Kolli" })); e.aktiv = e.pos.length - 1; persist(); render(); break;
    case "pos-vp": e.pos.push(newPos({ einheit: "Stück", text: b.dataset.v })); persist(); render(); break;
    case "pos-del": e.pos.splice(i, 1); e.aktiv = Math.min(e.aktiv || 0, e.pos.length - 1); persist(); render(); break;
    case "pos-akt": if (e && e.aktiv !== i && !ev.target.closest("input,select,textarea,button")) { e.aktiv = i; document.querySelectorAll(".lapos").forEach((x, k) => x.classList.toggle("akt", k === i)); } break;
    case "pdf": { const l = LA.list.find((x) => x.id === b.dataset.id); if (l) showPdf(pdfLs(l), `Lieferschein_${l.nr}.pdf`, `Lieferschein ${l.nr}`); break; }
    case "pal": { const l = LA.list.find((x) => x.id === b.dataset.id); if (l) showPdf(palPdf(l), `Paletten_${l.nr}.pdf`, `Paletten-Etiketten ${l.nr}`); break; }
    case "edit": { const l = LA.list.find((x) => x.id === b.dataset.id); if (!l) break; LA.ed = { ...newEd(), id: l.id, nr: l.nr, datum: l.datum, lieferdatum: l.lieferdatum, kundeName: l.kundeName, kundeAdr: l.kundeAdr, kundeNr: l.kundeNr, bestellNr: l.bestellNr, bem: l.bem || "", belege: (l.belege || []).slice(),
        pos: l.positionen.map((p) => newPos({ menge: p.menge != null ? String(p.menge) : "", einheit: p.einheit, nummer: p.nummer, gewicht: p.gewicht ? String(p.gewicht) : "", text: p.text, chargeId: p.chargeId, paletten: p.paletten ? String(p.paletten) : "" })) }; render(); window.scrollTo(0, 0); break; }
    case "send": { const l = LA.list.find((x) => x.id === b.dataset.id); if (l) versenden(l, i); break; }
    case "cfg-save": { const g = (id) => document.getElementById(id)?.value.trim() || "";
      const patch = { laEmpf: cfg().empf.map((_, k) => ({ name: g("la-em-n-" + k), email: g("la-em-e-" + k) })), bestandMin: num(g("la-min")) || LA_DEF.min, laAbsender: g("la-abs"), laFuss: document.getElementById("la-fuss")?.value || "" };
      if (patch.laEmpf.some((x) => x.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email))) { toast("Bitte gültige E-Mail-Adressen eintragen"); break; }
      try { if (db) await db.doc("config/allgemein").update(patch); Object.assign(CFG, patch); toast("Gespeichert"); render(); } catch (_) { toast("Nicht gespeichert: nur Admins dürfen Stammdaten ändern"); } break; }
  }
});
document.addEventListener("input", (ev) => {
  const t = ev.target, id = t.id || "", e = LA.ed; if (!e || !id.startsWith("l")) return; let m;
  if ((m = id.match(/^la-(nr|kundeName|kundeAdr|kundeNr|bestellNr|bem)$/))) e[m[1]] = t.value;
  else if ((m = id.match(/^lp-(menge|nummer|gewicht|text|paletten)-(\d+)$/))) { const p = e.pos[+m[2]]; const war = istWare(p); p[m[1]] = t.value; e.aktiv = +m[2]; if (m[1] === "gewicht" && war !== istWare(p)) { persist(); render(); setTimeout(() => { const el = document.getElementById(id); if (el) { el.focus(); el.setSelectionRange?.(99, 99); } }, 0); return; } }
  else return;
  persist(); refreshBar();
});
document.addEventListener("change", (ev) => {
  const t = ev.target, id = t.id || "", e = LA.ed;
  if (t.dataset && t.dataset.kpick) { let p = null; try { p = JSON.parse(t.dataset.kpick); } catch (_) {} if (p && (p.kind === "la" || p.kind === "la-neu")) { const files = [...(t.files || [])]; t.value = ""; ev.stopImmediatePropagation(); if (p.kind === "la") bestellungDateien(files); else neuMit(files); } return; }
  if (!e) return; let m;
  if ((m = id.match(/^la-(datum|lieferdatum)$/))) e[m[1]] = t.value;
  else if (id === "la-kundeName") { e.kundeName = t.value; const alt = kundenListe().find((x) => x.kundeName === t.value); if (alt && !e.kundeAdr) { e.kundeAdr = alt.kundeAdr || ""; e.kundeNr = e.kundeNr || alt.kundeNr || ""; render(); } }
  else if ((m = id.match(/^lp-einheit-(\d+)$/))) e.pos[+m[1]].einheit = t.value;
  else if ((m = id.match(/^lp-charge-(\d+)$/))) { e.pos[+m[1]].chargeId = t.value; e.aktiv = +m[1]; render(); }
  else return;
  persist(); refreshBar();
}, true);
document.addEventListener("dragover", (ev) => { const z = ev.target.closest && ev.target.closest("[data-ladrop]"); if (!z) return; ev.preventDefault(); z.classList.add("over"); });
document.addEventListener("dragleave", (ev) => { const z = ev.target.closest && ev.target.closest("[data-ladrop]"); if (z) z.classList.remove("over"); });
document.addEventListener("drop", (ev) => { const z = ev.target.closest && ev.target.closest("[data-ladrop]"); if (!z) return; ev.preventDefault(); z.classList.remove("over"); const f = [...(ev.dataTransfer?.files || [])]; if (!f.length) return; if (z.dataset.ladrop === "neu") neuMit(f); else bestellungDateien(f); });

LA.start = function () {
  if (!db || LA.sub) return; LA.sub = true;
  db.collection("lieferscheine").orderBy("erstellt", "desc").limit(500).onSnapshot((s) => { LA.list = s.docs.map((d) => ({ id: d.id, ...d.data() })); if (view === "la" && !LA.ed) render(); else LA.banner(); });
};
const st = document.createElement("style");
st.textContent = `.lawarn{margin:12px 0 0;padding:10px 14px;border-radius:12px;background:var(--bad-soft);border:2px solid var(--bad);color:var(--bad);display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:16px}.lawarn span{color:var(--muted);font-size:14px}.lawarn .btn{margin-left:auto}
.lapos{border:2px solid var(--line);border-radius:14px;padding:10px 12px;margin:10px 0;cursor:default}.lapos.akt{border-color:var(--field);box-shadow:0 0 0 2px var(--info-soft)}
.lagrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px 12px}.lapos textarea{width:100%}`;
document.head.appendChild(st);
})();
