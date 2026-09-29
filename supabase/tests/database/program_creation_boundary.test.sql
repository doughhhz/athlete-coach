begin; create extension if not exists pgtap with schema extensions; select no_plan();
-- ADR-0103: TrainingProgram root creation is RPC-only.
insert into auth.users(id,email) values
  ('e1111111-1111-4111-8111-111111111111','boundary-a@example.invalid'),
  ('e2222222-2222-4222-8222-222222222222','boundary-b@example.invalid');
insert into public.athletes(id,user_id) values
  ('eeeeeeee-1111-4eee-8eee-eeeeeeeeeeee','e1111111-1111-4111-8111-111111111111'),
  ('eeeeeeee-2222-4eee-8eee-eeeeeeeeeeee','e2222222-2222-4222-8222-222222222222');
insert into public.athlete_goals(id,athlete_id,goal_type) values('e4000000-0000-4000-8000-000000000001','eeeeeeee-2222-4eee-8eee-eeeeeeeeeeee','strength');
create function public.tpcb_tree(p_sets jsonb default null) returns jsonb language sql as $$
  select jsonb_build_object('blocks',jsonb_build_array(jsonb_build_object('sequence',1,'name','A','weeks',jsonb_build_array(jsonb_build_object('sequence',1,'days',jsonb_build_array(
    jsonb_build_object('sequence',1,'name','D1','prescriptions',jsonb_build_array(jsonb_build_object('sequence',1,'exerciseId','50000000-0000-4000-8000-000000000001','sets',coalesce(p_sets,jsonb_build_array(jsonb_build_object('sequence',1,'targetMetric','reps','targetMin',8,'targetMax',10,'rirMin',2,'rirMax',3,'restMinSeconds',90,'restMaxSeconds',150,'tempo',null,'loadKind','athlete_selected','loadKg',null)))))))))))) $$;
grant execute on function public.tpcb_tree(jsonb) to authenticated;

-- Privileges and policies: no client holds program-row INSERT authority.
select ok(not has_table_privilege('authenticated','public.training_programs','insert'),'authenticated has no INSERT privilege on training_programs');
select ok(not has_table_privilege('anon','public.training_programs','insert'),'anon has no INSERT privilege on training_programs');
select ok(has_table_privilege('authenticated','public.training_programs','select') and has_table_privilege('authenticated','public.training_programs','update') and has_table_privilege('authenticated','public.training_programs','delete'),'unrelated privileges unchanged');
select is((select count(*) from pg_policies where schemaname='public' and tablename='training_programs' and cmd in ('INSERT','ALL')),0::bigint,'no RLS policy describes client program inserts');
select ok((select relrowsecurity from pg_class where oid='public.training_programs'::regclass),'RLS stays enabled');
-- Controlled creators: definer, locked search_path, no athlete argument.
select ok((select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc where oid in ('public.create_training_program_with_structure(uuid,text,jsonb,text,uuid)'::regprocedure,'public.clone_training_program_as_draft(uuid)'::regprocedure)),'root and revision creators are SECURITY DEFINER with an empty search_path');
select ok(not exists(select 1 from pg_proc where oid='public.create_training_program_with_structure(uuid,text,jsonb,text,uuid)'::regprocedure and 'p_athlete_id'=any(proargnames)),'root creation accepts no athlete id');
select ok(not has_function_privilege('anon','public.create_training_program_with_structure(uuid,text,jsonb,text,uuid)','execute') and not has_function_privilege('anon','public.clone_training_program_as_draft(uuid)','execute'),'anon cannot execute the creators');
select ok(not has_function_privilege('authenticated','public.materialize_coach_decision(uuid,uuid)','execute') and not has_function_privilege('authenticated','public.auto_draft_coach_decision(uuid,uuid)','execute')
  and (select bool_and(prosecdef) from pg_proc where oid in ('public.materialize_coach_decision(uuid,uuid)'::regprocedure,'public.auto_draft_coach_decision(uuid,uuid)'::regprocedure)),'Coach materialization and auto-draft remain backend-only definer paths (behaviour covered by coach_* suites)');

