alter table public.athletes
add column onboarding_completed_at timestamptz;

comment on column public.athletes.onboarding_completed_at is
  'Set only after the atomic onboarding transaction has persisted every required record.';

create table public.athlete_profiles (
  athlete_id uuid primary key,
  preferred_name text not null,
  birth_date date not null,
  height_cm numeric(5, 1) not null,
  timezone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint athlete_profiles_athlete_id_fkey
    foreign key (athlete_id)
    references public.athletes (id)
    on delete cascade,
  constraint athlete_profiles_preferred_name_length_check
    check (char_length(btrim(preferred_name)) between 1 and 80),
  constraint athlete_profiles_birth_date_check
    check (birth_date between date '1900-01-01' and current_date),
  constraint athlete_profiles_height_cm_check
    check (height_cm between 50 and 250),
  constraint athlete_profiles_timezone_check
    check (char_length(btrim(timezone)) between 1 and 64)
);

create table public.athlete_goals (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null,
  goal_type text not null,
  target_weight_kg numeric(5, 2),
  notes text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint athlete_goals_athlete_id_fkey
    foreign key (athlete_id)
    references public.athletes (id)
    on delete cascade,
  constraint athlete_goals_goal_type_check
    check (goal_type in ('hypertrophy', 'fat_loss', 'recomposition', 'strength', 'general_fitness')),
  constraint athlete_goals_target_weight_kg_check
    check (target_weight_kg is null or target_weight_kg between 20 and 500),
  constraint athlete_goals_notes_length_check
    check (notes is null or char_length(notes) <= 1000),
  constraint athlete_goals_status_check
    check (status in ('active', 'completed', 'cancelled')),
  constraint athlete_goals_lifecycle_check
    check (
      (status = 'active' and ended_at is null)
      or (status <> 'active' and ended_at is not null and ended_at >= started_at)
    )
);

create unique index athlete_goals_one_active_per_athlete_idx
on public.athlete_goals (athlete_id)
where status = 'active';

create index athlete_goals_athlete_started_at_idx
on public.athlete_goals (athlete_id, started_at desc);

create table public.athlete_training_contexts (
  athlete_id uuid primary key,
  resistance_training_months integer not null,
  recent_training_consistency text not null,
  preferred_session_duration_minutes integer not null,
  training_environment text not null,
  routine_summary text not null,
  constraints_notes text,
  preferences_notes text,
  average_sleep_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint athlete_training_contexts_athlete_id_fkey
    foreign key (athlete_id)
    references public.athletes (id)
    on delete cascade,
  constraint athlete_training_contexts_months_check
    check (resistance_training_months between 0 and 1200),
  constraint athlete_training_contexts_consistency_check
    check (recent_training_consistency in ('restarting', 'irregular', 'consistent')),
  constraint athlete_training_contexts_duration_check
    check (preferred_session_duration_minutes between 10 and 300),
  constraint athlete_training_contexts_environment_check
    check (training_environment in ('commercial_gym', 'home_gym', 'mixed', 'other')),
  constraint athlete_training_contexts_routine_length_check
    check (char_length(routine_summary) <= 500),
  constraint athlete_training_contexts_constraints_length_check
    check (constraints_notes is null or char_length(constraints_notes) <= 1000),
  constraint athlete_training_contexts_preferences_length_check
    check (preferences_notes is null or char_length(preferences_notes) <= 1000),
  constraint athlete_training_contexts_sleep_check
    check (average_sleep_minutes is null or average_sleep_minutes between 0 and 1440)
);

create table public.athlete_training_availability (
  athlete_id uuid not null,
  weekday smallint not null,
  created_at timestamptz not null default now(),
  primary key (athlete_id, weekday),
  constraint athlete_training_availability_athlete_id_fkey
    foreign key (athlete_id)
    references public.athletes (id)
    on delete cascade,
  constraint athlete_training_availability_weekday_check
    check (weekday between 1 and 7)
);

create table public.body_weight_entries (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null,
  measured_at timestamptz not null,
  weight_kg numeric(5, 2) not null,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  constraint body_weight_entries_athlete_id_fkey
    foreign key (athlete_id)
    references public.athletes (id)
    on delete cascade,
  constraint body_weight_entries_weight_kg_check
    check (weight_kg between 20 and 500),
  constraint body_weight_entries_source_check
    check (source in ('manual')),
  constraint body_weight_entries_measured_at_check
    check (measured_at <= now() + interval '5 minutes')
);

create index body_weight_entries_latest_idx
on public.body_weight_entries (athlete_id, measured_at desc, created_at desc);

create trigger athlete_profiles_set_updated_at
before update on public.athlete_profiles
for each row execute function public.set_updated_at();

create trigger athlete_goals_set_updated_at
before update on public.athlete_goals
for each row execute function public.set_updated_at();

create trigger athlete_training_contexts_set_updated_at
before update on public.athlete_training_contexts
for each row execute function public.set_updated_at();

alter table public.athlete_profiles enable row level security;
alter table public.athlete_goals enable row level security;
alter table public.athlete_training_contexts enable row level security;
alter table public.athlete_training_availability enable row level security;
alter table public.body_weight_entries enable row level security;

