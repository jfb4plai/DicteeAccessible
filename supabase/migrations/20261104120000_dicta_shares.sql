/*
  # DictéeAccessible : invitations en lecture seule (accès externe)

  Une invitation = un lien secret, pour un seul élève, que l'enseignant(e) envoie elle-même
  (ergothérapeute, parent). L'invité n'a pas de compte et ne peut rien modifier.

  - Table `dicta_shares` : aucun accès direct (RLS activée, aucune politique, aucun droit anon/authenticated).
  - Le jeton (32 octets, 43 caractères base64url) n'est jamais stocké : seule son empreinte SHA-256 l'est.
  - Quatre fonctions `security definer` :
      dicta_share_create(pupil, label, expires)  propriétaire de l'élève -> { id, token } (jeton clair une seule fois)
      dicta_share_list(pupil)                    propriétaire -> liste sans jeton ni empreinte
      dicta_share_revoke(share)                  propriétaire, idempotent
      dicta_share_view(token)                    anon + authenticated -> données bornées d'un seul élève
  - Jamais renvoyés : captures, codes de dictée, titre/identité de l'enseignant(e), autres élèves,
    commentaire non visible, phrases non validées, dictées non publiées.
  - Limites : 60 consultations par heure et par invitation, 10 invitations actives par élève.
*/

create table if not exists dicta_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pupil_id uuid not null references dicta_pupils(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  window_start timestamptz not null default now(),
  window_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_dicta_shares_pupil on dicta_shares(pupil_id);

alter table dicta_shares enable row level security;

-- Grants Data API : aucun accès direct pour les clients, tout passe par les fonctions.
revoke all on dicta_shares from anon, authenticated;
grant select, insert, update, delete on dicta_shares to service_role;

create or replace function dicta_share_create(p_pupil_id uuid, p_label text, p_expires_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  lab text := btrim(coalesce(p_label, ''));
  tok text;
  sid uuid;
  n int;
begin
  if uid is null or not exists (select 1 from dicta_pupils where id = p_pupil_id and user_id = uid) then
    raise exception 'not_owner';
  end if;
  if char_length(lab) < 1 or char_length(lab) > 60 then
    raise exception 'invalid_label';
  end if;
  if p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '2 years' then
    raise exception 'invalid_expiry';
  end if;
  select count(*) into n from dicta_shares
  where pupil_id = p_pupil_id and revoked_at is null and expires_at > now();
  if n >= 10 then
    raise exception 'too_many';
  end if;

  -- base64url sans « = » : 32 octets donnent 43 caractères.
  tok := translate(replace(encode(gen_random_bytes(32), 'base64'), E'\n', ''), '+/=', '-_');
  insert into dicta_shares (user_id, pupil_id, label, token_hash, expires_at)
  values (uid, p_pupil_id, lab, encode(digest(tok, 'sha256'), 'hex'), p_expires_at)
  returning id into sid;

  return jsonb_build_object('id', sid, 'token', tok);
end;
$$;

create or replace function dicta_share_list(p_pupil_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from dicta_pupils where id = p_pupil_id and user_id = uid) then
    raise exception 'not_owner';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'label', s.label, 'expires_at', s.expires_at, 'revoked_at', s.revoked_at,
      'last_used_at', s.last_used_at, 'created_at', s.created_at
    ) order by s.created_at desc)
    from dicta_shares s where s.pupil_id = p_pupil_id
  ), '[]'::jsonb);
end;
$$;

create or replace function dicta_share_revoke(p_share_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from dicta_shares where id = p_share_id and user_id = uid) then
    raise exception 'not_owner';
  end if;
  update dicta_shares set revoked_at = coalesce(revoked_at, now()) where id = p_share_id;
end;
$$;

create or replace function dicta_share_view(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  sh dicta_shares;
  pupil_code text;
  sessions jsonb;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'invalid_share';
  end if;

  select * into sh from dicta_shares
  where token_hash = encode(digest(p_token, 'sha256'), 'hex') and revoked_at is null and expires_at > now()
  for update;
  if not found then
    raise exception 'invalid_share';
  end if;

  -- Fenêtre glissante d'une heure : 60 consultations au plus par invitation.
  if sh.window_start < now() - interval '1 hour' then
    sh.window_start := now();
    sh.window_count := 0;
  end if;
  if sh.window_count >= 60 then
    raise exception 'rate_limited';
  end if;
  update dicta_shares
  set last_used_at = now(), window_start = sh.window_start, window_count = sh.window_count + 1
  where id = sh.id;

  select code into pupil_code from dicta_pupils where id = sh.pupil_id;

  select coalesce(jsonb_agg(q.j order by q.created desc), '[]'::jsonb) into sessions
  from (
    select s.created_at as created,
      jsonb_build_object(
        'id', s.id, 'title', s.title, 'level', s.level, 'mode', s.mode,
        'created_at', s.created_at, 'final_round', s.final_round,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object('id', i.id, 'word', i.word, 'position', i.position) order by i.position)
          from dicta_items i where i.session_id = s.id
        ), '[]'::jsonb),
        'sentences', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', x.id, 'position', x.position, 'text', x.text, 'parasites', x.parasites, 'item_id', x.item_id
          ) order by x.position)
          from dicta_sentences x where x.session_id = s.id and x.validated
        ), '[]'::jsonb),
        'attempts', coalesce((
          select jsonb_agg(jsonb_build_object(
            'item_id', a.item_id, 'sentence_id', a.sentence_id, 'stage', a.stage, 'kind', a.kind,
            'attempt_number', a.attempt_number, 'answer', a.answer, 'correct', a.correct, 'listens', a.listens
          ) order by a.created_at)
          from dicta_attempts a where a.session_id = s.id and a.pupil_id = sh.pupil_id
        ), '[]'::jsonb),
        'comment', (
          select c.body from dicta_comments c
          where c.session_id = s.id and c.pupil_id = sh.pupil_id and c.visible and btrim(c.body) <> ''
        )
      ) as j
    from dicta_sessions s
    join dicta_session_pupils sp on sp.session_id = s.id and sp.pupil_id = sh.pupil_id
    where s.published
      and exists (select 1 from dicta_attempts a where a.session_id = s.id and a.pupil_id = sh.pupil_id)
    order by s.created_at desc
    limit 50
  ) q;

  return jsonb_build_object('pupil_code', pupil_code, 'sessions', sessions);
end;
$$;

revoke all on function dicta_share_create(uuid, text, timestamptz) from public;
revoke all on function dicta_share_list(uuid) from public;
revoke all on function dicta_share_revoke(uuid) from public;
revoke all on function dicta_share_view(text) from public;
grant execute on function dicta_share_create(uuid, text, timestamptz) to authenticated;
grant execute on function dicta_share_list(uuid) to authenticated;
grant execute on function dicta_share_revoke(uuid) to authenticated;
grant execute on function dicta_share_view(text) to anon, authenticated;
