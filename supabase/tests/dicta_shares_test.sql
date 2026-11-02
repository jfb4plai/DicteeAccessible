-- Test des invitations (dicta_shares). À exécuter APRÈS la migration 20261104120000.
-- Tout est annulé à la fin. Une assertion fausse lève une exception et arrête le script.

begin;

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dicta-sh1@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dicta-sh2@example.test');

-- Enseignant A : élèves E1 et E2. Enseignant B : un élève.
insert into dicta_pupils (id, user_id, code) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'E1'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'E2'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a2', 'E1');

-- c1 publiée (E1 et E2), c2 non publiée (E1 seulement, avec une réponse).
insert into dicta_sessions (id, user_id, title, level, mode, access_code, published) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'Dictée publiée', 'P3', 'class', 'SHARAA', true),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1', 'Dictée brouillon', 'P3', 'class', 'SHARBB', false);
insert into dicta_session_pupils (session_id, pupil_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1');
insert into dicta_items (id, session_id, word, position) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'chat', 0),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c2', 'brouillon', 0);
insert into dicta_sentences (id, session_id, position, text, validated) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1', 0, 'Le chat dort.', true),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c1', 1, 'Phrase non validée.', false);

-- E1 : une réponse de mot (avec capture) et une de phrase ; E2 : une réponse de mot ; c2 : une réponse d'E1.
insert into dicta_attempts (user_id, session_id, pupil_id, item_id, sentence_id, stage, kind, attempt_number, answer, correct, listens, screenshot) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', null, 'A', 'attempt', 1, 'chat', true, 2, 'data:image/jpeg;base64,AAAA'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', null, '00000000-0000-0000-0000-0000000000e1', 'B2', 'attempt', 1, 'le chat dort', true, 1, null),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d1', null, 'A', 'attempt', 1, 'chta', false, 1, null),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d2', null, 'A', 'attempt', 1, 'brouillon', true, 1, null);

-- Commentaire visible pour E1, privé pour E2.
insert into dicta_comments (user_id, session_id, pupil_id, body, visible) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'Note visible', true),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 'Note privée', false);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

do $$
declare
  c jsonb; tok text; tok2 text; shid uuid; res jsonb; res2 jsonb; lst jsonb; i int;
