begin; create extension if not exists pgtap with schema extensions; select no_plan();
-- ADR-0125: own non-active programs without history can be deleted.
insert into auth.users(id,email) values
  ('d1111111-1111-4111-8111-111111111111','delete-a@example.invalid'),
  ('d2222222-2222-4222-8222-222222222222','delete-b@example.invalid');
insert into public.athletes(id,user_id) values
  ('dddddddd-1111-4ddd-8ddd-dddddddddddd','d1111111-1111-4111-8111-111111111111'),
  ('dddddddd-2222-4ddd-8ddd-dddddddddddd','d2222222-2222-4222-8222-222222222222');
insert into public.training_programs(id,athlete_id,name,status,activated_at) values
  ('e0000000-0000-4000-8000-000000000001','dddddddd-1111-4ddd-8ddd-dddddddddddd','Rascunho','draft',null),
  ('e0000000-0000-4000-8000-000000000002','dddddddd-1111-4ddd-8ddd-dddddddddddd','Ativo','active',now()),
  ('e0000000-0000-4000-8000-000000000003','dddddddd-2222-4ddd-8ddd-dddddddddddd','De outro','draft',null);

select set_config('request.jwt.claim.sub','d1111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select is((with gone as (delete from public.training_programs where id='e0000000-0000-4000-8000-000000000001' returning id) select count(*) from gone),1::bigint,'own draft is deleted');
select is((with gone as (delete from public.training_programs where id='e0000000-0000-4000-8000-000000000002' returning id) select count(*) from gone),0::bigint,'active program is not deleted');
select is((with gone as (delete from public.training_programs where id='e0000000-0000-4000-8000-000000000003' returning id) select count(*) from gone),0::bigint,'another athlete program is not deleted');
reset role;
select is((select count(*) from public.training_programs where id in ('e0000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000003')),2::bigint,'active and foreign programs remain');
select * from finish(); rollback;
