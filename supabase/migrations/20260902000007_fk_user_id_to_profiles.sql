-- Fixes a second bug found alongside the RLS recursion one: PostgREST's
-- embedded-select syntax (e.g. `select=*,profiles(*)`) only works when
-- there's a DIRECT foreign key from the queried table to the embedded one.
-- shelf_items/circle_members/circle_messages/reviews.user_id all
-- referenced auth.users(id) — correct for referential integrity, since
-- that's the actual identity table, but PostgREST has no way to know it
-- should join through to profiles from there, even though profiles.id is
-- always equal to the corresponding auth.users.id (one profile per user,
-- auto-created by the on_auth_user_created trigger).
--
-- Fix: point these FKs at public.profiles(id) instead. Safe to do without
-- a backfill — every existing user_id already has a matching profiles row
-- (the trigger guarantees one profile per signed-up user), and the
-- ON DELETE CASCADE chain still works: deleting auth.users cascades to
-- profiles (already the case), which now cascades to these tables too.

alter table public.shelf_items
  drop constraint shelf_items_user_id_fkey,
  add constraint shelf_items_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.circle_members
  drop constraint circle_members_user_id_fkey,
  add constraint circle_members_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.circle_messages
  drop constraint circle_messages_user_id_fkey,
  add constraint circle_messages_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.reviews
  drop constraint reviews_user_id_fkey,
  add constraint reviews_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade;
