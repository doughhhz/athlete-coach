begin; create extension if not exists pgtap with schema extensions; select no_plan();
-- Test-only privileged seeding (ADR-0103): clients can no longer insert program
-- rows; fixtures that only need an existing root bypass the product flow on
-- purpose here. Rolled back with the test transaction; never in production.
create function public.test_seed_program_root(p_id uuid, p_name text, p_athlete uuid default null, p_goal uuid default null) returns void language sql security definer set search_path='' as $seed$
  insert into public.training_programs(id,athlete_id,athlete_goal_id,name) values(p_id,coalesce(p_athlete,public.current_athlete_id()),p_goal,p_name) $seed$;
grant execute on function public.test_seed_program_root(uuid,text,uuid,uuid) to authenticated;
-- Phase 14 (ADR-0068..0071): coach-proposal-v3 exercise replacement.
-- Seed catalog: 0001 barbell bench, 0002 dumbbell bench ("0002 variation_of 0001", one-way),
-- 0003 incline dumbbell (no relation to 0001), 0004 push-up (equipment_alternative both ways with 0001).
insert into auth.users(id,email) values('51111111-1111-4111-8111-111111111111','repl-a@example.invalid'),('52222222-2222-4222-8222-222222222222','repl-b@example.invalid');
insert into public.athletes(id,user_id) values('5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','51111111-1111-4111-8111-111111111111'),('5bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','52222222-2222-4222-8222-222222222222');

create function public.t14_program(p_id uuid,p_load_kind text default 'absolute') returns void language plpgsql as $$
declare load1 text := case when p_load_kind='absolute' then '60' else 'null' end; load2 text := case when p_load_kind='absolute' then '62.5' else 'null' end;
begin
  perform public.test_seed_program_root(p_id,'Base');
  perform public.replace_training_program_structure(p_id,format('{"blocks":[{"sequence":1,"name":"B","weeks":[{"sequence":1,"days":[{"sequence":1,"name":"A","prescriptions":[{"sequence":1,"exerciseId":"50000000-0000-4000-8000-000000000001","sets":[
    {"sequence":1,"targetMetric":"reps","targetMin":8,"targetMax":10,"rirMin":2,"rirMax":2,"restMinSeconds":120,"restMaxSeconds":120,"tempo":"3-1-X-0","loadKind":"%1$s","loadKg":%2$s},
    {"sequence":2,"targetMetric":"reps","targetMin":6,"targetMax":8,"rirMin":1,"rirMax":1,"restMinSeconds":150,"restMaxSeconds":150,"tempo":null,"loadKind":"%1$s","loadKg":%3$s}]}]}]}]}]}',p_load_kind,load1,load2)::jsonb);
  perform public.activate_training_program(p_id);
end $$;
create function public.t14_day(p_program uuid) returns uuid language sql as $$ select d.id from public.training_days d join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program $$;
create function public.t14_ep(p_program uuid) returns uuid language sql as $$ select ep.id from public.exercise_prescriptions ep where ep.training_day_id=public.t14_day(p_program) $$;
create function public.t14_ex(p_n int) returns uuid language sql as $$ select ('50000000-0000-4000-8000-'||lpad(p_n::text,12,'0'))::uuid $$;
create function public.t14_replace(p_program uuid,p_source int,p_target int,p_context jsonb,p_transition jsonb default '{"mode":"athlete_selected"}'::jsonb) returns jsonb language sql as $$ select jsonb_build_object('kind','replace_exercise','trainingDayId',public.t14_day(p_program),'exercisePrescriptionId',public.t14_ep(p_program),'sourceExerciseId',public.t14_ex(p_source),'replacementExerciseId',case when p_target=0 then '59999999-9999-4999-8999-999999999999'::uuid else public.t14_ex(p_target) end,'relationshipContext',p_context,'loadTransition',p_transition,'rationale','Disponibilidade de equipamento','evidence','[]'::jsonb) $$;
create function public.t14_ctx(p_type text,p_direction text) returns jsonb language sql as $$ select jsonb_build_array(jsonb_build_object('relationType',p_type,'direction',p_direction)) $$;
create function public.t14_proposal(p_id uuid,p_program uuid,p_actions jsonb,p_version text default 'coach-proposal-v3') returns jsonb language sql as $$ select jsonb_build_object('schemaVersion',p_version,'id',p_id,'analysisId','a','sourceProgramId',p_program,'sourceProgramRevision',1,'createdAt',now(),'summary','S','rationale','R','evidenceReferences','[]'::jsonb,'limitations','[]'::jsonb,'requiresHumanApproval',true,'analysisSnapshot',jsonb_build_object('provider','fixture','model','m','promptVersion','coach-proposal-prompt-v5','policyVersion','coach-safety-v1','dossierSchemaVersion','athlete-training-dossier-v5','summary','A'),'actions',p_actions) $$;
create function public.t14_draft_sets(p_decision uuid) returns text language sql as $$ select string_agg(ps.sequence||':'||ps.target_min::int||'-'||ps.target_max::int||':'||ps.load_kind||':'||coalesce(ps.load_kg::text,'-'),',' order by ps.sequence) from public.prescription_sets ps where ps.exercise_prescription_id=public.t14_ep((select materialized_program_id from public.coach_decisions where id=p_decision)) $$;
grant execute on function public.t14_program(uuid,text) to authenticated;

