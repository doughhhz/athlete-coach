-- Phase 15 (ADR-0074..0077): coach governance, proactive mode preference and
-- idempotent proactive proposals. Initiative does not imply authority: nothing
-- here materializes or activates programs.

-- 1. Autonomy preference (athlete-owned; default manual) ----------------------
create table public.athlete_coach_preferences (
  athlete_id uuid primary key references public.athletes(id) on delete cascade,
  autonomy_mode text not null default 'manual' check (autonomy_mode in ('manual','proactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger athlete_coach_preferences_set_updated_at before update on public.athlete_coach_preferences for each row execute function public.set_updated_at();
alter table public.athlete_coach_preferences enable row level security;
revoke all on public.athlete_coach_preferences from public, anon, authenticated;
grant select, insert, update on public.athlete_coach_preferences to authenticated;
grant all on public.athlete_coach_preferences to service_role;
create policy athlete_coach_preferences_select_own on public.athlete_coach_preferences for select to authenticated using (athlete_id = (select public.current_athlete_id()));
create policy athlete_coach_preferences_insert_own on public.athlete_coach_preferences for insert to authenticated with check (athlete_id = (select public.current_athlete_id()));
create policy athlete_coach_preferences_update_own on public.athlete_coach_preferences for update to authenticated using (athlete_id = (select public.current_athlete_id())) with check (athlete_id = (select public.current_athlete_id()));

-- 2. Governance envelope on the runtime ledger ---------------------------------
alter table public.coach_decisions
  add column proposal_origin text not null default 'manual' check (proposal_origin in ('manual','proactive')),
  add column autonomy_mode_at_creation text check (autonomy_mode_at_creation is null or autonomy_mode_at_creation in ('manual','proactive')),
  add column analysis_request_id uuid,
  add column governance_policy_version text check (governance_policy_version is null or char_length(governance_policy_version) between 1 and 100),
  add column review_class text check (review_class is null or review_class in ('standard_review','elevated_review')),
  add column governance_reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(governance_reasons) = 'array' and jsonb_array_length(governance_reasons) <= 30);
alter table public.coach_decisions add constraint coach_decision_governance_check
  check ((governance_policy_version is null) = (review_class is null));
alter table public.coach_decisions add constraint coach_decision_proactive_envelope_check
  check (proposal_origin <> 'proactive' or (review_class is not null and analysis_request_id is not null and autonomy_mode_at_creation = 'proactive'));
-- One decision per analysis request and athlete (retries never duplicate).
create unique index coach_decisions_analysis_request_idx on public.coach_decisions (athlete_id, analysis_request_id) where analysis_request_id is not null;

-- Governance metadata is history: immutable like the snapshot/provenance.
create or replace function public.guard_coach_decision_history() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'Coach decisions are immutable history' using errcode='55000'; end if;
  if old.athlete_id<>new.athlete_id or old.source_analysis_id<>new.source_analysis_id or old.proposal_schema_version<>new.proposal_schema_version or old.proposal_snapshot<>new.proposal_snapshot or old.source_program_id<>new.source_program_id or old.source_program_revision<>new.source_program_revision or old.provider<>new.provider or old.model_identifier<>new.model_identifier or old.prompt_version<>new.prompt_version or old.safety_policy_version<>new.safety_policy_version or old.dossier_schema_version<>new.dossier_schema_version
    or old.proposal_origin is distinct from new.proposal_origin or old.autonomy_mode_at_creation is distinct from new.autonomy_mode_at_creation or old.analysis_request_id is distinct from new.analysis_request_id or old.governance_policy_version is distinct from new.governance_policy_version or old.review_class is distinct from new.review_class or old.governance_reasons is distinct from new.governance_reasons
  then raise exception 'Coach proposal snapshot and provenance are immutable' using errcode='55000'; end if;
  if old.status<>'proposed' then raise exception 'Terminal coach decisions are immutable' using errcode='55000'; end if;
  if current_setting('app.coach_decision_transition',true) is distinct from 'allowed' then raise exception 'Coach decision transitions require controlled operation' using errcode='55000'; end if;
  return new;
end $$;

-- 3. Governed, idempotent creation (backend-only) ------------------------------
-- The envelope is computed by the deterministic domain policy on the backend;
-- clients never call this function and cannot choose origin or review class.
create function public.create_coach_decision(p_user_id uuid, p_proposal jsonb, p_envelope jsonb) returns public.coach_decisions language plpgsql security definer set search_path='' as $$
declare a uuid; request uuid; result public.coach_decisions;
begin
  select id into a from public.athletes where user_id=p_user_id;
  if a is null then raise exception 'Athlete not found' using errcode='P0002'; end if;
  request := nullif(p_envelope->>'analysisRequestId','')::uuid;
  if request is not null then
    select * into result from public.coach_decisions where athlete_id=a and analysis_request_id=request;
    if result.id is not null then return result; end if;
  end if;
  if p_envelope->>'reviewClass' is null or p_envelope->>'governancePolicyVersion' is null then raise exception 'Governance assessment required' using errcode='22023'; end if;
  if not exists(select 1 from public.training_programs where id=(p_proposal->>'sourceProgramId')::uuid and athlete_id=a and revision=(p_proposal->>'sourceProgramRevision')::integer and status='active') then raise exception 'Source program is not the active baseline' using errcode='55000'; end if;
  insert into public.coach_decisions(id,athlete_id,source_analysis_id,proposal_schema_version,proposal_snapshot,source_program_id,source_program_revision,provider,model_identifier,prompt_version,safety_policy_version,dossier_schema_version,proposal_origin,autonomy_mode_at_creation,analysis_request_id,governance_policy_version,review_class,governance_reasons)
  values((p_proposal->>'id')::uuid,a,p_proposal->>'analysisId',p_proposal->>'schemaVersion',p_proposal,(p_proposal->>'sourceProgramId')::uuid,(p_proposal->>'sourceProgramRevision')::integer,p_proposal#>>'{analysisSnapshot,provider}',p_proposal#>>'{analysisSnapshot,model}',p_proposal#>>'{analysisSnapshot,promptVersion}',p_proposal#>>'{analysisSnapshot,policyVersion}',p_proposal#>>'{analysisSnapshot,dossierSchemaVersion}',
    coalesce(p_envelope->>'proposalOrigin','manual'),p_envelope->>'autonomyModeAtCreation',request,p_envelope->>'governancePolicyVersion',p_envelope->>'reviewClass',coalesce(p_envelope->'governanceReasons','[]'::jsonb))
  on conflict (athlete_id, analysis_request_id) where analysis_request_id is not null do nothing
  returning * into result;
  if result.id is null then select * into result from public.coach_decisions where athlete_id=a and analysis_request_id=request; end if;
  return result;
end $$;
revoke all on function public.create_coach_decision(uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.create_coach_decision(uuid,jsonb,jsonb) to service_role;
comment on function public.create_coach_decision(uuid,jsonb,jsonb) is
  'Backend-only governed creation: persists the deterministic governance envelope; idempotent per athlete and analysis request; never materializes.';
comment on function public.create_coach_decision(uuid,jsonb) is
  'Legacy (pre coach-governance-v1) creation kept for compatibility; records origin manual without governance. Not used by the application.';
