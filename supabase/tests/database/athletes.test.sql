begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

create or replace function pg_temp.sqlstate_of(command text)
returns text
language plpgsql
as $$
begin
  execute command;
  return null;
exception
  when others then
    return sqlstate;
end;
$$;

create or replace function pg_temp.row_count_of(command text)
returns bigint
language plpgsql
as $$
declare
  affected_rows bigint;
begin
  execute command;
  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

select has_table('public', 'athletes', 'athletes table exists');

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.athletes'::regclass
      and conname = 'athletes_pkey'
      and contype = 'p'
  ),
  'athletes.id is protected by a primary key'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.athletes'::regclass
      and conname = 'athletes_user_id_key'
      and contype = 'u'
  ),
  'one athlete per auth user is enforced'
);

select ok(
  exists (
    select 1
    from pg_constraint constraint_record
    where constraint_record.conrelid = 'public.athletes'::regclass
      and constraint_record.conname = 'athletes_user_id_fkey'
      and constraint_record.confrelid = 'auth.users'::regclass
      and constraint_record.contype = 'f'
  ),
  'athletes.user_id references auth.users'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.athletes'::regclass
      and conname = 'athletes_user_id_fkey'
      and confdeltype = 'c'
  ),
  'deleting an auth user cascades to its athlete identity'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.athletes'::regclass),
  'RLS is enabled on athletes'
);

select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'athletes'),
  4::bigint,
  'athletes has one explicit policy per operation'
);

select ok(not has_table_privilege('anon', 'public.athletes', 'select'), 'anon has no SELECT grant');
select ok(not has_table_privilege('anon', 'public.athletes', 'insert'), 'anon has no INSERT grant');
select ok(not has_table_privilege('anon', 'public.athletes', 'update'), 'anon has no UPDATE grant');
select ok(not has_table_privilege('anon', 'public.athletes', 'delete'), 'anon has no DELETE grant');

select ok(
  has_table_privilege('authenticated', 'public.athletes', 'select')
    and has_table_privilege('authenticated', 'public.athletes', 'insert')
    and has_table_privilege('authenticated', 'public.athletes', 'update')
    and has_table_privilege('authenticated', 'public.athletes', 'delete'),
  'authenticated receives only the required table operations'
);

select ok(
  has_table_privilege('service_role', 'public.athletes', 'select, insert, update, delete'),
  'service_role retains backend table access'
);

set local role anon;

select is(
  pg_temp.sqlstate_of('select * from public.athletes'),
  '42501',
  'anon cannot read athletes'
);

select is(
  pg_temp.sqlstate_of(
    $$insert into public.athletes (user_id) values ('11111111-1111-4111-8111-111111111111')$$
  ),
  '42501',
  'anon cannot create athletes'
);

reset role;

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'athlete-one@example.invalid'),
  ('22222222-2222-4222-8222-222222222222', 'athlete-two@example.invalid'),
  ('33333333-3333-4333-8333-333333333333', 'athlete-three@example.invalid');

set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
set local role authenticated;

select lives_ok(
  $$insert into public.athletes (user_id) values ('11111111-1111-4111-8111-111111111111')$$,
  'an authenticated user can create their own athlete identity'
);

select is(
  pg_temp.sqlstate_of(
    $$insert into public.athletes (user_id) values ('22222222-2222-4222-8222-222222222222')$$
  ),
  '42501',
  'a user cannot create an athlete for another user'
);

reset role;

insert into public.athletes (user_id)
values ('22222222-2222-4222-8222-222222222222');

select is(
  pg_temp.sqlstate_of(
    $$insert into public.athletes (user_id) values ('11111111-1111-4111-8111-111111111111')$$
  ),
  '23505',
  'the unique constraint rejects a second athlete for one user'
);

select is(
  pg_temp.sqlstate_of(
    $$insert into public.athletes (user_id) values ('44444444-4444-4444-8444-444444444444')$$
  ),
  '23503',
  'the foreign key rejects an athlete without an auth user'
);

set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
set local role authenticated;

select is((select count(*) from public.athletes), 1::bigint, 'a user sees exactly their own athlete');

select is(
  (select count(*) from public.athletes where user_id = '22222222-2222-4222-8222-222222222222'),
  0::bigint,
  'another user athlete is invisible'
);

select is(
  pg_temp.row_count_of(
    $$update public.athletes
      set updated_at = '2000-01-01 00:00:00+00'
      where user_id = '11111111-1111-4111-8111-111111111111'$$
  ),
  1::bigint,
  'a user can update their own athlete'
);

select ok(
  (
    select updated_at > '2020-01-01 00:00:00+00'
    from public.athletes
    where user_id = '11111111-1111-4111-8111-111111111111'
  ),
  'updated_at is maintained by the database trigger'
);

select is(
  pg_temp.row_count_of(
    $$update public.athletes
      set updated_at = now()
      where user_id = '22222222-2222-4222-8222-222222222222'$$
  ),
  0::bigint,
  'a user cannot update another user athlete'
);

select is(
  pg_temp.sqlstate_of(
    $$update public.athletes
      set user_id = '33333333-3333-4333-8333-333333333333'
      where user_id = '11111111-1111-4111-8111-111111111111'$$
  ),
  '42501',
  'a user cannot reassign athlete ownership'
);

select is(
  pg_temp.row_count_of(
    $$delete from public.athletes
      where user_id = '22222222-2222-4222-8222-222222222222'$$
  ),
  0::bigint,
  'a user cannot delete another user athlete'
);

select is(
  pg_temp.row_count_of(
    $$delete from public.athletes
      where user_id = '11111111-1111-4111-8111-111111111111'$$
  ),
  1::bigint,
  'a user can delete their own athlete'
);

select * from finish();

rollback;
