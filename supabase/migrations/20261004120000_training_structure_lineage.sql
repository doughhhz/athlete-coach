-- Implementation Phase 18 (ADR-0091..0094): stable training structure lineage.
-- "Revision identity is not sequence identity."
-- "Reordering an existing training element does not make it a new element."
-- "Lineage identifies structural continuity; it does not imply semantic
--  equivalence of changed exercise content."
-- Forward only. No primary key changes, no historical rewrite.

-- 1. Lineage columns. Every existing row becomes its own lineage root (the
--    volatile default is evaluated per row). Continuity across revisions that
--    happened before this migration is NOT reconstructed: unknown continuity is
--    preferred to a false link (ADR-0093).
alter table public.training_blocks add column lineage_id uuid not null default gen_random_uuid();
alter table public.training_weeks add column lineage_id uuid not null default gen_random_uuid();
alter table public.training_days add column lineage_id uuid not null default gen_random_uuid();
alter table public.exercise_prescriptions add column lineage_id uuid not null default gen_random_uuid();
alter table public.prescription_sets add column lineage_id uuid not null default gen_random_uuid();
comment on column public.exercise_prescriptions.lineage_id is
  'Stable structural identity across revisions (preserved by clone, materialization and draft saves). Not a row id, not a sequence, not exercise identity.';

-- 2. Program-level continuity flag: true only for programs created by
--    lineage-aware paths (after this migration). Legacy programs keep false and
--    their comparisons use the explicit legacy positional fallback.
alter table public.training_programs add column lineage_tracked boolean not null default false;
alter table public.training_programs alter column lineage_tracked set default true;
comment on column public.training_programs.lineage_tracked is
  'True when this revision was created with lineage preserved from its source (or from scratch after Implementation Phase 18). False for legacy rows: continuity unknown.';

create function public.enforce_training_program_lineage_flag() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then new.lineage_tracked := true;
  elsif new.lineage_tracked is distinct from old.lineage_tracked then raise exception 'Lineage continuity flag is immutable' using errcode='55000';
  end if;
  return new;
end $$;
create trigger training_programs_lineage_flag before insert or update on public.training_programs for each row execute function public.enforce_training_program_lineage_flag();

-- 3. Server-controlled assignment: lineage is immutable, and only trusted
--    structure RPCs may carry an existing lineage into new rows; any other
--    insert (e.g. a direct client write) always receives a fresh lineage.
create function public.enforce_training_lineage() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if new.lineage_id is distinct from old.lineage_id then raise exception 'Structure lineage is immutable' using errcode='55000'; end if;
  elsif current_setting('app.training_lineage_write',true) is distinct from 'preserve' or new.lineage_id is null then
    new.lineage_id := gen_random_uuid();
  end if;
  return new;
end $$;
create trigger training_blocks_lineage before insert or update on public.training_blocks for each row execute function public.enforce_training_lineage();
create trigger training_weeks_lineage before insert or update on public.training_weeks for each row execute function public.enforce_training_lineage();
create trigger training_days_lineage before insert or update on public.training_days for each row execute function public.enforce_training_lineage();
create trigger exercise_prescriptions_lineage before insert or update on public.exercise_prescriptions for each row execute function public.enforce_training_lineage();
create trigger prescription_sets_lineage before insert or update on public.prescription_sets for each row execute function public.enforce_training_lineage();

