-- ---------------------------------------------------------------------------
-- Round 7.5: "treat the whole circle group like a normal groupchat" — the
-- owner asked to be able to remove members, and to remove a book from a
-- circle's reading-together list once nobody wants to keep reading it.
--
-- circles already has an owner-scoped UPDATE policy (circles_update_owner,
-- from the original schema), so renaming a circle needs no new policy —
-- this migration only adds the two that were actually missing.
-- ---------------------------------------------------------------------------

-- circle_members already lets someone delete their own row (leave), but
-- only the circle's owner may remove someone else — the same asymmetry a
-- normal group chat's "remove member" (admin-only) has.
create policy "circle_members_delete_owner" on public.circle_members
  for delete using (
    exists (
      select 1 from public.circles c
      where c.id = circle_members.circle_id and c.owner_id = auth.uid()
    )
  );

-- circle_reads already lets any member update one (see the original RLS
-- migration); extending that same scope to delete is not a widening of
-- trust, any member could already edit it. This is what lets someone
-- remove a book from "reading together" once the group's done with it.
create policy "circle_reads_delete_member" on public.circle_reads
  for delete using (
    exists (
      select 1 from public.circle_members cm
      where cm.circle_id = circle_reads.circle_id and cm.user_id = auth.uid()
    )
  );
