-- Phase 5: circle members need to see each other's display name/avatar —
-- for the member list, the discussion feed, and reading-together progress.
-- This is a narrow, additive exception to "profiles are private" (Phase 2):
-- visible only to people who share at least one circle, never to the wider
-- app. The existing profiles_select_own policy is untouched — this just
-- adds a second way to satisfy SELECT; Postgres OR's permissive policies
-- together.

create policy "profiles_select_circle_members" on public.profiles
  for select using (
    exists (
      select 1 from public.circle_members cm1
      join public.circle_members cm2 on cm1.circle_id = cm2.circle_id
      where cm1.user_id = auth.uid() and cm2.user_id = profiles.id
    )
  );
