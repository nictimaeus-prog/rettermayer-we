"""Erzeugt src/index.html der Handy-App aus der Web-App (Artefakt-Fassung).
Aufruf: python3 tools/make_src.py <pfad/zur/artefakt/index.html>
Alle Anpassungen für die eigenständige App stehen hier an einer Stelle."""
import sys, re, pathlib

src = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
root = pathlib.Path(__file__).resolve().parent.parent
R = []
def r(a, b): R.append((a, b))

# --- Kopf: Titel, Schriften und Bibliotheken lokal ---
r('<title>Wareneingang Knoblauch Rettermayer</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n', '')
r('<link rel="preconnect" href="https://fonts.googleapis.com">\n', '')
r('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@600;700&family=Source+Sans+3:wght@400;600;700&family=JetBrains+Mono:wght@500;700&display=swap">\n', '')
r('<script src="https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js"></script>\n', '')
r('<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>\n', '')
r('const b="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";', 'const b="lib/pdfjs/";')

# --- Laufzeit vor das App-Skript ---
r('\n<script>\n/* Logos für das Protokoll', '\n<script src="config.js"></script>\n<script src="lib/supabase.js"></script>\n<script src="rwe-runtime.js"></script>\n<script>\n/* Logos für das Protokoll')

# --- Mailversand: Server statt Gmail ---
r('if(pdfB64.length>900000){', 'if(pdfB64.length>6000000){')
r('Versand über dein verbundenes Gmail.', 'Versand über den App-Server.')
r('S.mailMsg = c==="server_not_connected"?', 'S.mailMsg = c==="offline"?"Kein Netz. Das Protokoll ist gespeichert, bitte später erneut senden."\n      : c==="not_configured"?"Der Mailversand ist auf dem Server noch nicht eingerichtet."\n      : c==="server_not_connected"?')
r(': c==="server_unavailable"||c==="upstream_error"?"Gmail hat nicht geantwortet. Bitte im Postfach unter „Gesendet“ prüfen, bevor du erneut sendest."',
  ': c==="server_unavailable"||c==="upstream_error"?"Der Server hat nicht geantwortet. Bitte kurz warten und erneut senden."')
r(': c==="tool_error"?"Gmail hat die Nachricht abgelehnt: "', ': c==="tool_error"?"Versand abgelehnt: "')
r('verteiler:[], erzMail:false,', 'verteiler:["nicolai.timaeus@bio-vg.de"], erzMail:false,')

# --- Lieferschein lesen: Fehlertexte ---
r('S.lsMsg = e?.code==="not_granted" ?', 'S.lsMsg = e?.code==="not_configured" ? "Automatisches Auslesen ist auf dem Server nicht eingerichtet. Bitte Status je Zeile antippen." : e?.code==="offline" ? "Zum Auslesen braucht das Handy Netz. Bitte Status je Zeile antippen." : e?.code==="not_granted" ?')

# --- Rolle: Stammdaten nur für Admins, Benutzerverwaltung, Abmelden ---
r('  if(user){ try{ ME=(await user.id())||ME; }catch(_){} }',
  '  if(user){ try{ ME=(await user.id())||ME; }catch(_){} }\n  if(window.RWE){ $("#tab-sd").hidden=!RWE.isAdmin(); if(view==="sd"&&!RWE.isAdmin()) view="erf"; render(); }')
