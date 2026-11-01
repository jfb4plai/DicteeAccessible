/*
  # DictéeAccessible : phrases (plan 2)

  Projet Supabase partagé : toutes les tables gardent le préfixe `dicta_`.

  - dicta_sentences : phrases d'une dictée, validées une par une par l'enseignant(e).
  - Un déclencheur refuse de publier une dictée dont une phrase n'est pas validée.
  - dicta_attempts accepte désormais une réponse de phrase (sentence_id) à la place d'un mot (item_id).
  - dicta_open_session renvoie les phrases validées ; dicta_record_sentence_attempt enregistre un essai
    (justesse calculée côté serveur, comme pour les mots).
  - dicta_ai_usage + dicta_ai_take : plafond quotidien d'appels IA par enseignant(e).
*/

-- ---------- Phrases ----------

create table if not exists dicta_sentences (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references dicta_sessions(id) on delete cascade,
  item_id uuid references dicta_items(id) on delete set null,
  position int not null,
  text text not null check (length(btrim(text)) between 1 and 300),
  parasites text[] not null default '{}',
  validated boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_dicta_sentences_session on dicta_sentences(session_id);

alter table dicta_sentences enable row level security;

create policy "dicta_sentences propriétaire" on dicta_sentences
  for all to authenticated
  using (exists (select 1 from dicta_sessions s where s.id = session_id and s.user_id = (select auth.uid())))
  with check (
    exists (select 1 from dicta_sessions s where s.id = session_id and s.user_id = (select auth.uid()))
    and (item_id is null or exists (select 1 from dicta_items i where i.id = item_id and i.session_id = dicta_sentences.session_id))
  );

revoke all on dicta_sentences from anon, authenticated;
grant select, insert, update, delete on dicta_sentences to authenticated;
grant select, insert, update, delete on dicta_sentences to service_role;

-- ---------- Réponses : un mot OU une phrase ----------

alter table dicta_attempts alter column item_id drop not null;
alter table dicta_attempts add column if not exists sentence_id uuid references dicta_sentences(id) on delete cascade;
alter table dicta_attempts add constraint dicta_attempts_item_xor_sentence check ((item_id is null) <> (sentence_id is null));

-- ---------- Verrou de publication ----------

create or replace function dicta_publish_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.published and not old.published
     and exists (select 1 from dicta_sentences s where s.session_id = new.id and not s.validated) then
    raise exception 'sentences_not_validated';
  end if;
  return new;
end;
$$;

create trigger dicta_sessions_publish_guard
  before update on dicta_sessions
  for each row execute function dicta_publish_guard();

-- ---------- Fonctions élève ----------

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

create or replace function dicta_record_sentence_attempt(
  p_access_code text, p_pupil_code text, p_sentence_id uuid, p_stage text, p_answer text, p_listens int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  st dicta_sentences;
  ok boolean;
  n int;
begin
  select * into r from dicta_resolve(p_access_code, p_pupil_code);
  if not found then
    raise exception 'invalid_access';
  end if;
  select * into st from dicta_sentences where id = p_sentence_id and session_id = r.session_id and validated;
  if not found then
    raise exception 'invalid_access';
  end if;
  if p_stage not in ('B1','B2') then
    raise exception 'invalid_stage';
  end if;
  if (select count(*) from dicta_attempts where session_id = r.session_id and pupil_id = r.pupil_id) >= 1000 then
    raise exception 'limit_reached';
  end if;

  -- Même normalisation que le navigateur : forme composée, minuscules, une seule apostrophe, espaces simples.
  ok := lower(replace(normalize(regexp_replace(btrim(coalesce(p_answer, '')), '\s+', ' ', 'g'), NFC), '’', ''''))
      = lower(replace(normalize(regexp_replace(btrim(st.text), '\s+', ' ', 'g'), NFC), '’', ''''));

  select count(*) + 1 into n
  from dicta_attempts
  where session_id = r.session_id and pupil_id = r.pupil_id and sentence_id = p_sentence_id
    and stage = p_stage and kind = 'attempt';

  insert into dicta_attempts (user_id, session_id, pupil_id, sentence_id, stage, kind, attempt_number, answer, correct, listens)
  values (
    r.user_id, r.session_id, r.pupil_id, p_sentence_id, p_stage, 'attempt', n,
    left(coalesce(p_answer, ''), 400), ok,
    greatest(0, least(coalesce(p_listens, 0), 100))
  );

  return jsonb_build_object('correct', ok, 'attempt_number', n);
end;
$$;

revoke all on function dicta_record_sentence_attempt(text, text, uuid, text, text, int) from public;
grant execute on function dicta_record_sentence_attempt(text, text, uuid, text, text, int) to anon, authenticated;

-- ---------- Plafond quotidien d'appels IA ----------

create table if not exists dicta_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  calls int not null default 0,
  primary key (user_id, day)
);

alter table dicta_ai_usage enable row level security;

create policy "dicta_ai_usage lecture propriétaire" on dicta_ai_usage
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on dicta_ai_usage from anon, authenticated;
grant select on dicta_ai_usage to authenticated;
grant select, insert, update, delete on dicta_ai_usage to service_role;

create or replace function dicta_ai_take(p_max int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  insert into dicta_ai_usage (user_id, day, calls)
  values (uid, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set calls = dicta_ai_usage.calls + 1
    where dicta_ai_usage.calls < p_max
  returning calls into n;

  if n is null then
    raise exception 'quota_exceeded';
  end if;
  return n;
end;
$$;

revoke all on function dicta_ai_take(int) from public, anon;
grant execute on function dicta_ai_take(int) to authenticated;
