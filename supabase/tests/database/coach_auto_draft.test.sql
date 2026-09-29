begin; create extension if not exists pgtap with schema extensions; select no_plan();
-- Test-only privileged seeding (ADR-0103): clients can no longer insert program
-- rows; fixtures that only need an existing root bypass the product flow on
-- purpose here. Rolled back with the test transaction; never in production.
create function public.test_seed_program_root(p_id uuid, p_name text, p_athlete uuid default null, p_goal uuid default null) returns void language sql security definer set search_path='' as $seed$
  insert into public.training_programs(id,athlete_id,athlete_goal_id,name) values(p_id,coalesce(p_athlete,public.current_athlete_id()),p_goal,p_name) $seed$;
grant execute on function public.test_seed_program_root(uuid,text,uuid,uuid) to authenticated;
-- Implementation Phase 16 (ADR-0082..0086): Conservative Auto-Draft and request fingerprints.
insert into auth.users(id,email) values('81111111-1111-4111-8111-111111111111','draft-a@example.invalid'),('82222222-2222-4222-8222-222222222222','draft-b@example.invalid');
insert into public.athletes(id,user_id) values('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','81111111-1111-4111-8111-111111111111'),('8bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','82222222-2222-4222-8222-222222222222');

create function public.t17_program(p_id uuid) returns void language plpgsql as $$ begin
  perform public.test_seed_program_root(p_id,'Base');
  perform public.replace_training_program_structure(p_id,'{"blocks":[{"sequence":1,"name":"B","weeks":[{"sequence":1,"days":[{"sequence":1,"name":"A","prescriptions":[{"sequence":1,"exerciseId":"50000000-0000-4000-8000-000000000001","sets":[{"sequence":1,"targetMetric":"reps","targetMin":8,"targetMax":10,"rirMin":2,"rirMax":2,"restMinSeconds":120,"restMaxSeconds":120,"tempo":null,"loadKind":"absolute","loadKg":60},{"sequence":2,"targetMetric":"reps","targetMin":8,"targetMax":10,"rirMin":2,"rirMax":2,"restMinSeconds":120,"restMaxSeconds":120,"tempo":null,"loadKind":"absolute","loadKg":60}]}]}]}]}]}'::jsonb);
  perform public.activate_training_program(p_id);
