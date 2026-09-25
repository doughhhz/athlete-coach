create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Maintains updated_at for tables that opt into this trigger.';

revoke all on function public.set_updated_at() from public, anon, authenticated;
grant execute on function public.set_updated_at() to service_role;

create table public.athletes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint athletes_user_id_key unique (user_id),
  constraint athletes_user_id_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete cascade
);

comment on table public.athletes is
  'Domain identity for an athlete, separate from Supabase Auth identity.';
comment on column public.athletes.id is 'Stable domain identifier for the athlete.';
comment on column public.athletes.user_id is 'Infrastructure identity in auth.users; one athlete per user.';
comment on column public.athletes.created_at is 'Absolute creation instant stored as timestamptz.';
comment on column public.athletes.updated_at is 'Absolute last-update instant maintained by trigger.';

create trigger athletes_set_updated_at
before update on public.athletes
for each row
execute function public.set_updated_at();

alter table public.athletes enable row level security;

revoke all on table public.athletes from public, anon, authenticated;
grant select, insert, update, delete on table public.athletes to authenticated;
grant all privileges on table public.athletes to service_role;

create policy athletes_select_own
on public.athletes
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy athletes_insert_own
on public.athletes
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy athletes_update_own
on public.athletes
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy athletes_delete_own
on public.athletes
for delete
to authenticated
using ((select auth.uid()) = user_id);
