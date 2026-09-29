begin; create extension if not exists pgtap with schema extensions; select no_plan();
-- Test-only privileged seeding (ADR-0103): clients can no longer insert program
-- rows; fixtures that only need an existing root bypass the product flow on
-- purpose here. Rolled back with the test transaction; never in production.
create function public.test_seed_program_root(p_id uuid, p_name text, p_athlete uuid default null, p_goal uuid default null) returns void language sql security definer set search_path='' as $seed$
  insert into public.training_programs(id,athlete_id,athlete_goal_id,name) values(p_id,coalesce(p_athlete,public.current_athlete_id()),p_goal,p_name) $seed$;
grant execute on function public.test_seed_program_root(uuid,text,uuid,uuid) to authenticated;
-- Phase 15 (ADR-0074..0077): autonomy preference, governance envelope and proactive idempotency.
insert into auth.users(id,email) values('61111111-1111-4111-8111-111111111111','gov-a@example.invalid'),('62222222-2222-4222-8222-222222222222','gov-b@example.invalid');
insert into public.athletes(id,user_id) values('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','61111111-1111-4111-8111-111111111111'),('6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','62222222-2222-4222-8222-222222222222');

create function public.t15_program(p_id uuid) returns void language plpgsql as $$ begin
  perform public.test_seed_program_root(p_id,'Base');
  perform public.replace_training_program_structure(p_id,'{"blocks":[{"sequence":1,"name":"B","weeks":[{"sequence":1,"days":[{"sequence":1,"name":"A","prescriptions":[{"sequence":1,"exerciseId":"50000000-0000-4000-8000-000000000001","sets":[{"sequence":1,"targetMetric":"reps","targetMin":8,"targetMax":10,"rirMin":2,"rirMax":2,"restMinSeconds":120,"restMaxSeconds":120,"tempo":null,"loadKind":"absolute","loadKg":60}]}]}]}]}]}'::jsonb);
  perform public.activate_training_program(p_id);
end $$;
grant execute on function public.t15_program(uuid) to authenticated;
create function public.t15_new(p_program uuid) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub','61111111-1111-4111-8111-111111111111',true);
  execute 'set local role authenticated';
  perform public.t15_program(p_program);
  execute 'reset role';
end $$;
create function public.t15_proposal(p_id uuid,p_program uuid) returns jsonb language sql as $$
  select jsonb_build_object('schemaVersion','coach-proposal-v3','id',p_id,'analysisId','model-analysis','sourceProgramId',p_program,'sourceProgramRevision',1,'createdAt',now(),'summary','S','rationale','R','evidenceReferences','[]'::jsonb,'limitations','[]'::jsonb,'requiresHumanApproval',true,
    'analysisSnapshot',jsonb_build_object('provider','fixture','model','m','promptVersion','coach-proposal-prompt-v5','policyVersion','coach-safety-v1','dossierSchemaVersion','athlete-training-dossier-v5','summary','A'),
    'actions',jsonb_build_array(jsonb_build_object('kind','adjust_prescription_rir','trainingDayId',(select d.id from public.training_days d join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program),
      'exercisePrescriptionId',(select ep.id from public.exercise_prescriptions ep join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program),
      'prescriptionSetId',(select ps.id from public.prescription_sets ps join public.exercise_prescriptions ep on ep.id=ps.exercise_prescription_id join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program),
      'rirMin',3,'rirMax',3,'rationale','r','evidence','[]'::jsonb))) $$;
create function public.t15_envelope(p_origin text,p_request uuid,p_class text default 'standard_review') returns jsonb language sql as $$
  select jsonb_build_object('proposalOrigin',p_origin,'autonomyModeAtCreation',case when p_origin='proactive' then 'proactive' else 'manual' end,'analysisRequestId',p_request,'governancePolicyVersion','coach-governance-v1','reviewClass',p_class,'governanceReasons',jsonb_build_array('planned_rir_increase')) $$;

