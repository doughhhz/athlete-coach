begin; create extension if not exists pgtap with schema extensions; select no_plan();
-- Test-only privileged seeding (ADR-0103): clients can no longer insert program
-- rows; fixtures that only need an existing root bypass the product flow on
-- purpose here. Rolled back with the test transaction; never in production.
create function public.test_seed_program_root(p_id uuid, p_name text, p_athlete uuid default null, p_goal uuid default null) returns void language sql security definer set search_path='' as $seed$
  insert into public.training_programs(id,athlete_id,athlete_goal_id,name) values(p_id,coalesce(p_athlete,public.current_athlete_id()),p_goal,p_name) $seed$;
grant execute on function public.test_seed_program_root(uuid,text,uuid,uuid) to authenticated;
-- Implementation Phase 18 (ADR-0091..0094): stable training structure lineage.
insert into auth.users(id,email) values('91111111-1111-4111-8111-111111111111','lineage-a@example.invalid'),('92222222-2222-4222-8222-222222222222','lineage-b@example.invalid');
insert into public.athletes(id,user_id) values('9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','91111111-1111-4111-8111-111111111111'),('9bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','92222222-2222-4222-8222-222222222222');

create function public.t18_structure(p_exercise_a uuid default '50000000-0000-4000-8000-000000000001', p_exercise_b uuid default '50000000-0000-4000-8000-000000000003') returns jsonb language sql as $$
  select jsonb_build_object('blocks',jsonb_build_array(jsonb_build_object('sequence',1,'name','B','weeks',jsonb_build_array(jsonb_build_object('sequence',1,'days',jsonb_build_array(jsonb_build_object('sequence',1,'name','A','prescriptions',jsonb_build_array(
    jsonb_build_object('sequence',1,'exerciseId',p_exercise_a,'sets',jsonb_build_array(
      jsonb_build_object('sequence',1,'targetMetric','reps','targetMin',8,'targetMax',10,'rirMin',2,'rirMax',2,'restMinSeconds',120,'restMaxSeconds',120,'tempo',null,'loadKind','absolute','loadKg',60),
      jsonb_build_object('sequence',2,'targetMetric','reps','targetMin',8,'targetMax',10,'rirMin',2,'rirMax',2,'restMinSeconds',120,'restMaxSeconds',120,'tempo',null,'loadKind','absolute','loadKg',60))),
    jsonb_build_object('sequence',2,'exerciseId',p_exercise_b,'sets',jsonb_build_array(
      jsonb_build_object('sequence',1,'targetMetric','reps','targetMin',8,'targetMax',10,'rirMin',2,'rirMax',2,'restMinSeconds',120,'restMaxSeconds',120,'tempo',null,'loadKind','athlete_selected','loadKg',null))))))))))) $$;
-- Lineage fingerprint of a program: "<prescription sequence>:<prescription lineage>:<set lineages in order>".
create function public.t18_prescriptions(p_program uuid) returns table(sequence int, lineage uuid, exercise uuid, sets uuid[]) language sql as $$
  select ep.sequence, ep.lineage_id, ep.exercise_id, (select array_agg(ps.lineage_id order by ps.sequence) from public.prescription_sets ps where ps.exercise_prescription_id=ep.id)
  from public.exercise_prescriptions ep join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program order by ep.sequence $$;
create function public.t18_node_lineages(p_program uuid) returns uuid[] language sql as $$
  select array[(select b.lineage_id from public.training_blocks b where b.training_program_id=p_program),
    (select w.lineage_id from public.training_weeks w join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program),
    (select d.lineage_id from public.training_days d join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program)] $$;
create function public.t18_ids(p_program uuid) returns uuid[] language sql as $$
  select array_agg(ep.id order by ep.sequence) from public.exercise_prescriptions ep join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program $$;
grant execute on function public.t18_structure(uuid,uuid), public.t18_prescriptions(uuid), public.t18_node_lineages(uuid), public.t18_ids(uuid) to authenticated;

-- SCHEMA ---------------------------------------------------------------------------
select has_column('public','training_blocks','lineage_id','block lineage');
select has_column('public','training_weeks','lineage_id','week lineage');
select has_column('public','training_days','lineage_id','day lineage');
select has_column('public','exercise_prescriptions','lineage_id','prescription lineage');
select has_column('public','prescription_sets','lineage_id','set lineage');
select has_column('public','training_programs','lineage_tracked','program continuity flag');
select col_not_null('public','exercise_prescriptions','lineage_id','lineage is mandatory');