create function public.t14_new(p_program uuid,p_load_kind text default 'absolute') returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub','51111111-1111-4111-8111-111111111111',true);
  execute 'set local role authenticated';
  perform public.t14_program(p_program,p_load_kind);
  execute 'reset role';
end $$;

create function public.t14_reject(p_n int,p_actions jsonb,p_version text default 'coach-proposal-v3') returns void language plpgsql as $$ begin
  perform public.create_coach_decision('51111111-1111-4111-8111-111111111111',public.t14_proposal(('54000000-0000-4000-8000-0000000001'||lpad(p_n::text,2,'0'))::uuid,'53000000-0000-4000-8000-000000000004',p_actions,p_version));
  perform public.materialize_coach_decision('51111111-1111-4111-8111-111111111111',('54000000-0000-4000-8000-0000000001'||lpad(p_n::text,2,'0'))::uuid);
end $$;

select ok((select pg_get_constraintdef(oid) like '%coach-proposal-v3%' from pg_constraint where conname='coach_decisions_proposal_schema_version_check'),'ledger accepts coach-proposal-v3');

-- VALID REPLACEMENT (athlete_selected) -----------------------------------------
select public.t14_new('53000000-0000-4000-8000-000000000001');
set local role service_role;
select lives_ok($$select public.create_coach_decision('51111111-1111-4111-8111-111111111111',public.t14_proposal('54000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',jsonb_build_array(public.t14_replace('53000000-0000-4000-8000-000000000001',1,2,public.t14_ctx('variation_of','candidate_to_source')))))$$,'v3 replacement proposal recorded');
select lives_ok($$select public.materialize_coach_decision('51111111-1111-4111-8111-111111111111','54000000-0000-4000-8000-000000000001')$$,'valid replacement materializes');
select is((select ep.exercise_id from public.exercise_prescriptions ep where ep.id=public.t14_ep((select materialized_program_id from public.coach_decisions where id='54000000-0000-4000-8000-000000000001'))),public.t14_ex(2),'draft uses the replacement exercise');
select is(public.t14_draft_sets('54000000-0000-4000-8000-000000000001'),'1:8-10:athlete_selected:-,2:6-8:athlete_selected:-','sets preserved; absolute load not copied');
select is((select ps.rir_min||'/'||ps.rest_min_seconds||'/'||ps.tempo from public.prescription_sets ps where ps.exercise_prescription_id=public.t14_ep((select materialized_program_id from public.coach_decisions where id='54000000-0000-4000-8000-000000000001')) and ps.sequence=1),'2/120/3-1-X-0','RIR, rest and tempo preserved');
select is((select exercise_id from public.exercise_prescriptions where id=public.t14_ep('53000000-0000-4000-8000-000000000001')),public.t14_ex(1),'source program keeps its exercise');
select is((select string_agg(load_kind||':'||load_kg,',' order by sequence) from public.prescription_sets where exercise_prescription_id=public.t14_ep('53000000-0000-4000-8000-000000000001')),'absolute:60.00,absolute:62.50','source loads unchanged');
select is((select p.status||'/'||p.supersedes_program_id from public.training_programs p join public.coach_decisions d on d.materialized_program_id=p.id where d.id='54000000-0000-4000-8000-000000000001'),'draft/53000000-0000-4000-8000-000000000001','draft only, lineage preserved');
select is((select status from public.training_programs where id='53000000-0000-4000-8000-000000000001'),'active','source stays active (no activation of the draft)');
select lives_ok($$select public.materialize_coach_decision('51111111-1111-4111-8111-111111111111','54000000-0000-4000-8000-000000000001')$$,'retry is idempotent');
select is((select count(*) from public.training_programs where supersedes_program_id='53000000-0000-4000-8000-000000000001'),1::bigint,'no second draft');

