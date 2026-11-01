-- Test de la voix de la dictée et de dicta_audio_text. À exécuter APRÈS la migration 20261103120000.
-- Tout est annulé à la fin. Une assertion fausse lève une exception et arrête le script.

begin;

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dicta-v1@example.test');

insert into dicta_pupils (id, user_id, code) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'E1');

insert into dicta_sessions (id, user_id, title, level, mode, access_code, published) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'Publiée', 'P3', 'class', 'VOICAA', true),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', 'Brouillon', 'P3', 'class', 'VOICBB', false);

insert into dicta_session_pupils (session_id, pupil_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1');

insert into dicta_items (id, session_id, word, position) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'chat', 0),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c2', 'brouillon', 0);

insert into dicta_sentences (id, session_id, position, text, validated) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', 0, 'Il a 90 ans.', true),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c1', 1, 'Non validée.', false);

do $$
declare
  r jsonb;
begin
  -- 1. voix par défaut : adrien
  r := dicta_audio_text('VOICAA', 'word', '00000000-0000-0000-0000-0000000000d1');
  if r->>'text' is distinct from 'chat' or r->>'voice' is distinct from 'adrien' then raise exception 'mot attendu chat/adrien, reçu %', r; end if;

  -- 2. phrase validée, code en minuscules avec espaces
  r := dicta_audio_text('  voicaa ', 'sentence', '00000000-0000-0000-0000-0000000000e1');
  if r->>'text' is distinct from 'Il a 90 ans.' then raise exception 'phrase attendue, reçu %', r; end if;

  -- 3. refus : phrase non validée, type inversé, id d'une autre dictée, dictée non publiée, code inconnu, type inconnu
  begin perform dicta_audio_text('VOICAA', 'sentence', '00000000-0000-0000-0000-0000000000e2'); raise exception 'attendu invalid_access (non validée)';
  exception when others then if sqlerrm <> 'invalid_access' then raise; end if; end;
  begin perform dicta_audio_text('VOICAA', 'sentence', '00000000-0000-0000-0000-0000000000d1'); raise exception 'attendu invalid_access (mot lu comme phrase)';
  exception when others then if sqlerrm <> 'invalid_access' then raise; end if; end;
  begin perform dicta_audio_text('VOICAA', 'word', '00000000-0000-0000-0000-0000000000d2'); raise exception 'attendu invalid_access (autre dictée)';
  exception when others then if sqlerrm <> 'invalid_access' then raise; end if; end;
  begin perform dicta_audio_text('VOICBB', 'word', '00000000-0000-0000-0000-0000000000d2'); raise exception 'attendu invalid_access (non publiée)';
  exception when others then if sqlerrm <> 'invalid_access' then raise; end if; end;
  begin perform dicta_audio_text('XXXXXX', 'word', '00000000-0000-0000-0000-0000000000d1'); raise exception 'attendu invalid_access (code inconnu)';
  exception when others then if sqlerrm <> 'invalid_access' then raise; end if; end;
  begin perform dicta_audio_text('VOICAA', 'image', '00000000-0000-0000-0000-0000000000d1'); raise exception 'attendu invalid_access (type inconnu)';
  exception when others then if sqlerrm <> 'invalid_access' then raise; end if; end;

  -- 4. dicta_open_session renvoie la voix
  r := dicta_open_session('VOICAA', 'E1');
  if r->>'voice' is distinct from 'adrien' then raise exception 'voix attendue dans open_session, reçu %', r->>'voice'; end if;

  -- 4 bis. plafond par dictée : 1, 2, puis refus ; dictée non publiée ou inconnue refusée
  if dicta_audio_take('VOICAA', 2) <> 1 then raise exception 'premier appel attendu 1'; end if;
  if dicta_audio_take(' voicaa ', 2) <> 2 then raise exception 'deuxième appel attendu 2'; end if;
  begin perform dicta_audio_take('VOICAA', 2); raise exception 'attendu quota_exceeded';
  exception when others then if sqlerrm <> 'quota_exceeded' then raise; end if; end;
  begin perform dicta_audio_take('VOICBB', 2); raise exception 'attendu invalid_access (non publiée)';
  exception when others then if sqlerrm <> 'invalid_access' then raise; end if; end;

  -- 5. changement de voix accepté, voix inconnue refusée
  update dicta_sessions set voice = 'jef' where id = '00000000-0000-0000-0000-0000000000c1';
  r := dicta_audio_text('VOICAA', 'word', '00000000-0000-0000-0000-0000000000d1');
  if r->>'voice' is distinct from 'jef' then raise exception 'voix jef attendue, reçu %', r->>'voice'; end if;
  begin
    update dicta_sessions set voice = 'robot' where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'attendu check_violation (voix inconnue)';
  exception when check_violation then null;
  end;
end $$;

-- 6. anon appelle la fonction, mais ne lit toujours aucune table
set local role anon;
do $$
declare
  r jsonb;
begin
  r := dicta_audio_text('VOICAA', 'word', '00000000-0000-0000-0000-0000000000d1');
  if r->>'text' <> 'chat' then raise exception 'anon devrait obtenir le texte via la fonction'; end if;
  begin
    perform 1 from dicta_audio_usage limit 1;
    raise exception 'anon ne devrait pas lire dicta_audio_usage';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform 1 from dicta_sentences limit 1;
    raise exception 'anon ne devrait pas lire dicta_sentences';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;

do $$ begin raise notice 'TOUS LES TESTS DICTA VOIX PASSENT'; end $$;
rollback;
