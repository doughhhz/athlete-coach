create table public.training_programs (
  id uuid primary key default gen_random_uuid(), athlete_id uuid not null references public.athletes(id) on delete cascade,
  athlete_goal_id uuid, name text not null check (char_length(btrim(name)) between 1 and 120), description text check (description is null or char_length(description) <= 2000),
  status text not null default 'draft' check (status in ('draft','active','completed','archived')), revision integer not null default 1 check (revision > 0),
  supersedes_program_id uuid references public.training_programs(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), activated_at timestamptz, completed_at timestamptz, archived_at timestamptz,
  constraint training_program_lifecycle_check check (
    (status='draft' and activated_at is null and completed_at is null and archived_at is null) or
    (status='active' and activated_at is not null and completed_at is null and archived_at is null) or
    (status='completed' and activated_at is not null and completed_at is not null and archived_at is null) or
    (status='archived' and archived_at is not null)
  ), unique(id, athlete_id), unique(supersedes_program_id)
);
alter table public.athlete_goals add constraint athlete_goals_id_athlete_key unique (id, athlete_id);
alter table public.training_programs add constraint training_program_goal_owner_fk foreign key (athlete_goal_id, athlete_id) references public.athlete_goals(id, athlete_id) on delete restrict;
create unique index training_programs_one_active_per_athlete on public.training_programs(athlete_id) where status='active';
create index training_programs_athlete_status_idx on public.training_programs(athlete_id,status,created_at desc);

create table public.training_blocks (id uuid primary key default gen_random_uuid(), training_program_id uuid not null references public.training_programs(id) on delete cascade, sequence integer not null check(sequence>0), name text not null check(char_length(btrim(name)) between 1 and 120), description text check(description is null or char_length(description)<=1000), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(training_program_id,sequence));
create table public.training_weeks (id uuid primary key default gen_random_uuid(), training_block_id uuid not null references public.training_blocks(id) on delete cascade, sequence integer not null check(sequence>0), name text check(name is null or char_length(name)<=120), notes text check(notes is null or char_length(notes)<=1000), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(training_block_id,sequence));
create table public.training_days (id uuid primary key default gen_random_uuid(), training_week_id uuid not null references public.training_weeks(id) on delete cascade, sequence integer not null check(sequence>0), name text not null check(char_length(btrim(name)) between 1 and 120), preferred_weekday smallint check(preferred_weekday between 1 and 7), notes text check(notes is null or char_length(notes)<=1000), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(training_week_id,sequence));
create table public.exercise_prescriptions (id uuid primary key default gen_random_uuid(), training_day_id uuid not null references public.training_days(id) on delete cascade, exercise_id uuid not null references public.exercises(id) on delete restrict, sequence integer not null check(sequence>0), instructions text check(instructions is null or char_length(instructions)<=1000), athlete_cues text check(athlete_cues is null or char_length(athlete_cues)<=1000), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(training_day_id,sequence));
create table public.prescription_sets (
  id uuid primary key default gen_random_uuid(), exercise_prescription_id uuid not null references public.exercise_prescriptions(id) on delete cascade, sequence integer not null check(sequence>0),
  target_metric text not null check(target_metric in ('reps','seconds','meters')), target_min numeric(10,2) not null check(target_min>0), target_max numeric(10,2) not null check(target_max>=target_min),
  rir_min smallint, rir_max smallint, rest_min_seconds integer, rest_max_seconds integer, tempo text, load_kind text not null default 'unprescribed' check(load_kind in ('unprescribed','athlete_selected','absolute')), load_kg numeric(8,2),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(exercise_prescription_id,sequence),
  constraint prescription_sets_rir_check check((rir_min is null and rir_max is null) or (rir_min between 0 and 10 and rir_max between rir_min and 10)),
  constraint prescription_sets_rest_check check((rest_min_seconds is null and rest_max_seconds is null) or (rest_min_seconds>=0 and rest_max_seconds>=rest_min_seconds)),
  constraint prescription_sets_tempo_check check(tempo is null or tempo ~ '^[0-9X]-[0-9X]-[0-9X]-[0-9X]$'),
  constraint prescription_sets_load_check check((load_kind='absolute' and load_kg>0) or (load_kind in ('unprescribed','athlete_selected') and load_kg is null))
);
create index training_blocks_program_idx on public.training_blocks(training_program_id);
create index training_weeks_block_idx on public.training_weeks(training_block_id);
create index training_days_week_idx on public.training_days(training_week_id);
create index exercise_prescriptions_day_idx on public.exercise_prescriptions(training_day_id);
create index exercise_prescriptions_exercise_idx on public.exercise_prescriptions(exercise_id);
create index prescription_sets_prescription_idx on public.prescription_sets(exercise_prescription_id);

