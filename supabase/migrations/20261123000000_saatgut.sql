-- Gemüse-Saatgut FJ27: Bestell- und AB-Tool (Unterseite /saatgut). Eigene Tabellen, berührt die WE-App nicht.
-- Bereits am 23.11.2026 im Projekt rettermayer-we angewendet.
create table if not exists public.saatgut_zugang (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.saatgut_zugang enable row level security;

create or replace function public.saatgut_ok()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.saatgut_zugang z join public.profiles p on p.id = z.user_id
    where z.user_id = auth.uid() and p.freigegeben
  );
$$;
revoke all on function public.saatgut_ok() from public;
grant execute on function public.saatgut_ok() to authenticated;

create policy "saatgut_zugang lesen" on public.saatgut_zugang for select to authenticated
  using (user_id = auth.uid() or public.saatgut_ok());
create policy "saatgut_zugang admin" on public.saatgut_zugang for all to authenticated
  using (public.saatgut_ok() and public.is_admin()) with check (public.saatgut_ok() and public.is_admin());

create table if not exists public.saatgut_stamm (
  id text primary key,
  data jsonb not null,
  stand text,
  updated_at timestamptz not null default now()
);
alter table public.saatgut_stamm enable row level security;
create policy "saatgut_stamm lesen" on public.saatgut_stamm for select to authenticated using (public.saatgut_ok());
create policy "saatgut_stamm schreiben" on public.saatgut_stamm for all to authenticated using (public.saatgut_ok()) with check (public.saatgut_ok());

create table if not exists public.saatgut_auftraege (
  abnr text primary key,
  erzeuger text,
  kd text,
  gesamt numeric,
  data jsonb not null,
  created_by uuid default auth.uid(),
  bearbeiter text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.saatgut_auftraege enable row level security;
create policy "saatgut_auftraege lesen" on public.saatgut_auftraege for select to authenticated using (public.saatgut_ok());
create policy "saatgut_auftraege anlegen" on public.saatgut_auftraege for insert to authenticated with check (public.saatgut_ok());
create policy "saatgut_auftraege aendern" on public.saatgut_auftraege for update to authenticated using (public.saatgut_ok()) with check (public.saatgut_ok());
create policy "saatgut_auftraege loeschen" on public.saatgut_auftraege for delete to authenticated using (public.saatgut_ok());

-- Zugang zunächst nur Nicolai Timaeus und Martin Haunz (weitere: insert into public.saatgut_zugang (user_id) values ('<uuid>');)
insert into public.saatgut_zugang (user_id)
select id from public.profiles where name in ('Nicolai Timaeus', 'Martin Haunz')
on conflict do nothing;
