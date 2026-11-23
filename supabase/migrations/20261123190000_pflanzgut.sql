-- Pflanzkartoffeln: Partien-Erfassung, Bestellungen bei Züchtern/Vermehrern/VO-Firmen, Zuordnung auf Partien
-- Unterseite /pflanzgut (nur Browser). Eigene Tabellen (Präfix pfg_), berührt die WE-App nicht.
create table if not exists public.pfg_zugang (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.pfg_zugang enable row level security;

create or replace function public.pfg_ok()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.pfg_zugang z join public.profiles p on p.id = z.user_id
    where z.user_id = auth.uid() and p.freigegeben
  );
$$;
revoke all on function public.pfg_ok() from public;
grant execute on function public.pfg_ok() to authenticated;

create policy "pfg_zugang lesen" on public.pfg_zugang for select to authenticated using (user_id = auth.uid() or public.pfg_ok());
create policy "pfg_zugang admin" on public.pfg_zugang for all to authenticated
  using (public.pfg_ok() and public.is_admin()) with check (public.pfg_ok() and public.is_admin());

-- Sortenkatalog
create table if not exists public.pfg_sorten (
  name text primary key,
  kochtyp text, reife text, zuechter text,
  bio boolean not null default true, konv boolean not null default false,
  ghp numeric, aktiv boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
-- Lieferanten: Züchter, Vermehrer, VO-Firmen
create table if not exists public.pfg_lieferanten (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  typ text not null check (typ in ('Vermehrer','VO','Züchter')),
  vo text, kdnr text, email text, telefon text, adresse text, bemerkung text,
  updated_at timestamptz not null default now(),
  unique (name, typ)
);
-- Kunden (Import aus büro+)
create table if not exists public.pfg_kunden (
  kdnr text primary key,
  name text not null,
  email text, strasse text, plz text, ort text, ortsteil text, telefon text, mobil text,
  gemuese boolean, kategorie text,
  data jsonb not null default '{}'::jsonb,
  quelle text,
  updated_at timestamptz not null default now()
);
-- Vermehrungspartien
create table if not exists public.pfg_partien (
  id uuid primary key default gen_random_uuid(),
  jahr int not null default 2026,
  anerk_nr text,
  vermehrer text not null,
  vo text,
  sorte text not null,
  kat text,
  ha numeric,
  drill numeric, ns numeric, ueg numeric,
  sort_ns text,
  status text,
  bemerkung text,
  quelle text,
  updated_at timestamptz not null default now(),
  unique (jahr, anerk_nr)
);
-- Bestellungen (Einkauf) und Positionen
create sequence if not exists public.pfg_best_nr start 1;
create table if not exists public.pfg_bestellungen (
  id uuid primary key default gen_random_uuid(),
  nr text not null unique default ('PB27-' || lpad(nextval('public.pfg_best_nr')::text, 4, '0')),
  lieferant text not null,
  lieferant_typ text not null check (lieferant_typ in ('Vermehrer','VO','Züchter')),
  vo text,
  datum date not null default current_date,
  liefertermin text,
  status text not null default 'offen' check (status in ('Entwurf','offen','bestätigt','geliefert','storniert')),
  bemerkung text,
  quelle text,
  created_by uuid default auth.uid(),
  bearbeiter text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.pfg_bestellpos (
  id uuid primary key default gen_random_uuid(),
  bestellung_id uuid not null references public.pfg_bestellungen(id) on delete cascade,
  sorte text not null,
  sortierung text not null default 'NS' check (sortierung in ('Drill','NS','ÜG')),
  menge_dt numeric not null check (menge_dt >= 0),
  bemerkung text,
  pos int not null default 1
);
-- Zuordnung einer Position auf eine oder mehrere Partien (sofort oder später)
create table if not exists public.pfg_zuordnung (
  id uuid primary key default gen_random_uuid(),
  pos_id uuid not null references public.pfg_bestellpos(id) on delete cascade,
  partie_id uuid not null references public.pfg_partien(id) on delete restrict,
  menge_dt numeric not null check (menge_dt > 0),
  created_at timestamptz not null default now(),
  unique (pos_id, partie_id)
);
create index if not exists pfg_bestellpos_best on public.pfg_bestellpos(bestellung_id);
create index if not exists pfg_zuordnung_pos on public.pfg_zuordnung(pos_id);
create index if not exists pfg_zuordnung_partie on public.pfg_zuordnung(partie_id);

do $$ declare t text; begin
  foreach t in array array['pfg_sorten','pfg_lieferanten','pfg_kunden','pfg_partien','pfg_bestellungen','pfg_bestellpos','pfg_zuordnung'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s lesen" on public.%I for select to authenticated using (public.pfg_ok())', t, t);
    execute format('create policy "%s anlegen" on public.%I for insert to authenticated with check (public.pfg_ok())', t, t);
    execute format('create policy "%s aendern" on public.%I for update to authenticated using (public.pfg_ok()) with check (public.pfg_ok())', t, t);
    execute format('create policy "%s loeschen" on public.%I for delete to authenticated using (public.pfg_ok())', t, t);
  end loop;
end $$;
grant usage, select on sequence public.pfg_best_nr to authenticated;

-- Zugang zunächst Nicolai Timaeus, Martin Haunz, Anna Wegner
insert into public.pfg_zugang (user_id)
select id from public.profiles where name in ('Nicolai Timaeus', 'Martin Haunz', 'Anna Wegner')
on conflict do nothing;

-- Nur angemeldete Nutzer dürfen die Zugangsprüfung aufrufen
revoke execute on function public.pfg_ok() from public, anon;
grant execute on function public.pfg_ok() to authenticated;
