/*
  # DictéeAccessible : tables dicta_*

  Le projet Supabase est partagé avec d'autres apps PLAI : toutes les tables
  portent le préfixe `dicta_`. Aucune table n'est lisible par `anon`.

  - L'enseignante accède à ses données par RLS (user_id = auth.uid()).
  - L'élève passe uniquement par trois fonctions `security definer`
    (dicta_open_session, dicta_record_attempt, dicta_record_help) qui
    vérifient le code de la dictée ET le code anonyme de l'élève.
  - La justesse d'une réponse est calculée côté serveur.
*/

create table if not exists dicta_pupils (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  unique (user_id, code)
);

create table if not exists dicta_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  level text not null check (level in ('P1','P2','P3','P4','P5','P6')),
  mode text not null check (mode in ('autonomy','class')),
  access_code text not null unique,
  show_correct boolean not null default false,
  read_aloud boolean not null default true,
  final_round boolean not null default true,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists dicta_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references dicta_sessions(id) on delete cascade,
  word text not null,
  position int not null
);

create table if not exists dicta_session_pupils (
  session_id uuid not null references dicta_sessions(id) on delete cascade,
  pupil_id uuid not null references dicta_pupils(id) on delete cascade,
  primary key (session_id, pupil_id)
);

create table if not exists dicta_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references dicta_sessions(id) on delete cascade,
  pupil_id uuid not null references dicta_pupils(id) on delete cascade,
  item_id uuid not null references dicta_items(id) on delete cascade,
  stage text not null check (stage in ('A','B1','B2','C')),
  kind text not null check (kind in ('attempt','help')),
  attempt_number int not null default 0,
  answer text,
  correct boolean,
  listens int not null default 0,
  screenshot text,
  created_at timestamptz not null default now()
);

create table if not exists dicta_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references dicta_sessions(id) on delete cascade,
  pupil_id uuid not null references dicta_pupils(id) on delete cascade,
  body text not null default '',
  visible boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (session_id, pupil_id)
);

create index if not exists idx_dicta_items_session on dicta_items(session_id);
create index if not exists idx_dicta_attempts_session_pupil on dicta_attempts(session_id, pupil_id);

alter table dicta_pupils enable row level security;
alter table dicta_sessions enable row level security;
alter table dicta_items enable row level security;
alter table dicta_session_pupils enable row level security;
alter table dicta_attempts enable row level security;
alter table dicta_comments enable row level security;

create policy "dicta_pupils propriétaire" on dicta_pupils
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "dicta_sessions propriétaire" on dicta_sessions
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "dicta_items propriétaire" on dicta_items
  for all to authenticated
  using (exists (select 1 from dicta_sessions s where s.id = session_id and s.user_id = (select auth.uid())))
  with check (exists (select 1 from dicta_sessions s where s.id = session_id and s.user_id = (select auth.uid())));

create policy "dicta_session_pupils propriétaire" on dicta_session_pupils
  for all to authenticated
  using (exists (select 1 from dicta_sessions s where s.id = session_id and s.user_id = (select auth.uid())))
  with check (
    exists (select 1 from dicta_sessions s where s.id = session_id and s.user_id = (select auth.uid()))
    and exists (select 1 from dicta_pupils p where p.id = pupil_id and p.user_id = (select auth.uid()))
  );

-- Lecture seule pour l'enseignante : les lignes sont écrites par les fonctions élève.
create policy "dicta_attempts lecture propriétaire" on dicta_attempts
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "dicta_comments propriétaire" on dicta_comments
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Grants Data API (le GRANT ouvre au niveau rôle, la RLS filtre les lignes).
revoke all on dicta_pupils, dicta_sessions, dicta_items, dicta_session_pupils, dicta_attempts, dicta_comments from anon, authenticated;
grant select, insert, update, delete on dicta_pupils, dicta_sessions, dicta_items, dicta_session_pupils, dicta_comments to authenticated;
grant select on dicta_attempts to authenticated;
grant select, insert, update, delete on dicta_pupils, dicta_sessions, dicta_items, dicta_session_pupils, dicta_attempts, dicta_comments to service_role;

