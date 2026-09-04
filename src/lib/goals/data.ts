import { supabase } from '../supabase/client'
import type { ReadingGoal, ReadingStreak } from '../../types/database'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured — check your .env file.')
  return supabase
}

export async function getGoalForYear(userId: string, year: number): Promise<ReadingGoal | null> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('reading_goals')
    .select('*')
    .eq('user_id', userId)
    .eq('year', year)
    .maybeSingle()
  if (error) throw error
  return data as ReadingGoal | null
}

export async function setGoalForYear(
  userId: string,
  year: number,
  targetBooks: number,
): Promise<ReadingGoal> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('reading_goals')
    .upsert({ user_id: userId, year, target_books: targetBooks }, { onConflict: 'user_id,year' })
    .select('*')
    .single()
  if (error) throw error
  return data as ReadingGoal
}

type GoalPeriod = 'month' | 'week'

/** e.g. `new Date(2026, 8, 4)` -> `'2026-09'`. Pure, no timezone conversion needed since this only reads local calendar fields. */
export function getMonthPeriodKey(date: Date): string {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  return `${year}-${String(month).padStart(2, '0')}`
}

/**
 * ISO 8601 week: weeks start Monday, and a week belongs to whichever
 * calendar year contains its Thursday (equivalently, week 1 of a year is
 * the week containing that year's January 4th). This is the standard
 * "move to the Thursday of this week, then count weeks from the Thursday
 * of week 1" algorithm — not an approximation, the year-boundary edge
 * cases (e.g. Jan 1st sometimes belonging to the previous year's final
 * week, some years having 53 weeks) fall out of it correctly for free.
 */
export function getIsoWeekPeriodKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = (d.getUTCDay() + 6) % 7 // Mon=0 .. Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3) // now the Thursday of this week
  const isoYear = d.getUTCFullYear()

  const firstThursday = new Date(Date.UTC(isoYear, 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)

  const weekNum = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
  return `${isoYear}-W${String(weekNum).padStart(2, '0')}`
}

/** The `[start, end)` calendar range one period_key covers, for date-range queries against `finished_at`. */
function periodRange(period: GoalPeriod, periodKey: string): { start: string; end: string } {
  if (period === 'month') {
    const [yearStr, monthStr] = periodKey.split('-')
    const year = Number(yearStr)
    const month = Number(monthStr) // 1-indexed
    const start = new Date(Date.UTC(year, month - 1, 1))
    const end = new Date(Date.UTC(year, month, 1))
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
  }
  // 'week': ISO weeks start Monday. Rebuild the Monday from the same
  // Thursday-anchored math getIsoWeekPeriodKey used, rather than
  // duplicating a slightly different date algorithm that could disagree
  // with it at the edges.
  const [yearStr, weekStr] = periodKey.split('-W')
  const isoYear = Number(yearStr)
  const week = Number(weekStr)
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  const thisThursday = new Date(firstThursday.getTime() + (week - 1) * 7 * 24 * 3600 * 1000)
  const monday = new Date(thisThursday.getTime() - 3 * 24 * 3600 * 1000)
  const nextMonday = new Date(monday.getTime() + 7 * 24 * 3600 * 1000)
  return { start: monday.toISOString().slice(0, 10), end: nextMonday.toISOString().slice(0, 10) }
}

export async function getGoalForPeriod(
  userId: string,
  period: GoalPeriod,
  periodKey: string,
): Promise<ReadingGoal | null> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('reading_goals')
    .select('*')
    .eq('user_id', userId)
    .eq('period', period)
    .eq('period_key', periodKey)
    .maybeSingle()
  if (error) throw error
  return data as ReadingGoal | null
}

export async function setGoalForPeriod(
  userId: string,
  period: GoalPeriod,
  periodKey: string,
  targetBooks: number,
): Promise<ReadingGoal> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('reading_goals')
    .upsert(
      { user_id: userId, period, period_key: periodKey, target_books: targetBooks },
      { onConflict: 'user_id,period,period_key' },
    )
    .select('*')
    .single()
  if (error) throw error
  return data as ReadingGoal
}

/** Books with status='finished' whose finished_at falls within the given month or ISO week. */
export async function countBooksFinishedInPeriod(
  userId: string,
  period: GoalPeriod,
  periodKey: string,
): Promise<number> {
  const db = requireSupabase()
  const { start, end } = periodRange(period, periodKey)
  const { count, error } = await db
    .from('shelf_items')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'finished')
    .gte('finished_at', start)
    .lt('finished_at', end)
  if (error) throw error
  return count ?? 0
}

/**
 * Whether a streak increase from `previous` to `current` deserves a
 * celebration: the first small win at day 3, then every week after that.
 * Not every single day, or the celebration stops feeling special; not
 * only some arbitrary big number, or an early reader never sees one. Pure
 * so it's testable without a database.
 */
export function isStreakMilestone(previous: number, current: number): boolean {
  if (current <= previous) return false
  return current === 3 || current % 7 === 0
}

export async function getStreak(userId: string): Promise<ReadingStreak | null> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('reading_streaks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data as ReadingStreak | null
}

/** Books with status='finished' whose finished_at falls in the given year. */
export async function countBooksFinishedInYear(userId: string, year: number): Promise<number> {
  const db = requireSupabase()
  const { count, error } = await db
    .from('shelf_items')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'finished')
    .gte('finished_at', `${year}-01-01`)
    .lt('finished_at', `${year + 1}-01-01`)
  if (error) throw error
  return count ?? 0
}
