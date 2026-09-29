begin; create extension if not exists pgtap with schema extensions; select no_plan();
-- Test-only privileged seeding (ADR-0103): clients can no longer insert program
-- rows; fixtures that only need an existing root bypass the product flow on
-- purpose here. Rolled back with the test transaction; never in production.
create function public.test_seed_program_root(p_id uuid, p_name text, p_athlete uuid default null, p_goal uuid default null) returns void language sql security definer set search_path='' as $seed$
  insert into public.training_programs(id,athlete_id,athlete_goal_id,name) values(p_id,coalesce(p_athlete,public.current_athlete_id()),p_goal,p_name) $seed$;
grant execute on function public.test_seed_program_root(uuid,text,uuid,uuid) to authenticated;
-- Phase 13 (ADR-0062/0064): coach-proposal-v2 set-count materialization.
insert into auth.users(id,email) values('41111111-1111-4111-8111-111111111111','sets-a@example.invalid'),('42222222-2222-4222-8222-222222222222','sets-b@example.invalid');
insert into public.athletes(id,user_id) values('4aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','41111111-1111-4111-8111-111111111111'),('4bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','42222222-2222-4222-8222-222222222222');

-- Test-only helpers (rolled back with the transaction).
create function public.t13_program(p_id uuid) returns void language plpgsql as $$ begin
  perform public.test_seed_program_root(p_id,'Base');
  perform public.replace_training_program_structure(p_id,'{"blocks":[{"sequence":1,"name":"B","weeks":[{"sequence":1,"days":[{"sequence":1,"name":"A","prescriptions":[
    {"sequence":1,"exerciseId":"50000000-0000-4000-8000-000000000001","sets":[
      {"sequence":1,"targetMetric":"reps","targetMin":8,"targetMax":10,"rirMin":2,"rirMax":2,"restMinSeconds":120,"restMaxSeconds":120,"tempo":null,"loadKind":"athlete_selected","loadKg":null},
      {"sequence":2,"targetMetric":"reps","targetMin":6,"targetMax":8,"rirMin":2,"rirMax":2,"restMinSeconds":120,"restMaxSeconds":120,"tempo":null,"loadKind":"athlete_selected","loadKg":null},
      {"sequence":3,"targetMetric":"reps","targetMin":10,"targetMax":12,"rirMin":2,"rirMax":2,"restMinSeconds":120,"restMaxSeconds":120,"tempo":null,"loadKind":"athlete_selected","loadKg":null}]},
    {"sequence":2,"exerciseId":"50000000-0000-4000-8000-000000000001","sets":[
      {"sequence":1,"targetMetric":"reps","targetMin":8,"targetMax":10,"rirMin":null,"rirMax":null,"restMinSeconds":null,"restMaxSeconds":null,"tempo":null,"loadKind":"unprescribed","loadKg":null}]}]}]}]}]}'::jsonb);
  perform public.activate_training_program(p_id);
end $$;
create function public.t13_day(p_program uuid) returns uuid language sql as $$ select d.id from public.training_days d join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program $$;
create function public.t13_ep(p_program uuid,p_seq int) returns uuid language sql as $$ select ep.id from public.exercise_prescriptions ep join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program and ep.sequence=p_seq $$;
create function public.t13_set(p_program uuid,p_ep int,p_seq int) returns uuid language sql as $$ select ps.id from public.prescription_sets ps where ps.exercise_prescription_id=public.t13_ep(p_program,p_ep) and ps.sequence=p_seq $$;
create function public.t13_sets(p_program uuid,p_ep int) returns text language sql as $$ select string_agg(ps.sequence||':'||ps.target_min::int||'-'||ps.target_max::int,',' order by ps.sequence) from public.prescription_sets ps where ps.exercise_prescription_id=public.t13_ep(p_program,p_ep) $$;
create function public.t13_planned(p_min int,p_max int) returns jsonb language sql as $$ select jsonb_build_object('targetMetric','reps','targetMin',p_min,'targetMax',p_max,'rirMin',2,'rirMax',2,'restMinSeconds',90,'restMaxSeconds',90,'tempo','3-1-X-0','loadKind','athlete_selected','loadKg',null) $$;
create function public.t13_add(p_program uuid,p_ep int,p_planned jsonb,p_copy uuid default null) returns jsonb language sql as $$ select jsonb_build_object('kind','add_prescription_set','trainingDayId',public.t13_day(p_program),'exercisePrescriptionId',public.t13_ep(p_program,p_ep),'position','end','copyFromPrescriptionSetId',p_copy,'plannedSet',p_planned,'rationale','R','evidence','[]'::jsonb) $$;
create function public.t13_remove(p_program uuid,p_ep int,p_seq int) returns jsonb language sql as $$ select jsonb_build_object('kind','remove_prescription_set','trainingDayId',public.t13_day(p_program),'exercisePrescriptionId',public.t13_ep(p_program,p_ep),'prescriptionSetId',public.t13_set(p_program,p_ep,p_seq),'rationale','R','evidence','[]'::jsonb) $$;
create function public.t13_proposal(p_id uuid,p_program uuid,p_actions jsonb,p_version text default 'coach-proposal-v2') returns jsonb language sql as $$ select jsonb_build_object('schemaVersion',p_version,'id',p_id,'analysisId','a','sourceProgramId',p_program,'sourceProgramRevision',1,'createdAt',now(),'summary','S','rationale','R','evidenceReferences','[]'::jsonb,'limitations','[]'::jsonb,'requiresHumanApproval',true,'analysisSnapshot',jsonb_build_object('provider','fixture','model','m','promptVersion','coach-proposal-prompt-v4','policyVersion','coach-safety-v1','dossierSchemaVersion','athlete-training-dossier-v4','summary','A'),'actions',p_actions) $$;
grant execute on function public.t13_program(uuid) to authenticated;

