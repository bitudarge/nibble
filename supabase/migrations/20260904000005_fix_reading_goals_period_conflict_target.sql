-- Bug: saving a monthly or weekly goal failed outright ("there is no
-- unique or exclusion constraint matching the ON CONFLICT specification",
-- Postgres error 42P10). Root cause: the previous migration
-- (20260904000003) created a PARTIAL unique index
-- (`where period_key is not null`) so it could coexist with existing
-- yearly-goal rows without a backfill. Postgres's ON CONFLICT inference
-- does not consider partial indexes unless the ON CONFLICT clause itself
-- repeats the same WHERE condition — which src/lib/goals/data.ts's
-- `setGoalForPeriod` (via Supabase's `.upsert(..., { onConflict:
-- 'user_id,period,period_key' })`) does not do, so every attempted save
-- errored before it could insert or update anything. Verified live:
-- reproduced the exact error as an authenticated role running the same
-- INSERT ... ON CONFLICT ... DO UPDATE the app actually sends.
--
-- Fix: a plain (non-partial) unique constraint on the same three columns
-- instead. This still coexists safely with legacy yearly rows (which have
-- period/period_key both null): standard SQL treats NULL as never equal
-- to another NULL for uniqueness purposes, so any number of legacy rows
-- with period_key null never conflict with each other or with real period
-- rows — the exact same practical protection the partial index gave,
-- minus the ON CONFLICT inference problem.

drop index public.reading_goals_user_period_key_idx;

alter table public.reading_goals
  add constraint reading_goals_user_period_key_key
    unique (user_id, period, period_key);
