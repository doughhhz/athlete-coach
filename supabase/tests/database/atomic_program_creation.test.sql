begin; create extension if not exists pgtap with schema extensions; select no_plan();
-- Corrective pass after Implementation Phase 19 (ADR-0100..0102): atomic,
-- idempotent new-program creation.
insert into auth.users(id,email) values
  ('c1111111-1111-4111-8111-111111111111','create-a@example.invalid'),
  ('c2222222-2222-4222-8222-222222222222','create-b@example.invalid');
insert into public.athletes(id,user_id) values
  ('cccccccc-1111-4ccc-8ccc-cccccccccccc','c1111111-1111-4111-8111-111111111111'),
  ('cccccccc-2222-4ccc-8ccc-cccccccccccc','c2222222-2222-4222-8222-222222222222');
create function public.tapc_tree(p_rir int default 2, p_sets jsonb default null) returns jsonb language sql as $$
  select jsonb_build_object('blocks',jsonb_build_array(
    jsonb_build_object('sequence',1,'name','A','weeks',jsonb_build_array(
      jsonb_build_object('sequence',1,'days',jsonb_build_array(
        jsonb_build_object('sequence',1,'name','D1','prescriptions',jsonb_build_array(jsonb_build_object('sequence',1,'exerciseId','50000000-0000-4000-8000-000000000001','sets',coalesce(p_sets,jsonb_build_array(jsonb_build_object('sequence',1,'targetMetric','reps','targetMin',8,'targetMax',10,'rirMin',p_rir,'rirMax',p_rir+1,'restMinSeconds',90,'restMaxSeconds',150,'tempo',null,'loadKind','athlete_selected','loadKg',null)))))),
        jsonb_build_object('sequence',2,'name','D2','prescriptions',jsonb_build_array(jsonb_build_object('sequence',1,'exerciseId','50000000-0000-4000-8000-000000000001','sets',jsonb_build_array(jsonb_build_object('sequence',1,'targetMetric','reps','targetMin',5,'targetMax',5,'rirMin',null,'rirMax',null,'restMinSeconds',null,'restMaxSeconds',null,'tempo',null,'loadKind','unprescribed','loadKg',null))))))))),
    jsonb_build_object('sequence',2,'name','B','weeks',jsonb_build_array(
      jsonb_build_object('sequence',1,'days',jsonb_build_array(
        jsonb_build_object('sequence',1,'name','D3','prescriptions',jsonb_build_array(jsonb_build_object('sequence',1,'exerciseId','50000000-0000-4000-8000-000000000001','sets',jsonb_build_array(jsonb_build_object('sequence',1,'targetMetric','reps','targetMin',6,'targetMax',8,'rirMin',1,'rirMax',2,'restMinSeconds',120,'restMaxSeconds',180,'tempo',null,'loadKind','athlete_selected','loadKg',null))))))))))) $$;
create function public.tapc_count(p_request uuid) returns bigint language sql as $$
  select count(*) from public.training_programs where creation_request_id=p_request $$;
grant execute on function public.tapc_tree(int,jsonb), public.tapc_count(uuid) to authenticated;

select has_function('public','create_training_program_with_structure',array['uuid','text','jsonb','text','uuid'],'atomic creation RPC exists');
select ok(not has_function_privilege('anon','public.create_training_program_with_structure(uuid,text,jsonb,text,uuid)','execute'),'anon cannot call the creation RPC');
select ok(has_function_privilege('authenticated','public.create_training_program_with_structure(uuid,text,jsonb,text,uuid)','execute'),'authenticated can call the creation RPC');

select set_config('request.jwt.claim.sub','c1111111-1111-4111-8111-111111111111',true);
set local role authenticated;
-- Valid atomic creation.
create temp table tapc_first as select public.create_training_program_with_structure('d0000000-0000-4000-8000-000000000001','Treino A',public.tapc_tree()) id;
select is((select status from public.training_programs where id=(select id from tapc_first)),'draft','created as draft');
select is((select athlete_id from public.training_programs where id=(select id from tapc_first)),'cccccccc-1111-4ccc-8ccc-cccccccccccc'::uuid,'athlete derived from the session');
select ok((select supersedes_program_id is null and revision=1 and lineage_tracked and activated_at is null from public.training_programs where id=(select id from tapc_first)),'new root: no supersedes, revision 1, lineage tracked, never activated');
select is((select count(*) from public.training_days d join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=(select id from tapc_first)),3::bigint,'complete hierarchy: 3 days across 2 blocks');
select is((select count(*) from public.prescription_sets ps join public.exercise_prescriptions ep on ep.id=ps.exercise_prescription_id join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=(select id from tapc_first) and ps.rir_min=2 and ps.rest_max_seconds=150),1::bigint,'set values persisted');
select ok((select bool_and(d.lineage_id is not null) and count(distinct d.lineage_id)=count(*) from public.training_days d join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=(select id from tapc_first)),'fresh, distinct lineage for every day');
select matches((select creation_request_fingerprint from public.training_programs where id=(select id from tapc_first)),'^[0-9a-f]{64}$','fingerprint stored');

-- Same request, same payload (lost response): same program, no second row.
select is(public.create_training_program_with_structure('d0000000-0000-4000-8000-000000000001','Treino A',public.tapc_tree()),(select id from tapc_first),'retry returns the same draft');
select is(public.tapc_count('d0000000-0000-4000-8000-000000000001'),1::bigint,'exactly one program for the intent');
-- Key order and surrounding whitespace in the name are not semantic.
select is(public.create_training_program_with_structure('d0000000-0000-4000-8000-000000000001','  Treino A ',(select jsonb_object_agg(key,value) from jsonb_each(public.tapc_tree()))),(select id from tapc_first),'canonical payload resolves to the same draft');

