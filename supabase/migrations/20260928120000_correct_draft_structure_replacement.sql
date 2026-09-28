-- Corrective migration (ADR-0055). The Phase 5 function deleted
-- training_blocks and relied on ON DELETE CASCADE. During the cascade the
-- parent rows are already gone, so assert_program_structure_mutable() cannot
-- resolve the program and rejects the delete: any draft that already had
-- structure (clones, materialized Coach drafts, previously saved drafts)
-- could not be saved again. Children are now removed leaf-first so every
-- guard still resolves a draft program. The guard itself is unchanged.
create or replace function public.replace_training_program_structure(p_program_id uuid,p_structure jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare block jsonb; week jsonb; day_item jsonb; prescription jsonb; set_item jsonb; block_id uuid; week_id uuid; day_id uuid; prescription_id uuid;
begin
  if not exists(select 1 from public.training_programs where id=p_program_id and athlete_id=public.current_athlete_id() and status='draft' for update) then raise exception 'Editable draft not found' using errcode='P0002'; end if;
  if jsonb_typeof(p_structure->'blocks') is distinct from 'array' or jsonb_array_length(p_structure->'blocks')=0 then raise exception 'At least one block is required' using errcode='22023'; end if;
  delete from public.prescription_sets ps using public.exercise_prescriptions ep, public.training_days d, public.training_weeks w, public.training_blocks b
    where ps.exercise_prescription_id=ep.id and ep.training_day_id=d.id and d.training_week_id=w.id and w.training_block_id=b.id and b.training_program_id=p_program_id;
  delete from public.exercise_prescriptions ep using public.training_days d, public.training_weeks w, public.training_blocks b
    where ep.training_day_id=d.id and d.training_week_id=w.id and w.training_block_id=b.id and b.training_program_id=p_program_id;
  delete from public.training_days d using public.training_weeks w, public.training_blocks b
    where d.training_week_id=w.id and w.training_block_id=b.id and b.training_program_id=p_program_id;
  delete from public.training_weeks w using public.training_blocks b
    where w.training_block_id=b.id and b.training_program_id=p_program_id;
  delete from public.training_blocks where training_program_id=p_program_id;
  for block in select value from jsonb_array_elements(p_structure->'blocks') loop
    insert into public.training_blocks(training_program_id,sequence,name,description) values(p_program_id,(block->>'sequence')::integer,block->>'name',block->>'description') returning id into block_id;
    for week in select value from jsonb_array_elements(block->'weeks') loop
      insert into public.training_weeks(training_block_id,sequence,name,notes) values(block_id,(week->>'sequence')::integer,week->>'name',week->>'notes') returning id into week_id;
      for day_item in select value from jsonb_array_elements(week->'days') loop
        insert into public.training_days(training_week_id,sequence,name,preferred_weekday,notes) values(week_id,(day_item->>'sequence')::integer,day_item->>'name',nullif(day_item->>'preferredWeekday','')::smallint,day_item->>'notes') returning id into day_id;
        for prescription in select value from jsonb_array_elements(day_item->'prescriptions') loop
          insert into public.exercise_prescriptions(training_day_id,exercise_id,sequence,instructions,athlete_cues) values(day_id,(prescription->>'exerciseId')::uuid,(prescription->>'sequence')::integer,prescription->>'instructions',prescription->>'athleteCues') returning id into prescription_id;
          for set_item in select value from jsonb_array_elements(prescription->'sets') loop
            insert into public.prescription_sets(exercise_prescription_id,sequence,target_metric,target_min,target_max,rir_min,rir_max,rest_min_seconds,rest_max_seconds,tempo,load_kind,load_kg) values(prescription_id,(set_item->>'sequence')::integer,set_item->>'targetMetric',(set_item->>'targetMin')::numeric,(set_item->>'targetMax')::numeric,nullif(set_item->>'rirMin','')::smallint,nullif(set_item->>'rirMax','')::smallint,nullif(set_item->>'restMinSeconds','')::integer,nullif(set_item->>'restMaxSeconds','')::integer,set_item->>'tempo',set_item->>'loadKind',nullif(set_item->>'loadKg','')::numeric);
          end loop;
        end loop;
      end loop;
    end loop;
  end loop;
end $$;

comment on function public.replace_training_program_structure(uuid,jsonb) is
  'Atomically replaces the whole structure of an owned draft; removes children leaf-first so structure guards can resolve the draft.';
