create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  source_training_day_id uuid not null references public.training_days(id) on delete restrict,
  program_name_snapshot text not null check (char_length(btrim(program_name_snapshot)) between 1 and 120),
  day_name_snapshot text not null check (char_length(btrim(day_name_snapshot)) between 1 and 120),
  status text not null default 'in_progress' check (status in ('in_progress','completed','abandoned')),
  athlete_notes text check (athlete_notes is null or char_length(athlete_notes) <= 2000),
  started_at timestamptz not null default now(), completed_at timestamptz, abandoned_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint workout_session_lifecycle_check check (
    (status='in_progress' and completed_at is null and abandoned_at is null) or
    (status='completed' and completed_at is not null and abandoned_at is null) or
    (status='abandoned' and completed_at is null and abandoned_at is not null)
  )
);
create unique index workout_sessions_one_in_progress_per_athlete on public.workout_sessions(athlete_id) where status='in_progress';
create index workout_sessions_athlete_started_idx on public.workout_sessions(athlete_id,started_at desc);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references public.workout_sessions(id) on delete restrict,
  source_exercise_prescription_id uuid not null references public.exercise_prescriptions(id) on delete restrict,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  sequence integer not null check(sequence > 0),
  exercise_name_snapshot text not null check(char_length(btrim(exercise_name_snapshot)) between 1 and 160),
  planned_instructions text check(planned_instructions is null or char_length(planned_instructions)<=1000),
  planned_athlete_cues text check(planned_athlete_cues is null or char_length(planned_athlete_cues)<=1000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(workout_session_id,sequence), unique(workout_session_id,source_exercise_prescription_id)
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete restrict,
  source_prescription_set_id uuid not null references public.prescription_sets(id) on delete restrict,
  sequence integer not null check(sequence > 0),
  status text not null default 'pending' check(status in ('pending','completed','skipped')),
  planned_metric text not null check(planned_metric in ('reps','seconds','meters')),
  planned_target_min numeric(10,2) not null check(planned_target_min > 0),
  planned_target_max numeric(10,2) not null check(planned_target_max >= planned_target_min),
  planned_rir_min smallint, planned_rir_max smallint,
  planned_rest_min_seconds integer, planned_rest_max_seconds integer,
  planned_tempo text, planned_load_kind text not null check(planned_load_kind in ('unprescribed','athlete_selected','absolute')),
  planned_load_kg numeric(8,2),
  actual_value numeric(10,2), actual_load_kg numeric(8,2), actual_rir smallint,
  performed_at timestamptz, rest_started_at timestamptz, rest_ended_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(workout_exercise_id,sequence), unique(workout_exercise_id,source_prescription_set_id),
  constraint workout_sets_planned_rir_check check((planned_rir_min is null and planned_rir_max is null) or (planned_rir_min between 0 and 10 and planned_rir_max between planned_rir_min and 10)),
  constraint workout_sets_planned_rest_check check((planned_rest_min_seconds is null and planned_rest_max_seconds is null) or (planned_rest_min_seconds>=0 and planned_rest_max_seconds>=planned_rest_min_seconds)),
  constraint workout_sets_planned_tempo_check check(planned_tempo is null or planned_tempo ~ '^[0-9X]-[0-9X]-[0-9X]-[0-9X]$'),
  constraint workout_sets_planned_load_check check((planned_load_kind='absolute' and planned_load_kg>0) or (planned_load_kind in ('unprescribed','athlete_selected') and planned_load_kg is null)),
  constraint workout_sets_actual_check check(
    (status='pending' and actual_value is null and actual_load_kg is null and actual_rir is null and performed_at is null) or
    (status='skipped' and actual_value is null and actual_load_kg is null and actual_rir is null and performed_at is not null) or
    (status='completed' and actual_value>0 and performed_at is not null)
  ),
  constraint workout_sets_actual_metric_check check(actual_value is null or planned_metric<>'reps' or actual_value=trunc(actual_value)),
  constraint workout_sets_actual_load_check check(actual_load_kg is null or actual_load_kg>=0),
  constraint workout_sets_actual_rir_check check(actual_rir is null or actual_rir between 0 and 10),
  constraint workout_sets_rest_check check(rest_ended_at is null or (rest_started_at is not null and rest_ended_at>=rest_started_at))
);
create index workout_exercises_session_idx on public.workout_exercises(workout_session_id);
create index workout_sets_exercise_idx on public.workout_sets(workout_exercise_id);