select ok((select pg_get_constraintdef(oid) like '%coach-proposal-v2%' from pg_constraint where conname='coach_decisions_proposal_schema_version_check'),'ledger accepts coach-proposal-v2');
select ok(not has_function_privilege('authenticated','public.materialize_coach_decision(uuid,uuid)','execute'),'client still cannot materialize directly');

-- ADD one set -------------------------------------------------------------
set local request.jwt.claim.sub='41111111-1111-4111-8111-111111111111'; set local role authenticated;
select public.t13_program('43000000-0000-4000-8000-000000000001');
reset role; set local role service_role;
select lives_ok($$select public.create_coach_decision('41111111-1111-4111-8111-111111111111',public.t13_proposal('44000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001',jsonb_build_array(public.t13_add('43000000-0000-4000-8000-000000000001',1,public.t13_planned(8,10),public.t13_set('43000000-0000-4000-8000-000000000001',1,3)))))$$,'v2 add-set proposal is recorded');
select is((select proposal_schema_version from public.coach_decisions where id='44000000-0000-4000-8000-000000000001'),'coach-proposal-v2','schema version column follows snapshot');
select lives_ok($$select public.materialize_coach_decision('41111111-1111-4111-8111-111111111111','44000000-0000-4000-8000-000000000001')$$,'add-set approval materializes');
select is((select public.t13_sets(materialized_program_id,1) from public.coach_decisions where id='44000000-0000-4000-8000-000000000001'),'1:8-10,2:6-8,3:10-12,4:8-10','added set appended with contiguous sequence');
select is((select ps.tempo from public.prescription_sets ps where ps.exercise_prescription_id=public.t13_ep((select materialized_program_id from public.coach_decisions where id='44000000-0000-4000-8000-000000000001'),1) and ps.sequence=4),'3-1-X-0','added set uses the explicit planned snapshot, not the copy source');
select is(public.t13_sets('43000000-0000-4000-8000-000000000001',1),'1:8-10,2:6-8,3:10-12','source program unchanged');
select is((select status from public.training_programs where id='43000000-0000-4000-8000-000000000001'),'active','source stays active');
select is((select p.status from public.training_programs p join public.coach_decisions d on d.materialized_program_id=p.id where d.id='44000000-0000-4000-8000-000000000001'),'draft','materialized revision is a draft (no activation)');
select is((select count(*) from public.prescription_sets ps where ps.exercise_prescription_id=public.t13_ep((select materialized_program_id from public.coach_decisions where id='44000000-0000-4000-8000-000000000001'),1) and ps.id in (select id from public.prescription_sets where exercise_prescription_id=public.t13_ep('43000000-0000-4000-8000-000000000001',1))),0::bigint,'draft sets have new UUIDs');
select is((select p.supersedes_program_id from public.training_programs p join public.coach_decisions d on d.materialized_program_id=p.id where d.id='44000000-0000-4000-8000-000000000001'),'43000000-0000-4000-8000-000000000001'::uuid,'lineage preserved');
select lives_ok($$select public.materialize_coach_decision('41111111-1111-4111-8111-111111111111','44000000-0000-4000-8000-000000000001')$$,'retry is idempotent');
select is((select count(*) from public.training_programs where supersedes_program_id='43000000-0000-4000-8000-000000000001'),1::bigint,'retry creates no second draft');
select is((select public.t13_sets(materialized_program_id,1) from public.coach_decisions where id='44000000-0000-4000-8000-000000000001'),'1:8-10,2:6-8,3:10-12,4:8-10','retry adds no extra set');

