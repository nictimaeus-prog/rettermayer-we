# Rettermayer WE – Einrichtung der Handy-App

Stand: 18.10.2026 · App-Name „Rettermayer WE“ · Kennung `de.biovg.rettermayerwe`

## Überblick

Die App läuft auf iPhone und Android und kann auch offline erfassen. Was ohne Netz angelegt wird, sendet sie automatisch nach, sobald wieder Netz da ist.

| Baustein | Wofür | Kosten (Stand Okt. 2026, bitte prüfen) |
|---|---|---|
| **Supabase** (Rechenzentrum Frankfurt) | Datenbank, Anmeldung, Ablage der Protokoll-PDFs, Mailversand | kostenloser Einstieg, ab Bedarf Pro-Tarif ca. 25 $/Monat |
| **Codemagic** | baut die Apps in der Cloud, kein Mac nötig | kostenloses Kontingent für den Anfang |
| **Apple Developer Program** | iPhone-App über TestFlight verteilen | ca. 99 € pro Jahr |
| **GitHub** | Ablage des App-Codes, von dort baut Codemagic | kostenlos (privates Projekt) |
| Anthropic-API *(optional)* | Lieferschein-Foto automatisch auslesen | Abrechnung nach Nutzung, wenige Cent je Lieferschein |

Android braucht kein Store-Konto, die App wird als Installationsdatei (APK) verteilt.

**Reihenfolge:** Schritt 1 sofort starten, weil die Apple-Prüfung dauert. Die Schritte 2 bis 6 laufen parallel dazu.

---

## Schritt 1 – Apple-Entwicklerkonto beantragen (dauert Tage bis Wochen)

1. Für die VG Bio eine **D-U-N-S-Nummer** prüfen oder beantragen (kostenlos über Apple: developer.apple.com/enroll/duns-lookup).
2. Unter developer.apple.com/programs/enroll als **Organisation** anmelden, mit einer Apple-ID mit Firmen-E-Mail, z. B. nicolai.timaeus@bio-vg.de.
3. Nach der Freischaltung weiter mit Schritt 7.

## Schritt 2 – Supabase-Projekt anlegen

1. Auf supabase.com ein Konto anlegen und eine Organisation „VG Bio Bauern“ erstellen.
2. **New project:** Name `rettermayer-we`, Region **Central EU (Frankfurt)**, ein sicheres Datenbank-Passwort vergeben und notieren.
3. Unter **Authentication → Sign In / Providers** die Option **„Allow new users to sign up“ ausschalten**. Konten legt nur der Admin an.

## Schritt 3 – Datenbank einrichten

1. **SQL Editor → New query:** den Inhalt von `supabase/migrations/20261018000000_init.sql` einfügen und **Run** klicken.
2. **Authentication → Users → Add user → Create new user:** deine E-Mail und ein Passwort eintragen, **Auto Confirm User** anhaken.
3. **SQL Editor → New query:** den Inhalt von `supabase/seed.sql` einfügen. In der letzten Zeile die E-Mail prüfen, dann **Run**.
   Damit sind die 18 Erzeuger, die 4 Pflanzgut-Lieferanten und die Grundeinstellungen angelegt, und du bist Admin.

## Schritt 4 – Server-Funktionen anlegen

Für jede der drei Dateien unter **Edge Functions → Deploy a new function → Via Editor**:

| Name der Funktion (genau so) | Datei |
|---|---|
| `send-mail` | `supabase/functions/send-mail/index.ts` |
| `read-ls` | `supabase/functions/read-ls/index.ts` |
| `users` | `supabase/functions/users/index.ts` |

Jeweils den Inhalt einfügen, „Verify JWT“ bzw. „Enforce JWT verification“ eingeschaltet lassen und **Deploy** klicken.

## Schritt 5 – Mailversand einrichten (vorerst über nic.timaeus@gmail.com)

1. Im Google-Konto nic.timaeus@gmail.com die **Bestätigung in zwei Schritten** einschalten, falls noch nicht aktiv.
2. Unter myaccount.google.com/apppasswords ein **App-Passwort** „Rettermayer WE“ erzeugen. Das ist ein 16-stelliger Code.
3. In Supabase unter **Edge Functions → Secrets** eintragen:

| Name | Wert |
|---|---|
| `SMTP_USER` | `nic.timaeus@gmail.com` |
| `SMTP_PASS` | das App-Passwort |
| `MAIL_FROM_NAME` | `Rettermayer WE` |
| `ANTHROPIC_API_KEY` *(optional)* | Schlüssel von console.anthropic.com, nur für das automatische Lieferschein-Lesen |

**Später auf rettermayer@bio-vg.de umstellen:** Wenn geklärt ist, wer die Domain bio-vg.de verwaltet, dort ein Postfach rettermayer@bio-vg.de mit SMTP-Zugang einrichten lassen. Danach nur diese Secrets ändern: `SMTP_USER`, `SMTP_PASS`, `SMTP_HOST` (Mailserver des Anbieters) und gegebenenfalls `SMTP_PORT` (465). Supabase lässt Port 587 nicht zu. An der App ändert sich nichts.

## Schritt 6 – Code zu GitHub und Codemagic

