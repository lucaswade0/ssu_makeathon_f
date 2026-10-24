-- Broadcast feed changes over Supabase Realtime so open feeds update without a refresh.
-- Realtime applies the existing RLS select policies (public read), so no new policy is needed.
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.post_replies;