-- REMOVE + ADD multiple ---------------------------------------------------
reset role; set local request.jwt.claim.sub='41111111-1111-4111-8111-111111111111'; set local role authenticated;
select public.t13_program('43000000-0000-4000-8000-000000000002');
reset role; set local role service_role;
select lives_ok($$select public.create_coach_decision('41111111-1111-4111-8111-111111111111',public.t13_proposal('44000000-0000-4000-8000-000000000002','43000000-0000-4000-8000-000000000002',jsonb_build_array(public.t13_remove('43000000-0000-4000-8000-000000000002',1,2),public.t13_add('43000000-0000-4000-8000-000000000002',1,public.t13_planned(5,5)),public.t13_add('43000000-0000-4000-8000-000000000002',1,public.t13_planned(4,4)))))$$,'remove plus multiple adds recorded');
select lives_ok($$select public.materialize_coach_decision('41111111-1111-4111-8111-111111111111','44000000-0000-4000-8000-000000000002')$$,'remove/add materializes');
select is((select public.t13_sets(materialized_program_id,1) from public.coach_decisions where id='44000000-0000-4000-8000-000000000002'),'1:8-10,2:10-12,3:5-5,4:4-4','removed set gone, survivors renumbered, adds appended in action order');
select is((select public.t13_sets(materialized_program_id,2) from public.coach_decisions where id='44000000-0000-4000-8000-000000000002'),'1:8-10','untouched prescription cloned as is');

-- Invalid structures ------------------------------------------------------
reset role; set local request.jwt.claim.sub='41111111-1111-4111-8111-111111111111'; set local role authenticated;
select public.t13_program('43000000-0000-4000-8000-000000000003');
reset role; set local role service_role;
select lives_ok($$select public.create_coach_decision('41111111-1111-4111-8111-111111111111',public.t13_proposal('44000000-0000-4000-8000-000000000003','43000000-0000-4000-8000-000000000003',jsonb_build_array(public.t13_remove('43000000-0000-4000-8000-000000000003',2,1))))$$,'last-set removal proposal recorded for rejection test');
select throws_ok($$select public.materialize_coach_decision('41111111-1111-4111-8111-111111111111','44000000-0000-4000-8000-000000000003')$$,'22023','A prescription must keep at least one set','removing the last set is rejected');
select is((select status from public.coach_decisions where id='44000000-0000-4000-8000-000000000003'),'proposed','rejected materialization leaves decision proposed');
select is((select count(*) from public.training_programs where supersedes_program_id='43000000-0000-4000-8000-000000000003'),0::bigint,'no draft for zero-set prescription');
select lives_ok($$select public.create_coach_decision('41111111-1111-4111-8111-111111111111',public.t13_proposal('44000000-0000-4000-8000-000000000004','43000000-0000-4000-8000-000000000003',jsonb_build_array(public.t13_remove('43000000-0000-4000-8000-000000000003',1,1),public.t13_remove('43000000-0000-4000-8000-000000000003',1,1))))$$,'duplicate removal recorded for rejection test');
select throws_ok($$select public.materialize_coach_decision('41111111-1111-4111-8111-111111111111','44000000-0000-4000-8000-000000000004')$$,'22023','Duplicate proposal target','duplicate removal rejected');
select lives_ok($$select public.create_coach_decision('41111111-1111-4111-8111-111111111111',public.t13_proposal('44000000-0000-4000-8000-000000000005','43000000-0000-4000-8000-000000000003',jsonb_build_array(public.t13_remove('43000000-0000-4000-8000-000000000003',1,3),public.t13_add('43000000-0000-4000-8000-000000000003',1,public.t13_planned(8,10),public.t13_set('43000000-0000-4000-8000-000000000003',1,3)))))$$,'copy-from-removed recorded for rejection test');
select throws_ok($$select public.materialize_coach_decision('41111111-1111-4111-8111-111111111111','44000000-0000-4000-8000-000000000005')$$,'22023','Copy source is removed by the same proposal','ambiguous copy source rejected');
select lives_ok($$select public.create_coach_decision('41111111-1111-4111-8111-111111111111',public.t13_proposal('44000000-0000-4000-8000-000000000006','43000000-0000-4000-8000-000000000003',jsonb_build_array(public.t13_add('43000000-0000-4000-8000-000000000003',1,public.t13_planned(8,10))),'coach-proposal-v1'))$$,'v1 snapshot with v2 kind recorded for rejection test');
select throws_ok($$select public.materialize_coach_decision('41111111-1111-4111-8111-111111111111','44000000-0000-4000-8000-000000000006')$$,'22023','Unsupported proposal action','v1 snapshots never execute v2 actions');
select throws_ok($$insert into public.coach_decisions(athlete_id,source_analysis_id,proposal_schema_version,proposal_snapshot,source_program_id,source_program_revision,provider,model_identifier,prompt_version,safety_policy_version,dossier_schema_version) values('4aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a','coach-proposal-v1',public.t13_proposal('44000000-0000-4000-8000-000000000007','43000000-0000-4000-8000-000000000003',jsonb_build_array(public.t13_remove('43000000-0000-4000-8000-000000000003',1,1))),'43000000-0000-4000-8000-000000000003',1,'f','m','p','s','d')$$,'23514',null,'column and snapshot versions must match');

