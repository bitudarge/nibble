-- Nibble — Phase 2: full database schema.
--
-- Everything Nibble needs is created up front (per CLAUDE.md Phase 2) so
-- later phases add features instead of reshaping tables that already have
-- real data in them. RLS policies live in a separate migration
-- (20260901000003_rls_policies.sql) so this file is pure structure.

-- gen_random_uuid() is built into Postgres 13+ (what Supabase runs), but
-- gen_random_bytes() (used below for join codes) needs pgcrypto explicitly.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.shelf_status as enum ('want_to_read', 'reading', 'finished');
create type public.review_visibility as enum ('private', 'public', 'circle');
create type public.circle_role as enum ('owner', 'member');
create type public.tag_type as enum ('mood', 'pace', 'spice_level', 'genre');
create type public.circle_read_status as enum ('planned', 'active', 'finished');

-- ---------------------------------------------------------------------------
-- profiles — one row per signed-in user. Private for now (not browsable).
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- books — canonical, one row per Open Library work, shared by everyone.
-- ---------------------------------------------------------------------------

create table public.books (
  id uuid primary key default gen_random_uuid(),
  open_library_id text not null unique,
  title text not null,
  author text,
  cover_url text,
  published_year int,
  page_count int,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- shelf_items — a user's relationship to a book (want-to-read/reading/finished).
-- ---------------------------------------------------------------------------

create table public.shelf_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  status public.shelf_status not null default 'want_to_read',
  current_page int,
  percent_complete numeric(5, 2),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, book_id)
);

create index shelf_items_book_id_idx on public.shelf_items (book_id);

-- ---------------------------------------------------------------------------
-- reading_sessions — progress logged over time (powers stats + streaks).
-- ---------------------------------------------------------------------------

create table public.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  pages_read int,
  from_page int,
  to_page int,
  session_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index reading_sessions_user_book_idx on public.reading_sessions (user_id, book_id);

-- ---------------------------------------------------------------------------
-- ratings — half-star ratings (0.5–5.0), one per user per book.
-- ---------------------------------------------------------------------------

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  stars numeric(2, 1) not null check (
    stars in (0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0)
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id)
);

create index ratings_user_book_idx on public.ratings (user_id, book_id);

-- ---------------------------------------------------------------------------
-- book_tags — controlled vocabulary (mood/pace/spice_level/genre). Seeded in
-- a later migration; not writable by regular users.
-- ---------------------------------------------------------------------------

create table public.book_tags (
  id uuid primary key default gen_random_uuid(),
  type public.tag_type not null,
  name text not null,
  unique (type, name)
);

-- ---------------------------------------------------------------------------
-- circles — a group of friends. join_code is the shareable invite link.
-- ---------------------------------------------------------------------------

create table public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  join_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now()
);

create index circles_owner_id_idx on public.circles (owner_id);

-- ---------------------------------------------------------------------------
-- circle_members — who's in a circle. Rows are created by triggers/functions
-- (see 20260901000002), never inserted directly by clients — see the RLS
-- migration for why.
-- ---------------------------------------------------------------------------

create table public.circle_members (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.circle_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (circle_id, user_id)
);

create index circle_members_user_id_idx on public.circle_members (user_id);

-- ---------------------------------------------------------------------------
-- reviews — the heart of the app. One row = one visibility (private/public/
-- circle); a user can have both a private journal entry AND a public review
-- of the same book, so there's deliberately no unique(user_id, book_id).
-- ---------------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  body text not null,
  contains_spoilers boolean not null default false,
  visibility public.review_visibility not null default 'private',
  circle_id uuid references public.circles (id) on delete cascade,
  -- Filled in by the Phase 6 recommender; null until then.
  sentiment_score numeric,
  extracted_themes jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_circle_visibility_check check (
    (visibility = 'circle' and circle_id is not null)
    or (visibility != 'circle' and circle_id is null)
  )
);

create index reviews_book_visibility_idx on public.reviews (book_id, visibility);
create index reviews_user_visibility_idx on public.reviews (user_id, visibility);
create index reviews_circle_id_idx on public.reviews (circle_id);

-- ---------------------------------------------------------------------------
-- review_tags — join table: which book_tags a review selected.
-- ---------------------------------------------------------------------------

create table public.review_tags (
  review_id uuid not null references public.reviews (id) on delete cascade,
  tag_id uuid not null references public.book_tags (id) on delete cascade,
  primary key (review_id, tag_id)
);

create index review_tags_tag_id_idx on public.review_tags (tag_id);

-- ---------------------------------------------------------------------------
-- reading_goals — one target per user per year.
-- ---------------------------------------------------------------------------

create table public.reading_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  year int not null,
  target_books int not null check (target_books > 0),
  created_at timestamptz not null default now(),
  unique (user_id, year)
);

-- ---------------------------------------------------------------------------
-- reading_streaks — one row per user, updated as they log activity.
-- ---------------------------------------------------------------------------

create table public.reading_streaks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_active_date date
);

-- ---------------------------------------------------------------------------
-- circle_messages — the circle discussion feed.
-- ---------------------------------------------------------------------------

create table public.circle_messages (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  book_id uuid references public.books (id) on delete set null,
  created_at timestamptz not null default now()
);

create index circle_messages_circle_id_idx on public.circle_messages (circle_id);
create index circle_messages_user_id_idx on public.circle_messages (user_id);
create index circle_messages_book_id_idx on public.circle_messages (book_id);

-- ---------------------------------------------------------------------------
-- circle_reads — a book a circle is reading together.
-- ---------------------------------------------------------------------------

create table public.circle_reads (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  started_at timestamptz,
  target_finish_date date,
  status public.circle_read_status not null default 'planned',
  created_at timestamptz not null default now()
);

create index circle_reads_circle_id_idx on public.circle_reads (circle_id);
create index circle_reads_book_id_idx on public.circle_reads (book_id);

-- ---------------------------------------------------------------------------
-- taste_profiles — one computed taste summary per user, for the recommender.
-- ---------------------------------------------------------------------------

create table public.taste_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