-- 4. Manual revision clone preserves lineage.
create or replace function public.clone_training_program_as_draft(p_program_id uuid) returns public.training_programs language plpgsql security invoker set search_path='' as $$
declare source public.training_programs; result public.training_programs; b record; w record; d record; ep record; new_b uuid; new_w uuid; new_d uuid; new_ep uuid;
begin select * into source from public.training_programs where id=p_program_id and athlete_id=public.current_athlete_id() and status in ('active','completed','archived'); if source.id is null then raise exception 'Program not found or not revisionable' using errcode='P0002'; end if;
  insert into public.training_programs(athlete_id,athlete_goal_id,name,description,revision,supersedes_program_id) values(source.athlete_id,source.athlete_goal_id,source.name||' — revisão',source.description,source.revision+1,source.id) returning * into result;
  perform set_config('app.training_lineage_write','preserve',true);
  for b in select * from public.training_blocks where training_program_id=source.id order by sequence loop insert into public.training_blocks(lineage_id,training_program_id,sequence,name,description) values(b.lineage_id,result.id,b.sequence,b.name,b.description) returning id into new_b;
    for w in select * from public.training_weeks where training_block_id=b.id order by sequence loop insert into public.training_weeks(lineage_id,training_block_id,sequence,name,notes) values(w.lineage_id,new_b,w.sequence,w.name,w.notes) returning id into new_w;
      for d in select * from public.training_days where training_week_id=w.id order by sequence loop insert into public.training_days(lineage_id,training_week_id,sequence,name,preferred_weekday,notes) values(d.lineage_id,new_w,d.sequence,d.name,d.preferred_weekday,d.notes) returning id into new_d;
        for ep in select * from public.exercise_prescriptions where training_day_id=d.id order by sequence loop insert into public.exercise_prescriptions(lineage_id,training_day_id,exercise_id,sequence,instructions,athlete_cues) values(ep.lineage_id,new_d,ep.exercise_id,ep.sequence,ep.instructions,ep.athlete_cues) returning id into new_ep;
          insert into public.prescription_sets(lineage_id,exercise_prescription_id,sequence,target_metric,target_min,target_max,rir_min,rir_max,rest_min_seconds,rest_max_seconds,tempo,load_kind,load_kg) select lineage_id,new_ep,sequence,target_metric,target_min,target_max,rir_min,rir_max,rest_min_seconds,rest_max_seconds,tempo,load_kind,load_kg from public.prescription_sets where exercise_prescription_id=ep.id order by sequence;
        end loop; end loop; end loop; end loop;
  perform set_config('app.training_lineage_write','',true);
  return result;
end $$;

