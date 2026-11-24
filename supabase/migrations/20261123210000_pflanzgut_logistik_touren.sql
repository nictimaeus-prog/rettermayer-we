-- Pflanzkartoffeln: Verpackung je Position (Big Bag à 11 dt, Sack 25 kg, lose), Lieferart und abweichende
-- Entladestelle je Kundenauftrag, Touren für die Speditionen (Roland, Röhle)
alter table public.pfg_auftragpos add column if not exists verpackung text not null default 'Big Bag'
  check (verpackung in ('Big Bag','Sack 25 kg','lose'));
alter table public.pfg_auftraege
  add column if not exists lieferart text not null default 'Anlieferung' check (lieferart in ('Anlieferung','Abholung ab Vermehrer')),
  add column if not exists entlade_abweichend boolean not null default false,
  add column if not exists entlade_name text,
  add column if not exists entlade_strasse text,
  add column if not exists entlade_plz text,
  add column if not exists entlade_ort text,
  add column if not exists entlade_hinweis text,
  add column if not exists tour_id uuid,
  add column if not exists tour_pos int;

alter table public.pfg_lieferanten drop constraint if exists pfg_lieferanten_typ_check;
alter table public.pfg_lieferanten add constraint pfg_lieferanten_typ_check check (typ in ('Vermehrer','VO','Züchter','Spedition'));
insert into public.pfg_lieferanten (name, typ) values ('Roland','Spedition'),('Röhle','Spedition') on conflict (name, typ) do nothing;

