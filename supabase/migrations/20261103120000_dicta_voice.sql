/*
  # DictéeAccessible : voix de lecture (plan 3)

  - dicta_sessions.voice : voix choisie par l'enseignant(e) pour la dictée
    ('adrien' voix belge, 'jef' voix clonée, 'device' voix de l'appareil).
  - dicta_open_session renvoie la voix.
  - dicta_audio_text : donne à la fonction /api/speak le texte réel d'un mot ou d'une phrase d'une dictée
    PUBLIÉE, avec sa voix. Sans le code de la dictée et l'id, aucun texte ne sort.
*/

alter table dicta_sessions add column if not exists voice text not null default 'adrien';
alter table dicta_sessions add constraint dicta_sessions_voice_check check (voice in ('adrien', 'jef', 'device'));

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

create or replace function dicta_audio_text(p_access_code text, p_kind text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sess dicta_sessions;
  t text;
begin
  select * into sess
  from dicta_sessions
  where published and upper(access_code) = upper(btrim(coalesce(p_access_code, '')));
  if not found then
    raise exception 'invalid_access';
  end if;

  if p_kind = 'word' then
    select word into t from dicta_items where id = p_id and session_id = sess.id;
  elsif p_kind = 'sentence' then
    select text into t from dicta_sentences where id = p_id and session_id = sess.id and validated;
  else
    raise exception 'invalid_access';
  end if;
  if t is null then
    raise exception 'invalid_access';
  end if;

  return jsonb_build_object('text', t, 'voice', sess.voice);
end;
$$;

revoke all on function dicta_audio_text(text, text, uuid) from public;
grant execute on function dicta_audio_text(text, text, uuid) to anon, authenticated;

-- ---------- Plafond de synthèses par dictée et par jour ----------
-- /api/speak compte chaque appel payant (un raté de cache) avant de contacter ElevenLabs.

create table if not exists dicta_audio_usage (
  session_id uuid not null references dicta_sessions(id) on delete cascade,
  day date not null,
  calls int not null default 0,
  primary key (session_id, day)
);

alter table dicta_audio_usage enable row level security;
revoke all on dicta_audio_usage from anon, authenticated;
grant select, insert, update, delete on dicta_audio_usage to service_role;

create or replace function dicta_audio_take(p_access_code text, p_max int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  sess_id uuid;
  n int;
begin
  select id into sess_id
  from dicta_sessions
  where published and upper(access_code) = upper(btrim(coalesce(p_access_code, '')));
  if sess_id is null then
    raise exception 'invalid_access';
  end if;

  insert into dicta_audio_usage (session_id, day, calls)
  values (sess_id, (now() at time zone 'utc')::date, 1)
  on conflict (session_id, day) do update set calls = dicta_audio_usage.calls + 1
    where dicta_audio_usage.calls < p_max
  returning calls into n;

  if n is null then
    raise exception 'quota_exceeded';
  end if;
  return n;
end;
$$;

revoke all on function dicta_audio_take(text, int) from public;
grant execute on function dicta_audio_take(text, int) to anon, authenticated;
