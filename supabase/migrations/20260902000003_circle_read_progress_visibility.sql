-- Phase 5: "reading together" needs each member's progress on the shared
-- book visible to the rest of the circle. shelf_items and reading_sessions
-- are otherwise strictly private (Phase 2) — this adds a narrowly scoped
-- exception: readable by a fellow circle member ONLY for a book that's
-- actually an active circle_read shared between both of them. It does not
-- expose a member's other books, ratings, or progress on anything else.

create policy "shelf_items_select_circle_read_members" on public.shelf_items
  for select using (
    exists (
      select 1 from public.circle_reads cr
      join public.circle_members cm_them
        on cm_them.circle_id = cr.circle_id and cm_them.user_id = shelf_items.user_id
      join public.circle_members cm_me
        on cm_me.circle_id = cr.circle_id and cm_me.user_id = auth.uid()
      where cr.book_id = shelf_items.book_id
    )
  );

create policy "reading_sessions_select_circle_read_members" on public.reading_sessions
  for select using (
    exists (
      select 1 from public.circle_reads cr
      join public.circle_members cm_them
        on cm_them.circle_id = cr.circle_id and cm_them.user_id = reading_sessions.user_id
      join public.circle_members cm_me
        on cm_me.circle_id = cr.circle_id and cm_me.user_id = auth.uid()
      where cr.book_id = reading_sessions.book_id
    )
  );
