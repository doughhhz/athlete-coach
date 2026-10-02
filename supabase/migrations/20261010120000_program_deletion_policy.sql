-- ADR-0125: athletes may delete their own non-active programs. Programs
-- with workouts, Coach decisions or later revisions stay protected by the
-- existing foreign keys (on delete restrict).
drop policy training_programs_own_delete on public.training_programs;
create policy training_programs_own_delete on public.training_programs for delete to authenticated
  using (athlete_id = (select public.current_athlete_id()) and status <> 'active');
