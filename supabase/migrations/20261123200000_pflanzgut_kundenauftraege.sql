-- Pflanzkartoffeln: Kundenaufträge (Verkauf an Erzeuger/Kunden aus büro+), Lieferzeitraum Herbst oder Frühjahr
create sequence if not exists public.pfg_auf_nr start 1;
create table if not exists public.pfg_auftraege (
  id uuid primary key default gen_random_uuid(),
  nr text not null unique default ('KA27-' || lpad(nextval('public.pfg_auf_nr')::text, 4, '0')),
  kdnr text,
  kunde text not null,
  datum date default current_date,
  lieferzeitraum text not null default 'Frühjahr' check (lieferzeitraum in ('Herbst','Frühjahr')),
  status text not null default 'offen' check (status in ('Entwurf','offen','bestätigt','geliefert','storniert')),
  bemerkung text,
  quelle text,
  created_by uuid default auth.uid(),
  bearbeiter text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.pfg_auftragpos (
  id uuid primary key default gen_random_uuid(),
  auftrag_id uuid not null references public.pfg_auftraege(id) on delete cascade,
  sorte text not null,
  sortierung text not null default 'NS' check (sortierung in ('Drill','NS','ÜG')),
  menge_dt numeric not null check (menge_dt >= 0),
  bemerkung text,
  pos int
);
create table if not exists public.pfg_auftrag_zuordnung (
  id uuid primary key default gen_random_uuid(),
  pos_id uuid not null references public.pfg_auftragpos(id) on delete cascade,
  partie_id uuid not null references public.pfg_partien(id) on delete restrict,
  menge_dt numeric not null check (menge_dt > 0),
  unique (pos_id, partie_id)
);
create index if not exists pfg_auftraege_kdnr on public.pfg_auftraege(kdnr);
create index if not exists pfg_auftragpos_auftrag on public.pfg_auftragpos(auftrag_id);
create index if not exists pfg_auftrag_zuordnung_pos on public.pfg_auftrag_zuordnung(pos_id);
create index if not exists pfg_auftrag_zuordnung_partie on public.pfg_auftrag_zuordnung(partie_id);

do $$
declare t text;
begin
  foreach t in array array['pfg_auftraege','pfg_auftragpos','pfg_auftrag_zuordnung'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s lesen" on public.%I for select to authenticated using (public.pfg_ok())', t, t);
    execute format('create policy "%s anlegen" on public.%I for insert to authenticated with check (public.pfg_ok())', t, t);
    execute format('create policy "%s aendern" on public.%I for update to authenticated using (public.pfg_ok()) with check (public.pfg_ok())', t, t);
    execute format('create policy "%s loeschen" on public.%I for delete to authenticated using (public.pfg_ok())', t, t);
  end loop;
end $$;
grant usage, select on sequence public.pfg_auf_nr to authenticated;

-- Lieferzeiträume gibt es nur zwei: Herbst (Dezember bis Mitte Januar) und Frühjahr (März/April)
update public.pfg_bestellungen set liefertermin = 'Frühjahr' where liefertermin = 'Frühjahr 2027';
