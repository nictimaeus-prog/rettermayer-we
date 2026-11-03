/* Rettermayer WE – Knoblauch trocken in zwei Stufen
   1. Ersterfassung beim Abladen (kompakt, mehrere Chargen je Lieferschein, grobe Gewichte, sichtbare Mängel)
   2. Verwiegung nach Vorputzen und Bürsten (je Kiste Brutto 2, Etikett A6 mit Barcode)
   Dazu: Sprache DE/RO, Belege per Drag & Drop, Erzeuger-Versand mit Prüfung, Dashboard.
   Wird VOR dem Haupt-Skript geladen und nutzt dessen Helfer erst zur Laufzeit. */
(function () {
"use strict";
const LS_LANG = "rwe-lang", LS_KE = "rwe-knt-ke";
const AVG = [200, 300, 400, 500, 600, 700, 800, 900];
const M1 = ["schalen", "weich", "besch", "trieb", "farbe", "sonst"];
const M2 = M1;
const MDE = { feucht: "Feucht", schalen: "Lose Schalen", weich: "Weiche Zehen", besch: "Beschädigt", trieb: "Austrieb", farbe: "Verfärbung", sonst: "Sonstiges" };
const LV_DE = ["vereinzelt", "0–5 %", "5–10 %", "10–20 %", "20–50 %", "50 %+"];
const LV_RO = ["izolat", "0–5 %", "5–10 %", "10–20 %", "20–50 %", "50 %+"];
const lvT = (i) => (lang() === "ro" ? LV_RO : LV_DE)[i] || "";
const TROCK_K = ["gut", "leicht", "feucht"];
const TROCK_DE = { gut: "gut abgetrocknet", leicht: "leicht feucht", feucht: "feucht" };
const KF = ["zert", "schaed"];
const KF_DE = { zert: "Bio-Zertifikat / Öko-Kontrollnummer auf Lieferschein", schaed: "Ware frei von Schädlingen" };
const mTxt = (m) => (m.k === "sonst" && m.text ? m.text : MDE[m.k] || m.t) + (m.lvl != null ? ` (${LV_DE[m.lvl]})` : "");
const SORTEN_DEFAULT = ["Chesnok", "European White", "Garcua", "Gardos", "Garpek", "Messidor", "Messidrom", "Sabagold", "Spring White", "Therador", "Theradrom"];
const ABW_PCT = 15;
const firmaOhneKurz = () => { const k = String(CFG.kurz || "").trim(); let f = String(CFG.firma || "").trim();
  if (k) f = f.replace(new RegExp("\\s*[·,-]?\\s*(Betrieb\\s+)?" + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*$", "i"), "").trim(); return f; };
const dtDE = (iso) => { if (!iso) return ""; const d = new Date(iso); return isNaN(d) ? deDate(String(iso).slice(0, 10)) : d.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }); };
const HINWEIS_ABR = "Es handelt sich um eine Stichprobe. Die Abrechnung erfolgt nach Packout."; // Abweichung Brutto 2 zu Brutto 1, ab der geprüft werden muss

/* ---------------- Sprache ---------------- */
const TX = {
  de: {
    tab_erf: "Erfassung", tab_vw: "Verwiegung", tab_ueb: "Vorgänge", tab_aw: "Auswertung", tab_sd: "Stammdaten",
    prod_h1: "Was wird angeliefert?", back_prod: "← Produkt wählen",
    erf_h1: "Knoblauch trocken – Ersterfassung",
    erf_lead: "Beim Abladen: grobe Mengen und sichtbare Mängel je Charge. Genau gewogen wird später unter „Verwiegung“.",
    lief: "Lieferung", datum: "Datum Anlieferung", lsnr: "Lieferschein-Nr.", keinls: "Kein Lieferschein", bwe: "büro+ WE-Nr.", opt: "optional",
    belege: "Belege", belege_h: "Lieferschein, Fotos, PDF und andere Dateien", drop: "Dateien hierher ziehen", foto_btn: "Foto aufnehmen", datei_btn: "Datei wählen",
    pruef: "Prüfung Anlieferung", sauber: "Sauberkeit Fahrzeug und Ware", temp: "Temperatur", ok: "in Ordnung", nok: "nicht in Ordnung",
    charge_n: (n) => `Charge ${n}`, erz: "Erzeuger", erz_w: "– Erzeuger wählen –", sorte: "Sorte", sorte_w: "– Sorte wählen –",
    kisten: "Anzahl Holz-Großkisten", kisten_k: "Kisten", gew: "Schätzgewicht", avg: "Ø je Kiste", ges: "Gesamtgewicht", kg_ges: "Gesamt kg",
    brutto1: "Brutto 1 [kg] (geschätzt)", beschr: "Kistenbeschriftung vorhanden und korrekt (BIO + QS)", ja: "Ja", nein: "Nein",
    maengel: "Sichtbare Mängel", maengel_h: "Mangel antippen, Ausmaß wählen, Kamera für ein Foto", keine: "keine Mängel",
    m_feucht: "Feucht", m_schalen: "Lose Schalen", m_weich: "Weiche Zehen", m_besch: "Beschädigt", m_trieb: "Austrieb", m_farbe: "Verfärbung", m_sonst: "Sonstiges",
    sonst_txt: "Welcher Mangel?", bem: "Bemerkung", add_charge: "+ Weitere Charge", del_charge: "Entfernen",
    abtr: "Abtrocknung", tr_gut: "gut abgetrocknet", tr_leicht: "leicht feucht", tr_feucht: "feucht",
    beschr_f: "Kisten nicht oder mangelhaft beschriftet", kontroll: "Kontrollfragen", kf_zert: "Bio-Zertifikat / Öko-Kontrollnummer auf Lieferschein", kf_schaed: "Ware frei von Schädlingen",
    ls_foto: "Lieferschein fotografieren", ls_neu: "Neues Foto", ls_lesen: "Lieferschein wird gelesen …", ls_ok: "Daten vom Lieferschein übernommen – bitte kurz prüfen.",
    ls_nc: "Automatisches Auslesen ist noch nicht eingerichtet – bitte von Hand eintragen.", ls_err: "Lieferschein konnte nicht gelesen werden – bitte von Hand eintragen.", ls_off: "Zum Auslesen braucht das Handy Netz – bitte von Hand eintragen.",
    ls_h: "Zuerst fotografieren: Nummer, Datum, Erzeuger, Sorten und Mengen werden übernommen.", diktat: "Diktieren", diktat_an: "Ich höre zu …", diktat_nein: "Diktieren hier nicht möglich – bitte das Mikrofon der Tastatur nutzen.",
    save: "Speichern", saving: "Speichert …", summary: (n, kg) => `${n} Charge${n > 1 ? "n" : ""} · ≈ ${kg} kg`,
    miss_ls: "Lieferschein-Nr. eintragen oder „Kein Lieferschein“ wählen", miss_erz: (n) => `Charge ${n}: Erzeuger wählen`,
    miss_sorte: (n) => `Charge ${n}: Sorte wählen`, miss_kisten: (n) => `Charge ${n}: Anzahl Kisten eintragen`,
    miss_gew: (n) => `Charge ${n}: Gesamtgewicht eintragen`, miss_beschr: (n) => `Charge ${n}: Kistenbeschriftung prüfen (Ja/Nein)`,
    saved_h: "Gespeichert", saved_lead: "Die Chargen stehen jetzt unter „Verwiegung“.", mail_ok: "Eingangsmeldung intern versendet",
    mail_err: "Interne Mail nicht versendet", mail_retry: "Erneut senden", mail_sending: "Mail wird gesendet …", pdf_view: "Protokoll ansehen",
    neu: "Neue Ersterfassung", to_vw: "Zur Verwiegung", resume: "Angefangene Erfassung fortgesetzt.", verwerfen: "Verwerfen",
    foto: "Foto", foto_del: "Foto entfernen", foto_load: "Foto wird geladen …", datei_del: "Entfernen",
    vw_h1: "Verwiegung", vw_lead: "Nach dem Vorputzen und Bürsten jede Charge kistenweise wiegen. Waage mit der leeren Kiste auf 0 stellen, dann Brutto 2 eintragen und Etikett drucken.",
    f_offen: "Offen", f_verw: "Verwogen", f_alle: "Alle", none: "Keine Chargen in dieser Ansicht.",
    alter: (d) => (d <= 0 ? "heute" : d === 1 ? "gestern" : `vor ${d} Tagen`),
    btn_verw: "Verwiegen", btn_eti: "Etiketten", btn_prot: "Protokoll", btn_erz: "Prüfen & an Erzeuger senden",
    st_offen: "Verwiegung offen", st_verw: "verwogen", st_ges: "an Erzeuger gesendet",
    kiste: "Kiste", kal: "Kaliber", brutto2: "Brutto 2 [kg]", add_kiste: "+ Kiste", eti1: "Etikett", eti_all: "Alle Etiketten (A6)",
    summe: "Summe Brutto 2 [kg]", diff: "Abweichung zu Brutto 1", m2: "Mängel bei der Verwiegung", zwisch: "Zwischenspeichern", abschl: "Verwiegung abschließen",
    max_kiste: "Eine Kiste kann höchstens 1.000 kg haben", zurueck: "← Zurück zur Liste", abgeschl: "Verwiegung abgeschlossen",
    miss_kg: "Mindestens eine Kiste mit Gewicht eintragen", gemeldet: "gemeldet", we: "Wareneingang", gespeichert: "Gespeichert",
    lang_btn: "RO", lang_title: "Limba română",
  },
  ro: {
    tab_erf: "Recepție", tab_vw: "Cântărire", tab_ueb: "Înregistrări", tab_aw: "Analiză", tab_sd: "Date de bază",
    prod_h1: "Ce se livrează?", back_prod: "← Alege produsul",
    erf_h1: "Usturoi uscat – recepție inițială",
    erf_lead: "La descărcare: cantități estimate și defecte vizibile pe fiecare lot. Cântărirea exactă se face mai târziu la „Cântărire”.",
    lief: "Livrare", datum: "Data livrării", lsnr: "Nr. aviz de însoțire", keinls: "Fără aviz", bwe: "Nr. recepție büro+", opt: "opțional",
    belege: "Documente", belege_h: "Aviz, poze, PDF și alte fișiere", drop: "Trage fișierele aici", foto_btn: "Fă o poză", datei_btn: "Alege fișier",
    pruef: "Verificare la livrare", sauber: "Curățenie vehicul și marfă", temp: "Temperatură", ok: "în regulă", nok: "nu e în regulă",
    charge_n: (n) => `Lot ${n}`, erz: "Producător", erz_w: "– alege producătorul –", sorte: "Soi", sorte_w: "– alege soiul –",
    kisten: "Număr lăzi mari din lemn", kisten_k: "lăzi", gew: "Greutate estimată", avg: "Medie pe ladă", ges: "Greutate totală", kg_ges: "Total kg",
    brutto1: "Brutto 1 [kg] (estimat)", beschr: "Etichetarea lăzilor există și e corectă (BIO + QS)", ja: "Da", nein: "Nu",
    maengel: "Defecte vizibile", maengel_h: "atinge defectul, alege gradul, camera pentru poză", keine: "fără defecte",
    m_feucht: "Umed", m_schalen: "Coji desprinse", m_weich: "Căței moi", m_besch: "Deteriorat", m_trieb: "Încolțit", m_farbe: "Decolorare", m_sonst: "Altele",
    sonst_txt: "Ce defect?", bem: "Observație", add_charge: "+ Încă un lot", del_charge: "Șterge",
    abtr: "Uscare", tr_gut: "bine uscat", tr_leicht: "ușor umed", tr_feucht: "umed",
    beschr_f: "Lăzi neetichetate sau etichetate greșit", kontroll: "Întrebări de control", kf_zert: "Certificat bio / nr. control ecologic pe aviz", kf_schaed: "Marfă fără dăunători",
    ls_foto: "Fotografiază avizul", ls_neu: "Poză nouă", ls_lesen: "Se citește avizul …", ls_ok: "Datele de pe aviz au fost preluate – te rog verifică.",
    ls_nc: "Citirea automată nu este încă configurată – completează manual.", ls_err: "Avizul nu a putut fi citit – completează manual.", ls_off: "Pentru citire telefonul are nevoie de internet – completează manual.",
    ls_h: "Mai întâi fă poza: numărul, data, producătorul, soiurile și cantitățile sunt preluate.", diktat: "Dictează", diktat_an: "Ascult …", diktat_nein: "Dictarea nu e posibilă aici – folosește microfonul tastaturii.",
    save: "Salvează", saving: "Se salvează …", summary: (n, kg) => `${n} ${n > 1 ? "loturi" : "lot"} · ≈ ${kg} kg`,
    miss_ls: "Introdu nr. avizului sau alege „Fără aviz”", miss_erz: (n) => `Lot ${n}: alege producătorul`,
    miss_sorte: (n) => `Lot ${n}: alege soiul`, miss_kisten: (n) => `Lot ${n}: introdu numărul de lăzi`,
    miss_gew: (n) => `Lot ${n}: introdu greutatea totală`, miss_beschr: (n) => `Lot ${n}: verifică etichetarea lăzilor (Da/Nu)`,
    saved_h: "Salvat", saved_lead: "Loturile sunt acum la „Cântărire”.", mail_ok: "Notificare internă trimisă",
    mail_err: "E-mailul intern nu a fost trimis", mail_retry: "Retrimite", mail_sending: "Se trimite e-mailul …", pdf_view: "Vezi procesul-verbal",
    neu: "Recepție nouă", to_vw: "La cântărire", resume: "Recepția începută a fost reluată.", verwerfen: "Renunță",
    foto: "Poză", foto_del: "Șterge poza", foto_load: "Se încarcă poza …", datei_del: "Șterge",
    vw_h1: "Cântărire", vw_lead: "După curățare și periere, cântărește fiecare lot pe lăzi. Tarează cântarul cu lada goală, introdu Brutto 2 și tipărește eticheta.",
    f_offen: "Deschise", f_verw: "Cântărite", f_alle: "Toate", none: "Niciun lot în această listă.",
    alter: (d) => (d <= 0 ? "azi" : d === 1 ? "ieri" : `acum ${d} zile`),
    btn_verw: "Cântărește", btn_eti: "Etichete", btn_prot: "Proces-verbal", btn_erz: "Verifică și trimite producătorului",
    st_offen: "cântărire deschisă", st_verw: "cântărit", st_ges: "trimis producătorului",
    kiste: "Ladă", kal: "Calibru", brutto2: "Brutto 2 [kg]", add_kiste: "+ Ladă", eti1: "Etichetă", eti_all: "Toate etichetele (A6)",
    summe: "Total Brutto 2 [kg]", diff: "Diferență față de Brutto 1", m2: "Defecte la cântărire", zwisch: "Salvează intermediar", abschl: "Finalizează cântărirea",
    max_kiste: "O ladă poate avea maxim 1.000 kg", zurueck: "← Înapoi la listă", abgeschl: "Cântărire finalizată",
    miss_kg: "Introdu cel puțin o ladă cu greutate", gemeldet: "declarat", we: "Recepție", gespeichert: "Salvat",
    lang_btn: "DE", lang_title: "Deutsch",
  },
};
function lang() { try { return localStorage.getItem(LS_LANG) === "ro" ? "ro" : "de"; } catch (_) { return "de"; } }
function T(k, ...a) { const d = TX[lang()], v = d[k] !== undefined ? d[k] : TX.de[k]; return typeof v === "function" ? v(...a) : v === undefined ? k : v; }
function setLang(l) { try { localStorage.setItem(LS_LANG, l); } catch (_) {} document.documentElement.lang = l; }
const mName = (k) => T("m_" + k);

/* ---------------- Stil ---------------- */
const css = document.createElement("style");
css.textContent = `
.kbar{position:sticky;bottom:0;z-index:5;background:var(--panel);border-top:2px solid var(--line);margin:18px -16px -24px;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.kbar .msg{flex:1;min-width:180px;font-size:15px;color:var(--muted)} .kbar .msg b{color:var(--ink)}
.kcard{border-left:6px solid var(--c-knt)} .kcard h2{display:flex;gap:10px;align-items:center}
.kgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px 16px}
.kchips{display:flex;flex-wrap:wrap;gap:8px}
.kchip{display:inline-flex;align-items:center;gap:6px;border:2px solid var(--line);background:var(--panel);color:var(--ink);border-radius:999px;padding:9px 14px;font:600 16px var(--f-body);cursor:pointer;min-height:44px}
.kchip[aria-pressed="true"]{background:var(--field);border-color:var(--field);color:var(--field-ink)}
.kchip.bad[aria-pressed="true"]{background:var(--bad);border-color:var(--bad);color:#fff}
.kchip.good[aria-pressed="true"]{background:var(--ok);border-color:var(--ok);color:#fff}
.kmg{display:inline-flex;align-items:stretch;border-radius:999px;overflow:hidden}
.kmg .kchip:not(:last-child){border-radius:999px 0 0 999px}.kmg .kcam{border:2px solid var(--bad);border-left:0;background:var(--bad-soft);color:var(--bad);border-radius:0 999px 999px 0;padding:0 12px;font-size:18px;cursor:pointer;min-width:46px}
.kmg .kcam.has{background:var(--ok-soft);border-color:var(--ok);color:var(--ok)}
.kthumbs{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.kthumbs figure{margin:0;position:relative;width:76px}.kthumbs img{width:76px;height:76px;object-fit:cover;border-radius:8px;border:1px solid var(--line);display:block}
.kthumbs figcaption{font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kthumbs button{position:absolute;top:-6px;right:-6px;width:26px;height:26px;border-radius:50%;border:0;background:var(--bad);color:#fff;font-weight:700;cursor:pointer}
.kdrop{border:2px dashed var(--line);border-radius:12px;padding:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:var(--bg)}
.kdrop.over{border-color:var(--field);background:var(--info-soft)}
.kfiles{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}
.kfiles li{display:flex;gap:8px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:6px 10px;background:var(--panel)}
.kfiles li span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kavg{display:flex;flex-wrap:wrap;gap:6px}.kavg .kchip{padding:8px 12px;min-width:64px;justify-content:center}
.kstep{display:inline-flex;align-items:center;gap:6px}.kstep input{width:90px;text-align:center;font-size:20px;font-weight:700}
.kb1{font:700 22px var(--f-mono);color:var(--ink)}
.klang{border:2px solid rgba(255,255,255,.7);background:transparent;color:#fff;border-radius:10px;padding:6px 12px;font:700 15px var(--f-body);cursor:pointer;margin-left:auto}
.kmlv{border-left:4px solid var(--bad);background:var(--bad-soft);border-radius:0 10px 10px 0;padding:8px 10px;margin-top:8px}
.kmlv>b{display:block;margin-bottom:6px}.kmlv .kchip.lv{padding:6px 11px;min-height:38px;font-size:15px}.kmlv .kchip.lv[aria-pressed="true"]{background:var(--bad);border-color:var(--bad);color:#fff}
.kmlv .kcam{border:2px solid var(--bad);background:var(--panel);color:var(--bad);border-radius:999px;padding:6px 12px;font:700 15px var(--f-body);cursor:pointer;min-height:38px}.kmlv .kcam.has{border-color:var(--ok);color:var(--ok)}
.kls{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.kls img{width:96px;height:96px;object-fit:cover;border-radius:10px;border:1px solid var(--line)}
.kmic{border:2px solid var(--line);background:var(--panel);border-radius:10px;min-width:46px;min-height:46px;font-size:20px;cursor:pointer}.kmic.on{border-color:var(--bad);background:var(--bad-soft)}
.kin{display:flex;gap:8px;align-items:center}.kin input{flex:1;min-width:0}
.kgroup{margin:0 0 18px}.kgroup>h3{font:700 15px var(--f-body);color:var(--muted);margin:0 0 8px;text-transform:uppercase;letter-spacing:.03em}
.krow{display:flex;gap:12px;align-items:center;flex-wrap:wrap;border:1px solid var(--line);background:var(--panel);border-radius:12px;padding:12px;margin-bottom:8px}
.krow .kc{font:700 18px var(--f-mono);min-width:130px}.krow .ki{flex:1;min-width:180px;font-size:15px}.krow .ki small{display:block;color:var(--muted)}
.krows{display:flex;flex-direction:column;gap:8px;margin-bottom:10px}
.kkr{display:flex;flex-wrap:wrap;gap:8px;align-items:center;border:1px solid var(--line);border-radius:12px;padding:8px 10px;background:var(--bg)}
.kkr .nr{font:700 18px var(--f-mono);min-width:34px}
.kkr select{flex:1 1 120px;min-width:0}
.kkr .kw{display:inline-flex;align-items:center;gap:6px;flex:1 1 140px;min-width:0}
.kkr .kw input{flex:1;min-width:0;width:100%;font-size:22px;font-weight:700;text-align:right}
.kkr .u{color:var(--muted);font-weight:600}
.kkr .ka{display:inline-flex;gap:6px;margin-left:auto}
.kkh{display:flex;gap:8px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;padding:0 10px}
.kdiff{font-weight:700}.kdiff.warn{color:var(--warn)}.kdiff.bad{color:var(--bad)}
.kev{border:3px solid var(--field)}
.kev ul{margin:6px 0 10px;padding-left:20px}.kev li{margin:3px 0}
.kev li.blk{color:var(--bad);font-weight:700}.kev li.wrn{color:var(--warn)}
/* Dashboard */
.dfilter{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px}.dfilter label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--muted);font-weight:600}
.dtiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px}
.dtile{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.dtile span{display:block;font-size:13px;color:var(--muted);font-weight:600}.dtile b{display:block;font:700 28px var(--f-display);margin:4px 0 2px;color:var(--ink)}.dtile small{color:var(--muted);font-size:13px}
.dtile.alert{border-color:var(--warn);background:var(--warn-soft)}
.dgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px}
.hbars{display:flex;flex-direction:column;gap:6px}
.hbar{display:grid;grid-template-columns:minmax(90px,34%) 1fr auto;gap:8px;align-items:center;font-size:14px}
.hbar .lbl{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink)}
.hbar .trk{height:16px;background:var(--bg);border-radius:4px;overflow:hidden}.hbar .trk i{display:block;height:100%;background:var(--field);border-radius:0 4px 4px 0;min-width:2px}
.hbar .val{font-variant-numeric:tabular-nums;color:var(--muted);font-weight:600;white-space:nowrap}
.vbars{display:flex;align-items:flex-end;gap:2px;height:160px;border-bottom:1px solid var(--line);padding-top:8px}
.vbars .vb{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;min-width:0;cursor:default}
.vbars .vb i{display:block;width:100%;max-width:34px;background:var(--field);border-radius:4px 4px 0 0;min-height:2px}
.vbars .vb:hover i{background:var(--accent)}
.vlbls{display:flex;gap:2px;font-size:11px;color:var(--muted)}.vlbls span{flex:1;text-align:center;min-width:0;overflow:hidden}
`;
document.head.appendChild(css);

/* ---------------- Zustand ---------------- */
const K = { on: false, ke: null, kd: null, vw: null, vwFilt: "offen", ev: null, thumbs: {}, pend: null, dash: { prod: "alle", zeit: "saison" }, mailBusy: false };
window.K = K;
K.T = T; K.lang = lang; K.firma = () => firmaOhneKurz();
const today = () => isoDate(new Date());
function newCharge(prev) { return { erzId: prev ? prev.erzId : "", sorte: prev ? prev.sorte : "", kisten: "", modus: "avg", avg: 700, gesamt: "", mg: {}, sonst: "", trock: "gut", beschrFehler: false, bem: "" }; }
function newKE() { return { datum: today(), lsNr: "", keinLs: false, bweNr: "", kontrolle: { zert: true, schaed: true }, belege: [], lsFotoId: null, lsMsg: "", lsBusy: false, chargen: [newCharge()], started: Date.now() }; }
function kePersist() { if (!K.ke) return; clearTimeout(kePersist.t); kePersist.t = setTimeout(() => { try { localStorage.setItem(LS_KE, JSON.stringify(K.ke)); } catch (_) {} }, 250); }
function keLoad() { try { const s = localStorage.getItem(LS_KE); if (s) { const o = JSON.parse(s); if (o && Array.isArray(o.chargen)) return o; } } catch (_) {} return null; }
function keClear() { try { localStorage.removeItem(LS_KE); } catch (_) {} }
const sorten = () => (Array.isArray(CFG.sorten) && CFG.sorten.length ? CFG.sorten : SORTEN_DEFAULT);
K.sorten = sorten;
const erzById = (id) => ERZ.find((e) => e.id === id);
const fmtKg = (n, d = 0) => (n == null || isNaN(n) ? "–" : Number(n).toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d }));
function brutto1(c) { const k = parseInt(c.kisten, 10) || 0; if (c.modus === "ges") return num(c.gesamt); return k ? k * (c.avg || 700) : null; }
const ageDays = (iso) => Math.floor((new Date(today() + "T12:00:00") - new Date(iso + "T12:00:00")) / 864e5);
const canSend = () => !!(window.RWE && RWE.canErzVersand && RWE.canErzVersand());
const meName = () => (typeof NAMES !== "undefined" && NAMES[ME]) || (window.RWE && RWE.profile()?.name) || "";
const kuerzel = (n) => String(n || "").split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).join("").slice(0, 3);

