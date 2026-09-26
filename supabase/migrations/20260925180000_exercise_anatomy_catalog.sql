create extension if not exists unaccent with schema extensions;

create or replace function public.catalog_search_text(value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select lower(translate(value,
    'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿ',
    'AAAAAACEEEEIIIINOOOOOUUUUYaaaaaaceeeeiiiinooooouuuuyy'))
$$;

revoke all on function public.catalog_search_text(text) from public, anon;
grant execute on function public.catalog_search_text(text) to authenticated, service_role;

create table public.body_regions (
  id uuid primary key,
  slug text not null,
  name_en text not null,
  name_pt text not null,
  constraint body_regions_slug_key unique (slug),
  constraint body_regions_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint body_regions_names_check check (btrim(name_en) <> '' and btrim(name_pt) <> '')
);

create table public.muscle_groups (
  id uuid primary key,
  body_region_id uuid not null,
  slug text not null,
  name_en text not null,
  name_pt text not null,
  description text,
  constraint muscle_groups_body_region_id_fkey foreign key (body_region_id)
    references public.body_regions (id) on delete restrict,
  constraint muscle_groups_slug_key unique (slug),
  constraint muscle_groups_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint muscle_groups_names_check check (btrim(name_en) <> '' and btrim(name_pt) <> ''),
  constraint muscle_groups_description_check check (description is null or char_length(description) <= 500)
);

create index muscle_groups_body_region_idx on public.muscle_groups (body_region_id);

create table public.muscles (
  id uuid primary key,
  muscle_group_id uuid not null,
  slug text not null,
  name_en text not null,
  name_pt text not null,
  anatomical_name text,
  description text,
  constraint muscles_muscle_group_id_fkey foreign key (muscle_group_id)
    references public.muscle_groups (id) on delete restrict,
  constraint muscles_slug_key unique (slug),
  constraint muscles_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint muscles_names_check check (btrim(name_en) <> '' and btrim(name_pt) <> ''),
  constraint muscles_anatomical_name_check check (anatomical_name is null or btrim(anatomical_name) <> ''),
  constraint muscles_description_check check (description is null or char_length(description) <= 500)
);

create index muscles_muscle_group_idx on public.muscles (muscle_group_id);

create table public.equipment (
  id uuid primary key,
  slug text not null,
  name_en text not null,
  name_pt text not null,
  constraint equipment_slug_key unique (slug),
  constraint equipment_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint equipment_names_check check (btrim(name_en) <> '' and btrim(name_pt) <> '')
);

create table public.exercises (
  id uuid primary key,
  slug text not null,
  name_pt text not null,
  name_en text not null,
  short_description_pt text not null,
  movement_pattern text not null,
  mechanics text not null,
  laterality text not null,
  difficulty text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercises_slug_key unique (slug),
  constraint exercises_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint exercises_names_check check (btrim(name_pt) <> '' and btrim(name_en) <> ''),
  constraint exercises_description_check check (char_length(btrim(short_description_pt)) between 1 and 1000),
  constraint exercises_movement_pattern_check check (movement_pattern in (
    'horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull',
    'squat', 'hinge', 'lunge', 'knee_flexion', 'knee_extension',
    'elbow_flexion', 'elbow_extension', 'shoulder_abduction', 'shoulder_flexion',
    'calf_raise', 'hip_abduction', 'hip_adduction', 'trunk_flexion',
    'trunk_extension', 'anti_extension', 'anti_rotation', 'carry', 'other'
  )),
  constraint exercises_mechanics_check check (mechanics in ('compound', 'isolation')),
  constraint exercises_laterality_check check (laterality in ('bilateral', 'unilateral', 'alternating')),
  constraint exercises_difficulty_check check (difficulty is null or difficulty in ('beginner', 'intermediate', 'advanced'))
);

create index exercises_active_name_pt_idx on public.exercises (is_active, name_pt);
create index exercises_movement_pattern_idx on public.exercises (movement_pattern) where is_active;

create trigger exercises_set_updated_at before update on public.exercises
for each row execute function public.set_updated_at();

create table public.exercise_aliases (
  id uuid primary key,
  exercise_id uuid not null,
  language text not null,
  alias text not null,
  normalized_alias text generated always as (public.catalog_search_text(alias)) stored,
  constraint exercise_aliases_exercise_id_fkey foreign key (exercise_id)
    references public.exercises (id) on delete cascade,
  constraint exercise_aliases_language_check check (language in ('pt', 'en')),
  constraint exercise_aliases_alias_check check (btrim(alias) <> '' and char_length(alias) <= 160),
  constraint exercise_aliases_exercise_language_normalized_key unique (exercise_id, language, normalized_alias)
);

create index exercise_aliases_search_idx on public.exercise_aliases (normalized_alias);

create table public.exercise_muscles (
  exercise_id uuid not null,
  muscle_id uuid not null,
  role text not null,
  sort_order smallint not null default 0,
  primary key (exercise_id, muscle_id, role),
  constraint exercise_muscles_exercise_id_fkey foreign key (exercise_id)
    references public.exercises (id) on delete cascade,
  constraint exercise_muscles_muscle_id_fkey foreign key (muscle_id)
    references public.muscles (id) on delete restrict,
  constraint exercise_muscles_role_check check (role in ('primary', 'secondary', 'stabilizer')),
  constraint exercise_muscles_sort_order_check check (sort_order between 0 and 100)
);

create index exercise_muscles_muscle_role_idx on public.exercise_muscles (muscle_id, role, exercise_id);

create table public.exercise_equipment (
  exercise_id uuid not null,
  equipment_id uuid not null,
  is_primary boolean not null default false,
  primary key (exercise_id, equipment_id),
  constraint exercise_equipment_exercise_id_fkey foreign key (exercise_id)
    references public.exercises (id) on delete cascade,
  constraint exercise_equipment_equipment_id_fkey foreign key (equipment_id)
    references public.equipment (id) on delete restrict
);

create index exercise_equipment_equipment_idx on public.exercise_equipment (equipment_id, exercise_id);
create unique index exercise_equipment_one_primary_idx on public.exercise_equipment (exercise_id) where is_primary;

create table public.exercise_instruction_steps (
  id uuid primary key,
  exercise_id uuid not null,
  section text not null,
  sort_order smallint not null,
  content_pt text not null,
  constraint exercise_instruction_steps_exercise_id_fkey foreign key (exercise_id)
    references public.exercises (id) on delete cascade,
  constraint exercise_instruction_steps_section_check check (section in (
    'setup', 'execution', 'breathing_cue', 'common_mistake', 'safety_note'
  )),
  constraint exercise_instruction_steps_order_check check (sort_order between 1 and 100),
  constraint exercise_instruction_steps_content_check check (char_length(btrim(content_pt)) between 1 and 1000),
  constraint exercise_instruction_steps_order_key unique (exercise_id, section, sort_order)
);

create index exercise_instruction_steps_exercise_idx on public.exercise_instruction_steps (exercise_id, section, sort_order);

create table public.exercise_relations (
  source_exercise_id uuid not null,
  target_exercise_id uuid not null,
  relation_type text not null,
  note_pt text,
  primary key (source_exercise_id, target_exercise_id, relation_type),
  constraint exercise_relations_source_id_fkey foreign key (source_exercise_id)
    references public.exercises (id) on delete cascade,
  constraint exercise_relations_target_id_fkey foreign key (target_exercise_id)
    references public.exercises (id) on delete cascade,
  constraint exercise_relations_type_check check (relation_type in (
    'variation_of', 'similar_pattern', 'similar_target', 'equipment_alternative',
    'regression', 'progression'
  )),
  constraint exercise_relations_not_self_check check (source_exercise_id <> target_exercise_id),
  constraint exercise_relations_note_check check (note_pt is null or char_length(note_pt) <= 500)
);

create index exercise_relations_target_idx on public.exercise_relations (target_exercise_id, relation_type);

create table public.exercise_media (
  id uuid primary key,
  exercise_id uuid not null,
  media_type text not null,
  source_type text not null,
  provider text,
  external_asset_id text,
  source_url text,
  storage_path text,
  angle_view text,
  is_primary boolean not null default false,
  license text,
  attribution text,
  usage_policy text,
  cache_policy text,
  created_at timestamptz not null default now(),
  constraint exercise_media_exercise_id_fkey foreign key (exercise_id)
    references public.exercises (id) on delete cascade,
  constraint exercise_media_type_check check (media_type in ('image', 'video', 'animation')),
  constraint exercise_media_source_type_check check (source_type in ('owned', 'licensed_external', 'provider_stream')),
  constraint exercise_media_location_check check (
    (source_type = 'owned' and storage_path is not null and provider is null and external_asset_id is null)
    or (source_type = 'licensed_external' and source_url is not null and license is not null)
    or (source_type = 'provider_stream' and provider is not null and external_asset_id is not null)
  ),
  constraint exercise_media_provider_check check (provider is null or btrim(provider) <> ''),
  constraint exercise_media_external_asset_check check (external_asset_id is null or btrim(external_asset_id) <> '')
);

create unique index exercise_media_one_primary_idx on public.exercise_media (exercise_id) where is_primary;
create unique index exercise_media_provider_asset_idx on public.exercise_media (provider, external_asset_id)
where provider is not null and external_asset_id is not null;

create table public.exercise_external_mappings (
  id uuid primary key,
  exercise_id uuid not null,
  provider text not null,
  external_exercise_id text not null,
  created_at timestamptz not null default now(),
  constraint exercise_external_mappings_exercise_id_fkey foreign key (exercise_id)
    references public.exercises (id) on delete cascade,
  constraint exercise_external_mappings_provider_check check (btrim(provider) <> ''),
  constraint exercise_external_mappings_external_id_check check (btrim(external_exercise_id) <> ''),
  constraint exercise_external_mappings_provider_key unique (provider, external_exercise_id)
);

create index exercise_external_mappings_exercise_idx on public.exercise_external_mappings (exercise_id);

create or replace function public.search_exercise_catalog(
  p_query text default null,
  p_muscle_group_slug text default null,
  p_muscle_slug text default null,
  p_equipment_slug text default null,
  p_movement_pattern text default null
)
returns table (
  id uuid,
  slug text,
  name_pt text,
  name_en text,
  short_description_pt text,
  movement_pattern text,
  mechanics text,
  laterality text,
  difficulty text,
  primary_muscles text[],
  primary_muscle_groups text[],
  equipment text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    e.id, e.slug, e.name_pt, e.name_en, e.short_description_pt,
    e.movement_pattern, e.mechanics, e.laterality, e.difficulty,
    coalesce((select array_agg(m.name_pt order by em.sort_order, m.name_pt)
      from public.exercise_muscles em join public.muscles m on m.id = em.muscle_id
      where em.exercise_id = e.id and em.role = 'primary'), '{}'::text[]),
    coalesce((select array_agg(distinct mg.name_pt order by mg.name_pt)
      from public.exercise_muscles em join public.muscles m on m.id = em.muscle_id
      join public.muscle_groups mg on mg.id = m.muscle_group_id
      where em.exercise_id = e.id and em.role = 'primary'), '{}'::text[]),
    coalesce((select array_agg(eq.name_pt order by ee.is_primary desc, eq.name_pt)
      from public.exercise_equipment ee join public.equipment eq on eq.id = ee.equipment_id
      where ee.exercise_id = e.id), '{}'::text[])
  from public.exercises e
  where e.is_active
    and (nullif(btrim(p_query), '') is null or public.catalog_search_text(e.name_pt) like '%' || public.catalog_search_text(btrim(p_query)) || '%'
      or public.catalog_search_text(e.name_en) like '%' || public.catalog_search_text(btrim(p_query)) || '%'
      or exists (select 1 from public.exercise_aliases a where a.exercise_id = e.id
        and a.normalized_alias like '%' || public.catalog_search_text(btrim(p_query)) || '%'))
    and (p_muscle_group_slug is null or exists (
      select 1 from public.exercise_muscles em join public.muscles m on m.id = em.muscle_id
      join public.muscle_groups mg on mg.id = m.muscle_group_id
      where em.exercise_id = e.id and mg.slug = p_muscle_group_slug))
    and (p_muscle_slug is null or exists (
      select 1 from public.exercise_muscles em join public.muscles m on m.id = em.muscle_id
      where em.exercise_id = e.id and m.slug = p_muscle_slug))
    and (p_equipment_slug is null or exists (
      select 1 from public.exercise_equipment ee join public.equipment eq on eq.id = ee.equipment_id
      where ee.exercise_id = e.id and eq.slug = p_equipment_slug))
    and (p_movement_pattern is null or e.movement_pattern = p_movement_pattern)
  order by e.name_pt
$$;

comment on function public.search_exercise_catalog(text, text, text, text, text) is
  'Case- and accent-insensitive factual catalog search. Filters are descriptive and never prescriptions.';

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'body_regions', 'muscle_groups', 'muscles', 'equipment', 'exercises',
    'exercise_aliases', 'exercise_muscles', 'exercise_equipment',
    'exercise_instruction_steps', 'exercise_relations', 'exercise_media',
    'exercise_external_mappings'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select on table public.%I to authenticated', table_name);
    execute format('grant all privileges on table public.%I to service_role', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (true)', table_name || '_authenticated_read', table_name);
  end loop;
end
$$;

revoke all on function public.search_exercise_catalog(text, text, text, text, text) from public, anon;
grant execute on function public.search_exercise_catalog(text, text, text, text, text) to authenticated, service_role;
