import { supabase } from '../supabase/client'
import type { Rating } from '../../types/database'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured — check your .env file.')
  return supabase
}

export async function getUserRating(userId: string, bookId: string): Promise<Rating | null> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('ratings')
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .maybeSingle()
  if (error) throw error
  return data as Rating | null
}

export async function setRating(userId: string, bookId: string, stars: number): Promise<Rating> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('ratings')
    .upsert({ user_id: userId, book_id: bookId, stars }, { onConflict: 'user_id,book_id' })
    .select('*')
    .single()
  if (error) throw error
  return data as Rating
}

export interface AggregateRating {
  average: number | null
  count: number
}

/**
 * Small-scale (~100 users) so averaging client-side is fine — no need for
 * a materialized view or a Postgres function yet.
 */
export async function getAggregateRating(bookId: string): Promise<AggregateRating> {
  const db = requireSupabase()
  const { data, error } = await db.from('ratings').select('stars').eq('book_id', bookId)
  if (error) throw error

  const stars = (data ?? []).map((row) => row.stars as number)
  if (stars.length === 0) return { average: null, count: 0 }

  const average = stars.reduce((sum, s) => sum + s, 0) / stars.length
  return { average, count: stars.length }
}