r('  return `<h1>Team</h1>', '  return accountLine()+`<h1>Team</h1>')
r('  return `<h1>Stammdaten</h1>', '  return `<h1>Stammdaten</h1>${usersSection()}`+`')
r('/* ---------- Bilder ---------- */', r'''/* ---------- Konto und Benutzer (eigene App) ---------- */
let USERS=null, USERS_ERR="";
function accountLine(){ if(!window.RWE) return ""; const p=RWE.profile(); if(!p) return "";
  return `<section class="card"><div class="sechead"><span><b>${esc(p.name||p.email)}</b><br><span class="hint">${esc(p.email||"")} · ${p.role==="admin"?"Admin":"Erfassung"}</span></span><button class="btn small" data-act="logout">Abmelden</button></div></section>`; }
async function loadUsers(){ try{ const r=await RWE.users.list(); USERS=r.users||[]; USERS_ERR=""; }catch(e){ USERS_ERR=e.code==="offline"?"Die Benutzerliste braucht Netz.":"Benutzer konnten nicht geladen werden: "+(e.message||""); } if(view==="sd") render(); }
function usersSection(){
  if(!window.RWE||!RWE.isAdmin()) return "";
  if(USERS===null){ USERS=[]; loadUsers(); }
  return `<section class="card"><div class="sechead"><h2>Benutzer (${USERS.length})</h2><button class="btn small" data-act="u-reload">Aktualisieren</button></div>
   <p class="hint">Jede Person hat ein eigenes Konto. „Admin“ darf Stammdaten und Benutzer ändern, „Erfassung“ erfasst Wareneingänge und sieht Vorgänge.</p>
   ${USERS_ERR?`<div class="warnbox wbox">${esc(USERS_ERR)}</div>`:""}
   ${USERS.length?`<div class="tw"><table class="t"><thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Neues Passwort</th><th></th></tr></thead><tbody>
   ${USERS.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td><select id="u-role-${esc(u.id)}" style="min-width:130px">${["user","admin"].map(x=>`<option value="${x}" ${u.role===x?"selected":""}>${x==="admin"?"Admin":"Erfassung"}</option>`).join("")}</select></td>
     <td><input type="text" id="u-pw-${esc(u.id)}" placeholder="leer = unverändert" autocomplete="off" style="min-width:170px"></td><td><button class="btn small dark" data-act="u-save" data-id="${esc(u.id)}">Speichern</button></td></tr>`).join("")}
   </tbody></table></div>`:""}
   <h2 style="font-size:19px">Person anlegen</h2>
   <div class="form"><label class="f">Name<input type="text" id="nu-name" autocomplete="off"></label><label class="f">E-Mail<input type="email" id="nu-email" autocomplete="off"></label>
     <label class="f">Start-Passwort<span class="h">mindestens 8 Zeichen, der Person mitteilen</span><input type="text" id="nu-pw" autocomplete="off"></label>
     <label class="f">Rolle<select id="nu-role"><option value="user">Erfassung</option><option value="admin">Admin</option></select></label></div>
   <div><button class="btn small primary" data-act="u-new">Person anlegen</button></div></section>`;
}
async function userNew(){ const g=id=>$(id)?.value.trim()||""; const u={name:g("#nu-name"),email:g("#nu-email"),password:g("#nu-pw"),role:$("#nu-role").value};
  if(!u.name||!u.email||u.password.length<8){ toast("Name, E-Mail und Passwort mit mindestens 8 Zeichen eingeben"); return; }
  try{ await RWE.users.create(u); toast(u.name+" angelegt"); USERS=null; render(); }catch(e){ toast("Nicht angelegt: "+(e.message||"")); } }
async function userSave(id){ const role=$("#u-role-"+id).value, pw=$("#u-pw-"+id).value.trim();
  if(pw&&pw.length<8){ toast("Passwort mindestens 8 Zeichen"); return; }
  try{ await RWE.users.update({id,role,password:pw||undefined}); toast("Gespeichert"); USERS=null; render(); }catch(e){ toast("Nicht gespeichert: "+(e.message||"")); } }

/* ---------- Bilder ---------- */''')
r('  else if(a==="pdf-open"){', '''  else if(a==="logout"){ if(window.RWE) RWE.logout(); }
  else if(a==="u-reload"){ USERS=null; render(); }
  else if(a==="u-new"){ userNew(); }
  else if(a==="u-save"){ userSave(b.dataset.id); }
  else if(a==="pdf-open"){''')

# --- Kamera direkt (Android öffnet sonst nur die Dateiauswahl) ---
r(':`<label class="upl" for="f-ls"><b style="color:var(--ink)">Lieferschein fotografieren</b><span>Antippen, dann „Kamera“ oder ein vorhandenes Foto wählen</span><input type="file" id="f-ls" accept="image/*"></label>`}',
  ':`<div class="uplrow"><label class="upl" for="f-ls-cam"><b style="color:var(--ink)">Lieferschein fotografieren</b><span>Kamera öffnen</span><input type="file" id="f-ls-cam" accept="image/*" capture="environment"></label><label class="upl" for="f-ls"><b style="color:var(--ink)">Galerie</b><span>vorhandenes Foto</span><input type="file" id="f-ls" accept="image/*"></label></div>`}')
r('<label class="upl" for="f-fotos"><b style="color:var(--ink)">Foto aufnehmen</b><span>Antippen, dann „Kamera“ oder Fotos wählen, mehrere möglich</span><input type="file" id="f-fotos" accept="image/*" multiple></label>',
  '<div class="uplrow"><label class="upl" for="f-fotos-cam"><b style="color:var(--ink)">Foto aufnehmen</b><span>Kamera öffnen</span><input type="file" id="f-fotos-cam" accept="image/*" capture="environment"></label><label class="upl" for="f-fotos"><b style="color:var(--ink)">Galerie</b><span>mehrere möglich</span><input type="file" id="f-fotos" accept="image/*" multiple></label></div>')
r('else if(t.id==="f-ls" && t.files[0])', 'else if((t.id==="f-ls"||t.id==="f-ls-cam") && t.files[0])')
r('else if(t.id==="f-fotos" && t.files.length)', 'else if((t.id==="f-fotos"||t.id==="f-fotos-cam") && t.files.length)')
r('.upl input{display:none}', '.upl input{display:none}\n.uplrow{display:grid;gap:10px;grid-template-columns:2fr 1fr}')

for a, b in R:
    n = src.count(a)
    assert n == 1, (a[:80], n)
    src = src.replace(a, b)

assert "googleapis" not in src and "cdnjs" not in src, "noch externe Quellen"

head = """<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>Rettermayer WE</title>
<link rel="stylesheet" href="fonts/fonts.css">
<style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000;-webkit-tap-highlight-color:transparent}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style>
<script src="lib/JsBarcode.all.min.js"></script>
<script src="lib/jspdf.umd.min.js"></script>
</head>
<body>
"""
out = head + src.lstrip() + "\n</body>\n</html>\n"
(root / "src" / "index.html").write_text(out, encoding="utf-8")
print("src/index.html geschrieben,", len(out), "Zeichen")
