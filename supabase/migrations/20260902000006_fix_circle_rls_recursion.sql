-- Fixes a real bug found in production: every RLS policy that checked
-- circle membership did so with a subquery directly against
-- circle_members — including circle_members' OWN select policy, which
-- queried itself. That self-reference (and the same pattern reused by
-- policies on circles/reviews/review_tags/circle_messages/circle_reads/
-- shelf_items/reading_sessions/profiles, several of which join
-- circle_members twice) caused Postgres to detect genuine infinite
-- recursion (error 42P17) the first time real circle data existed and a
-- query actually needed to evaluate it.
--
-- Fix: move every "is this user a member of this circle" check into a
-- SECURITY DEFINER function. Because the function runs as its owner, the
-- select inside its body does NOT re-trigger circle_members' RLS policy —
-- that's what breaks the cycle. This is the standard, documented fix for
-- this exact class of bug.

create or replace function public.is_circle_member(p_circle_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.circle_members
    where circle_id = p_circle_id and user_id = p_user_id
  );
$$;

create or replace function public.shares_circle_with(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.circle_members cm1
    join public.circle_members cm2 on cm1.circle_id = cm2.circle_id
    where cm1.user_id = p_user_a and cm2.user_id = p_user_b
  );
$$;

create or replace function public.can_view_reading_progress(
  p_owner uuid, p_viewer uuid, p_book_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.circle_reads cr
    join public.circle_members cm_them
      on cm_them.circle_id = cr.circle_id and cm_them.user_id = p_owner
    join public.circle_members cm_me
      on cm_me.circle_id = cr.circle_id and cm_me.user_id = p_viewer
    where cr.book_id = p_book_id
  );
$$;

-- ---------------------------------------------------------------------------
-- circles / circle_members
-- ---------------------------------------------------------------------------

drop policy "circles_select_member" on public.circles;
create policy "circles_select_member" on public.circles
  for select using (public.is_circle_member(id, auth.uid()));

drop policy "circle_members_select_fellow_member" on public.circle_members;
create policy "circle_members_select_fellow_member" on public.circle_members
  for select using (public.is_circle_member(circle_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------

drop policy "reviews_select_visible" on public.reviews;
create policy "reviews_select_visible" on public.reviews
  for select using (
    user_id = auth.uid()
    or visibility = 'public'
    or (visibility = 'circle' and public.is_circle_member(circle_id, auth.uid()))
  );

drop policy "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own" on public.reviews
  for insert with check (
    user_id = auth.uid()
    and (visibility != 'circle' or public.is_circle_member(circle_id, auth.uid()))
  );

drop policy "reviews_update_own" on public.reviews;
create policy "reviews_update_own" on public.reviews
  for update using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and (visibility != 'circle' or public.is_circle_member(circle_id, auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- review_tags
-- ---------------------------------------------------------------------------

drop policy "review_tags_select_visible" on public.review_tags;
create policy "review_tags_select_visible" on public.review_tags
  for select using (
    exists (
      select 1 from public.reviews r
      where r.id = review_tags.review_id
        and (
          r.user_id = auth.uid()
          or r.visibility = 'public'
          or (r.visibility = 'circle' and public.is_circle_member(r.circle_id, auth.uid()))
        )
    )
  );

-- ---------------------------------------------------------------------------
-- circle_messages
-- ---------------------------------------------------------------------------

drop policy "circle_messages_select_member" on public.circle_messages;
create policy "circle_messages_select_member" on public.circle_messages
  for select using (public.is_circle_member(circle_id, auth.uid()));

drop policy "circle_messages_insert_member" on public.circle_messages;
create policy "circle_messages_insert_member" on public.circle_messages
  for insert with check (
    user_id = auth.uid() and public.is_circle_member(circle_id, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- circle_reads
-- ---------------------------------------------------------------------------

drop policy "circle_reads_all_member" on public.circle_reads;
create policy "circle_reads_all_member" on public.circle_reads
  for all using (public.is_circle_member(circle_id, auth.uid()))
  with check (public.is_circle_member(circle_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

drop policy "profiles_select_circle_members" on public.profiles;
create policy "profiles_select_circle_members" on public.profiles
  for select using (public.shares_circle_with(auth.uid(), id));

-- ---------------------------------------------------------------------------
-- shelf_items / reading_sessions
-- ---------------------------------------------------------------------------

drop policy "shelf_items_select_circle_read_members" on public.shelf_items;
create policy "shelf_items_select_circle_read_members" on public.shelf_items
  for select using (public.can_view_reading_progress(user_id, auth.uid(), book_id));

drop policy "reading_sessions_select_circle_read_members" on public.reading_sessions;
create policy "reading_sessions_select_circle_read_members" on public.reading_sessions
  for select using (public.can_view_reading_progress(user_id, auth.uid(), book_id));

drop policy "shelf_items_select_circle_showcase" on public.shelf_items;
create policy "shelf_items_select_circle_showcase" on public.shelf_items
  for select using (status = 'finished' and public.shares_circle_with(auth.uid(), user_id));
