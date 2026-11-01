-- Test des fonctions élève et de la RLS. À exécuter APRÈS la migration, dans l'éditeur SQL.
-- Tout est dans une transaction annulée à la fin : aucune donnée ne reste.
-- Une assertion fausse lève une exception et arrête le script.

begin;

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dicta-t1@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dicta-t2@example.test');

insert into dicta_pupils (id, user_id, code) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'E1'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'E2');

insert into dicta_sessions (id, user_id, title, level, mode, access_code) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'Test', 'P3', 'class', 'TESTAA'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', 'Autre', 'P3', 'class', 'TESTBB');

insert into dicta_items (id, session_id, word, position) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'chat', 0),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c2', 'chien', 0);

-- E1 est rattaché aux deux dictées, E2 à aucune.
insert into dicta_session_pupils (session_id, pupil_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1');

do $$
declare
  r jsonb;
begin
  -- 1. code de dictée inconnu
  begin
    perform dicta_open_session('XXXXXX', 'E1');
    raise exception 'attendu invalid_access (dictée inconnue)';
  exception when others then
    if sqlerrm <> 'invalid_access' then raise; end if;
  end;

  -- 2. élève non rattaché à la dictée
  begin
    perform dicta_open_session('TESTAA', 'E2');
    raise exception 'attendu invalid_access (élève non rattaché)';
  exception when others then
    if sqlerrm <> 'invalid_access' then raise; end if;
  end;

  -- 3. codes en minuscules et avec espaces
  r := dicta_open_session(' testaa ', 'e1');
  if r->>'session_id' is null or r ? 'title' then raise exception 'ouverture : session_id attendu, title interdit'; end if;

  -- 4. réponse fausse puis juste (majuscules acceptées)
  r := dicta_record_attempt('TESTAA', 'E1', '00000000-0000-0000-0000-0000000000d1', 'A', 'chta', 2, null);
  if (r->>'correct')::boolean is not false or (r->>'attempt_number')::int <> 1 then raise exception 'essai 1 attendu faux/1, reçu %', r; end if;
  r := dicta_record_attempt('TESTAA', 'E1', '00000000-0000-0000-0000-0000000000d1', 'A', 'CHAT', 1, null);
  if (r->>'correct')::boolean is not true or (r->>'attempt_number')::int <> 2 then raise exception 'essai 2 attendu juste/2, reçu %', r; end if;

  -- 4 bis. une capture qui n'est pas un JPEG en data: est ignorée
  perform dicta_record_attempt('TESTAA', 'E1', '00000000-0000-0000-0000-0000000000d1', 'C', 'chta', 0, 'https://exemple.org/p.png');
  if exists (select 1 from dicta_attempts where screenshot like 'https:%') then raise exception 'capture externe acceptée'; end if;
  delete from dicta_attempts where stage = 'C';

  -- 5. aide
  perform dicta_record_help('TESTAA', 'E1', '00000000-0000-0000-0000-0000000000d1', 'A');
  r := dicta_open_session('TESTAA', 'E1');
  if jsonb_array_length(r->'attempts') <> 3 then raise exception '3 lignes attendues, reçu %', jsonb_array_length(r->'attempts'); end if;

  -- 6. mot d'une autre dictée refusé
  begin
    perform dicta_record_attempt('TESTAA', 'E1', '00000000-0000-0000-0000-0000000000d2', 'A', 'chien', 0, null);
    raise exception 'attendu invalid_access (mot d''une autre dictée)';
  exception when others then
    if sqlerrm <> 'invalid_access' then raise; end if;
  end;

  -- 7. dictée non publiée refusée
  update dicta_sessions set published = false where id = '00000000-0000-0000-0000-0000000000c1';
  begin
    perform dicta_open_session('TESTAA', 'E1');
    raise exception 'attendu invalid_access (non publiée)';
  exception when others then
    if sqlerrm <> 'invalid_access' then raise; end if;
  end;
  update dicta_sessions set published = true where id = '00000000-0000-0000-0000-0000000000c1';
end $$;

-- 8. RLS : une autre enseignante ne voit aucune réponse
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from dicta_attempts) <> 0 then raise exception 'RLS : l''autre enseignante voit des réponses'; end if;
  if (select count(*) from dicta_sessions) <> 0 then raise exception 'RLS : l''autre enseignante voit des dictées'; end if;
end $$;

-- 9. RLS : la propriétaire voit ses 3 lignes
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from dicta_attempts) <> 3 then raise exception 'RLS : la propriétaire devrait voir 3 lignes'; end if;
end $$;
reset role;

-- 10. anon ne lit aucune table
set local role anon;
do $$
begin
  begin
    perform 1 from dicta_sessions limit 1;
    raise exception 'anon ne devrait pas lire dicta_sessions';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;

do $$ begin raise notice 'TOUS LES TESTS DICTA PASSENT'; end $$;
rollback;
