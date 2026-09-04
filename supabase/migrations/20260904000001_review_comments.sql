-- Round 2, section 3: comments on reviews.
--
-- A comment is visible to exactly whoever can see the review it's on (the
-- same visibility rule reviews_select_visible already uses: the review's
-- author always, everyone signed in if the review is public, fellow circle
-- members if it's circle-scoped). Comments are never visible on a review
-- the commenter themselves couldn't see, enforced by re-checking that same
-- rule in the insert policy, not just the select policy, so this can't be
-- used to leak visibility of a private/circle review's existence via a
-- comment row someone could otherwise not see.
--
-- Kept intentionally simple for v1, matching CLAUDE.md's "kind and
-- non-toxic by design": plain text, no nesting, no likes, authors can
-- delete their own, no edit (delete + repost is simpler than an edit
-- history to reason about for now). Always tied to a real profile, never
-- anonymous.

create table public.review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index review_comments_review_id_idx on public.review_comments (review_id, created_at);

alter table public.review_comments enable row level security;

create policy "review_comments_select_matches_review" on public.review_comments
  for select using (
    exists (
      select 1 from public.reviews r
      where r.id = review_comments.review_id
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

create policy "review_comments_insert_own" on public.review_comments
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.reviews r
      where r.id = review_comments.review_id
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

create policy "review_comments_delete_own" on public.review_comments
  for delete using (user_id = auth.uid());
