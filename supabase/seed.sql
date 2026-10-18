-- Rettermayer WE – Startdaten (Erzeuger, Pflanzgut-Lieferanten, Grundeinstellungen)
-- Nach der Datenbank-Einrichtung (migrations/…_init.sql) im SQL Editor ausführen.
-- Bereits vorhandene Einträge bleiben unverändert.
insert into public.docs (collection, id, data) values
  ('erzeuger', 'e-bac', '{"buero": "", "code": "BAC", "email": "", "hinweis": "", "name": "Bachner", "oeko": "", "ort": "", "verbaende": ["Bioland"]}'::jsonb),
  ('erzeuger', 'e-bau', '{"buero": "", "code": "BAU", "email": "", "hinweis": "", "name": "Baumann", "oeko": "", "ort": "", "verbaende": ["Bioland"]}'::jsonb),
  ('erzeuger', 'e-end', '{"buero": "", "code": "END", "email": "", "hinweis": "", "name": "Endres", "oeko": "", "ort": "", "verbaende": ["Bioland"]}'::jsonb),
  ('erzeuger', 'e-fra', '{"buero": "", "code": "FRA", "email": "", "hinweis": "", "name": "Franz", "oeko": "", "ort": "", "verbaende": ["Bioland"]}'::jsonb),
  ('erzeuger', 'e-gae', '{"buero": "", "code": "GAE", "email": "", "hinweis": "", "name": "Gärtner", "oeko": "", "ort": "", "verbaende": ["Bioland"]}'::jsonb),
  ('erzeuger', 'e-kie', '{"buero": "", "code": "KIE", "email": "", "hinweis": "", "name": "Kießling", "oeko": "", "ort": "", "verbaende": ["Bioland"]}'::jsonb),
  ('erzeuger', 'e-kir', '{"buero": "", "code": "KIR", "email": "", "hinweis": "", "name": "Kirner", "oeko": "", "ort": "", "verbaende": ["Bioland"]}'::jsonb),
  ('erzeuger', 'e-koe', '{"buero": "", "code": "KOE", "email": "", "hinweis": "Köhlers Gmüs", "name": "Köhler", "oeko": "", "ort": "", "verbaende": ["Bioland"]}'::jsonb),
  ('erzeuger', 'e-koh', '{"buero": "", "code": "KOH", "email": "", "hinweis": "", "name": "Kohnle", "oeko": "", "ort": "", "verbaende": ["Bioland"]}'::jsonb),
  ('erzeuger', 'e-kra', '{"buero": "", "code": "KRA", "email": "", "hinweis": "", "name": "Kraus", "oeko": "", "ort": "", "verbaende": ["Bioland"]}'::jsonb),
  ('erzeuger', 'e-kue', '{"buero": "", "code": "KUE", "email": "", "hinweis": "", "name": "Kühner", "oeko": "", "ort": "", "verbaende": ["Bioland"]}'::jsonb),
  ('erzeuger', 'e-lei', '{"buero": "", "code": "LEI", "email": "", "hinweis": "", "name": "Leidenberger", "oeko": "", "ort": "", "verbaende": ["Bioland"]}'::jsonb),
  ('erzeuger', 'e-lie', '{"buero": "", "code": "LIE", "email": "", "hinweis": "", "name": "Liebhard", "oeko": "", "ort": "", "verbaende": ["Bioland"]}'::jsonb),
  ('erzeuger', 'e-pre', '{"buero": "", "code": "PRE", "email": "", "hinweis": "über Köhlers Gmüs", "name": "Preising", "oeko": "", "ort": "", "verbaende": ["Bioland"]}'::jsonb),
  ('erzeuger', 'e-ret', '{"buero": "", "code": "RET", "email": "", "hinweis": "", "name": "Rettermayer", "oeko": "", "ort": "", "verbaende": ["Bioland"]}'::jsonb),
  ('erzeuger', 'e-sti', '{"buero": "", "code": "STI", "email": "", "hinweis": "", "name": "Stier", "oeko": "", "ort": "", "verbaende": ["Bioland"]}'::jsonb),
  ('erzeuger', 'e-zau', '{"buero": "", "code": "ZAU", "email": "", "hinweis": "", "name": "Zauner", "oeko": "", "ort": "", "verbaende": ["Bioland"]}'::jsonb),
  ('erzeuger', 'e-zin', '{"buero": "", "code": "ZIN", "email": "", "hinweis": "", "name": "Zink", "oeko": "", "ort": "", "verbaende": ["Bioland"]}'::jsonb),
  ('lieferanten', 'l-ail', '{"buero": "", "code": "AIL", "email": "", "hinweis": "", "land": "", "name": "Ail Dromoir"}'::jsonb),
  ('lieferanten', 'l-pan', '{"buero": "", "code": "PAN", "email": "", "hinweis": "", "land": "", "name": "Pantiru"}'::jsonb),
  ('lieferanten', 'l-plp', '{"buero": "", "code": "PLP", "email": "", "hinweis": "", "land": "", "name": "Plants Pro"}'::jsonb),
  ('lieferanten', 'l-rai', '{"buero": "", "code": "RAI", "email": "", "hinweis": "", "land": "", "name": "Rainbow Harvest"}'::jsonb),
  ('config', 'allgemein', '{"verteiler": ["nicolai.timaeus@bio-vg.de"], "erzMail": false, "kurz": "Biohof Rettermayer", "firma": "Vermarktungsgesellschaft Bio-Bauern mbH · Betrieb Biohof Rettermayer", "anschrift": "", "kontakt": "", "logoId": "", "disclaimer": "Hinweis: Die Wareneingangskontrolle erfolgt stichprobenartig. Dieses Protokoll gibt ausschließlich den Befund der geprüften Stichprobe wieder und stellt keine Abnahme oder Bestätigung der Beschaffenheit der gesamten Lieferung dar. Mängel, die erst bei der weiteren Verarbeitung erkennbar werden, bleiben vorbehalten."}'::jsonb)
on conflict (collection, id) do nothing;

-- Ersten Admin festlegen: vorher unter Authentication → Users → "Add user" das Konto anlegen
-- (E-Mail + Passwort, "Auto Confirm User" anhaken), dann E-Mail unten anpassen und ausführen:
update public.profiles set role = 'admin', name = 'Nicolai Timaeus'
 where id = (select id from auth.users where email = 'nicolai.timaeus@bio-vg.de');
