-- Same fix as the previous migration, applied to the remaining
-- user-identity columns for consistency, so this class of bug (PostgREST
-- can't embed profiles(*) without a direct FK) doesn't resurface as more
-- features join these tables with profiles later. ratings.user_id was
-- the one actively broken (src/lib/recommender/circleSignals.ts embeds
-- profiles(display_name) through it); the rest are preventative.

alter table public.ratings
  drop constraint ratings_user_id_fkey,
  add constraint ratings_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.reading_sessions
  drop constraint reading_sessions_user_id_fkey,
  add constraint reading_sessions_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.reading_goals
  drop constraint reading_goals_user_id_fkey,
  add constraint reading_goals_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.reading_streaks
  drop constraint reading_streaks_user_id_fkey,
  add constraint reading_streaks_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.taste_profiles
  drop constraint taste_profiles_user_id_fkey,
  add constraint taste_profiles_user_id_fkey
    foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.circles
  drop constraint circles_owner_id_fkey,
  add constraint circles_owner_id_fkey
    foreign key (owner_id) references public.profiles (id) on delete cascade;

notify pgrst, 'reload schema';