create trigger workout_sessions_set_updated_at before update on public.workout_sessions for each row execute function public.set_updated_at();
create trigger workout_exercises_set_updated_at before update on public.workout_exercises for each row execute function public.set_updated_at();
create trigger workout_sets_set_updated_at before update on public.workout_sets for each row execute function public.set_updated_at();

create function public.guard_workout_history() returns trigger language plpgsql set search_path='' as $$
declare parent_status text;
begin
  if tg_op='DELETE' then raise exception 'Workout history cannot be deleted' using errcode='55000'; end if;
  if tg_table_name='workout_sessions' then
    if tg_op='UPDATE' and old.status<>'in_progress' then raise exception 'Terminal workout sessions are immutable' using errcode='55000'; end if;
    if tg_op='UPDATE' and old.status<>new.status and current_setting('app.workout_transition',true) is distinct from 'allowed' then raise exception 'Workout lifecycle requires its operation' using errcode='55000'; end if;
    if tg_op='UPDATE' and (old.athlete_id<>new.athlete_id or old.source_training_day_id<>new.source_training_day_id or old.started_at<>new.started_at or old.program_name_snapshot<>new.program_name_snapshot or old.day_name_snapshot<>new.day_name_snapshot) then raise exception 'Workout provenance is immutable' using errcode='55000'; end if;
  else
    if tg_table_name='workout_exercises' then
      select status into parent_status from public.workout_sessions where id=coalesce(new.workout_session_id,old.workout_session_id);
    else
      select s.status into parent_status from public.workout_sessions s join public.workout_exercises e on e.workout_session_id=s.id where e.id=coalesce(new.workout_exercise_id,old.workout_exercise_id);
    end if;
    if tg_op<>'INSERT' and parent_status<>'in_progress' then raise exception 'Terminal workout history is immutable' using errcode='55000'; end if;
    if tg_op='INSERT' and current_setting('app.workout_start',true) is distinct from 'allowed' then raise exception 'Workout children require start operation' using errcode='55000'; end if;
  end if;
  return coalesce(new,old);
end $$;
create trigger workout_sessions_history_guard before update or delete on public.workout_sessions for each row execute function public.guard_workout_history();
create trigger workout_exercises_history_guard before insert or update or delete on public.workout_exercises for each row execute function public.guard_workout_history();
create trigger workout_sets_history_guard before insert or update or delete on public.workout_sets for each row execute function public.guard_workout_history();

alter table public.workout_sessions enable row level security; alter table public.workout_exercises enable row level security; alter table public.workout_sets enable row level security;
grant select on public.workout_sessions,public.workout_exercises,public.workout_sets to authenticated;
grant all on public.workout_sessions,public.workout_exercises,public.workout_sets to service_role;
create policy workout_sessions_select_own on public.workout_sessions for select to authenticated using(athlete_id=(select public.current_athlete_id()));
create policy workout_exercises_select_own on public.workout_exercises for select to authenticated using(exists(select 1 from public.workout_sessions s where s.id=workout_session_id and s.athlete_id=(select public.current_athlete_id())));
create policy workout_sets_select_own on public.workout_sets for select to authenticated using(exists(select 1 from public.workout_exercises e join public.workout_sessions s on s.id=e.workout_session_id where e.id=workout_exercise_id and s.athlete_id=(select public.current_athlete_id())));
grant execute on function public.guard_workout_history() to service_role;