/* ---------------- Dateien und Fotos ---------------- */
function thumb(id) {
  if (!id) return "";
  if (K.thumbs[id]) return K.thumbs[id];
  K.thumbs[id] = "";
  fetch("/_blob/" + id).then((r) => (r.ok ? r.blob() : null)).then((b) => { if (b) { K.thumbs[id] = URL.createObjectURL(b); render(); } }).catch(() => {});
  return "";
}
async function uploadFile(file, isImg) {
  if (!assets) { toast("Dateiablage nicht verfügbar"); return null; }
  let blob = file, name = file.name || "datei", type = file.type || "application/octet-stream";
  if (isImg) { const url = await readImg(file, 1400, 0.74); blob = dataUrlToBlob(url); type = "image/jpeg"; name = name.replace(/\.(heic|heif|png|webp)$/i, ".jpg"); K.thumbs.__last = url; }
  const a = await assets.upload(blob);
  if (isImg) K.thumbs[a.id] = K.thumbs.__last;
  return { id: a.id, name, type, size: blob.size };
}
const isImgFile = (f) => /^image\//.test(f.type || "") || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name || "");
async function addBelege(files, target) {
  let fehl = 0;
  for (const f of files) {
    if (f.size > 15 * 1024 * 1024) { toast(`${f.name}: größer als 15 MB`); fehl++; continue; }
    try { const r = await uploadFile(f, isImgFile(f)); if (r) target.push(r); } catch (e) { console.error("Beleg", e); fehl++; }
  }
  if (fehl) toast(`${fehl} Datei${fehl > 1 ? "en" : ""} nicht übernommen`);
  kePersist(); render();
}
async function openFile(b) {
  if (/pdf/i.test(b.type)) { openBlob(b.id, b.name, b.name); return; }
  try { const r = await fetch("/_blob/" + b.id); if (!r.ok) throw 0; const blob = await r.blob();
    if (/^image\//.test(b.type)) { const w = window.open(URL.createObjectURL(blob), "_blank"); if (!w) save(b.name, await blob.arrayBuffer(), b.name); }
    else save(b.name, await blob.arrayBuffer(), b.name);
  } catch (_) { toast("Datei nicht verfügbar (offline?)"); }
}
function belegeBlock(list, ctx) {
  return `<div class="kdrop" data-kdrop="${ctx}"><b>${T("drop")}</b><span class="hint" style="margin:0">·</span>
    <button class="btn small dark" data-ka="pick-foto" data-ctx="${ctx}">📷 ${T("foto_btn")}</button>
    <button class="btn small" data-ka="pick-file" data-ctx="${ctx}">📄 ${T("datei_btn")}</button></div>
  ${list.length ? `<ul class="kfiles">${list.map((b, i) => `<li>${/^image\//.test(b.type) && thumb(b.id) ? `<img src="${thumb(b.id)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:6px">` : `<span style="flex:none;font-size:22px">${/pdf/i.test(b.type) ? "📕" : /^image\//.test(b.type) ? "🖼" : "📄"}</span>`}
    <span>${esc(b.name)}</span><button class="btn small" data-ka="file-open" data-ctx="${ctx}" data-i="${i}">↗</button><button class="btn small" data-ka="file-del" data-ctx="${ctx}" data-i="${i}" aria-label="${T("datei_del")}">✕</button></li>`).join("")}</ul>` : ""}`;
}
function mangelChips(mg, keys, ctx, ci) {
  const on = keys.filter((k) => mg[k]);
  return `<div class="kchips">${keys.map((k) => `<button class="kchip bad" aria-pressed="${!!mg[k]}" data-ka="mg" data-ctx="${ctx}" data-ci="${ci}" data-k="${k}">${esc(mName(k))}</button>`).join("")}</div>
  ${on.map((k) => { const m = mg[k], f = m.foto;
    return `<div class="kmlv"><b>${esc(mName(k))}</b><div class="kchips">${LV_DE.map((_, i) => `<button class="kchip lv" aria-pressed="${(m.lvl ?? 0) === i}" data-ka="mg-lvl" data-ctx="${ctx}" data-ci="${ci}" data-k="${k}" data-v="${i}">${esc(lvT(i))}</button>`).join("")}
      <button class="kcam${f ? " has" : ""}" data-ka="mg-foto" data-ctx="${ctx}" data-ci="${ci}" data-k="${k}" aria-label="${T("foto")} ${esc(mName(k))}">${f ? "✓ " + T("foto") : "📷 " + T("foto")}</button></div>
      ${f ? `<div class="kthumbs"><figure>${thumb(f) ? `<img src="${thumb(f)}" alt="${esc(mName(k))}">` : `<div style="width:76px;height:76px;border-radius:8px;background:var(--bg)"></div>`}<button data-ka="mg-foto-del" data-ctx="${ctx}" data-ci="${ci}" data-k="${k}" aria-label="${T("foto_del")}">×</button></figure></div>` : ""}</div>`; }).join("")}`;
}
function mangelChipsAlt(mg, keys, ctx, ci) {
  return `<div class="kchips">${keys.map((k) => { const on = !!mg[k]; const f = on && mg[k].foto;
    return `<span class="kmg"><button class="kchip bad" aria-pressed="${on}" data-ka="mg" data-ctx="${ctx}" data-ci="${ci}" data-k="${k}">${esc(mName(k))}</button>${on ? `<button class="kcam${f ? " has" : ""}" data-ka="mg-foto" data-ctx="${ctx}" data-ci="${ci}" data-k="${k}" aria-label="${T("foto")} ${esc(mName(k))}">${f ? "✓" : "📷"}</button>` : ""}</span>`; }).join("")}</div>
  ${keys.some((k) => mg[k]?.foto) ? `<div class="kthumbs">${keys.filter((k) => mg[k]?.foto).map((k) => `<figure>${thumb(mg[k].foto) ? `<img src="${thumb(mg[k].foto)}" alt="${esc(mName(k))}">` : `<div style="width:76px;height:76px;border-radius:8px;background:var(--bg)"></div>`}<figcaption>${esc(mName(k))}</figcaption><button data-ka="mg-foto-del" data-ctx="${ctx}" data-ci="${ci}" data-k="${k}" aria-label="${T("foto_del")}">×</button></figure>`).join("")}</div>` : ""}`;
}

/* ---------------- Stufe 1: Ersterfassung ---------------- */
K.start = function () { K.on = true; K.kd = null; const s = keLoad();
  if (s && s.chargen.length) { K.ke = { ...newKE(), ...s, lsBusy: false, saving: false, kontrolle: { zert: true, schaed: true, ...(s.kontrolle || {}) }, chargen: s.chargen.map((c) => ({ ...newCharge(), ...c })) }; setTimeout(() => toast(T("resume")), 50); }
  else K.ke = newKE(); };
K.stop = function () { K.on = false; };
function keMissing() {
  const e = K.ke, out = [];
  if (!e.keinLs && !e.lsNr.trim()) out.push(T("miss_ls"));
  e.chargen.forEach((c, i) => { const n = i + 1;
    if (!c.erzId) out.push(T("miss_erz", n)); if (!c.sorte) out.push(T("miss_sorte", n));
    if (!(parseInt(c.kisten, 10) > 0)) out.push(T("miss_kisten", n)); else if (c.modus === "ges" && !(num(c.gesamt) > 0)) out.push(T("miss_gew", n));
  });
  return out;
}
function keSummary() { const e = K.ke; const kg = e.chargen.reduce((a, c) => a + (brutto1(c) || 0), 0); return T("summary", e.chargen.length, fmtKg(kg)); }
K.viewErf = function () {
  if (K.kd) return viewErfDone();
  const e = K.ke; const miss = keMissing();
  const erzOpts = [...ERZ].sort((a, b) => a.name.localeCompare(b.name, "de"));
  const mic = (id) => `<button class="kmic${K.dict === id ? " on" : ""}" data-ka="dict" data-for="${id}" aria-label="${T("diktat")}" title="${T("diktat")}">🎤</button>`;
  const lsImg = e.lsFotoId ? thumb(e.lsFotoId) : "";
  return `<div class="chips" style="margin-bottom:6px"><button class="btn small" data-ka="back-prod">${T("back_prod")}</button></div>
  <h1>${T("erf_h1")}</h1><p class="lead">${T("erf_lead")}</p>
  <section class="card"><h2>${T("lief")}</h2>
    <div class="kls">${lsImg ? `<img src="${lsImg}" alt="">` : ""}
      <button class="btn ${e.lsFotoId ? "" : "primary"}" data-ka="ls-foto" ${e.lsBusy ? "disabled" : ""}>📷 ${e.lsFotoId ? T("ls_neu") : T("ls_foto")}</button>
      <span class="hint" style="flex:1;min-width:180px;margin:0;${/nicht|nu a|nu e/.test(e.lsMsg || "") ? "color:var(--warn)" : ""}">${esc(e.lsBusy ? T("ls_lesen") : e.lsMsg || T("ls_h"))}</span></div>
    <div class="kgrid">
      <label class="f">${T("lsnr")}<input type="text" id="k-lsnr" value="${esc(e.lsNr)}" ${e.keinLs ? "disabled" : ""} autocomplete="off"></label>
      <label class="f">${T("datum")}<input type="date" id="k-datum" value="${esc(e.datum)}"></label>
      <label class="f">${T("bwe")}<span class="h">${T("opt")}</span><input type="text" id="k-bwe" value="${esc(e.bweNr)}" inputmode="numeric" autocomplete="off"></label>
    </div>
    <div class="kchips"><button class="kchip" data-ka="ke-keinls" aria-pressed="${e.keinLs}">${T("keinls")}</button></div>
    <details ${e.belege.length > 1 ? "open" : ""}><summary><b>${T("belege")}</b> <span class="hint">${T("belege_h")} (${e.belege.length})</span></summary>${belegeBlock(e.belege, "ke")}</details>
  </section>
  <section class="card"><h2>${T("kontroll")}</h2>${KF.map((k) => `<div style="display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap"><span>${T("kf_" + k)}</span><span class="kchips"><button class="kchip good" data-ka="kf" data-k="${k}" data-v="1" aria-pressed="${e.kontrolle[k] !== false}">${T("ja")}</button><button class="kchip bad" data-ka="kf" data-k="${k}" data-v="0" aria-pressed="${e.kontrolle[k] === false}">${T("nein")}</button></span></div>`).join("")}</section>
  ${e.chargen.map((c, i) => { const b1 = brutto1(c);
    return `<section class="card kcard"><div class="sechead"><h2>${T("charge_n", i + 1)}</h2>${e.chargen.length > 1 ? `<button class="btn small" data-ka="ch-del" data-ci="${i}">${T("del_charge")}</button>` : ""}</div>
    <div class="kgrid">
      <label class="f">${T("erz")}<select id="k-erz-${i}"><option value="">${T("erz_w")}</option>${erzOpts.map((x) => `<option value="${esc(x.id)}" ${c.erzId === x.id ? "selected" : ""}>${esc(x.name)} · ${esc(x.code)}</option>`).join("")}</select></label>
      <label class="f">${T("sorte")}<select id="k-sorte-${i}"><option value="">${T("sorte_w")}</option>${sorten().map((s) => `<option ${c.sorte === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></label>
      <label class="f">${T("kisten")}<span class="kstep"><button class="btn small" data-ka="ki-minus" data-ci="${i}" aria-label="−">−</button><input type="number" inputmode="numeric" min="1" id="k-kisten-${i}" value="${esc(c.kisten)}"><button class="btn small" data-ka="ki-plus" data-ci="${i}" aria-label="+">+</button></span></label>
    </div>
    <div><b>${T("gew")}</b>
      <div class="kchips" style="margin:6px 0"><button class="kchip" data-ka="ch-modus" data-ci="${i}" data-v="avg" aria-pressed="${c.modus !== "ges"}">${T("avg")}</button><button class="kchip" data-ka="ch-modus" data-ci="${i}" data-v="ges" aria-pressed="${c.modus === "ges"}">${T("ges")}</button></div>
      ${c.modus === "ges" ? `<label class="f" style="max-width:240px">${T("kg_ges")}<input type="number" inputmode="decimal" id="k-ges-${i}" value="${esc(c.gesamt)}"></label>`
        : `<div class="kavg">${AVG.map((v) => `<button class="kchip" data-ka="ch-avg" data-ci="${i}" data-v="${v}" aria-pressed="${(c.avg || 700) === v}">${v} kg</button>`).join("")}</div>`}
      <p style="margin:8px 0 0">${T("brutto1")}: <span class="kb1" id="k-b1-${i}">${b1 ? "≈ " + fmtKg(b1) : "–"}</span></p>
    </div>
    <div><b>${T("abtr")}</b><div class="kchips" style="margin-top:6px">${TROCK_K.map((k) => `<button class="kchip ${k === "gut" ? "good" : "bad"}" data-ka="ch-trock" data-ci="${i}" data-v="${k}" aria-pressed="${(c.trock || "gut") === k}">${T("tr_" + k)}</button>`).join("")}</div></div>
    <div><b>${T("maengel")}</b> <span class="hint">${T("maengel_h")}</span>${mangelChips(c.mg, M1, "ke", i)}
      ${c.mg.sonst ? `<label class="f" style="margin-top:8px">${T("sonst_txt")}<span class="kin"><input type="text" id="k-sonst-${i}" value="${esc(c.sonst)}">${mic("k-sonst-" + i)}</span></label>` : ""}</div>
    <div class="kchips"><button class="kchip bad" data-ka="ch-beschrf" data-ci="${i}" aria-pressed="${!!c.beschrFehler}">⚠ ${T("beschr_f")}</button></div>
    <label class="f">${T("bem")} <span class="h">${T("opt")}</span><span class="kin"><input type="text" id="k-bem-${i}" value="${esc(c.bem)}">${mic("k-bem-" + i)}</span></label>
    </section>`; }).join("")}
  <div class="chips"><button class="btn dark" data-ka="ch-add">${T("add_charge")}</button><button class="btn small" data-ka="ke-reset">${T("verwerfen")}</button></div>
  <div class="kbar"><div class="msg" id="k-msg"><b id="k-sum">${keSummary()}</b><br>${miss.length ? esc(miss[0]) : ""}</div>
    <button class="btn primary" data-ka="ke-save" ${miss.length || K.ke.saving ? "disabled" : ""}>${K.ke.saving ? T("saving") : T("save")}</button></div>`;
};
function keRefreshBar() {
  const miss = keMissing(); const m = $("#k-msg"); if (m) m.innerHTML = `<b id="k-sum">${keSummary()}</b><br>${miss.length ? esc(miss[0]) : ""}`;
  const b = document.querySelector('[data-ka="ke-save"]'); if (b) b.disabled = !!miss.length || K.ke.saving;
  K.ke.chargen.forEach((c, i) => { const el = $("#k-b1-" + i); if (el) { const b1 = brutto1(c); el.textContent = b1 ? "≈ " + fmtKg(b1) : "–"; } });
}
async function nextCharge(erz, datum) {
  const p = prod("KNT"), sj = saisonJahr(p, datum), key = `${erz.code}_KNT_${sj}`; let n;
  if (db) { const ref = db.doc("zaehler/" + key); const snap = await ref.get(); n = Math.max((snap.exists && snap.data().n) || 0, CNT[key] || 0) + 1; await ref.set({ n, code: erz.code, produkt: "KNT", saison: sj }); }
  else n = (CNT[key] || 0) + 1;
  CNT[key] = n; return { charge: `${erz.code} ${String(n).padStart(2, "0")} KNT`, sj };
}
const bcOf = (charge) => ascii(charge).replace(/[^A-Z0-9]/g, "");
function abw1(r) {
  const a = [];
  if (r.sauber === false) a.push("Sauberkeit nicht in Ordnung"); if (r.temperatur && r.temperatur !== "ok") a.push("Temperatur nicht in Ordnung");
  Object.entries(r.kontrolle || {}).forEach(([k, v]) => { if (v === false) a.push("Kontrollfrage mit Nein: " + (KF_DE[k] || k)); });
  if (r.abtrocknung && r.abtrocknung !== "gut") a.push("Abtrocknung: " + TROCK_DE[r.abtrocknung]);
  if (r.beschriftung === false) a.push("Kisten nicht oder mangelhaft beschriftet (BIO/QS)");
  (r.maengel1 || []).forEach((m) => a.push("Mangel Anlieferung: " + mTxt(m)));
  if (r.keinLieferschein) a.push("Kein Lieferschein");
  return a;
}
async function keSave() {
  const e = K.ke; if (keMissing().length || e.saving) return;
  e.saving = true; render();
  const p = prod("KNT"), auftragId = "A" + Date.now().toString(36), created = [];
  try {
    for (const c of e.chargen) {
      const erz = erzById(c.erzId); const { charge, sj } = await nextCharge(erz, e.datum);
      const mg = M1.filter((k) => c.mg[k]).map((k) => ({ k, t: MDE[k], lvl: c.mg[k].lvl ?? 0, text: k === "sonst" ? c.sonst : "", foto: c.mg[k].foto || null }));
      const rec = { charge, barcode: bcOf(charge), produkt: "KNT", produktName: p.name, artNr: p.artNr || "", saison: saisonLabel(p, sj),
        erzeugerId: erz.id, erzeuger: erz.name, code: erz.code, bueroNr: erz.buero || "", oeko: erz.oeko || "", qs: erz.qs || "", auslobung: (erz.verbaende || []).join(", ") || "kein Verband", verband: erz.verbaende || [],
        datum: e.datum, stufe: "erfasst", auftragId, lieferscheinNr: e.keinLs ? "" : e.lsNr.trim(), keinLieferschein: !!e.keinLs, bueroWeNr: e.bweNr.trim(), belege: e.belege.slice(),
        kontrolle: { ...e.kontrolle }, abtrocknung: c.trock || "gut", lsFoto: e.lsFotoId || null, sorte: c.sorte, gebinde: "Holz-Großkiste", kisten: parseInt(c.kisten, 10),
        brutto1: brutto1(c), brutto1Art: c.modus === "ges" ? "gesamt" : "schnitt", avgKg: c.modus === "ges" ? null : c.avg || 700,
        maengel1: mg, beschriftung: !c.beschrFehler, bemerkung: c.bem.trim(), mengeKg: null, kistenListe: [], sortierung: "unsortiert",
        status: "offen", erfasstVon: ME, erfasstVonName: meName(), erstellt: new Date().toISOString() };
      rec.abweichungen = abw1(rec);
      if (db) { const ref = await db.collection("wareneingaenge").add(rec); rec.id = ref.id; } else { rec.id = "l" + Date.now() + created.length; VORG.unshift(rec); }
      created.push(rec);
    }
  } catch (err) { e.saving = false; console.error(err); toast("Speichern fehlgeschlagen: " + (err?.code === "permission_denied" ? "keine Schreibrechte" : "bitte erneut versuchen")); render(); return; }
  keClear(); K.kd = { recs: created, mail: "idle", msg: "" }; K.ke = newKE(); render(); window.scrollTo(0, 0); setTimeout(confetti, 80);
  mailErst();
}
async function mailErst() {
  const kd = K.kd; if (!kd) return; const to = [...(CFG.verteiler || [])]; if (!to.length) { kd.mail = "error"; kd.msg = "Kein Verteiler hinterlegt"; render(); return; }
  kd.mail = "sending"; render();
  try {
    const r0 = kd.recs[0]; const pdf = await pdfKnt(kd.recs, "erst");
    const subj = `Wareneingang Knoblauch trocken – Ersterfassung – ${kd.recs.map((r) => r.charge).join(", ")} – ${deDate(r0.datum)}`;
    await sendMailK(to, subj, mailHtmlK(kd.recs, "erst"), `Ersterfassung ${kd.recs.length} Charge(n), Lieferschein ${r0.lieferscheinNr || "–"}. Protokoll im Anhang.`, pdf, `WE_Ersterfassung_${r0.lieferscheinNr || r0.auftragId}_${r0.datum}.pdf`);
    kd.mail = "sent"; kd.msg = to.join(", ");
    if (db) for (const r of kd.recs) { try { await db.doc("wareneingaenge/" + r.id).update({ meldungIntern1: new Date().toISOString() }); } catch (_) {} }
  } catch (err) { kd.mail = "error"; kd.msg = mailErrText(err); }
  render();
}
function viewErfDone() {
  const kd = K.kd;
  return `<div class="win anim"><span class="chk">✓</span><span style="flex:1;min-width:0"><b>${T("saved_h")}</b><span class="hint">${T("saved_lead")}</span></span></div>
  <h1>${kd.recs.map((r) => `<span style="font-family:var(--f-mono)">${esc(r.charge)}</span>`).join(" · ")}</h1>
  <section class="card"><div class="tw"><table class="t"><thead><tr><th>Charge</th><th>${T("erz")}</th><th>${T("sorte")}</th><th class="n">${T("kisten")}</th><th class="n">${T("brutto1")}</th></tr></thead><tbody>
    ${kd.recs.map((r) => `<tr><td style="font-family:var(--f-mono);font-weight:700">${esc(r.charge)}</td><td>${esc(r.erzeuger)}</td><td>${esc(r.sorte)}</td><td class="n">${r.kisten}</td><td class="n">≈ ${fmtKg(r.brutto1)}</td></tr>`).join("")}</tbody></table></div>
    <p class="hint" style="color:${kd.mail === "error" ? "var(--bad)" : kd.mail === "sent" ? "var(--ok)" : "var(--muted)"}">${kd.mail === "sending" ? T("mail_sending") : kd.mail === "sent" ? T("mail_ok") + ": " + esc(kd.msg) : kd.mail === "error" ? T("mail_err") + ": " + esc(kd.msg) : ""}</p>
    <div class="chips">${kd.mail === "error" ? `<button class="btn" data-ka="erst-mail">${T("mail_retry")}</button>` : ""}<button class="btn dark" data-ka="erst-pdf">${T("pdf_view")}</button><button class="btn" data-ka="go-vw">${T("to_vw")}</button><button class="btn primary" data-ka="ke-new">${T("neu")}</button></div></section>`;
}

/* ---------------- Lieferschein: Foto zuerst, Daten übernehmen ---------------- */
const normS = (x) => ascii(String(x || "")).replace(/[^A-Z0-9]/g, "");
async function lsFoto(file) {
  const e = K.ke; let r;
  try { r = await uploadFile(file, true); } catch (err) { toast("Foto konnte nicht gelesen werden"); return; }
  if (!r) return; r.name = "Lieferschein.jpg"; e.lsFotoId = r.id; e.belege = [r, ...e.belege.filter((b) => b.id !== r.id)]; kePersist();
  if (!sample) { e.lsMsg = T("ls_nc"); render(); return; }
  e.lsBusy = true; e.lsMsg = ""; render();
  const prompt = `Du liest das Foto eines Lieferscheins für Bio-Knoblauch (trocken) eines landwirtschaftlichen Erzeugers in Deutschland. Antworte NUR mit JSON in genau dieser Form:
{"lieferscheinNr":"oder null","datum":"JJJJ-MM-TT oder null","erzeuger":"Name des Erzeugers/Absenders oder null","oekoKontrollstelle":"DE-ÖKO-0xx oder null","verbaende":["Bioland"|"Naturland"],"positionen":[{"sorte":"oder null","kisten":Zahl oder null,"mengeKg":Zahl oder null}]}
Je Sorte bzw. Partie eine Position. Bekannte Sorten: ${sorten().join(", ")}. Nur was auf dem Lieferschein steht, nichts erfinden.`;
  try {
    const blob = await (await fetch("/_blob/" + r.id)).blob();
    const j = await sample.json(prompt, { images: [blob], modelTier: "default" });
    if (j?.lieferscheinNr && !e.lsNr) { e.lsNr = String(j.lieferscheinNr); e.keinLs = false; }
    if (j?.datum && /^\d{4}-\d{2}-\d{2}$/.test(j.datum)) e.datum = j.datum;
    const en = normS(j?.erzeuger); const erz = en ? ERZ.find((x) => { const n = normS(x.name); return n && (en.includes(n) || n.includes(en)); }) : null;
    const sortOf = (x) => { const n = normS(x); return n ? sorten().find((s) => { const m = normS(s); return m === n || n.includes(m) || m.includes(n); }) || "" : ""; };
    const pos = Array.isArray(j?.positionen) ? j.positionen.filter((p) => p && (p.sorte || p.kisten || p.mengeKg)) : [];
    const leer = e.chargen.every((c) => !c.erzId && !c.sorte && !c.kisten);
    if (pos.length && leer) e.chargen = pos.map((p) => ({ ...newCharge(), erzId: erz?.id || "", sorte: sortOf(p.sorte), kisten: p.kisten ? String(Math.round(p.kisten)) : "", modus: p.mengeKg ? "ges" : "avg", gesamt: p.mengeKg ? String(p.mengeKg) : "" }));
    else if (erz) e.chargen.forEach((c) => { if (!c.erzId) c.erzId = erz.id; });
    e.lsMsg = T("ls_ok");
  } catch (err) { e.lsMsg = err?.code === "not_configured" ? T("ls_nc") : err?.code === "offline" ? T("ls_off") : T("ls_err"); }
  e.lsBusy = false; kePersist(); render();
}
let REC = null;
function diktat(id) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast(T("diktat_nein")); return; }
  if (REC) { try { REC.stop(); } catch (_) {} REC = null; K.dict = null; render(); return; }
  const rec = new SR(); rec.lang = lang() === "ro" ? "ro-RO" : "de-DE"; rec.interimResults = false; rec.maxAlternatives = 1;
  rec.onresult = (ev) => { const txt = [...ev.results].map((x) => x[0].transcript).join(" ").trim(); const el = document.getElementById(id);
    if (el && txt) { el.value = (el.value ? el.value.trim() + " " : "") + txt; el.dispatchEvent(new Event("input", { bubbles: true })); } };
  rec.onerror = (ev) => { if (ev.error === "not-allowed" || ev.error === "service-not-allowed") toast(T("diktat_nein")); };
  rec.onend = () => { REC = null; K.dict = null; render(); };
  try { rec.start(); REC = rec; K.dict = id; toast(T("diktat_an")); render(); } catch (_) { toast(T("diktat_nein")); }
}

/* ---------------- Stufe 2: Verwiegung ---------------- */
const kntRecs = () => VORG.filter((v) => v.produkt === "KNT" && v.stufe);
K.viewVw = function () {
  const evPanel = K.ev ? viewEv() : "";
  if (K.vw) return evPanel + viewVwEdit();
  const f = K.vwFilt; const all = kntRecs();
  const list = all.filter((v) => (f === "offen" ? v.stufe === "erfasst" : f === "verw" ? v.stufe === "verwogen" : true));
  const groups = {}; list.forEach((v) => { const k = v.auftragId || v.id; (groups[k] = groups[k] || []).push(v); });
  const keys = Object.keys(groups).sort((a, b) => (groups[a][0].datum < groups[b][0].datum ? -1 : 1) * (f === "offen" ? 1 : -1));
  const nOff = all.filter((v) => v.stufe === "erfasst").length;
  return evPanel + `<h1>${T("vw_h1")}</h1><p class="lead">${T("vw_lead")}</p>
  <div class="kchips" style="margin-bottom:14px">${[["offen", T("f_offen") + ` (${nOff})`], ["verw", T("f_verw")], ["alle", T("f_alle")]].map(([k, t]) => `<button class="kchip" data-ka="vw-filt" data-v="${k}" aria-pressed="${f === k}">${t}</button>`).join("")}</div>
  ${keys.length ? keys.map((k) => { const g = groups[k], r0 = g[0];
    return `<div class="kgroup"><h3>${T("we")} ${deDate(r0.datum)} · ${r0.keinLieferschein ? T("keinls") : esc(T("lsnr")) + " " + esc(r0.lieferscheinNr || "–")} · ${T("alter", ageDays(r0.datum))}</h3>
    ${g.map((v) => { const st = v.erzVersand ? ["p-ok", T("st_ges")] : v.stufe === "verwogen" ? ["p-info", T("st_verw")] : [ageDays(v.datum) > 7 ? "p-bad" : "p-warn", T("st_offen")];
      return `<div class="krow"><span class="kc">${esc(v.charge)}</span><span class="ki"><b>${esc(v.erzeuger)}</b> · ${esc(v.sorte || "")}<small>${v.kisten || "–"} ${T("kisten_k")} · ${T("brutto1")} ≈ ${fmtKg(v.brutto1)}${v.brutto2 != null ? ` · <b>${T("brutto2")} ${fmtKg(v.brutto2, 1)}</b>` : ""}${(v.maengel1 || []).length ? ` · ${v.maengel1.map((m) => esc(mName(m.k)) + (m.lvl != null ? " " + esc(lvT(m.lvl)) : "")).join(", ")}` : ""}</small></span>
        <span class="pill ${st[0]}">${st[1]}</span>
        <span class="chips">${v.stufe === "erfasst" ? `<button class="btn primary small" data-ka="vw-open" data-id="${esc(v.id)}">${T("btn_verw")}</button>` : `<button class="btn small" data-ka="vw-open" data-id="${esc(v.id)}">${T("btn_verw")}</button><button class="btn small" data-ka="eti-all" data-id="${esc(v.id)}">${T("btn_eti")}</button><button class="btn small dark" data-ka="prot" data-id="${esc(v.id)}">${T("btn_prot")}</button>${canSend() && !v.erzVersand ? `<button class="btn small primary" data-ka="ev-open" data-id="${esc(v.id)}">${T("btn_erz")}</button>` : ""}`}</span></div>`; }).join("")}</div>`; }).join("")
    : `<div class="empty"><p class="hint">${T("none")}</p></div>`}`;
};
function vwOpen(id) {
  const v = VORG.find((x) => x.id === id); if (!v) return;
  const vw = v.verwiegung || {};
  const kl = (v.kistenListe || []).map((x) => ({ kal: x.kal || "", kg: x.kg != null ? String(x.kg).replace(".", ",") : "" }));
  const mg = {}; (vw.maengel || []).forEach((m) => (mg[m.k] = { lvl: m.lvl ?? 0, foto: m.foto || null }));
  K.vw = { id, kl: kl.length ? kl : [{ kal: "", kg: "" }], mg, sonst: (vw.maengel || []).find((m) => m.k === "sonst")?.text || "", bem: vw.bem || "", belege: (vw.belege || []).slice(), busy: false, mail: "", msg: "" };
  render(); window.scrollTo(0, 0);
}
const vwRec = () => VORG.find((x) => x.id === K.vw?.id);
const klValid = (kl) => kl.filter((x) => num(x.kg) > 0).map((x) => ({ kal: x.kal || "", kg: num(x.kg) }));
function diffInfo(b1, b2) { if (!b1 || !b2) return null; const d = b2 - b1, pct = (d / b1) * 100; return { d, pct, cls: Math.abs(pct) > ABW_PCT ? "bad" : Math.abs(pct) > ABW_PCT / 2 ? "warn" : "" }; }
function viewVwEdit() {
  const w = K.vw, v = vwRec(); if (!v) { K.vw = null; return K.viewVw(); }
  const kal = prod("KNT")?.kalibrierung || [];
  const b2 = klValid(w.kl).reduce((a, x) => a + x.kg, 0); const di = diffInfo(v.brutto1, b2);
  return `<div class="chips" style="margin-bottom:6px"><button class="btn small" data-ka="vw-back">${T("zurueck")}</button></div>
  <h1><span style="font-family:var(--f-mono)">${esc(v.charge)}</span></h1>
  <p class="lead"><b>${esc(v.erzeuger)}</b> · ${esc(v.sorte || "")} · ${T("we")} ${deDate(v.datum)} (${T("alter", ageDays(v.datum))}) · ${v.kisten || "–"} ${T("kisten_k")} ${T("gemeldet")} · ${T("brutto1")} ≈ ${fmtKg(v.brutto1)}
  ${(v.maengel1 || []).length ? `<br>${T("maengel")}: ${v.maengel1.map((m) => esc(mName(m.k))).join(", ")}` : ""}</p>
  <section class="card"><h2>${T("brutto2")}</h2><div class="kkh"><span>${T("kiste")} · ${T("kal")} · ${T("brutto2")}</span></div><div class="krows">
    ${w.kl.map((x, i) => `<div class="kkr"><span class="nr">${i + 1}</span>
      <select id="kv-kal-${i}" aria-label="${T("kal")} ${i + 1}"><option value="">${T("kal")} –</option>${kal.map((k) => `<option ${x.kal === k ? "selected" : ""}>${esc(k)}</option>`).join("")}</select>
      <span class="kw"><input type="text" inputmode="decimal" id="kv-kg-${i}" value="${esc(x.kg)}" autocomplete="off" aria-label="${T("brutto2")} ${T("kiste")} ${i + 1}"><span class="u">kg</span></span>
      <span class="ka"><button class="btn small dark" data-ka="eti-one" data-i="${i}" ${num(x.kg) > 0 ? "" : "disabled"}>🏷 ${T("eti1")}</button>${w.kl.length > 1 ? `<button class="btn small" data-ka="kv-del" data-i="${i}" aria-label="${T("datei_del")}">✕</button>` : ""}</span></div>`).join("")}
  </div>
  <div class="chips"><button class="btn" data-ka="kv-add">${T("add_kiste")}</button><button class="btn dark" data-ka="eti-cur" ${b2 ? "" : "disabled"}>${T("eti_all")}</button></div>
  <p style="margin:6px 0 0;font-size:18px">${T("summe")}: <b class="kb1" id="kv-sum">${b2 ? fmtKg(b2, 1) : "–"}</b> · ${T("diff")}: <span class="kdiff ${di ? di.cls : ""}" id="kv-diff">${di ? `${di.d >= 0 ? "+" : "−"}${fmtKg(Math.abs(di.d), 1)} kg (${di.pct >= 0 ? "+" : "−"}${fmtKg(Math.abs(di.pct), 1)} %)` : "–"}</span></p></section>
  <section class="card"><h2>${T("m2")}</h2>${mangelChips(w.mg, M2, "vw", 0)}
    ${w.mg.sonst ? `<label class="f" style="margin-top:8px">${T("sonst_txt")}<span class="kin"><input type="text" id="kv-sonst" value="${esc(w.sonst)}"><button class="kmic${K.dict === "kv-sonst" ? " on" : ""}" data-ka="dict" data-for="kv-sonst" aria-label="${T("diktat")}">🎤</button></span></label>` : ""}
    <label class="f">${T("bem")} <span class="h">${T("opt")}</span><span class="kin"><input type="text" id="kv-bem" value="${esc(w.bem)}"><button class="kmic${K.dict === "kv-bem" ? " on" : ""}" data-ka="dict" data-for="kv-bem" aria-label="${T("diktat")}">🎤</button></span></label>
    <div><b>${T("belege")}</b> <span class="hint">${T("belege_h")}</span>${belegeBlock(w.belege, "vw")}</div></section>
  ${w.msg ? `<p class="hint" style="color:${w.mail === "error" ? "var(--bad)" : "var(--ok)"}">${esc(w.msg)}</p>` : ""}
  <div class="kbar"><div class="msg">${b2 ? "" : T("miss_kg")}</div><button class="btn" data-ka="vw-save" ${w.busy ? "disabled" : ""}>${T("zwisch")}</button><button class="btn primary" data-ka="vw-done" ${w.busy || !b2 ? "disabled" : ""}>${w.busy ? T("saving") : T("abschl")}</button></div>`;
}
function vwRefresh() {
  const w = K.vw, v = vwRec(); if (!w || !v) return; const b2 = klValid(w.kl).reduce((a, x) => a + x.kg, 0); const di = diffInfo(v.brutto1, b2);
  const s = $("#kv-sum"); if (s) s.textContent = b2 ? fmtKg(b2, 1) : "–";
  const d = $("#kv-diff"); if (d) { d.className = "kdiff " + (di ? di.cls : ""); d.textContent = di ? `${di.d >= 0 ? "+" : "−"}${fmtKg(Math.abs(di.d), 1)} kg (${di.pct >= 0 ? "+" : "−"}${fmtKg(Math.abs(di.pct), 1)} %)` : "–"; }
  w.kl.forEach((x, i) => { const b = document.querySelector(`[data-ka="eti-one"][data-i="${i}"]`); if (b) b.disabled = !(num(x.kg) > 0); });
  const done = document.querySelector('[data-ka="vw-done"]'); if (done) done.disabled = w.busy || !b2;
  const et = document.querySelector('[data-ka="eti-cur"]'); if (et) et.disabled = !b2;
}
function vwPayload(final) {
  const w = K.vw, v = vwRec(); const kl = klValid(w.kl); const b2 = kl.reduce((a, x) => a + x.kg, 0);
  const mg = M2.filter((k) => w.mg[k]).map((k) => ({ k, t: MDE[k], lvl: w.mg[k].lvl ?? 0, text: k === "sonst" ? w.sonst : "", foto: w.mg[k].foto || null }));
  const vwd = { ...(v.verwiegung || {}), datum: today(), von: ME, vonName: meName(), maengel: mg, bem: w.bem.trim(), belege: w.belege.slice() };
  const out = { kistenListe: kl, verwiegung: vwd };
  if (final) { const di = diffInfo(v.brutto1, b2); const ab = abw1(v);
    mg.forEach((m) => ab.push("Mangel Verwiegung: " + mTxt(m)));
    if (di && Math.abs(di.pct) > ABW_PCT) ab.push(`Brutto 2 weicht ${fmtKg(di.pct, 1)} % von Brutto 1 ab`);
    Object.assign(out, { stufe: "verwogen", brutto2: Math.round(b2 * 10) / 10, mengeKg: Math.round(b2 * 10) / 10, mengeErfasst: Math.round(b2 * 10) / 10,
      schwundKg: v.brutto1 ? Math.round((v.brutto1 - b2) * 10) / 10 : null, schwundProzent: di ? Math.round(-di.pct * 10) / 10 : null, abweichungen: ab, verwogen: new Date().toISOString() }); }
  return out;
}
async function vwSave(final) {
  const w = K.vw, v = vwRec(); if (!w || !v || w.busy) return;
  const pl = vwPayload(final); if (final && !pl.kistenListe.length) { toast(T("miss_kg")); return; }
  w.busy = true; render();
  try { if (db) await db.doc("wareneingaenge/" + v.id).update(pl); else Object.assign(v, pl); }
  catch (err) { w.busy = false; toast("Speichern fehlgeschlagen"); render(); return; }
  Object.assign(v, pl);
  if (!final) { w.busy = false; w.msg = T("gespeichert"); render(); return; }
  w.busy = false; toast(T("abgeschl"));
  // Protokoll ablegen und intern melden
  try { const pdf = await pdfKnt([v], "verw");
    if (assets) { try { const a = await assets.upload(new Blob([pdf], { type: "application/pdf" })); if (db) await db.doc("wareneingaenge/" + v.id).update({ protokollPdf: a.id }); v.protokollPdf = a.id; } catch (_) {} }
    const to = [...(CFG.verteiler || [])];
    if (to.length) { w.mail = "sending"; w.msg = T("mail_sending"); render();
      await sendMailK(to, `Verwiegung ${v.charge} – Knoblauch trocken – ${v.erzeuger} – Brutto 2 [kg] ${fmtKg(v.brutto2, 1)}`, mailHtmlK([v], "verw"), `Verwiegung ${v.charge}: ${v.kistenListe.length} Kisten, Brutto 2 [kg] ${fmtKg(v.brutto2, 1)}.`, pdf, `WE_Verwiegung_${v.barcode}_${today()}.pdf`);
      w.mail = "sent"; w.msg = T("mail_ok") + ": " + to.join(", ");
      if (db) try { await db.doc("wareneingaenge/" + v.id).update({ meldungIntern2: new Date().toISOString() }); } catch (_) {} }
  } catch (err) { w.mail = "error"; w.msg = T("mail_err") + ": " + mailErrText(err); }
  setTimeout(confetti, 60); K.vw = null; K.vwFilt = "verw"; render(); window.scrollTo(0, 0);
  if (w.mail === "error") toast(w.msg);
}

/* ---------------- Erzeuger-Versand mit Prüfung ---------------- */
function plausiErz(v) {
  const out = []; const e = erzById(v.erzeugerId) || {};
  if (!e.email) out.push({ blk: true, t: `Keine E-Mail-Adresse beim Erzeuger ${v.erzeuger} hinterlegt (Stammdaten → Erzeuger).` });
  if (v.stufe !== "verwogen") out.push({ blk: true, t: "Charge ist noch nicht verwogen." });
  const di = diffInfo(v.brutto1, v.brutto2); if (di && Math.abs(di.pct) > ABW_PCT) out.push({ t: `Brutto 2 weicht stark von Brutto 1 ab: ${di.pct >= 0 ? "+" : "−"}${fmtKg(Math.abs(di.pct), 1)} % (${fmtKg(v.brutto1)} → ${fmtKg(v.brutto2, 1)} kg).` });
  const ohneFoto = [...(v.maengel1 || []), ...(v.verwiegung?.maengel || [])].filter((m) => !m.foto); if (ohneFoto.length) out.push({ t: `Mängel ohne Foto: ${[...new Set(ohneFoto.map((m) => MDE[m.k]))].join(", ")}.` });
  if (v.beschriftung === false) out.push({ t: "Kisten waren bei Anlieferung nicht oder mangelhaft beschriftet." });
  Object.entries(v.kontrolle || {}).forEach(([k, x]) => { if (x === false) out.push({ t: "Kontrollfrage mit Nein: " + (KF_DE[k] || k) + "." }); });
  if (!e.qs) out.push({ t: "QS-ID beim Erzeuger fehlt (Stammdaten)." });
  if (!e.oeko) out.push({ t: "Öko-Kontrollnummer beim Erzeuger fehlt (Stammdaten)." });
  if ((v.kistenListe || []).some((k) => !(k.kg > 0))) out.push({ t: "Mindestens eine Kiste ohne Gewicht." });
  return out;
}
function viewEv() {
  const ev = K.ev, v = VORG.find((x) => x.id === ev.id); if (!v) { K.ev = null; return ""; }
  const pl = plausiErz(v), blk = pl.some((x) => x.blk), e = erzById(v.erzeugerId) || {};
  const to = [e.email, ...(CFG.verteiler || [])].filter(Boolean);
  return `<section class="card kev"><div class="sechead"><h2>Protokoll an Erzeuger senden</h2><button class="btn small" data-ka="ev-close">Schließen</button></div>
   <p><b style="font-family:var(--f-mono)">${esc(v.charge)}</b> · ${esc(v.erzeuger)} · Brutto 2 [kg] <b>${fmtKg(v.brutto2, 1)}</b> (${(v.kistenListe || []).length} Kisten)</p>
   <b>Plausibilitätsprüfung</b>${pl.length ? `<ul>${pl.map((x) => `<li class="${x.blk ? "blk" : "wrn"}">${x.blk ? "⛔ " : "⚠ "}${esc(x.t)}</li>`).join("")}</ul>` : `<div class="warnbox okbox"><b>Keine Auffälligkeiten</b></div>`}
   <div class="copyline"><code>An: ${esc(to.join("; "))}</code></div>
   ${!blk && pl.length ? `<label style="display:flex;gap:10px;align-items:center;margin:8px 0"><input type="checkbox" id="ev-ack" ${ev.ack ? "checked" : ""} style="width:24px;height:24px"> Hinweise geprüft, Protokoll trotzdem senden</label>` : ""}
   <div class="chips"><button class="btn small dark" data-ka="prot" data-id="${esc(v.id)}">Protokoll ansehen</button><button class="btn primary" data-ka="ev-send" ${blk || ev.sending || (pl.length && !ev.ack) ? "disabled" : ""}>${ev.sending ? "Wird gesendet …" : "Jetzt an Erzeuger senden"}</button></div>
   ${ev.msg ? `<p class="hint" style="color:${ev.err ? "var(--bad)" : "var(--ok)"}">${esc(ev.msg)}</p>` : ""}</section>`;
}
async function evSend() {
  const ev = K.ev, v = VORG.find((x) => x.id === ev.id); if (!v || ev.sending) return;
  if (!canSend()) { toast("Keine Berechtigung für den Erzeuger-Versand"); return; }
  const e = erzById(v.erzeugerId) || {}; const to = [e.email, ...(CFG.verteiler || [])].filter(Boolean);
  ev.sending = true; ev.msg = ""; render();
  try { const pdf = await pdfKnt([v], "erz");
    await sendMailK(to, `Wareneingangsprotokoll ${v.charge} – Knoblauch trocken – ${deDate(v.datum)}`, mailHtmlK([v], "erz"), `Wareneingangsprotokoll ${v.charge}, Brutto 2 [kg] ${fmtKg(v.brutto2, 1)}. PDF im Anhang.`, pdf, `Wareneingang_${v.barcode}_${v.datum}.pdf`);
    const rec = { erzVersand: { am: new Date().toISOString(), von: ME, vonName: meName(), an: to }, gesendet: new Date().toISOString(), gesendetAn: to };
    if (db) await db.doc("wareneingaenge/" + v.id).update(rec); Object.assign(v, rec);
    ev.sending = false; ev.err = false; ev.msg = "Gesendet an " + to.join(", "); toast("An Erzeuger gesendet");
  } catch (err) { ev.sending = false; ev.err = true; ev.msg = "Nicht gesendet: " + mailErrText(err); }
  render();
}

/* ---------------- Mail ---------------- */
function mailErrText(err) {
  const c = err?.code;
  return c === "offline" ? "Kein Netz – bitte später erneut senden" : c === "not_configured" ? "Mailversand auf dem Server nicht eingerichtet"
    : c === "permission_denied" ? "keine Berechtigung" : c === "no_mcp" ? "Mailversand in dieser Ansicht nicht verfügbar" : (err?.message || "bitte erneut versuchen").slice(0, 160);
}
async function sendMailK(to, subject, html, text, pdf, fname) {
  if (!mcp) throw { code: "no_mcp" };
  await mcp.callTool("Gmail", "send_message", { to, subject, htmlBody: html, body: text, attachments: [{ filename: fname, mimeType: "application/pdf", content: ab64(pdf) }] }, { cache: false });
}
function mailHtmlK(recs, mode) {
  const r0 = recs[0];
  const row = (a, b) => `<tr><td style="padding:4px 12px 4px 0;color:#56687e;white-space:nowrap;vertical-align:top">${esc(a)}</td><td style="padding:4px 0">${esc(b)}</td></tr>`;
  const titel = mode === "erst" ? "Ersterfassung Knoblauch trocken" : mode === "verw" ? "Verwiegung Knoblauch trocken" : "Wareneingangsprotokoll Knoblauch trocken";
  const ab = recs.flatMap((r) => (r.abweichungen || []).map((a) => (recs.length > 1 ? r.charge + ": " : "") + a));
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333332;max-width:660px">
  <div style="padding:4px 0 10px"><div style="font-size:22px;font-weight:bold;color:#1c6c9e">${esc(CFG.kurz)}</div><div style="font-size:12px;color:#56687e">${esc([firmaOhneKurz(), CFG.anschrift, CFG.kontakt].filter(Boolean).join(" · "))}</div></div>
  <div style="background:#1c6c9e;color:#fff;padding:14px 16px;border-radius:8px 8px 0 0;border-bottom:4px solid #94c11f"><div style="font-size:12px;opacity:.85">${titel}</div>
  <div style="font-size:24px;font-weight:bold;font-family:Courier New,monospace">${esc(recs.map((r) => r.charge).join(" · "))}</div><div>${mode === "erst" ? "Anlieferung" : "Wareneingang"} ${deDate(r0.datum)}${mode !== "erst" ? " · " + esc(r0.erzeuger) : ""}</div></div>
  <div style="border:1px solid #dde2e5;border-top:0;padding:12px 16px;border-radius:0 0 8px 8px">
  <table style="border-collapse:collapse;font-size:14px">${row("Erfasst", dtDE(r0.erstellt) + " · " + (r0.erfasstVonName || "-"))}${r0.verwiegung?.vonName ? row("Verwogen", dtDE(r0.verwogen) + " · " + r0.verwiegung.vonName) : ""}${row("Lieferschein-Nr.", r0.keinLieferschein ? "kein Lieferschein" : r0.lieferscheinNr || "–")}${mode !== "erz" && r0.bueroWeNr ? row("büro+ WE-Nr.", r0.bueroWeNr) : ""}
  ${recs.map((r) => row(r.charge, `${r.erzeuger} · ${r.sorte || "–"} · ${r.kisten} Kisten · Brutto 1 [kg] ca. ${fmtKg(r.brutto1)}${r.brutto2 != null ? " · Brutto 2 [kg] " + fmtKg(r.brutto2, 1) : ""}`)).join("")}</table>
  ${ab.length ? `<p style="margin:10px 0 4px;font-weight:bold;color:#b3261e">${ab.length} Hinweis${ab.length > 1 ? "e" : ""}</p><ul style="color:#b3261e;margin:0;padding-left:18px">${ab.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : `<p style="color:#567a0e;font-weight:bold">Keine Auffälligkeiten</p>`}
  <p style="font-weight:bold;margin:12px 0 0;padding:8px 10px;background:#edf6fb;border-left:4px solid #1c6c9e">${HINWEIS_ABR}</p><p style="color:#567a0e;font-size:13px;font-weight:bold;margin:10px 0 0">Elektronisch erstellt – ohne Unterschrift gültig.</p><p style="color:#707476;font-size:12px;margin:4px 0 0">Protokoll-PDF im Anhang.</p></div>
  ${mode === "erz" && CFG.disclaimer ? `<p style="font-size:11px;color:#56687e;background:#f3f7fb;padding:8px 12px;border-radius:6px;margin-top:10px">${esc(CFG.disclaimer)}</p>` : ""}</div>`;
}

/* ---------------- PDF: Protokoll ---------------- */
async function imgData(id) { try { const r = await fetch("/_blob/" + id); if (!r.ok) return null; const b = await r.blob(); return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(b); }); } catch (_) { return null; } }
const pt = (s) => String(s ?? "-").replace(/[–—]/g, "-").replace(/−/g, "-").replace(/≈/g, "ca.").replace(/[„“]/g, '"').replace(/[^\x00-\xFF]/g, "");
async function pdfKnt(recs, mode) {
  const { jsPDF } = window.jspdf; const d = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const L = 15, R = 195, W = R - L, BOTTOM = 275;
  const C = { green: [148, 193, 31], blue: [108, 180, 220], blueDk: [28, 108, 158], ink: [51, 51, 50], grey: [112, 116, 118], line: [221, 226, 229], tint: [237, 246, 251], red: [190, 45, 40], okg: [86, 122, 14] };
  const font = (st, sz, c) => { d.setFont("helvetica", st); d.setFontSize(sz); d.setTextColor(...(c || C.ink)); };
  const titel = mode === "erst" ? "Ersterfassung Knoblauch trocken" : mode === "verw" ? "Verwiegeprotokoll Knoblauch trocken" : "Wareneingangsprotokoll Knoblauch trocken";
  const r0 = recs[0]; let y = 0;
  const head = () => { try { d.addImage(LOGO_VG, "JPEG", R - 26, 5, 26, 26); } catch (_) {}
    try { const ip = d.getImageProperties(LOGO_RM); const h = 20, w = Math.min(34, (ip.width / ip.height) * h); d.addImage(LOGO_RM, "JPEG", R - 30 - w, 8, w, h); } catch (_) {}
    font("bold", 15, C.blueDk); d.text(pt(titel), L, 15); font("bold", 10, C.ink); d.text(pt(CFG.kurz || ""), L, 21.5);
    font("normal", 8.5, C.grey); d.text(pt(firmaOhneKurz()), L, 26.5, { maxWidth: W - 70 });
    d.setFillColor(...C.green); d.rect(L, 33, W * 0.64, 1.6, "F"); d.setFillColor(...C.blue); d.rect(L + W * 0.64 + 1.2, 33, W * 0.36 - 1.2, 1.6, "F"); y = 42; };
  const need = (h) => { if (y + h > BOTTOM) { d.addPage(); head(); } };
  const sec = (t) => { need(14); font("bold", 10.5, C.blueDk); d.setFillColor(...C.green); d.rect(L, y - 3.2, 2.4, 4, "F"); d.text(pt(t.toUpperCase()), L + 5, y); y += 6; };
  const kv = (rows) => { rows.forEach(([a, b, red]) => { const lines = d.splitTextToSize(pt(b), W - 52); need(4.6 * lines.length + 2); font("normal", 8.5, C.grey); d.text(pt(a), L, y); font(red ? "bold" : "normal", 9.5, red ? C.red : C.ink); d.text(lines, L + 50, y); y += 4.6 * lines.length + 1.4; }); y += 2; };
  const table = (cols, rows) => { const hdr = () => { need(8); d.setFillColor(...C.tint); d.rect(L, y - 4.5, W, 7, "F"); font("bold", 8, C.blueDk); let x = L + 2; cols.forEach((c) => { d.text(pt(c[0]), c[2] ? x + c[1] - 4 : x, y, { align: c[2] ? "right" : "left" }); x += c[1]; }); y += 5; };
    hdr(); rows.forEach((r) => { const cells = r.map((v, i) => d.splitTextToSize(pt(v), cols[i][1] - 4)); const h = Math.max(...cells.map((c) => c.length)) * 4.2 + 2.2;
      if (y + h > BOTTOM) { d.addPage(); head(); hdr(); } font("normal", 9, C.ink); let x = L + 2; cells.forEach((c, i) => { d.text(c, cols[i][2] ? x + cols[i][1] - 4 : x, y, { align: cols[i][2] ? "right" : "left" }); x += cols[i][1]; });
      d.setDrawColor(...C.line); d.setLineWidth(0.2); d.line(L, y + h - 3.6, R, y + h - 3.6); y += h; }); y += 3; };
  head();
  d.setFillColor(...C.tint); d.rect(L, y - 4.5, W, 9, "F"); d.setFillColor(...C.blueDk); d.rect(L, y - 4.5, 1.6, 9, "F");
  font("bold", 10, C.blueDk); d.text(pt(HINWEIS_ABR), L + 5, y + 1.3); y += 10;
  sec("Anlieferung");
  kv([["Datum Wareneingang", deDate(r0.datum)], ["Lieferschein-Nr.", r0.keinLieferschein ? "kein Lieferschein" : r0.lieferscheinNr || "-", r0.keinLieferschein],
    ...(mode !== "erz" && r0.bueroWeNr ? [["büro+ WE-Nr.", r0.bueroWeNr]] : []),
    ...(r0.kontrolle ? Object.entries(r0.kontrolle).map(([k, x]) => [{ zert: "Zertifikat / Öko-Nr. auf LS", schaed: "Frei von Schädlingen" }[k] || k, x === false ? "nein" : "ja", x === false]) : [["Sauberkeit Fahrzeug / Ware", r0.sauber ? "in Ordnung" : "nicht in Ordnung", !r0.sauber], ["Temperatur", r0.temperatur === "ok" ? "in Ordnung" : "nicht in Ordnung", r0.temperatur !== "ok"]]),
  ]);
  if (mode === "erst" || recs.length > 1) {
    sec("Chargen");
    table([["Charge", 24], ["Erzeuger", 30], ["Sorte", 22], ["Kisten", 13, 1], ["Brutto 1 ca. [kg]", 21, 1], ["Abtrocknung", 22], ["Beschriftung", 23], ["Mängel", 25]],
      recs.map((r) => [r.charge, `${r.erzeuger} (${r.code})`, r.sorte || "-", String(r.kisten ?? "-"), fmtKg(r.brutto1), TROCK_DE[r.abtrocknung] || "-", r.beschriftung === false ? "mangelhaft" : "ok", (r.maengel1 || []).map(mTxt).join(", ") || "keine"]));
  } else {
    const r = r0, e = erzById(r.erzeugerId) || {};
    sec("Charge");
    kv([["Charge", r.charge], ["Erzeuger", `${r.erzeuger} (${r.code})${e.ort ? " · " + e.ort : ""}`], ["Verband", r.auslobung || "-"], ["Öko-Kontrollnummer", e.oeko || r.oeko || "-"], ["QS-ID", e.qs || r.qs || "-"],
      ["Sorte", r.sorte || "-"], ["Anlieferung", `${r.kisten} Holz-Großkisten · Brutto 1 [kg] ca. ${fmtKg(r.brutto1)} (${r.brutto1Art === "gesamt" ? "Gesamtgewicht" : "Ø " + fmtKg(r.avgKg) + " kg je Kiste"})`],
      ["Abtrocknung", TROCK_DE[r.abtrocknung] || "-", r.abtrocknung && r.abtrocknung !== "gut"],
      ["Kistenbeschriftung BIO/QS", r.beschriftung === false ? "nicht oder mangelhaft beschriftet" : "in Ordnung", r.beschriftung === false],
      ["Mängel bei Anlieferung", (r.maengel1 || []).map(mTxt).join(", ") || "keine", (r.maengel1 || []).length > 0]]);
    if (r.stufe === "verwogen") { const vw = r.verwiegung || {}; const di = diffInfo(r.brutto1, r.brutto2);
      sec("Verwiegung nach Vorputzen und Bürsten");
      kv([["Datum Verwiegung", deDate(vw.datum) + (vw.vonName ? " · " + vw.vonName : "")], ["Brutto 2 gesamt [kg]", `${fmtKg(r.brutto2, 1)} (${(r.kistenListe || []).length} Kisten)`],
        ["Abweichung zu Brutto 1", di ? `${di.d >= 0 ? "+" : "-"}${fmtKg(Math.abs(di.d), 1)} kg (${di.pct >= 0 ? "+" : "-"}${fmtKg(Math.abs(di.pct), 1)} %)` : "-", di && Math.abs(di.pct) > ABW_PCT],
        ["Mängel bei Verwiegung", (vw.maengel || []).map(mTxt).join(", ") || "keine", (vw.maengel || []).length > 0], ...(vw.bem ? [["Bemerkung", vw.bem]] : [])]);
      table([["Kiste", 20], ["Kaliber", 60], ["Brutto 2 [kg]", 40, 1], ["Barcode", 60]], (r.kistenListe || []).map((k, i) => [String(i + 1), k.kal || "-", fmtKg(k.kg, 1), `${r.barcode}K${String(i + 1).padStart(2, "0")}`]));
    }
    if (r.bemerkung) kv([["Bemerkung Anlieferung", r.bemerkung]]);
  }
  // Fotos zu Mängeln
  const fotos = []; recs.forEach((r) => { if (r.lsFoto && mode !== "erz") fotos.push({ id: r.lsFoto, cap: `Lieferschein ${r.lieferscheinNr || ""}` }); (r.maengel1 || []).forEach((m) => m.foto && fotos.push({ id: m.foto, cap: `${r.charge} · Anlieferung · ${MDE[m.k]}` })); (r.verwiegung?.maengel || []).forEach((m) => m.foto && fotos.push({ id: m.foto, cap: `${r.charge} · Verwiegung · ${MDE[m.k]}` })); });
  { const seen = new Set(); for (let i = fotos.length - 1; i >= 0; i--) { if (seen.has(fotos[i].id)) fotos.splice(i, 1); else seen.add(fotos[i].id); } }
  { const rows = []; const recs1 = recs.length > 1;
    recs.forEach((r) => { const p = recs1 ? r.charge + ": " : "";
      if (!recs1 || r === recs[0]) rows.push(["Ersterfassung", `${dtDE(r.erstellt)} · ${r.erfasstVonName || "-"}`]);
      if (r.verwiegung?.vonName || r.verwogen) rows.push([p + "Verwiegung", `${dtDE(r.verwogen) || deDate(r.verwiegung?.datum)} · ${r.verwiegung?.vonName || "-"}`]);
      if (r.erzVersand) rows.push([p + "An Erzeuger gesendet", `${dtDE(r.erzVersand.am)} · ${r.erzVersand.vonName || "-"}`]); });
    rows.push(["Protokoll erstellt", `${new Date().toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })} · ${meName() || "-"}`]);
    sec("Bearbeitung"); kv(rows); }
  if (fotos.length) { sec("Fotos"); const w = (W - 8) / 3, h = w * 0.75; let col = 0;
    for (const f of fotos.slice(0, 18)) { const data = await imgData(f.id); if (!data) continue; if (col === 0) need(h + 8);
      try { d.addImage(data, "JPEG", L + col * (w + 4), y, w, h); } catch (_) {} font("normal", 7.5, C.grey); d.text(pt(f.cap), L + col * (w + 4), y + h + 3.6, { maxWidth: w });
      col++; if (col === 3) { col = 0; y += h + 8; } }
    if (col) y += h + 8; }
  need(26); font("bold", 9.5, C.blueDk); d.text(pt(HINWEIS_ABR), L, y); y += 5;
  font("bold", 9.5, C.okg); d.text(pt("Elektronisch erstellt - ohne Unterschrift gültig."), L, y); y += 5;
  if (mode === "erz" && CFG.disclaimer) { font("normal", 7.5, C.grey); const ls = d.splitTextToSize(pt(CFG.disclaimer), W); need(ls.length * 3.4); d.text(ls, L, y); }
  const n = d.getNumberOfPages(); const stamp = new Date().toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
  for (let i = 1; i <= n; i++) { d.setPage(i); font("normal", 7.5, C.grey); d.text(pt(`${CFG.kurz} · erstellt ${stamp} · Seite ${i}/${n}`), L, 290); }
  return d.output("arraybuffer");
}
K.pdfFor = async function (v) { return pdfKnt([v], v.stufe === "verwogen" ? "verw" : "erst"); };

/* ---------------- PDF: Kistenetiketten A6 ---------------- */
function etiPdf(v, kl, only) {
  const { jsPDF } = window.jspdf; const d = new jsPDF({ unit: "mm", format: "a6", orientation: "portrait" }); // 105 × 148
  const e = erzById(v.erzeugerId) || {}; const vw = v.verwiegung || {}; const wer = kuerzel(vw.vonName || meName());
  const idx = only == null ? kl.map((_, i) => i) : [only]; let first = true;
  const tag = ((v.verband && v.verband.length ? v.verband : (v.auslobung || "").split(/,\s*/)).filter(Boolean).join(" + ") || "BIO").toUpperCase();
  for (const i of idx) { const k = kl[i]; if (!(k && k.kg > 0)) continue; if (!first) d.addPage("a6", "portrait"); first = false;
    const bc = `${v.barcode}K${String(i + 1).padStart(2, "0")}`;
    d.setFont("helvetica", "bold"); d.setFontSize(8.5); d.setTextColor(0, 0, 0); d.text("VG BIO · BIOHOF RETTERMAYER", 6, 9);
    d.setFontSize(9.5); const tw = d.getTextWidth(tag) + 4; d.setFillColor(0, 0, 0); d.rect(99 - tw, 4.6, tw, 6, "F"); d.setTextColor(255, 255, 255); d.text(pt(tag), 97, 9, { align: "right" }); d.setTextColor(0, 0, 0);
    d.setFont("helvetica", "normal"); d.setFontSize(10); d.text(pt(`Knoblauch trocken · ${v.sorte || "-"}`), 6, 16);
    d.setLineWidth(0.4); d.line(6, 19, 99, 19);
    d.setFontSize(9); d.text("Brutto 2 [kg]", 6, 25); d.setFont("helvetica", "bold"); d.setFontSize(40); d.text(pt(fmtKg(k.kg, 1)), 6, 40);
    d.setFont("courier", "bold"); d.setFontSize(19); d.text(pt(v.charge), 6, 51); d.setFont("helvetica", "bold"); d.setFontSize(13); d.text(pt(`Kiste ${i + 1}/${kl.length}`), 99, 51, { align: "right" });
    try { d.addImage(bcPng(bc), "PNG", 6, 55, 93, 22); } catch (_) {}
    d.setFont("courier", "normal"); d.setFontSize(9); d.text(bc, 52.5, 81, { align: "center" });
    const rows = [["Erzeuger", `${v.erzeuger} (${v.code})`], ["Kaliber", k.kal || "-"], ["Öko-Kontrollnr.", e.oeko || v.oeko || "-"], ["QS-ID", e.qs || v.qs || "-"],
      ["Datum WE", deDate(v.datum)], ["Verwogen", `${deDate(vw.datum || today())}${wer ? " · " + wer : ""}`]];
    let y = 89; rows.forEach(([a, b]) => { d.setFont("helvetica", "normal"); d.setFontSize(8.5); d.setTextColor(90, 90, 90); d.text(pt(a), 6, y); d.setTextColor(0, 0, 0); d.setFont("helvetica", "bold"); d.setFontSize(10.5); d.text(d.splitTextToSize(pt(b), 62), 37, y); y += 8.6; d.setDrawColor(200, 200, 200); d.setLineWidth(0.2); d.line(6, y - 5.4, 99, y - 5.4); });
    d.setFont("helvetica", "normal"); d.setFontSize(7); d.setTextColor(110, 110, 110); d.text(pt([CFG.kurz, firmaOhneKurz()].filter(Boolean).join(" · ")), 52.5, 143, { align: "center", maxWidth: 93 });
  }
  return d.output("arraybuffer");
}
function etiShow(v, kl, only) { if (!kl.some((k) => k.kg > 0)) { toast(T("miss_kg")); return; } const buf = etiPdf(v, kl, only);
  showPdf(buf, `Etikett_${v.barcode}${only != null ? "_K" + String(only + 1).padStart(2, "0") : ""}.pdf`, `${T("btn_eti")} ${v.charge}`); }

/* ---------------- Dashboard ---------------- */
function dashList() {
  const f = K.dash; const now = new Date();
  return VORG.filter((v) => (f.prod === "alle" || v.produkt === f.prod)).filter((v) => {
    if (f.zeit === "alles") return true; if (f.zeit === "30") return (now - new Date(v.datum + "T12:00:00")) / 864e5 <= 30;
    const p = prod(v.produkt); if (!p) return true; return saisonJahr(p, v.datum) === saisonJahr(p, today()); });
}
const mengeOf = (v) => (v.produkt === "KNT" && v.stufe ? (v.brutto2 ?? v.brutto1 ?? 0) : (v.mengeKg ?? 0));
function hbars(rows, unit) { const max = Math.max(1, ...rows.map((r) => r[1]));
  return rows.length ? `<div class="hbars">${rows.map(([l, val, tip]) => `<div class="hbar" title="${esc(tip || l + ": " + fmtKg(val) + " " + unit)}"><span class="lbl">${esc(l)}</span><span class="trk"><i style="width:${(val / max) * 100}%"></i></span><span class="val">${fmtKg(val)} ${unit}</span></div>`).join("")}</div>` : `<p class="hint">Keine Daten</p>`; }
function isoWeek(iso) { const d = new Date(iso + "T12:00:00"); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return [t.getUTCFullYear(), Math.ceil(((t - y0) / 864e5 + 1) / 7)]; }
K.viewDash = function () {
  const f = K.dash, L = dashList();
  const knt = L.filter((v) => v.produkt === "KNT" && v.stufe), offen = knt.filter((v) => v.stufe === "erfasst"), alt = offen.filter((v) => ageDays(v.datum) > 7);
  const verw = knt.filter((v) => v.stufe === "verwogen" && v.brutto1 && v.brutto2); const versOffen = knt.filter((v) => v.stufe === "verwogen" && !v.erzVersand);
  const menge = L.reduce((a, v) => a + mengeOf(v), 0);
  const avgDiff = verw.length ? verw.reduce((a, v) => a + ((v.brutto2 - v.brutto1) / v.brutto1) * 100, 0) / verw.length : null;
  const mitM = L.filter((v) => (v.maengel1 || []).length || (v.verwiegung?.maengel || []).length || (v.abweichungen || []).length).length;
  // Wochen
  const wk = {}; L.forEach((v) => { const [y, w] = isoWeek(v.datum); const k = `${y}-${String(w).padStart(2, "0")}`; wk[k] = (wk[k] || 0) + mengeOf(v); });
  const wkeys = Object.keys(wk).sort().slice(-16); const wmax = Math.max(1, ...wkeys.map((k) => wk[k]));
  const byErz = {}; L.forEach((v) => (byErz[v.erzeuger] = (byErz[v.erzeuger] || 0) + mengeOf(v)));
  const erzRows = Object.entries(byErz).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const mg = {}; L.forEach((v) => { [...(v.maengel1 || []), ...(v.verwiegung?.maengel || [])].forEach((m) => (mg[MDE[m.k]] = (mg[MDE[m.k]] || 0) + 1)); });
  const mgRows = Object.entries(mg).sort((a, b) => b[1] - a[1]);
  const so = {}; L.forEach((v) => { const s = v.sorte || v.bonitur?.sorte; if (s) so[s] = (so[s] || 0) + mengeOf(v); });
  const soRows = Object.entries(so).sort((a, b) => b[1] - a[1]);
  const todo = [...offen.sort((a, b) => (a.datum < b.datum ? -1 : 1)).map((v) => [v, "Verwiegung offen", ageDays(v.datum)]), ...(canSend() ? versOffen.map((v) => [v, "Versand an Erzeuger offen", ageDays(v.verwogen ? v.verwogen.slice(0, 10) : v.datum)]) : [])];
  return `<h1>Auswertung</h1>
  <div class="dfilter"><label>Produkt<select id="d-prod">${[["alle", "Alle Produkte"], ...PROD.map((p) => [p.k, p.name])].map(([k, t]) => `<option value="${k}" ${f.prod === k ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>
    <label>Zeitraum<select id="d-zeit">${[["saison", "Aktuelle Saison"], ["30", "Letzte 30 Tage"], ["alles", "Alles"]].map(([k, t]) => `<option value="${k}" ${f.zeit === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
    <button class="btn small" data-ka="d-csv" ${L.length ? "" : "disabled"}>Daten als CSV</button></div>
  <div class="dtiles">
    <div class="dtile"><span>Anlieferungen</span><b>${L.length}</b><small>Chargen im Zeitraum</small></div>
    <div class="dtile"><span>Menge</span><b>${fmtKg(menge)} kg</b><small>KNT: Brutto 2, sonst Brutto 1</small></div>
    <div class="dtile${alt.length ? " alert" : ""}"><span>Verwiegung offen</span><b>${offen.length}</b><small>${alt.length ? alt.length + " älter als 7 Tage" : "alle im Plan"}</small></div>
    <div class="dtile"><span>Ø Brutto 2 zu Brutto 1</span><b>${avgDiff == null ? "–" : (avgDiff >= 0 ? "+" : "−") + fmtKg(Math.abs(avgDiff), 1) + " %"}</b><small>${verw.length} verwogene Chargen</small></div>
    <div class="dtile"><span>Chargen mit Mängeln</span><b>${L.length ? Math.round((mitM / L.length) * 100) + " %" : "–"}</b><small>${mitM} von ${L.length}</small></div>
    <div class="dtile${versOffen.length ? " alert" : ""}"><span>Versand an Erzeuger offen</span><b>${versOffen.length}</b><small>verwogen, noch nicht gesendet</small></div>
  </div>
  <div class="dgrid">
    <section class="card"><h2>Menge je Woche (kg)</h2>${wkeys.length ? `<div class="vbars" role="img" aria-label="Menge je Kalenderwoche">${wkeys.map((k) => `<div class="vb" title="KW ${k.slice(5)}/${k.slice(0, 4)}: ${fmtKg(wk[k])} kg"><i style="height:${(wk[k] / wmax) * 100}%"></i></div>`).join("")}</div><div class="vlbls">${wkeys.map((k) => `<span>KW${+k.slice(5)}</span>`).join("")}</div>` : `<p class="hint">Keine Daten</p>`}</section>
    <section class="card"><h2>Menge je Erzeuger</h2>${hbars(erzRows, "kg")}</section>
    <section class="card"><h2>Mängel (Anzahl Nennungen)</h2>${hbars(mgRows.map(([l, n]) => [l, n, `${l}: ${n}×`]), "×")}</section>
    <section class="card"><h2>Menge je Sorte</h2>${hbars(soRows, "kg")}</section>
  </div>
  <section class="card"><h2>Zu erledigen (${todo.length})</h2>${todo.length ? `<div class="tw"><table class="t"><thead><tr><th>Charge</th><th>Erzeuger</th><th>Aufgabe</th><th class="n">seit Tagen</th><th></th></tr></thead><tbody>
    ${todo.map(([v, t, d]) => `<tr><td style="font-family:var(--f-mono);font-weight:700">${esc(v.charge)}</td><td>${esc(v.erzeuger)}</td><td>${t}</td><td class="n">${d > 7 && t.startsWith("Verw") ? `<span class="pill p-bad">${d}</span>` : d}</td><td>${t.startsWith("Verw") ? `<button class="btn small" data-ka="vw-open-go" data-id="${esc(v.id)}">Verwiegen</button>` : `<button class="btn small primary" data-ka="ev-open" data-id="${esc(v.id)}">Prüfen & senden</button>`}</td></tr>`).join("")}</tbody></table></div>` : `<p class="hint">Nichts offen.</p>`}</section>`;
};

/* ---------------- Ereignisse ---------------- */
const fileFoto = document.createElement("input"); fileFoto.type = "file"; fileFoto.accept = "image/*"; fileFoto.setAttribute("capture", "environment"); fileFoto.hidden = true;
const fileAny = document.createElement("input"); fileAny.type = "file"; fileAny.multiple = true; fileAny.accept = "image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.heic,.heif"; fileAny.hidden = true;
document.addEventListener("DOMContentLoaded", () => { document.body.append(fileFoto, fileAny); });
const listOf = (ctx) => (ctx === "vw" ? K.vw.belege : K.ke.belege);
const mgOf = (ctx, ci) => (ctx === "vw" ? K.vw.mg : K.ke.chargen[ci].mg);
async function onPicked(files) {
  const p = K.pend; K.pend = null; if (!p || !files.length) return;
  if (p.kind === "ls") { await lsFoto(files[0]); return; }
  if (p.kind === "mg") { const mg = mgOf(p.ctx, p.ci); try { toast(T("foto_load")); const r = await uploadFile(files[0], true); if (r && mg[p.k]) mg[p.k].foto = r.id; } catch (e) { console.error(e); toast("Foto konnte nicht gelesen werden"); } kePersist(); render(); }
  else await addBelege([...files], listOf(p.ctx));
}
fileFoto.addEventListener("change", () => { const f = [...fileFoto.files]; fileFoto.value = ""; onPicked(f); });
fileAny.addEventListener("change", () => { const f = [...fileAny.files]; fileAny.value = ""; onPicked(f); });

document.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-ka]"); if (!b) return; const a = b.dataset.ka, ci = +b.dataset.ci, ctx = b.dataset.ctx;
  const e = K.ke;
  switch (a) {
    case "lang": setLang(lang() === "de" ? "ro" : "de"); render(); break;
    case "back-prod": K.stop(); render(); break;
    case "ke-set": e[b.dataset.f] = b.dataset.v; kePersist(); render(); break;
    case "ke-keinls": e.keinLs = !e.keinLs; kePersist(); render(); break;
    case "ch-add": e.chargen.push(newCharge(e.chargen[e.chargen.length - 1])); kePersist(); render(); setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 30); break;
    case "ch-del": e.chargen.splice(ci, 1); kePersist(); render(); break;
    case "ki-minus": case "ki-plus": { const c = e.chargen[ci]; const n = Math.max(1, (parseInt(c.kisten, 10) || 0) + (a === "ki-plus" ? 1 : -1)); c.kisten = String(n); kePersist(); const el = $("#k-kisten-" + ci); if (el) el.value = n; keRefreshBar(); break; }
    case "ch-modus": e.chargen[ci].modus = b.dataset.v; kePersist(); render(); break;
    case "ch-avg": e.chargen[ci].avg = +b.dataset.v; kePersist(); render(); break;
    case "ch-beschr": e.chargen[ci].beschr = b.dataset.v === "1"; kePersist(); render(); break;
    case "mg": { const mg = mgOf(ctx, ci), k = b.dataset.k; if (mg[k]) delete mg[k]; else mg[k] = { lvl: 0, foto: null }; kePersist(); render(); break; }
    case "mg-lvl": { const mg = mgOf(ctx, ci); if (mg[b.dataset.k]) mg[b.dataset.k].lvl = +b.dataset.v; kePersist(); render(); break; }
    case "ch-trock": e.chargen[ci].trock = b.dataset.v; kePersist(); render(); break;
    case "ch-beschrf": e.chargen[ci].beschrFehler = !e.chargen[ci].beschrFehler; kePersist(); render(); break;
    case "kf": e.kontrolle[b.dataset.k] = b.dataset.v === "1"; kePersist(); render(); break;
    case "ls-foto": K.pend = { kind: "ls" }; fileFoto.click(); break;
    case "dict": diktat(b.dataset.for); break;
    case "mg-foto": K.pend = { kind: "mg", ctx, ci, k: b.dataset.k }; fileFoto.click(); break;
    case "mg-foto-del": { const mg = mgOf(ctx, ci); if (mg[b.dataset.k]) mg[b.dataset.k].foto = null; kePersist(); render(); break; }
    case "pick-foto": K.pend = { kind: "beleg", ctx }; fileFoto.click(); break;
    case "pick-file": K.pend = { kind: "beleg", ctx }; fileAny.click(); break;
    case "file-open": openFile(listOf(ctx)[+b.dataset.i]); break;
    case "file-del": listOf(ctx).splice(+b.dataset.i, 1); kePersist(); render(); break;
    case "ke-reset": if (confirmReset()) { keClear(); K.ke = newKE(); render(); } break;
    case "ke-save": keSave(); break;
    case "ke-new": K.kd = null; K.ke = newKE(); render(); window.scrollTo(0, 0); break;
    case "erst-mail": mailErst(); break;
    case "erst-pdf": pdfKnt(K.kd.recs, "erst").then((buf) => showPdf(buf, `WE_Ersterfassung_${K.kd.recs[0].datum}.pdf`, T("pdf_view"))); break;
    case "go-vw": K.kd = null; view = "vw"; K.vw = null; K.vwFilt = "offen"; render(); window.scrollTo(0, 0); break;
    case "vw-filt": K.vwFilt = b.dataset.v; render(); break;
    case "vw-open": vwOpen(b.dataset.id); break;
    case "vw-open-go": view = "vw"; vwOpen(b.dataset.id); break;
    case "vw-back": K.vw = null; render(); break;
    case "kv-add": { const l = K.vw.kl; l.push({ kal: l[l.length - 1]?.kal || "", kg: "" }); render(); setTimeout(() => { const el = $("#kv-kg-" + (l.length - 1)); if (el) el.focus(); }, 30); break; }
    case "kv-del": K.vw.kl.splice(+b.dataset.i, 1); render(); break;
    case "eti-one": { const v = vwRec(); etiShow(v, K.vw.kl.map((x) => ({ kal: x.kal, kg: num(x.kg) })), +b.dataset.i); break; }
    case "eti-cur": { const v = vwRec(); etiShow(v, K.vw.kl.map((x) => ({ kal: x.kal, kg: num(x.kg) })), null); break; }
    case "eti-all": { const v = VORG.find((x) => x.id === b.dataset.id); if (v) etiShow(v, v.kistenListe || [], null); break; }
    case "vw-save": vwSave(false); break;
    case "vw-done": vwSave(true); break;
    case "prot": { const v = VORG.find((x) => x.id === b.dataset.id); if (v) pdfKnt([v], v.stufe === "verwogen" ? "verw" : "erst").then((buf) => showPdf(buf, `WE_${v.barcode}_${v.datum}.pdf`, "Protokoll " + v.charge)); break; }
    case "ev-open": if (!canSend()) { toast("Keine Berechtigung für den Erzeuger-Versand"); break; } view = "vw"; K.vw = null; K.ev = { id: b.dataset.id, ack: false }; render(); window.scrollTo(0, 0); break;
    case "ev-close": K.ev = null; render(); break;
    case "ev-send": evSend(); break;
    case "d-csv": csvExport(dashList(), false); break;
  }
});
function confirmReset() { return window.confirm(lang() === "ro" ? "Renunți la recepția începută?" : "Angefangene Erfassung verwerfen?"); }
document.addEventListener("input", (ev) => {
  const t = ev.target, id = t.id || ""; if (!id.startsWith("k")) return;
  const e = K.ke; let m;
  if (id === "k-lsnr") e.lsNr = t.value; else if (id === "k-bwe") e.bweNr = t.value;
  else if ((m = id.match(/^k-kisten-(\d+)$/))) e.chargen[+m[1]].kisten = t.value;
  else if ((m = id.match(/^k-ges-(\d+)$/))) e.chargen[+m[1]].gesamt = t.value;
  else if ((m = id.match(/^k-sonst-(\d+)$/))) e.chargen[+m[1]].sonst = t.value;
  else if ((m = id.match(/^k-bem-(\d+)$/))) e.chargen[+m[1]].bem = t.value;
  else if ((m = id.match(/^kv-kg-(\d+)$/))) { const l = K.vw.kl, i = +m[1], v = num(t.value);
    if (v !== null && (v > KISTE_MAX || v < 0)) { t.value = l[i].kg; t.style.borderColor = "var(--bad)"; setTimeout(() => (t.style.borderColor = ""), 1500); toast(T("max_kiste")); return; }
    l[i].kg = t.value; vwRefresh(); return; }
  else if (id === "kv-sonst") { K.vw.sonst = t.value; return; } else if (id === "kv-bem") { K.vw.bem = t.value; return; }
  else return;
  kePersist(); keRefreshBar();
});
document.addEventListener("change", (ev) => {
  const t = ev.target, id = t.id || ""; let m;
  if (id === "k-datum") { K.ke.datum = t.value || today(); kePersist(); }
  else if ((m = id.match(/^k-erz-(\d+)$/))) { K.ke.chargen[+m[1]].erzId = t.value; kePersist(); keRefreshBar(); }
  else if ((m = id.match(/^k-sorte-(\d+)$/))) { K.ke.chargen[+m[1]].sorte = t.value; kePersist(); keRefreshBar(); }
  else if ((m = id.match(/^kv-kal-(\d+)$/))) { K.vw.kl[+m[1]].kal = t.value; }
  else if (id === "ev-ack") { K.ev.ack = t.checked; render(); }
  else if (id === "d-prod") { K.dash.prod = t.value; render(); } else if (id === "d-zeit") { K.dash.zeit = t.value; render(); }
});
document.addEventListener("keydown", (ev) => {
  const t = ev.target; if (ev.key !== "Enter" || !/^kv-kg-\d+$/.test(t.id || "")) return; ev.preventDefault();
  const i = +t.id.slice(6), l = K.vw.kl; if (i >= l.length - 1) { l.push({ kal: l[i].kal || "", kg: "" }); render(); setTimeout(() => $("#kv-kg-" + (i + 1))?.focus(), 30); } else { const n = $("#kv-kg-" + (i + 1)); n.focus(); n.select(); }
});
// Drag & Drop für Belege
document.addEventListener("dragover", (ev) => { const z = ev.target.closest && ev.target.closest("[data-kdrop]"); if (!z) return; ev.preventDefault(); z.classList.add("over"); });
document.addEventListener("dragleave", (ev) => { const z = ev.target.closest && ev.target.closest("[data-kdrop]"); if (z) z.classList.remove("over"); });
document.addEventListener("drop", (ev) => { const z = ev.target.closest && ev.target.closest("[data-kdrop]"); if (!z) return; ev.preventDefault(); z.classList.remove("over");
  const files = [...(ev.dataTransfer?.files || [])]; if (files.length) addBelege(files, listOf(z.dataset.kdrop)); });

/* Kopf: Tabs und Sprachknopf */
K.header = function () {
  [["erf", "tab_erf"], ["vw", "tab_vw"], ["ueb", "tab_ueb"], ["aw", "tab_aw"], ["sd", "tab_sd"]].forEach(([v, k]) => { const el = document.getElementById("tab-" + v); if (el) el.textContent = T(k); });
  let lb = document.getElementById("k-lang");
  if (!lb) { const row = document.querySelector(".brandrow"); if (row) { lb = document.createElement("button"); lb.id = "k-lang"; lb.className = "klang"; lb.dataset.ka = "lang"; row.appendChild(lb); } }
  if (lb) { lb.textContent = T("lang_btn"); lb.title = T("lang_title"); }
  const br = document.querySelector(".brand"); if (br && br.firstChild && br.firstChild.nodeType === 3) br.firstChild.nodeValue = lang() === "ro" ? "Recepție usturoi" : "Wareneingang Knoblauch";
  document.documentElement.lang = lang();
};
})();
