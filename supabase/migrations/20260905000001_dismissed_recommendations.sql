-- "Not for me" on a recommendation (round 4 visual-fidelity pass): a real,
-- persisted per-user dismissal, unlike the mockup's own version which only
-- ever lived in in-memory session state (state.dismissed, wiped on every
-- reload). Excluded from future getRecommendations calls for that user,
-- forever, same idea as shelving a book already excludes it.

create table public.dismissed_recommendations (
  user_id uuid not null references public.profiles (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

alter table public.dismissed_recommendations enable row level security;

create policy "dismissed_recommendations_all_own" on public.dismissed_recommendations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
