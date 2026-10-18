// Vorlage: als src/config.js speichern und ausfüllen (nur für lokale Tests).
// Beim Cloud-Bau kommen die Werte aus den Umgebungsvariablen SUPABASE_URL und SUPABASE_ANON_KEY.
// Beide Werte stehen in Supabase unter Project Settings → API. Der "anon"-Schlüssel ist öffentlich,
// die Daten schützen die Zugriffsregeln in der Datenbank. Den "service_role"-Schlüssel NIE hier eintragen.
window.RWE_CONFIG = {
  supabaseUrl: "https://DEIN-PROJEKT.supabase.co",
  supabaseAnonKey: "DEIN-ANON-KEY",
};
