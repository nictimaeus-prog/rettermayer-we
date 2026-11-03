-- Recht „Erzeuger-Versand“: nur freigegebene Personen dürfen Protokolle an Erzeuger senden
alter table public.profiles add column if not exists erz_versand boolean not null default false;
