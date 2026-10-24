-- Resources: one table for every kind of local help (shelters, water and food, medical, charging, pets,
-- transportation). Shelters are copied in as category 'shelter'; the old shelters table is left in place.
-- Trust rules: residents can only create and keep 'community_submitted' rows. Official and verified status
-- can only be set by an admin with the service role, never from the app.

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete set null,
  category text not null
    check (category in ('shelter', 'water_food', 'medical', 'charging', 'pets', 'transportation')),
  title text not null check (char_length(trim(title)) between 1 and 180),
  description text not null check (char_length(trim(description)) between 1 and 2000),
  location_text text not null check (char_length(trim(location_text)) between 1 and 240),
  city text not null check (char_length(trim(city)) between 1 and 120),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  status text not null default 'community_submitted'
    check (status in ('community_submitted', 'verified', 'official')),
  source text not null default 'Community submission' check (char_length(trim(source)) between 1 and 160),
  last_confirmed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index resources_city_category_idx on public.resources (city, category);

create trigger resources_set_updated_at
before update on public.resources
for each row execute function public.set_updated_at();

insert into public.resources (id, author_id, category, title, description, location_text, city, latitude, longitude, status, source, last_confirmed_at, created_at, updated_at)
select id, author_id, 'shelter', name, left(description, 2000), location_text, city, latitude, longitude, status,
  case when source = 'community' then 'Community submission' else source end, updated_at, created_at, updated_at
from public.shelters;

alter table public.resources enable row level security;

create policy "Resources are publicly readable"
on public.resources for select
to anon, authenticated
using (true);

create policy "Signed-in users can submit community resources"
on public.resources for insert
to authenticated
with check (author_id = auth.uid() and status = 'community_submitted' and source = 'Community submission');

-- Only the author's still-unverified rows are editable, and they must stay unverified.
create policy "Authors can update their unverified resources"
on public.resources for update
to authenticated
using (author_id = auth.uid() and status = 'community_submitted')
with check (author_id = auth.uid() and status = 'community_submitted' and source = 'Community submission');

create policy "Authors can delete their unverified resources"
on public.resources for delete
to authenticated
using (author_id = auth.uid() and status = 'community_submitted');

-- Reports of inaccurate or unsafe resources. Residents can file one report per resource and read
-- only their own; reviewers read them with the service role.
create table public.resource_reports (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('inaccurate', 'unsafe', 'closed', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  created_at timestamptz not null default timezone('utc', now()),
  unique (resource_id, reporter_id)
);

alter table public.resource_reports enable row level security;

create policy "Signed-in users can report a resource"
on public.resource_reports for insert
to authenticated
with check (reporter_id = auth.uid());

create policy "Users can read their own reports"
on public.resource_reports for select
to authenticated
using (reporter_id = auth.uid());

alter publication supabase_realtime add table public.resources;
