-- Corrective pass after the creation-boundary pass (ADR-0104):
-- "Training structure mutation is an aggregate operation, not table-level client authority."
-- "RLS ownership grants visibility, not permission to bypass aggregate validation."
-- Forward-only; previous migrations untouched. training_programs
-- UPDATE/DELETE are out of scope and unchanged.

-- 1. Structure tables become client read-only -----------------------------------
revoke insert, update, delete on
  public.training_blocks, public.training_weeks, public.training_days,
  public.exercise_prescriptions, public.prescription_sets
  from authenticated, anon;

-- 2. RLS stays enabled; the "for all" policies described write authority the
--    client no longer holds. Same ownership predicate, SELECT only.
drop policy training_blocks_own on public.training_blocks;
drop policy training_weeks_own on public.training_weeks;
drop policy training_days_own on public.training_days;
drop policy exercise_prescriptions_own on public.exercise_prescriptions;
drop policy prescription_sets_own on public.prescription_sets;
create policy training_blocks_own_select on public.training_blocks for select to authenticated
  using (exists(select 1 from public.training_programs p where p.id=training_program_id and p.athlete_id=(select public.current_athlete_id())));
create policy training_weeks_own_select on public.training_weeks for select to authenticated
  using (exists(select 1 from public.training_blocks b join public.training_programs p on p.id=b.training_program_id where b.id=training_block_id and p.athlete_id=(select public.current_athlete_id())));
create policy training_days_own_select on public.training_days for select to authenticated
  using (exists(select 1 from public.training_weeks w join public.training_blocks b on b.id=w.training_block_id join public.training_programs p on p.id=b.training_program_id where w.id=training_week_id and p.athlete_id=(select public.current_athlete_id())));
create policy exercise_prescriptions_own_select on public.exercise_prescriptions for select to authenticated
  using (exists(select 1 from public.training_days d join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id join public.training_programs p on p.id=b.training_program_id where d.id=training_day_id and p.athlete_id=(select public.current_athlete_id())));
create policy prescription_sets_own_select on public.prescription_sets for select to authenticated
  using (exists(select 1 from public.exercise_prescriptions ep join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id join public.training_programs p on p.id=b.training_program_id where ep.id=exercise_prescription_id and p.athlete_id=(select public.current_athlete_id())));

-- 3. The full-tree save is THE aggregate boundary for draft structure; it runs
--    with the owner's privilege (body unchanged, no copy). It already:
--    - locks search_path to '' and schema-qualifies every object;
--    - resolves the athlete only from the session (public.current_athlete_id());
--      it takes no athlete id;
--    - requires an owned program in status 'draft' (row-locked) before any write;
--    - scopes every delete/insert to that verified program id;
--    - rejects incomplete trees, validates lineage (unknown / duplicate /
--      other level / other program) and re-verifies the result before commit;
--    - uses no dynamic SQL.
alter function public.replace_training_program_structure(uuid,jsonb) security definer;
revoke all on function public.replace_training_program_structure(uuid,jsonb) from public, anon;
grant execute on function public.replace_training_program_structure(uuid,jsonb) to authenticated, service_role;
comment on function public.replace_training_program_structure(uuid,jsonb) is
  'The only draft-structure mutation boundary for clients (ADR-0095/0096/0104). SECURITY DEFINER: owned draft from the session only; atomically replaces the WHOLE structure; rejects incomplete trees and verifies the result; preserves validated lineage (same draft, same level, unique); new nodes get new lineage.';
-- Root creation, revision clone, Coach materialization and auto-draft were
-- already SECURITY DEFINER: unchanged.
