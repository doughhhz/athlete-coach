create or replace function public.activate_training_program(p_program_id uuid)
returns public.training_programs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result public.training_programs;
begin
  perform pg_advisory_xact_lock(hashtextextended(public.current_athlete_id()::text, 0));

  if not exists (
    select 1
    from public.training_programs
    where id = p_program_id
      and athlete_id = public.current_athlete_id()
      and status = 'draft'
  ) then
    raise exception 'Draft program not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.training_blocks b
    join public.training_weeks w on w.training_block_id = b.id
    join public.training_days d on d.training_week_id = w.id
    join public.exercise_prescriptions ep on ep.training_day_id = d.id
    where b.training_program_id = p_program_id
      and exists (
        select 1
        from public.prescription_sets ps
        where ps.exercise_prescription_id = ep.id
      )
  ) or exists (
    select 1
    from public.exercise_prescriptions ep
    join public.training_days d on d.id = ep.training_day_id
    join public.training_weeks w on w.id = d.training_week_id
    join public.training_blocks b on b.id = w.training_block_id
    where b.training_program_id = p_program_id
      and not exists (
        select 1
        from public.prescription_sets ps
        where ps.exercise_prescription_id = ep.id
      )
  ) then
    raise exception 'Program structure is incomplete' using errcode = '23514';
  end if;

  perform set_config('app.training_program_transition', 'allowed', true);

  update public.training_programs
  set status = 'archived',
      archived_at = now()
  where athlete_id = public.current_athlete_id()
    and status = 'active';

  update public.training_programs
  set status = 'active',
      activated_at = now()
  where id = p_program_id
  returning * into result;

  perform set_config('app.training_program_transition', 'denied', true);
  return result;
end
$$;

comment on function public.activate_training_program(uuid) is
  'Atomically activates a complete draft and archives, without completing, the prior active program.';
