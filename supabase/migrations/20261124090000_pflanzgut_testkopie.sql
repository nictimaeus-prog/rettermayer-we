-- Testkopie Pflanzgut: gleiche Tabellen mit Präfix pfgt_, App mit ?test=1
do $$
declare t text;
begin
  foreach t in array array['sorten','lieferanten','kunden','partien','ladestellen','distanz','touren','auftraege','auftragpos','auftrag_zuordnung','bestellungen','bestellpos','zuordnung'] loop
    execute format('create table if not exists public.pfgt_%s (like public.pfg_%s including all)', t, t);
    execute format('alter table public.pfgt_%s enable row level security', t);
    execute format('revoke all on public.pfgt_%s from anon', t);
    execute format('grant select, insert, update, delete on public.pfgt_%s to authenticated', t);
    execute format('drop policy if exists "pfgt_%s alles" on public.pfgt_%s', t, t);
    execute format('create policy "pfgt_%s alles" on public.pfgt_%s for all to authenticated using (pfg_ok()) with check (pfg_ok())', t, t);
  end loop;
end $$;

alter table pfgt_bestellpos add constraint pfgt_bestellpos_best_fk foreign key (bestellung_id) references pfgt_bestellungen(id) on delete cascade;
alter table pfgt_zuordnung add constraint pfgt_zuordnung_pos_fk foreign key (pos_id) references pfgt_bestellpos(id) on delete cascade;
alter table pfgt_zuordnung add constraint pfgt_zuordnung_partie_fk foreign key (partie_id) references pfgt_partien(id) on delete restrict;
alter table pfgt_auftragpos add constraint pfgt_auftragpos_auf_fk foreign key (auftrag_id) references pfgt_auftraege(id) on delete cascade;
alter table pfgt_auftrag_zuordnung add constraint pfgt_auftrag_zuordnung_pos_fk foreign key (pos_id) references pfgt_auftragpos(id) on delete cascade;
alter table pfgt_auftrag_zuordnung add constraint pfgt_auftrag_zuordnung_partie_fk foreign key (partie_id) references pfgt_partien(id) on delete restrict;
alter table pfgt_auftraege add constraint pfgt_auftraege_tour_fk foreign key (tour_id) references pfgt_touren(id) on delete set null;

-- Testkopie aus den Echtdaten neu füllen (löscht nur Testdaten)
create or replace function public.pfgt_neu_kopieren() returns text
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if not pfg_ok() then raise exception 'kein Zugriff'; end if;
  truncate pfgt_zuordnung, pfgt_auftrag_zuordnung, pfgt_bestellpos, pfgt_auftragpos, pfgt_bestellungen, pfgt_auftraege, pfgt_touren, pfgt_partien, pfgt_distanz, pfgt_ladestellen, pfgt_kunden, pfgt_lieferanten, pfgt_sorten;
  foreach t in array array['sorten','lieferanten','kunden','partien','ladestellen','distanz','touren','auftraege','auftragpos','auftrag_zuordnung','bestellungen','bestellpos','zuordnung'] loop
    execute format('insert into pfgt_%s select * from pfg_%s', t, t);
  end loop;
  return 'ok';
end $$;
revoke all on function public.pfgt_neu_kopieren() from public, anon;
grant execute on function public.pfgt_neu_kopieren() to authenticated;