-- EXPLICIT ABSOLUTE + SYMMETRIC RELATION ------------------------------------
reset role; select public.t14_new('53000000-0000-4000-8000-000000000002'); set local role service_role;
select lives_ok($$select public.create_coach_decision('51111111-1111-4111-8111-111111111111',public.t14_proposal('54000000-0000-4000-8000-000000000002','53000000-0000-4000-8000-000000000002',jsonb_build_array(public.t14_replace('53000000-0000-4000-8000-000000000002',1,4,jsonb_build_array(jsonb_build_object('relationType','equipment_alternative','direction','source_to_candidate'),jsonb_build_object('relationType','equipment_alternative','direction','candidate_to_source')),'{"mode":"explicit_absolute","loadKg":20}'::jsonb))))$$,'symmetric relation with explicit load recorded');
select lives_ok($$select public.materialize_coach_decision('51111111-1111-4111-8111-111111111111','54000000-0000-4000-8000-000000000002')$$,'symmetric relation materializes');
select is(public.t14_draft_sets('54000000-0000-4000-8000-000000000002'),'1:8-10:absolute:20.00,2:6-8:absolute:20.00','explicit replacement load applied, not converted');

-- PRESERVE NON-ABSOLUTE ------------------------------------------------------
reset role; select public.t14_new('53000000-0000-4000-8000-000000000003','athlete_selected'); set local role service_role;
select lives_ok($$select public.create_coach_decision('51111111-1111-4111-8111-111111111111',public.t14_proposal('54000000-0000-4000-8000-000000000003','53000000-0000-4000-8000-000000000003',jsonb_build_array(public.t14_replace('53000000-0000-4000-8000-000000000003',1,2,public.t14_ctx('variation_of','candidate_to_source'),'{"mode":"preserve_non_absolute"}'::jsonb))))$$,'preserve non-absolute recorded');
select lives_ok($$select public.materialize_coach_decision('51111111-1111-4111-8111-111111111111','54000000-0000-4000-8000-000000000003')$$,'non-absolute load preserved');
select is(public.t14_draft_sets('54000000-0000-4000-8000-000000000003'),'1:8-10:athlete_selected:-,2:6-8:athlete_selected:-','athlete-selected load kept');

