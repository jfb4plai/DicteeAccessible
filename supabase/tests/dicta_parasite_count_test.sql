-- Test de parasite_count. À exécuter APRÈS la migration 20261124120000. Tout est annulé à la fin.

begin;

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dicta-pc@example.test');

insert into dicta_pupils (id, user_id, code) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'E1');

insert into dicta_sessions (id, user_id, title, level, mode, access_code, published) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'Défaut', 'P3', 'class', 'PARAAA', true),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', 'Zéro', 'P3', 'class', 'PARABB', true);

update dicta_sessions set parasite_count = 0 where id = '00000000-0000-0000-0000-0000000000c2';

insert into dicta_session_pupils (session_id, pupil_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1');

do $$
declare
  r jsonb;
begin
  r := dicta_open_session('PARAAA', 'E1');
  if (r->>'parasite_count')::int is distinct from 2 then raise exception 'défaut attendu 2, reçu %', r->>'parasite_count'; end if;

  r := dicta_open_session('PARABB', 'E1');
  if (r->>'parasite_count')::int is distinct from 0 then raise exception 'zéro attendu, reçu %', r->>'parasite_count'; end if;

  begin
    update dicta_sessions set parasite_count = 4 where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'attendu : refus de 4';
  exception when check_violation then null;
  end;
  begin
    update dicta_sessions set parasite_count = -1 where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'attendu : refus de -1';
  exception when check_violation then null;
  end;
end $$;

rollback;
