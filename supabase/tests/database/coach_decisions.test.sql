begin; create extension if not exists pgtap with schema extensions; select no_plan();
select has_table('public','coach_decisions','runtime coaching ledger exists');
select has_column('public','coach_decisions','proposal_snapshot','versioned proposal snapshot exists');
select ok((select relrowsecurity from pg_class where oid='public.coach_decisions'::regclass),'ledger has RLS');
select ok(not has_table_privilege('anon','public.coach_decisions','select'),'anon cannot read decisions');
select ok(has_table_privilege('authenticated','public.coach_decisions','select'),'athlete may read own decisions');
select ok(not has_function_privilege('authenticated','public.create_coach_decision(uuid,jsonb)','execute'),'client cannot forge proposals');
select ok(not has_function_privilege('authenticated','public.materialize_coach_decision(uuid,uuid)','execute'),'client cannot invoke materialization RPC directly');

insert into auth.users(id,email) values('31111111-1111-4111-8111-111111111111','coach-a@example.invalid'),('32222222-2222-4222-8222-222222222222','coach-b@example.invalid');
insert into public.athletes(id,user_id) values('3aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','31111111-1111-4111-8111-111111111111'),('3bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','32222222-2222-4222-8222-222222222222');
set local request.jwt.claim.sub='31111111-1111-4111-8111-111111111111'; set local role authenticated;
insert into public.training_programs(id,athlete_id,name) values('32000000-0000-4000-8000-000000000001',public.current_athlete_id(),'Base');
select lives_ok($$select public.replace_training_program_structure('32000000-0000-4000-8000-000000000001','{"blocks":[{"sequence":1,"name":"Base","weeks":[{"sequence":1,"days":[{"sequence":1,"name":"A","prescriptions":[{"sequence":1,"exerciseId":"50000000-0000-4000-8000-000000000001","sets":[{"sequence":1,"targetMetric":"reps","targetMin":8,"targetMax":10,"rirMin":2,"rirMax":2,"restMinSeconds":120,"restMaxSeconds":120,"tempo":null,"loadKind":"absolute","loadKg":30}]}]}]}]}]}'::jsonb)$$,'baseline hierarchy created');
select lives_ok($$select public.activate_training_program('32000000-0000-4000-8000-000000000001')$$,'baseline activated');
reset role; set local role service_role;
select lives_ok($$
  select public.create_coach_decision('31111111-1111-4111-8111-111111111111',jsonb_build_object(
    'schemaVersion','coach-proposal-v1','id','33000000-0000-4000-8000-000000000001','analysisId','analysis-1',
    'sourceProgramId','32000000-0000-4000-8000-000000000001','sourceProgramRevision',1,'createdAt',now(),
    'summary','Ajustar RIR','rationale','Evidência individual','evidenceReferences','[]'::jsonb,'limitations','[]'::jsonb,'requiresHumanApproval',true,
    'analysisSnapshot',jsonb_build_object('provider','fixture','model','deterministic','promptVersion','coach-proposal-v1','policyVersion','coach-safety-v1','dossierSchemaVersion','athlete-training-dossier-v1','summary','Análise'),
    'actions',jsonb_build_array(jsonb_build_object('kind','adjust_prescription_rir','trainingDayId',(select d.id from public.training_days d join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id='32000000-0000-4000-8000-000000000001'),'exercisePrescriptionId',(select ep.id from public.exercise_prescriptions ep join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id='32000000-0000-4000-8000-000000000001'),'prescriptionSetId',(select ps.id from public.prescription_sets ps join public.exercise_prescriptions ep on ep.id=ps.exercise_prescription_id join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id='32000000-0000-4000-8000-000000000001'),'rirMin',3,'rirMax',3,'rationale','Monitorar','evidence','[]'::jsonb))))
$$,'backend creates validated proposal record');
select lives_ok($$select public.materialize_coach_decision('31111111-1111-4111-8111-111111111111','33000000-0000-4000-8000-000000000001')$$,'approval materializes atomically');
select is((select status from public.coach_decisions where id='33000000-0000-4000-8000-000000000001'),'materialized','decision is materialized');
select is((select count(*) from public.training_programs where supersedes_program_id='32000000-0000-4000-8000-000000000001'),1::bigint,'one draft revision created');
select is((select status from public.training_programs where supersedes_program_id='32000000-0000-4000-8000-000000000001'),'draft','new revision remains draft');
select is((select status from public.training_programs where id='32000000-0000-4000-8000-000000000001'),'active','source remains active');
select is((select rir_min from public.prescription_sets ps join public.exercise_prescriptions ep on ep.id=ps.exercise_prescription_id join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=(select materialized_program_id from public.coach_decisions where id='33000000-0000-4000-8000-000000000001')),3::smallint,'only intended value changed');
select lives_ok($$select public.materialize_coach_decision('31111111-1111-4111-8111-111111111111','33000000-0000-4000-8000-000000000001')$$,'approval retry is idempotent');
select is((select count(*) from public.training_programs where supersedes_program_id='32000000-0000-4000-8000-000000000001'),1::bigint,'retry creates no duplicate');
select throws_ok($$select public.reject_coach_decision('31111111-1111-4111-8111-111111111111','33000000-0000-4000-8000-000000000001','not_now',null)$$,'55000','Decision not found or already decided','terminal decision cannot be rejected');
select lives_ok($$select public.create_coach_decision('31111111-1111-4111-8111-111111111111',jsonb_set((select proposal_snapshot from public.coach_decisions where id='33000000-0000-4000-8000-000000000001'),'{id}','"33000000-0000-4000-8000-000000000002"'))$$,'second proposal created for rejection');
select lives_ok($$select public.reject_coach_decision('31111111-1111-4111-8111-111111111111','33000000-0000-4000-8000-000000000002','prefer_current_program',null)$$,'human rejection is recorded');
select is((select status from public.coach_decisions where id='33000000-0000-4000-8000-000000000002'),'rejected','rejection is terminal without program change');
select lives_ok($$select public.create_coach_decision('31111111-1111-4111-8111-111111111111',jsonb_set((select proposal_snapshot from public.coach_decisions where id='33000000-0000-4000-8000-000000000001'),'{id}','"33000000-0000-4000-8000-000000000003"'))$$,'proposal created before baseline changes');
reset role; set local request.jwt.claim.sub='31111111-1111-4111-8111-111111111111'; set local role authenticated;
insert into public.training_programs(id,athlete_id,name) values('32000000-0000-4000-8000-000000000009',public.current_athlete_id(),'Replacement');
select lives_ok($$select public.replace_training_program_structure('32000000-0000-4000-8000-000000000009','{"blocks":[{"sequence":1,"name":"B","weeks":[{"sequence":1,"days":[{"sequence":1,"name":"D","prescriptions":[{"sequence":1,"exerciseId":"50000000-0000-4000-8000-000000000001","sets":[{"sequence":1,"targetMetric":"reps","targetMin":8,"targetMax":10,"rirMin":2,"rirMax":2,"restMinSeconds":120,"restMaxSeconds":120,"tempo":null,"loadKind":"absolute","loadKg":30}]}]}]}]}]}'::jsonb)$$,'replacement draft created');
select lives_ok($$select public.activate_training_program('32000000-0000-4000-8000-000000000009')$$,'baseline changes before approval');
reset role; set local role service_role;
select lives_ok($$select public.materialize_coach_decision('31111111-1111-4111-8111-111111111111','33000000-0000-4000-8000-000000000003')$$,'stale approval returns safely');
select is((select status from public.coach_decisions where id='33000000-0000-4000-8000-000000000003'),'stale','changed baseline marks proposal stale');
select is((select materialized_program_id from public.coach_decisions where id='33000000-0000-4000-8000-000000000003'),null::uuid,'stale proposal creates no draft');
reset role; set local request.jwt.claim.sub='32222222-2222-4222-8222-222222222222'; set local role authenticated;
select is((select count(*) from public.coach_decisions),0::bigint,'cross-athlete decision reads are blocked');
reset role; select * from finish(); rollback;