select set_config('request.jwt.claim.sub','e1111111-1111-4111-8111-111111111111',true);
set local role authenticated;
-- Direct table authority: denied, no row.
select throws_ok($$insert into public.training_programs(athlete_id,name) values(public.current_athlete_id(),'Raiz vazia')$$,'42501','permission denied for table training_programs','direct authenticated root insert denied');
select is((select count(*) from public.training_programs),0::bigint,'no program row after the denied insert');
-- The atomic RPC still creates (definer): one complete draft owned by the session athlete.
create temp table tpcb_root as select public.create_training_program_with_structure('f0000000-0000-4000-8000-000000000001','Raiz atômica',public.tpcb_tree()) id;
select ok((select status='draft' and athlete_id='eeeeeeee-1111-4eee-8eee-eeeeeeeeeeee' and supersedes_program_id is null from public.training_programs where id=(select id from tpcb_root)),'atomic RPC creates the caller''s draft root');
select is((select count(*) from public.prescription_sets ps join public.exercise_prescriptions ep on ep.id=ps.exercise_prescription_id join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=(select id from tpcb_root)),1::bigint,'complete hierarchy written through the definer path');
select is(public.create_training_program_with_structure('f0000000-0000-4000-8000-000000000001','Raiz atômica',public.tpcb_tree()),(select id from tpcb_root),'retry still idempotent');
select throws_ok($$select public.create_training_program_with_structure('f0000000-0000-4000-8000-000000000002','Malformada',public.tpcb_tree('[]'::jsonb))$$,'22023','Incomplete program structure','malformed creation rejected');
select is((select count(*) from public.training_programs),1::bigint,'malformed creation rolled back; still one program');
-- Another athlete's goal cannot be attached through the RPC.
select throws_ok($$select public.create_training_program_with_structure('f0000000-0000-4000-8000-000000000003','Meta alheia',public.tpcb_tree(),null,'e4000000-0000-4000-8000-000000000001')$$,'23503',null,'cross-athlete goal rejected by the definer RPC');
-- Revision creation (a different authority) still works for the owner.
select lives_ok($$select public.activate_training_program((select id from tpcb_root))$$,'owner activates explicitly');
create temp table tpcb_revision as select * from public.clone_training_program_as_draft((select id from tpcb_root));
select ok((select status='draft' and revision=2 and supersedes_program_id=(select id from tpcb_root) and creation_request_id is null from tpcb_revision),'revision created as a draft superseding its source, without root identity');
select is((select count(*) from public.training_days d join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=(select id from tpcb_revision) and d.lineage_id in (select d2.lineage_id from public.training_days d2 join public.training_weeks w2 on w2.id=d2.training_week_id join public.training_blocks b2 on b2.id=w2.training_block_id where b2.training_program_id=(select id from tpcb_root))),1::bigint,'revision preserves lineage');
reset role;

-- Cross-athlete: B cannot revise A's program; B's RPC creates B-owned rows only.
select set_config('request.jwt.claim.sub','e2222222-2222-4222-8222-222222222222',true);
set local role authenticated;
select throws_ok($$select public.clone_training_program_as_draft((select id from tpcb_root))$$,'P0002',null,'another athlete cannot revise through the definer clone');
select is((select count(*) from public.training_programs),0::bigint,'B sees none of A''s programs');
create temp table tpcb_b as select public.create_training_program_with_structure('f0000000-0000-4000-8000-000000000001','Raiz de B',public.tpcb_tree()) id;
select is((select athlete_id from public.training_programs where id=(select id from tpcb_b)),'eeeeeeee-2222-4eee-8eee-eeeeeeeeeeee'::uuid,'same request id resolves inside B''s scope only');
reset role;

-- Anonymous callers: no table or RPC authority.
set local role anon;
select throws_ok($$insert into public.training_programs(athlete_id,name) values('eeeeeeee-1111-4eee-8eee-eeeeeeeeeeee','Anon')$$,'42501',null,'anon direct insert denied');
select throws_ok($$select public.create_training_program_with_structure('f0000000-0000-4000-8000-000000000009','Anon','{}'::jsonb)$$,'42501',null,'anon cannot call the creation RPC');
reset role;
select is((select count(*) from public.training_programs where athlete_id='eeeeeeee-1111-4eee-8eee-eeeeeeeeeeee'),2::bigint,'A owns exactly the root and its revision');

select * from finish(); rollback;