create trigger training_programs_set_updated_at before update on public.training_programs for each row execute function public.set_updated_at();
create trigger training_blocks_set_updated_at before update on public.training_blocks for each row execute function public.set_updated_at();
create trigger training_weeks_set_updated_at before update on public.training_weeks for each row execute function public.set_updated_at();
create trigger training_days_set_updated_at before update on public.training_days for each row execute function public.set_updated_at();
create trigger exercise_prescriptions_set_updated_at before update on public.exercise_prescriptions for each row execute function public.set_updated_at();
create trigger prescription_sets_set_updated_at before update on public.prescription_sets for each row execute function public.set_updated_at();

create function public.guard_training_program_history() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.status<>'draft' then raise exception 'Programs must be created as drafts' using errcode='55000'; end if; return new;
  end if;
  if tg_op='DELETE' then
    if old.status<>'draft' then raise exception 'Only draft programs can be deleted' using errcode='55000'; end if; return old;
  end if;
  if old.athlete_id<>new.athlete_id or old.revision<>new.revision or old.supersedes_program_id is distinct from new.supersedes_program_id then raise exception 'Program identity and lineage are immutable' using errcode='55000'; end if;
  if old.status<>'draft' and (old.name<>new.name or old.description is distinct from new.description or old.athlete_goal_id is distinct from new.athlete_goal_id) then raise exception 'Activated program metadata is immutable' using errcode='55000'; end if;
  if old.status<>new.status and current_setting('app.training_program_transition',true) is distinct from 'allowed' then raise exception 'Lifecycle transitions require the transactional operation' using errcode='55000'; end if;
  return new;
end $$;
create trigger training_programs_history_guard before insert or update or delete on public.training_programs for each row execute function public.guard_training_program_history();

create function public.assert_program_structure_mutable() returns trigger language plpgsql set search_path='' as $$
declare program_status text;
begin
  if tg_table_name='training_blocks' then select status into program_status from public.training_programs where id=coalesce(new.training_program_id,old.training_program_id);
  elsif tg_table_name='training_weeks' then select p.status into program_status from public.training_programs p join public.training_blocks b on b.training_program_id=p.id where b.id=coalesce(new.training_block_id,old.training_block_id);
  elsif tg_table_name='training_days' then select p.status into program_status from public.training_programs p join public.training_blocks b on b.training_program_id=p.id join public.training_weeks w on w.training_block_id=b.id where w.id=coalesce(new.training_week_id,old.training_week_id);
  elsif tg_table_name='exercise_prescriptions' then select p.status into program_status from public.training_programs p join public.training_blocks b on b.training_program_id=p.id join public.training_weeks w on w.training_block_id=b.id join public.training_days d on d.training_week_id=w.id where d.id=coalesce(new.training_day_id,old.training_day_id);
  else select p.status into program_status from public.training_programs p join public.training_blocks b on b.training_program_id=p.id join public.training_weeks w on w.training_block_id=b.id join public.training_days d on d.training_week_id=w.id join public.exercise_prescriptions ep on ep.training_day_id=d.id where ep.id=coalesce(new.exercise_prescription_id,old.exercise_prescription_id); end if;
  if program_status is distinct from 'draft' then raise exception 'Only draft program structure can be changed' using errcode='55000'; end if;
  return coalesce(new,old);
