create table public.coach_decisions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  source_analysis_id text not null check (char_length(source_analysis_id) between 1 and 100),
  proposal_schema_version text not null check (proposal_schema_version = 'coach-proposal-v1'),
  proposal_snapshot jsonb not null check (jsonb_typeof(proposal_snapshot) = 'object' and proposal_snapshot->>'schemaVersion' = 'coach-proposal-v1' and proposal_snapshot->>'requiresHumanApproval' = 'true' and jsonb_array_length(proposal_snapshot->'actions') between 1 and 12),
  source_program_id uuid not null references public.training_programs(id) on delete restrict,
  source_program_revision integer not null check (source_program_revision > 0),
  status text not null default 'proposed' check (status in ('proposed','rejected','stale','materialized')),
  rejection_reason text check (rejection_reason is null or rejection_reason in ('not_now','disagree','prefer_current_program','other')),
  rejection_notes text check (rejection_notes is null or char_length(rejection_notes) <= 500),
  proposed_at timestamptz not null default now(), approved_at timestamptz, rejected_at timestamptz, stale_at timestamptz, materialized_at timestamptz,
  materialized_program_id uuid unique references public.training_programs(id) on delete restrict,
  provider text not null, model_identifier text not null, prompt_version text not null, safety_policy_version text not null, dossier_schema_version text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint coach_decision_lifecycle_check check (
    (status='proposed' and approved_at is null and rejected_at is null and stale_at is null and materialized_at is null and materialized_program_id is null) or
    (status='rejected' and approved_at is null and rejected_at is not null and stale_at is null and materialized_at is null and materialized_program_id is null) or
    (status='stale' and approved_at is null and rejected_at is null and stale_at is not null and materialized_at is null and materialized_program_id is null) or
    (status='materialized' and approved_at is not null and rejected_at is null and stale_at is null and materialized_at is not null and materialized_program_id is not null)
  )
);
create index coach_decisions_athlete_created_idx on public.coach_decisions(athlete_id,created_at desc);
create index coach_decisions_source_program_idx on public.coach_decisions(source_program_id,status);
create trigger coach_decisions_set_updated_at before update on public.coach_decisions for each row execute function public.set_updated_at();
alter table public.coach_decisions enable row level security;
revoke all on public.coach_decisions from public,anon,authenticated;
grant select on public.coach_decisions to authenticated;
grant all on public.coach_decisions to service_role;
create policy coach_decisions_select_own on public.coach_decisions for select to authenticated using (athlete_id=public.current_athlete_id());

create function public.guard_coach_decision_history() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'Coach decisions are immutable history' using errcode='55000'; end if;
  if old.athlete_id<>new.athlete_id or old.source_analysis_id<>new.source_analysis_id or old.proposal_schema_version<>new.proposal_schema_version or old.proposal_snapshot<>new.proposal_snapshot or old.source_program_id<>new.source_program_id or old.source_program_revision<>new.source_program_revision or old.provider<>new.provider or old.model_identifier<>new.model_identifier or old.prompt_version<>new.prompt_version or old.safety_policy_version<>new.safety_policy_version or old.dossier_schema_version<>new.dossier_schema_version then raise exception 'Coach proposal snapshot and provenance are immutable' using errcode='55000'; end if;
  if old.status<>'proposed' then raise exception 'Terminal coach decisions are immutable' using errcode='55000'; end if;
  if current_setting('app.coach_decision_transition',true) is distinct from 'allowed' then raise exception 'Coach decision transitions require controlled operation' using errcode='55000'; end if;
  return new;
end $$;
create trigger coach_decisions_history_guard before update or delete on public.coach_decisions for each row execute function public.guard_coach_decision_history();