-- Same request, different payload: explicit conflict, nothing modified.
create temp table tapc_before as select name, updated_at from public.training_programs where id=(select id from tapc_first);
select throws_ok($$select public.create_training_program_with_structure('d0000000-0000-4000-8000-000000000001','Treino B',public.tapc_tree())$$,'23505','program_creation_conflict','changed name conflicts');
select throws_ok($$select public.create_training_program_with_structure('d0000000-0000-4000-8000-000000000001','Treino A',public.tapc_tree(4))$$,'23505','program_creation_conflict','changed tree conflicts');
select is((select name from public.training_programs where id=(select id from tapc_first)),'Treino A','original draft unchanged');
select is(public.tapc_count('d0000000-0000-4000-8000-000000000001'),1::bigint,'still one program after conflicts');

-- Invalid structure: the whole creation rolls back (zero rows for the request).
select throws_ok($$select public.create_training_program_with_structure('d0000000-0000-4000-8000-000000000002','Inválido',public.tapc_tree(2,'[]'::jsonb))$$,'22023','Incomplete program structure','incomplete tree rejected');
select is(public.tapc_count('d0000000-0000-4000-8000-000000000002'),0::bigint,'no program row after a failed creation');
select throws_ok($$select public.create_training_program_with_structure('d0000000-0000-4000-8000-000000000003','Vazio','{"blocks":[]}'::jsonb)$$,'22023','At least one block is required','empty program rejected');
select is(public.tapc_count('d0000000-0000-4000-8000-000000000003'),0::bigint,'no program row after an empty creation');
-- The failed request id stays usable for the corrected tree (nothing was committed).
select isnt(public.create_training_program_with_structure('d0000000-0000-4000-8000-000000000002','Inválido',public.tapc_tree()),null,'corrected retry succeeds');
select is(public.tapc_count('d0000000-0000-4000-8000-000000000002'),1::bigint,'one program after the corrected retry');

-- Lineage injection rejected on creation (no continuity for a new root).
select throws_ok($$select public.create_training_program_with_structure('d0000000-0000-4000-8000-000000000004','L',jsonb_set(public.tapc_tree(),'{blocks,0,weeks,0,days,0,lineageId}',to_jsonb(gen_random_uuid()::text)))$$,'22023','Lineage is not accepted on program creation','day lineage rejected');
select throws_ok($$select public.create_training_program_with_structure('d0000000-0000-4000-8000-000000000004','L',jsonb_set(public.tapc_tree(),'{blocks,0,lineageId}',to_jsonb(gen_random_uuid()::text)))$$,'22023','Lineage is not accepted on program creation','block lineage rejected');
select is(public.tapc_count('d0000000-0000-4000-8000-000000000004'),0::bigint,'no program after lineage injection');

-- The client cannot forge creation identity through direct inserts, nor change it.
select throws_ok($$insert into public.training_programs(athlete_id,name,creation_request_id,creation_request_fingerprint) values('cccccccc-1111-4ccc-8ccc-cccccccccccc','X','d0000000-0000-4000-8000-000000000005',repeat('a',64))$$,'42501','permission denied for table training_programs','authenticated cannot insert a program row (ADR-0103)');
reset role;
select throws_ok($$insert into public.training_programs(athlete_id,name,creation_request_id,creation_request_fingerprint) values('cccccccc-1111-4ccc-8ccc-cccccccccccc','X','d0000000-0000-4000-8000-000000000005',repeat('a',64))$$,'42501','Creation identity requires the atomic creation operation','even a privileged writer cannot forge creation identity outside the RPC');
set local role authenticated;
select throws_ok($$update public.training_programs set creation_request_id='d0000000-0000-4000-8000-000000000009' where id=(select id from tapc_first)$$,'55000','Creation identity is immutable','identity immutable');
select throws_ok($$select public.create_training_program_with_structure(null,'X',public.tapc_tree())$$,'22023','Creation request id required','request id required');
reset role;

-- Athlete B: same request UUID is a different, isolated intent.
select set_config('request.jwt.claim.sub','c2222222-2222-4222-8222-222222222222',true);
set local role authenticated;
create temp table tapc_b as select public.create_training_program_with_structure('d0000000-0000-4000-8000-000000000001','Treino B',public.tapc_tree()) id;
select isnt((select id from tapc_b),(select id from tapc_first),'same request UUID for another athlete creates its own draft');
select is((select count(*) from public.training_programs where id=(select id from tapc_first)),0::bigint,'athlete B cannot see athlete A draft');
select is((select athlete_id from public.training_programs where id=(select id from tapc_b)),'cccccccc-2222-4ccc-8ccc-cccccccccccc'::uuid,'B draft owned by B');
reset role;
select is((select count(*) from public.training_programs where creation_request_id='d0000000-0000-4000-8000-000000000001'),2::bigint,'one draft per athlete for that UUID');
-- Unique backstop for the idempotency key (athlete-scoped).
select set_config('app.training_program_creation','atomic',true);
select throws_ok($$insert into public.training_programs(athlete_id,name,creation_request_id,creation_request_fingerprint) values('cccccccc-1111-4ccc-8ccc-cccccccccccc','Dup','d0000000-0000-4000-8000-000000000001',repeat('b',64))$$,'23505',null,'duplicate (athlete, request) impossible');
select set_config('app.training_program_creation','',true);

-- Unauthenticated session has no athlete.
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
select throws_ok($$select public.create_training_program_with_structure('d0000000-0000-4000-8000-000000000006','X',public.tapc_tree())$$,'42501','Athlete not found','no athlete, no creation');
reset role;

select * from finish(); rollback;