begin
  -- 1. création : jeton de 43 caractères base64url, empreinte de 64 hex, jeton absent de la base
  c := dicta_share_create('00000000-0000-0000-0000-0000000000b1', 'Ergo, Mme Test', now() + interval '30 days');
  tok := c->>'token';
  shid := (c->>'id')::uuid;
  if tok !~ '^[A-Za-z0-9_-]{43}$' then raise exception 'jeton mal formé : %', tok; end if;
  if (select token_hash from dicta_shares where id = shid) !~ '^[0-9a-f]{64}$' then raise exception 'empreinte mal formée'; end if;
  if exists (select 1 from dicta_shares where token_hash = tok or label = tok) then raise exception 'jeton stocké en clair'; end if;

  -- 2. consultation : un seul élève, dictée publiée seulement, pas de capture, pas de code de dictée
  res := dicta_share_view(tok);
  if res->>'pupil_code' <> 'E1' then raise exception 'élève attendu E1, reçu %', res->>'pupil_code'; end if;
  if jsonb_array_length(res->'sessions') <> 1 then raise exception 'une dictée attendue (brouillon exclu), reçu %', jsonb_array_length(res->'sessions'); end if;
  if jsonb_array_length(res->'sessions'->0->'attempts') <> 2 then raise exception 'deux réponses d''E1 attendues'; end if;
  if jsonb_array_length(res->'sessions'->0->'sentences') <> 1 then raise exception 'une phrase validée attendue'; end if;
  if res::text like '%screenshot%' or res::text like '%data:image%' then raise exception 'capture renvoyée'; end if;
  if res::text like '%access_code%' or res::text like '%SHARAA%' then raise exception 'code de dictée renvoyé'; end if;
  if res::text like '%chta%' or res::text like '%Note privée%' or res::text like '%Phrase non validée%' or res::text like '%brouillon%' then raise exception 'donnée d''un autre élève ou non publiée renvoyée'; end if;
  if res->'sessions'->0->>'comment' <> 'Note visible' then raise exception 'commentaire visible attendu'; end if;

  -- 3. l'invitation d'E2 ne montre ni les données d'E1 ni le commentaire privé
  c := dicta_share_create('00000000-0000-0000-0000-0000000000b2', 'Parent E2', now() + interval '30 days');
  tok2 := c->>'token';
  res2 := dicta_share_view(tok2);
  if res2->>'pupil_code' <> 'E2' then raise exception 'élève attendu E2'; end if;
  if res2->'sessions'->0->'comment' <> 'null'::jsonb then raise exception 'commentaire privé exposé'; end if;
  if res2::text like '%Note visible%' or res2::text like '%le chat dort%' then raise exception 'données d''E1 exposées à E2'; end if;
  if jsonb_array_length(res2->'sessions'->0->'attempts') <> 1 then raise exception 'une réponse d''E2 attendue'; end if;

  -- 5. libellé et date invalides
  begin perform dicta_share_create('00000000-0000-0000-0000-0000000000b1', '', now() + interval '1 day'); raise exception 'attendu invalid_label';
  exception when others then if sqlerrm <> 'invalid_label' then raise; end if; end;
  begin perform dicta_share_create('00000000-0000-0000-0000-0000000000b1', '    ', now() + interval '1 day'); raise exception 'attendu invalid_label';
  exception when others then if sqlerrm <> 'invalid_label' then raise; end if; end;
  begin perform dicta_share_create('00000000-0000-0000-0000-0000000000b1', repeat('x', 61), now() + interval '1 day'); raise exception 'attendu invalid_label';
  exception when others then if sqlerrm <> 'invalid_label' then raise; end if; end;
  begin perform dicta_share_create('00000000-0000-0000-0000-0000000000b1', 'Ok', now() - interval '1 day'); raise exception 'attendu invalid_expiry';
  exception when others then if sqlerrm <> 'invalid_expiry' then raise; end if; end;
  begin perform dicta_share_create('00000000-0000-0000-0000-0000000000b1', 'Ok', now() + interval '3 years'); raise exception 'attendu invalid_expiry';
  exception when others then if sqlerrm <> 'invalid_expiry' then raise; end if; end;

  -- 11. la liste ne contient ni jeton ni empreinte
  lst := dicta_share_list('00000000-0000-0000-0000-0000000000b1');
  if jsonb_array_length(lst) <> 1 or lst::text like '%token%' or lst::text like '%' || tok || '%' then raise exception 'liste incorrecte : %', lst; end if;

  -- 8. jetons invalides : tous la même erreur
  begin perform dicta_share_view(null); raise exception 'attendu invalid_share';
  exception when others then if sqlerrm <> 'invalid_share' then raise; end if; end;
  begin perform dicta_share_view(''); raise exception 'attendu invalid_share';
  exception when others then if sqlerrm <> 'invalid_share' then raise; end if; end;
  begin perform dicta_share_view(substr(tok, 1, 42)); raise exception 'attendu invalid_share';
  exception when others then if sqlerrm <> 'invalid_share' then raise; end if; end;
  begin perform dicta_share_view(repeat('A', 43)); raise exception 'attendu invalid_share';
  exception when others then if sqlerrm <> 'invalid_share' then raise; end if; end;

  -- 6. retrait : la consultation échoue, un second retrait ne lève rien
  perform dicta_share_revoke(shid);
  begin perform dicta_share_view(tok); raise exception 'attendu invalid_share';
  exception when others then if sqlerrm <> 'invalid_share' then raise; end if; end;
  perform dicta_share_revoke(shid);

  -- 7. expiration
  update dicta_shares set expires_at = now() - interval '1 minute' where token_hash = encode(digest(tok2, 'sha256'), 'hex');
  begin perform dicta_share_view(tok2); raise exception 'attendu invalid_share';
  exception when others then if sqlerrm <> 'invalid_share' then raise; end if; end;

  -- 9. 60 consultations, la 61e est refusée, puis la fenêtre se rouvre après 2 heures
  c := dicta_share_create('00000000-0000-0000-0000-0000000000b1', 'Limite', now() + interval '30 days');
  tok := c->>'token';
  for i in 1..60 loop perform dicta_share_view(tok); end loop;
  begin perform dicta_share_view(tok); raise exception 'attendu rate_limited';
  exception when others then if sqlerrm <> 'rate_limited' then raise; end if; end;
  update dicta_shares set window_start = now() - interval '2 hours' where token_hash = encode(digest(tok, 'sha256'), 'hex');
  perform dicta_share_view(tok);

  -- 10. 10 invitations actives au plus par élève (E1 en a déjà 1 active : « Limite »)
  for i in 1..9 loop perform dicta_share_create('00000000-0000-0000-0000-0000000000b1', 'Invité ' || i, now() + interval '30 days'); end loop;
  begin perform dicta_share_create('00000000-0000-0000-0000-0000000000b1', 'Onzième', now() + interval '30 days'); raise exception 'attendu too_many';
  exception when others then if sqlerrm <> 'too_many' then raise; end if; end;
  perform dicta_share_revoke((select id from dicta_shares where label = 'Invité 1'));
  perform dicta_share_create('00000000-0000-0000-0000-0000000000b1', 'Après retrait', now() + interval '30 days');
