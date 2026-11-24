/*
  # DictéeAccessible : nombre de mots parasites par dictée

  - dicta_sessions.parasite_count : 0 à 3 mots parasites ajoutés aux tuiles en B2 et en classe (défaut 2).
  - dicta_open_session renvoie parasite_count ; l'écran élève garde les N premiers parasites de chaque phrase.
  Les droits d'exécution de la fonction sont conservés par create or replace.
*/

alter table dicta_sessions add column if not exists parasite_count smallint not null default 2;
alter table dicta_sessions add constraint dicta_sessions_parasite_count_check check (parasite_count between 0 and 3);

create or replace function dicta_open_session(p_access_code text, p_pupil_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  sess dicta_sessions;
begin
  select * into r from dicta_resolve(p_access_code, p_pupil_code);
  if not found then
    raise exception 'invalid_access';
  end if;
  select * into sess from dicta_sessions where id = r.session_id;

  return jsonb_build_object(
    'session_id', sess.id,
    'mode', sess.mode,
    'voice', sess.voice,
    'parasite_count', sess.parasite_count,
    'options', jsonb_build_object(
      'show_correct', sess.show_correct,
      'read_aloud', sess.read_aloud,
      'final_round', sess.final_round
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'word', i.word, 'position', i.position) order by i.position)
      from dicta_items i where i.session_id = sess.id
    ), '[]'::jsonb),
    'sentences', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'position', x.position, 'text', x.text,
        'parasites', to_jsonb(x.parasites), 'item_id', x.item_id
      ) order by x.position)
      from dicta_sentences x where x.session_id = sess.id and x.validated
    ), '[]'::jsonb),
    'attempts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_id', a.item_id, 'sentence_id', a.sentence_id, 'stage', a.stage, 'kind', a.kind,
        'attempt_number', a.attempt_number, 'correct', a.correct
      ) order by a.created_at)
      from dicta_attempts a where a.session_id = sess.id and a.pupil_id = r.pupil_id
    ), '[]'::jsonb)
  );
end;
$$;
