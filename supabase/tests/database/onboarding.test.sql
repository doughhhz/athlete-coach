begin;

create extension if not exists pgtap with schema extensions;
select plan(89);

create or replace function pg_temp.sqlstate_of(command text) returns text language plpgsql as $$
begin execute command; return null;
exception when others then return sqlstate;
end;
$$;

create or replace function pg_temp.row_count_of(command text) returns bigint language plpgsql as $$
declare affected bigint;
begin
  execute command;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

select has_column('public', 'athletes', 'onboarding_completed_at', 'athletes tracks explicit onboarding completion');
select has_table('public', 'athlete_profiles', 'athlete_profiles exists');
select has_table('public', 'athlete_goals', 'athlete_goals exists');
select has_table('public', 'athlete_training_contexts', 'athlete_training_contexts exists');
select has_table('public', 'athlete_training_availability', 'athlete_training_availability exists');
select has_table('public', 'body_weight_entries', 'body_weight_entries exists');

select ok((select relrowsecurity from pg_class where oid = 'public.athlete_profiles'::regclass), 'profiles RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.athlete_goals'::regclass), 'goals RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.athlete_training_contexts'::regclass), 'contexts RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.athlete_training_availability'::regclass), 'availability RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.body_weight_entries'::regclass), 'weights RLS enabled');

select has_index('public', 'athlete_goals', 'athlete_goals_one_active_per_athlete_idx', 'one active goal index exists');
select fk_ok('public', 'athlete_profiles', 'athlete_id', 'public', 'athletes', 'id', 'profile references athlete');
select fk_ok('public', 'athlete_goals', 'athlete_id', 'public', 'athletes', 'id', 'goal references athlete');
select fk_ok('public', 'athlete_training_contexts', 'athlete_id', 'public', 'athletes', 'id', 'context references athlete');
select fk_ok('public', 'athlete_training_availability', 'athlete_id', 'public', 'athletes', 'id', 'availability references athlete');
select fk_ok('public', 'body_weight_entries', 'athlete_id', 'public', 'athletes', 'id', 'weight references athlete');

set local role anon;
select is(pg_temp.sqlstate_of('select * from public.athlete_profiles'), '42501', 'anon cannot read profiles');
select is(pg_temp.sqlstate_of('select * from public.athlete_goals'), '42501', 'anon cannot read goals');
select is(pg_temp.sqlstate_of('select * from public.athlete_training_contexts'), '42501', 'anon cannot read contexts');
select is(pg_temp.sqlstate_of('select * from public.athlete_training_availability'), '42501', 'anon cannot read availability');
select is(pg_temp.sqlstate_of('select * from public.body_weight_entries'), '42501', 'anon cannot read weights');
select is(pg_temp.sqlstate_of('select public.ensure_current_athlete()'), '42501', 'anon cannot ensure athlete');
reset role;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'phase3-one@example.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'phase3-two@example.invalid'),
  ('33333333-3333-4333-8333-333333333333', 'phase3-three@example.invalid');
