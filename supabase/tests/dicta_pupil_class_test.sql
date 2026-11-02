-- Test de la classe d'un élève et de la suppression en cascade. À exécuter APRÈS la migration 20261104110000.
-- Tout est annulé à la fin. Une assertion fausse lève une exception et arrête le script.

begin;

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dicta-cl@example.test');

insert into dicta_pupils (id, user_id, code) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'E1');
insert into dicta_pupils (id, user_id, code, class_label) values
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'E2', 'P3');

insert into dicta_sessions (id, user_id, title, level, mode, access_code, published) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'Dictée', 'P3', 'class', 'CLASAA', true);
insert into dicta_session_pupils (session_id, pupil_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2');
insert into dicta_items (id, session_id, word, position) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', 'chat', 0);
insert into dicta_attempts (user_id, session_id, pupil_id, item_id, stage, kind, attempt_number, answer, correct) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d1', 'A', 'attempt', 1, 'chat', true);
insert into dicta_comments (user_id, session_id, pupil_id, body) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b2', 'ok');

do $$
begin
  -- 1. un élève existant est sans classe ; la classe saisie est conservée
  if (select class_label from dicta_pupils where id = '00000000-0000-0000-0000-0000000000b1') is distinct from '' then raise exception 'E1 devrait être sans classe'; end if;
  if (select class_label from dicta_pupils where id = '00000000-0000-0000-0000-0000000000b2') is distinct from 'P3' then raise exception 'E2 devrait être en P3'; end if;

  -- 2. un libellé de plus de 30 caractères est refusé
  begin
    update dicta_pupils set class_label = repeat('x', 31) where id = '00000000-0000-0000-0000-0000000000b1';
    raise exception 'attendu : refus d''un libellé de 31 caractères';
  exception when check_violation then null;
  end;

  -- 3. supprimer E2 efface ses réponses, son commentaire et son lien de dictée, pas la dictée ni E1
  delete from dicta_pupils where id = '00000000-0000-0000-0000-0000000000b2';
  if exists (select 1 from dicta_attempts where pupil_id = '00000000-0000-0000-0000-0000000000b2') then raise exception 'réponses restantes'; end if;
  if exists (select 1 from dicta_comments where pupil_id = '00000000-0000-0000-0000-0000000000b2') then raise exception 'commentaire restant'; end if;
  if exists (select 1 from dicta_session_pupils where pupil_id = '00000000-0000-0000-0000-0000000000b2') then raise exception 'lien de dictée restant'; end if;
  if not exists (select 1 from dicta_sessions where id = '00000000-0000-0000-0000-0000000000c1') then raise exception 'la dictée a disparu'; end if;
  if not exists (select 1 from dicta_pupils where id = '00000000-0000-0000-0000-0000000000b1') then raise exception 'E1 a disparu'; end if;
end $$;

rollback;