1. Auf github.com ein **privates** Projekt `rettermayer-we` anlegen und den Inhalt dieses Pakets hochladen. Das übernehme ich gern, wenn GitHub mit Claude verbunden ist.
2. Auf codemagic.io mit GitHub anmelden, **Add application**, das Projekt `rettermayer-we` wählen. Die Datei `codemagic.yaml` wird erkannt.
3. In Codemagic unter **Environment variables** eine Gruppe **`supabase`** anlegen:
   - `SUPABASE_URL`: in Supabase unter Project Settings → API (Project URL)
   - `SUPABASE_ANON_KEY`: in Supabase unter Project Settings → API Keys (anon bzw. publishable key, **nicht** service_role/secret)
4. **Team settings → Code signing identities → Android keystores → Add keystore:** die Datei `rettermayer-release.jks` hochladen, Referenzname **`rettermayer_keystore`**, Passwörter und Alias aus `Android-Schluessel.txt`.
5. Workflow **„Android – Installationsdatei (APK)“** starten. Nach etwa 10 bis 15 Minuten kommt eine E-Mail mit dem Download-Link der APK.

## Schritt 7 – iPhone über TestFlight (nach Freischaltung des Apple-Kontos)

1. In **App Store Connect → Apps → +** eine neue App anlegen: Name „Rettermayer WE“, Bundle-ID **`de.biovg.rettermayerwe`**. Die Bundle-ID vorher unter developer.apple.com → Identifiers anlegen.
2. **App Store Connect → Benutzer und Zugriff → Integrationen → App Store Connect API:** einen Schlüssel mit Rolle **App Manager** erzeugen und die `.p8`-Datei herunterladen.
3. In Codemagic unter **Team settings → Integrations → Developer Portal** den Schlüssel unter dem Namen **`Rettermayer ASC`** hinterlegen.
4. **Team settings → Code signing identities:** unter iOS certificates „Generate certificate“ wählen (Typ Apple Distribution), unter iOS provisioning profiles „Fetch profiles“ (App Store, `de.biovg.rettermayerwe`).
5. Workflow **„iPhone – TestFlight“** starten. Der Build landet automatisch in TestFlight.
6. **Tester einladen:** In App Store Connect unter TestFlight die Kolleginnen und Kollegen als interne Tester hinzufügen, bis zu 100 Personen. Sie müssen dafür als Benutzer in App Store Connect angelegt sein. Danach installieren sie die App „TestFlight“ aus dem App Store und nehmen die Einladung an.
   Alternative ohne App-Store-Connect-Benutzer: externe Tester über einen öffentlichen Link. Apple prüft dafür einmalig kurz, und jeder Build läuft nach 90 Tagen ab. Dann einfach neu bauen.

## Schritt 8 – App installieren und Team anlegen

- **Android:** Den APK-Link aus der Codemagic-Mail am Handy öffnen, herunterladen und „Installation aus dieser Quelle erlauben“ bestätigen. Bei einer neuen Version die neue APK einfach drüber installieren, die Daten bleiben erhalten.
- **iPhone:** Über TestFlight installieren.
- **Erste Anmeldung** mit deinem Admin-Konto. Unter **Stammdaten → Benutzer** legst du für jede Person ein Konto an (Name, E-Mail, Start-Passwort, Rolle „Erfassung“ oder „Admin“) und gibst die Zugangsdaten weiter.
- Für die erste Anmeldung braucht das Handy Netz. Danach geht die Erfassung auch offline.

---

## Gut zu wissen

- **Offline:** Wareneingänge, Kisten, Bonituren, Fotos und Protokoll-PDFs werden auf dem Handy gespeichert. Oben rechts steht dann „offline · 3 wartet“. Sobald Netz da ist, wird alles nachgesendet.
- **Chargen bei Offline-Erfassung:** Erfassen zwei Handys offline gleichzeitig für denselben Erzeuger, vergibt der Server beim Hochladen automatisch die nächste freie Nummer. Die App meldet das mit „Charge … war schon vergeben, bitte Etiketten neu drucken“.
- **Rechte:** „Erfassung“ darf Wareneingänge anlegen, Vorgänge und Auswertung sehen. „Admin“ darf zusätzlich Stammdaten, Verteiler und Benutzer ändern.
- **Protokoll:** Es ist im VG-Bio-Design mit beiden Logos gestaltet und elektronisch erstellt, deshalb ohne Unterschrift gültig.
- **büro+:** Der CSV-Export unter „Vorgänge“ funktioniert wie bisher.
- **Passwort vergessen:** Der Admin setzt es unter Stammdaten → Benutzer neu.
- **Neue App-Version:** Code in GitHub ändern und den Workflow in Codemagic neu starten. Die Versionsnummer zählt automatisch hoch.

## Inhalt des Pakets

```
ANLEITUNG.md              diese Anleitung
codemagic.yaml            Cloud-Bau Android + iPhone
capacitor.config.json     App-Kennung und Name
src/index.html            die App (aus der Web-App erzeugt, mit Logos, Auswertung usw.)
src/rwe-runtime.js        Anbindung an Supabase, Offline-Speicher, Anmeldung
scripts/build.mjs         stellt die App-Dateien zusammen (Bibliotheken und Schriften lokal)
tools/make_src.py         erzeugt src/index.html aus der Web-App-Fassung
supabase/migrations/…sql  Datenbank, Rechte, Charge-Vergabe
supabase/seed.sql         Erzeuger, Lieferanten, Grundeinstellungen, Admin
supabase/functions/…      send-mail, read-ls, users
android/, ios/            fertige Android- und iPhone-Projekte (Symbole, Kamera-Berechtigungen)
assets/                   App-Symbol und Startbild
```