-- REJECTIONS -----------------------------------------------------------------
reset role; select public.t14_new('53000000-0000-4000-8000-000000000004'); set local role service_role;
select throws_ok($$select public.t14_reject(1,jsonb_build_array(public.t14_replace('53000000-0000-4000-8000-000000000004',2,4,public.t14_ctx('equipment_alternative','source_to_candidate'))))$$,'22023','Source exercise does not match the prescription','source mismatch rejected');
select throws_ok($$select public.t14_reject(2,jsonb_build_array(public.t14_replace('53000000-0000-4000-8000-000000000004',1,0,public.t14_ctx('variation_of','candidate_to_source'))))$$,'22023','Replacement exercise not found','unknown replacement rejected');
select throws_ok($$select public.t14_reject(3,jsonb_build_array(public.t14_replace('53000000-0000-4000-8000-000000000004',1,1,public.t14_ctx('variation_of','candidate_to_source'))))$$,'22023','Replacement must differ from the source exercise','same exercise rejected');
select throws_ok($$select public.t14_reject(4,jsonb_build_array(public.t14_replace('53000000-0000-4000-8000-000000000004',1,3,public.t14_ctx('variation_of','candidate_to_source'))))$$,'22023','Replacement requires a stored exercise relation','missing relation rejected');
select throws_ok($$select public.t14_reject(5,jsonb_build_array(public.t14_replace('53000000-0000-4000-8000-000000000004',1,2,public.t14_ctx('variation_of','source_to_candidate'))))$$,'22023','Relationship context does not match stored relations','wrong relation direction rejected');
select throws_ok($$select public.t14_reject(6,jsonb_build_array(public.t14_replace('53000000-0000-4000-8000-000000000004',1,4,public.t14_ctx('equipment_alternative','source_to_candidate'))))$$,'22023','Relationship context does not match stored relations','incomplete symmetric context rejected');
select throws_ok($$select public.t14_reject(7,jsonb_build_array(public.t14_replace('53000000-0000-4000-8000-000000000004',1,2,public.t14_ctx('variation_of','candidate_to_source'),'{"mode":"preserve_non_absolute"}'::jsonb)))$$,'22023','Absolute load cannot be preserved across a replacement','absolute load cannot silently transfer');
select throws_ok($$select public.t14_reject(8,jsonb_build_array(public.t14_replace('53000000-0000-4000-8000-000000000004',1,2,public.t14_ctx('variation_of','candidate_to_source'),'{"mode":"convert"}'::jsonb)))$$,'22023','Invalid load transition','unknown load transition rejected');
select throws_ok($$select public.t14_reject(9,jsonb_build_array(public.t14_replace('53000000-0000-4000-8000-000000000004',1,2,public.t14_ctx('variation_of','candidate_to_source'),'{"mode":"explicit_absolute","loadKg":0}'::jsonb)))$$,'22023','Explicit replacement load must be positive','non-positive explicit load rejected');
select throws_ok($$select public.t14_reject(10,jsonb_build_array(public.t14_replace('53000000-0000-4000-8000-000000000004',1,2,public.t14_ctx('variation_of','candidate_to_source')),jsonb_build_object('kind','adjust_absolute_load_target','trainingDayId',public.t14_day('53000000-0000-4000-8000-000000000004'),'exercisePrescriptionId',public.t14_ep('53000000-0000-4000-8000-000000000004'),'prescriptionSetId',(select id from public.prescription_sets where exercise_prescription_id=public.t14_ep('53000000-0000-4000-8000-000000000004') and sequence=1),'loadKg',90,'rationale','r','evidence','[]'::jsonb)))$$,'22023','Absolute load of a replaced prescription comes only from its load transition','conflicting load action rejected');
select throws_ok($$select public.t14_reject(11,jsonb_build_array(public.t14_replace('53000000-0000-4000-8000-000000000004',1,2,public.t14_ctx('variation_of','candidate_to_source')),public.t14_replace('53000000-0000-4000-8000-000000000004',1,4,jsonb_build_array(jsonb_build_object('relationType','equipment_alternative','direction','source_to_candidate'),jsonb_build_object('relationType','equipment_alternative','direction','candidate_to_source')))))$$,'22023','Duplicate replacement','double replacement rejected');
select throws_ok($$select public.t14_reject(12,jsonb_build_array(public.t14_replace('53000000-0000-4000-8000-000000000004',1,2,public.t14_ctx('variation_of','candidate_to_source'))),'coach-proposal-v2')$$,'22023','Unsupported proposal action','v2 snapshots never execute replacements');
select is((select count(*) from public.training_programs where supersedes_program_id='53000000-0000-4000-8000-000000000004'),0::bigint,'rejected replacements create no draft');
select throws_ok($$insert into public.coach_decisions(athlete_id,source_analysis_id,proposal_schema_version,proposal_snapshot,source_program_id,source_program_revision,provider,model_identifier,prompt_version,safety_policy_version,dossier_schema_version) values('5aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a','coach-proposal-v2',public.t14_proposal('54000000-0000-4000-8000-000000000099','53000000-0000-4000-8000-000000000004',jsonb_build_array(public.t14_replace('53000000-0000-4000-8000-000000000004',1,2,public.t14_ctx('variation_of','candidate_to_source')))),'53000000-0000-4000-8000-000000000004',1,'f','m','p','s','d')$$,'23514',null,'mismatched column/snapshot version rejected');