create function public.create_coach_decision(p_user_id uuid,p_proposal jsonb) returns public.coach_decisions language plpgsql security definer set search_path='' as $$
declare a uuid; result public.coach_decisions;
begin
  select id into a from public.athletes where user_id=p_user_id;
  if a is null then raise exception 'Athlete not found' using errcode='P0002'; end if;
  if not exists(select 1 from public.training_programs where id=(p_proposal->>'sourceProgramId')::uuid and athlete_id=a and revision=(p_proposal->>'sourceProgramRevision')::integer and status='active') then raise exception 'Source program is not the active baseline' using errcode='55000'; end if;
  insert into public.coach_decisions(id,athlete_id,source_analysis_id,proposal_schema_version,proposal_snapshot,source_program_id,source_program_revision,provider,model_identifier,prompt_version,safety_policy_version,dossier_schema_version)
  values((p_proposal->>'id')::uuid,a,p_proposal->>'analysisId',p_proposal->>'schemaVersion',p_proposal,(p_proposal->>'sourceProgramId')::uuid,(p_proposal->>'sourceProgramRevision')::integer,p_proposal#>>'{analysisSnapshot,provider}',p_proposal#>>'{analysisSnapshot,model}',p_proposal#>>'{analysisSnapshot,promptVersion}',p_proposal#>>'{analysisSnapshot,policyVersion}',p_proposal#>>'{analysisSnapshot,dossierSchemaVersion}') returning * into result;
  return result;
end $$;

create function public.reject_coach_decision(p_user_id uuid,p_decision_id uuid,p_reason text,p_notes text default null) returns public.coach_decisions language plpgsql security definer set search_path='' as $$
declare result public.coach_decisions;
begin
  perform set_config('app.coach_decision_transition','allowed',true);
  update public.coach_decisions d set status='rejected',rejection_reason=p_reason,rejection_notes=p_notes,rejected_at=now() from public.athletes a where d.id=p_decision_id and d.athlete_id=a.id and a.user_id=p_user_id and d.status='proposed' returning d.* into result;
  if result.id is null then raise exception 'Decision not found or already decided' using errcode='55000'; end if;
  return result;
end $$;

create function public.materialize_coach_decision(p_user_id uuid,p_decision_id uuid) returns public.coach_decisions language plpgsql security definer set search_path='' as $$
declare decision public.coach_decisions; source public.training_programs; draft public.training_programs; b record; w record; d record; ep record; s record; action jsonb; new_b uuid; new_w uuid; new_d uuid; new_ep uuid; values_row record;
begin
  select cd.* into decision from public.coach_decisions cd join public.athletes a on a.id=cd.athlete_id where cd.id=p_decision_id and a.user_id=p_user_id for update of cd;
  if decision.id is null then raise exception 'Decision not found' using errcode='P0002'; end if;
  if decision.status='materialized' then return decision; end if;
  if decision.status<>'proposed' then raise exception 'Decision already terminal' using errcode='55000'; end if;
  select * into source from public.training_programs where id=decision.source_program_id and athlete_id=decision.athlete_id for update;
  if source.status<>'active' or source.revision<>decision.source_program_revision then perform set_config('app.coach_decision_transition','allowed',true); update public.coach_decisions set status='stale',stale_at=now() where id=decision.id returning * into decision; return decision; end if;
  if (select count(*)<>count(distinct value->>'prescriptionSetId') from jsonb_array_elements(decision.proposal_snapshot->'actions')) then raise exception 'Duplicate proposal target' using errcode='22023'; end if;
  for action in select value from jsonb_array_elements(decision.proposal_snapshot->'actions') loop
    if action->>'kind' not in ('adjust_prescription_target','adjust_prescription_rir','adjust_prescription_rest','adjust_absolute_load_target') then raise exception 'Unsupported proposal action' using errcode='22023'; end if;
    if not exists(select 1 from public.prescription_sets ps join public.exercise_prescriptions e on e.id=ps.exercise_prescription_id join public.training_days td on td.id=e.training_day_id join public.training_weeks tw on tw.id=td.training_week_id join public.training_blocks tb on tb.id=tw.training_block_id where ps.id=(action->>'prescriptionSetId')::uuid and e.id=(action->>'exercisePrescriptionId')::uuid and td.id=(action->>'trainingDayId')::uuid and tb.training_program_id=source.id) then raise exception 'Proposal references missing source entity' using errcode='22023'; end if;
  end loop;
  insert into public.training_programs(athlete_id,athlete_goal_id,name,description,revision,supersedes_program_id) values(source.athlete_id,source.athlete_goal_id,source.name||' — revisão',source.description,source.revision+1,source.id) returning * into draft;
  for b in select * from public.training_blocks where training_program_id=source.id order by sequence loop insert into public.training_blocks(training_program_id,sequence,name,description) values(draft.id,b.sequence,b.name,b.description) returning id into new_b;
    for w in select * from public.training_weeks where training_block_id=b.id order by sequence loop insert into public.training_weeks(training_block_id,sequence,name,notes) values(new_b,w.sequence,w.name,w.notes) returning id into new_w;
      for d in select * from public.training_days where training_week_id=w.id order by sequence loop insert into public.training_days(training_week_id,sequence,name,preferred_weekday,notes) values(new_w,d.sequence,d.name,d.preferred_weekday,d.notes) returning id into new_d;
        for ep in select * from public.exercise_prescriptions where training_day_id=d.id order by sequence loop insert into public.exercise_prescriptions(training_day_id,exercise_id,sequence,instructions,athlete_cues) values(new_d,ep.exercise_id,ep.sequence,ep.instructions,ep.athlete_cues) returning id into new_ep;
          for s in select * from public.prescription_sets where exercise_prescription_id=ep.id order by sequence loop
            select value into action from jsonb_array_elements(decision.proposal_snapshot->'actions') where value->>'prescriptionSetId'=s.id::text limit 1;
            insert into public.prescription_sets(exercise_prescription_id,sequence,target_metric,target_min,target_max,rir_min,rir_max,rest_min_seconds,rest_max_seconds,tempo,load_kind,load_kg) values(new_ep,s.sequence,case when action->>'kind'='adjust_prescription_target' then action->>'targetMetric' else s.target_metric end,case when action->>'kind'='adjust_prescription_target' then (action->>'targetMin')::numeric else s.target_min end,case when action->>'kind'='adjust_prescription_target' then (action->>'targetMax')::numeric else s.target_max end,case when action->>'kind'='adjust_prescription_rir' then (action->>'rirMin')::smallint else s.rir_min end,case when action->>'kind'='adjust_prescription_rir' then (action->>'rirMax')::smallint else s.rir_max end,case when action->>'kind'='adjust_prescription_rest' then (action->>'restMinSeconds')::integer else s.rest_min_seconds end,case when action->>'kind'='adjust_prescription_rest' then (action->>'restMaxSeconds')::integer else s.rest_max_seconds end,s.tempo,case when action->>'kind'='adjust_absolute_load_target' then 'absolute' else s.load_kind end,case when action->>'kind'='adjust_absolute_load_target' then (action->>'loadKg')::numeric else s.load_kg end);
            action:=null;
          end loop;
        end loop;
      end loop;
    end loop;
  end loop;
  perform set_config('app.coach_decision_transition','allowed',true);
  update public.coach_decisions set status='materialized',approved_at=now(),materialized_at=now(),materialized_program_id=draft.id where id=decision.id returning * into decision;
  return decision;
end $$;

revoke all on function public.create_coach_decision(uuid,jsonb),public.reject_coach_decision(uuid,uuid,text,text),public.materialize_coach_decision(uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_coach_decision(uuid,jsonb),public.reject_coach_decision(uuid,uuid,text,text),public.materialize_coach_decision(uuid,uuid) to service_role;
