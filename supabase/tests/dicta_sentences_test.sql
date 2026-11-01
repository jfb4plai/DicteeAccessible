-- Test des phrases, du verrou de publication et du plafond IA. À exécuter APRÈS la migration 20261102120000.
-- Tout est annulé à la fin. Une assertion fausse lève une exception et arrête le script.

begin;

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dicta-s1@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dicta-s2@example.test');

insert into dicta_pupils (id, user_id, code) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'E1');

-- Dictée en brouillon (non publiée) avec une phrase non validée.
insert into dicta_sessions (id, user_id, title, level, mode, access_code, published) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'Test', 'P3', 'class', 'SENTAA', false),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', 'Autre', 'P3', 'class', 'SENTBB', true);

insert into dicta_session_pupils (session_id, pupil_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1');

insert into dicta_sentences (id, session_id, position, text, parasites, validated) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', 0, 'Le vent a soufflé fort.', array['souffler','soufflez'], false),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c2', 0, 'Autre phrase.', '{}', true);

do $$
declare
  r jsonb;
begin
  -- 1. publication refusée tant qu'une phrase n'est pas validée
  begin
    update dicta_sessions set published = true where id = '00000000-0000-0000-0000-0000000000c1';
    raise exception 'attendu sentences_not_validated';
  exception when others then
    if sqlerrm <> 'sentences_not_validated' then raise; end if;
  end;

  -- 2. après validation, la publication passe
  update dicta_sentences set validated = true where id = '00000000-0000-0000-0000-0000000000e1';
  update dicta_sessions set published = true where id = '00000000-0000-0000-0000-0000000000c1';

  -- 3. une phrase non validée n'est pas renvoyée à l'élève
  insert into dicta_sentences (id, session_id, position, text, validated) values
    ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000c1', 1, 'Brouillon.', false);
  r := dicta_open_session('SENTAA', 'E1');
  if jsonb_array_length(r->'sentences') <> 1 then raise exception 'une seule phrase validée attendue, reçu %', jsonb_array_length(r->'sentences'); end if;
  if r->'sentences'->0->>'text' <> 'Le vent a soufflé fort.' then raise exception 'texte de phrase inattendu'; end if;

  -- 4. justesse calculée côté serveur
  r := dicta_record_sentence_attempt('SENTAA', 'E1', '00000000-0000-0000-0000-0000000000e1', 'B2', 'Le vent a soufflé fort.', 1);
  if (r->>'correct')::boolean is not true or (r->>'attempt_number')::int <> 1 then raise exception 'essai 1 attendu juste/1, reçu %', r; end if;
  r := dicta_record_sentence_attempt('SENTAA', 'E1', '00000000-0000-0000-0000-0000000000e1', 'B2', 'fort. Le vent a soufflé', 0);
  if (r->>'correct')::boolean is not false or (r->>'attempt_number')::int <> 2 then raise exception 'essai 2 attendu faux/2, reçu %', r; end if;
  r := dicta_record_sentence_attempt('SENTAA', 'E1', '00000000-0000-0000-0000-0000000000e1', 'B2', '  le  VENT a soufflé   fort. ', 0);
  if (r->>'correct')::boolean is not true then raise exception 'espaces et casse tolérés, reçu %', r; end if;

  -- 5. phrase d'une autre dictée refusée
  begin
    perform dicta_record_sentence_attempt('SENTAA', 'E1', '00000000-0000-0000-0000-0000000000e2', 'B2', 'Autre phrase.', 0);
    raise exception 'attendu invalid_access (phrase d''une autre dictée)';
  exception when others then
    if sqlerrm <> 'invalid_access' then raise; end if;
  end;

  -- 6. phrase non validée refusée
  begin
    perform dicta_record_sentence_attempt('SENTAA', 'E1', '00000000-0000-0000-0000-0000000000e3', 'B2', 'Brouillon.', 0);
    raise exception 'attendu invalid_access (phrase non validée)';
  exception when others then
    if sqlerrm <> 'invalid_access' then raise; end if;
  end;

  -- 7. étape invalide refusée
  begin
    perform dicta_record_sentence_attempt('SENTAA', 'E1', '00000000-0000-0000-0000-0000000000e1', 'A', 'x', 0);
    raise exception 'attendu invalid_stage';
  exception when others then
    if sqlerrm <> 'invalid_stage' then raise; end if;
  end;

  -- 8. les lignes de phrase figurent dans les essais renvoyés
  r := dicta_open_session('SENTAA', 'E1');
  if jsonb_array_length(r->'attempts') <> 3 then raise exception '3 essais attendus, reçu %', jsonb_array_length(r->'attempts'); end if;
  if r->'attempts'->0->>'sentence_id' is null then raise exception 'sentence_id attendu dans les essais'; end if;
end $$;

-- 9. plafond IA : 1, 2, puis refus
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$
declare
  n int;
begin
  n := dicta_ai_take(2);
  if n <> 1 then raise exception 'premier appel attendu 1, reçu %', n; end if;
  n := dicta_ai_take(2);
  if n <> 2 then raise exception 'deuxième appel attendu 2, reçu %', n; end if;
  begin
    perform dicta_ai_take(2);
    raise exception 'attendu quota_exceeded';
  exception when others then
    if sqlerrm <> 'quota_exceeded' then raise; end if;
  end;
end $$;

-- 10. un autre utilisateur ne voit pas le compteur ni les phrases
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from dicta_ai_usage) <> 0 then raise exception 'RLS : compteur IA visible par un autre utilisateur'; end if;
  if (select count(*) from dicta_sentences) <> 0 then raise exception 'RLS : phrases visibles par un autre utilisateur'; end if;
end $$;
reset role;

-- 11. anon ne peut pas appeler dicta_ai_take ni lire les phrases
set local role anon;
do $$
begin
  begin
    perform dicta_ai_take(5);
    raise exception 'anon ne devrait pas appeler dicta_ai_take';
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

do $$ begin raise notice 'TOUS LES TESTS DICTA PHRASES PASSENT'; end $$;
rollback;
