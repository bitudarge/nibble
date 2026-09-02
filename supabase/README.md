# Running the Nibble database schema

These SQL files build every table Nibble needs, with Row Level Security so
users can only see their own data (and circle data if they're a member).
There's no Supabase CLI hooked up yet, so you run them by hand in the
Supabase dashboard, in order.

## Steps

1. Go to **https://supabase.com/dashboard/project/adextlgtstcbwzjjueeq/sql/new**
   (opens a new query in the SQL Editor for your Nibble project).
2. Open `supabase/migrations/20260901000001_schema.sql` in this repo, copy
   its entire contents, paste into the SQL Editor, and click **Run**.
3. Repeat for `20260901000002_functions_and_triggers.sql`.
4. Repeat for `20260901000003_rls_policies.sql`.
5. Repeat for `20260901000004_seed_book_tags.sql`.

Run them **in that exact order** — each one depends on the previous (e.g.
the RLS policies reference tables from step 2, so running them first would
fail).

## Checking it worked

After all four run without errors, go to **Table Editor** in the Supabase
dashboard sidebar. You should see all 15 tables listed (profiles, books,
shelf_items, reading_sessions, ratings, book_tags, review_tags, reviews,
reading_goals, reading_streaks, circles, circle_members, circle_messages,
circle_reads, taste_profiles). Click into `book_tags` — you should see ~33
seeded rows (mood/pace/spice_level/genre tags).

Each table should show a green "RLS enabled" badge in the Table Editor.

## If something goes wrong

If a script errors partway through, tell me the exact error message and
which file it happened in — since these are all `create table`/`create
policy` statements (not `create or replace`), re-running a script that
partially succeeded will error on "already exists" for the parts that did
work. I can write a quick cleanup script rather than you needing to
figure out the SQL yourself.
