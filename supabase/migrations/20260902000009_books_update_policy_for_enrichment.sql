-- Section 3 of the refinement phase (Google Books enrichment) added an
-- UPDATE call on `books` (src/lib/books/data.ts's enrichBook) to fill in
-- synopsis/genre/page count/cover once per book. There was never an
-- UPDATE policy on `books` (only select + insert, see
-- 20260901000003_rls_policies.sql), so every enrichment write was being
-- silently blocked by RLS: the request succeeds at the network level but
-- RLS matches zero rows, enrichBook's error handling then just returns the
-- book unchanged, so the feature looked like it worked in every test but
-- never actually wrote anything against the live database.
--
-- `books` is a shared, unowned canonical catalog (no user_id column to
-- scope an update to), so, matching the existing insert policy, any
-- signed-in user may update any book row. That's the same trust level the
-- catalog already has (anyone can add a book); there's no per-user
-- ownership concept here to restrict against.

create policy "books_update_authenticated" on public.books
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
