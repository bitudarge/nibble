-- Phase 5: "showcase what they've read to the circle" (spec, Phase 4 & 5).
-- Circle members can see each other's FINISHED books only — never
-- in-progress reading or want-to-read, which stay private unless covered
-- by the circle_read-scoped policy (previous migration). This is
-- deliberately broader than that one (any shared circle, not just an
-- active circle_read) but narrower in status (finished only).

create policy "shelf_items_select_circle_showcase" on public.shelf_items
  for select using (
    status = 'finished'
    and exists (
      select 1 from public.circle_members cm1
      join public.circle_members cm2 on cm1.circle_id = cm2.circle_id
      where cm1.user_id = auth.uid() and cm2.user_id = shelf_items.user_id
    )
  );
