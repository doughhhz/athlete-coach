begin; create extension if not exists pgtap with schema extensions; select no_plan();
-- Test-only privileged seeding (ADR-0103): clients can no longer insert program
-- rows; fixtures that only need an existing root bypass the product flow on
-- purpose here. Rolled back with the test transaction; never in production.
create function public.test_seed_program_root(p_id uuid, p_name text, p_athlete uuid default null, p_goal uuid default null) returns void language sql security definer set search_path='' as $seed$
  insert into public.training_programs(id,athlete_id,athlete_goal_id,name) values(p_id,coalesce(p_athlete,public.current_athlete_id()),p_goal,p_name) $seed$;
grant execute on function public.test_seed_program_root(uuid,text,uuid,uuid) to authenticated;
-- Corrective pass (ADR-0078..0080): authoritative, server-owned analysis records.
insert into auth.users(id,email) values('71111111-1111-4111-8111-111111111111','run-a@example.invalid'),('72222222-2222-4222-8222-222222222222','run-b@example.invalid');
insert into public.athletes(id,user_id) values('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','71111111-1111-4111-8111-111111111111'),('7bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','72222222-2222-4222-8222-222222222222');

create function public.t16_program(p_id uuid) returns void language plpgsql as $$ begin
  perform public.test_seed_program_root(p_id,'Base');
  perform public.replace_training_program_structure(p_id,'{"blocks":[{"sequence":1,"name":"B","weeks":[{"sequence":1,"days":[{"sequence":1,"name":"A","prescriptions":[{"sequence":1,"exerciseId":"50000000-0000-4000-8000-000000000001","sets":[{"sequence":1,"targetMetric":"reps","targetMin":8,"targetMax":10,"rirMin":2,"rirMax":2,"restMinSeconds":120,"restMaxSeconds":120,"tempo":null,"loadKind":"absolute","loadKg":60}]}]}]}]}]}'::jsonb);
  perform public.activate_training_program(p_id);
end $$;
grant execute on function public.t16_program(uuid) to authenticated;
create function public.t16_new(p_program uuid) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub','71111111-1111-4111-8111-111111111111',true);
  execute 'set local role authenticated';
  perform public.t16_program(p_program);
  execute 'reset role';
end $$;
create function public.t16_analysis(p_blocked boolean default false) returns jsonb language sql as $$
  select jsonb_build_object('schemaVersion','coach-analysis-v1','analysisId','model-analysis','requestId','http-request','createdAt',now(),'summary','Resumo','observations','[]'::jsonb,'hypotheses','[]'::jsonb,'recommendations','[]'::jsonb,'questions','[]'::jsonb,'uncertainties','[]'::jsonb,'evidenceUsed','[]'::jsonb,
    'safetyFlags',case when p_blocked then jsonb_build_array(jsonb_build_object('kind','acute_pain','message','Procure avaliação.','blocksTrainingAdvice',true)) else '[]'::jsonb end,
    'metadata',jsonb_build_object('dossierSchemaVersion','athlete-training-dossier-v5','promptVersion','coach-system-v5','policyVersion','coach-safety-v1','provider',case when p_blocked then 'safety-policy' else 'fixture' end,'model','deterministic','inputTokens',null,'outputTokens',null)) $$;
create function public.t16_proposal(p_id uuid,p_program uuid) returns jsonb language sql as $$
  select jsonb_build_object('schemaVersion','coach-proposal-v3','id',p_id,'analysisId','model-analysis','sourceProgramId',p_program,'sourceProgramRevision',1,'createdAt',now(),'summary','S','rationale','R','evidenceReferences','[]'::jsonb,'limitations','[]'::jsonb,'requiresHumanApproval',true,
    'analysisSnapshot',jsonb_build_object('provider','fixture','model','m','promptVersion','coach-proposal-prompt-v5','policyVersion','coach-safety-v1','dossierSchemaVersion','athlete-training-dossier-v5','summary','A'),
    'actions',jsonb_build_array(jsonb_build_object('kind','adjust_prescription_rir','trainingDayId',(select d.id from public.training_days d join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program),
      'exercisePrescriptionId',(select ep.id from public.exercise_prescriptions ep join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program),
      'prescriptionSetId',(select ps.id from public.prescription_sets ps join public.exercise_prescriptions ep on ep.id=ps.exercise_prescription_id join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program),
      'rirMin',3,'rirMax',3,'rationale','r','evidence','[]'::jsonb))) $$;
create function public.t16_envelope(p_request uuid) returns jsonb language sql as $$
  select jsonb_build_object('proposalOrigin','manual','autonomyModeAtCreation','manual','analysisRequestId',p_request,'governancePolicyVersion','coach-governance-v1','reviewClass','standard_review','governanceReasons',jsonb_build_array('planned_rir_increase')) $$;