create sequence if not exists public.pfg_tour_nr start 1;
create table if not exists public.pfg_touren (
  id uuid primary key default gen_random_uuid(),
  nr text not null unique default ('T27-' || lpad(nextval('public.pfg_tour_nr')::text, 3, '0')),
  spedition text not null,
  datum date,
  lieferzeitraum text not null default 'Frühjahr' check (lieferzeitraum in ('Herbst','Frühjahr')),
  fahrzeug text,
  kapazitaet_dt numeric,
  status text not null default 'geplant' check (status in ('geplant','beauftragt','gefahren','storniert')),
  bemerkung text,
  bearbeiter text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pfg_auftraege drop constraint if exists pfg_auftraege_tour_fk;
alter table public.pfg_auftraege add constraint pfg_auftraege_tour_fk foreign key (tour_id) references public.pfg_touren(id) on delete set null;
create index if not exists pfg_auftraege_tour on public.pfg_auftraege(tour_id);

alter table public.pfg_touren enable row level security;
create policy "pfg_touren lesen" on public.pfg_touren for select to authenticated using (public.pfg_ok());
create policy "pfg_touren anlegen" on public.pfg_touren for insert to authenticated with check (public.pfg_ok());
create policy "pfg_touren aendern" on public.pfg_touren for update to authenticated using (public.pfg_ok()) with check (public.pfg_ok());
create policy "pfg_touren loeschen" on public.pfg_touren for delete to authenticated using (public.pfg_ok());
grant usage, select on sequence public.pfg_tour_nr to authenticated;

-- Big-Bag-Größe: Standard 11 dt (eigene Vermehrer/Gruppe), holländische Ware oft 12,5 dt
alter table public.pfg_sorten add column if not exists bb_dt numeric;
update public.pfg_sorten set bb_dt = 12.5 where name in ('Avanti','Colomba','Annabelle','Taurus','Emanuelle');
alter table public.pfg_auftragpos add column if not exists bb_dt numeric not null default 11 check (bb_dt > 0);
alter table public.pfg_bestellpos add column if not exists verpackung text not null default 'Big Bag' check (verpackung in ('Big Bag','Sack 25 kg','lose'));
alter table public.pfg_bestellpos add column if not exists bb_dt numeric not null default 11 check (bb_dt > 0);

-- Zukauf: Bezugsquelle je Sorte (meist Züchter, manchmal Händler), Lieferantenart Händler
alter table public.pfg_sorten add column if not exists bezugsquelle text;
alter table public.pfg_lieferanten drop constraint if exists pfg_lieferanten_typ_check;
alter table public.pfg_lieferanten add constraint pfg_lieferanten_typ_check check (typ in ('Vermehrer','VO','Züchter','Händler','Spedition'));
alter table public.pfg_bestellungen drop constraint if exists pfg_bestellungen_lieferant_typ_check;
alter table public.pfg_bestellungen add constraint pfg_bestellungen_lieferant_typ_check check (lieferant_typ in ('Vermehrer','VO','Züchter','Händler'));

-- Abholung: Abholstelle (Vermehrer) direkt am Kundenauftrag
alter table public.pfg_auftraege add column if not exists abholstelle text;

-- Auftragsbestätigung (ohne Preise): Liefertermin als Text, Hinweis, Anrede, Du-Form, Zeitpunkt der letzten AB
alter table public.pfg_auftraege
  add column if not exists liefertermin text,
  add column if not exists ab_text text,
  add column if not exists anrede_du boolean not null default false,
  add column if not exists anrede text,
  add column if not exists ab_am timestamptz;

-- Vermerk RHIZ: Rhizoctonia-Pustelbesatz unter 20 % nach Schweizer Modell (Standard: ja, je Position abwählbar)
alter table public.pfg_auftragpos add column if not exists rhiz boolean not null default true;
alter table public.pfg_bestellpos add column if not exists rhiz boolean not null default true;

-- Konkretes Lieferdatum („bis“) für Aufträge und Bestellungen: Standard Herbst 15.01., Frühjahr 15.03. der Saison
alter table public.pfg_auftraege add column if not exists lieferdatum date;
alter table public.pfg_bestellungen add column if not exists lieferdatum date;

-- VG-Anteil je Partie (Standard 50 %), Bonitur (Virus nur intern), Kundenklasse; Vorbelegung als Bestellung entfällt
alter table public.pfg_partien
  add column if not exists vg_pct numeric,
  add column if not exists rhiz_pct numeric,
  add column if not exists virus_pct numeric,
  add column if not exists hkg_kg numeric,
  add column if not exists maengel text;
alter table public.pfg_kunden add column if not exists klasse text check (klasse in ('A','B','C'));

-- Verteilung und Logistik: Koordinaten, Entfernungs-Cache, Ladestellen der Züchter, Frostschutz, Kürzung
alter table public.pfg_kunden add column if not exists lat double precision, add column if not exists lon double precision, add column if not exists geo_quelle text;
alter table public.pfg_lieferanten add column if not exists lat double precision, add column if not exists lon double precision, add column if not exists geo_quelle text;
create table if not exists public.pfg_distanz (von text not null, nach text not null, km numeric, min numeric, quelle text, updated_at timestamptz not null default now(), primary key (von, nach));
create table if not exists public.pfg_ladestellen (id uuid primary key default gen_random_uuid(), name text not null, zuechter text, strasse text, plz text, ort text, land text default 'DE',
  lat double precision, lon double precision, bemerkung text, created_at timestamptz not null default now(), unique (name, zuechter));
alter table public.pfg_bestellungen add column if not exists ladestelle text, add column if not exists frostschutz boolean not null default false;
alter table public.pfg_touren add column if not exists frostschutz boolean not null default false;
alter table public.pfg_auftragpos add column if not exists menge_bestellt numeric;
alter table public.pfg_auftraege add column if not exists entlade_lat double precision, add column if not exists entlade_lon double precision;
do $$
declare t text;
begin
  foreach t in array array['pfg_distanz','pfg_ladestellen'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s lesen" on public.%I for select to authenticated using (public.pfg_ok())', t, t);
    execute format('create policy "%s anlegen" on public.%I for insert to authenticated with check (public.pfg_ok())', t, t);
    execute format('create policy "%s aendern" on public.%I for update to authenticated using (public.pfg_ok()) with check (public.pfg_ok())', t, t);
    execute format('create policy "%s loeschen" on public.%I for delete to authenticated using (public.pfg_ok())', t, t);
  end loop;
end $$;
