-- Round 2, section 5: monthly and weekly reading goals, alongside the
-- existing yearly one.
--
-- Deliberately additive rather than reshaping the existing year/target_books
-- columns: getGoalForYear/setGoalForYear (src/lib/goals/data.ts) and real
-- production data already depend on that exact shape (verified live rows
-- exist before writing this), so yearly goals keep working through the
-- unchanged `year` column and its original unique(user_id, year)
-- constraint. Monthly and weekly goals use two new columns instead:
-- `period` ('month' | 'week') and `period_key` (a sortable string
-- identifying which one, e.g. '2026-09' for September 2026, '2026-W36' for
-- ISO week 36 of 2026, computed application-side, not by Postgres, so the
-- exact week-numbering rule lives in one place).
--
-- A row is either a legacy yearly goal (year set, period/period_key null)
-- or a new period goal (period+period_key set, year left null), never
-- both, enforced by the two check constraints below. RLS is unchanged,
-- the existing reading_goals_all_own policy (for all using
-- user_id = auth.uid()) already covers every column on this table.

alter table public.reading_goals
  alter column year drop not null,
  add column period text check (period in ('month', 'week')),
  add column period_key text;

alter table public.reading_goals
  add constraint reading_goals_period_key_requires_period
    check ((period is null) = (period_key is null));

alter table public.reading_goals
  add constraint reading_goals_year_required_when_no_period
    check (period is not null or year is not null);

create unique index reading_goals_user_period_key_idx
  on public.reading_goals (user_id, period, period_key)
  where period_key is not null;