-- 5. Draft save preserves lineage of existing nodes. A provided lineageId must
--    belong to the same level of THIS draft (no cross-program or cross-level
--    injection, no duplicates); nodes without lineageId are new.
create or replace function public.replace_training_program_structure(p_program_id uuid,p_structure jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare block jsonb; week jsonb; day_item jsonb; prescription jsonb; set_item jsonb; block_id uuid; week_id uuid; day_id uuid; prescription_id uuid;
  level record; allowed uuid[]; provided uuid[];
begin
  if not exists(select 1 from public.training_programs where id=p_program_id and athlete_id=public.current_athlete_id() and status='draft' for update) then raise exception 'Editable draft not found' using errcode='P0002'; end if;
  if jsonb_typeof(p_structure->'blocks') is distinct from 'array' or jsonb_array_length(p_structure->'blocks')=0 then raise exception 'At least one block is required' using errcode='22023'; end if;
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
end $$;
comment on function public.replace_training_program_structure(uuid,jsonb) is
  'Atomically replaces an owned draft structure; preserves validated lineage of existing nodes (same draft, same level, unique); new nodes get new lineage.';

-- 6. Single materialization engine (Coach, set-count, replacement, auto-draft)
--    now preserves lineage: same logic as 20260930120000, lineage columns added.
create or replace function public.materialize_coach_decision(p_user_id uuid,p_decision_id uuid) returns public.coach_decisions language plpgsql security definer set search_path='' as $$
declare decision public.coach_decisions; source public.training_programs; draft public.training_programs; b record; w record; d record; ep record; s record; action jsonb; replacement jsonb; actions jsonb; allows_sets boolean; allows_replace boolean; new_b uuid; new_w uuid; new_d uuid; new_ep uuid; seq integer; source_exercise uuid;
begin
  select cd.* into decision from public.coach_decisions cd join public.athletes a on a.id=cd.athlete_id where cd.id=p_decision_id and a.user_id=p_user_id for update of cd;
  if decision.id is null then raise exception 'Decision not found' using errcode='P0002'; end if;
  if decision.status='materialized' then return decision; end if;
  if decision.status<>'proposed' then raise exception 'Decision already terminal' using errcode='55000'; end if;
  select * into source from public.training_programs where id=decision.source_program_id and athlete_id=decision.athlete_id for update;
  if source.status<>'active' or source.revision<>decision.source_program_revision then perform set_config('app.coach_decision_transition','allowed',true); update public.coach_decisions set status='stale',stale_at=now() where id=decision.id returning * into decision; return decision; end if;
  actions := decision.proposal_snapshot->'actions';
  allows_sets := decision.proposal_schema_version in ('coach-proposal-v2','coach-proposal-v3');
  allows_replace := decision.proposal_schema_version='coach-proposal-v3';
  for action in select value from jsonb_array_elements(actions) loop
    if action->>'kind' in ('adjust_prescription_target','adjust_prescription_rir','adjust_prescription_rest','adjust_absolute_load_target','remove_prescription_set') and (allows_sets or action->>'kind'<>'remove_prescription_set') then
      if not exists(select 1 from public.prescription_sets ps join public.exercise_prescriptions e on e.id=ps.exercise_prescription_id join public.training_days td on td.id=e.training_day_id join public.training_weeks tw on tw.id=td.training_week_id join public.training_blocks tb on tb.id=tw.training_block_id where ps.id=(action->>'prescriptionSetId')::uuid and e.id=(action->>'exercisePrescriptionId')::uuid and td.id=(action->>'trainingDayId')::uuid and tb.training_program_id=source.id) then raise exception 'Proposal references missing source entity' using errcode='22023'; end if;
    elsif allows_sets and action->>'kind'='add_prescription_set' then
      if not exists(select 1 from public.exercise_prescriptions e join public.training_days td on td.id=e.training_day_id join public.training_weeks tw on tw.id=td.training_week_id join public.training_blocks tb on tb.id=tw.training_block_id where e.id=(action->>'exercisePrescriptionId')::uuid and td.id=(action->>'trainingDayId')::uuid and tb.training_program_id=source.id) then raise exception 'Proposal references missing source entity' using errcode='22023'; end if;
      if action->>'copyFromPrescriptionSetId' is not null and not exists(select 1 from public.prescription_sets ps where ps.id=(action->>'copyFromPrescriptionSetId')::uuid and ps.exercise_prescription_id=(action->>'exercisePrescriptionId')::uuid) then raise exception 'Copy source must belong to the same prescription' using errcode='22023'; end if;
      if jsonb_typeof(action->'plannedSet') is distinct from 'object' then raise exception 'Added set must be explicit' using errcode='22023'; end if;
    elsif allows_replace and action->>'kind'='replace_exercise' then
      select e.exercise_id into source_exercise from public.exercise_prescriptions e join public.training_days td on td.id=e.training_day_id join public.training_weeks tw on tw.id=td.training_week_id join public.training_blocks tb on tb.id=tw.training_block_id where e.id=(action->>'exercisePrescriptionId')::uuid and td.id=(action->>'trainingDayId')::uuid and tb.training_program_id=source.id;
      if source_exercise is null then raise exception 'Proposal references missing source entity' using errcode='22023'; end if;
      if source_exercise<>(action->>'sourceExerciseId')::uuid then raise exception 'Source exercise does not match the prescription' using errcode='22023'; end if;
      if (action->>'replacementExerciseId')::uuid=source_exercise then raise exception 'Replacement must differ from the source exercise' using errcode='22023'; end if;
      if not exists(select 1 from public.exercises x where x.id=(action->>'replacementExerciseId')::uuid and x.is_active) then raise exception 'Replacement exercise not found' using errcode='22023'; end if;
      -- Relation context must equal the stored, directed rows exactly.
      if not exists(select 1 from public.exercise_relations r where (r.source_exercise_id=(action->>'replacementExerciseId')::uuid and r.target_exercise_id=source_exercise) or (r.source_exercise_id=source_exercise and r.target_exercise_id=(action->>'replacementExerciseId')::uuid)) then raise exception 'Replacement requires a stored exercise relation' using errcode='22023'; end if;
      if exists(
        (select r.relation_type||':candidate_to_source' from public.exercise_relations r where r.source_exercise_id=(action->>'replacementExerciseId')::uuid and r.target_exercise_id=source_exercise
         union select r.relation_type||':source_to_candidate' from public.exercise_relations r where r.source_exercise_id=source_exercise and r.target_exercise_id=(action->>'replacementExerciseId')::uuid)
        except select (c.value->>'relationType')||':'||(c.value->>'direction') from jsonb_array_elements(action->'relationshipContext') c
      ) or exists(
        select (c.value->>'relationType')||':'||(c.value->>'direction') from jsonb_array_elements(action->'relationshipContext') c
        except (select r.relation_type||':candidate_to_source' from public.exercise_relations r where r.source_exercise_id=(action->>'replacementExerciseId')::uuid and r.target_exercise_id=source_exercise
         union select r.relation_type||':source_to_candidate' from public.exercise_relations r where r.source_exercise_id=source_exercise and r.target_exercise_id=(action->>'replacementExerciseId')::uuid)
      ) then raise exception 'Relationship context does not match stored relations' using errcode='22023'; end if;
      -- Absolute load is never copied or converted across exercises.
      if action#>>'{loadTransition,mode}'='preserve_non_absolute' then
        if exists(select 1 from public.prescription_sets ps where ps.exercise_prescription_id=(action->>'exercisePrescriptionId')::uuid and ps.load_kind='absolute' and not exists(select 1 from jsonb_array_elements(actions) x where x.value->>'kind'='remove_prescription_set' and x.value->>'prescriptionSetId'=ps.id::text))
          or exists(select 1 from jsonb_array_elements(actions) x where x.value->>'kind'='add_prescription_set' and x.value->>'exercisePrescriptionId'=action->>'exercisePrescriptionId' and x.value#>>'{plannedSet,loadKind}'='absolute')
        then raise exception 'Absolute load cannot be preserved across a replacement' using errcode='22023'; end if;
      elsif action#>>'{loadTransition,mode}'='explicit_absolute' then
        if coalesce((action#>>'{loadTransition,loadKg}')::numeric,0)<=0 then raise exception 'Explicit replacement load must be positive' using errcode='22023'; end if;
      elsif action#>>'{loadTransition,mode}' is distinct from 'athlete_selected' then
        raise exception 'Invalid load transition' using errcode='22023';
      end if;
      if exists(select 1 from jsonb_array_elements(actions) x where x.value->>'kind'='adjust_absolute_load_target' and x.value->>'exercisePrescriptionId'=action->>'exercisePrescriptionId') then raise exception 'Absolute load of a replaced prescription comes only from its load transition' using errcode='22023'; end if;
    else
      raise exception 'Unsupported proposal action' using errcode='22023';
    end if;
  end loop;
  if (select count(*)<>count(distinct value->>'prescriptionSetId') from jsonb_array_elements(actions) where value->>'kind' not in ('add_prescription_set','replace_exercise')) then raise exception 'Duplicate proposal target' using errcode='22023'; end if;
  if (select count(*)<>count(distinct value->>'exercisePrescriptionId') from jsonb_array_elements(actions) where value->>'kind'='replace_exercise') then raise exception 'Duplicate replacement' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(actions) a join jsonb_array_elements(actions) r on r.value->>'kind'='remove_prescription_set' and r.value->>'prescriptionSetId'=a.value->>'copyFromPrescriptionSetId' where a.value->>'kind'='add_prescription_set') then raise exception 'Copy source is removed by the same proposal' using errcode='22023'; end if;
  if exists(
    select 1 from public.exercise_prescriptions e join public.training_days td on td.id=e.training_day_id join public.training_weeks tw on tw.id=td.training_week_id join public.training_blocks tb on tb.id=tw.training_block_id
    where tb.training_program_id=source.id
      and (select count(*) from public.prescription_sets ps where ps.exercise_prescription_id=e.id)
        - (select count(*) from jsonb_array_elements(actions) x where x.value->>'kind'='remove_prescription_set' and x.value->>'exercisePrescriptionId'=e.id::text)
        + (select count(*) from jsonb_array_elements(actions) x where x.value->>'kind'='add_prescription_set' and x.value->>'exercisePrescriptionId'=e.id::text) < 1
  ) then raise exception 'A prescription must keep at least one set' using errcode='22023'; end if;
  insert into public.training_programs(athlete_id,athlete_goal_id,name,description,revision,supersedes_program_id) values(source.athlete_id,source.athlete_goal_id,source.name||' — revisão',source.description,source.revision+1,source.id) returning * into draft;
  perform set_config('app.training_lineage_write','preserve',true);
  for b in select * from public.training_blocks where training_program_id=source.id order by sequence loop insert into public.training_blocks(lineage_id,training_program_id,sequence,name,description) values(b.lineage_id,draft.id,b.sequence,b.name,b.description) returning id into new_b;
    for w in select * from public.training_weeks where training_block_id=b.id order by sequence loop insert into public.training_weeks(lineage_id,training_block_id,sequence,name,notes) values(w.lineage_id,new_b,w.sequence,w.name,w.notes) returning id into new_w;
      for d in select * from public.training_days where training_week_id=w.id order by sequence loop insert into public.training_days(lineage_id,training_week_id,sequence,name,preferred_weekday,notes) values(d.lineage_id,new_w,d.sequence,d.name,d.preferred_weekday,d.notes) returning id into new_d;
        for ep in select * from public.exercise_prescriptions where training_day_id=d.id order by sequence loop
          -- Order: remove → per-set adjust → append adds → replacement (exercise + load transition) → contiguous sequence.
          select value into replacement from jsonb_array_elements(actions) where value->>'kind'='replace_exercise' and value->>'exercisePrescriptionId'=ep.id::text limit 1;
          insert into public.exercise_prescriptions(lineage_id,training_day_id,exercise_id,sequence,instructions,athlete_cues) values(ep.lineage_id,new_d,coalesce((replacement->>'replacementExerciseId')::uuid,ep.exercise_id),ep.sequence,ep.instructions,ep.athlete_cues) returning id into new_ep;
          seq := 0;
          for s in select * from public.prescription_sets ps where ps.exercise_prescription_id=ep.id and not exists(select 1 from jsonb_array_elements(actions) x where x.value->>'kind'='remove_prescription_set' and x.value->>'prescriptionSetId'=ps.id::text) order by ps.sequence loop
            seq := seq+1;
            select value into action from jsonb_array_elements(actions) where value->>'prescriptionSetId'=s.id::text and value->>'kind' like 'adjust_%' limit 1;
            insert into public.prescription_sets(lineage_id,exercise_prescription_id,sequence,target_metric,target_min,target_max,rir_min,rir_max,rest_min_seconds,rest_max_seconds,tempo,load_kind,load_kg) values(s.lineage_id,new_ep,seq,case when action->>'kind'='adjust_prescription_target' then action->>'targetMetric' else s.target_metric end,case when action->>'kind'='adjust_prescription_target' then (action->>'targetMin')::numeric else s.target_min end,case when action->>'kind'='adjust_prescription_target' then (action->>'targetMax')::numeric else s.target_max end,case when action->>'kind'='adjust_prescription_rir' then (action->>'rirMin')::smallint else s.rir_min end,case when action->>'kind'='adjust_prescription_rir' then (action->>'rirMax')::smallint else s.rir_max end,case when action->>'kind'='adjust_prescription_rest' then (action->>'restMinSeconds')::integer else s.rest_min_seconds end,case when action->>'kind'='adjust_prescription_rest' then (action->>'restMaxSeconds')::integer else s.rest_max_seconds end,s.tempo,case when action->>'kind'='adjust_absolute_load_target' then 'absolute' else s.load_kind end,case when action->>'kind'='adjust_absolute_load_target' then (action->>'loadKg')::numeric else s.load_kg end);
            action:=null;
          end loop;
          for action in select x.value from jsonb_array_elements(actions) with ordinality as x(value,ord) where x.value->>'kind'='add_prescription_set' and x.value->>'exercisePrescriptionId'=ep.id::text order by x.ord loop
            seq := seq+1;
            insert into public.prescription_sets(exercise_prescription_id,sequence,target_metric,target_min,target_max,rir_min,rir_max,rest_min_seconds,rest_max_seconds,tempo,load_kind,load_kg) values(new_ep,seq,action#>>'{plannedSet,targetMetric}',(action#>>'{plannedSet,targetMin}')::numeric,(action#>>'{plannedSet,targetMax}')::numeric,(action#>>'{plannedSet,rirMin}')::smallint,(action#>>'{plannedSet,rirMax}')::smallint,(action#>>'{plannedSet,restMinSeconds}')::integer,(action#>>'{plannedSet,restMaxSeconds}')::integer,action#>>'{plannedSet,tempo}',action#>>'{plannedSet,loadKind}',(action#>>'{plannedSet,loadKg}')::numeric);
          end loop;
          action:=null;
          if replacement is not null then
            if replacement#>>'{loadTransition,mode}'='athlete_selected' then
              update public.prescription_sets set load_kind='athlete_selected',load_kg=null where exercise_prescription_id=new_ep;
            elsif replacement#>>'{loadTransition,mode}'='explicit_absolute' then
              update public.prescription_sets set load_kind='absolute',load_kg=(replacement#>>'{loadTransition,loadKg}')::numeric where exercise_prescription_id=new_ep;
            end if;
          end if;
          replacement:=null;
        end loop;
      end loop;
    end loop;
  end loop;
  perform set_config('app.training_lineage_write','',true);
  perform set_config('app.coach_decision_transition','allowed',true);
  update public.coach_decisions set status='materialized',approved_at=now(),materialized_at=now(),materialized_program_id=draft.id where id=decision.id returning * into decision;
  return decision;
end $$;
comment on function public.materialize_coach_decision(uuid,uuid) is
  'Idempotent materialization engine of coach-proposal-v1/v2/v3 into a new draft revision that preserves structural lineage; human approval unless invoked by auto_draft_coach_decision. Never activates.';