create function public.start_workout_session(p_training_day_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare athlete uuid; session_id uuid; active_id uuid; day_row record; ep record; set_row record; exercise_id uuid;
begin
  athlete:=public.current_athlete_id(); if athlete is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform pg_advisory_xact_lock(hashtextextended(athlete::text,1));
  select id into active_id from public.workout_sessions where athlete_id=athlete and status='in_progress';
  if active_id is not null then return active_id; end if;
  select d.id,d.name,p.name program_name into day_row from public.training_days d join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id join public.training_programs p on p.id=b.training_program_id where d.id=p_training_day_id and p.athlete_id=athlete and p.status='active';
  if not found then raise exception 'Active training day not found' using errcode='P0002'; end if;
  if not exists(select 1 from public.exercise_prescriptions x where x.training_day_id=p_training_day_id) or exists(select 1 from public.exercise_prescriptions x where x.training_day_id=p_training_day_id and not exists(select 1 from public.prescription_sets ps where ps.exercise_prescription_id=x.id)) then raise exception 'Training day structure is incomplete' using errcode='23514'; end if;
  insert into public.workout_sessions(athlete_id,source_training_day_id,program_name_snapshot,day_name_snapshot) values(athlete,p_training_day_id,day_row.program_name,day_row.name) returning id into session_id;
  perform set_config('app.workout_start','allowed',true);
  for ep in select x.*,e.name_pt exercise_name from public.exercise_prescriptions x join public.exercises e on e.id=x.exercise_id where x.training_day_id=p_training_day_id order by x.sequence loop
    insert into public.workout_exercises(workout_session_id,source_exercise_prescription_id,exercise_id,sequence,exercise_name_snapshot,planned_instructions,planned_athlete_cues) values(session_id,ep.id,ep.exercise_id,ep.sequence,ep.exercise_name,ep.instructions,ep.athlete_cues) returning id into exercise_id;
    for set_row in select * from public.prescription_sets where exercise_prescription_id=ep.id order by sequence loop
      insert into public.workout_sets(workout_exercise_id,source_prescription_set_id,sequence,planned_metric,planned_target_min,planned_target_max,planned_rir_min,planned_rir_max,planned_rest_min_seconds,planned_rest_max_seconds,planned_tempo,planned_load_kind,planned_load_kg) values(exercise_id,set_row.id,set_row.sequence,set_row.target_metric,set_row.target_min,set_row.target_max,set_row.rir_min,set_row.rir_max,set_row.rest_min_seconds,set_row.rest_max_seconds,set_row.tempo,set_row.load_kind,set_row.load_kg);
    end loop;
  end loop;
  perform set_config('app.workout_start','denied',true); return session_id;
end $$;

create function public.record_workout_set(p_set_id uuid,p_actual_value numeric,p_actual_load_kg numeric default null,p_actual_rir smallint default null,p_rest_started_at timestamptz default null,p_rest_ended_at timestamptz default null) returns void language plpgsql security definer set search_path='' as $$
begin
  update public.workout_sets ws set status='completed',actual_value=p_actual_value,actual_load_kg=p_actual_load_kg,actual_rir=p_actual_rir,performed_at=now(),rest_started_at=p_rest_started_at,rest_ended_at=p_rest_ended_at
  from public.workout_exercises e,public.workout_sessions s where ws.id=p_set_id and e.id=ws.workout_exercise_id and s.id=e.workout_session_id and s.athlete_id=public.current_athlete_id() and s.status='in_progress';
  if not found then raise exception 'Mutable workout set not found' using errcode='P0002'; end if;
end $$;
create function public.skip_workout_set(p_set_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
  update public.workout_sets ws set status='skipped',actual_value=null,actual_load_kg=null,actual_rir=null,performed_at=now(),rest_started_at=null,rest_ended_at=null from public.workout_exercises e,public.workout_sessions s where ws.id=p_set_id and e.id=ws.workout_exercise_id and s.id=e.workout_session_id and s.athlete_id=public.current_athlete_id() and s.status='in_progress';
  if not found then raise exception 'Mutable workout set not found' using errcode='P0002'; end if;
end $$;
create function public.complete_workout_session(p_session_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
  if exists(select 1 from public.workout_sets ws join public.workout_exercises e on e.id=ws.workout_exercise_id where e.workout_session_id=p_session_id and ws.status='pending') then raise exception 'Pending sets must be resolved' using errcode='23514'; end if;
  perform set_config('app.workout_transition','allowed',true); update public.workout_sessions set status='completed',completed_at=now() where id=p_session_id and athlete_id=public.current_athlete_id() and status='in_progress'; if not found then raise exception 'Active workout not found' using errcode='P0002'; end if; perform set_config('app.workout_transition','denied',true);
end $$;
create function public.abandon_workout_session(p_session_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin
  perform set_config('app.workout_transition','allowed',true); update public.workout_sessions set status='abandoned',abandoned_at=now() where id=p_session_id and athlete_id=public.current_athlete_id() and status='in_progress'; if not found then raise exception 'Active workout not found' using errcode='P0002'; end if; perform set_config('app.workout_transition','denied',true);
end $$;
revoke all on function public.start_workout_session(uuid),public.record_workout_set(uuid,numeric,numeric,smallint,timestamptz,timestamptz),public.skip_workout_set(uuid),public.complete_workout_session(uuid),public.abandon_workout_session(uuid) from public,anon;
grant execute on function public.start_workout_session(uuid),public.record_workout_set(uuid,numeric,numeric,smallint,timestamptz,timestamptz),public.skip_workout_set(uuid),public.complete_workout_session(uuid),public.abandon_workout_session(uuid) to authenticated,service_role;
