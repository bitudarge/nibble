-- Phase 7: reading streaks, computed server-side.
--
-- Previously reading_streaks existed but nothing ever wrote to it, and its
-- RLS policy let the owning user write it directly — meaning a client
-- could set current_streak to anything. This migration replaces that with
-- a trigger that maintains it correctly on every reading_sessions insert,
-- and locks the table down to read-only for its owner.

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
begin
  select last_active_date, current_streak, longest_streak
    into v_last_date, v_current, v_longest
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
  elsif v_last_date = new.session_date - 1 then
    v_current := v_current + 1;
  else
    v_current := 1; -- gap of more than a day resets it
  end if;

  v_longest := greatest(v_longest, v_current);

  update public.reading_streaks
  set current_streak = v_current, longest_streak = v_longest, last_active_date = new.session_date
  where user_id = new.user_id;

  return new;
end;
$$;

create trigger on_reading_session_created
  after insert on public.reading_sessions
  for each row execute function public.update_reading_streak();

-- Lock reading_streaks down to read-only for its owner — only the trigger
-- above (SECURITY DEFINER) can write it now.
drop policy "reading_streaks_all_own" on public.reading_streaks;

create policy "reading_streaks_select_own" on public.reading_streaks
  for select using (user_id = auth.uid());
