-- Corrective pass after Implementation Phase 18 (ADR-0095..0096): full draft
-- structure preservation.
-- "A partial editing surface must never imply a full-aggregate replacement."
-- "Saving one visible training node must preserve every untouched node in the draft."
-- The save RPC remains a whole-aggregate replacement (the builder now always
-- sends the whole tree); it additionally rejects incomplete trees and verifies
-- the resulting structure before commit. Lineage validation (ADR-0092) unchanged.
create or replace function public.replace_training_program_structure(p_program_id uuid,p_structure jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare block jsonb; week jsonb; day_item jsonb; prescription jsonb; set_item jsonb; block_id uuid; week_id uuid; day_id uuid; prescription_id uuid;
  level record; allowed uuid[]; provided uuid[];
begin
  if not exists(select 1 from public.training_programs where id=p_program_id and athlete_id=public.current_athlete_id() and status='draft' for update) then raise exception 'Editable draft not found' using errcode='P0002'; end if;
  if jsonb_typeof(p_structure->'blocks') is distinct from 'array' or jsonb_array_length(p_structure->'blocks')=0 then raise exception 'At least one block is required' using errcode='22023'; end if;
  -- The payload is the WHOLE draft (viewport is never the save scope): every
  -- level must be present and non-empty, so a partial tree cannot silently
  -- delete untouched nodes.
  if jsonb_path_exists(p_structure, '$.blocks[*] ? (!exists(@.weeks) || @.weeks.size() == 0)')
    or jsonb_path_exists(p_structure, '$.blocks[*].weeks[*] ? (!exists(@.days) || @.days.size() == 0)')
    or jsonb_path_exists(p_structure, '$.blocks[*].weeks[*].days[*] ? (!exists(@.prescriptions) || @.prescriptions.size() == 0)')
    or jsonb_path_exists(p_structure, '$.blocks[*].weeks[*].days[*].prescriptions[*] ? (!exists(@.sets) || @.sets.size() == 0)')
  then raise exception 'Incomplete program structure' using errcode='22023'; end if;
  for level in select * from (values
    ('$.blocks[*].lineageId', (select coalesce(array_agg(b.lineage_id),'{}') from public.training_blocks b where b.training_program_id=p_program_id)),
    ('$.blocks[*].weeks[*].lineageId', (select coalesce(array_agg(w.lineage_id),'{}') from public.training_weeks w join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program_id)),
    ('$.blocks[*].weeks[*].days[*].lineageId', (select coalesce(array_agg(d.lineage_id),'{}') from public.training_days d join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program_id)),
    ('$.blocks[*].weeks[*].days[*].prescriptions[*].lineageId', (select coalesce(array_agg(ep.lineage_id),'{}') from public.exercise_prescriptions ep join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program_id)),
    ('$.blocks[*].weeks[*].days[*].prescriptions[*].sets[*].lineageId', (select coalesce(array_agg(ps.lineage_id),'{}') from public.prescription_sets ps join public.exercise_prescriptions ep on ep.id=ps.exercise_prescription_id join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program_id))
  ) as t(path, lineages) loop
    select coalesce(array_agg((v #>> '{}')::uuid),'{}') into provided from jsonb_path_query(p_structure, level.path::jsonpath) v where jsonb_typeof(v)='string';
    allowed := level.lineages;
    if exists(select 1 from unnest(provided) p where not (p = any(allowed))) then raise exception 'Unknown structure lineage' using errcode='22023'; end if;
    if cardinality(provided) <> (select count(distinct p) from unnest(provided) p) then raise exception 'Duplicate structure lineage' using errcode='22023'; end if;
  end loop;
  delete from public.prescription_sets ps using public.exercise_prescriptions ep, public.training_days d, public.training_weeks w, public.training_blocks b
    where ps.exercise_prescription_id=ep.id and ep.training_day_id=d.id and d.training_week_id=w.id and w.training_block_id=b.id and b.training_program_id=p_program_id;
  delete from public.exercise_prescriptions ep using public.training_days d, public.training_weeks w, public.training_blocks b
    where ep.training_day_id=d.id and d.training_week_id=w.id and w.training_block_id=b.id and b.training_program_id=p_program_id;
  delete from public.training_days d using public.training_weeks w, public.training_blocks b
    where d.training_week_id=w.id and w.training_block_id=b.id and b.training_program_id=p_program_id;
  delete from public.training_weeks w using public.training_blocks b
    where w.training_block_id=b.id and b.training_program_id=p_program_id;
  delete from public.training_blocks where training_program_id=p_program_id;
  perform set_config('app.training_lineage_write','preserve',true);
  for block in select value from jsonb_array_elements(p_structure->'blocks') loop
    insert into public.training_blocks(lineage_id,training_program_id,sequence,name,description) values(nullif(block->>'lineageId','')::uuid,p_program_id,(block->>'sequence')::integer,block->>'name',block->>'description') returning id into block_id;
    for week in select value from jsonb_array_elements(block->'weeks') loop
      insert into public.training_weeks(lineage_id,training_block_id,sequence,name,notes) values(nullif(week->>'lineageId','')::uuid,block_id,(week->>'sequence')::integer,week->>'name',week->>'notes') returning id into week_id;
      for day_item in select value from jsonb_array_elements(week->'days') loop
        insert into public.training_days(lineage_id,training_week_id,sequence,name,preferred_weekday,notes) values(nullif(day_item->>'lineageId','')::uuid,week_id,(day_item->>'sequence')::integer,day_item->>'name',nullif(day_item->>'preferredWeekday','')::smallint,day_item->>'notes') returning id into day_id;
        for prescription in select value from jsonb_array_elements(day_item->'prescriptions') loop
          insert into public.exercise_prescriptions(lineage_id,training_day_id,exercise_id,sequence,instructions,athlete_cues) values(nullif(prescription->>'lineageId','')::uuid,day_id,(prescription->>'exerciseId')::uuid,(prescription->>'sequence')::integer,prescription->>'instructions',prescription->>'athleteCues') returning id into prescription_id;
          for set_item in select value from jsonb_array_elements(prescription->'sets') loop
            insert into public.prescription_sets(lineage_id,exercise_prescription_id,sequence,target_metric,target_min,target_max,rir_min,rir_max,rest_min_seconds,rest_max_seconds,tempo,load_kind,load_kg) values(nullif(set_item->>'lineageId','')::uuid,prescription_id,(set_item->>'sequence')::integer,set_item->>'targetMetric',(set_item->>'targetMin')::numeric,(set_item->>'targetMax')::numeric,nullif(set_item->>'rirMin','')::smallint,nullif(set_item->>'rirMax','')::smallint,nullif(set_item->>'restMinSeconds','')::integer,nullif(set_item->>'restMaxSeconds','')::integer,set_item->>'tempo',set_item->>'loadKind',nullif(set_item->>'loadKg','')::numeric);
          end loop;
        end loop;
      end loop;
    end loop;
  end loop;
  perform set_config('app.training_lineage_write','',true);
  -- Verify the resulting whole structure before commit (atomic: any failure
  -- rolls back the entire replacement).
  if exists(select 1 from public.training_blocks b where b.training_program_id=p_program_id and not exists(select 1 from public.training_weeks w where w.training_block_id=b.id))
    or exists(select 1 from public.training_weeks w join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program_id and not exists(select 1 from public.training_days d where d.training_week_id=w.id))
    or exists(select 1 from public.training_days d join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program_id and not exists(select 1 from public.exercise_prescriptions ep where ep.training_day_id=d.id))
    or exists(select 1 from public.exercise_prescriptions ep join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program_id and not exists(select 1 from public.prescription_sets ps where ps.exercise_prescription_id=ep.id))
  then raise exception 'Incomplete program structure' using errcode='22023'; end if;
end $$;
comment on function public.replace_training_program_structure(uuid,jsonb) is
  'Atomically replaces the WHOLE structure of an owned draft; rejects incomplete trees and verifies the result; preserves validated lineage of existing nodes (same draft, same level, unique); new nodes get new lineage.';