-- Stale -------------------------------------------------------------------
select lives_ok($$select public.create_coach_decision('41111111-1111-4111-8111-111111111111',public.t13_proposal('44000000-0000-4000-8000-000000000008','43000000-0000-4000-8000-000000000003',jsonb_build_array(public.t13_add('43000000-0000-4000-8000-000000000003',1,public.t13_planned(8,10)))))$$,'add-set proposal before baseline change');
reset role; set local request.jwt.claim.sub='41111111-1111-4111-8111-111111111111'; set local role authenticated;
select public.t13_program('43000000-0000-4000-8000-000000000004');
reset role; set local role service_role;
select lives_ok($$select public.materialize_coach_decision('41111111-1111-4111-8111-111111111111','44000000-0000-4000-8000-000000000008')$$,'stale add-set approval returns safely');
select is((select status from public.coach_decisions where id='44000000-0000-4000-8000-000000000008'),'stale','changed baseline marks add-set proposal stale');
select is((select count(*) from public.training_programs where supersedes_program_id='43000000-0000-4000-8000-000000000003'),0::bigint,'stale proposal materializes nothing');

-- Historical v1 still works ------------------------------------------------
select lives_ok($$select public.create_coach_decision('41111111-1111-4111-8111-111111111111',public.t13_proposal('44000000-0000-4000-8000-000000000009','43000000-0000-4000-8000-000000000004',jsonb_build_array(jsonb_build_object('kind','adjust_prescription_rir','trainingDayId',public.t13_day('43000000-0000-4000-8000-000000000004'),'exercisePrescriptionId',public.t13_ep('43000000-0000-4000-8000-000000000004',1),'prescriptionSetId',public.t13_set('43000000-0000-4000-8000-000000000004',1,2),'rirMin',3,'rirMax',3,'rationale','R','evidence','[]'::jsonb)),'coach-proposal-v1'))$$,'v1 adjust proposal still accepted');
select lives_ok($$select public.materialize_coach_decision('41111111-1111-4111-8111-111111111111','44000000-0000-4000-8000-000000000009')$$,'v1 materialization unchanged');
select is((select public.t13_sets(materialized_program_id,1) from public.coach_decisions where id='44000000-0000-4000-8000-000000000009'),'1:8-10,2:6-8,3:10-12','v1 keeps set count');
select is((select ps.rir_min from public.prescription_sets ps where ps.exercise_prescription_id=public.t13_ep((select materialized_program_id from public.coach_decisions where id='44000000-0000-4000-8000-000000000009'),1) and ps.sequence=2),3::smallint,'v1 adjust applied to its set');

-- RLS ---------------------------------------------------------------------
reset role; set local request.jwt.claim.sub='42222222-2222-4222-8222-222222222222'; set local role authenticated;
select is((select count(*) from public.coach_decisions),0::bigint,'other athlete cannot read set-count decisions');
select throws_ok($$select public.materialize_coach_decision('42222222-2222-4222-8222-222222222222','44000000-0000-4000-8000-000000000002')$$,'42501',null,'authenticated cannot call materialization');
reset role; set local role service_role;
select throws_ok($$select public.materialize_coach_decision('42222222-2222-4222-8222-222222222222','44000000-0000-4000-8000-000000000003')$$,'P0002','Decision not found','another user cannot materialize foreign decision');
reset role; select * from finish(); rollback;
