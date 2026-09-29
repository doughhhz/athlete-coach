begin; create extension if not exists pgtap with schema extensions; select no_plan();
-- ADR-0104: training structure mutation is aggregate-RPC only.
insert into auth.users(id,email) values
  ('f1111111-1111-4111-8111-111111111111','struct-a@example.invalid'),
  ('f2222222-2222-4222-8222-222222222222','struct-b@example.invalid');
insert into public.athletes(id,user_id) values
  ('ffffffff-1111-4fff-8fff-ffffffffffff','f1111111-1111-4111-8111-111111111111'),
  ('ffffffff-2222-4fff-8fff-ffffffffffff','f2222222-2222-4222-8222-222222222222');
create function public.tsmb_day(p_seq int,p_name text) returns jsonb language sql as $$
  select jsonb_build_object('sequence',p_seq,'name',p_name,'prescriptions',jsonb_build_array(jsonb_build_object('sequence',1,'exerciseId','50000000-0000-4000-8000-000000000001','sets',jsonb_build_array(jsonb_build_object('sequence',1,'targetMetric','reps','targetMin',8,'targetMax',10,'rirMin',2,'rirMax',3,'restMinSeconds',90,'restMaxSeconds',150,'tempo',null,'loadKind','athlete_selected','loadKg',null))))) $$;
create function public.tsmb_tree() returns jsonb language sql as $$
  select jsonb_build_object('blocks',jsonb_build_array(jsonb_build_object('sequence',1,'name','A','weeks',jsonb_build_array(jsonb_build_object('sequence',1,'days',jsonb_build_array(public.tsmb_day(1,'D1'),public.tsmb_day(2,'D2'))))))) $$;
-- Rebuilds the payload of a stored draft with its lineage (as the builder does).
create function public.tsmb_payload(p_program uuid, p_rir int default 2) returns jsonb language sql as $$
  select jsonb_build_object('blocks',(select jsonb_agg(jsonb_build_object('lineageId',b.lineage_id,'sequence',b.sequence,'name',b.name,'weeks',
    (select jsonb_agg(jsonb_build_object('lineageId',w.lineage_id,'sequence',w.sequence,'days',
      (select jsonb_agg(jsonb_build_object('lineageId',d.lineage_id,'sequence',d.sequence,'name',d.name,'prescriptions',
        (select jsonb_agg(jsonb_build_object('lineageId',ep.lineage_id,'sequence',ep.sequence,'exerciseId',ep.exercise_id,'sets',
          (select jsonb_agg(jsonb_build_object('lineageId',ps.lineage_id,'sequence',ps.sequence,'targetMetric',ps.target_metric,'targetMin',ps.target_min,'targetMax',ps.target_max,'rirMin',p_rir,'rirMax',p_rir,'restMinSeconds',ps.rest_min_seconds,'restMaxSeconds',ps.rest_max_seconds,'tempo',ps.tempo,'loadKind',ps.load_kind,'loadKg',ps.load_kg) order by ps.sequence) from public.prescription_sets ps where ps.exercise_prescription_id=ep.id)) order by ep.sequence)
          from public.exercise_prescriptions ep where ep.training_day_id=d.id)) order by d.sequence)
        from public.training_days d where d.training_week_id=w.id)) order by w.sequence)
      from public.training_weeks w where w.training_block_id=b.id)) order by b.sequence)
    from public.training_blocks b where b.training_program_id=p_program)) $$;
create function public.tsmb_counts() returns text language sql as $$
  select (select count(*) from public.training_blocks)||'/'||(select count(*) from public.training_weeks)||'/'||(select count(*) from public.training_days)||'/'||(select count(*) from public.exercise_prescriptions)||'/'||(select count(*) from public.prescription_sets) $$;
create function public.tsmb_rirs(p_program uuid) returns text language sql as $$
  select string_agg(ps.rir_min::text,',' order by d.sequence) from public.prescription_sets ps join public.exercise_prescriptions ep on ep.id=ps.exercise_prescription_id join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program $$;
grant execute on function public.tsmb_day(int,text), public.tsmb_tree(), public.tsmb_payload(uuid,int), public.tsmb_counts(), public.tsmb_rirs(uuid) to authenticated;

