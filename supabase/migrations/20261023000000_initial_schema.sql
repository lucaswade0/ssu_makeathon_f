-- Wildfire Watch initial schema
-- Apply with: supabase db push

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  city text not null check (char_length(trim(city)) between 1 and 120),
  post_type text not null default 'update'
    check (post_type in ('update', 'question', 'general')),
  body text not null check (char_length(trim(body)) between 1 and 5000),
  photo_paths text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.post_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.official_alerts (
  id uuid primary key default gen_random_uuid(),
  city text not null check (char_length(trim(city)) between 1 and 120),
  title text not null check (char_length(trim(title)) between 1 and 180),
  instructions text not null check (char_length(trim(instructions)) between 1 and 10000),
  source_name text not null check (char_length(trim(source_name)) between 1 and 160),
  source_url text,
  issued_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (expires_at is null or expires_at > issued_at)
);

create table public.shelters (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 180),
  description text not null check (char_length(trim(description)) between 1 and 5000),
  location_text text not null check (char_length(trim(location_text)) between 1 and 240),
  city text not null check (char_length(trim(city)) between 1 and 120),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  status text not null default 'community_submitted'
    check (status in ('community_submitted', 'verified', 'official')),
  source text not null default 'community',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index posts_city_created_at_idx on public.posts (city, created_at desc);
create index post_replies_post_created_at_idx on public.post_replies (post_id, created_at asc);
create index official_alerts_city_issued_at_idx on public.official_alerts (city, issued_at desc);
create index shelters_city_idx on public.shelters (city);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

create trigger post_replies_set_updated_at
before update on public.post_replies
for each row execute function public.set_updated_at();

create trigger official_alerts_set_updated_at
before update on public.official_alerts
for each row execute function public.set_updated_at();

create trigger shelters_set_updated_at
before update on public.shelters
for each row execute function public.set_updated_at();

-- Create a profile when a user signs up. The client can update display_name later.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(new.email, 'resident'), '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_replies enable row level security;
alter table public.official_alerts enable row level security;
alter table public.shelters enable row level security;

create policy "Profiles are publicly readable"
on public.profiles for select
to anon, authenticated
using (true);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Posts are publicly readable"
on public.posts for select
to anon, authenticated
using (true);

create policy "Users can create their own posts"
on public.posts for insert
to authenticated
with check (auth.uid() = author_id);

create policy "Users can update their own posts"
on public.posts for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

create policy "Users can delete their own posts"
on public.posts for delete
to authenticated
using (auth.uid() = author_id);

create policy "Replies are publicly readable"
on public.post_replies for select
to anon, authenticated
using (true);

create policy "Users can create their own replies"
on public.post_replies for insert
to authenticated
with check (auth.uid() = author_id);

create policy "Users can update their own replies"
on public.post_replies for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

create policy "Users can delete their own replies"
on public.post_replies for delete
to authenticated
using (auth.uid() = author_id);

create policy "Official alerts are publicly readable"
on public.official_alerts for select
to anon, authenticated
using (true);

create policy "Shelters are publicly readable"
on public.shelters for select
to anon, authenticated
using (true);

create policy "Authenticated users can submit shelters"
on public.shelters for insert
to authenticated
with check (auth.uid() = author_id);

create policy "Users can update their own shelters"
on public.shelters for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

create policy "Users can delete their own shelters"
on public.shelters for delete
to authenticated
using (auth.uid() = author_id);
