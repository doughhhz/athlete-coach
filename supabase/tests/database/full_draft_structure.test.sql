begin; create extension if not exists pgtap with schema extensions; select no_plan();
-- Test-only privileged seeding (ADR-0103): clients can no longer insert program
-- rows; fixtures that only need an existing root bypass the product flow on
-- purpose here. Rolled back with the test transaction; never in production.
create function public.test_seed_program_root(p_id uuid, p_name text, p_athlete uuid default null, p_goal uuid default null) returns void language sql security definer set search_path='' as $seed$
  insert into public.training_programs(id,athlete_id,athlete_goal_id,name) values(p_id,coalesce(p_athlete,public.current_athlete_id()),p_goal,p_name) $seed$;
grant execute on function public.test_seed_program_root(uuid,text,uuid,uuid) to authenticated;
-- Corrective pass after Implementation Phase 18 (ADR-0095/0096): whole-tree saves.
insert into auth.users(id,email) values('a1111111-1111-4111-8111-111111111111','full-a@example.invalid');
insert into public.athletes(id,user_id) values('aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa','a1111111-1111-4111-8111-111111111111');

create function public.tfs_set(p_rir int default 2) returns jsonb language sql as $$
  select jsonb_build_object('sequence',1,'targetMetric','reps','targetMin',8,'targetMax',10,'rirMin',p_rir,'rirMax',p_rir+1,'restMinSeconds',90,'restMaxSeconds',150,'tempo',null,'loadKind','athlete_selected','loadKg',null) $$;
create function public.tfs_day(p_seq int,p_name text,p_exercise text default '50000000-0000-4000-8000-000000000001') returns jsonb language sql as $$
  select jsonb_build_object('sequence',p_seq,'name',p_name,'notes','n-'||p_name,'prescriptions',jsonb_build_array(jsonb_build_object('sequence',1,'exerciseId',p_exercise,'instructions','i-'||p_name,'sets',jsonb_build_array(public.tfs_set())))) $$;
-- Block A (W1: D1, D2; W2: D3), Block B (W1: D4).
create function public.tfs_tree() returns jsonb language sql as $$
  select jsonb_build_object('blocks',jsonb_build_array(
    jsonb_build_object('sequence',1,'name','A','weeks',jsonb_build_array(
      jsonb_build_object('sequence',1,'days',jsonb_build_array(public.tfs_day(1,'D1'),public.tfs_day(2,'D2'))),
      jsonb_build_object('sequence',2,'days',jsonb_build_array(public.tfs_day(1,'D3'))))),
    jsonb_build_object('sequence',2,'name','B','weeks',jsonb_build_array(
      jsonb_build_object('sequence',1,'days',jsonb_build_array(public.tfs_day(1,'D4'))))))) $$;
-- Snapshot of every node: level, name/sequence path, lineage and content.
create function public.tfs_snapshot(p_program uuid) returns table(path text, lineage uuid, content text) language sql as $$
  select 'block:'||b.name, b.lineage_id, b.name from public.training_blocks b where b.training_program_id=p_program
  union all select 'week:'||b.name||'/'||w.sequence, w.lineage_id, coalesce(w.notes,'') from public.training_weeks w join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program
  union all select 'day:'||d.name, d.lineage_id, coalesce(d.notes,'') from public.training_days d join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program
  union all select 'prescription:'||d.name||'/'||ep.sequence, ep.lineage_id, ep.exercise_id::text||'|'||coalesce(ep.instructions,'') from public.exercise_prescriptions ep join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program
  union all select 'set:'||d.name||'/'||ep.sequence||'/'||ps.sequence, ps.lineage_id, ps.rir_min||'-'||ps.rir_max||'|'||ps.rest_min_seconds||'-'||ps.rest_max_seconds from public.prescription_sets ps join public.exercise_prescriptions ep on ep.id=ps.exercise_prescription_id join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program $$;
-- Rebuilds the payload from the stored tree (all nodes, with lineage), editing one day's first set RIR.
create function public.tfs_payload(p_program uuid, p_edit_day text default null, p_rir int default 5) returns jsonb language sql as $$
  select jsonb_build_object('blocks',(select jsonb_agg(jsonb_build_object('lineageId',b.lineage_id,'sequence',b.sequence,'name',b.name,'weeks',
    (select jsonb_agg(jsonb_build_object('lineageId',w.lineage_id,'sequence',w.sequence,'notes',w.notes,'days',
      (select jsonb_agg(jsonb_build_object('lineageId',d.lineage_id,'sequence',d.sequence,'name',d.name,'notes',d.notes,'prescriptions',
        (select jsonb_agg(jsonb_build_object('lineageId',ep.lineage_id,'sequence',ep.sequence,'exerciseId',ep.exercise_id,'instructions',ep.instructions,'sets',
          (select jsonb_agg(jsonb_build_object('lineageId',ps.lineage_id,'sequence',ps.sequence,'targetMetric',ps.target_metric,'targetMin',ps.target_min,'targetMax',ps.target_max,
            'rirMin',case when d.name=p_edit_day and ps.sequence=1 then p_rir else ps.rir_min end,'rirMax',case when d.name=p_edit_day and ps.sequence=1 then p_rir else ps.rir_max end,
            'restMinSeconds',ps.rest_min_seconds,'restMaxSeconds',ps.rest_max_seconds,'tempo',ps.tempo,'loadKind',ps.load_kind,'loadKg',ps.load_kg) order by ps.sequence) from public.prescription_sets ps where ps.exercise_prescription_id=ep.id)) order by ep.sequence)
          from public.exercise_prescriptions ep where ep.training_day_id=d.id)) order by d.sequence)
        from public.training_days d where d.training_week_id=w.id)) order by w.sequence)
      from public.training_weeks w where w.training_block_id=b.id)) order by b.sequence)
    from public.training_blocks b where b.training_program_id=p_program)) $$;
