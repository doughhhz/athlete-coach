-- Implementation Phase 21 (ADR-0119): answers collected right before the
-- first program, and a metadata-only audit of initial program generation.

create table public.athlete_program_intakes (
  athlete_id uuid primary key,
  current_pain_or_injury boolean not null,
  pain_or_injury_notes text,
  medical_exercise_restriction boolean not null,
  preferred_exercises_notes text,
  avoided_exercises_notes text,
  other_sports_notes text,
  -- Optional equipment slugs; null = not informed (assumed by environment).
  available_equipment text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint athlete_program_intakes_athlete_id_fkey
    foreign key (athlete_id) references public.athletes (id) on delete cascade,
  constraint athlete_program_intakes_pain_notes_check
    check (
      (pain_or_injury_notes is null or char_length(pain_or_injury_notes) <= 1000)
      and (not current_pain_or_injury or char_length(btrim(coalesce(pain_or_injury_notes, ''))) > 0)
    ),
  constraint athlete_program_intakes_notes_length_check
    check (
      (preferred_exercises_notes is null or char_length(preferred_exercises_notes) <= 500)
      and (avoided_exercises_notes is null or char_length(avoided_exercises_notes) <= 500)
      and (other_sports_notes is null or char_length(other_sports_notes) <= 500)
    ),
  constraint athlete_program_intakes_equipment_check
    check (
      available_equipment is null
      or (
        cardinality(available_equipment) between 1 and 30
        and array_to_string(available_equipment, ',') ~ '^[a-z0-9]+(-[a-z0-9]+)*(,[a-z0-9]+(-[a-z0-9]+)*)*$'
      )
    )
);

create trigger athlete_program_intakes_set_updated_at
before update on public.athlete_program_intakes
for each row execute function public.set_updated_at();

alter table public.athlete_program_intakes enable row level security;
revoke all on table public.athlete_program_intakes from public, anon, authenticated;
grant select, insert, update on table public.athlete_program_intakes to authenticated;
grant all privileges on table public.athlete_program_intakes to service_role;

create policy athlete_program_intakes_select_own
on public.athlete_program_intakes for select to authenticated
using (athlete_id = (select public.current_athlete_id()));
create policy athlete_program_intakes_insert_own
on public.athlete_program_intakes for insert to authenticated
with check (athlete_id = (select public.current_athlete_id()));
create policy athlete_program_intakes_update_own
on public.athlete_program_intakes for update to authenticated
using (athlete_id = (select public.current_athlete_id()))
with check (athlete_id = (select public.current_athlete_id()));

-- Backend-owned audit: which origin, model, prompt, envelope and spec
-- produced a draft. Never the model text. Written only by the service role.
create table public.initial_program_generations (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null,
  program_id uuid not null,
  origin text not null,
  provider text,
  model text,
  prompt_version text,
  envelope_version text not null,
  spec_version text not null,
  repaired boolean not null default false,
  created_at timestamptz not null default now(),
  -- The program must belong to the same athlete.
  constraint initial_program_generations_program_owner_fkey
    foreign key (program_id, athlete_id)
    references public.training_programs (id, athlete_id) on delete cascade,
  constraint initial_program_generations_origin_check
    check (origin in ('personal', 'basic')),
  constraint initial_program_generations_provenance_check
    check (
      (origin = 'personal' and provider is not null and model is not null and prompt_version is not null)
      or (origin = 'basic' and provider is null and model is null and prompt_version is null and not repaired)
    ),
  constraint initial_program_generations_versions_check
    check (char_length(envelope_version) between 1 and 64 and char_length(spec_version) between 1 and 64),
  constraint initial_program_generations_program_key unique (program_id)
);

create index initial_program_generations_athlete_idx
on public.initial_program_generations (athlete_id, created_at desc);

alter table public.initial_program_generations enable row level security;
revoke all on table public.initial_program_generations from public, anon, authenticated;
grant select on table public.initial_program_generations to authenticated;
grant all privileges on table public.initial_program_generations to service_role;

create policy initial_program_generations_select_own
on public.initial_program_generations for select to authenticated
using (athlete_id = (select public.current_athlete_id()));
