-- Rettermayer WE – Datenbank
-- Einmal im Supabase-Projekt ausführen (SQL Editor → New query → einfügen → Run)
-- oder mit der Supabase-CLI: supabase db push

-------------------------------------------------------------------------------
-- Personen und Rollen
-------------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null default '',
  role       text not null default 'user' check (role in ('user', 'admin')),
  -- nur vom Admin (bzw. der Funktion "users") angelegte Konten sind freigegeben.
  -- Selbst registrierte Konten sehen nichts, auch wenn die Registrierung offen ist.
  freigegeben boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and freigegeben);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and freigegeben and role = 'admin');
$$;

-- neues Konto → Profil anlegen (Name aus den Anmeldedaten, sonst Teil vor dem @)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- app_metadata kann nur der Server (Service-Schlüssel) setzen, nie die Person selbst
  insert into public.profiles (id, name, role, freigegeben)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
          case when new.raw_app_meta_data->>'role' = 'admin' then 'admin' else 'user' end,
          coalesce(new.raw_app_meta_data->>'freigegeben', '') = 'true')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

drop policy if exists "profiles lesen" on public.profiles;
create policy "profiles lesen" on public.profiles for select to authenticated using (id = auth.uid() or public.is_member());
drop policy if exists "profiles admin" on public.profiles;
create policy "profiles admin" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

-------------------------------------------------------------------------------
-- Dokumente der App (Sammlung + ID + JSON), wie bisher in der Web-App
--   erzeuger, lieferanten, config          → nur Admins schreiben
--   wareneingaenge, entwuerfe, zaehler     → alle Angemeldeten schreiben
-------------------------------------------------------------------------------
create table if not exists public.docs (
  collection text not null,
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (collection, id)
);
alter table public.docs replica identity full;
alter table public.docs enable row level security;
create index if not exists docs_we_charge on public.docs ((data->>'charge')) where collection = 'wareneingaenge';

create or replace function public.can_write(c text)
returns boolean language sql stable as $$
  select case when c in ('erzeuger', 'lieferanten', 'config') then public.is_admin() else public.is_member() end;
$$;

drop policy if exists "docs lesen" on public.docs;
create policy "docs lesen" on public.docs for select to authenticated using (public.is_member());
drop policy if exists "docs anlegen" on public.docs;
create policy "docs anlegen" on public.docs for insert to authenticated with check (public.can_write(collection));
drop policy if exists "docs aendern" on public.docs;
create policy "docs aendern" on public.docs for update to authenticated using (public.can_write(collection)) with check (public.can_write(collection));
drop policy if exists "docs loeschen" on public.docs;
create policy "docs loeschen" on public.docs for delete to authenticated using (
  case when collection = 'wareneingaenge' then public.is_admin() else public.can_write(collection) end
);

-- Teil-Update (wie "update" in der App): Felder zusammenführen
create or replace function public.doc_merge(p_collection text, p_id text, p_patch jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare r jsonb;
begin
  update public.docs set data = data || p_patch, updated_at = now(), updated_by = auth.uid()
   where collection = p_collection and id = p_id
  returning data into r;
  return r;  -- null, wenn das Dokument nicht (mehr) existiert
end $$;

-------------------------------------------------------------------------------
-- Charge eindeutig halten (wichtig bei Offline-Erfassung auf mehreren Handys)
-- Charge = "<Kürzel> <Nr> <Produkt>", Zählung je Kürzel, Produkt und Saison.
-- Ist die Nummer beim Hochladen schon vergeben, bekommt der Wareneingang die nächste freie.
-------------------------------------------------------------------------------
create or replace function public.we_charge_unique()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_charge text := new.data->>'charge';
  v_saison text := coalesce(new.data->>'saison', '');
  v_code   text := new.data->>'code';
  v_prod   text := new.data->>'produkt';
  v_n      int;
  v_new    text;
  v_sj     text := left(coalesce(new.data->>'saison', ''), 4);
begin
  if new.collection <> 'wareneingaenge' or v_charge is null or v_code is null or v_prod is null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('charge:' || v_code || ':' || v_prod || ':' || v_saison));
  if exists (select 1 from public.docs
              where collection = 'wareneingaenge' and id <> new.id
                and data->>'charge' = v_charge and coalesce(data->>'saison', '') = v_saison) then
    select coalesce(max(nullif(regexp_replace(split_part(data->>'charge', ' ', 2), '\D', '', 'g'), '')::int), 0) + 1
      into v_n
      from public.docs
     where collection = 'wareneingaenge' and data->>'code' = v_code and data->>'produkt' = v_prod
       and coalesce(data->>'saison', '') = v_saison;
    v_new := v_code || ' ' || lpad(v_n::text, 2, '0') || ' ' || v_prod;
    new.data := new.data || jsonb_build_object(
      'charge', v_new,
      'chargeUrspruenglich', v_charge,
      'barcode', upper(regexp_replace(v_new, '[^A-Za-z0-9]', '', 'g')));
    v_charge := v_new;
  end if;
  -- Zähler mitziehen, damit alle Handys die nächste Nummer richtig vorschlagen
  v_n := nullif(regexp_replace(split_part(v_charge, ' ', 2), '\D', '', 'g'), '')::int;
  if v_n is not null and v_sj <> '' then
    insert into public.docs (collection, id, data)
    values ('zaehler', v_code || '_' || v_prod || '_' || v_sj,
            jsonb_build_object('n', v_n, 'code', v_code, 'produkt', v_prod, 'saison', v_sj::int))
    on conflict (collection, id) do update
      set data = public.docs.data || jsonb_build_object('n', greatest(coalesce((public.docs.data->>'n')::int, 0), v_n)),
          updated_at = now();
  end if;
  return new;
end $$;
drop trigger if exists we_charge_unique on public.docs;
create trigger we_charge_unique before insert on public.docs
  for each row when (new.collection = 'wareneingaenge') execute function public.we_charge_unique();

-- Zähler nie rückwärts setzen (ein Handy mit altem Stand darf ihn nicht verkleinern)
create or replace function public.zaehler_max()
returns trigger language plpgsql as $$
begin
  if new.collection = 'zaehler' and old.data ? 'n' and new.data ? 'n'
     and (new.data->>'n')::int < (old.data->>'n')::int then
    new.data := new.data || jsonb_build_object('n', (old.data->>'n')::int);
  end if;
  return new;
end $$;
drop trigger if exists zaehler_max on public.docs;
create trigger zaehler_max before update on public.docs
  for each row when (new.collection = 'zaehler') execute function public.zaehler_max();

-------------------------------------------------------------------------------
-- Live-Abgleich zwischen den Handys
-------------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-------------------------------------------------------------------------------
-- Dateiablage (Protokoll-PDFs, Logo)
-------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 20971520)
on conflict (id) do nothing;

drop policy if exists "files lesen" on storage.objects;
create policy "files lesen" on storage.objects for select to authenticated using (bucket_id = 'files' and public.is_member());
drop policy if exists "files hochladen" on storage.objects;
create policy "files hochladen" on storage.objects for insert to authenticated with check (bucket_id = 'files' and public.is_member());
drop policy if exists "files ersetzen" on storage.objects;
create policy "files ersetzen" on storage.objects for update to authenticated using (bucket_id = 'files' and public.is_member()) with check (bucket_id = 'files' and public.is_member());
drop policy if exists "files loeschen" on storage.objects;
create policy "files loeschen" on storage.objects for delete to authenticated using (bucket_id = 'files' and public.is_admin());