grant execute on function public.tfs_set(int), public.tfs_day(int,text,text), public.tfs_tree(), public.tfs_snapshot(uuid), public.tfs_payload(uuid,text,int) to authenticated;

select set_config('request.jwt.claim.sub','a1111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select public.test_seed_program_root('a3000000-0000-4000-8000-000000000001','Full','aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa');
select lives_ok($$select public.replace_training_program_structure('a3000000-0000-4000-8000-000000000001',public.tfs_tree())$$,'multi-block/week/day draft saved');
select is((select count(*) from public.tfs_snapshot('a3000000-0000-4000-8000-000000000001') where path like 'day:%'),4::bigint,'4 days across 2 blocks and 3 weeks');
create temp table tfs_before as select * from public.tfs_snapshot('a3000000-0000-4000-8000-000000000001');

-- Edit only D1: every other node keeps lineage and content.
select lives_ok($$select public.replace_training_program_structure('a3000000-0000-4000-8000-000000000001',public.tfs_payload('a3000000-0000-4000-8000-000000000001','D1',5))$$,'whole-tree save with one edited day');
select is((select count(*) from public.tfs_snapshot('a3000000-0000-4000-8000-000000000001')),(select count(*) from tfs_before),'no node lost');
select set_eq($$select path, lineage from public.tfs_snapshot('a3000000-0000-4000-8000-000000000001')$$,$$select path, lineage from tfs_before$$,'every node keeps its lineage');
select set_eq($$select path, content from public.tfs_snapshot('a3000000-0000-4000-8000-000000000001') where path <> 'set:D1/1/1'$$,$$select path, content from tfs_before where path <> 'set:D1/1/1'$$,'untouched content identical (notes, instructions, ranges)');
select is((select content from public.tfs_snapshot('a3000000-0000-4000-8000-000000000001') where path='set:D1/1/1'),'5-5|90-150','edited set changed only in RIR');

-- Two days edited in sequence both persist.
select lives_ok($$select public.replace_training_program_structure('a3000000-0000-4000-8000-000000000001',public.tfs_payload('a3000000-0000-4000-8000-000000000001','D3',4))$$,'second save edits D3');
select is((select content from public.tfs_snapshot('a3000000-0000-4000-8000-000000000001') where path='set:D1/1/1'),'5-5|90-150','D1 edit still present');
select is((select content from public.tfs_snapshot('a3000000-0000-4000-8000-000000000001') where path='set:D3/1/1'),'4-4|90-150','D3 edit present');
select is((select content from public.tfs_snapshot('a3000000-0000-4000-8000-000000000001') where path='set:D2/1/1'),'2-3|90-150','D2 untouched');

-- Atomic rejection of incomplete trees: nothing changes.
create temp table tfs_stable as select * from public.tfs_snapshot('a3000000-0000-4000-8000-000000000001');
select throws_ok($$select public.replace_training_program_structure('a3000000-0000-4000-8000-000000000001',jsonb_set(public.tfs_payload('a3000000-0000-4000-8000-000000000001'),'{blocks,1,weeks}','[]'::jsonb))$$,'22023','Incomplete program structure','block without weeks rejected');
select throws_ok($$select public.replace_training_program_structure('a3000000-0000-4000-8000-000000000001',jsonb_set(public.tfs_payload('a3000000-0000-4000-8000-000000000001'),'{blocks,0,weeks,0,days}','[]'::jsonb))$$,'22023','Incomplete program structure','week without days rejected');
select throws_ok($$select public.replace_training_program_structure('a3000000-0000-4000-8000-000000000001',jsonb_set(public.tfs_payload('a3000000-0000-4000-8000-000000000001'),'{blocks,0,weeks,0,days,1,prescriptions}','[]'::jsonb))$$,'22023','Incomplete program structure','day without exercises rejected');
select throws_ok($$select public.replace_training_program_structure('a3000000-0000-4000-8000-000000000001',jsonb_set(public.tfs_payload('a3000000-0000-4000-8000-000000000001'),'{blocks,0,weeks,0,days,0,prescriptions,0,sets}','[]'::jsonb))$$,'22023','Incomplete program structure','prescription without sets rejected');
select set_eq($$select path, lineage, content from public.tfs_snapshot('a3000000-0000-4000-8000-000000000001')$$,$$select path, lineage, content from tfs_stable$$,'rejected saves change nothing (atomic)');

-- Lineage security still enforced on whole-tree saves.
select throws_ok($$select public.replace_training_program_structure('a3000000-0000-4000-8000-000000000001',jsonb_set(public.tfs_payload('a3000000-0000-4000-8000-000000000001'),'{blocks,1,weeks,0,days,0,lineageId}',to_jsonb(gen_random_uuid()::text)))$$,'22023','Unknown structure lineage','unknown lineage rejected');
select throws_ok($$select public.replace_training_program_structure('a3000000-0000-4000-8000-000000000001',jsonb_set(public.tfs_payload('a3000000-0000-4000-8000-000000000001'),'{blocks,1,weeks,0,days,0,lineageId}',public.tfs_payload('a3000000-0000-4000-8000-000000000001')#>'{blocks,0,weeks,0,days,0,lineageId}'))$$,'22023','Duplicate structure lineage','duplicate day lineage rejected');
select set_eq($$select path, lineage, content from public.tfs_snapshot('a3000000-0000-4000-8000-000000000001')$$,$$select path, lineage, content from tfs_stable$$,'rejected lineage saves change nothing');
reset role;

select * from finish(); rollback;