-- TABLE, GRANTS, RLS ------------------------------------------------------------
select has_table('public','coach_analysis_runs','authoritative analysis table exists');
select ok((select relrowsecurity from pg_class where oid='public.coach_analysis_runs'::regclass),'RLS enabled');
select is(has_table_privilege('anon','public.coach_analysis_runs','select'),false,'anon cannot read analysis runs');
select is(has_table_privilege('authenticated','public.coach_analysis_runs','select'),false,'mobile clients do not read analysis runs directly');
select is(has_table_privilege('authenticated','public.coach_analysis_runs','insert'),false,'clients cannot insert authoritative analyses');
select is(has_table_privilege('authenticated','public.coach_analysis_runs','update'),false,'clients cannot update analysis snapshots');
select is(has_function_privilege('authenticated','public.record_coach_analysis_run(uuid,uuid,jsonb,uuid,integer)','execute'),false,'clients cannot record analyses');
select is(has_function_privilege('anon','public.record_coach_analysis_run(uuid,uuid,jsonb,uuid,integer)','execute'),false,'anon cannot record analyses');
select is(has_function_privilege('authenticated','public.create_coach_decision_for_analysis(uuid,jsonb,jsonb)','execute'),false,'clients cannot create decisions from analyses');
select hasnt_column('public','coach_analysis_runs','user_request','question text is not stored (not chat persistence)');
select hasnt_column('public','coach_analysis_runs','dossier_snapshot','full dossier is not stored');
select set_config('request.jwt.claim.sub','71111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select throws_ok($$select count(*) from public.coach_analysis_runs$$,'42501',null,'authenticated read denied');
select throws_ok($$insert into public.coach_analysis_runs(athlete_id,analysis_request_id,analysis_schema_version,analysis_snapshot,training_advice_blocked,safety_policy_version,prompt_version,dossier_schema_version,provider,model_identifier) values('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','76000000-0000-4000-8000-000000000099','coach-analysis-v1',public.t16_analysis(true),false,'p','p','d','f','m')$$,'42501',null,'client cannot forge an unblocked analysis');
reset role;

-- BACKEND RECORDING ---------------------------------------------------------------
select public.t16_new('73000000-0000-4000-8000-000000000001');
set local role service_role;
select lives_ok($$select public.record_coach_analysis_run('71111111-1111-4111-8111-111111111111','76000000-0000-4000-8000-000000000001',public.t16_analysis(false),'73000000-0000-4000-8000-000000000001',1)$$,'backend records an analysis');
select is((select training_advice_blocked::text||'/'||provider||'/'||model_identifier||'/'||prompt_version||'/'||safety_policy_version||'/'||dossier_schema_version||'/'||source_program_id||'/'||source_program_revision from public.coach_analysis_runs where analysis_request_id='76000000-0000-4000-8000-000000000001'),'false/fixture/deterministic/coach-system-v5/coach-safety-v1/athlete-training-dossier-v5/73000000-0000-4000-8000-000000000001/1','provenance derived server-side from the snapshot');
select lives_ok($$select public.record_coach_analysis_run('71111111-1111-4111-8111-111111111111','76000000-0000-4000-8000-000000000002',public.t16_analysis(true))$$,'safety-blocked analysis recorded without program context');
select is((select training_advice_blocked from public.coach_analysis_runs where analysis_request_id='76000000-0000-4000-8000-000000000002'),true,'blocked flag derived from snapshot safety flags');
select is((select source_program_id from public.coach_analysis_runs where analysis_request_id='76000000-0000-4000-8000-000000000002'),null,'no program provenance when none given');

-- IDEMPOTENCY ---------------------------------------------------------------------
select is((select id from public.record_coach_analysis_run('71111111-1111-4111-8111-111111111111','76000000-0000-4000-8000-000000000001',public.t16_analysis(true))),(select id from public.coach_analysis_runs where analysis_request_id='76000000-0000-4000-8000-000000000001'),'retry returns the existing record');
select is((select training_advice_blocked from public.coach_analysis_runs where analysis_request_id='76000000-0000-4000-8000-000000000001'),false,'retry never rewrites the stored snapshot');
select is((select count(*) from public.coach_analysis_runs where analysis_request_id='76000000-0000-4000-8000-000000000001'),1::bigint,'one authoritative record per athlete/request');
select lives_ok($$select public.record_coach_analysis_run('72222222-2222-4222-8222-222222222222','76000000-0000-4000-8000-000000000001',public.t16_analysis(false))$$,'identity is athlete-scoped: same request id for another athlete is a separate record');
select is((select count(*) from public.coach_analysis_runs where analysis_request_id='76000000-0000-4000-8000-000000000001'),2::bigint,'no cross-athlete reuse');

-- CONSTRAINTS AND IMMUTABILITY ----------------------------------------------------
select throws_ok($$insert into public.coach_analysis_runs(athlete_id,analysis_request_id,analysis_schema_version,analysis_snapshot,training_advice_blocked,safety_policy_version,prompt_version,dossier_schema_version,provider,model_identifier) values('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','76000000-0000-4000-8000-000000000003','coach-analysis-v1',public.t16_analysis(true),false,'p','p','d','f','m')$$,'23514',null,'blocked flag must match the snapshot safety flags');
select throws_ok($$insert into public.coach_analysis_runs(athlete_id,analysis_request_id,analysis_schema_version,analysis_snapshot,training_advice_blocked,safety_policy_version,prompt_version,dossier_schema_version,provider,model_identifier,source_program_id) values('7aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','76000000-0000-4000-8000-000000000004','coach-analysis-v1',public.t16_analysis(false),false,'p','p','d','f','m','73000000-0000-4000-8000-000000000001')$$,'23514',null,'program id and revision go together');
select throws_ok($$select public.record_coach_analysis_run('71111111-1111-4111-8111-111111111111','76000000-0000-4000-8000-000000000005',public.t16_analysis(false)-'schemaVersion')$$,'23502',null,'unversioned snapshot rejected');
select throws_ok($$update public.coach_analysis_runs set training_advice_blocked=false where analysis_request_id='76000000-0000-4000-8000-000000000002'$$,'55000','Coach analysis runs are immutable','safety state immutable');
select throws_ok($$update public.coach_analysis_runs set analysis_snapshot=public.t16_analysis(false) where analysis_request_id='76000000-0000-4000-8000-000000000002'$$,'55000','Coach analysis runs are immutable','snapshot immutable, even for the backend');

-- DECISION HANDOFF ----------------------------------------------------------------
select throws_ok($$select public.create_coach_decision_for_analysis('71111111-1111-4111-8111-111111111111',public.t16_proposal('74000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001'),public.t16_envelope('76000000-0000-4000-8000-000000000002'))$$,'55000','Safety blocks training advice for this analysis','blocked analysis cannot yield a decision');
select throws_ok($$select public.create_coach_decision_for_analysis('71111111-1111-4111-8111-111111111111',public.t16_proposal('74000000-0000-4000-8000-000000000002','73000000-0000-4000-8000-000000000001'),public.t16_envelope('76000000-0000-4000-8000-000000000404'))$$,'P0002','Analysis not found','unknown analysis cannot yield a decision');
select throws_ok($$select public.create_coach_decision_for_analysis('71111111-1111-4111-8111-111111111111',public.t16_proposal('74000000-0000-4000-8000-000000000003','73000000-0000-4000-8000-000000000001'),public.t16_envelope(null))$$,'22023','Analysis request required','decision requires an analysis identity');
select lives_ok($$select public.create_coach_decision_for_analysis('71111111-1111-4111-8111-111111111111',public.t16_proposal('74000000-0000-4000-8000-000000000004','73000000-0000-4000-8000-000000000001'),public.t16_envelope('76000000-0000-4000-8000-000000000001'))$$,'decision linked to the authoritative analysis');
select is((select id from public.create_coach_decision_for_analysis('71111111-1111-4111-8111-111111111111',public.t16_proposal('74000000-0000-4000-8000-000000000005','73000000-0000-4000-8000-000000000001'),public.t16_envelope('76000000-0000-4000-8000-000000000001'))),'74000000-0000-4000-8000-000000000004'::uuid,'one decision per authoritative analysis (idempotent)');
select is((select count(*) from public.coach_decisions d join public.coach_analysis_runs r on r.athlete_id=d.athlete_id and r.analysis_request_id=d.analysis_request_id where d.id='74000000-0000-4000-8000-000000000004'),1::bigint,'decision joins its own athlete analysis');
select throws_ok($$select public.create_coach_decision_for_analysis('72222222-2222-4222-8222-222222222222',public.t16_proposal('74000000-0000-4000-8000-000000000006','73000000-0000-4000-8000-000000000001'),public.t16_envelope('76000000-0000-4000-8000-000000000002'))$$,'P0002','Analysis not found','another athlete cannot use a blocked analysis id it does not own');
select is((select count(*) from public.training_programs where supersedes_program_id='73000000-0000-4000-8000-000000000001'),0::bigint,'no draft created automatically');
select is((select status from public.training_programs where id='73000000-0000-4000-8000-000000000001'),'active','source program untouched');
reset role;

select * from finish(); rollback;
