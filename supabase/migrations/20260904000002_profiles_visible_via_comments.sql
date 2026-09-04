-- Bug found while verifying round 2 section 3 (comments) against the live
-- database, before it ever reached a real user: `profiles` was only ever
-- visible to the owner themselves or a fellow circle member (see
-- 20260902000002_profiles_visible_to_circle_members.sql's own comment,
-- "never to the wider app"). Comments can appear on PUBLIC reviews, which
-- are visible to every signed-in user by design (reviews_select_visible),
-- so a comment from someone outside the viewer's circles was landing with
-- its `profiles` embed silently null, real users, real RLS, real bug,
-- caught only by directly exercising the database with two real accounts,
-- never by lint/typecheck/test/build.
--
-- Fix, scoped narrowly to what's actually broken (not a general "make
-- profiles public" change): a profile becomes visible to a viewer if that
-- person has commented on some review the viewer can already see. Someone
-- who comments on a review you can see should have a real name attached to
-- that comment, this doesn't expose anything about them beyond what's
-- already visible on that comment thread.

create policy "profiles_select_via_visible_comment" on public.profiles
  for select using (
    exists (
      select 1 from public.review_comments rc
      join public.reviews r on r.id = rc.review_id
      where rc.user_id = profiles.id
      and (
        r.user_id = auth.uid()
        or r.visibility = 'public'
        or (
          r.visibility = 'circle'
          and exists (
            select 1 from public.circle_members cm
            where cm.circle_id = r.circle_id and cm.user_id = auth.uid()
          )
        )
      )
    )
  );
