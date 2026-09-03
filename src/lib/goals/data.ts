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