revoke all on table public.athlete_profiles from public, anon, authenticated;
revoke all on table public.athlete_goals from public, anon, authenticated;
revoke all on table public.athlete_training_contexts from public, anon, authenticated;
revoke all on table public.athlete_training_availability from public, anon, authenticated;
revoke all on table public.body_weight_entries from public, anon, authenticated;

grant select, insert, update, delete on table public.athlete_profiles to authenticated;
grant select, insert, update, delete on table public.athlete_goals to authenticated;
grant select, insert, update, delete on table public.athlete_training_contexts to authenticated;
grant select, insert, update, delete on table public.athlete_training_availability to authenticated;
grant select, insert on table public.body_weight_entries to authenticated;

grant all privileges on table public.athlete_profiles to service_role;
grant all privileges on table public.athlete_goals to service_role;
grant all privileges on table public.athlete_training_contexts to service_role;
grant all privileges on table public.athlete_training_availability to service_role;
grant all privileges on table public.body_weight_entries to service_role;

create or replace function public.current_athlete_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select id
  from public.athletes
  where user_id = (select auth.uid())
$$;

revoke all on function public.current_athlete_id() from public, anon;
grant execute on function public.current_athlete_id() to authenticated, service_role;

create policy athlete_profiles_select_own
on public.athlete_profiles for select to authenticated
using (athlete_id = (select public.current_athlete_id()));
create policy athlete_profiles_insert_own
on public.athlete_profiles for insert to authenticated
with check (athlete_id = (select public.current_athlete_id()));
create policy athlete_profiles_update_own
on public.athlete_profiles for update to authenticated
using (athlete_id = (select public.current_athlete_id()))
with check (athlete_id = (select public.current_athlete_id()));
create policy athlete_profiles_delete_own
on public.athlete_profiles for delete to authenticated
using (athlete_id = (select public.current_athlete_id()));

create policy athlete_goals_select_own
on public.athlete_goals for select to authenticated
using (athlete_id = (select public.current_athlete_id()));
create policy athlete_goals_insert_own
on public.athlete_goals for insert to authenticated
with check (athlete_id = (select public.current_athlete_id()));
create policy athlete_goals_update_own
on public.athlete_goals for update to authenticated
using (athlete_id = (select public.current_athlete_id()))
with check (athlete_id = (select public.current_athlete_id()));
create policy athlete_goals_delete_own
on public.athlete_goals for delete to authenticated
using (athlete_id = (select public.current_athlete_id()));

create policy athlete_training_contexts_select_own
on public.athlete_training_contexts for select to authenticated
using (athlete_id = (select public.current_athlete_id()));
create policy athlete_training_contexts_insert_own
on public.athlete_training_contexts for insert to authenticated
with check (athlete_id = (select public.current_athlete_id()));
create policy athlete_training_contexts_update_own
on public.athlete_training_contexts for update to authenticated
using (athlete_id = (select public.current_athlete_id()))
with check (athlete_id = (select public.current_athlete_id()));
create policy athlete_training_contexts_delete_own
on public.athlete_training_contexts for delete to authenticated
using (athlete_id = (select public.current_athlete_id()));

create policy athlete_training_availability_select_own
on public.athlete_training_availability for select to authenticated
using (athlete_id = (select public.current_athlete_id()));
create policy athlete_training_availability_insert_own
on public.athlete_training_availability for insert to authenticated
with check (athlete_id = (select public.current_athlete_id()));
create policy athlete_training_availability_update_own
on public.athlete_training_availability for update to authenticated
using (athlete_id = (select public.current_athlete_id()))
with check (athlete_id = (select public.current_athlete_id()));
create policy athlete_training_availability_delete_own
on public.athlete_training_availability for delete to authenticated
using (athlete_id = (select public.current_athlete_id()));

create policy body_weight_entries_select_own
on public.body_weight_entries for select to authenticated
using (athlete_id = (select public.current_athlete_id()));
create policy body_weight_entries_insert_own
on public.body_weight_entries for insert to authenticated
with check (athlete_id = (select public.current_athlete_id()));

create or replace function public.ensure_current_athlete()
returns public.athletes
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  athlete_record public.athletes;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  insert into public.athletes (user_id)
  values (current_user_id)
  on conflict (user_id) do nothing;

  select * into strict athlete_record
  from public.athletes
  where user_id = current_user_id;

  return athlete_record;
end;
$$;

create or replace function public.complete_athlete_onboarding(
  p_preferred_name text,
  p_birth_date date,
  p_height_cm numeric,
  p_timezone text,
  p_goal_type text,
  p_resistance_training_months integer,
  p_recent_training_consistency text,
  p_preferred_session_duration_minutes integer,
  p_training_environment text,
  p_routine_summary text,
  p_available_weekdays smallint[],
  p_weight_kg numeric,
  p_weight_measured_at timestamptz,
  p_target_weight_kg numeric default null,
  p_goal_notes text default null,
  p_constraints_notes text default null,
  p_preferences_notes text default null,
  p_average_sleep_minutes integer default null
)
returns public.athletes
language plpgsql
security invoker
set search_path = ''
as $$
declare
  athlete_record public.athletes;
