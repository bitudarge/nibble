-- Nibble — Phase 2: functions and triggers.
--
-- These are small, single-purpose, SECURITY DEFINER functions — they run
-- with elevated privileges but each does exactly one narrow, safe thing.
-- That's deliberate: it lets us keep RLS locked down tight (see the RLS
-- migration) while still allowing a couple of "system" actions — creating a
-- profile on signup, adding a circle's creator as its owner — that a regular
-- user's own permissions shouldn't be able to do directly.

-- ---------------------------------------------------------------------------
-- Keep `updated_at` columns honest without relying on app code to set them.
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger shelf_items_set_updated_at
  before update on public.shelf_items
  for each row execute function public.set_updated_at();

create trigger ratings_set_updated_at
  before update on public.ratings
  for each row execute function public.set_updated_at();

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

create trigger taste_profiles_set_updated_at
  before update on public.taste_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create a profiles row when someone signs up (wired to Google login
-- in Phase 3, but the trigger itself is auth-provider-agnostic).
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', 'Reader'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Auto-add a circle's creator as its 'owner' member. Regular users can't
-- insert into circle_members directly (see RLS migration) — this is the
-- only way an 'owner' row gets created, and it only ever inserts the row
-- for the circle that was just created, owned by whoever created it.
-- ---------------------------------------------------------------------------

create function public.handle_new_circle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.circle_members (circle_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_circle_created
  after insert on public.circles
  for each row execute function public.handle_new_circle();
