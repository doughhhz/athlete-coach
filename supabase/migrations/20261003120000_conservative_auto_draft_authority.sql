-- Implementation Phase 16 (ADR-0082..0086): Conservative Auto-Draft authority and
-- analysis request fingerprint binding.
-- "Automatic draft creation is limited authority over an inactive revision,
--  never authority over the active training program."
-- Nothing here activates a program or mutates the active program.

-- 1. Request fingerprint (identity integrity, not authentication) --------------
alter table public.coach_analysis_runs
  add column request_fingerprint text check (request_fingerprint is null or request_fingerprint ~ '^[0-9a-f]{64}$');
comment on column public.coach_analysis_runs.request_fingerprint is
  'SHA-256 of the canonical validated analysis request (mode, question, bounded context). Binds analysisRequestId to the request; null only for records created before Implementation Phase 16. Not a secret and not authentication.';

create function public.record_coach_analysis_run(p_user_id uuid, p_analysis_request_id uuid, p_request_fingerprint text, p_analysis jsonb, p_source_program_id uuid default null, p_source_program_revision integer default null) returns public.coach_analysis_runs language plpgsql security definer set search_path='' as $$
declare a uuid; result public.coach_analysis_runs;
begin
  select id into a from public.athletes where user_id=p_user_id;
  if a is null then raise exception 'Athlete not found' using errcode='P0002'; end if;
  if p_request_fingerprint is null then raise exception 'Request fingerprint required' using errcode='22023'; end if;
  insert into public.coach_analysis_runs(athlete_id,analysis_request_id,request_fingerprint,analysis_schema_version,analysis_snapshot,training_advice_blocked,safety_policy_version,prompt_version,dossier_schema_version,provider,model_identifier,source_program_id,source_program_revision)
  values(a,p_analysis_request_id,p_request_fingerprint,p_analysis->>'schemaVersion',p_analysis,
    jsonb_path_exists(p_analysis,'$.safetyFlags[*] ? (@.blocksTrainingAdvice == true)'),
    p_analysis#>>'{metadata,policyVersion}',p_analysis#>>'{metadata,promptVersion}',p_analysis#>>'{metadata,dossierSchemaVersion}',p_analysis#>>'{metadata,provider}',p_analysis#>>'{metadata,model}',
    p_source_program_id,p_source_program_revision)
  on conflict (athlete_id, analysis_request_id) do nothing
  returning * into result;
  if result.id is null then
    select * into result from public.coach_analysis_runs where athlete_id=a and analysis_request_id=p_analysis_request_id;
    -- Same id bound to a different (or unbound legacy) request: never reuse.
    if result.request_fingerprint is distinct from p_request_fingerprint then raise exception 'Analysis request conflict' using errcode='23505'; end if;
  end if;
  return result;
end $$;
revoke all on function public.record_coach_analysis_run(uuid,uuid,text,jsonb,uuid,integer) from public, anon, authenticated;
grant execute on function public.record_coach_analysis_run(uuid,uuid,text,jsonb,uuid,integer) to service_role;
comment on function public.record_coach_analysis_run(uuid,uuid,jsonb,uuid,integer) is
  'Corrective-pass (unfingerprinted) recording; superseded for application use by the fingerprinted overload (ADR-0085). Backend-only.';

-- 2. Draft authority preference (independent from autonomy_mode) -------------
alter table public.athlete_coach_preferences
  add column draft_authority_mode text not null default 'manual_draft' check (draft_authority_mode in ('manual_draft','standard_auto_draft'));
comment on column public.athlete_coach_preferences.draft_authority_mode is
  'Explicit opt-in for Conservative Auto-Draft. Operational only when autonomy_mode = proactive; otherwise stored without effect.';

-- 3. Auto-draft assessment and materialization provenance on the ledger ------
alter table public.coach_decisions
  add column auto_draft_policy_version text check (auto_draft_policy_version is null or char_length(auto_draft_policy_version) between 1 and 100),
  add column auto_draft_eligibility text check (auto_draft_eligibility is null or auto_draft_eligibility in ('eligible','ineligible','blocked')),
  add column auto_draft_reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(auto_draft_reasons) = 'array' and jsonb_array_length(auto_draft_reasons) <= 30),
  add column materialization_origin text check (materialization_origin is null or materialization_origin in ('human','auto_draft'));
alter table public.coach_decisions add constraint coach_decision_auto_draft_assessment_check
  check ((auto_draft_policy_version is null) = (auto_draft_eligibility is null));

-- Historical backfill: every materialization before Implementation Phase 16 was a
-- human approval (the only path). The history guard is disabled only for this
-- one-time fill of a new column; no existing value is rewritten.
alter table public.coach_decisions disable trigger coach_decisions_history_guard;
update public.coach_decisions set materialization_origin='human' where status='materialized';
alter table public.coach_decisions enable trigger coach_decisions_history_guard;

