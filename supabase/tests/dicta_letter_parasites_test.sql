-- Test des lettres parasites. À exécuter APRÈS la migration 20261124140000. Tout est annulé à la fin.

begin;

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dicta-lp@example.test');

insert into dicta_pupils (id, user_id, code) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'E1');

insert into dicta_sessions (id, user_id, title, level, mode, access_code, published) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'Défaut', 'P3', 'class', 'LETAAA', true),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', 'Trois', 'P3', 'class', 'LETBBB', true);

update dicta_sessions set letter_parasite_count = 3, letter_proximity = 'both' where id = '00000000-0000-0000-0000-0000000000c2';

insert into dicta_session_pupils (session_id, pupil_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1');

do $$
declare
  r jsonb;
begin
  r := dicta_open_session('LETAAA', 'E1');
  if (r->>'letter_parasite_count')::int is distinct from 0 then raise exception 'défaut attendu 0, reçu %', r->>'letter_parasite_count'; end if;
  if r->>'letter_proximity' is distinct from 'none' then raise exception 'défaut attendu none, reçu %', r->>'letter_proximity'; end if;

  r := dicta_open_session('LETBBB', 'E1');
  if (r->>'letter_parasite_count')::int is distinct from 3 then raise exception '3 attendu, reçu %', r->>'letter_parasite_count'; end if;
  if r->>'letter_proximity' is distinct from 'both' then raise exception 'both attendu, reçu %', r->>'letter_proximity'; end if;
  if (r->>'parasite_count') is null then raise exception 'parasite_count doit rester dans la réponse'; end if;

  begin
    update dicta_sessions set letter_parasite_count = 4 where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'attendu : refus de 4';
  exception when check_violation then null;
  end;
  begin
    update dicta_sessions set letter_proximity = 'autre' where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'attendu : refus de la valeur autre';
  exception when check_violation then null;
  end;
end $$;

rollback;
