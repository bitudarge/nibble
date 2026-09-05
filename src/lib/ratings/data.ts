import { supabase } from '../supabase/client'
import { recomputeTasteProfile } from '../recommender'
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
  void recomputeTasteProfile(userId)
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

export interface BareRating {
  userId: string
  displayName: string
  stars: number
}

interface RawBareRatingRow {
  user_id: string
  stars: number
  profiles: { display_name: string } | null
}

/**
 * The pure "what should be shown" half of getBareRatings, kept separate
 * from the Supabase call so the filtering/shaping logic is testable
 * without mocking a database round trip (same reasoning as
 * buildEnrichmentUpdate in src/lib/books/data.ts).
 */
export function excludeReviewedRatings(
  rows: RawBareRatingRow[],
  excludeUserIds: string[],
): BareRating[] {
  const exclude = new Set(excludeUserIds)
  return rows
    .filter((row) => !exclude.has(row.user_id))
    .map((row) => ({
      userId: row.user_id,
      displayName: row.profiles?.display_name ?? 'A reader',
      stars: row.stars,
    }))
}

/**
 * Everyone who rated this book but has no *public* review to show for it
 * (`excludeUserIds` is the set of public review authors already shown in
 * the Review tab's list). Ratings have always been globally readable to
 * every signed-in user by design (see the `ratings_select_authenticated`
 * policy, and src/lib/recommender/circleSignals.ts's own doc comment on
 * the same point) — unlike review text, which has real visibility rules
 * (private/public/circle). So surfacing a bare star count here isn't a
 * new privacy exposure, just making already-public data visible instead
 * of only folding it silently into the aggregate average, per the
 * owner's "even when people are not writing it they still rate" ask.
 */
export async function getBareRatings(
  bookId: string,
  excludeUserIds: string[],
): Promise<BareRating[]> {
  const db = requireSupabase()
  const { data, error } = await db
    .from('ratings')
    .select('user_id, stars, profiles(display_name)')
    .eq('book_id', bookId)
    .order('updated_at', { ascending: false })
  if (error) throw error

  return excludeReviewedRatings((data ?? []) as unknown as RawBareRatingRow[], excludeUserIds)
}