-- Human approval stays human-only: an auto-draft has approved_at NULL.
alter table public.coach_decisions drop constraint coach_decision_lifecycle_check;
alter table public.coach_decisions add constraint coach_decision_lifecycle_check check (
  (status='proposed' and approved_at is null and rejected_at is null and stale_at is null and materialized_at is null and materialized_program_id is null and materialization_origin is null) or
  (status='rejected' and approved_at is null and rejected_at is not null and stale_at is null and materialized_at is null and materialized_program_id is null and materialization_origin is null) or
  (status='stale' and approved_at is null and rejected_at is null and stale_at is not null and materialized_at is null and materialized_program_id is null and materialization_origin is null) or
  (status='materialized' and rejected_at is null and stale_at is null and materialized_at is not null and materialized_program_id is not null and (
    (materialization_origin='human' and approved_at is not null) or
    (materialization_origin='auto_draft' and approved_at is null)))
);
alter table public.coach_decisions add constraint coach_decision_auto_draft_origin_check check (
  materialization_origin is distinct from 'auto_draft' or (proposal_origin='proactive' and review_class='standard_review' and auto_draft_eligibility='eligible')
);

-- Provenance is decided inside the controlled transition, never by a caller column.
create function public.set_coach_decision_materialization_provenance() returns trigger language plpgsql set search_path='' as $$
begin
  if old.status='proposed' and new.status='materialized' then
    if current_setting('app.coach_materialization_origin',true)='auto_draft' then
      new.materialization_origin := 'auto_draft';
      new.approved_at := null;
    else
      new.materialization_origin := 'human';
    end if;
  end if;
  return new;
end $$;
create trigger coach_decisions_materialization_provenance before update on public.coach_decisions for each row execute function public.set_coach_decision_materialization_provenance();

-- Assessment metadata is history, immutable like governance.
create or replace function public.guard_coach_decision_history() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'Coach decisions are immutable history' using errcode='55000'; end if;
  if old.athlete_id<>new.athlete_id or old.source_analysis_id<>new.source_analysis_id or old.proposal_schema_version<>new.proposal_schema_version or old.proposal_snapshot<>new.proposal_snapshot or old.source_program_id<>new.source_program_id or old.source_program_revision<>new.source_program_revision or old.provider<>new.provider or old.model_identifier<>new.model_identifier or old.prompt_version<>new.prompt_version or old.safety_policy_version<>new.safety_policy_version or old.dossier_schema_version<>new.dossier_schema_version
    or old.proposal_origin is distinct from new.proposal_origin or old.autonomy_mode_at_creation is distinct from new.autonomy_mode_at_creation or old.analysis_request_id is distinct from new.analysis_request_id or old.governance_policy_version is distinct from new.governance_policy_version or old.review_class is distinct from new.review_class or old.governance_reasons is distinct from new.governance_reasons
    or old.auto_draft_policy_version is distinct from new.auto_draft_policy_version or old.auto_draft_eligibility is distinct from new.auto_draft_eligibility or old.auto_draft_reasons is distinct from new.auto_draft_reasons
  then raise exception 'Coach proposal snapshot and provenance are immutable' using errcode='55000'; end if;
  if old.status<>'proposed' then raise exception 'Terminal coach decisions are immutable' using errcode='55000'; end if;
  if current_setting('app.coach_decision_transition',true) is distinct from 'allowed' then raise exception 'Coach decision transitions require controlled operation' using errcode='55000'; end if;
  return new;
end $$;