-- PREFERENCES ------------------------------------------------------------------
select has_table('public','athlete_coach_preferences','autonomy preference table exists');
select col_default_is('public','athlete_coach_preferences','autonomy_mode','manual','default mode is manual');
select ok((select relrowsecurity from pg_class where oid='public.athlete_coach_preferences'::regclass),'RLS enabled on preferences');
select is(has_table_privilege('anon','public.athlete_coach_preferences','select'),false,'anon cannot read preferences');
select is(has_table_privilege('authenticated','public.athlete_coach_preferences','delete'),false,'authenticated cannot delete preferences');
select set_config('request.jwt.claim.sub','61111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select is((select count(*) from public.athlete_coach_preferences),0::bigint,'no row means manual (default)');
select lives_ok($$insert into public.athlete_coach_preferences(athlete_id,autonomy_mode) values('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','proactive')$$,'athlete opts in explicitly');
select throws_ok($$update public.athlete_coach_preferences set autonomy_mode='autonomous'$$,'23514',null,'unknown mode rejected');
select throws_ok($$insert into public.athlete_coach_preferences(athlete_id,autonomy_mode) values('6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','proactive')$$,'42501',null,'cannot set another athlete preference');
reset role;
select set_config('request.jwt.claim.sub','62222222-2222-4222-8222-222222222222',true);
set local role authenticated;
select is((select count(*) from public.athlete_coach_preferences),0::bigint,'other athlete cannot read preference');
select lives_ok($$update public.athlete_coach_preferences set autonomy_mode='manual'$$,'other athlete update is filtered by RLS');
reset role;
select is((select autonomy_mode from public.athlete_coach_preferences where athlete_id='6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'proactive','preference persisted and not changed by another athlete');

-- GOVERNED CREATION ------------------------------------------------------------
select public.t15_new('63000000-0000-4000-8000-000000000001');
select has_function('public','create_coach_decision',array['uuid','jsonb','jsonb'],'governed creation RPC exists');
select is(has_function_privilege('authenticated','public.create_coach_decision(uuid,jsonb,jsonb)','execute'),false,'authenticated cannot call governed creation');
select is(has_function_privilege('anon','public.create_coach_decision(uuid,jsonb,jsonb)','execute'),false,'anon cannot call governed creation');
select is(has_table_privilege('authenticated','public.coach_decisions','insert'),false,'clients cannot insert decisions (origin is never client-chosen)');
set local role service_role;
select lives_ok($$select public.create_coach_decision('61111111-1111-4111-8111-111111111111',public.t15_proposal('64000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000001'),public.t15_envelope('proactive','65000000-0000-4000-8000-000000000001'))$$,'proactive decision recorded');
select is((select proposal_origin||'/'||autonomy_mode_at_creation||'/'||governance_policy_version||'/'||review_class||'/'||governance_reasons::text||'/'||status from public.coach_decisions where id='64000000-0000-4000-8000-000000000001'),'proactive/proactive/coach-governance-v1/standard_review/["planned_rir_increase"]/proposed','governance envelope persisted; decision only proposed');
select is((select status from public.training_programs where id='63000000-0000-4000-8000-000000000001'),'active','source untouched');
select is((select count(*) from public.training_programs where supersedes_program_id='63000000-0000-4000-8000-000000000001'),0::bigint,'no draft created automatically');

-- IDEMPOTENCY --------------------------------------------------------------------
select is((select id from public.create_coach_decision('61111111-1111-4111-8111-111111111111',public.t15_proposal('64000000-0000-4000-8000-000000000002','63000000-0000-4000-8000-000000000001'),public.t15_envelope('proactive','65000000-0000-4000-8000-000000000001'))),'64000000-0000-4000-8000-000000000001'::uuid,'retry returns the existing decision');
select is((select count(*) from public.coach_decisions where analysis_request_id='65000000-0000-4000-8000-000000000001'),1::bigint,'no duplicate decision for the same analysis request');
select is((select id from public.create_coach_decision('61111111-1111-4111-8111-111111111111',public.t15_proposal('64000000-0000-4000-8000-000000000003','63000000-0000-4000-8000-000000000001'),public.t15_envelope('manual','65000000-0000-4000-8000-000000000001'))),'64000000-0000-4000-8000-000000000001'::uuid,'manual request for the same analysis reuses the proactive decision');
select throws_ok($$insert into public.coach_decisions(athlete_id,source_analysis_id,proposal_schema_version,proposal_snapshot,source_program_id,source_program_revision,provider,model_identifier,prompt_version,safety_policy_version,dossier_schema_version,analysis_request_id,governance_policy_version,review_class) select athlete_id,source_analysis_id,proposal_schema_version,jsonb_set(proposal_snapshot,'{id}','"64000000-0000-4000-8000-000000000004"'),source_program_id,source_program_revision,provider,model_identifier,prompt_version,safety_policy_version,dossier_schema_version,analysis_request_id,governance_policy_version,review_class from public.coach_decisions where id='64000000-0000-4000-8000-000000000001'$$,'23505',null,'unique index blocks duplicates per athlete and request');
select throws_ok($$select public.create_coach_decision('62222222-2222-4222-8222-222222222222',public.t15_proposal('64000000-0000-4000-8000-000000000005','63000000-0000-4000-8000-000000000001'),public.t15_envelope('manual','65000000-0000-4000-8000-000000000001'))$$,'55000','Source program is not the active baseline','request ids are athlete-scoped: another athlete is never served the existing row');
reset role;

-- CONSTRAINTS -------------------------------------------------------------------
set local role service_role;
select throws_ok($$select public.create_coach_decision('61111111-1111-4111-8111-111111111111',public.t15_proposal('64000000-0000-4000-8000-000000000006','63000000-0000-4000-8000-000000000001'),jsonb_build_object('proposalOrigin','manual'))$$,'22023','Governance assessment required','governance envelope required');
select throws_ok($$select public.create_coach_decision('61111111-1111-4111-8111-111111111111',public.t15_proposal('64000000-0000-4000-8000-000000000007','63000000-0000-4000-8000-000000000001'),public.t15_envelope('manual','65000000-0000-4000-8000-000000000007','blocked'))$$,'23514',null,'blocked proposals are never persisted');
select throws_ok($$select public.create_coach_decision('61111111-1111-4111-8111-111111111111',public.t15_proposal('64000000-0000-4000-8000-000000000008','63000000-0000-4000-8000-000000000001'),public.t15_envelope('autonomous','65000000-0000-4000-8000-000000000008'))$$,'23514',null,'unknown origin rejected');
select throws_ok($$select public.create_coach_decision('61111111-1111-4111-8111-111111111111',public.t15_proposal('64000000-0000-4000-8000-000000000009','63000000-0000-4000-8000-000000000001'),public.t15_envelope('proactive',null))$$,'23514',null,'proactive origin requires an analysis request id');
select throws_ok($$select public.create_coach_decision('61111111-1111-4111-8111-111111111111',public.t15_proposal('64000000-0000-4000-8000-000000000010','63000000-0000-4000-8000-000000000001'),public.t15_envelope('manual','not-a-uuid'))$$,'22P02',null,'malformed idempotency key rejected');
select throws_ok($$update public.coach_decisions set review_class='standard_review' where id='64000000-0000-4000-8000-000000000001'$$,'55000',null,'review class immutable');
select throws_ok($$update public.coach_decisions set proposal_origin='manual' where id='64000000-0000-4000-8000-000000000001'$$,'55000',null,'origin immutable');
select throws_ok($$update public.coach_decisions set governance_reasons='[]'::jsonb where id='64000000-0000-4000-8000-000000000001'$$,'55000',null,'reasons immutable');
select throws_ok($$update public.coach_decisions set analysis_request_id=null where id='64000000-0000-4000-8000-000000000001'$$,'55000',null,'request id immutable');

-- LEGACY + MATERIALIZATION -------------------------------------------------------
select lives_ok($$select public.create_coach_decision('61111111-1111-4111-8111-111111111111',public.t15_proposal('64000000-0000-4000-8000-000000000011','63000000-0000-4000-8000-000000000001'))$$,'legacy 2-arg creation still works');
select is((select proposal_origin||'/'||coalesce(review_class,'null')||'/'||governance_reasons::text from public.coach_decisions where id='64000000-0000-4000-8000-000000000011'),'manual/null/[]','legacy rows: manual origin, no governance');
select lives_ok($$select public.materialize_coach_decision('61111111-1111-4111-8111-111111111111','64000000-0000-4000-8000-000000000001')$$,'governed decision materializes through the controlled RPC');
select is((select p.status from public.training_programs p join public.coach_decisions d on d.materialized_program_id=p.id where d.id='64000000-0000-4000-8000-000000000001'),'draft','materialization creates only a draft');
select is((select status from public.training_programs where id='63000000-0000-4000-8000-000000000001'),'active','never auto-activated');
select is((select review_class from public.coach_decisions where id='64000000-0000-4000-8000-000000000001'),'standard_review','governance preserved across transition');
reset role;
select set_config('request.jwt.claim.sub','61111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select is((select count(*) from public.coach_decisions where review_class is not null),1::bigint,'owner reads governance via RLS');
reset role;

select * from finish(); rollback;
