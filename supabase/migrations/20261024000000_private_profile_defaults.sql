-- Never derive a publicly readable profile name from a private email address.
-- Existing chosen display names are preserved. Only future signups are affected.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Resident'), 80)
  );
  return new;
end;
$$;

-- Match the stable timestamp + id ordering used by chat pagination.
create index posts_city_cursor_idx on public.posts (city, created_at desc, id desc);
create index post_replies_cursor_idx on public.post_replies (post_id, created_at asc, id asc);