end $$;
create trigger training_blocks_mutable before insert or update or delete on public.training_blocks for each row execute function public.assert_program_structure_mutable();
create trigger training_weeks_mutable before insert or update or delete on public.training_weeks for each row execute function public.assert_program_structure_mutable();
create trigger training_days_mutable before insert or update or delete on public.training_days for each row execute function public.assert_program_structure_mutable();
create trigger exercise_prescriptions_mutable before insert or update or delete on public.exercise_prescriptions for each row execute function public.assert_program_structure_mutable();
create trigger prescription_sets_mutable before insert or update or delete on public.prescription_sets for each row execute function public.assert_program_structure_mutable();

alter table public.training_programs enable row level security; alter table public.training_blocks enable row level security; alter table public.training_weeks enable row level security; alter table public.training_days enable row level security; alter table public.exercise_prescriptions enable row level security; alter table public.prescription_sets enable row level security;
grant select,insert,update,delete on public.training_programs,public.training_blocks,public.training_weeks,public.training_days,public.exercise_prescriptions,public.prescription_sets to authenticated;
grant all on public.training_programs,public.training_blocks,public.training_weeks,public.training_days,public.exercise_prescriptions,public.prescription_sets to service_role;
create policy training_programs_own on public.training_programs for all to authenticated using(athlete_id=(select public.current_athlete_id())) with check(athlete_id=(select public.current_athlete_id()));
create policy training_blocks_own on public.training_blocks for all to authenticated using(exists(select 1 from public.training_programs p where p.id=training_program_id and p.athlete_id=(select public.current_athlete_id()))) with check(exists(select 1 from public.training_programs p where p.id=training_program_id and p.athlete_id=(select public.current_athlete_id())));
create policy training_weeks_own on public.training_weeks for all to authenticated using(exists(select 1 from public.training_blocks b join public.training_programs p on p.id=b.training_program_id where b.id=training_block_id and p.athlete_id=(select public.current_athlete_id()))) with check(exists(select 1 from public.training_blocks b join public.training_programs p on p.id=b.training_program_id where b.id=training_block_id and p.athlete_id=(select public.current_athlete_id())));
create policy training_days_own on public.training_days for all to authenticated using(exists(select 1 from public.training_weeks w join public.training_blocks b on b.id=w.training_block_id join public.training_programs p on p.id=b.training_program_id where w.id=training_week_id and p.athlete_id=(select public.current_athlete_id()))) with check(exists(select 1 from public.training_weeks w join public.training_blocks b on b.id=w.training_block_id join public.training_programs p on p.id=b.training_program_id where w.id=training_week_id and p.athlete_id=(select public.current_athlete_id())));
create policy exercise_prescriptions_own on public.exercise_prescriptions for all to authenticated using(exists(select 1 from public.training_days d join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id join public.training_programs p on p.id=b.training_program_id where d.id=training_day_id and p.athlete_id=(select public.current_athlete_id()))) with check(exists(select 1 from public.training_days d join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id join public.training_programs p on p.id=b.training_program_id where d.id=training_day_id and p.athlete_id=(select public.current_athlete_id())));
create policy prescription_sets_own on public.prescription_sets for all to authenticated using(exists(select 1 from public.exercise_prescriptions ep join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id join public.training_programs p on p.id=b.training_program_id where ep.id=exercise_prescription_id and p.athlete_id=(select public.current_athlete_id()))) with check(exists(select 1 from public.exercise_prescriptions ep join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id join public.training_programs p on p.id=b.training_program_id where ep.id=exercise_prescription_id and p.athlete_id=(select public.current_athlete_id())));

