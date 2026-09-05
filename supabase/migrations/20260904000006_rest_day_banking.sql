-- Round 4 section 5: banked rest days that protect a streak across one
-- missed day.
--
-- Real semantics (this feature came from a mockup whose own version was
-- entirely fake — a single pre-seeded flag with no earning rule and a
-- "Use it" button that never touched the streak at all):
--   * One rest day is banked automatically every time a streak reaches a
--     multiple of 7, capped at 2 banked at once.
--   * If a reading session lands exactly one day after the last one AND a
--     rest day is banked, the streak now continues (consuming one banked
--     day) instead of resetting to 1. A gap of 2+ missed days still
--     resets it regardless, a rest day only ever covers one missed day.
--   * There is no manual "use it" action: the trigger already applies a
--     banked day automatically the moment it's actually needed, so a
--     button that pretends to "use" one ahead of time would either do
--     nothing real or have to fake protecting a day that hasn't been
--     missed yet, both are the black-box behavior this app avoids
--     everywhere else. The UI just shows how many are banked.

alter table public.reading_streaks
  add column rest_days_banked int not null default 0;

create or replace function public.update_reading_streak()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_date date;
  v_current int;
  v_longest int;
  v_rest_banked int;
  v_gap int;
begin
  select last_active_date, current_streak, longest_streak, rest_days_banked
    into v_last_date, v_current, v_longest, v_rest_banked
    from public.reading_streaks
    where user_id = new.user_id;

  if not found then
    insert into public.reading_streaks (user_id, current_streak, longest_streak, last_active_date)
    values (new.user_id, 1, 1, new.session_date);
    return new;
  end if;

  -- Backdated sessions don't affect the streak — the app only ever logs
  -- "today" right now, so this just guards against incorrectly resetting
  -- an already-current streak if that ever changes.
  if new.session_date < v_last_date then
    return new;
  end if;

  if v_last_date = new.session_date then
    return new; -- already logged today, no change
  end if;

  v_gap := new.session_date - v_last_date;

  if v_gap = 1 then
    v_current := v_current + 1;
  elsif v_gap = 2 and v_rest_banked > 0 then
    -- Exactly one day missed, and a rest day is banked to cover it: the
    -- streak continues as if that day hadn't been missed, and the banked
    -- day is spent.
    v_current := v_current + 1;
    v_rest_banked := v_rest_banked - 1;
  else
    v_current := 1; -- gap too large (or no rest day banked) resets it
  end if;

  v_longest := greatest(v_longest, v_current);

  if v_current > 0 and v_current % 7 = 0 then
    v_rest_banked := least(v_rest_banked + 1, 2);
  end if;

  update public.reading_streaks
  set current_streak = v_current,
      longest_streak = v_longest,
      last_active_date = new.session_date,
      rest_days_banked = v_rest_banked
  where user_id = new.user_id;

  return new;
end;
$$;