begin
  athlete_record := public.ensure_current_athlete();

  -- Serialize concurrent completion attempts for the same authenticated athlete.
  select * into strict athlete_record
  from public.athletes
  where id = athlete_record.id
  for update;

  if athlete_record.onboarding_completed_at is not null then
    return athlete_record;
  end if;

  if coalesce(array_length(p_available_weekdays, 1), 0) = 0
    or exists (
      select 1 from unnest(p_available_weekdays) as selected_weekday
      where selected_weekday is null or selected_weekday not between 1 and 7
    ) then
    raise exception 'At least one valid weekday is required' using errcode = '22023';
  end if;

  insert into public.athlete_profiles (
    athlete_id, preferred_name, birth_date, height_cm, timezone
  ) values (
    athlete_record.id, btrim(p_preferred_name), p_birth_date, p_height_cm, btrim(p_timezone)
  );

  insert into public.athlete_goals (
    athlete_id, goal_type, target_weight_kg, notes
  ) values (
    athlete_record.id, p_goal_type, p_target_weight_kg, nullif(btrim(p_goal_notes), '')
  );

  insert into public.athlete_training_contexts (
    athlete_id,
    resistance_training_months,
    recent_training_consistency,
    preferred_session_duration_minutes,
    training_environment,
    routine_summary,
    constraints_notes,
    preferences_notes,
    average_sleep_minutes
  ) values (
    athlete_record.id,
    p_resistance_training_months,
    p_recent_training_consistency,
    p_preferred_session_duration_minutes,
    p_training_environment,
    btrim(p_routine_summary),
    nullif(btrim(p_constraints_notes), ''),
    nullif(btrim(p_preferences_notes), ''),
    p_average_sleep_minutes
  );

  insert into public.athlete_training_availability (athlete_id, weekday)
  select athlete_record.id, selected_weekday
  from (select distinct unnest(p_available_weekdays) as selected_weekday) weekdays;

  insert into public.body_weight_entries (
    athlete_id, measured_at, weight_kg, source
  ) values (
    athlete_record.id, p_weight_measured_at, p_weight_kg, 'manual'
  );

  update public.athletes
  set onboarding_completed_at = clock_timestamp()
  where id = athlete_record.id
  returning * into strict athlete_record;

  return athlete_record;
end;
$$;

create or replace function public.set_current_training_availability(
  p_available_weekdays smallint[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_athlete uuid := public.current_athlete_id();
begin
  if current_athlete is null then
    raise exception 'Athlete identity required' using errcode = 'P0002';
  end if;

  if coalesce(array_length(p_available_weekdays, 1), 0) = 0
    or exists (
      select 1 from unnest(p_available_weekdays) as selected_weekday
      where selected_weekday is null or selected_weekday not between 1 and 7
    ) then
    raise exception 'At least one valid weekday is required' using errcode = '22023';
  end if;

  delete from public.athlete_training_availability
  where athlete_id = current_athlete;

  insert into public.athlete_training_availability (athlete_id, weekday)
  select current_athlete, selected_weekday
  from (select distinct unnest(p_available_weekdays) as selected_weekday) weekdays;
end;
$$;

create or replace function public.change_current_athlete_goal(
  p_goal_type text,
  p_target_weight_kg numeric default null,
  p_notes text default null
)
returns public.athlete_goals
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_athlete uuid := public.current_athlete_id();
  goal_record public.athlete_goals;
begin
  if current_athlete is null then
    raise exception 'Athlete identity required' using errcode = 'P0002';
  end if;

  update public.athlete_goals
  set status = 'completed', ended_at = clock_timestamp()
  where athlete_id = current_athlete and status = 'active';

  insert into public.athlete_goals (
    athlete_id, goal_type, target_weight_kg, notes
  ) values (
    current_athlete, p_goal_type, p_target_weight_kg, nullif(btrim(p_notes), '')
  )
  returning * into strict goal_record;

  return goal_record;
end;
$$;

revoke all on function public.ensure_current_athlete() from public, anon;
revoke all on function public.complete_athlete_onboarding(
  text, date, numeric, text, text, integer, text, integer, text, text,
  smallint[], numeric, timestamptz, numeric, text, text, text, integer
) from public, anon;
revoke all on function public.set_current_training_availability(smallint[]) from public, anon;
revoke all on function public.change_current_athlete_goal(text, numeric, text) from public, anon;

grant execute on function public.ensure_current_athlete() to authenticated, service_role;
grant execute on function public.complete_athlete_onboarding(
  text, date, numeric, text, text, integer, text, integer, text, text,
  smallint[], numeric, timestamptz, numeric, text, text, text, integer
) to authenticated, service_role;
grant execute on function public.set_current_training_availability(smallint[]) to authenticated, service_role;
grant execute on function public.change_current_athlete_goal(text, numeric, text) to authenticated, service_role;
