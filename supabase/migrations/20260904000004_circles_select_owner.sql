-- Bug: creating a circle failed outright ("new row violates row-level
-- security policy for table circles"). Root cause: createCircle
-- (src/lib/circles/data.ts) does `insert(...).select('*').single()`, i.e.
-- an INSERT ... RETURNING. Postgres checks the RETURNING clause's rows
-- against the table's SELECT policy, but the only SELECT policy on
-- `circles` was circles_select_member (must already be a row in
-- circle_members). That row is only created by the on_circle_created
-- AFTER INSERT trigger (handle_new_circle) — which fires too late for
-- the same statement's RETURNING check to see it, so the whole INSERT
-- (trigger included) rolled back every time. Verified live: reproduced
-- the exact failure as an authenticated role, confirmed nothing
-- persisted (full rollback, no orphaned circles/circle_members rows).
--
-- Fix: a circle's owner can always see it, independent of circle_members
-- membership (which they'll have anyway, a moment later, via the
-- trigger) — this is also just correct on its own terms, you should
-- always be able to see a circle you own.

create policy "circles_select_owner" on public.circles
  for select using (owner_id = auth.uid());