-- COMPATIBILITY v1/v2 ----------------------------------------------------------
select lives_ok($$select public.create_coach_decision('51111111-1111-4111-8111-111111111111',public.t14_proposal('54000000-0000-4000-8000-000000000005','53000000-0000-4000-8000-000000000004',jsonb_build_array(jsonb_build_object('kind','add_prescription_set','trainingDayId',public.t14_day('53000000-0000-4000-8000-000000000004'),'exercisePrescriptionId',public.t14_ep('53000000-0000-4000-8000-000000000004'),'position','end','copyFromPrescriptionSetId',null,'plannedSet',jsonb_build_object('targetMetric','reps','targetMin',5,'targetMax',5,'rirMin',null,'rirMax',null,'restMinSeconds',null,'restMaxSeconds',null,'tempo',null,'loadKind','athlete_selected','loadKg',null),'rationale','r','evidence','[]'::jsonb)),'coach-proposal-v2'))$$,'v2 set-count proposal still accepted');
select lives_ok($$select public.materialize_coach_decision('51111111-1111-4111-8111-111111111111','54000000-0000-4000-8000-000000000005')$$,'v2 materialization unchanged');
select is(public.t14_draft_sets('54000000-0000-4000-8000-000000000005'),'1:8-10:absolute:60.00,2:6-8:absolute:62.50,3:5-5:athlete_selected:-','v2 add-set semantics preserved');
reset role; select public.t14_new('53000000-0000-4000-8000-000000000006'); set local role service_role;
select lives_ok($$select public.create_coach_decision('51111111-1111-4111-8111-111111111111',public.t14_proposal('54000000-0000-4000-8000-000000000006','53000000-0000-4000-8000-000000000006',jsonb_build_array(jsonb_build_object('kind','adjust_prescription_rir','trainingDayId',public.t14_day('53000000-0000-4000-8000-000000000006'),'exercisePrescriptionId',public.t14_ep('53000000-0000-4000-8000-000000000006'),'prescriptionSetId',(select id from public.prescription_sets where exercise_prescription_id=public.t14_ep('53000000-0000-4000-8000-000000000006') and sequence=2),'rirMin',3,'rirMax',3,'rationale','r','evidence','[]'::jsonb)),'coach-proposal-v1'))$$,'v1 proposal still accepted');
select lives_ok($$select public.materialize_coach_decision('51111111-1111-4111-8111-111111111111','54000000-0000-4000-8000-000000000006')$$,'v1 materialization unchanged');
select is((select exercise_id from public.exercise_prescriptions where id=public.t14_ep((select materialized_program_id from public.coach_decisions where id='54000000-0000-4000-8000-000000000006'))),public.t14_ex(1),'v1 keeps the exercise');

-- STALE ---------------------------------------------------------------------------
reset role; select public.t14_new('53000000-0000-4000-8000-000000000007'); set local role service_role;
select lives_ok($$select public.create_coach_decision('51111111-1111-4111-8111-111111111111',public.t14_proposal('54000000-0000-4000-8000-000000000007','53000000-0000-4000-8000-000000000007',jsonb_build_array(public.t14_replace('53000000-0000-4000-8000-000000000007',1,2,public.t14_ctx('variation_of','candidate_to_source')))))$$,'replacement proposed before baseline change');
reset role; select public.t14_new('53000000-0000-4000-8000-000000000008'); set local role service_role;
select lives_ok($$select public.materialize_coach_decision('51111111-1111-4111-8111-111111111111','54000000-0000-4000-8000-000000000007')$$,'stale replacement approval returns safely');
select is((select status from public.coach_decisions where id='54000000-0000-4000-8000-000000000007'),'stale','changed baseline marks replacement stale');
select is((select count(*) from public.training_programs where supersedes_program_id='53000000-0000-4000-8000-000000000007'),0::bigint,'stale replacement materializes nothing');

-- CROSS-ATHLETE / RLS -------------------------------------------------------
select throws_ok($$select public.materialize_coach_decision('52222222-2222-4222-8222-222222222222','54000000-0000-4000-8000-000000000001')$$,'P0002','Decision not found','another user cannot materialize a foreign replacement');
reset role; set local request.jwt.claim.sub='52222222-2222-4222-8222-222222222222'; set local role authenticated;
select is((select count(*) from public.coach_decisions),0::bigint,'other athlete cannot read replacement decisions');
select throws_ok($$select public.materialize_coach_decision('52222222-2222-4222-8222-222222222222','54000000-0000-4000-8000-000000000001')$$,'42501',null,'authenticated clients cannot call materialization');
reset role; select * from finish(); rollback;
