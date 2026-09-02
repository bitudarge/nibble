-- Nibble — Phase 2: Row Level Security.
--
-- This is the security boundary described in CLAUDE.md rule #3 and #5: the
-- database enforces access, not the app. Every table gets RLS enabled, and
-- every policy below is written to be the ONLY way in — there is no
-- broader "authenticated users can do anything" fallback anywhere.
--
-- The circle isolation boundary (rule #3) gets extra attention: a user who
-- is not a member of a circle must not be able to read that circle's
-- members, messages, reviews, or reads, no matter how they query.

-- ---------------------------------------------------------------------------
-- profiles — private: only the owner can read or write their own row.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- books — shared catalog: any signed-in user can read, and can add a book
-- (needed for the Search/Discovery "create-or-fetch" flow). No update/delete
-- policy yet — nobody can edit or remove a canonical book row for now.
-- ---------------------------------------------------------------------------

alter table public.books enable row level security;

create policy "books_select_authenticated" on public.books
  for select using (auth.role() = 'authenticated');

create policy "books_insert_authenticated" on public.books
  for insert with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- shelf_items — fully private to the owning user.
-- ---------------------------------------------------------------------------

alter table public.shelf_items enable row level security;

create policy "shelf_items_all_own" on public.shelf_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- reading_sessions — fully private to the owning user.
-- ---------------------------------------------------------------------------

alter table public.reading_sessions enable row level security;

create policy "reading_sessions_all_own" on public.reading_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- ratings — readable by everyone signed in, writable only by the author.
-- ---------------------------------------------------------------------------

alter table public.ratings enable row level security;

create policy "ratings_select_authenticated" on public.ratings
  for select using (auth.role() = 'authenticated');

create policy "ratings_write_own" on public.ratings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- book_tags — readable by everyone signed in. Not writable by regular users;
-- the starter vocabulary is seeded by migration (20260901000004).
-- ---------------------------------------------------------------------------

alter table public.book_tags enable row level security;

create policy "book_tags_select_authenticated" on public.book_tags
  for select using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- circles — only members can see a circle's row. Anyone signed in can
-- create one (becoming its owner via the on_circle_created trigger).
-- ---------------------------------------------------------------------------

alter table public.circles enable row level security;

create policy "circles_select_member" on public.circles
  for select using (
    exists (
      select 1 from public.circle_members cm
      where cm.circle_id = circles.id and cm.user_id = auth.uid()
    )
  );

create policy "circles_insert_own" on public.circles
  for insert with check (owner_id = auth.uid());

create policy "circles_update_owner" on public.circles
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "circles_delete_owner" on public.circles
  for delete using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- circle_members — the core isolation table. Members can see who else is in
-- their circles. Deliberately NO insert policy: the owner's row comes from
-- the on_circle_created trigger, and Phase 5 adds a SECURITY DEFINER
-- function to validate a join_code before inserting a joiner's row — a
-- plain client-side insert would let anyone join any circle just by
-- guessing its UUID, bypassing the invite code entirely.
-- ---------------------------------------------------------------------------

alter table public.circle_members enable row level security;

create policy "circle_members_select_fellow_member" on public.circle_members
  for select using (
    exists (
      select 1 from public.circle_members cm
      where cm.circle_id = circle_members.circle_id and cm.user_id = auth.uid()
    )
  );

create policy "circle_members_delete_self" on public.circle_members
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- reviews — visibility-aware. A review is visible to: its author always;
-- everyone signed in if public; fellow circle members if circle-scoped.
-- ---------------------------------------------------------------------------

alter table public.reviews enable row level security;

create policy "reviews_select_visible" on public.reviews
  for select using (
    user_id = auth.uid()
    or visibility = 'public'
    or (
      visibility = 'circle'
      and exists (
        select 1 from public.circle_members cm
        where cm.circle_id = reviews.circle_id and cm.user_id = auth.uid()
      )
    )
  );

create policy "reviews_insert_own" on public.reviews
  for insert with check (
    user_id = auth.uid()
    and (
      visibility != 'circle'
      or exists (
        select 1 from public.circle_members cm
        where cm.circle_id = reviews.circle_id and cm.user_id = auth.uid()
      )
    )
  );

create policy "reviews_update_own" on public.reviews
  for update using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and (
      visibility != 'circle'
      or exists (
        select 1 from public.circle_members cm
        where cm.circle_id = reviews.circle_id and cm.user_id = auth.uid()
      )
    )
  );

create policy "reviews_delete_own" on public.reviews
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- review_tags — visible/writable exactly like the review they belong to.
-- ---------------------------------------------------------------------------

alter table public.review_tags enable row level security;

create policy "review_tags_select_visible" on public.review_tags
  for select using (
    exists (
      select 1 from public.reviews r
      where r.id = review_tags.review_id
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

create policy "review_tags_write_own" on public.review_tags
  for all using (
    exists (
      select 1 from public.reviews r
      where r.id = review_tags.review_id and r.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.reviews r
      where r.id = review_tags.review_id and r.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- reading_goals — fully private to the owning user.
-- ---------------------------------------------------------------------------

alter table public.reading_goals enable row level security;

create policy "reading_goals_all_own" on public.reading_goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- reading_streaks — fully private to the owning user.
-- ---------------------------------------------------------------------------

alter table public.reading_streaks enable row level security;

create policy "reading_streaks_all_own" on public.reading_streaks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- circle_messages — members only, both to read and to post.
-- ---------------------------------------------------------------------------

alter table public.circle_messages enable row level security;

create policy "circle_messages_select_member" on public.circle_messages
  for select using (
    exists (
      select 1 from public.circle_members cm
      where cm.circle_id = circle_messages.circle_id and cm.user_id = auth.uid()
    )
  );

create policy "circle_messages_insert_member" on public.circle_messages
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.circle_members cm
      where cm.circle_id = circle_messages.circle_id and cm.user_id = auth.uid()
    )
  );

create policy "circle_messages_update_own" on public.circle_messages
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "circle_messages_delete_own" on public.circle_messages
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- circle_reads — members only; any member can start/update the shared read.
-- ---------------------------------------------------------------------------

alter table public.circle_reads enable row level security;

create policy "circle_reads_all_member" on public.circle_reads
  for all using (
    exists (
      select 1 from public.circle_members cm
      where cm.circle_id = circle_reads.circle_id and cm.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.circle_members cm
      where cm.circle_id = circle_reads.circle_id and cm.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- taste_profiles — fully private to the owning user.
-- ---------------------------------------------------------------------------

alter table public.taste_profiles enable row level security;

create policy "taste_profiles_all_own" on public.taste_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