end $$;

-- 4. l'enseignant B ne peut ni créer, ni lister, ni retirer pour un élève ou une invitation de A
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);

do $$
begin
  begin perform dicta_share_create('00000000-0000-0000-0000-0000000000b1', 'Intrus', now() + interval '1 day'); raise exception 'attendu not_owner';
  exception when others then if sqlerrm <> 'not_owner' then raise; end if; end;
  begin perform dicta_share_list('00000000-0000-0000-0000-0000000000b1'); raise exception 'attendu not_owner';
  exception when others then if sqlerrm <> 'not_owner' then raise; end if; end;
  begin perform dicta_share_revoke((select id from dicta_shares where label = 'Limite')); raise exception 'attendu not_owner';
  exception when others then if sqlerrm <> 'not_owner' then raise; end if; end;
end $$;

-- sans connexion
select set_config('request.jwt.claims', '', true);
do $$
begin
  begin perform dicta_share_create('00000000-0000-0000-0000-0000000000b1', 'Anonyme', now() + interval '1 day'); raise exception 'attendu not_owner';
  exception when others then if sqlerrm <> 'not_owner' then raise; end if; end;
end $$;

-- 12. droits : anon n'exécute que la consultation, personne n'accède à la table
do $$
begin
  if not has_function_privilege('anon', 'dicta_share_view(text)', 'execute') then raise exception 'anon doit pouvoir consulter'; end if;
  if has_function_privilege('anon', 'dicta_share_create(uuid, text, timestamptz)', 'execute') then raise exception 'anon ne doit pas créer'; end if;
  if has_function_privilege('anon', 'dicta_share_list(uuid)', 'execute') then raise exception 'anon ne doit pas lister'; end if;
  if has_function_privilege('anon', 'dicta_share_revoke(uuid)', 'execute') then raise exception 'anon ne doit pas retirer'; end if;
  if has_table_privilege('anon', 'dicta_shares', 'select') or has_table_privilege('authenticated', 'dicta_shares', 'select')
     or has_table_privilege('authenticated', 'dicta_shares', 'insert') then raise exception 'accès direct à la table'; end if;
end $$;

-- 13. supprimer l'élève supprime ses invitations
do $$
begin
  delete from dicta_pupils where id = '00000000-0000-0000-0000-0000000000b1';
  if exists (select 1 from dicta_shares where pupil_id = '00000000-0000-0000-0000-0000000000b1') then raise exception 'invitations restantes après suppression de l''élève'; end if;
end $$;

rollback;