-- Privileges and policies: structure tables are client read-only.
create temp table tsmb_tables(name text); insert into tsmb_tables values ('public.training_blocks'),('public.training_weeks'),('public.training_days'),('public.exercise_prescriptions'),('public.prescription_sets');
grant select on tsmb_tables to authenticated;
select ok((select bool_and(has_table_privilege('authenticated',name,'select')) from tsmb_tables),'authenticated keeps SELECT on every structure table');
select ok((select bool_and(not has_table_privilege('authenticated',name,'insert')) from tsmb_tables),'authenticated has no INSERT on any structure table');
select ok((select bool_and(not has_table_privilege('authenticated',name,'update')) from tsmb_tables),'authenticated has no UPDATE on any structure table');
select ok((select bool_and(not has_table_privilege('authenticated',name,'delete')) from tsmb_tables),'authenticated has no DELETE on any structure table');
select ok((select bool_and(not has_table_privilege('anon',name,'insert') and not has_table_privilege('anon',name,'update') and not has_table_privilege('anon',name,'delete')) from tsmb_tables),'anon has no DML on any structure table');
select ok((select bool_and(c.relrowsecurity) from tsmb_tables t join pg_class c on c.oid=t.name::regclass),'RLS stays enabled on every structure table');
select is((select count(*) from pg_policies where schemaname='public' and tablename in ('training_blocks','training_weeks','training_days','exercise_prescriptions','prescription_sets') and cmd<>'SELECT'),0::bigint,'no policy describes client structure writes');
select is((select count(*) from pg_policies where schemaname='public' and tablename in ('training_blocks','training_weeks','training_days','exercise_prescriptions','prescription_sets') and cmd='SELECT'),5::bigint,'one ownership SELECT policy per structure table');
select ok((select prosecdef and proconfig @> array['search_path=""'] and not ('p_athlete_id'=any(coalesce(proargnames,'{}'))) from pg_proc where oid='public.replace_training_program_structure(uuid,jsonb)'::regprocedure),'full-tree save is SECURITY DEFINER, empty search_path, no athlete argument');
select ok(not has_function_privilege('anon','public.replace_training_program_structure(uuid,jsonb)','execute') and has_function_privilege('authenticated','public.replace_training_program_structure(uuid,jsonb)','execute'),'full-tree save: authenticated only');
select ok((select bool_and(prosecdef) from pg_proc where oid in ('public.create_training_program_with_structure(uuid,text,jsonb,text,uuid)'::regprocedure,'public.clone_training_program_as_draft(uuid)'::regprocedure,'public.materialize_coach_decision(uuid,uuid)'::regprocedure,'public.auto_draft_coach_decision(uuid,uuid)'::regprocedure)),'creation, clone, Coach materialization and auto-draft remain definer paths (behaviour covered by their suites)');

-- Athlete B owns a draft (for cross-athlete checks).
select set_config('request.jwt.claim.sub','f2222222-2222-4222-8222-222222222222',true);
set local role authenticated;
create temp table tsmb_b as select public.create_training_program_with_structure('f5000000-0000-4000-8000-000000000002','B',public.tsmb_tree()) id;
reset role;

