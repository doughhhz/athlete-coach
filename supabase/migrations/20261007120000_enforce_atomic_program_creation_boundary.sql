-- Corrective pass after the atomic program creation pass (ADR-0103):
-- "Initial TrainingProgram creation is only permitted through the atomic creation boundary."
-- "RLS ownership is not sufficient authority to create a TrainingProgram root."
-- Forward-only; previous migrations untouched. Only INSERT on
-- training_programs changes; UPDATE/DELETE/SELECT keep their current design.

-- 1. Table privilege: no direct program-row creation by clients -----------------
revoke insert on public.training_programs from authenticated, anon;

-- 2. RLS: the "for all" policy also described INSERT, which is no longer an
--    authority clients hold. Replace it with the same ownership predicate for
--    the operations that remain granted (select/update/delete).
drop policy training_programs_own on public.training_programs;
create policy training_programs_own_select on public.training_programs for select to authenticated
  using (athlete_id = (select public.current_athlete_id()));
create policy training_programs_own_update on public.training_programs for update to authenticated
  using (athlete_id = (select public.current_athlete_id()))
  with check (athlete_id = (select public.current_athlete_id()));
create policy training_programs_own_delete on public.training_programs for delete to authenticated
  using (athlete_id = (select public.current_athlete_id()));

-- 3. The two controlled creators run with the owner's privilege (bodies
--    unchanged, no copy). Both already:
--    - lock search_path to '' and schema-qualify every object;
--    - resolve the athlete only from the session (public.current_athlete_id(),
--      i.e. auth.uid()); neither accepts an athlete id;
--    - filter every read/write by that athlete explicitly (not via RLS);
--    - use no dynamic SQL.
--    Root creation (A): validates request id, rejects lineage, fingerprints,
--    and writes the tree through replace_training_program_structure, whose
--    explicit owned-draft check still applies.
alter function public.create_training_program_with_structure(uuid,text,jsonb,text,uuid) security definer;
--    Revision creation (B): source must be the caller's own
--    active/completed/archived program; a revision is not a root.
alter function public.clone_training_program_as_draft(uuid) security definer;
revoke all on function public.create_training_program_with_structure(uuid,text,jsonb,text,uuid), public.clone_training_program_as_draft(uuid) from public, anon;
grant execute on function public.create_training_program_with_structure(uuid,text,jsonb,text,uuid), public.clone_training_program_as_draft(uuid) to authenticated, service_role;
comment on function public.create_training_program_with_structure(uuid,text,jsonb,text,uuid) is
  'The only root-creation boundary (ADR-0100..0103). SECURITY DEFINER: athlete from the session only; atomically creates one draft with its complete validated structure; idempotent per (athlete, creation_request_id); conflict raises program_creation_conflict (23505). Never activates.';
comment on function public.clone_training_program_as_draft(uuid) is
  'Revision boundary (not root creation). SECURITY DEFINER: clones the caller''s own active/completed/archived program as a draft revision preserving lineage.';
-- Coach materialization and auto-draft were already SECURITY DEFINER and
-- service_role-only: unchanged.