-- Résolution commune : code de la dictée + code de l'élève (insensible à la casse et aux espaces).
create or replace function dicta_resolve(p_access_code text, p_pupil_code text)
returns table (session_id uuid, pupil_id uuid, user_id uuid)
language sql
security definer
set search_path = public
as $$
  select s.id, p.id, s.user_id
  from dicta_sessions s
  join dicta_session_pupils sp on sp.session_id = s.id
  join dicta_pupils p on p.id = sp.pupil_id
  where s.published
    and upper(s.access_code) = upper(btrim(coalesce(p_access_code, '')))
    and upper(p.code) = upper(btrim(coalesce(p_pupil_code, '')))
  limit 1;
$$;

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
    'attempts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_id', a.item_id, 'stage', a.stage, 'kind', a.kind,
        'attempt_number', a.attempt_number, 'correct', a.correct
      ) order by a.created_at)
      from dicta_attempts a where a.session_id = sess.id and a.pupil_id = r.pupil_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function dicta_record_attempt(
  p_access_code text, p_pupil_code text, p_item_id uuid, p_stage text,
  p_answer text, p_listens int, p_screenshot text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  it dicta_items;
  ok boolean;
  n int;
begin
  select * into r from dicta_resolve(p_access_code, p_pupil_code);
  if not found then
    raise exception 'invalid_access';
  end if;
  select * into it from dicta_items where id = p_item_id and session_id = r.session_id;
  if not found then
    raise exception 'invalid_access';
  end if;
  if p_stage not in ('A','B1','B2','C') then
    raise exception 'invalid_stage';
  end if;

  if (select count(*) from dicta_attempts where session_id = r.session_id and pupil_id = r.pupil_id) >= 1000 then
    raise exception 'limit_reached';
  end if;

  ok := lower(normalize(coalesce(p_answer, ''), NFC)) = lower(normalize(it.word, NFC));

  select count(*) + 1 into n
  from dicta_attempts
  where session_id = r.session_id and pupil_id = r.pupil_id and item_id = p_item_id
    and stage = p_stage and kind = 'attempt';

  insert into dicta_attempts (user_id, session_id, pupil_id, item_id, stage, kind, attempt_number, answer, correct, listens, screenshot)
  values (
    r.user_id, r.session_id, r.pupil_id, p_item_id, p_stage, 'attempt', n,
    left(coalesce(p_answer, ''), 200), ok,
    greatest(0, least(coalesce(p_listens, 0), 100)),
    case when p_screenshot like 'data:image/jpeg;base64,%' and length(p_screenshot) <= 200000 then p_screenshot else null end
  );

  return jsonb_build_object('correct', ok, 'attempt_number', n);
end;
$$;

create or replace function dicta_record_help(p_access_code text, p_pupil_code text, p_item_id uuid, p_stage text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  select * into r from dicta_resolve(p_access_code, p_pupil_code);
  if not found then
    raise exception 'invalid_access';
  end if;
  if not exists (select 1 from dicta_items where id = p_item_id and session_id = r.session_id) then
    raise exception 'invalid_access';
  end if;
  if p_stage not in ('A','B1','B2','C') then
    raise exception 'invalid_stage';
  end if;

  insert into dicta_attempts (user_id, session_id, pupil_id, item_id, stage, kind, attempt_number)
  values (r.user_id, r.session_id, r.pupil_id, p_item_id, p_stage, 'help', 0);
end;
$$;

revoke all on function dicta_resolve(text, text) from public, anon, authenticated;
revoke all on function dicta_open_session(text, text) from public;
revoke all on function dicta_record_attempt(text, text, uuid, text, text, int, text) from public;
revoke all on function dicta_record_help(text, text, uuid, text) from public;
grant execute on function dicta_open_session(text, text) to anon, authenticated;
grant execute on function dicta_record_attempt(text, text, uuid, text, text, int, text) to anon, authenticated;
grant execute on function dicta_record_help(text, text, uuid, text) to anon, authenticated;
