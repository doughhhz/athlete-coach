begin; create extension if not exists pgtap with schema extensions; select no_plan();
-- Implementation Phase 21 (ADR-0119): program intake and generation audit.
insert into auth.users(id,email) values
  ('e1111111-1111-4111-8111-111111111111','intake-a@example.invalid'),
  ('e2222222-2222-4222-8222-222222222222','intake-b@example.invalid');
insert into public.athletes(id,user_id) values
  ('eeeeeeee-1111-4eee-8eee-eeeeeeeeeeee','e1111111-1111-4111-8111-111111111111'),
  ('eeeeeeee-2222-4eee-8eee-eeeeeeeeeeee','e2222222-2222-4222-8222-222222222222');
insert into public.training_programs(id,athlete_id,name) values
  ('f0000000-0000-4000-8000-000000000001','eeeeeeee-1111-4eee-8eee-eeeeeeeeeeee','Programa A'),
  ('f0000000-0000-4000-8000-000000000002','eeeeeeee-2222-4eee-8eee-eeeeeeeeeeee','Programa B');

select has_table('public','athlete_program_intakes','intake table exists');
select has_table('public','initial_program_generations','generation audit table exists');
select ok(not has_table_privilege('anon','public.athlete_program_intakes','select'),'anon cannot read intakes');
select ok(not has_table_privilege('authenticated','public.athlete_program_intakes','delete'),'athletes cannot delete intakes');
select ok(not has_table_privilege('authenticated','public.initial_program_generations','insert'),'athletes cannot write the audit');

-- Constraints (as table owner).
select throws_ok($$insert into public.athlete_program_intakes(athlete_id,current_pain_or_injury,medical_exercise_restriction) values ('eeeeeeee-2222-4eee-8eee-eeeeeeeeeeee',true,false)$$,'23514',null,'pain requires a description');
select throws_ok($$insert into public.athlete_program_intakes(athlete_id,current_pain_or_injury,medical_exercise_restriction,available_equipment) values ('eeeeeeee-2222-4eee-8eee-eeeeeeeeeeee',false,false,array['Halter!'])$$,'23514',null,'equipment must be slugs');
select throws_ok($$insert into public.athlete_program_intakes(athlete_id,current_pain_or_injury,medical_exercise_restriction,available_equipment) values ('eeeeeeee-2222-4eee-8eee-eeeeeeeeeeee',false,false,array[]::text[])$$,'23514',null,'empty equipment list is stored as null, never empty');
select throws_ok($$insert into public.initial_program_generations(athlete_id,program_id,origin,envelope_version,spec_version) values ('eeeeeeee-1111-4eee-8eee-eeeeeeeeeeee','f0000000-0000-4000-8000-000000000002','basic','e','s')$$,'23503',null,'audit program must belong to the same athlete');
select throws_ok($$insert into public.initial_program_generations(athlete_id,program_id,origin,envelope_version,spec_version) values ('eeeeeeee-1111-4eee-8eee-eeeeeeeeeeee','f0000000-0000-4000-8000-000000000001','personal','e','s')$$,'23514',null,'personal origin requires model provenance');
select lives_ok($$insert into public.initial_program_generations(athlete_id,program_id,origin,provider,model,prompt_version,envelope_version,spec_version,repaired) values ('eeeeeeee-1111-4eee-8eee-eeeeeeeeeeee','f0000000-0000-4000-8000-000000000001','personal','gemini','m','initial-program-prompt-v1','initial-program-envelope-v1','personal-spec-v1',true)$$,'valid personal audit row');
select throws_ok($$insert into public.initial_program_generations(athlete_id,program_id,origin,envelope_version,spec_version) values ('eeeeeeee-1111-4eee-8eee-eeeeeeeeeeee','f0000000-0000-4000-8000-000000000001','basic','e','s')$$,'23505',null,'one audit row per program');

-- Athlete A, through RLS.
select set_config('request.jwt.claim.sub','e1111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select lives_ok($$insert into public.athlete_program_intakes(athlete_id,current_pain_or_injury,pain_or_injury_notes,medical_exercise_restriction,other_sports_notes,available_equipment) values ('eeeeeeee-1111-4eee-8eee-eeeeeeeeeeee',true,'Joelho sensível',false,'Futebol',array['dumbbell','bench'])$$,'athlete saves own intake');
select lives_ok($$update public.athlete_program_intakes set available_equipment=null where athlete_id='eeeeeeee-1111-4eee-8eee-eeeeeeeeeeee'$$,'athlete updates own intake');
select throws_ok($$insert into public.athlete_program_intakes(athlete_id,current_pain_or_injury,medical_exercise_restriction) values ('eeeeeeee-2222-4eee-8eee-eeeeeeeeeeee',false,false)$$,'42501',null,'cannot write another athlete intake');
select is((select count(*) from public.athlete_program_intakes),1::bigint,'sees only own intake');
select is((select count(*) from public.initial_program_generations),1::bigint,'reads own generation audit');
select throws_ok($$insert into public.initial_program_generations(athlete_id,program_id,origin,envelope_version,spec_version) values ('eeeeeeee-1111-4eee-8eee-eeeeeeeeeeee','f0000000-0000-4000-8000-000000000001','basic','e','s')$$,'42501',null,'athlete cannot forge the audit');

-- Athlete B sees nothing of A.
reset role;
select set_config('request.jwt.claim.sub','e2222222-2222-4222-8222-222222222222',true);
set local role authenticated;
select is((select count(*) from public.athlete_program_intakes),0::bigint,'other athlete sees no intake');
select is((select count(*) from public.initial_program_generations),0::bigint,'other athlete sees no audit');

select * from finish(); rollback;