insert into public.athletes (id, user_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222');

set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
set local role authenticated;
select lives_ok('select public.ensure_current_athlete()', 'authenticated user can ensure athlete');
select is(
  (select (public.ensure_current_athlete()).id),
  (select (public.ensure_current_athlete()).id),
  'ensure athlete is idempotent'
);
select lives_ok(
  $$select public.complete_athlete_onboarding(
    'Atleta Um', '2000-01-01', 180, 'America/Sao_Paulo', 'strength',
    24, 'consistent', 60, 'commercial_gym', 'Rotina variável',
    array[1,3,5]::smallint[], 76.40, now(), null, '', '', '', null
  )$$,
  'valid onboarding completes atomically'
);
select ok((select onboarding_completed_at is not null from public.athletes), 'onboarding completion is explicit');
select is((select count(*) from public.athlete_profiles), 1::bigint, 'onboarding creates one profile');
select is((select count(*) from public.athlete_goals where status = 'active'), 1::bigint, 'onboarding creates one active goal');
select is((select count(*) from public.athlete_training_contexts), 1::bigint, 'onboarding creates one context');
select is((select count(*) from public.athlete_training_availability), 3::bigint, 'onboarding creates selected weekdays');
select is((select count(*) from public.body_weight_entries), 1::bigint, 'onboarding creates initial weight');
select lives_ok(
  $$select public.complete_athlete_onboarding(
    'Ignorado', '2001-01-01', 170, 'UTC', 'hypertrophy',
    1, 'restarting', 30, 'home_gym', '',
    array[2]::smallint[], 80, now(), 80, '', '', '', null
  )$$,
  'retrying completed onboarding is safe'
);
select is((select count(*) from public.body_weight_entries), 1::bigint, 'onboarding retry does not duplicate weight');
select is((select count(*) from public.athlete_goals), 1::bigint, 'onboarding retry does not duplicate goal');
select is((select count(*) from public.athlete_profiles), 1::bigint, 'own profile is readable');
select is((select count(*) from public.athlete_goals), 1::bigint, 'own goal is readable');
select is((select count(*) from public.athlete_training_contexts), 1::bigint, 'own context is readable');
select is((select count(*) from public.athlete_training_availability), 3::bigint, 'own availability is readable');
select is((select count(*) from public.body_weight_entries), 1::bigint, 'own weights are readable');

reset role;
set local request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
set local role authenticated;
select lives_ok(
  $$select public.complete_athlete_onboarding(
    'Atleta Dois', '1995-05-05', 170, 'America/Sao_Paulo', 'general_fitness',
    6, 'irregular', 45, 'mixed', 'Outra rotina',
    array[2,4]::smallint[], 65, now(), null, '', '', '', null
  )$$,
  'second user completes onboarding'
);

reset role;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
set local role authenticated;
select is((select count(*) from public.athlete_profiles where athlete_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0::bigint, 'other profile is invisible');
select is((select count(*) from public.athlete_goals where athlete_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0::bigint, 'other goals are invisible');
select is((select count(*) from public.athlete_training_contexts where athlete_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0::bigint, 'other context is invisible');
select is((select count(*) from public.athlete_training_availability where athlete_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0::bigint, 'other availability is invisible');
select is((select count(*) from public.body_weight_entries where athlete_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0::bigint, 'other weights are invisible');

select is(pg_temp.row_count_of($$update public.athlete_profiles set preferred_name='blocked' where athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$), 0::bigint, 'cannot update another profile');
select is(pg_temp.row_count_of($$update public.athlete_goals set notes='blocked' where athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$), 0::bigint, 'cannot update another goal');
select is(pg_temp.row_count_of($$update public.athlete_training_contexts set routine_summary='blocked' where athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$), 0::bigint, 'cannot update another context');
select is(pg_temp.row_count_of($$update public.athlete_training_availability set weekday=7 where athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$), 0::bigint, 'cannot update another availability');
select is(pg_temp.row_count_of($$delete from public.athlete_profiles where athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$), 0::bigint, 'cannot delete another profile');
select is(pg_temp.row_count_of($$delete from public.athlete_goals where athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$), 0::bigint, 'cannot delete another goal');
select is(pg_temp.row_count_of($$delete from public.athlete_training_contexts where athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$), 0::bigint, 'cannot delete another context');
select is(pg_temp.row_count_of($$delete from public.athlete_training_availability where athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$), 0::bigint, 'cannot delete another availability');
select is(pg_temp.sqlstate_of($$delete from public.body_weight_entries where athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$), '42501', 'weight observations cannot be deleted');

select is(pg_temp.sqlstate_of($$insert into public.athlete_profiles values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','X','2000-01-01',180,'UTC',now(),now())$$), '42501', 'cannot insert profile for another athlete');
select is(pg_temp.sqlstate_of($$insert into public.athlete_goals (athlete_id,goal_type) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','strength')$$), '42501', 'cannot insert goal for another athlete');
select is(pg_temp.sqlstate_of($$insert into public.athlete_training_contexts (athlete_id,resistance_training_months,recent_training_consistency,preferred_session_duration_minutes,training_environment,routine_summary) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'consistent',60,'mixed','')$$), '42501', 'cannot insert context for another athlete');
select is(pg_temp.sqlstate_of($$insert into public.athlete_training_availability (athlete_id,weekday) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1)$$), '42501', 'cannot insert availability for another athlete');
select is(pg_temp.sqlstate_of($$insert into public.body_weight_entries (athlete_id,measured_at,weight_kg) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now(),70)$$), '42501', 'cannot insert weight for another athlete');

select is(pg_temp.sqlstate_of($$update public.athlete_profiles set athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$), '42501', 'cannot reassign profile ownership');
select is(pg_temp.sqlstate_of($$update public.athlete_goals set athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$), '42501', 'cannot reassign goal ownership');
select is(pg_temp.sqlstate_of($$update public.athlete_training_contexts set athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$), '42501', 'cannot reassign context ownership');
select is(pg_temp.sqlstate_of($$update public.athlete_training_availability set athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$), '42501', 'cannot reassign availability ownership');
select is(pg_temp.sqlstate_of($$update public.body_weight_entries set athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$), '42501', 'weight observations cannot be updated');

select is(pg_temp.sqlstate_of($$insert into public.athlete_goals (athlete_id,goal_type) values (public.current_athlete_id(),'hypertrophy')$$), '23505', 'partial unique index rejects second active goal');
select lives_ok($$select public.change_current_athlete_goal('hypertrophy', 80, 'Novo foco')$$, 'goal change is atomic');
select is((select count(*) from public.athlete_goals where status='active'), 1::bigint, 'exactly one goal remains active');
select is((select count(*) from public.athlete_goals), 2::bigint, 'goal history is preserved');
select is((select count(*) from public.athlete_goals where status='completed' and ended_at is not null), 1::bigint, 'previous goal is closed');

select lives_ok($$insert into public.body_weight_entries (athlete_id,measured_at,weight_kg) values (public.current_athlete_id(),now()+interval '1 second',77)$$, 'user records another weight');
select is((select count(*) from public.body_weight_entries), 2::bigint, 'weight history retains both observations');
select is((select weight_kg from public.body_weight_entries order by measured_at desc limit 1), 77.00::numeric, 'latest weight is selected by measured_at');
select lives_ok($$select public.set_current_training_availability(array[2,4]::smallint[])$$, 'availability replacement is atomic');
select is((select count(*) from public.athlete_training_availability), 2::bigint, 'availability replacement stores exact days');
select lives_ok($$update public.athlete_profiles set preferred_name='Nome atualizado'$$, 'user updates own profile');
select lives_ok($$update public.athlete_training_contexts set routine_summary='Rotina atualizada'$$, 'user updates own context');
select ok((select target_weight_kg is null from public.athlete_goals where status='completed'), 'target weight is optional');

reset role;
set local request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
set local role authenticated;
select is(
  pg_temp.sqlstate_of($$select public.complete_athlete_onboarding(
    'Atleta Três','2000-01-01',180,'UTC','strength',1,'consistent',60,'other','',
    array[0]::smallint[],75,now(),null,'','','',null
  )$$),
  '22023',
  'invalid onboarding fails'
);
reset role;
select is((select count(*) from public.athletes where user_id='33333333-3333-4333-8333-333333333333'), 0::bigint, 'failed onboarding rolls back athlete creation');
select is((select count(*) from public.athlete_profiles p join public.athletes a on a.id=p.athlete_id where a.user_id='33333333-3333-4333-8333-333333333333'), 0::bigint, 'failed onboarding leaves no profile');
select is((select count(*) from public.athlete_goals g join public.athletes a on a.id=g.athlete_id where a.user_id='33333333-3333-4333-8333-333333333333'), 0::bigint, 'failed onboarding leaves no goal');
select is((select count(*) from public.athlete_training_contexts c join public.athletes a on a.id=c.athlete_id where a.user_id='33333333-3333-4333-8333-333333333333'), 0::bigint, 'failed onboarding leaves no context');
select is((select count(*) from public.body_weight_entries w join public.athletes a on a.id=w.athlete_id where a.user_id='33333333-3333-4333-8333-333333333333'), 0::bigint, 'failed onboarding leaves no weight');

delete from auth.users where id='22222222-2222-4222-8222-222222222222';
select is((select count(*) from public.athlete_profiles where athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0::bigint, 'profile cascades on account deletion');
select is((select count(*) from public.athlete_goals where athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0::bigint, 'goals cascade on account deletion');
select is((select count(*) from public.athlete_training_contexts where athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0::bigint, 'context cascades on account deletion');
select is((select count(*) from public.athlete_training_availability where athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0::bigint, 'availability cascades on account deletion');
select is((select count(*) from public.body_weight_entries where athlete_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0::bigint, 'weights cascade on account deletion');

select * from finish();
rollback;
