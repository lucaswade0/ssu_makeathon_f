-- Server-side sanity checks for community resource submissions.
-- The Add resource form already runs these checks (src/features/resources/checks.ts); this makes the
-- database enforce them too, so a direct API call with the public key can't skip them.
-- Only community submissions are checked: official and verified rows are entered by staff and may need links.
-- NOT VALID: existing rows are left as they are; every new or edited row is checked.

alter table public.resources
  add constraint resources_community_title_quality check (
    status <> 'community_submitted' or (
      char_length(regexp_replace(title, '[^[:alpha:]]', '', 'g')) >= 3
      and regexp_replace(title, '\s', '', 'g') !~ '^(.)\1+$'
    )
  ) not valid;

alter table public.resources
  add constraint resources_community_description_quality check (
    status <> 'community_submitted' or (
      char_length(trim(description)) >= 10
      and char_length(regexp_replace(description, '[^[:alpha:]]', '', 'g')) >= 5
      and regexp_replace(description, '\s', '', 'g') !~ '^(.)\1+$'
    )
  ) not valid;

-- Links in unverified community posts are a common scam route during disasters.
alter table public.resources
  add constraint resources_community_no_links check (
    status <> 'community_submitted' or (
      title || ' ' || description !~* '(https?://|www\.|\m[a-z0-9-]+\.(com|net|org|ly|io|co|info|biz|xyz|link|app|site|me)\M)'
    )
  ) not valid;

-- Rate limit: at most 10 new community resources per account per hour.
-- shortcut: two inserts at the exact same moment can both pass the count; fine for spam protection, use a lock if it must be exact.
create or replace function public.limit_resource_submissions()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.author_id is not null and new.status = 'community_submitted' and (
    select count(*) from public.resources
    where author_id = new.author_id and status = 'community_submitted' and created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'You can add up to 10 resources per hour. Please try again later.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger resources_rate_limit
before insert on public.resources
for each row execute function public.limit_resource_submissions();