-- CREATION --------------------------------------------------------------------------
select set_config('request.jwt.claim.sub','91111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select public.test_seed_program_root('93000000-0000-4000-8000-000000000001','A','9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select is((select lineage_tracked from public.training_programs where id='93000000-0000-4000-8000-000000000001'),true,'new programs are lineage-tracked (client flag ignored)');
select lives_ok($$select public.replace_training_program_structure('93000000-0000-4000-8000-000000000001',public.t18_structure())$$,'structure created');
select is((select count(distinct lineage) from public.t18_prescriptions('93000000-0000-4000-8000-000000000001')),2::bigint,'each new prescription gets its own lineage');
select is((select count(distinct l) from public.t18_prescriptions('93000000-0000-4000-8000-000000000001') p, unnest(p.sets) l),3::bigint,'each new set gets its own lineage');
select throws_ok($$update public.training_programs set lineage_tracked=false where id='93000000-0000-4000-8000-000000000001'$$,'55000','Lineage continuity flag is immutable','continuity flag immutable');
select lives_ok($$select public.activate_training_program('93000000-0000-4000-8000-000000000001')$$,'program A activated');

-- CLONE -----------------------------------------------------------------------------
select lives_ok($$select public.clone_training_program_as_draft('93000000-0000-4000-8000-000000000001')$$,'revision B cloned');
create temp table t18_b as select id from public.training_programs where supersedes_program_id='93000000-0000-4000-8000-000000000001';
grant all on t18_b to authenticated, service_role;
select ok((select public.t18_ids(id) from t18_b) && public.t18_ids('93000000-0000-4000-8000-000000000001') = false,'clone gets new row ids');
select is((select array_agg(lineage order by sequence) from public.t18_prescriptions((select id from t18_b))),(select array_agg(lineage order by sequence) from public.t18_prescriptions('93000000-0000-4000-8000-000000000001')),'clone preserves prescription lineage');
select is((select string_agg(sets::text,'|' order by sequence) from public.t18_prescriptions((select id from t18_b))),(select string_agg(sets::text,'|' order by sequence) from public.t18_prescriptions('93000000-0000-4000-8000-000000000001')),'clone preserves set lineage');
select is(public.t18_node_lineages((select id from t18_b)),public.t18_node_lineages('93000000-0000-4000-8000-000000000001'),'clone preserves block/week/day lineage');
select is((select lineage_tracked from public.training_programs where id=(select id from t18_b)),true,'clone is lineage-tracked');

-- SAVE: reorder, scalar edit, add, remove -------------------------------------------
create temp table t18_l as select * from public.t18_prescriptions((select id from t18_b));
grant all on t18_l to authenticated, service_role;
select lives_ok(format($$select public.replace_training_program_structure(%L, jsonb_build_object('blocks',jsonb_build_array(jsonb_build_object('lineageId',%L,'sequence',1,'name','B','weeks',jsonb_build_array(jsonb_build_object('lineageId',%L,'sequence',1,'days',jsonb_build_array(jsonb_build_object('lineageId',%L,'sequence',1,'name','A','prescriptions',jsonb_build_array(
    jsonb_build_object('lineageId',%L,'sequence',1,'exerciseId','50000000-0000-4000-8000-000000000003','sets',jsonb_build_array(jsonb_build_object('lineageId',%L,'sequence',1,'targetMetric','reps','targetMin',8,'targetMax',10,'rirMin',2,'rirMax',2,'restMinSeconds',120,'restMaxSeconds',120,'tempo',null,'loadKind','athlete_selected','loadKg',null))),
    jsonb_build_object('lineageId',%L,'sequence',2,'exerciseId','50000000-0000-4000-8000-000000000001','sets',jsonb_build_array(
      jsonb_build_object('lineageId',%L,'sequence',1,'targetMetric','reps','targetMin',8,'targetMax',10,'rirMin',3,'rirMax',3,'restMinSeconds',120,'restMaxSeconds',120,'tempo',null,'loadKind','absolute','loadKg',60),
      jsonb_build_object('sequence',2,'targetMetric','reps','targetMin',8,'targetMax',10,'rirMin',2,'rirMax',2,'restMinSeconds',120,'restMaxSeconds',120,'tempo',null,'loadKind','absolute','loadKg',60))))))))))))$$,
  (select id from t18_b), (public.t18_node_lineages((select id from t18_b)))[1], (public.t18_node_lineages((select id from t18_b)))[2], (public.t18_node_lineages((select id from t18_b)))[3],
  (select lineage from t18_l where sequence=2), (select sets[1] from t18_l where sequence=2),
  (select lineage from t18_l where sequence=1), (select sets[1] from t18_l where sequence=1)),'reordered/edited draft saved with lineage');
select is((select lineage from public.t18_prescriptions((select id from t18_b)) where sequence=2),(select lineage from t18_l where sequence=1),'reordered prescription keeps its lineage');
select is((select sets[1] from public.t18_prescriptions((select id from t18_b)) where sequence=2),(select sets[1] from t18_l where sequence=1),'edited set keeps its lineage');
select ok((select not (sets[2] = any((select sets from t18_l where sequence=1)::uuid[])) from public.t18_prescriptions((select id from t18_b)) where sequence=2),'added set gets a new lineage');
select ok(not exists(select 1 from public.t18_prescriptions((select id from t18_b)) p, unnest(p.sets) l where l=(select sets[2] from t18_l where sequence=1)),'removed set lineage is absent');
select is(public.t18_node_lineages((select id from t18_b)),public.t18_node_lineages('93000000-0000-4000-8000-000000000001'),'parents keep lineage through saves');

-- SECURITY --------------------------------------------------------------------------
select throws_ok(format($$select public.replace_training_program_structure(%L, jsonb_set(public.t18_structure(),'{blocks,0,lineageId}',to_jsonb(%L::text)))$$,(select id from t18_b),gen_random_uuid()),'22023','Unknown structure lineage','unknown lineage rejected');
select throws_ok(format($$select public.replace_training_program_structure(%L, jsonb_set(public.t18_structure(),'{blocks,0,weeks,0,days,0,prescriptions,0,lineageId}',to_jsonb(%L::text)))$$,(select id from t18_b),(select sets[1] from t18_l where sequence=1)),'22023','Unknown structure lineage','cross-level lineage rejected');
select throws_ok(format($$select public.replace_training_program_structure(%L, jsonb_set(jsonb_set(public.t18_structure(),'{blocks,0,weeks,0,days,0,prescriptions,0,lineageId}',to_jsonb(%L::text)),'{blocks,0,weeks,0,days,0,prescriptions,1,lineageId}',to_jsonb(%L::text)))$$,(select id from t18_b),(select lineage from t18_l where sequence=1),(select lineage from t18_l where sequence=1)),'22023','Duplicate structure lineage','duplicate lineage rejected');
insert into public.exercise_prescriptions(training_day_id,exercise_id,sequence,lineage_id) select d.id,'50000000-0000-4000-8000-000000000001',9,(select lineage from t18_l where sequence=1) from public.training_days d join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=(select id from t18_b);
select isnt((select lineage_id from public.exercise_prescriptions where sequence=9),(select lineage from t18_l where sequence=1),'direct client insert cannot attach an existing lineage');
select throws_ok($$update public.exercise_prescriptions set lineage_id=gen_random_uuid() where sequence=9$$,'55000','Structure lineage is immutable','lineage immutable');
delete from public.exercise_prescriptions where sequence=9;
reset role;
select set_config('request.jwt.claim.sub','92222222-2222-4222-8222-222222222222',true);
set local role authenticated;
select public.test_seed_program_root('93000000-0000-4000-8000-000000000009','Other','9bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
select throws_ok(format($$select public.replace_training_program_structure('93000000-0000-4000-8000-000000000009', jsonb_set(public.t18_structure(),'{blocks,0,weeks,0,days,0,prescriptions,0,lineageId}',to_jsonb(%L::text)))$$,(select lineage from t18_l where sequence=1)),'22023','Unknown structure lineage','another athlete cannot forge lineage');
reset role;

-- COACH MATERIALIZATION AND AUTO-DRAFT ---------------------------------------------
select set_config('request.jwt.claim.sub','91111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select lives_ok($$select public.activate_training_program((select id from t18_b))$$,'B activated manually');
reset role;
create function public.t18_proposal(p_id uuid,p_program uuid,p_actions jsonb) returns jsonb language sql as $$
  select jsonb_build_object('schemaVersion','coach-proposal-v3','id',p_id,'analysisId','a','sourceProgramId',p_program,'sourceProgramRevision',(select revision from public.training_programs where id=p_program),'createdAt',now(),'summary','S','rationale','R','evidenceReferences','[]'::jsonb,'limitations','[]'::jsonb,'requiresHumanApproval',true,
    'analysisSnapshot',jsonb_build_object('provider','fixture','model','m','promptVersion','p','policyVersion','coach-safety-v1','dossierSchemaVersion','athlete-training-dossier-v7','summary','A'),'actions',p_actions) $$;
create function public.t18_ep(p_program uuid,p_sequence int) returns uuid language sql as $$ select ep.id from public.exercise_prescriptions ep join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program and ep.sequence=p_sequence $$;
create function public.t18_day(p_program uuid) returns uuid language sql as $$ select d.id from public.training_days d join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program $$;
create temp table t18_src as select * from public.t18_prescriptions((select id from t18_b));
grant all on t18_src to service_role;
set local role service_role;
-- Replacement (exercise 0001 → 0002, stored variation relation) + remove one set + add one set.
select lives_ok(format($$select public.create_coach_decision('91111111-1111-4111-8111-111111111111',public.t18_proposal('94000000-0000-4000-8000-000000000001',%L,jsonb_build_array(
    jsonb_build_object('kind','replace_exercise','trainingDayId',public.t18_day(%L),'exercisePrescriptionId',public.t18_ep(%L,2),'sourceExerciseId','50000000-0000-4000-8000-000000000001','replacementExerciseId','50000000-0000-4000-8000-000000000002','relationshipContext',jsonb_build_array(jsonb_build_object('relationType','variation_of','direction','candidate_to_source')),'loadTransition',jsonb_build_object('mode','athlete_selected'),'rationale','r','evidence','[]'::jsonb),
    jsonb_build_object('kind','remove_prescription_set','trainingDayId',public.t18_day(%L),'exercisePrescriptionId',public.t18_ep(%L,2),'prescriptionSetId',(select ps.id from public.prescription_sets ps where ps.exercise_prescription_id=public.t18_ep(%L,2) and ps.sequence=2),'rationale','r','evidence','[]'::jsonb),
    jsonb_build_object('kind','add_prescription_set','trainingDayId',public.t18_day(%L),'exercisePrescriptionId',public.t18_ep(%L,1),'position','end','copyFromPrescriptionSetId',null,'plannedSet',jsonb_build_object('targetMetric','reps','targetMin',5,'targetMax',5,'rirMin',null,'rirMax',null,'restMinSeconds',null,'restMaxSeconds',null,'tempo',null,'loadKind','athlete_selected','loadKg',null),'rationale','r','evidence','[]'::jsonb))))$$,
  (select id from t18_b),(select id from t18_b),(select id from t18_b),(select id from t18_b),(select id from t18_b),(select id from t18_b),(select id from t18_b),(select id from t18_b)),'structural proposal recorded');
select lives_ok($$select public.materialize_coach_decision('91111111-1111-4111-8111-111111111111','94000000-0000-4000-8000-000000000001')$$,'materialized');
create temp table t18_m as select * from public.t18_prescriptions((select materialized_program_id from public.coach_decisions where id='94000000-0000-4000-8000-000000000001'));
select is((select array_agg(lineage order by sequence) from t18_m),(select array_agg(lineage order by sequence) from t18_src),'materialization preserves prescription lineage');
select is((select exercise from t18_m where sequence=2),'50000000-0000-4000-8000-000000000002'::uuid,'replacement changed the exercise');
select is((select lineage from t18_m where sequence=2),(select lineage from t18_src where sequence=2),'replaced prescription keeps its lineage');
select is((select sets from t18_m where sequence=2),(select sets[1:1] from t18_src where sequence=2),'removed set lineage absent; survivor keeps lineage');
select is((select sets[1] from t18_m where sequence=1),(select sets[1] from t18_src where sequence=1),'existing set keeps lineage');
select ok((select not (sets[2] = any((select array_agg(l) from t18_src, unnest(t18_src.sets) l)::uuid[])) from t18_m where sequence=1),'proposal-added set gets a new lineage');
select is(public.t18_node_lineages((select materialized_program_id from public.coach_decisions where id='94000000-0000-4000-8000-000000000001')),public.t18_node_lineages((select id from t18_b)),'materialization preserves block/week/day lineage');
select is((select lineage_tracked from public.training_programs p join public.coach_decisions d on d.materialized_program_id=p.id where d.id='94000000-0000-4000-8000-000000000001'),true,'materialized draft is lineage-tracked');

-- Auto-draft runs through the same engine: lineage preserved as well.
insert into public.athlete_coach_preferences(athlete_id,autonomy_mode,draft_authority_mode) values('9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','proactive','standard_auto_draft');
select public.record_coach_analysis_run('91111111-1111-4111-8111-111111111111','96000000-0000-4000-8000-000000000001',repeat('a',64),jsonb_build_object('schemaVersion','coach-analysis-v1','analysisId','a','requestId','r','createdAt',now(),'summary','S','observations','[]'::jsonb,'hypotheses','[]'::jsonb,'recommendations','[]'::jsonb,'questions','[]'::jsonb,'uncertainties','[]'::jsonb,'evidenceUsed','[]'::jsonb,'safetyFlags','[]'::jsonb,'metadata',jsonb_build_object('dossierSchemaVersion','athlete-training-dossier-v7','promptVersion','coach-system-v6','policyVersion','coach-safety-v1','provider','fixture','model','m')));
reset role;
-- A fresh active program C (B already has its single successor draft).
select set_config('request.jwt.claim.sub','91111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select public.test_seed_program_root('93000000-0000-4000-8000-000000000003','C','9aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select lives_ok($$select public.replace_training_program_structure('93000000-0000-4000-8000-000000000003',public.t18_structure())$$,'program C structured');
select lives_ok($$select public.activate_training_program('93000000-0000-4000-8000-000000000003')$$,'program C activated');
reset role;
create temp table t18_c as select * from public.t18_prescriptions('93000000-0000-4000-8000-000000000003');
grant all on t18_c to service_role;
set local role service_role;
select lives_ok(format($$select public.create_coach_decision_for_analysis('91111111-1111-4111-8111-111111111111',public.t18_proposal('94000000-0000-4000-8000-000000000002',%L,jsonb_build_array(jsonb_build_object('kind','adjust_prescription_rir','trainingDayId',public.t18_day(%L),'exercisePrescriptionId',public.t18_ep(%L,1),'prescriptionSetId',(select ps.id from public.prescription_sets ps where ps.exercise_prescription_id=public.t18_ep(%L,1) and ps.sequence=1),'rirMin',3,'rirMax',3,'rationale','r','evidence','[]'::jsonb))),
  jsonb_build_object('proposalOrigin','proactive','autonomyModeAtCreation','proactive','analysisRequestId','96000000-0000-4000-8000-000000000001','governancePolicyVersion','coach-governance-v1','reviewClass','standard_review','governanceReasons',jsonb_build_array('planned_rir_increase'),'autoDraft',jsonb_build_object('policyVersion','coach-auto-draft-v1','eligibility','eligible','reasons',jsonb_build_array('planned_rir_increase'))))$$,
  '93000000-0000-4000-8000-000000000003'::uuid,'93000000-0000-4000-8000-000000000003'::uuid,'93000000-0000-4000-8000-000000000003'::uuid,'93000000-0000-4000-8000-000000000003'::uuid),'eligible proactive decision');
select is(public.auto_draft_coach_decision('91111111-1111-4111-8111-111111111111','94000000-0000-4000-8000-000000000002')->>'status','materialized','auto-draft created');
select is((select array_agg(lineage order by sequence) from public.t18_prescriptions((select materialized_program_id from public.coach_decisions where id='94000000-0000-4000-8000-000000000002'))),(select array_agg(lineage order by sequence) from t18_c),'auto-draft preserves prescription lineage');
select is((select string_agg(sets::text,'|' order by sequence) from public.t18_prescriptions((select materialized_program_id from public.coach_decisions where id='94000000-0000-4000-8000-000000000002'))),(select string_agg(sets::text,'|' order by sequence) from t18_c),'auto-draft preserves set lineage');
reset role;

-- LEGACY: rows existing before the migration are roots; their programs are not tracked.
select is((select count(*) from public.training_programs where lineage_tracked=false and created_at > now() - interval '1 minute'),0::bigint,'no program created now is legacy');

select * from finish(); rollback;
