begin; create extension if not exists pgtap with schema extensions; select no_plan();
-- Test-only privileged seeding (ADR-0103): clients can no longer insert program
-- rows; fixtures that only need an existing root bypass the product flow on
-- purpose here. Rolled back with the test transaction; never in production.
create function public.test_seed_program_root(p_id uuid, p_name text, p_athlete uuid default null, p_goal uuid default null) returns void language sql security definer set search_path='' as $seed$
  insert into public.training_programs(id,athlete_id,athlete_goal_id,name) values(p_id,coalesce(p_athlete,public.current_athlete_id()),p_goal,p_name) $seed$;
grant execute on function public.test_seed_program_root(uuid,text,uuid,uuid) to authenticated;
-- Implementation Phase 19 (ADR-0097/0098): explicit structural removal through
-- whole-tree saves; removed lineage is never recycled.
insert into auth.users(id,email) values('b1111111-1111-4111-8111-111111111111','edit-a@example.invalid');
insert into public.athletes(id,user_id) values('bbbbbbbb-1111-4bbb-8bbb-bbbbbbbbbbbb','b1111111-1111-4111-8111-111111111111');
create function public.tse_day(p_seq int,p_name text,p_lineage uuid default null) returns jsonb language sql as $$
  select jsonb_strip_nulls(jsonb_build_object('lineageId',p_lineage,'sequence',p_seq,'name',p_name,'prescriptions',jsonb_build_array(jsonb_build_object('sequence',1,'exerciseId','50000000-0000-4000-8000-000000000001','sets',jsonb_build_array(jsonb_build_object('sequence',1,'targetMetric','reps','targetMin',8,'targetMax',10,'rirMin',null,'rirMax',null,'restMinSeconds',null,'restMaxSeconds',null,'tempo',null,'loadKind','athlete_selected','loadKg',null)))))) $$;
create function public.tse_lineage(p_program uuid,p_day text) returns uuid language sql as $$
  select d.lineage_id from public.training_days d join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program and d.name=p_day $$;
grant execute on function public.tse_day(int,text,uuid), public.tse_lineage(uuid,text) to authenticated;

select set_config('request.jwt.claim.sub','b1111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select public.test_seed_program_root('b3000000-0000-4000-8000-000000000001','Edit','bbbbbbbb-1111-4bbb-8bbb-bbbbbbbbbbbb');
select lives_ok($$select public.replace_training_program_structure('b3000000-0000-4000-8000-000000000001',jsonb_build_object('blocks',jsonb_build_array(jsonb_build_object('sequence',1,'name','A','weeks',jsonb_build_array(jsonb_build_object('sequence',1,'days',jsonb_build_array(public.tse_day(1,'D1'),public.tse_day(2,'D2')))))))) $$,'two-day draft saved');
create temp table tse_ids as select public.tse_lineage('b3000000-0000-4000-8000-000000000001','D1') d1, public.tse_lineage('b3000000-0000-4000-8000-000000000001','D2') d2;
select isnt((select d2 from tse_ids),null,'D2 has server lineage');

-- Explicit removal of D2: the whole tree is sent without it.
select lives_ok($$select public.replace_training_program_structure('b3000000-0000-4000-8000-000000000001',jsonb_build_object('blocks',jsonb_build_array(jsonb_build_object('sequence',1,'name','A','weeks',jsonb_build_array(jsonb_build_object('sequence',1,'days',jsonb_build_array(public.tse_day(1,'D1',(select d1 from tse_ids)))))))))$$,'save without D2');
select is(public.tse_lineage('b3000000-0000-4000-8000-000000000001','D1'),(select d1 from tse_ids),'D1 keeps lineage');
select is(public.tse_lineage('b3000000-0000-4000-8000-000000000001','D2'),null::uuid,'D2 removed');

-- The removed lineage cannot be re-attached to a new day.
select throws_ok($$select public.replace_training_program_structure('b3000000-0000-4000-8000-000000000001',jsonb_build_object('blocks',jsonb_build_array(jsonb_build_object('sequence',1,'name','A','weeks',jsonb_build_array(jsonb_build_object('sequence',1,'days',jsonb_build_array(public.tse_day(1,'D1',(select d1 from tse_ids)),public.tse_day(2,'D3',(select d2 from tse_ids))))))))) $$,'22023','Unknown structure lineage','removed lineage is not recycled');

-- A new day added after the removal receives a fresh lineage.
select lives_ok($$select public.replace_training_program_structure('b3000000-0000-4000-8000-000000000001',jsonb_build_object('blocks',jsonb_build_array(jsonb_build_object('sequence',1,'name','A','weeks',jsonb_build_array(jsonb_build_object('sequence',1,'days',jsonb_build_array(public.tse_day(1,'D1',(select d1 from tse_ids)),public.tse_day(2,'D3'))))))))$$,'new day without lineage saved');
select ok(public.tse_lineage('b3000000-0000-4000-8000-000000000001','D3') not in ((select d1 from tse_ids),(select d2 from tse_ids)),'new day lineage is fresh');

-- Reorder through the save keeps lineage and changes sequence only.
select lives_ok($$select public.replace_training_program_structure('b3000000-0000-4000-8000-000000000001',jsonb_build_object('blocks',jsonb_build_array(jsonb_build_object('sequence',1,'name','A','weeks',jsonb_build_array(jsonb_build_object('sequence',1,'days',jsonb_build_array(public.tse_day(1,'D3',public.tse_lineage('b3000000-0000-4000-8000-000000000001','D3')),public.tse_day(2,'D1',(select d1 from tse_ids)))))))))$$,'reordered days saved');
select is((select d.sequence from public.training_days d where d.lineage_id=(select d1 from tse_ids)),2,'D1 moved to sequence 2 with the same lineage');
reset role;

select * from finish(); rollback;
