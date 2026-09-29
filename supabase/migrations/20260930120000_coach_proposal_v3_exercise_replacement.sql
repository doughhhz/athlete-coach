-- Phase 14 (ADR-0068..0071): coach-proposal-v3 adds replace_exercise with an
-- explicit load transition. v1/v2 snapshots keep their exact behavior.
-- The RPC never trusts the model or the application alone: the replacement is
-- re-validated against the stored relation graph before touching the draft.
alter table public.coach_decisions drop constraint coach_decisions_proposal_schema_version_check;
alter table public.coach_decisions add constraint coach_decisions_proposal_schema_version_check
  check (proposal_schema_version in ('coach-proposal-v1','coach-proposal-v2','coach-proposal-v3'));

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
  for b in select * from public.training_blocks where training_program_id=source.id order by sequence loop insert into public.training_blocks(training_program_id,sequence,name,description) values(draft.id,b.sequence,b.name,b.description) returning id into new_b;
    for w in select * from public.training_weeks where training_block_id=b.id order by sequence loop insert into public.training_weeks(training_block_id,sequence,name,notes) values(new_b,w.sequence,w.name,w.notes) returning id into new_w;
      for d in select * from public.training_days where training_week_id=w.id order by sequence loop insert into public.training_days(training_week_id,sequence,name,preferred_weekday,notes) values(new_w,d.sequence,d.name,d.preferred_weekday,d.notes) returning id into new_d;
        for ep in select * from public.exercise_prescriptions where training_day_id=d.id order by sequence loop
          -- Order: remove → per-set adjust → append adds → replacement (exercise + load transition) → contiguous sequence.
          select value into replacement from jsonb_array_elements(actions) where value->>'kind'='replace_exercise' and value->>'exercisePrescriptionId'=ep.id::text limit 1;
          insert into public.exercise_prescriptions(training_day_id,exercise_id,sequence,instructions,athlete_cues) values(new_d,coalesce((replacement->>'replacementExerciseId')::uuid,ep.exercise_id),ep.sequence,ep.instructions,ep.athlete_cues) returning id into new_ep;
          seq := 0;
          for s in select * from public.prescription_sets ps where ps.exercise_prescription_id=ep.id and not exists(select 1 from jsonb_array_elements(actions) x where x.value->>'kind'='remove_prescription_set' and x.value->>'prescriptionSetId'=ps.id::text) order by ps.sequence loop
            seq := seq+1;
            select value into action from jsonb_array_elements(actions) where value->>'prescriptionSetId'=s.id::text and value->>'kind' like 'adjust_%' limit 1;
            insert into public.prescription_sets(exercise_prescription_id,sequence,target_metric,target_min,target_max,rir_min,rir_max,rest_min_seconds,rest_max_seconds,tempo,load_kind,load_kg) values(new_ep,seq,case when action->>'kind'='adjust_prescription_target' then action->>'targetMetric' else s.target_metric end,case when action->>'kind'='adjust_prescription_target' then (action->>'targetMin')::numeric else s.target_min end,case when action->>'kind'='adjust_prescription_target' then (action->>'targetMax')::numeric else s.target_max end,case when action->>'kind'='adjust_prescription_rir' then (action->>'rirMin')::smallint else s.rir_min end,case when action->>'kind'='adjust_prescription_rir' then (action->>'rirMax')::smallint else s.rir_max end,case when action->>'kind'='adjust_prescription_rest' then (action->>'restMinSeconds')::integer else s.rest_min_seconds end,case when action->>'kind'='adjust_prescription_rest' then (action->>'restMaxSeconds')::integer else s.rest_max_seconds end,s.tempo,case when action->>'kind'='adjust_absolute_load_target' then 'absolute' else s.load_kind end,case when action->>'kind'='adjust_absolute_load_target' then (action->>'loadKg')::numeric else s.load_kg end);
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
  perform set_config('app.coach_decision_transition','allowed',true);
  update public.coach_decisions set status='materialized',approved_at=now(),materialized_at=now(),materialized_program_id=draft.id where id=decision.id returning * into decision;
  return decision;
end $$;

comment on function public.materialize_coach_decision(uuid,uuid) is
  'Human-approved, idempotent materialization of coach-proposal-v1/v2/v3 into a new draft revision; re-validates replacements against stored relations; never activates.';