select set_config('request.jwt.claim.sub','f1111111-1111-4111-8111-111111111111',true);
set local role authenticated;
create temp table tsmb_a as select public.create_training_program_with_structure('f5000000-0000-4000-8000-000000000001','A',public.tsmb_tree()) id;
select is(public.tsmb_counts(),'1/1/2/2/2','atomic creation works and the owner reads its whole structure');
-- Direct DML at every level: denied, even on the owner's own draft.
select throws_ok($$insert into public.training_blocks(training_program_id,sequence,name) values((select id from tsmb_a),2,'Bloco sem semana')$$,'42501',null,'direct block INSERT denied');
select throws_ok($$insert into public.training_weeks(training_block_id,sequence) select id,2 from public.training_blocks$$,'42501',null,'direct week INSERT denied');
select throws_ok($$insert into public.training_days(training_week_id,sequence,name) select id,3,'D3' from public.training_weeks$$,'42501',null,'direct day INSERT denied');
select throws_ok($$insert into public.exercise_prescriptions(training_day_id,exercise_id,sequence) select id,'50000000-0000-4000-8000-000000000001',2 from public.training_days$$,'42501',null,'direct prescription INSERT denied');
select throws_ok($$insert into public.prescription_sets(exercise_prescription_id,sequence,target_metric,target_min,target_max,load_kind) select id,2,'reps',8,10,'unprescribed' from public.exercise_prescriptions$$,'42501',null,'direct set INSERT denied');
select throws_ok($$update public.training_blocks set name='X'$$,'42501',null,'direct block UPDATE denied');
select throws_ok($$update public.training_weeks set name='X'$$,'42501',null,'direct week UPDATE denied');
select throws_ok($$update public.training_days set name='X'$$,'42501',null,'direct day UPDATE denied');
select throws_ok($$update public.exercise_prescriptions set instructions='X'$$,'42501',null,'direct prescription UPDATE denied');
select throws_ok($$update public.prescription_sets set rir_min=0,rir_max=0$$,'42501',null,'direct set UPDATE denied');
select throws_ok($$delete from public.training_blocks$$,'42501',null,'direct block DELETE denied');
select throws_ok($$delete from public.training_weeks$$,'42501',null,'direct week DELETE denied');
select throws_ok($$delete from public.training_days$$,'42501',null,'direct day DELETE denied');
select throws_ok($$delete from public.exercise_prescriptions$$,'42501',null,'direct prescription DELETE denied');
select throws_ok($$delete from public.prescription_sets$$,'42501',null,'direct set DELETE denied');
select is(public.tsmb_counts(),'1/1/2/2/2','structure unchanged after denied mutations');
-- The aggregate boundary still works for the owner.
select lives_ok($$select public.replace_training_program_structure((select id from tsmb_a),public.tsmb_payload((select id from tsmb_a),4))$$,'full-tree save succeeds');
select is(public.tsmb_rirs((select id from tsmb_a)),'4,4','full-tree edit persisted');
create temp table tsmb_lineage as select lineage_id from public.training_days d where d.name='D1';
select throws_ok($$select public.replace_training_program_structure((select id from tsmb_a),jsonb_set(public.tsmb_payload((select id from tsmb_a)),'{blocks,0,weeks,0,days,1,prescriptions}','[]'::jsonb))$$,'22023','Incomplete program structure','invalid full tree rejected');
select is(public.tsmb_rirs((select id from tsmb_a)),'4,4','invalid save rolled back (atomic)');
-- Lineage validation unchanged under the definer boundary.
select throws_ok($$select public.replace_training_program_structure((select id from tsmb_a),jsonb_set(public.tsmb_payload((select id from tsmb_a)),'{blocks,0,weeks,0,days,1,lineageId}',to_jsonb(gen_random_uuid()::text)))$$,'22023','Unknown structure lineage','unknown lineage rejected');
select throws_ok($$select public.replace_training_program_structure((select id from tsmb_a),jsonb_set(public.tsmb_payload((select id from tsmb_a)),'{blocks,0,weeks,0,days,1,lineageId}',to_jsonb((select lineage_id from tsmb_lineage)::text)))$$,'22023','Duplicate structure lineage','duplicate lineage rejected');
select throws_ok($$select public.replace_training_program_structure((select id from tsmb_a),jsonb_set(public.tsmb_payload((select id from tsmb_a)),'{blocks,0,lineageId}',to_jsonb((select lineage_id from tsmb_lineage)::text)))$$,'22023','Unknown structure lineage','wrong-level lineage rejected');
reset role;
create temp table tsmb_b_lineage as select d.lineage_id from public.training_days d join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=(select id from tsmb_b) and d.name='D2';
grant select on tsmb_a, tsmb_b, tsmb_b_lineage, tsmb_lineage to authenticated;
set local role authenticated;
select throws_ok($$select public.replace_training_program_structure((select id from tsmb_a),jsonb_set(public.tsmb_payload((select id from tsmb_a)),'{blocks,0,weeks,0,days,1,lineageId}',to_jsonb((select lineage_id from tsmb_b_lineage)::text)))$$,'22023','Unknown structure lineage','cross-athlete lineage rejected');
select is(public.tsmb_rirs((select id from tsmb_a)),'4,4','rejected lineage saves change nothing');
-- The definer boundary still refuses non-owned or non-draft programs.
select throws_ok($$select public.replace_training_program_structure((select id from tsmb_b),public.tsmb_tree())$$,'P0002','Editable draft not found','another athlete''s draft cannot be saved');
select lives_ok($$select public.activate_training_program((select id from tsmb_a))$$,'owner activates explicitly');
select throws_ok($$select public.replace_training_program_structure((select id from tsmb_a),public.tsmb_tree())$$,'P0002','Editable draft not found','an active program cannot be rewritten');
-- Manual revision still works and preserves lineage.
create temp table tsmb_rev as select * from public.clone_training_program_as_draft((select id from tsmb_a));
select is((select count(*) from public.training_days d join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=(select id from tsmb_rev) and d.lineage_id=(select lineage_id from tsmb_lineage)),1::bigint,'revision clone works and preserves lineage');
select lives_ok($$select public.replace_training_program_structure((select id from tsmb_rev),public.tsmb_payload((select id from tsmb_rev),1))$$,'revision draft saved through the boundary');
reset role;

-- Cross-athlete reads stay blocked.
select set_config('request.jwt.claim.sub','f2222222-2222-4222-8222-222222222222',true);
set local role authenticated;
select is(public.tsmb_counts(),'1/1/2/2/2','B reads only its own structure (none of A''s)');
reset role;
set local role anon;
select throws_ok($$select count(*) from public.training_blocks$$,'42501',null,'anon cannot read structure');
reset role;

select * from finish(); rollback;