create function public.activate_training_program(p_program_id uuid) returns public.training_programs language plpgsql security invoker set search_path='' as $$ declare result public.training_programs; begin
  perform pg_advisory_xact_lock(hashtextextended(public.current_athlete_id()::text,0));
  if not exists(select 1 from public.training_programs where id=p_program_id and athlete_id=public.current_athlete_id() and status='draft') then raise exception 'Draft program not found' using errcode='P0002'; end if;
  if not exists(select 1 from public.training_blocks b join public.training_weeks w on w.training_block_id=b.id join public.training_days d on d.training_week_id=w.id join public.exercise_prescriptions ep on ep.training_day_id=d.id where b.training_program_id=p_program_id and exists(select 1 from public.prescription_sets ps where ps.exercise_prescription_id=ep.id)) or exists(select 1 from public.exercise_prescriptions ep join public.training_days d on d.id=ep.training_day_id join public.training_weeks w on w.id=d.training_week_id join public.training_blocks b on b.id=w.training_block_id where b.training_program_id=p_program_id and not exists(select 1 from public.prescription_sets ps where ps.exercise_prescription_id=ep.id)) then raise exception 'Program structure is incomplete' using errcode='23514'; end if;
  perform set_config('app.training_program_transition','allowed',true);
  update public.training_programs set status='completed',completed_at=now() where athlete_id=public.current_athlete_id() and status='active';
  update public.training_programs set status='active',activated_at=now() where id=p_program_id returning * into result; perform set_config('app.training_program_transition','denied',true); return result;