end $$;
grant execute on function public.t17_program(uuid) to authenticated;
create function public.t17_as_a(p_sql text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub','81111111-1111-4111-8111-111111111111',true);
  execute 'set local role authenticated';
  execute p_sql;
  execute 'reset role';
end $$;
create function public.t17_set(p_program uuid, p_seq int default 1) returns uuid language sql as $$ select ps.id from public.prescription_sets ps join public.exercise_prescriptions ep on ep.id=ps.exercise_prescription_id join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program and ps.sequence=p_seq $$;
create function public.t17_rir(p_program uuid, p_seq int default 1) returns jsonb language sql as $$
  select jsonb_build_object('kind','adjust_prescription_rir','trainingDayId',d.id,'exercisePrescriptionId',ep.id,'prescriptionSetId',public.t17_set(p_program,p_seq),'rirMin',3,'rirMax',3,'rationale','r','evidence','[]'::jsonb)
  from public.exercise_prescriptions ep join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program $$;
create function public.t17_proposal(p_id uuid,p_program uuid,p_actions jsonb) returns jsonb language sql as $$
  select jsonb_build_object('schemaVersion','coach-proposal-v3','id',p_id,'analysisId','model-analysis','sourceProgramId',p_program,'sourceProgramRevision',1,'createdAt',now(),'summary','S','rationale','R','evidenceReferences','[]'::jsonb,'limitations','[]'::jsonb,'requiresHumanApproval',true,
    'analysisSnapshot',jsonb_build_object('provider','fixture','model','m','promptVersion','coach-proposal-prompt-v5','policyVersion','coach-safety-v1','dossierSchemaVersion','athlete-training-dossier-v5','summary','A'),'actions',p_actions) $$;
create function public.t17_analysis(p_blocked boolean default false) returns jsonb language sql as $$
  select jsonb_build_object('schemaVersion','coach-analysis-v1','analysisId','model-analysis','requestId','http','createdAt',now(),'summary','Resumo','observations','[]'::jsonb,'hypotheses','[]'::jsonb,'recommendations','[]'::jsonb,'questions','[]'::jsonb,'uncertainties','[]'::jsonb,'evidenceUsed','[]'::jsonb,
    'safetyFlags',case when p_blocked then jsonb_build_array(jsonb_build_object('kind','acute_pain','message','m','blocksTrainingAdvice',true)) else '[]'::jsonb end,
    'metadata',jsonb_build_object('dossierSchemaVersion','athlete-training-dossier-v5','promptVersion','coach-system-v5','policyVersion','coach-safety-v1','provider','fixture','model','deterministic')) $$;
create function public.t17_envelope(p_request uuid,p_origin text default 'proactive',p_class text default 'standard_review',p_eligibility text default 'eligible') returns jsonb language sql as $$
  select jsonb_build_object('proposalOrigin',p_origin,'autonomyModeAtCreation',p_origin,'analysisRequestId',p_request,'governancePolicyVersion','coach-governance-v1','reviewClass',p_class,'governanceReasons',jsonb_build_array('planned_rir_increase'),
    'autoDraft',jsonb_build_object('policyVersion','coach-auto-draft-v1','eligibility',p_eligibility,'reasons',jsonb_build_array('planned_rir_increase'))) $$;
create function public.t17_fp(p_n int) returns text language sql as $$ select repeat(to_hex(p_n % 16),64) $$;
-- Records an analysis run and a decision for athlete A, returns the decision id.
create function public.t17_decision(p_n int,p_program uuid,p_actions jsonb,p_origin text default 'proactive',p_class text default 'standard_review',p_eligibility text default 'eligible',p_blocked boolean default false) returns uuid language plpgsql as $$
declare request uuid := ('86000000-0000-4000-8000-0000000000'||lpad(p_n::text,2,'0'))::uuid; decision uuid := ('84000000-0000-4000-8000-0000000000'||lpad(p_n::text,2,'0'))::uuid;
begin
  perform public.record_coach_analysis_run('81111111-1111-4111-8111-111111111111',request,public.t17_fp(p_n),public.t17_analysis(p_blocked));
  if p_blocked then
    perform public.create_coach_decision('81111111-1111-4111-8111-111111111111',public.t17_proposal(decision,p_program,p_actions),public.t17_envelope(request,p_origin,p_class,p_eligibility));
  else
    perform public.create_coach_decision_for_analysis('81111111-1111-4111-8111-111111111111',public.t17_proposal(decision,p_program,p_actions),public.t17_envelope(request,p_origin,p_class,p_eligibility));
  end if;
  return decision;
end $$;
create function public.t17_prefs(p_autonomy text,p_draft text) returns void language sql as $$
  insert into public.athlete_coach_preferences(athlete_id,autonomy_mode,draft_authority_mode) values('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',p_autonomy,p_draft)
  on conflict (athlete_id) do update set autonomy_mode=excluded.autonomy_mode, draft_authority_mode=excluded.draft_authority_mode $$;
create function public.t17_auto(p_decision uuid) returns text language sql as $$ select public.auto_draft_coach_decision('81111111-1111-4111-8111-111111111111',p_decision)->>'status' $$;

-- FINGERPRINT ---------------------------------------------------------------------
select has_column('public','coach_analysis_runs','request_fingerprint','fingerprint column exists');
select has_function('public','record_coach_analysis_run',array['uuid','uuid','text','jsonb','uuid','integer'],'fingerprinted recording exists');
select is(has_function_privilege('authenticated','public.record_coach_analysis_run(uuid,uuid,text,jsonb,uuid,integer)','execute'),false,'clients cannot record analyses');
set local role service_role;
select lives_ok($$select public.record_coach_analysis_run('81111111-1111-4111-8111-111111111111','86000000-0000-4000-8000-000000000099',public.t17_fp(1),public.t17_analysis())$$,'fingerprinted analysis recorded');
select is((select request_fingerprint from public.coach_analysis_runs where analysis_request_id='86000000-0000-4000-8000-000000000099'),public.t17_fp(1),'fingerprint persisted');
select is((select count(*) from (select public.record_coach_analysis_run('81111111-1111-4111-8111-111111111111','86000000-0000-4000-8000-000000000099',public.t17_fp(1),public.t17_analysis())) x),1::bigint,'same request retry returns the record');
select throws_ok($$select public.record_coach_analysis_run('81111111-1111-4111-8111-111111111111','86000000-0000-4000-8000-000000000099',public.t17_fp(2),public.t17_analysis(true))$$,'23505','Analysis request conflict','same id with a different request is a conflict');
select is((select training_advice_blocked from public.coach_analysis_runs where analysis_request_id='86000000-0000-4000-8000-000000000099'),false,'conflict never overwrites the record');
select throws_ok($$select public.record_coach_analysis_run('81111111-1111-4111-8111-111111111111','86000000-0000-4000-8000-000000000098',null::text,public.t17_analysis())$$,'22023','Request fingerprint required','fingerprint required');
select lives_ok($$select public.record_coach_analysis_run('81111111-1111-4111-8111-111111111111','86000000-0000-4000-8000-000000000097',public.t17_analysis())$$,'legacy unfingerprinted recording still works (corrective pass)');
select throws_ok($$select public.record_coach_analysis_run('81111111-1111-4111-8111-111111111111','86000000-0000-4000-8000-000000000097',public.t17_fp(3),public.t17_analysis())$$,'23505','Analysis request conflict','unbound legacy record is never reused');
select throws_ok($$insert into public.coach_analysis_runs(athlete_id,analysis_request_id,request_fingerprint,analysis_schema_version,analysis_snapshot,training_advice_blocked,safety_policy_version,prompt_version,dossier_schema_version,provider,model_identifier) values('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','86000000-0000-4000-8000-000000000096','not-a-digest','coach-analysis-v1',public.t17_analysis(),false,'p','p','d','f','m')$$,'23514',null,'fingerprint format enforced');
reset role;

-- PREFERENCES -----------------------------------------------------------------------
select col_default_is('public','athlete_coach_preferences','draft_authority_mode','manual_draft','draft authority defaults to manual_draft');
select set_config('request.jwt.claim.sub','81111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select lives_ok($$insert into public.athlete_coach_preferences(athlete_id,autonomy_mode) values('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','proactive')$$,'athlete creates own preferences');
select is((select draft_authority_mode from public.athlete_coach_preferences),'manual_draft','opting into proactive does not enable auto-draft');
select lives_ok($$update public.athlete_coach_preferences set draft_authority_mode='standard_auto_draft'$$,'athlete opts in explicitly');
select throws_ok($$update public.athlete_coach_preferences set draft_authority_mode='auto_activate'$$,'23514',null,'unknown draft authority rejected');
select is(has_function_privilege('authenticated','public.auto_draft_coach_decision(uuid,uuid)','execute'),false,'clients cannot trigger auto-draft');
select is(has_column_privilege('authenticated','public.coach_decisions','materialization_origin','update'),false,'clients cannot forge materialization origin');
select is(has_column_privilege('authenticated','public.coach_decisions','auto_draft_eligibility','update'),false,'clients cannot forge eligibility');
reset role;
select set_config('request.jwt.claim.sub','82222222-2222-4222-8222-222222222222',true);
set local role authenticated;
select is((select count(*) from public.athlete_coach_preferences),0::bigint,'other athlete cannot read the preference');
reset role;

-- AUTO-DRAFT ------------------------------------------------------------------------
select public.t17_as_a($$select public.t17_program('83000000-0000-4000-8000-000000000001')$$);
set local role service_role;
select public.t17_prefs('proactive','standard_auto_draft');
select public.t17_decision(1,'83000000-0000-4000-8000-000000000001',jsonb_build_array(public.t17_rir('83000000-0000-4000-8000-000000000001')));
select is((select auto_draft_policy_version||'/'||auto_draft_eligibility||'/'||auto_draft_reasons::text from public.coach_decisions where id='84000000-0000-4000-8000-000000000001'),'coach-auto-draft-v1/eligible/["planned_rir_increase"]','assessment persisted with the decision');
select is(public.t17_auto('84000000-0000-4000-8000-000000000001'),'materialized','eligible decision becomes an automatic draft');
select is((select materialization_origin||'/'||coalesce(approved_at::text,'null')||'/'||status from public.coach_decisions where id='84000000-0000-4000-8000-000000000001'),'auto_draft/null/materialized','origin auto_draft; approved_at stays NULL (not a human approval)');
select is((select p.status from public.training_programs p join public.coach_decisions d on d.materialized_program_id=p.id where d.id='84000000-0000-4000-8000-000000000001'),'draft','new revision is an inactive draft');
select is((select status from public.training_programs where id='83000000-0000-4000-8000-000000000001'),'active','active program unchanged');
select is(public.t17_auto('84000000-0000-4000-8000-000000000001'),'materialized','retry is idempotent');
select is((select count(*) from public.training_programs where supersedes_program_id='83000000-0000-4000-8000-000000000001'),1::bigint,'exactly one draft');

-- A second eligible proposal on the same source never overwrites the existing draft.
select public.t17_decision(2,'83000000-0000-4000-8000-000000000001',jsonb_build_array(public.t17_rir('83000000-0000-4000-8000-000000000001',2)));
select is(public.t17_auto('84000000-0000-4000-8000-000000000002'),'existing_draft','existing draft is never replaced');
select is((select status from public.coach_decisions where id='84000000-0000-4000-8000-000000000002'),'proposed','proposal remains reviewable');

-- Not authorized: ineligible, elevated, manual origin, multiple actions.
reset role; select public.t17_as_a($$select public.t17_program('83000000-0000-4000-8000-000000000002')$$); set local role service_role;
select public.t17_decision(3,'83000000-0000-4000-8000-000000000002',jsonb_build_array(public.t17_rir('83000000-0000-4000-8000-000000000002')),'proactive','standard_review','ineligible');
select is(public.t17_auto('84000000-0000-4000-8000-000000000003'),'not_authorized','recorded ineligibility refuses auto-draft');
select public.t17_decision(4,'83000000-0000-4000-8000-000000000002',jsonb_build_array(public.t17_rir('83000000-0000-4000-8000-000000000002')),'proactive','elevated_review','eligible');
select is(public.t17_auto('84000000-0000-4000-8000-000000000004'),'not_authorized','elevated review is never auto-drafted');
select public.t17_decision(5,'83000000-0000-4000-8000-000000000002',jsonb_build_array(public.t17_rir('83000000-0000-4000-8000-000000000002')),'manual','standard_review','eligible');
select is(public.t17_auto('84000000-0000-4000-8000-000000000005'),'not_authorized','manual-origin proposals are never auto-drafted');
select public.t17_decision(6,'83000000-0000-4000-8000-000000000002',jsonb_build_array(public.t17_rir('83000000-0000-4000-8000-000000000002'),public.t17_rir('83000000-0000-4000-8000-000000000002',2)));
select is(public.t17_auto('84000000-0000-4000-8000-000000000006'),'not_authorized','multiple actions are never auto-drafted');
select public.t17_decision(7,'83000000-0000-4000-8000-000000000002',jsonb_build_array(jsonb_build_object('kind','remove_prescription_set','trainingDayId',public.t17_rir('83000000-0000-4000-8000-000000000002')->>'trainingDayId','exercisePrescriptionId',public.t17_rir('83000000-0000-4000-8000-000000000002')->>'exercisePrescriptionId','prescriptionSetId',public.t17_set('83000000-0000-4000-8000-000000000002',2),'rationale','r','evidence','[]'::jsonb)));
select is(public.t17_auto('84000000-0000-4000-8000-000000000007'),'not_authorized','structural remove-set is never auto-drafted');
select is((select count(*) from public.training_programs where supersedes_program_id='83000000-0000-4000-8000-000000000002'),0::bigint,'no draft for unauthorized decisions');

-- Safety: a blocked analysis never yields a draft.
select public.t17_decision(8,'83000000-0000-4000-8000-000000000002',jsonb_build_array(public.t17_rir('83000000-0000-4000-8000-000000000002')),'proactive','standard_review','eligible',true);
select is(public.t17_auto('84000000-0000-4000-8000-000000000008'),'blocked','safety-blocked analysis blocks auto-draft');

-- Preference re-read inside the transaction.
select public.t17_decision(9,'83000000-0000-4000-8000-000000000002',jsonb_build_array(public.t17_rir('83000000-0000-4000-8000-000000000002')));
select public.t17_prefs('proactive','manual_draft');
select is(public.t17_auto('84000000-0000-4000-8000-000000000009'),'not_enabled','disabled draft authority is honoured at materialization');
select public.t17_prefs('manual','standard_auto_draft');
select is(public.t17_auto('84000000-0000-4000-8000-000000000009'),'not_enabled','auto-draft has no effect outside proactive mode');
select is((select status from public.coach_decisions where id='84000000-0000-4000-8000-000000000009'),'proposed','decision stays reviewable');

select lives_ok($$select public.materialize_coach_decision('81111111-1111-4111-8111-111111111111','84000000-0000-4000-8000-000000000009')$$,'human materialization still works for a proposal');
select is((select materialization_origin||'/'||(approved_at is not null)::text from public.coach_decisions where id='84000000-0000-4000-8000-000000000009'),'human/true','human materialization records origin human and approval');
-- Staleness: after a human activation elsewhere the source is no longer active.
select public.t17_prefs('proactive','standard_auto_draft');
reset role;
select public.t17_as_a($$select public.activate_training_program((select materialized_program_id from public.coach_decisions where id='84000000-0000-4000-8000-000000000001'))$$);
set local role service_role;
select is(public.t17_auto('84000000-0000-4000-8000-000000000002'),'stale','stale source yields no draft');
select is((select status from public.coach_decisions where id='84000000-0000-4000-8000-000000000002'),'stale','existing stale semantics apply');

-- HUMAN PROVENANCE AND CONSTRAINTS ----------------------------------------------------
select is((select count(*) from public.coach_decisions where status='materialized' and materialization_origin is null),0::bigint,'every materialized decision has a factual origin');
select throws_ok($$update public.coach_decisions set materialization_origin='human' where id='84000000-0000-4000-8000-000000000001'$$,'55000',null,'materialization provenance is immutable');
select throws_ok($$insert into public.coach_decisions(athlete_id,source_analysis_id,proposal_schema_version,proposal_snapshot,source_program_id,source_program_revision,provider,model_identifier,prompt_version,safety_policy_version,dossier_schema_version,status,approved_at,materialized_at,materialized_program_id,materialization_origin) values('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a','coach-proposal-v3',public.t17_proposal('84000000-0000-4000-8000-000000000099','83000000-0000-4000-8000-000000000002',jsonb_build_array(public.t17_rir('83000000-0000-4000-8000-000000000002'))),'83000000-0000-4000-8000-000000000002',1,'f','m','p','s','d','materialized',now(),now(),'83000000-0000-4000-8000-000000000002','auto_draft')$$,'23514',null,'auto_draft with approved_at is rejected');
select throws_ok($$insert into public.coach_decisions(athlete_id,source_analysis_id,proposal_schema_version,proposal_snapshot,source_program_id,source_program_revision,provider,model_identifier,prompt_version,safety_policy_version,dossier_schema_version,status,materialized_at,materialized_program_id,materialization_origin) values('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a','coach-proposal-v3',public.t17_proposal('84000000-0000-4000-8000-000000000098','83000000-0000-4000-8000-000000000002',jsonb_build_array(public.t17_rir('83000000-0000-4000-8000-000000000002'))),'83000000-0000-4000-8000-000000000002',1,'f','m','p','s','d','materialized',now(),'83000000-0000-4000-8000-000000000002','auto_draft')$$,'23514',null,'auto_draft requires a proactive, standard, eligible decision');
select throws_ok($$insert into public.coach_decisions(athlete_id,source_analysis_id,proposal_schema_version,proposal_snapshot,source_program_id,source_program_revision,provider,model_identifier,prompt_version,safety_policy_version,dossier_schema_version,status,materialized_at,materialized_program_id,materialization_origin) values('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a','coach-proposal-v3',public.t17_proposal('84000000-0000-4000-8000-000000000097','83000000-0000-4000-8000-000000000002',jsonb_build_array(public.t17_rir('83000000-0000-4000-8000-000000000002'))),'83000000-0000-4000-8000-000000000002',1,'f','m','p','s','d','materialized',now(),'83000000-0000-4000-8000-000000000002','human')$$,'23514',null,'human materialization requires approval');
select throws_ok($$insert into public.coach_decisions(athlete_id,source_analysis_id,proposal_schema_version,proposal_snapshot,source_program_id,source_program_revision,provider,model_identifier,prompt_version,safety_policy_version,dossier_schema_version,materialization_origin) values('8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a','coach-proposal-v3',public.t17_proposal('84000000-0000-4000-8000-000000000096','83000000-0000-4000-8000-000000000002',jsonb_build_array(public.t17_rir('83000000-0000-4000-8000-000000000002'))),'83000000-0000-4000-8000-000000000002',1,'f','m','p','s','d','human')$$,'23514',null,'no origin before materialization');
select throws_ok($$update public.coach_decisions set auto_draft_eligibility='eligible' where id='84000000-0000-4000-8000-000000000003'$$,'55000',null,'auto-draft assessment immutable');
select is((select count(*) from public.training_programs p where p.athlete_id='8aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and p.status='active' and p.id=(select materialized_program_id from public.coach_decisions where id='84000000-0000-4000-8000-000000000001')),1::bigint,'the only activation was the explicit human one');
reset role;

select * from finish(); rollback;