-- Governed creation now also records the auto-draft assessment (backend-computed).
create or replace function public.create_coach_decision(p_user_id uuid, p_proposal jsonb, p_envelope jsonb) returns public.coach_decisions language plpgsql security definer set search_path='' as $$
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
  insert into public.coach_decisions(id,athlete_id,source_analysis_id,proposal_schema_version,proposal_snapshot,source_program_id,source_program_revision,provider,model_identifier,prompt_version,safety_policy_version,dossier_schema_version,proposal_origin,autonomy_mode_at_creation,analysis_request_id,governance_policy_version,review_class,governance_reasons,auto_draft_policy_version,auto_draft_eligibility,auto_draft_reasons)
  values((p_proposal->>'id')::uuid,a,p_proposal->>'analysisId',p_proposal->>'schemaVersion',p_proposal,(p_proposal->>'sourceProgramId')::uuid,(p_proposal->>'sourceProgramRevision')::integer,p_proposal#>>'{analysisSnapshot,provider}',p_proposal#>>'{analysisSnapshot,model}',p_proposal#>>'{analysisSnapshot,promptVersion}',p_proposal#>>'{analysisSnapshot,policyVersion}',p_proposal#>>'{analysisSnapshot,dossierSchemaVersion}',
    coalesce(p_envelope->>'proposalOrigin','manual'),p_envelope->>'autonomyModeAtCreation',request,p_envelope->>'governancePolicyVersion',p_envelope->>'reviewClass',coalesce(p_envelope->'governanceReasons','[]'::jsonb),
    p_envelope#>>'{autoDraft,policyVersion}',p_envelope#>>'{autoDraft,eligibility}',coalesce(p_envelope#>'{autoDraft,reasons}','[]'::jsonb))
  on conflict (athlete_id, analysis_request_id) where analysis_request_id is not null do nothing
  returning * into result;
  if result.id is null then select * into result from public.coach_decisions where athlete_id=a and analysis_request_id=request; end if;
  return result;
end $$;

-- 4. Backend-only Conservative Auto-Draft (reuses the single materialization engine)
create function public.auto_draft_coach_decision(p_user_id uuid, p_decision_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare decision public.coach_decisions; prefs public.athlete_coach_preferences; run public.coach_analysis_runs; action jsonb; result public.coach_decisions;
begin
  select cd.* into decision from public.coach_decisions cd join public.athletes a on a.id=cd.athlete_id where cd.id=p_decision_id and a.user_id=p_user_id for update of cd;
  if decision.id is null then raise exception 'Decision not found' using errcode='P0002'; end if;
  -- Idempotent retries: report the existing outcome, never a second draft.
  if decision.status='materialized' then return jsonb_build_object('status',case when decision.materialization_origin='auto_draft' then 'materialized' else 'already_materialized' end,'decision',to_jsonb(decision)); end if;
  if decision.status='stale' then return jsonb_build_object('status','stale','decision',to_jsonb(decision)); end if;
  if decision.status<>'proposed' then return jsonb_build_object('status','not_authorized','decision',to_jsonb(decision)); end if;
  -- Final authority re-read inside the transaction (preference race).
  select * into prefs from public.athlete_coach_preferences where athlete_id=decision.athlete_id for share;
  if prefs.athlete_id is null or prefs.autonomy_mode<>'proactive' or prefs.draft_authority_mode<>'standard_auto_draft' then return jsonb_build_object('status','not_enabled','decision',to_jsonb(decision)); end if;
  select * into run from public.coach_analysis_runs where athlete_id=decision.athlete_id and analysis_request_id=decision.analysis_request_id;
  if run.id is null or run.training_advice_blocked then return jsonb_build_object('status','blocked','decision',to_jsonb(decision)); end if;
  -- Defense in depth for coach-auto-draft-v1: one scalar adjustment only.
  if decision.proposal_origin<>'proactive' or decision.review_class is distinct from 'standard_review' or decision.auto_draft_eligibility is distinct from 'eligible' or jsonb_array_length(decision.proposal_snapshot->'actions')<>1 then return jsonb_build_object('status','not_authorized','decision',to_jsonb(decision)); end if;
  action := decision.proposal_snapshot->'actions'->0;
  if action->>'kind' not in ('adjust_prescription_rir','adjust_prescription_rest','adjust_absolute_load_target') then return jsonb_build_object('status','not_authorized','decision',to_jsonb(decision)); end if;
  -- Source no longer the active baseline: the existing stale semantics apply.
  if not exists(select 1 from public.training_programs where id=decision.source_program_id and status='active' and revision=decision.source_program_revision) then
    result := public.materialize_coach_decision(p_user_id, p_decision_id);
    return jsonb_build_object('status','stale','decision',to_jsonb(result));
  end if;
  -- Never touch or replace an existing draft (human or automatic).
  if exists(select 1 from public.training_programs where supersedes_program_id=decision.source_program_id) then return jsonb_build_object('status','existing_draft','decision',to_jsonb(decision)); end if;
  perform set_config('app.coach_materialization_origin','auto_draft',true);
  result := public.materialize_coach_decision(p_user_id, p_decision_id);
  perform set_config('app.coach_materialization_origin','',true);
  if result.status='materialized' and (select status from public.training_programs where id=result.materialized_program_id)<>'draft' then raise exception 'Auto-draft must produce an inactive draft' using errcode='55000'; end if;
  return jsonb_build_object('status',case when result.status='materialized' then 'materialized' else result.status end,'decision',to_jsonb(result));
end $$;
revoke all on function public.auto_draft_coach_decision(uuid,uuid) from public, anon, authenticated;
grant execute on function public.auto_draft_coach_decision(uuid,uuid) to service_role;
comment on function public.auto_draft_coach_decision(uuid,uuid) is
  'Backend-only Conservative Auto-Draft (coach-auto-draft-v1): re-reads preferences, safety and eligibility, refuses existing drafts, and materializes through the single engine with origin auto_draft and approved_at NULL. Never activates.';
comment on function public.materialize_coach_decision(uuid,uuid) is
  'Idempotent materialization engine of coach-proposal-v1/v2/v3 into a new draft revision; human approval unless invoked by auto_draft_coach_decision. Never activates.';