end $$;
create function public.replace_training_program_structure(p_program_id uuid,p_structure jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare block jsonb; week jsonb; day_item jsonb; prescription jsonb; set_item jsonb; block_id uuid; week_id uuid; day_id uuid; prescription_id uuid;
begin
  if not exists(select 1 from public.training_programs where id=p_program_id and athlete_id=public.current_athlete_id() and status='draft' for update) then raise exception 'Editable draft not found' using errcode='P0002'; end if;
  if jsonb_typeof(p_structure->'blocks') is distinct from 'array' or jsonb_array_length(p_structure->'blocks')=0 then raise exception 'At least one block is required' using errcode='22023'; end if;
  delete from public.training_blocks where training_program_id=p_program_id;
  for block in select value from jsonb_array_elements(p_structure->'blocks') loop
    insert into public.training_blocks(training_program_id,sequence,name,description) values(p_program_id,(block->>'sequence')::integer,block->>'name',block->>'description') returning id into block_id;
    for week in select value from jsonb_array_elements(block->'weeks') loop
      insert into public.training_weeks(training_block_id,sequence,name,notes) values(block_id,(week->>'sequence')::integer,week->>'name',week->>'notes') returning id into week_id;
      for day_item in select value from jsonb_array_elements(week->'days') loop
        insert into public.training_days(training_week_id,sequence,name,preferred_weekday,notes) values(week_id,(day_item->>'sequence')::integer,day_item->>'name',nullif(day_item->>'preferredWeekday','')::smallint,day_item->>'notes') returning id into day_id;
        for prescription in select value from jsonb_array_elements(day_item->'prescriptions') loop
          insert into public.exercise_prescriptions(training_day_id,exercise_id,sequence,instructions,athlete_cues) values(day_id,(prescription->>'exerciseId')::uuid,(prescription->>'sequence')::integer,prescription->>'instructions',prescription->>'athleteCues') returning id into prescription_id;
          for set_item in select value from jsonb_array_elements(prescription->'sets') loop
            insert into public.prescription_sets(exercise_prescription_id,sequence,target_metric,target_min,target_max,rir_min,rir_max,rest_min_seconds,rest_max_seconds,tempo,load_kind,load_kg) values(prescription_id,(set_item->>'sequence')::integer,set_item->>'targetMetric',(set_item->>'targetMin')::numeric,(set_item->>'targetMax')::numeric,nullif(set_item->>'rirMin','')::smallint,nullif(set_item->>'rirMax','')::smallint,nullif(set_item->>'restMinSeconds','')::integer,nullif(set_item->>'restMaxSeconds','')::integer,set_item->>'tempo',set_item->>'loadKind',nullif(set_item->>'loadKg','')::numeric);
          end loop;
        end loop;
      end loop;
    end loop;
  end loop;
end $$;
create function public.transition_training_program(p_program_id uuid,p_status text) returns public.training_programs language plpgsql security invoker set search_path='' as $$ declare result public.training_programs; begin
  perform set_config('app.training_program_transition','allowed',true);
  if p_status='completed' then update public.training_programs set status='completed',completed_at=now() where id=p_program_id and athlete_id=public.current_athlete_id() and status='active' returning * into result;
  elsif p_status='archived' then update public.training_programs set status='archived',archived_at=now() where id=p_program_id and athlete_id=public.current_athlete_id() and status in ('draft','active','completed') returning * into result;
  else raise exception 'Invalid transition' using errcode='22023'; end if; if result.id is null then raise exception 'Invalid transition' using errcode='55000'; end if; perform set_config('app.training_program_transition','denied',true); return result;
end $$;

create function public.clone_training_program_as_draft(p_program_id uuid) returns public.training_programs language plpgsql security invoker set search_path='' as $$
declare source public.training_programs; result public.training_programs; b record; w record; d record; ep record; new_b uuid; new_w uuid; new_d uuid; new_ep uuid;
begin select * into source from public.training_programs where id=p_program_id and athlete_id=public.current_athlete_id() and status in ('active','completed','archived'); if source.id is null then raise exception 'Program not found or not revisionable' using errcode='P0002'; end if;
  insert into public.training_programs(athlete_id,athlete_goal_id,name,description,revision,supersedes_program_id) values(source.athlete_id,source.athlete_goal_id,source.name||' — revisão',source.description,source.revision+1,source.id) returning * into result;
  for b in select * from public.training_blocks where training_program_id=source.id order by sequence loop insert into public.training_blocks(training_program_id,sequence,name,description) values(result.id,b.sequence,b.name,b.description) returning id into new_b;
    for w in select * from public.training_weeks where training_block_id=b.id order by sequence loop insert into public.training_weeks(training_block_id,sequence,name,notes) values(new_b,w.sequence,w.name,w.notes) returning id into new_w;
      for d in select * from public.training_days where training_week_id=w.id order by sequence loop insert into public.training_days(training_week_id,sequence,name,preferred_weekday,notes) values(new_w,d.sequence,d.name,d.preferred_weekday,d.notes) returning id into new_d;
        for ep in select * from public.exercise_prescriptions where training_day_id=d.id order by sequence loop insert into public.exercise_prescriptions(training_day_id,exercise_id,sequence,instructions,athlete_cues) values(new_d,ep.exercise_id,ep.sequence,ep.instructions,ep.athlete_cues) returning id into new_ep;
          insert into public.prescription_sets(exercise_prescription_id,sequence,target_metric,target_min,target_max,rir_min,rir_max,rest_min_seconds,rest_max_seconds,tempo,load_kind,load_kg) select new_ep,sequence,target_metric,target_min,target_max,rir_min,rir_max,rest_min_seconds,rest_max_seconds,tempo,load_kind,load_kg from public.prescription_sets where exercise_prescription_id=ep.id order by sequence;
        end loop; end loop; end loop; end loop; return result;
end $$;
revoke all on function public.activate_training_program(uuid), public.replace_training_program_structure(uuid,jsonb), public.transition_training_program(uuid,text), public.clone_training_program_as_draft(uuid) from public,anon;
grant execute on function public.activate_training_program(uuid), public.replace_training_program_structure(uuid,jsonb), public.transition_training_program(uuid,text), public.clone_training_program_as_draft(uuid) to authenticated,service_role;
