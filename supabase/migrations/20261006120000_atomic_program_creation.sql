-- Corrective pass after Implementation Phase 19 (ADR-0100..0102): atomic and
-- idempotent NEW program creation.
-- "Creating a training program is one transactional user intent, not a sequence of independently durable mutations."
-- "Retrying the same creation intent must resolve to the same draft."
-- Forward-only; previous migrations untouched. Existing rows keep NULL request
-- identity (no fabricated history).

-- 1. Creation intent identity on user-created roots ---------------------------
alter table public.training_programs
  add column creation_request_id uuid,
  add column creation_request_fingerprint text
    check (creation_request_fingerprint is null or creation_request_fingerprint ~ '^[0-9a-f]{64}$'),
  add constraint training_program_creation_identity_check check (
    (creation_request_id is null) = (creation_request_fingerprint is null)
    and (creation_request_id is null or supersedes_program_id is null)
  );
comment on column public.training_programs.creation_request_id is
  'Idempotency identity of one "create this program" intent (client-generated UUID, reused on retry). Identity only: grants no authority. NULL for revisions and historical rows.';
comment on column public.training_programs.creation_request_fingerprint is
  'SHA-256 (hex) of the canonical semantic creation input, computed by the server. Integrity of retries, not authentication or a secret.';
-- Athlete-scoped: request ids of different athletes never collide.
create unique index training_programs_creation_request_key
  on public.training_programs(athlete_id, creation_request_id)
  where creation_request_id is not null;

-- Only the creation RPC may set the identity; it is immutable afterwards.
create function public.guard_training_program_creation_identity() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then
    if (new.creation_request_id is not null or new.creation_request_fingerprint is not null)
      and current_setting('app.training_program_creation',true) is distinct from 'atomic' then
      raise exception 'Creation identity requires the atomic creation operation' using errcode='42501';
    end if;
  elsif new.creation_request_id is distinct from old.creation_request_id
    or new.creation_request_fingerprint is distinct from old.creation_request_fingerprint then
    raise exception 'Creation identity is immutable' using errcode='55000';
  end if;
  return new;
end $$;
create trigger training_programs_creation_identity before insert or update on public.training_programs
  for each row execute function public.guard_training_program_creation_identity();

-- 2. Canonical fingerprint ------------------------------------------------------
-- jsonb stores object keys in a canonical order, so the text form does not
-- depend on client key ordering; arrays keep their (semantic) order; nulls are
-- stripped so "absent" and "null" optional fields are equivalent. Contains no
-- JWT, timestamps, database ids or lineage (lineage is rejected on creation).
create function public.training_program_creation_fingerprint(p_name text, p_description text, p_athlete_goal_id uuid, p_structure jsonb)
returns text language sql immutable set search_path='' as $$
  select encode(extensions.digest(jsonb_strip_nulls(jsonb_build_object(
    'version','training-program-creation-v1',
    'name',btrim(p_name),
    'description',nullif(btrim(p_description),''),
    'athleteGoalId',p_athlete_goal_id,
    'structure',p_structure))::text,'sha256'),'hex') $$;
revoke all on function public.training_program_creation_fingerprint(text,text,uuid,jsonb) from public,anon;
grant execute on function public.training_program_creation_fingerprint(text,text,uuid,jsonb) to authenticated,service_role;

-- 3. Atomic creation RPC ----------------------------------------------------------
-- One transaction: program row + complete hierarchy through the canonical
-- replace_training_program_structure (same invariants, lineage assignment and
-- post-write verification; no duplicated structure logic). Any failure rolls
-- back everything: zero programs or one complete draft.
create function public.create_training_program_with_structure(
  p_creation_request_id uuid,
  p_name text,
  p_structure jsonb,
  p_description text default null,
  p_athlete_goal_id uuid default null
) returns uuid language plpgsql security invoker set search_path='' as $$
declare athlete uuid := public.current_athlete_id(); fingerprint text; existing public.training_programs; program_id uuid;
begin
  if athlete is null then raise exception 'Athlete not found' using errcode='42501'; end if;
  if p_creation_request_id is null then raise exception 'Creation request id required' using errcode='22023'; end if;
  if p_structure is null or jsonb_typeof(p_structure) <> 'object' then raise exception 'At least one block is required' using errcode='22023'; end if;
  -- A new root has no prior structural continuity: lineage is server-assigned.
  if jsonb_path_exists(p_structure, 'strict $.**.lineageId') then
    raise exception 'Lineage is not accepted on program creation' using errcode='22023';
  end if;
  fingerprint := public.training_program_creation_fingerprint(p_name, p_description, p_athlete_goal_id, p_structure);
  -- Serialize concurrent retries of the same intent (athlete-scoped key).
  perform pg_advisory_xact_lock(hashtextextended('training_program_creation:' || athlete::text || ':' || p_creation_request_id::text, 0));
  select * into existing from public.training_programs
    where athlete_id=athlete and creation_request_id=p_creation_request_id;
  if found then
    if existing.creation_request_fingerprint is distinct from fingerprint then
      -- 23505 -> HTTP 409 through PostgREST. Nothing is modified.
      raise exception 'program_creation_conflict' using errcode='23505';
    end if;
    return existing.id;
  end if;
  perform set_config('app.training_program_creation','atomic',true);
  -- status defaults to draft; no supersedes (a new root, not a revision);
  -- lineage_tracked is forced by the Implementation Phase 18 trigger.
  insert into public.training_programs(athlete_id,athlete_goal_id,name,description,creation_request_id,creation_request_fingerprint)
    values(athlete,p_athlete_goal_id,p_name,nullif(btrim(p_description),''),p_creation_request_id,fingerprint)
    returning id into program_id;
  perform set_config('app.training_program_creation','',true);
  perform public.replace_training_program_structure(program_id, p_structure);
  return program_id;
end $$;
comment on function public.create_training_program_with_structure(uuid,text,jsonb,text,uuid) is
  'Atomically creates one draft program with its complete, validated structure for the current athlete. Idempotent per (athlete, creation_request_id): the same semantic payload returns the same draft; a different payload raises program_creation_conflict (23505). Never activates.';
revoke all on function public.create_training_program_with_structure(uuid,text,jsonb,text,uuid) from public,anon;
grant execute on function public.create_training_program_with_structure(uuid,text,jsonb,text,uuid) to authenticated,service_role;
