-- Corrective pass after Implementation Phase 15 (ADR-0078..0080).
-- "Client-returned Coach analysis is display data, never authoritative coaching state."
-- "Safety state used for proposal generation must originate from a server-owned analysis record."
-- Not chat persistence: no question text, conversation, prompt, dossier, raw provider output or reasoning.

create table public.coach_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  analysis_request_id uuid not null,
  analysis_schema_version text not null check (analysis_schema_version = 'coach-analysis-v1'),
  analysis_snapshot jsonb not null check (jsonb_typeof(analysis_snapshot) = 'object' and analysis_snapshot->>'schemaVersion' = analysis_schema_version),
  -- Server-derived from the validated snapshot; never accepted from a client.
  training_advice_blocked boolean not null,
  safety_policy_version text not null check (char_length(safety_policy_version) between 1 and 100),
  prompt_version text not null check (char_length(prompt_version) between 1 and 100),
  dossier_schema_version text not null check (char_length(dossier_schema_version) between 1 and 100),
  provider text not null check (char_length(provider) between 1 and 100),
  model_identifier text not null check (char_length(model_identifier) between 1 and 200),
  -- Active program represented in the analysis-time dossier (null = none).
  source_program_id uuid,
  source_program_revision integer check (source_program_revision is null or source_program_revision > 0),
  created_at timestamptz not null default now(),
  constraint coach_analysis_runs_request_unique unique (athlete_id, analysis_request_id),
  constraint coach_analysis_runs_program_pair_check check ((source_program_id is null) = (source_program_revision is null)),
  constraint coach_analysis_runs_safety_consistency_check check (
    training_advice_blocked = jsonb_path_exists(analysis_snapshot, '$.safetyFlags[*] ? (@.blocksTrainingAdvice == true)')
  )
);
comment on table public.coach_analysis_runs is
  'Authoritative, immutable record of a validated CoachAnalysis returned to the athlete. Integrity/audit record for safety provenance and proposal handoff; not chat persistence. Retained until an explicit future retention policy; removed with the athlete.';

alter table public.coach_analysis_runs enable row level security;
-- Backend only: the mobile client never reads or writes this table directly.
revoke all on public.coach_analysis_runs from public, anon, authenticated;
grant all on public.coach_analysis_runs to service_role;

create function public.guard_coach_analysis_run() returns trigger language plpgsql set search_path='' as $$
begin
  raise exception 'Coach analysis runs are immutable' using errcode='55000';
end $$;
create trigger coach_analysis_runs_immutable before update on public.coach_analysis_runs for each row execute function public.guard_coach_analysis_run();

-- Idempotent backend-only recording: a retry of the same request returns the existing run.
create function public.record_coach_analysis_run(p_user_id uuid, p_analysis_request_id uuid, p_analysis jsonb, p_source_program_id uuid default null, p_source_program_revision integer default null) returns public.coach_analysis_runs language plpgsql security definer set search_path='' as $$
declare a uuid; result public.coach_analysis_runs;
begin
  select id into a from public.athletes where user_id=p_user_id;
  if a is null then raise exception 'Athlete not found' using errcode='P0002'; end if;
  insert into public.coach_analysis_runs(athlete_id,analysis_request_id,analysis_schema_version,analysis_snapshot,training_advice_blocked,safety_policy_version,prompt_version,dossier_schema_version,provider,model_identifier,source_program_id,source_program_revision)
  values(a,p_analysis_request_id,p_analysis->>'schemaVersion',p_analysis,
    jsonb_path_exists(p_analysis,'$.safetyFlags[*] ? (@.blocksTrainingAdvice == true)'),
    p_analysis#>>'{metadata,policyVersion}',p_analysis#>>'{metadata,promptVersion}',p_analysis#>>'{metadata,dossierSchemaVersion}',p_analysis#>>'{metadata,provider}',p_analysis#>>'{metadata,model}',
    p_source_program_id,p_source_program_revision)
  on conflict (athlete_id, analysis_request_id) do nothing
  returning * into result;
  if result.id is null then select * into result from public.coach_analysis_runs where athlete_id=a and analysis_request_id=p_analysis_request_id; end if;
  return result;
end $$;
revoke all on function public.record_coach_analysis_run(uuid,uuid,jsonb,uuid,integer) from public, anon, authenticated;
grant execute on function public.record_coach_analysis_run(uuid,uuid,jsonb,uuid,integer) to service_role;

-- Proposal handoff through the server-owned analysis: the decision must reference an
-- existing, non-blocked analysis run of the same athlete (defense in depth; the
-- application checks the same before any provider call).
create function public.create_coach_decision_for_analysis(p_user_id uuid, p_proposal jsonb, p_envelope jsonb) returns public.coach_decisions language plpgsql security definer set search_path='' as $$
declare a uuid; request uuid; run public.coach_analysis_runs;
begin
  select id into a from public.athletes where user_id=p_user_id;
  if a is null then raise exception 'Athlete not found' using errcode='P0002'; end if;
  request := nullif(p_envelope->>'analysisRequestId','')::uuid;
  if request is null then raise exception 'Analysis request required' using errcode='22023'; end if;
  select * into run from public.coach_analysis_runs where athlete_id=a and analysis_request_id=request;
  if run.id is null then raise exception 'Analysis not found' using errcode='P0002'; end if;
  if run.training_advice_blocked then raise exception 'Safety blocks training advice for this analysis' using errcode='55000'; end if;
  return public.create_coach_decision(p_user_id, p_proposal, p_envelope);
end $$;
revoke all on function public.create_coach_decision_for_analysis(uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.create_coach_decision_for_analysis(uuid,jsonb,jsonb) to service_role;
comment on function public.create_coach_decision(uuid,jsonb,jsonb) is
  'Implementation Phase 15 governed creation. Superseded for application use by create_coach_decision_for_analysis (ADR-0080); kept backend-only for compatibility.';
